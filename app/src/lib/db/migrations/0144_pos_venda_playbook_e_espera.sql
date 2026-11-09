-- 0144 - Playbook configuravel do pos-venda e registro de espera por projeto (09/11/2026).
--
-- Duas pecas novas, nada alem delas:
--
--  1. pos_venda_playbooks + pos_venda_playbook_passos: o processo (passos, prazos,
--     texto do playbook, checklist) deixa de ser constante em TypeScript
--     (lib/crm/pos-venda-checklists.ts) e vira dado editavel por administrador.
--
--  2. pos_venda_esperas: periodos em que a bola esta com o cliente, com a operadora
--     ou com o time. Alimenta os dois relogios do projeto. Antes nao havia historico
--     nenhum: o fulfillment so guardava o status atual.
--
-- Por que periodos e nao colunas acumuladoras em fulfillments: o KPI por operadora
-- (PABX) precisa saber QUEM atrasou e QUANTO, por episodio; um acumulador perde o
-- episodio, nao se audita e nao se recalcula se alguem corrigir uma data.
--
-- Aditiva e idempotente. Nao toca fulfillments. Seed so do playbook de Callface AI,
-- para cada organizacao existente (ON CONFLICT DO NOTHING).
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS pos_venda_esperas;
--   DROP TABLE IF EXISTS pos_venda_playbook_passos;
--   DROP TABLE IF EXISTS pos_venda_playbooks;

BEGIN;

CREATE TABLE IF NOT EXISTS pos_venda_playbooks (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id           uuid NOT NULL REFERENCES organizacoes(id),
  familia                  text NOT NULL CHECK (familia IN ('CALLFACE_AI','PABX','WHITE_LABEL')),
  tipo                     text NOT NULL CHECK (tipo IN ('ONBOARDING','IMPLEMENTATION')),
  nome                     text NOT NULL,
  prazo_total_dias         integer NOT NULL CHECK (prazo_total_dias > 0),
  bloco_abertura_dias      integer NOT NULL DEFAULT 0 CHECK (bloco_abertura_dias >= 0),
  bloco_execucao_dias      integer NOT NULL DEFAULT 0 CHECK (bloco_execucao_dias >= 0),
  bloco_encerramento_dias  integer NOT NULL DEFAULT 0 CHECK (bloco_encerramento_dias >= 0),
  responsavel_padrao_id    uuid REFERENCES usuarios(id),
  ativo                    boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_venda_playbooks_blocos_somam
    CHECK (bloco_abertura_dias + bloco_execucao_dias + bloco_encerramento_dias = prazo_total_dias),
  CONSTRAINT uq_pos_venda_playbook UNIQUE (organizacao_id, familia, tipo)
);

CREATE TABLE IF NOT EXISTS pos_venda_playbook_passos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id       uuid NOT NULL REFERENCES organizacoes(id),
  playbook_id          uuid NOT NULL REFERENCES pos_venda_playbooks(id) ON DELETE CASCADE,
  passo                text NOT NULL,
  ordem                integer NOT NULL,
  titulo               text NOT NULL,
  playbook             text NOT NULL DEFAULT '',
  -- jsonb e nao text[]: o driver do projeto (fetch_types:false) nao serializa array.
  itens                jsonb NOT NULL DEFAULT '[]'::jsonb,
  prazo_dias           integer NOT NULL DEFAULT 0 CHECK (prazo_dias >= 0),
  -- SLA em horas corridas contado da entrada do projeto; quando presente vence o prazo em dias.
  sla_horas            integer CHECK (sla_horas IS NULL OR sla_horas > 0),
  prioridade           text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta','urgente')),
  -- {"complemento":"agente_ia"}: o passo inteiro so existe com esse complemento. NULL = sempre.
  condicao             jsonb,
  bloco                text NOT NULL CHECK (bloco IN ('abertura','execucao','encerramento')),
  -- Conteudo que entra DENTRO do passo quando o complemento foi vendido:
  -- [{"complemento":"agente_ia","playbook":"md","itens":["..."]}]
  itens_condicionais   jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Como o passo nasce quando o projeto e um upgrade (cliente ja concluiu esta familia):
  -- {"titulo":"..","playbook":"md","itens":[".."]}. Passo sem variante nao nasce no upgrade.
  variante_upgrade     jsonb,
  ativo                boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_pos_venda_playbook_passo UNIQUE (playbook_id, passo)
);
CREATE INDEX IF NOT EXISTS idx_pos_venda_passos_playbook ON pos_venda_playbook_passos (playbook_id, ordem);

CREATE TABLE IF NOT EXISTS pos_venda_esperas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id   uuid NOT NULL REFERENCES organizacoes(id),
  fulfillment_id   uuid NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  motivo           text NOT NULL CHECK (motivo IN ('cliente','operadora','interno')),
  inicio           timestamptz NOT NULL DEFAULT now(),
  fim              timestamptz,
  detalhe          text,
  iniciada_por     uuid REFERENCES usuarios(id),
  encerrada_por    uuid REFERENCES usuarios(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_venda_esperas_fim_depois CHECK (fim IS NULL OR fim >= inicio)
);
-- No maximo uma espera ABERTA por projeto: a bola so esta com um lado de cada vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_venda_espera_aberta
  ON pos_venda_esperas (fulfillment_id) WHERE fim IS NULL;
CREATE INDEX IF NOT EXISTS idx_pos_venda_esperas_fulfillment ON pos_venda_esperas (organizacao_id, fulfillment_id, inicio);

-- ---------------------------------------------------------------------------
-- Seed: Callface AI / Onboarding. 15 dias corridos, blocos 5 / 0 / 10.
-- Texto transcrito de 02_PROJETOS/Callface/ONFACE/produto/2026-11-09-spec-onboarding-callface-ai.
-- Prazos dos passos: dias relativos ao inicio do BLOCO (encerramento comeca no dia 5).
-- ---------------------------------------------------------------------------
INSERT INTO pos_venda_playbooks (organizacao_id, familia, tipo, nome, prazo_total_dias, bloco_abertura_dias, bloco_execucao_dias, bloco_encerramento_dias)
SELECT o.id, 'CALLFACE_AI', 'ONBOARDING', 'Onboarding Callface AI', 15, 5, 0, 10
  FROM organizacoes o
ON CONFLICT (organizacao_id, familia, tipo) DO NOTHING;

INSERT INTO pos_venda_playbook_passos
  (organizacao_id, playbook_id, passo, ordem, titulo, playbook, itens, prazo_dias, sla_horas, prioridade, bloco, itens_condicionais, variante_upgrade)
SELECT p.organizacao_id, p.id, s.passo, s.ordem, s.titulo, s.playbook, s.itens::jsonb, s.prazo_dias, s.sla_horas, s.prioridade, s.bloco, s.cond::jsonb, s.upg::jsonb
  FROM pos_venda_playbooks p
 CROSS JOIN (VALUES
  ('contato_boas_vindas', 1, 'Contato de boas-vindas',
   $md$**Objetivo:** ligar, apresentar-se, dar boas-vindas e agendar a reunião de onboarding.

SLA de primeiro contato: 2 horas corridas a partir do Ganho. Passou disso, a tarefa aparece atrasada.

O e-mail de boas-vindas já saiu no Ganho, com o link para o cliente agendar na agenda do responsável. A primeira mensagem de WhatsApp sai pelo número do responsável, com as variáveis do cliente.$md$,
   '["Ligar para o cliente","Apresentar-se e dar as boas-vindas","Agendar a reunião de onboarding"]',
   0, 2, 'alta', 'abertura', '[]',
   '{"titulo":"Validar se o cliente precisa de suporte, dúvida ou treinamento agregado","playbook":"**Objetivo:** entrar em contato e validar se o cliente precisa de suporte, tem dúvida ou precisa de treinamento agregado.\n\nO cliente já concluiu o onboarding deste produto: as etapas anteriores ficam registradas como concluídas, com a data em que foram feitas.","itens":["Entrar em contato com o cliente","Validar se precisa de suporte, dúvida ou treinamento agregado"]}'),
  ('preparacao_reuniao', 2, 'Preparação da reunião',
   $md$**Objetivo:** chegar na reunião de onboarding sabendo o que foi contratado e como conduzi-la.

- Levantar o escopo contratado.
- Fazer o follow-up de confirmação da reunião.
- Descobrir se o cliente é usuário individual, gestor ou gestor com equipe. Isso muda como a reunião é conduzida.
- Registrar nos campos de levantamento.$md$,
   '["Levantar o escopo contratado","Fazer o follow-up de confirmação","Descobrir se é usuário individual, gestor ou gestor com equipe","Registrar nos campos de levantamento"]',
   2, NULL, 'media', 'abertura', '[]', NULL),
  ('reuniao_onboarding', 3, 'Reunião de onboarding',
   $md$**Objetivo:** deixar o cliente com acesso, usuários convidados e a plataforma configurada.

- Confirmar login e acesso.
- Convidar usuários.
- Apresentar funcionalidades.
- Ativar configurações.
- Levantar qual CRM o cliente usa.
- Treinamento completo da plataforma.

Ao final, já agendar a segunda reunião (cerca de 7 dias depois).$md$,
   '["Confirmar login e acesso","Convidar usuários","Apresentar funcionalidades","Ativar configurações","Levantar qual CRM o cliente usa","Treinamento completo da plataforma","Já agendar a segunda reunião (cerca de 7 dias)"]',
   3, NULL, 'alta', 'abertura',
   '[{"complemento":"agente_ia","playbook":"**Agente de IA contratado (isolado ou plano Pro):** o treinamento do agente entra dentro desta tarefa, não como tarefa separada.","itens":["Treinamento do Agente de IA"]}]',
   NULL),
  ('envio_canais_suporte', 4, 'Envio de canais de comunicação e suporte',
   $md$**Objetivo:** o cliente saber por onde falar com atendimento, suporte e financeiro.

Enviar por WhatsApp **e** por e-mail a mensagem com os canais de atendimento, suporte e financeiro. O botão do projeto abre o atendimento com a mensagem pronta.$md$,
   '["Enviar a mensagem por WhatsApp","Enviar a mensagem por e-mail"]',
   3, NULL, 'media', 'abertura', '[]', NULL),
  ('agendar_reuniao_insights', 5, 'Agendar reunião de insights e relatórios',
   $md$**Objetivo:** agendar a segunda reunião.

A reunião de insights e relatórios acontece cerca de 7 dias depois da reunião de onboarding.$md$,
   '["Agendar a reunião de insights e relatórios"]',
   3, NULL, 'media', 'abertura', '[]', NULL),
  ('reuniao_insights', 6, 'Reunião de insights e relatórios',
   $md$**Objetivo:** apresentar relatórios, insights e gestão de times, e tirar as dúvidas finais.

A apresentação da segunda reunião é 100% customizada, com dados de uso em tempo real vindos da base do Callface AI.$md$,
   '["Apresentar relatórios","Apresentar insights","Apresentar gestão de times","Tirar dúvidas finais"]',
   5, NULL, 'alta', 'encerramento', '[]', NULL),
  ('encerramento_nps', 7, 'Encerramento: envio e acompanhamento do NPS',
   $md$**Objetivo:** enviar o NPS ao término da segunda reunião e acompanhar até o cliente responder. É preciso saber se abriu, se respondeu e quais foram as respostas.

Escala de mercado: 0 a 6 detrator, 7 a 8 neutro, 9 a 10 promotor.

- **Detrator:** entrar em contato, marcar reunião de alinhamento de expectativa e entender as dores. Ao fim, reenviar o NPS ou liberar o handoff direto.
- **Neutro:** contato por WhatsApp para levantar dúvidas e dores. Não é reunião.
- **Promotor:** encerramento feito, pronto para handoff.

Se o cliente responder, isso basta para encerrar. Se não responder em 3 dias, o time pode dar baixa, registrando o motivo e o retrato de uso do momento.

O onboarding termina com o handoff para o CS.$md$,
   '["Enviar o NPS ao término da segunda reunião","Acompanhar até o cliente responder","Fazer o handoff para o CS, ou dar baixa com motivo e retrato de uso"]',
   10, NULL, 'media', 'encerramento', '[]', NULL)
 ) AS s(passo, ordem, titulo, playbook, itens, prazo_dias, sla_horas, prioridade, bloco, cond, upg)
 WHERE p.familia = 'CALLFACE_AI' AND p.tipo = 'ONBOARDING'
ON CONFLICT (playbook_id, passo) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed do modelo de e-mail de boas-vindas em email_templates (texto configuravel em
-- Ajustes > E-mail > Modelos). RASCUNHO sobrio, nao aprovado: a spec define o
-- gatilho e o CTA, nao o texto. Variaveis: nome, empresa, responsavel, link_agendamento.
-- ---------------------------------------------------------------------------
INSERT INTO email_templates (organizacao_id, nome, assunto, corpo, variaveis, categoria)
SELECT o.id, 'Onboarding - boas-vindas',
       'Bem-vindo à Callface, {{nome}}: agende sua reunião de onboarding',
       $h$<p>Olá, {{nome}}.</p>
<p>Seja bem-vindo à Callface. A {{empresa}} já está com tudo pronto do nosso lado.</p>
<p>O próximo passo é a reunião de onboarding, em que o {{responsavel}} confirma seu acesso, convida os usuários e apresenta a plataforma. Escolha o melhor horário na agenda dele:</p>
<p><a href="{{link_agendamento}}">Agendar reunião de onboarding</a></p>
<p>Qualquer dúvida antes disso, é só responder este e-mail.</p>
<p>{{responsavel}}<br>Callface</p>$h$,
       '["nome","empresa","responsavel","link_agendamento"]'::jsonb, 'onboarding'
  FROM organizacoes o
 WHERE NOT EXISTS (SELECT 1 FROM email_templates t WHERE t.organizacao_id = o.id AND t.nome = 'Onboarding - boas-vindas');

COMMIT;
