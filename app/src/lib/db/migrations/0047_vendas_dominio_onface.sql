-- Módulo 01 — Vendas: o domínio que a SpecDrive exige.
--
-- Nada aqui apaga ou reescreve dado. São colunas aditivas, com backfill só
-- onde existe evidência real na base; onde não existe, fica NULL e a tela diz
-- que não sabe, em vez de inventar.
--
-- Referência: specdrive-modulo-01-vendas-final.md e docs/reconstruction/MODULO-01-VENDAS.md

-- ─────────────────────────────────────────────────────────────────────────
-- 1. EMPRESA — dados jurídicos e de endereço estruturados
--
-- Bloco 03 §17: proposta contratual só pode ser enviada com razão social,
-- CNPJ e endereço completo, e esses dados atualizam a EMPRESA, não ficam
-- presos dentro da proposta. `endereco` (texto livre) continua existindo para
-- o que já estava lá; os campos novos são o que contrato e proposta leem.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  -- Domínio é identificador de deduplicação (Bloco 05 §18), por isso é coluna
  -- própria e não derivado de `website` toda vez que alguém precisa comparar.
  ADD COLUMN IF NOT EXISTS dominio text;

-- Backfill do domínio a partir do site já cadastrado. Só o host, minúsculo,
-- sem www — é assim que ele serve para casar duas empresas.
UPDATE empresas
   SET dominio = lower(
         regexp_replace(
           regexp_replace(website, '^https?://', '', 'i'),
           '^www\.', '', 'i'
         )
       )
 WHERE dominio IS NULL
   AND website IS NOT NULL
   AND website <> '';
UPDATE empresas SET dominio = split_part(dominio, '/', 1) WHERE dominio LIKE '%/%';
UPDATE empresas SET dominio = NULL WHERE dominio = '';

CREATE INDEX IF NOT EXISTS idx_empresas_dominio ON empresas (organizacao_id, dominio) WHERE dominio IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_empresas_cnpj ON empresas (organizacao_id, cnpj) WHERE cnpj IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. LEAD — o processo de Pré-vendas
--
-- A etapa canônica passa a ser `estagio_pre_vendas`. `crm2_pre_vendas_stage`
-- continua intacto: é o rastro do De/Para do board legado e serve de auditoria.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS estagio_pre_vendas text,
  -- Bloco 01 §10: "Qualificado" precisa sobreviver ao estágio atual. Um lead
  -- em Oportunidade continua tendo sido qualificado em determinado momento,
  -- e isso não pode depender de uma etapa que já passou nem de uma tag.
  ADD COLUMN IF NOT EXISTS qualificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qualificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS qualificado_por uuid REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS qualificado_por_tipo text,
  -- Bloco 01 §8: qualificação é estruturada, não uma observação de texto.
  -- jsonb porque a spec diz que a organização poderá configurar critérios
  -- mais rígidos depois; coluna fixa por campo travaria isso.
  ADD COLUMN IF NOT EXISTS qualificacao jsonb,
  ADD COLUMN IF NOT EXISTS qualificacao_iniciada_em timestamptz,
  -- Bloco 01 §13: nutrição não pode ser lixeira elegante.
  ADD COLUMN IF NOT EXISTS nutricao_motivo text,
  ADD COLUMN IF NOT EXISTS nutricao_retomar_em date,
  ADD COLUMN IF NOT EXISTS nutricao_observacao text,
  ADD COLUMN IF NOT EXISTS nutrido_em timestamptz,
  ADD COLUMN IF NOT EXISTS nutrido_por uuid REFERENCES usuarios(id),
  -- Bloco 01 §14: desqualificar exige motivo estruturado.
  ADD COLUMN IF NOT EXISTS desqualificacao_motivo text,
  ADD COLUMN IF NOT EXISTS desqualificacao_detalhe text,
  ADD COLUMN IF NOT EXISTS desqualificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS desqualificado_por uuid REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS desqualificado_de_etapa text,
  -- Bloco 04 §11: pré-qualificado é fato do outbound, e NÃO é o Qualificado
  -- de Pré-vendas. Os dois coexistem de propósito.
  ADD COLUMN IF NOT EXISTS pre_qualificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pre_qualificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS pre_qualificado_por uuid REFERENCES usuarios(id);

-- Backfill da etapa canônica a partir do que o board já dizia.
-- `agenda_confirmada` vira `oportunidade`: a quinta etapa da spec é o handoff
-- concluído, e ter agenda era justamente como o board antigo representava isso.
UPDATE leads
   SET estagio_pre_vendas = CASE crm2_pre_vendas_stage
         WHEN 'novo'              THEN 'novo'
         WHEN 'em_contato'        THEN 'em_contato'
         WHEN 'qualificacao'      THEN 'qualificacao'
         WHEN 'qualificado'       THEN 'qualificado'
         WHEN 'agenda_confirmada' THEN 'oportunidade'
         WHEN 'nutricao_retomar'  THEN 'nutricao'
         WHEN 'sem_resposta'      THEN 'nutricao'
         WHEN 'desqualificado'    THEN 'desqualificado'
         ELSE NULL
       END
 WHERE estagio_pre_vendas IS NULL
   AND crm2_pre_vendas_stage IS NOT NULL;

-- Lead que não passou pelo De/Para mas tem tipo 'lead': entra como novo.
UPDATE leads
   SET estagio_pre_vendas = 'novo'
 WHERE estagio_pre_vendas IS NULL
   AND tipo = 'lead';

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_estagio_pre_vendas_check;
ALTER TABLE leads ADD CONSTRAINT leads_estagio_pre_vendas_check
  CHECK (estagio_pre_vendas IS NULL OR estagio_pre_vendas IN
    ('novo','em_contato','qualificacao','qualificado','oportunidade','nutricao','desqualificado'));

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_qualificado_por_tipo_check;
ALTER TABLE leads ADD CONSTRAINT leads_qualificado_por_tipo_check
  CHECK (qualificado_por_tipo IS NULL OR qualificado_por_tipo IN ('HUMAN','AI_AGENT','AUTOMATION'));

-- Backfill do fato "qualificado": quem está em qualificado/oportunidade hoje,
-- ou já foi convertido em negócio, foi qualificado em algum momento. A data
-- usada é a da conversão quando existe; senão fica NULL, porque não há
-- evidência de QUANDO — e data inventada é pior que data ausente.
UPDATE leads
   SET qualificado = true,
       qualificado_em = COALESCE(convertido_at, qualificado_em),
       qualificado_por_tipo = COALESCE(qualificado_por_tipo, 'HUMAN')
 WHERE qualificado = false
   AND (estagio_pre_vendas IN ('qualificado','oportunidade') OR convertido_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_leads_estagio_pre_vendas ON leads (organizacao_id, estagio_pre_vendas);
CREATE INDEX IF NOT EXISTS idx_leads_qualificado ON leads (organizacao_id, qualificado) WHERE qualificado = true;
CREATE INDEX IF NOT EXISTS idx_leads_nutricao_retomar ON leads (organizacao_id, nutricao_retomar_em) WHERE nutricao_retomar_em IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. OPORTUNIDADE (tabela física `negocios`)
--
-- Bloco 02 §1-2: toda oportunidade pertence a uma Empresa e a exatamente uma
-- família. `service_family` já existia como snapshot de classificação do
-- legado; passa a ser também o campo operacional das oportunidades novas.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE negocios
  -- Bloco 02 §9: etapa canônica do Pipeline novo. `status` continua sendo a
  -- coluna que o CRM legado, o financeiro e os relatórios leem — os dois são
  -- mantidos coerentes pelo motor (lib/vendas/pipeline.ts), não por trigger,
  -- porque a tradução depende de contexto (no-show é evento, não etapa).
  ADD COLUMN IF NOT EXISTS etapa text,
  -- Bloco 04 §13: não fingir que a oportunidade passou por Pré-vendas.
  ADD COLUMN IF NOT EXISTS source_process text,
  -- Bloco 02 §13: próxima ação é sinal de estagnação, não enfeite.
  ADD COLUMN IF NOT EXISTS proxima_acao text,
  ADD COLUMN IF NOT EXISTS proxima_acao_em timestamptz,
  ADD COLUMN IF NOT EXISTS proxima_acao_responsavel_id uuid REFERENCES usuarios(id),
  -- Bloco 02 §12: no-show é evento. O contexto fica marcado no card sem virar
  -- coluna e sem criar uma segunda oportunidade.
  ADD COLUMN IF NOT EXISTS no_show_em timestamptz,
  ADD COLUMN IF NOT EXISTS no_show_contagem integer NOT NULL DEFAULT 0,
  -- Bloco 02 §10: trial é estado contextual, não etapa.
  ADD COLUMN IF NOT EXISTS trial_iniciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS trial_encerrado_em timestamptz,
  -- Bloco 02 §17: motivo de perda estruturado, separado do texto livre.
  ADD COLUMN IF NOT EXISTS motivo_perda_chave text,
  -- Momento em que a oportunidade entrou na etapa atual: é daqui que sai
  -- "3d na etapa" no card, sem depender de updated_at (que muda por qualquer
  -- edição e mentiria sobre o tempo de etapa).
  ADD COLUMN IF NOT EXISTS etapa_desde timestamptz;

-- Backfill da etapa canônica. Reunião e trial deixam de ser etapa: quem estava
-- em `trial` está, comercialmente, em Diagnóstico — e o fato do trial fica
-- registrado na coluna própria, não na posição do card.
UPDATE negocios
   SET etapa = CASE status
         WHEN 'reuniao_agendada'      THEN 'entrada'
         WHEN 'reuniao_realizada'     THEN 'diagnostico'
         WHEN 'trial'                 THEN 'diagnostico'
         WHEN 'proposta_apresentada'  THEN 'proposta'
         WHEN 'negociacao_iniciada'   THEN 'negociacao'
         WHEN 'ganho'                 THEN 'ganho'
         WHEN 'perdido'               THEN 'perdido'
         WHEN 'churned'               THEN 'perdido'
         -- No-show não é etapa: o negócio volta a ser o que era antes de a
         -- reunião falhar, que é Entrada.
         WHEN 'no_show'               THEN 'entrada'
         ELSE NULL
       END
 WHERE etapa IS NULL;

UPDATE negocios
   SET trial_iniciado_em = COALESCE(trial_iniciado_em, updated_at)
 WHERE status = 'trial' AND trial_iniciado_em IS NULL;

UPDATE negocios
   SET no_show_em = COALESCE(no_show_em, updated_at),
       no_show_contagem = GREATEST(no_show_contagem, 1)
 WHERE status = 'no_show' AND no_show_em IS NULL;

UPDATE negocios SET etapa_desde = COALESCE(etapa_desde, updated_at, created_at) WHERE etapa_desde IS NULL;

-- Processo de origem: só onde existe evidência. Negócio com lead vinculado
-- veio de Pré-vendas; o resto fica NULL em vez de virar palpite.
UPDATE negocios
   SET source_process = CASE
         WHEN lead_id IS NOT NULL THEN 'PRE_SALES'
         WHEN origem_negocio = 'carteira' THEN 'EXPANSION'
         ELSE NULL
       END
 WHERE source_process IS NULL;

UPDATE negocios SET motivo_perda_chave = motivo_perda
 WHERE motivo_perda_chave IS NULL AND motivo_perda IS NOT NULL;

ALTER TABLE negocios DROP CONSTRAINT IF EXISTS negocios_etapa_check;
ALTER TABLE negocios ADD CONSTRAINT negocios_etapa_check
  CHECK (etapa IS NULL OR etapa IN ('entrada','diagnostico','proposta','negociacao','ganho','perdido'));

ALTER TABLE negocios DROP CONSTRAINT IF EXISTS negocios_source_process_check;
ALTER TABLE negocios ADD CONSTRAINT negocios_source_process_check
  CHECK (source_process IS NULL OR source_process IN ('PRE_SALES','OUTBOUND_DIRECT','MANUAL','EXPANSION'));

CREATE INDEX IF NOT EXISTS idx_negocios_etapa ON negocios (organizacao_id, etapa);
CREATE INDEX IF NOT EXISTS idx_negocios_family ON negocios (organizacao_id, service_family);
CREATE INDEX IF NOT EXISTS idx_negocios_proxima_acao ON negocios (organizacao_id, proxima_acao_em) WHERE proxima_acao_em IS NOT NULL;

-- Espelho no domain model v2 (dual-write). `oportunidades` ganha os mesmos
-- fatos para que a leitura nova não precise atravessar para `negocios`.
ALTER TABLE oportunidades
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS service_family text,
  ADD COLUMN IF NOT EXISTS etapa text,
  ADD COLUMN IF NOT EXISTS commercial_motion text,
  ADD COLUMN IF NOT EXISTS source_process text,
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. PROPOSTA
--
-- Bloco 03 §7-8: o modo de fechamento é escolhido ANTES do envio, porque muda
-- regra, dado obrigatório e gate de Won. `proximo_passo` continua existindo e
-- é derivado dos itens no envio; `modo_fechamento` é a escolha explícita.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE propostas
  ADD COLUMN IF NOT EXISTS modo_fechamento text,
  ADD COLUMN IF NOT EXISTS validade_dias integer,
  -- Bloco 03 §12: o pedido de ajuste do cliente não altera a proposta; ele
  -- fica registrado e o comercial cria uma versão nova.
  ADD COLUMN IF NOT EXISTS ajuste_solicitado_em timestamptz,
  ADD COLUMN IF NOT EXISTS ajuste_solicitado_descricao text,
  ADD COLUMN IF NOT EXISTS substituida_em timestamptz,
  ADD COLUMN IF NOT EXISTS substituida_por_id uuid REFERENCES propostas(id),
  ADD COLUMN IF NOT EXISTS aceita_em timestamptz,
  ADD COLUMN IF NOT EXISTS recusada_em timestamptz,
  ADD COLUMN IF NOT EXISTS expirada_em timestamptz,
  -- Bloco 03 §21: cliente existente pode estar comprando aditivo/upgrade, e o
  -- vínculo com o contrato base não pode se perder.
  ADD COLUMN IF NOT EXISTS tipo_contratual text,
  ADD COLUMN IF NOT EXISTS contrato_base_id uuid REFERENCES contratos(id),
  ADD COLUMN IF NOT EXISTS service_family text;

UPDATE propostas SET modo_fechamento = CASE proximo_passo
         WHEN 'pagamento' THEN 'PREPAID'
         WHEN 'contrato'  THEN 'CONTRACT'
         ELSE NULL END
 WHERE modo_fechamento IS NULL AND proximo_passo IS NOT NULL;

UPDATE propostas
   SET validade_dias = GREATEST(1, (data_validade - data_emissao))
 WHERE validade_dias IS NULL AND data_validade IS NOT NULL AND data_emissao IS NOT NULL;

ALTER TABLE propostas DROP CONSTRAINT IF EXISTS propostas_modo_fechamento_check;
ALTER TABLE propostas ADD CONSTRAINT propostas_modo_fechamento_check
  CHECK (modo_fechamento IS NULL OR modo_fechamento IN ('PREPAID','CONTRACT'));

ALTER TABLE propostas DROP CONSTRAINT IF EXISTS propostas_tipo_contratual_check;
ALTER TABLE propostas ADD CONSTRAINT propostas_tipo_contratual_check
  CHECK (tipo_contratual IS NULL OR tipo_contratual IN ('NOVO_CONTRATO','ADITIVO','UPGRADE','DOWNGRADE'));

CREATE INDEX IF NOT EXISTS idx_propostas_negocio ON propostas (negocio_id) WHERE negocio_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. PROSPECÇÃO
--
-- Bloco 04 §24: hoje o estado do prospect é derivado de sinais, e a existência
-- de uma oportunidade faz o prospect ser lido como qualificado. Passa a existir
-- estado próprio, com as duas saídas separadas (pré-qualificado ≠ oportunidade
-- direta).
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS prospeccao_estado text,
  ADD COLUMN IF NOT EXISTS prospeccao_descarte_motivo text,
  ADD COLUMN IF NOT EXISTS prospeccao_descartado_em timestamptz,
  ADD COLUMN IF NOT EXISTS prospeccao_descartado_por uuid REFERENCES usuarios(id);

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_prospeccao_estado_check;
ALTER TABLE leads ADD CONSTRAINT leads_prospeccao_estado_check
  CHECK (prospeccao_estado IS NULL OR prospeccao_estado IN
    ('novo','em_cadencia','respondeu','pre_qualificado','oportunidade','sem_resposta','descartado'));

CREATE INDEX IF NOT EXISTS idx_leads_prospeccao_estado ON leads (organizacao_id, prospeccao_estado)
  WHERE prospeccao_estado IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. EVENTOS DE VENDAS
--
-- Bloco 01 §17 e Bloco 02 §27: todo evento relevante precisa de entidade,
-- timestamp, executor e contexto. O repositório já tem `status_changes`,
-- `atividades`, `audit_log` e `event_outbox`, e a spec manda reaproveitar em
-- vez de criar cinco sistemas paralelos. O que faltava era um lugar único para
-- LER a linha do tempo comercial sem juntar quatro tabelas em toda consulta.
--
-- Esta tabela é de leitura: quem escreve é `lib/vendas/eventos.ts`, na mesma
-- transação do comando de negócio que a originou.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendas_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  tipo text NOT NULL,
  -- A entidade central do evento. Pelo menos uma precisa estar preenchida.
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  negocio_id uuid REFERENCES negocios(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE,
  pessoa_id uuid REFERENCES pessoas(id) ON DELETE CASCADE,
  proposta_id uuid REFERENCES propostas(id) ON DELETE CASCADE,
  reuniao_id uuid REFERENCES reunioes(id) ON DELETE SET NULL,
  -- Quem executou. `ator_tipo` é o que separa humano de agente sem criar dois
  -- fluxos: o motor é o mesmo, muda só quem chamou (Bloco 01 §19).
  usuario_id uuid REFERENCES usuarios(id),
  ator_tipo text NOT NULL DEFAULT 'HUMAN',
  ator_ref text,
  contexto jsonb,
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendas_eventos_ator_tipo_check CHECK (ator_tipo IN ('HUMAN','AI_AGENT','AUTOMATION','SYSTEM')),
  CONSTRAINT vendas_eventos_entidade_check CHECK (
    lead_id IS NOT NULL OR negocio_id IS NOT NULL OR empresa_id IS NOT NULL
    OR pessoa_id IS NOT NULL OR proposta_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_vendas_eventos_org_tipo ON vendas_eventos (organizacao_id, tipo);
CREATE INDEX IF NOT EXISTS idx_vendas_eventos_lead ON vendas_eventos (lead_id, ocorrido_em DESC) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendas_eventos_negocio ON vendas_eventos (negocio_id, ocorrido_em DESC) WHERE negocio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendas_eventos_empresa ON vendas_eventos (empresa_id, ocorrido_em DESC) WHERE empresa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendas_eventos_proposta ON vendas_eventos (proposta_id, ocorrido_em DESC) WHERE proposta_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. VÍNCULO PESSOA ↔ EMPRESA
--
-- Bloco 05 §11-12: o vínculo tem papel, principal e histórico, e a Pessoa pode
-- mudar de Empresa sem que o passado seja apagado. `pessoas.empresa_id`
-- continua sendo o vínculo atual (é o que as consultas existentes leem); esta
-- tabela é o que permite papel e histórico.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pessoa_empresa_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  pessoa_id uuid NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  papel text NOT NULL DEFAULT 'contato_principal',
  principal boolean NOT NULL DEFAULT false,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  encerrado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pessoa_empresa_vinculos_papel_check CHECK (papel IN
    ('contato_principal','decisor','influenciador','financeiro','tecnico','usuario','outro'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pessoa_empresa_vinculo_ativo
  ON pessoa_empresa_vinculos (pessoa_id, empresa_id) WHERE encerrado_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_pessoa_empresa_vinculo_empresa ON pessoa_empresa_vinculos (empresa_id);

-- Backfill: todo vínculo atual vira um vínculo aberto de contato principal.
INSERT INTO pessoa_empresa_vinculos (organizacao_id, pessoa_id, empresa_id, papel, principal, iniciado_em)
SELECT p.organizacao_id, p.id, p.empresa_id, 'contato_principal', true, p.created_at
  FROM pessoas p
 WHERE p.empresa_id IS NOT NULL
ON CONFLICT DO NOTHING;
