-- CARGA DA VIRADA · passo 04 — roda DEPOIS de `db:migrar --ate=0012` e ANTES
-- do resto da cadeia.
--
-- Por que existe, e por que aqui: estes objetos existem no banco de dev e em
-- `schema.ts`, e o código do produto os usa, mas nenhuma migration os cria —
-- foram parar no banco via `drizzle-kit push` / psql à mão. Achado no ensaio de
-- carga de 18/09 (`scripts/ensaio-carga.sh`).
--
-- Duas delas (`clientes.responsavel_id` e
-- `won_evidence_policies.required_combinations`) são LIDAS por 0033 e 0039, e
-- as tabelas nascem em 0012. Ou seja: o patch tem que entrar entre 0012 e 0033.
-- Não dá para virar migration `0012a`: `migrar.test.ts` exige que o número de 4
-- dígitos seja único, justamente para a ordem não ficar ambígua entre
-- ambientes. Daí o corte com `--ate=0012`.
--
-- Os ÍNDICES desse mesmo drift estão em `migrations/0049`, que roda no fim —
-- índice não tem dependência de ordem com nada que venha depois.
--
-- Idempotente. Em dev é no-op inteiro.

-- ── colunas ──────────────────────────────────────────────────────────────────
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES usuarios(id);

ALTER TABLE won_evidence_policies
  ADD COLUMN IF NOT EXISTS required_combinations jsonb;

ALTER TABLE ai_sdr_contato_state
  ADD COLUMN IF NOT EXISTS handoff_status text NOT NULL DEFAULT 'ai_handling';

ALTER TABLE closer_bloqueios
  ADD COLUMN IF NOT EXISTS outlook_event_id text;

ALTER TABLE correction_change_log
  ADD COLUMN IF NOT EXISTS confidence text,
  ADD COLUMN IF NOT EXISTS evidence   jsonb,
  ADD COLUMN IF NOT EXISTS source     text;

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];

ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS commercial_motion text NOT NULL DEFAULT 'NEW_BUSINESS';

ALTER TABLE notas
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes(id)  ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reuniao_id uuid REFERENCES reunioes(id)  ON DELETE CASCADE;

-- Flags de comportamento comercial do catálogo. O default é o comportamento
-- conservador — o que o produto já fazia antes de a flag existir: item de
-- catálogo vira serviço canônico, não gera fulfillment, não exige assinatura
-- nem pagamento antes do ganho, e não suporta upgrade/downgrade/proration.
ALTER TABLE servicos_catalogo
  ADD COLUMN IF NOT EXISTS creates_canonical_service   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS creates_fulfillment         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantity_behavior           text    NOT NULL DEFAULT 'UNIT',
  ADD COLUMN IF NOT EXISTS requires_payment_before_won boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_signature          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revenue_nature              text    NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS supports_downgrade          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_proration          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_upgrade            boolean NOT NULL DEFAULT false;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);

-- ── tabelas da integração Callface AI ────────────────────────────────────────
-- DDL copiada do banco de dev (pg_dump --schema-only), que é o que `schema.ts`
-- declara hoje.
CREATE TABLE IF NOT EXISTS callface_ai_external_identities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  provider    text NOT NULL DEFAULT 'callface_ai',
  external_type text NOT NULL,
  external_id text NOT NULL,
  confidence  text NOT NULL,
  source      text,
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS callface_ai_reconciliation_candidates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  external_organization_id text NOT NULL,
  match_signal text NOT NULL,
  score      numeric(5,4),
  status     text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS callface_ai_tenant_snapshots (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_identity_id uuid NOT NULL REFERENCES callface_ai_external_identities(id) ON DELETE CASCADE,
  snapshot_at          timestamptz NOT NULL,
  usuarios_total       integer,
  usuarios_ativos      integer,
  usuarios_pendentes   integer,
  licencas_ativas      integer,
  workspaces_ativos    integer,
  campanhas_ativas     integer,
  campanhas_concluidas integer,
  chamadas_total       integer,
  chamadas_finalizadas integer,
  minutos_uso          numeric(14,2),
  agentes_prontos      integer,
  integracao_whatsapp_conectada boolean,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS callface_ai_usage_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_identity_id uuid NOT NULL REFERENCES callface_ai_external_identities(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_callface_ai_ext_ident_entity ON callface_ai_external_identities (entity_type, entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_callface_ai_ext_ident_unique ON callface_ai_external_identities (provider, external_type, external_id);
CREATE INDEX IF NOT EXISTS idx_callface_ai_recon_empresa ON callface_ai_reconciliation_candidates (empresa_id);
CREATE INDEX IF NOT EXISTS idx_callface_ai_recon_status ON callface_ai_reconciliation_candidates (status);
CREATE INDEX IF NOT EXISTS idx_callface_ai_snapshots_identity ON callface_ai_tenant_snapshots (external_identity_id, snapshot_at);
CREATE INDEX IF NOT EXISTS idx_callface_ai_usage_events_identity ON callface_ai_usage_events (external_identity_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_callface_ai_usage_events_type ON callface_ai_usage_events (event_type);
