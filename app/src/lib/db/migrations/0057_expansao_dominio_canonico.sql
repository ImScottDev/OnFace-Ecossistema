-- Expansão do modelo canônico — domínio (SPEC §38.2, fase 04 do refactor).
--
-- EXPAND puro: só cria. Não altera nem remove nada que já existe, não move dado.
-- O backfill vem nas fases 05 a 15; o cutover de leitura/escrita, na 16 e 17.
-- Enquanto isso o sistema continua rodando no modelo atual, sem saber que estas
-- tabelas existem.
--
-- Toda tabela de tenant nasce com organizacao_id NOT NULL e FK, como exige o
-- SPEC §5. Não se cria mais nenhum tenant id nulável.

BEGIN;

-- ─── Aquisição (SPEC §8) ──────────────────────────────────────────────────────
-- Hoje o estágio de pré-venda vive numa coluna de texto em `leads`, e o pipeline
-- guarda as etapas num JSON. Normalizar é pré-requisito para a aquisição deixar
-- de ser um campo e virar um processo com histórico próprio.

CREATE TABLE IF NOT EXISTS pipeline_etapas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id    uuid NOT NULL REFERENCES organizacoes(id),
  pipeline_id       uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  codigo            text NOT NULL,
  nome              text NOT NULL,
  ordem             integer NOT NULL DEFAULT 0,
  -- Fecha a etapa: OPEN segue no funil, os outros três encerram o processo.
  tipo_fechamento   text NOT NULL DEFAULT 'OPEN',
  ativo             boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_pipeline_etapas_fechamento
    CHECK (tipo_fechamento IN ('OPEN','WON','LOST','DISQUALIFIED')),
  CONSTRAINT uq_pipeline_etapas_codigo UNIQUE (pipeline_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_pipeline_etapas_pipeline ON pipeline_etapas (pipeline_id, ordem);
CREATE INDEX IF NOT EXISTS idx_pipeline_etapas_org ON pipeline_etapas (organizacao_id);

-- Uma pessoa/empresa pode ter várias aquisições ao longo do tempo: a de 2026 que
-- foi desqualificada e a de 2027 que virou oportunidade são processos distintos
-- sobre a mesma identidade. Hoje isso não é representável, porque o estágio mora
-- na própria linha do lead e é sobrescrito.
CREATE TABLE IF NOT EXISTS aquisicoes (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id          uuid NOT NULL REFERENCES organizacoes(id),
  empresa_id              uuid REFERENCES empresas(id) ON DELETE SET NULL,
  pessoa_id               uuid REFERENCES pessoas(id) ON DELETE SET NULL,
  tipo                    text NOT NULL DEFAULT 'INBOUND',
  origem                  text,
  canal                   text,
  source_provider         text,
  pipeline_id             uuid REFERENCES pipelines(id) ON DELETE SET NULL,
  etapa_id                uuid REFERENCES pipeline_etapas(id) ON DELETE SET NULL,
  responsavel_id          uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  qualificado             boolean NOT NULL DEFAULT false,
  qualificado_em          timestamptz,
  desqualificado_em       timestamptz,
  motivo_desqualificacao  text,
  nutricao_status         text,
  retomar_em              timestamptz,
  first_touch_at          timestamptz,
  last_touch_at           timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  closed_at               timestamptz,
  CONSTRAINT ck_aquisicoes_tipo
    CHECK (tipo IN ('INBOUND','OUTBOUND','REFERRAL','IMPORT','MANUAL')),
  -- SPEC §8.1: uma aquisição pode começar só com a pessoa, mas não com nenhuma
  -- das duas pontas. Sem isso volta a existir registro sem identidade.
  CONSTRAINT ck_aquisicoes_tem_identidade
    CHECK (empresa_id IS NOT NULL OR pessoa_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_aquisicoes_org ON aquisicoes (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_aquisicoes_empresa ON aquisicoes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_aquisicoes_pessoa ON aquisicoes (pessoa_id);
CREATE INDEX IF NOT EXISTS idx_aquisicoes_etapa ON aquisicoes (etapa_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aquisicoes_responsavel ON aquisicoes (responsavel_id) WHERE closed_at IS NULL;

-- ─── Oferta comercial (SPEC §12.2) ────────────────────────────────────────────
-- O mesmo produto pode ser vendido de formas com regras diferentes: Callface AI
-- direto no Stripe ganha no pagamento; por contrato, ganha na assinatura. Hoje a
-- política está presa à família do produto em `won_evidence_policies`, e é por
-- isso que a regra documentada e a persistida divergem.
CREATE TABLE IF NOT EXISTS ofertas_comerciais (
  id                                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id                    uuid NOT NULL REFERENCES organizacoes(id),
  servico_catalogo_id               uuid NOT NULL REFERENCES servicos_catalogo(id),
  codigo                            text NOT NULL,
  nome                              text NOT NULL,
  ativo                             boolean NOT NULL DEFAULT true,
  requires_company_before_proposal  boolean NOT NULL DEFAULT true,
  requires_contract                 boolean NOT NULL DEFAULT false,
  win_condition                     text NOT NULL,
  payment_trigger                   text NOT NULL,
  creates_subscription              boolean NOT NULL DEFAULT false,
  billing_model                     text,
  onboarding_required               boolean NOT NULL DEFAULT true,
  implementation_required           boolean NOT NULL DEFAULT false,
  contrato_template_id              uuid REFERENCES contrato_templates(id) ON DELETE SET NULL,
  checkout_provider                 text,
  metadata                          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_ofertas_win_condition
    CHECK (win_condition IN ('PAYMENT_CONFIRMED','CONTRACT_FULLY_SIGNED','MANUAL_APPROVAL')),
  CONSTRAINT ck_ofertas_payment_trigger
    CHECK (payment_trigger IN ('ON_PROPOSAL_ACCEPTED','ON_CONTRACT_SIGNED','ON_WIN','MANUAL')),
  CONSTRAINT uq_ofertas_codigo UNIQUE (organizacao_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_ofertas_catalogo ON ofertas_comerciais (servico_catalogo_id) WHERE ativo;

-- ─── Pagamento (SPEC §21.4) ───────────────────────────────────────────────────
-- Hoje não existe entidade de pagamento: o fato "foi pago" fica espalhado entre
-- fatura, assinatura e evento do Stripe. Sem isso, ganho e pagamento não podem
-- ser fatos separados, que é o que o SPEC §15.2 exige para venda por contrato.
CREATE TABLE IF NOT EXISTS pagamentos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id       uuid NOT NULL REFERENCES organizacoes(id),
  fatura_id            uuid NOT NULL REFERENCES faturas(id) ON DELETE CASCADE,
  empresa_id           uuid NOT NULL REFERENCES empresas(id),
  servico_canonico_id  uuid REFERENCES servicos_canonicos(id) ON DELETE SET NULL,
  provider             text NOT NULL,
  external_payment_id  text,
  payment_method       text,
  amount               numeric(14,2) NOT NULL,
  currency             text NOT NULL DEFAULT 'BRL',
  status               text NOT NULL DEFAULT 'PENDING',
  paid_at              timestamptz,
  failed_at            timestamptz,
  refunded_at          timestamptz,
  -- Chave de idempotência: o webhook do Stripe reentrega, e reentrega não pode
  -- virar segundo pagamento. Única por provedor.
  idempotency_key      text,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_pagamentos_status
    CHECK (status IN ('PENDING','PAID','FAILED','REFUNDED','CANCELLED')),
  CONSTRAINT uq_pagamentos_idempotency UNIQUE (provider, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_pagamentos_fatura ON pagamentos (fatura_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_empresa ON pagamentos (empresa_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pagamentos_externo
  ON pagamentos (provider, external_payment_id) WHERE external_payment_id IS NOT NULL;

-- ─── Conversa (SPEC §22.1) ────────────────────────────────────────────────────
-- Fio de conversa, independente de canal. Hoje WhatsApp, e-mail e ligação vivem
-- em três tabelas sem nada que diga que são a mesma conversa com a mesma pessoa.
CREATE TABLE IF NOT EXISTS conversas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id     uuid NOT NULL REFERENCES organizacoes(id),
  empresa_id         uuid REFERENCES empresas(id) ON DELETE SET NULL,
  pessoa_id          uuid REFERENCES pessoas(id) ON DELETE SET NULL,
  canal              text NOT NULL,
  external_thread_id text,
  responsavel_id     uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'OPEN',
  last_message_at    timestamptz,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversas_empresa ON conversas (empresa_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_pessoa ON conversas (pessoa_id, last_message_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversas_thread
  ON conversas (organizacao_id, canal, external_thread_id) WHERE external_thread_id IS NOT NULL;

-- ─── Eventos (SPEC §24) ───────────────────────────────────────────────────────
-- Log imutável de fato de negócio. Não confundir com audit_log, que registra
-- quem mexeu em qual campo, nem com timeline_events, que é projeção de leitura.
CREATE TABLE IF NOT EXISTS domain_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL REFERENCES organizacoes(id),
  event_type      text NOT NULL,
  aggregate_type  text NOT NULL,
  aggregate_id    uuid NOT NULL,
  -- Quem causou. A IA é ator com nome próprio: o SPEC §3.5 exige poder auditar
  -- o que um agente fez sem confundir com ação humana.
  actor_type      text NOT NULL DEFAULT 'SYSTEM',
  actor_id        uuid,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  correlation_id  uuid,
  causation_id    uuid,
  idempotency_key text,
  source          text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_domain_events_actor
    CHECK (actor_type IN ('USER','AI_AGENT','AUTOMATION','SYSTEM','INTEGRATION')),
  CONSTRAINT uq_domain_events_idempotency UNIQUE (organizacao_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_domain_events_agregado ON domain_events (aggregate_type, aggregate_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_tipo ON domain_events (organizacao_id, event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_events_correlacao ON domain_events (correlation_id) WHERE correlation_id IS NOT NULL;

-- Projeção de leitura para humano. Derivada de domain_events e de comunicação
-- selecionada. Pode ser reconstruída: não guarda verdade que não exista na origem.
CREATE TABLE IF NOT EXISTS timeline_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id      uuid NOT NULL REFERENCES organizacoes(id),
  empresa_id          uuid REFERENCES empresas(id) ON DELETE CASCADE,
  pessoa_id           uuid REFERENCES pessoas(id) ON DELETE CASCADE,
  aquisicao_id        uuid REFERENCES aquisicoes(id) ON DELETE CASCADE,
  oportunidade_id     uuid REFERENCES oportunidades(id) ON DELETE CASCADE,
  servico_canonico_id uuid REFERENCES servicos_canonicos(id) ON DELETE CASCADE,
  domain_event_id     uuid REFERENCES domain_events(id) ON DELETE SET NULL,
  tipo                text NOT NULL,
  titulo              text NOT NULL,
  descricao           text,
  icone               text,
  actor_type          text NOT NULL DEFAULT 'SYSTEM',
  actor_id            uuid,
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_timeline_empresa ON timeline_events (empresa_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_pessoa ON timeline_events (pessoa_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_oportunidade ON timeline_events (oportunidade_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_servico ON timeline_events (servico_canonico_id, occurred_at DESC);

-- ─── Saúde de cliente (SPEC §19.2) ────────────────────────────────────────────
-- Snapshot com versão de cálculo: sem isso, mudar a fórmula reescreve o passado
-- e a série histórica deixa de ser comparável.
CREATE TABLE IF NOT EXISTS cs_health_snapshots (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id       uuid NOT NULL REFERENCES organizacoes(id),
  empresa_id           uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  servico_canonico_id  uuid REFERENCES servicos_canonicos(id) ON DELETE CASCADE,
  score                integer NOT NULL,
  status               text NOT NULL,
  factors              jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation_version  text NOT NULL,
  calculated_at        timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_cs_health_score CHECK (score >= 0 AND score <= 100)
);
CREATE INDEX IF NOT EXISTS idx_cs_health_empresa ON cs_health_snapshots (empresa_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cs_health_servico ON cs_health_snapshots (servico_canonico_id, calculated_at DESC);

COMMIT;
