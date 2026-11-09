-- 0145 - Playbooks de White Label e PABX no pos-venda (09/11/2026).
--
-- A 0144 semeou so o playbook de Callface AI. Sem playbook, o motor devolve
-- `aplicado: false` (motor.ts: "sem playbook ativo para <familia>/<tipo>") e o projeto
-- nasce sem tarefa nenhuma: o dono viu "Tarefas 0" em todo White Label e PABX.
--
-- Quatro playbooks por organizacao, transcritos das specs de 09/11/2026:
--   02_PROJETOS/Callface/ONFACE/produto/2026-11-09-spec-onboarding-white-label
--   02_PROJETOS/Callface/ONFACE/produto/2026-11-09-spec-onboarding-pabx
--   02_PROJETOS/Callface/ONFACE/produto/2026-11-09-spec-nucleo-pos-venda
--
--   WHITE_LABEL / ONBOARDING      30 dias corridos, blocos 5 / 20 / 5. Sem NPS.
--   WHITE_LABEL / IMPLEMENTATION  20 dias corridos (T0 ao go-live).
--   PABX        / ONBOARDING      25 dias corridos, blocos 5 / 15 / 5. Sem NPS.
--   PABX        / IMPLEMENTATION  15 dias corridos (T0 ao go-live).
--
-- Decisoes de modelagem:
--  * O bloco de IMPLANTACAO (execucao) do onboarding nao tem passo: a escalada para
--    implantacao e botao, nao tarefa. Os passos do onboarding ficam em abertura e
--    encerramento; o prazo do encerramento conta a partir do dia abertura+execucao
--    (regras.ts: inicioDoBloco), entao as tarefas 5 a 7 vencem depois da implantacao.
--  * O handoff so libera com TODAS as tarefas concluidas (projeto.ts: podeFazerHandoff),
--    e "treinamento realizado" e uma tarefa propria, distinta de "marcar treinamento":
--    agendar nao libera o handoff, realizar e registrar libera.
--  * Os projetos de implantacao nascem com o prazo contado do inicio deles (que e o T0),
--    por isso o playbook IMPLEMENTATION tem tudo em `execucao`, com abertura/encerramento 0.
--  * Operadora: a portabilidade tem item de checklist exigindo o registro da operadora.
--    A coluna estruturada que o KPI le hoje e fulfillment_linhas_portabilidade.operadora_atual
--    (preenchida pelo cliente no formulario); nao ha campo editavel pelo implantador. Ver
--    o relatorio da entrega: isso fica pendente de decisao de modelo, nao e semeavel.
--
-- Aditiva e idempotente: ON CONFLICT DO NOTHING em playbook e em passo; reexecutar nao
-- sobrescreve texto que um administrador tenha editado em Ajustes. Nao toca em fulfillments
-- nem em tarefas ja criadas. ATENCAO: so a migration NAO cria tarefa nos projetos que ja existem.
-- O motor (`prepararProjeto`, lib/pos-venda/motor.ts) roda na criacao do projeto; para os existentes
-- ele precisa ser chamado de novo (e idempotente por chave `ORIGEM:projeto:passo`).
--
-- ROLLBACK (so enquanto nenhuma tarefa de projeto tiver sido gerada a partir destes passos):
--   DELETE FROM pos_venda_playbooks
--    WHERE (familia, tipo) IN (('WHITE_LABEL','ONBOARDING'),('WHITE_LABEL','IMPLEMENTATION'),
--                              ('PABX','ONBOARDING'),('PABX','IMPLEMENTATION'));
--   (os passos saem junto: ON DELETE CASCADE)

BEGIN;

INSERT INTO pos_venda_playbooks (organizacao_id, familia, tipo, nome, prazo_total_dias, bloco_abertura_dias, bloco_execucao_dias, bloco_encerramento_dias)
SELECT o.id, v.familia, v.tipo, v.nome, v.total, v.a, v.e, v.c
  FROM organizacoes o
 CROSS JOIN (VALUES
   ('WHITE_LABEL', 'ONBOARDING',     'Onboarding White Label',     30, 5, 20, 5),
   ('WHITE_LABEL', 'IMPLEMENTATION', 'Implantação White Label',    20, 0, 20, 0),
   ('PABX',        'ONBOARDING',     'Onboarding PABX',            25, 5, 15, 5),
   ('PABX',        'IMPLEMENTATION', 'Implantação PABX',           15, 0, 15, 0)
 ) AS v(familia, tipo, nome, total, a, e, c)
ON CONFLICT (organizacao_id, familia, tipo) DO NOTHING;

-- ---------------------------------------------------------------------------
-- WHITE_LABEL / ONBOARDING. Prazos dos passos: dias relativos ao inicio do BLOCO.
-- ---------------------------------------------------------------------------
INSERT INTO pos_venda_playbook_passos
  (organizacao_id, playbook_id, passo, ordem, titulo, playbook, itens, prazo_dias, sla_horas, prioridade, bloco, itens_condicionais, variante_upgrade)
SELECT p.organizacao_id, p.id, s.passo, s.ordem, s.titulo, s.playbook, s.itens::jsonb, s.prazo_dias, s.sla_horas, s.prioridade, s.bloco, '[]'::jsonb, s.upg::jsonb
  FROM pos_venda_playbooks p
 CROSS JOIN (VALUES
  ('contato_boas_vindas', 1, 'Contato de boas-vindas',
   $md$**Objetivo:** por ligação ou WhatsApp, dar as boas-vindas e marcar a reunião de kickoff.

SLA de primeiro contato: 2 horas corridas a partir do Ganho. Passou disso, a tarefa aparece atrasada.

O e-mail de boas-vindas já saiu no Ganho. A mensagem de WhatsApp fica pronta no projeto, para enviar pelo número do responsável. Os canais de contato e suporte são enviados aqui ou no kickoff.$md$,
   '["Ligar ou chamar no WhatsApp","Dar as boas-vindas","Marcar a reunião de kickoff","Enviar os canais de contato e suporte (aqui ou no kickoff)"]',
   0, 2, 'alta', 'abertura',
   $j${"titulo":"Contato para verificar as necessidades do cliente","playbook":"**Objetivo:** entrar em contato e verificar as necessidades do cliente neste upgrade.\n\nO cliente já concluiu o onboarding e a implantação de White Label: as etapas anteriores ficam registradas como concluídas, com a data em que foram feitas.","itens":["Entrar em contato com o cliente","Verificar as necessidades do cliente"]}$j$),
  ('kickoff', 2, 'Preparação e reunião de kickoff',
   $md$**Objetivo:** alinhar com o cliente o que foi contratado, o que vem a seguir e em que prazo.

Na reunião, validar:
- o **escopo contratado**;
- a **capacidade de licenças** reservada na proposta (é capacidade contratada, não consumo: o produto ainda não mede licenças ativadas);
- as **expectativas** do cliente;
- os **próximos passos e prazos**.

Informações encontradas pelo caminho podem e devem ser registradas nos campos de levantamento.$md$,
   '["Levantar o escopo contratado antes da reunião","Validar escopo contratado","Validar a capacidade de licenças","Alinhar as expectativas do cliente","Combinar próximos passos e prazos","Registrar nos campos de levantamento"]',
   3, NULL, 'alta', 'abertura', NULL),
  ('grupo_whatsapp', 3, 'Criação do grupo de implantação no WhatsApp',
   $md$**Objetivo:** todos acompanharem a implantação no mesmo lugar.

Criar o grupo de WhatsApp com o **cliente**, a pessoa de **CS** e a pessoa de **implantação**. É por ele que CS e implantação, corresponsáveis, cobram e respondem durante a implantação.$md$,
   '["Criar o grupo no WhatsApp","Adicionar o cliente, o CS e a pessoa de implantação","Registrar o link do grupo no projeto"]',
   3, NULL, 'media', 'abertura', NULL),
  ('envio_formulario', 4, 'Envio do formulário',
   $md$**Objetivo:** o cliente receber o link de coleta das informações e dos materiais.

O link público do projeto é o formulário. Envie e depois acompanhe: o prazo do cliente para preencher é de **5 dias** e corre no relógio do cliente. Enquanto a bola estiver com ele, marque **espera: cliente** ("aguardando envio dos materiais") para pausar o relógio do time. O time cobra, tira dúvidas e oferece ajuda.$md$,
   '["Enviar o link do formulário","Marcar espera do cliente enquanto ele preenche","Cobrar, tirar dúvidas e oferecer ajuda"]',
   3, NULL, 'media', 'abertura', NULL),
  ('validacao_materiais', 5, 'Validação dos materiais entregues',
   $md$**Objetivo:** conferir se veio tudo e se serve.

Depois desta tarefa, o botão **Escalar para implantação** registra que os materiais foram recebidos e validados, inicia o SLA de implantação (T0) e passa o projeto ao time técnico. Escalar não é uma tarefa: é o botão do projeto.$md$,
   '["Conferir se todos os materiais vieram","Conferir se os materiais servem (logo, cores, favicon, domínio)","Pedir o que faltou ou veio errado"]',
   5, NULL, 'alta', 'abertura', NULL),
  ('marcar_treinamento', 6, 'Marcar reunião de treinamento',
   $md$**Objetivo:** agendar o treinamento de usabilidade da plataforma e do portal do administrador.

Faça depois que a implantação voltar concluída. Agendar não libera o handoff: só o treinamento **realizado e registrado** libera.$md$,
   '["Propor horários ao cliente","Agendar a reunião de treinamento"]',
   1, NULL, 'media', 'encerramento', NULL),
  ('treinamento_realizado', 7, 'Reunião de treinamento realizada',
   $md$**Objetivo:** treinar o cliente na plataforma e no portal do administrador, e registrar.

Conclua esta tarefa só depois da reunião, com o registro da presença. Sem ela o handoff não libera. Este produto não tem NPS: a métrica é prazo.$md$,
   '["Treinar na usabilidade da plataforma","Treinar no portal do administrador","Registrar a presença"]',
   4, NULL, 'alta', 'encerramento', NULL),
  ('handoff', 8, 'Handoff',
   $md$**Objetivo:** encerrar o onboarding.

O handoff do White Label vai para o **CS**. Só libera com o treinamento realizado e registrado.$md$,
   '["Confirmar que o treinamento foi realizado e registrado","Fazer o handoff para o CS"]',
   5, NULL, 'media', 'encerramento', NULL)
 ) AS s(passo, ordem, titulo, playbook, itens, prazo_dias, sla_horas, prioridade, bloco, upg)
 WHERE p.familia = 'WHITE_LABEL' AND p.tipo = 'ONBOARDING'
ON CONFLICT (playbook_id, passo) DO NOTHING;

-- ---------------------------------------------------------------------------
-- WHITE_LABEL / IMPLEMENTATION. 20 dias a partir do T0, tudo no bloco de execucao.
-- ---------------------------------------------------------------------------
INSERT INTO pos_venda_playbook_passos
  (organizacao_id, playbook_id, passo, ordem, titulo, playbook, itens, prazo_dias, sla_horas, prioridade, bloco, itens_condicionais, variante_upgrade)
SELECT p.organizacao_id, p.id, s.passo, s.ordem, s.titulo, s.playbook, s.itens::jsonb, s.prazo_dias, NULL, s.prioridade, 'execucao', '[]'::jsonb, NULL
  FROM pos_venda_playbooks p
 CROSS JOIN (VALUES
  ('provisionar_ambiente', 1, 'Provisionar o ambiente',
   $md$**Objetivo:** subir o ambiente White Label do cliente.

O projeto traz do onboarding quem é o cliente, a negociação, o CS responsável, o vendedor, o Cliente 360 e **todos os materiais enviados pelo cliente**, com quem enviou e quando.$md$,
   '["Provisionar o ambiente","Conferir a capacidade de licenças contratada"]', 3, 'alta'),
  ('identidade_visual', 2, 'Aplicar identidade visual',
   $md$**Objetivo:** deixar a plataforma com a cara do parceiro.

Usar os materiais enviados pelo cliente: logo, cores, favicon e personalização.$md$,
   '["Aplicar o logo","Aplicar as cores","Aplicar o favicon","Aplicar a personalização"]', 7, 'media'),
  ('dominio', 3, 'Configuração de domínio e apontamento',
   $md$**Objetivo:** a plataforma responder no domínio do cliente.

Domínio externo depende do cliente liberar o apontamento de DNS. Se travar, marque espera com motivo **cliente** e escreva o que falta.$md$,
   '["Configurar o domínio","Fazer o apontamento","Conferir o certificado e o acesso"]', 10, 'media'),
  ('autenticacao', 4, 'Testar e validar a autenticação',
   $md$**Objetivo:** garantir que o login funciona no ambiente e no domínio do cliente.$md$,
   '["Testar o login","Testar a recuperação de senha","Validar o acesso do administrador"]', 13, 'media'),
  ('homologacao', 5, 'Homologação com o cliente',
   $md$**Objetivo:** o cliente validar o ambiente antes de ir ao ar. Pode ser em reunião.$md$,
   '["Marcar a homologação com o cliente","Conduzir a homologação","Registrar o aceite ou os ajustes pedidos"]', 17, 'alta'),
  ('go_live', 6, 'Go-live',
   $md$**Objetivo:** colocar a plataforma no ar para o cliente.$md$,
   '["Confirmar o aceite da homologação","Colocar no ar","Avisar o CS e o cliente"]', 20, 'alta'),
  ('implantacao_finalizada', 7, 'Registrar implantação finalizada',
   $md$**Objetivo:** encerrar a implantação.

Ao finalizar, o projeto volta ao onboarding **já marcado como concluído**, e o CS retoma na marcação do treinamento.$md$,
   '["Registrar a implantação como finalizada"]', 20, 'media')
 ) AS s(passo, ordem, titulo, playbook, itens, prazo_dias, prioridade)
 WHERE p.familia = 'WHITE_LABEL' AND p.tipo = 'IMPLEMENTATION'
ON CONFLICT (playbook_id, passo) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PABX / ONBOARDING. Mesma estrutura do White Label; muda o que a spec manda mudar.
-- ---------------------------------------------------------------------------
INSERT INTO pos_venda_playbook_passos
  (organizacao_id, playbook_id, passo, ordem, titulo, playbook, itens, prazo_dias, sla_horas, prioridade, bloco, itens_condicionais, variante_upgrade)
SELECT p.organizacao_id, p.id, s.passo, s.ordem, s.titulo, s.playbook, s.itens::jsonb, s.prazo_dias, s.sla_horas, s.prioridade, s.bloco, '[]'::jsonb, s.upg::jsonb
  FROM pos_venda_playbooks p
 CROSS JOIN (VALUES
  ('contato_boas_vindas', 1, 'Contato de boas-vindas',
   $md$**Objetivo:** por ligação ou WhatsApp, dar as boas-vindas e marcar a reunião de kickoff.

SLA de primeiro contato: 2 horas corridas a partir do Ganho. Passou disso, a tarefa aparece atrasada.

O e-mail de boas-vindas já saiu no Ganho. A mensagem de WhatsApp fica pronta no projeto, para enviar pelo número do responsável. Os canais de contato e suporte são enviados aqui ou no kickoff.$md$,
   '["Ligar ou chamar no WhatsApp","Dar as boas-vindas","Marcar a reunião de kickoff","Enviar os canais de contato e suporte (aqui ou no kickoff)"]',
   0, 2, 'alta', 'abertura',
   $j${"titulo":"Contato para verificar as necessidades do cliente","playbook":"**Objetivo:** entrar em contato e verificar as necessidades do cliente neste upgrade.\n\nO cliente já concluiu o onboarding e a implantação de PABX: as etapas anteriores ficam registradas como concluídas, com a data em que foram feitas.","itens":["Entrar em contato com o cliente","Verificar as necessidades do cliente"]}$j$),
  ('kickoff', 2, 'Preparação e reunião de kickoff',
   $md$**Objetivo:** alinhar com o cliente o que foi contratado, o que vem a seguir e em que prazo. No PABX se entrega uma operação de telefonia que precisa funcionar de ponta a ponta.

Na reunião, validar:
- **ramais**, **linhas** e **minutos** contratados;
- os **responsáveis** do lado do cliente;
- se existe um **responsável técnico** do lado do cliente (é quem fala com a implantação e com a operadora);
- as **expectativas** do cliente, os **próximos passos e prazos**.

Informações encontradas pelo caminho podem e devem ser registradas nos campos de levantamento.$md$,
   '["Levantar o escopo contratado antes da reunião","Validar ramais","Validar linhas","Validar minutos","Identificar os responsáveis do cliente","Confirmar se há responsável técnico do lado do cliente","Combinar próximos passos e prazos","Registrar nos campos de levantamento"]',
   3, NULL, 'alta', 'abertura', NULL),
  ('grupo_whatsapp', 3, 'Criação do grupo de implantação no WhatsApp',
   $md$**Objetivo:** todos acompanharem a implantação no mesmo lugar.

Criar o grupo de WhatsApp com o **cliente**, a pessoa de **CS** e a pessoa de **implantação**. É por ele que CS e implantação, corresponsáveis, cobram e respondem durante a implantação.$md$,
   '["Criar o grupo no WhatsApp","Adicionar o cliente, o CS e a pessoa de implantação","Registrar o link do grupo no projeto"]',
   3, NULL, 'media', 'abertura', NULL),
  ('envio_formulario', 4, 'Envio do formulário do PABX',
   $md$**Objetivo:** o cliente receber o formulário próprio do PABX, com as linhas, as operadoras e os dados técnicos.

O link público do projeto é o formulário. Envie e depois acompanhe: o prazo do cliente para preencher é de **5 dias** e corre no relógio do cliente. Enquanto a bola estiver com ele, marque **espera: cliente** para pausar o relógio do time. Quando o cliente responde, o ONFACE notifica e as respostas aparecem completas no projeto de onboarding e na tela de implantação.$md$,
   '["Enviar o link do formulário do PABX","Marcar espera do cliente enquanto ele preenche","Cobrar, tirar dúvidas e oferecer ajuda"]',
   3, NULL, 'media', 'abertura', NULL),
  ('validacao_materiais', 5, 'Validação dos materiais entregues',
   $md$**Objetivo:** conferir se veio tudo e se serve.

Depois desta tarefa, o botão **Escalar para implantação** registra que os materiais foram recebidos e validados, inicia o SLA de implantação (T0) e passa o projeto ao time técnico. Escalar não é uma tarefa: é o botão do projeto.$md$,
   '["Conferir se as respostas do formulário estão completas","Conferir as linhas e as operadoras informadas","Pedir o que faltou ou veio errado"]',
   5, NULL, 'alta', 'abertura', NULL),
  ('marcar_treinamento', 6, 'Marcar reunião de treinamento',
   $md$**Objetivo:** agendar o treinamento do cliente no PABX.

O **implantador participa** da reunião, mas **quem faz a ponte com o cliente é o CS**: o CS marca e conduz o contato, e convida o implantador. Agendar não libera o handoff: só o treinamento **realizado e registrado** libera.$md$,
   '["Propor horários ao cliente","Convidar o implantador","Agendar a reunião de treinamento"]',
   1, NULL, 'media', 'encerramento', NULL),
  ('treinamento_realizado', 7, 'Reunião de treinamento realizada',
   $md$**Objetivo:** treinar o cliente e registrar.

O implantador participa, o CS faz a ponte. Conclua esta tarefa só depois da reunião, com o registro da presença. Sem ela o handoff não libera. Este produto não tem NPS: a métrica é prazo.$md$,
   '["Realizar o treinamento com o implantador presente","Registrar a presença"]',
   4, NULL, 'alta', 'encerramento', NULL),
  ('handoff', 8, 'Handoff',
   $md$**Objetivo:** encerrar o onboarding.

O handoff do PABX vai para o **CS**. Só libera com o treinamento realizado e registrado.$md$,
   '["Confirmar que o treinamento foi realizado e registrado","Fazer o handoff para o CS"]',
   5, NULL, 'media', 'encerramento', NULL)
 ) AS s(passo, ordem, titulo, playbook, itens, prazo_dias, sla_horas, prioridade, bloco, upg)
 WHERE p.familia = 'PABX' AND p.tipo = 'ONBOARDING'
ON CONFLICT (playbook_id, passo) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PABX / IMPLEMENTATION. 15 dias a partir do T0, tudo no bloco de execucao.
-- ---------------------------------------------------------------------------
INSERT INTO pos_venda_playbook_passos
  (organizacao_id, playbook_id, passo, ordem, titulo, playbook, itens, prazo_dias, sla_horas, prioridade, bloco, itens_condicionais, variante_upgrade)
SELECT p.organizacao_id, p.id, s.passo, s.ordem, s.titulo, s.playbook, s.itens::jsonb, s.prazo_dias, NULL, s.prioridade, 'execucao', '[]'::jsonb, NULL
  FROM pos_venda_playbooks p
 CROSS JOIN (VALUES
  ('portabilidade', 1, 'Portabilidade',
   $md$**Objetivo:** portar as linhas do cliente para o PABX.

**Registre a operadora de cada portabilidade.** É o insumo do KPI de performance por operadora: sem ela se sabe que demorou, não de quem foi.

O prazo da operadora é externo, mas a cobrança é nossa. Se travar, marque espera com motivo **operadora** e escreva o protocolo; impedimento de portabilidade precisa de motivo, responsável e data, e **não altera o T0 em silêncio**.$md$,
   '["Registrar a operadora de cada linha a portar","Abrir o pedido de portabilidade em cada operadora","Registrar o protocolo e a data do pedido","Acompanhar o pedido e registrar impedimento com motivo, responsável e data","Agendar a janela de corte","Confirmar a linha portada"]',
   7, 'urgente'),
  ('licenciamento', 2, 'Licenciamento',
   $md$**Objetivo:** liberar as licenças do PABX conforme os ramais contratados.$md$,
   '["Conferir os ramais contratados","Licenciar os ramais"]', 8, 'media'),
  ('configuracao_pabx', 3, 'Configuração do PABX',
   $md$**Objetivo:** deixar o PABX configurado para a operação do cliente, com as linhas, os ramais e as regras de chamada.

Usar as respostas do formulário do PABX, que vêm completas para esta tela.$md$,
   '["Cadastrar os ramais","Configurar as linhas e as rotas","Configurar as regras de chamada","Testar ligações de entrada e saída"]', 11, 'alta'),
  ('homologacao', 4, 'Homologação com o cliente',
   $md$**Objetivo:** o cliente validar a operação antes de ir ao ar. Pode ser em reunião.$md$,
   '["Marcar a homologação com o cliente","Conduzir a homologação","Registrar o aceite ou os ajustes pedidos"]', 13, 'alta'),
  ('go_live', 5, 'Go-live',
   $md$**Objetivo:** colocar a operação de telefonia no ar.

Ao finalizar, o projeto volta ao onboarding já marcado como concluído, e o CS retoma na marcação do treinamento.$md$,
   '["Confirmar o aceite da homologação","Virar a operação para o PABX","Avisar o CS e o cliente","Registrar a implantação como finalizada"]', 15, 'alta')
 ) AS s(passo, ordem, titulo, playbook, itens, prazo_dias, prioridade)
 WHERE p.familia = 'PABX' AND p.tipo = 'IMPLEMENTATION'
ON CONFLICT (playbook_id, passo) DO NOTHING;

COMMIT;
