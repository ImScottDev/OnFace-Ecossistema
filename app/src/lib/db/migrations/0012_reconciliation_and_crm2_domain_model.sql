-- Formalizacao do estado consolidado PROD (reconciliacao v1.1 + recuperacao legado Zoho)
-- + Domain Model CRM2 (pessoas/oportunidades/clientes/pontos_contato/etc) validado via
-- backfill dry-run + write real no banco local de dev em 2026-08-16.
-- Ver ADR-EXEC-019 (oportunidade -> N oportunidade_itens) em ARCHITECTURE_DECISIONS.md.
-- eventos_comerciais/fatura_itens NAO sao criadas pela 0012 original (ficam pro bloco CRM2
-- abaixo, que ja cria as duas com FK correta pra servicos_canonicos).

-- Projeção semântica da oportunidade, separada de serviço atual, lifecycle e billing.
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS service_family text;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS revenue_nature text;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS semantic_confidence text;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS semantic_evidence jsonb;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS semantic_provenance text;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS semantic_as_of_date date;

-- Callface reconciliation v1.1: prerequisite structure for PROD that already
-- exists in HOMOLOG via direct db:push (never versioned before). Scoped ONLY
-- to what the v1.1 canonical portfolio apply needs — not the CS module, not
-- the legacy Zoho correction v1.0 audit trail (anexos_legado, correction_runs,
-- portfolio_snapshots, catalogo_mapeamentos_legacy, billing_identities), which
-- stay HOMOLOG-only.

CREATE TABLE IF NOT EXISTS servico_billing_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  empresa_id uuid REFERENCES empresas(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES contratos(id) ON DELETE SET NULL,
  assinatura_id uuid REFERENCES assinaturas(id) ON DELETE SET NULL,
  provider text NOT NULL,
  external_id text NOT NULL,
  service_family text NOT NULL,
  revenue_nature text NOT NULL,
  billing_status text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  effective_at timestamptz,
  is_current boolean NOT NULL DEFAULT false,
  confidence text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  servico_id uuid,
  UNIQUE (organizacao_id, provider, external_id)
);

ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS revenue_nature text;
ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS billing_status text;
ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS commercial_lifecycle text;
ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS semantic_confidence text;
ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS semantic_evidence jsonb;

CREATE INDEX IF NOT EXISTS idx_servico_billing_timeline_servico_id ON servico_billing_timeline (servico_id);

-- FK servico_billing_timeline -> servicos_canonicos: 0012 já adiciona essa
-- constraint (idempotente) depois de criar servicos_canonicos, não repete aqui.


-- Callface reconciliation v1.1: historical monthly ledger + canonical current portfolio.
-- Versioned for HOMOLOG first. No data rows are embedded in this migration.

CREATE TABLE IF NOT EXISTS servicos_canonicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  empresa_id uuid REFERENCES empresas(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES contratos(id) ON DELETE SET NULL,
  canonical_key text NOT NULL,
  service_family text NOT NULL,
  canonical_product text,
  revenue_nature text NOT NULL,
  billing_source text NOT NULL,
  commercial_lifecycle text NOT NULL,
  billing_status text NOT NULL,
  current_recurring_value numeric(14,2) NOT NULL DEFAULT 0,
  current_subscription_id text,
  as_of_date date,
  portfolio_included boolean NOT NULL DEFAULT false,
  confidence text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, canonical_key),
  CHECK (service_family IN ('PABX','CALLFACE_AI','WHITE_LABEL','UNKNOWN')),
  CHECK (revenue_nature IN ('MRR','SETUP','PROJECT','ONE_TIME','USAGE','HARDWARE','UNKNOWN')),
  CHECK (current_recurring_value >= 0),
  CHECK (confidence IN ('CONFIRMED','PROBABLE','AMBIGUOUS','UNRESOLVED')),
  CHECK (revenue_nature = 'MRR' OR current_recurring_value = 0)
);

DO $$ BEGIN
  ALTER TABLE servicos_canonicos ADD CONSTRAINT ck_servicos_canonicos_family
    CHECK (service_family IN ('PABX','CALLFACE_AI','WHITE_LABEL','UNKNOWN'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE servicos_canonicos ADD CONSTRAINT ck_servicos_canonicos_nature
    CHECK (revenue_nature IN ('MRR','SETUP','PROJECT','ONE_TIME','USAGE','HARDWARE','UNKNOWN'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE servicos_canonicos ADD CONSTRAINT ck_servicos_canonicos_nonnegative
    CHECK (current_recurring_value >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE servicos_canonicos ADD CONSTRAINT ck_servicos_canonicos_confidence
    CHECK (confidence IN ('CONFIRMED','PROBABLE','AMBIGUOUS','UNRESOLVED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE servicos_canonicos ADD CONSTRAINT ck_servicos_canonicos_non_mrr_zero
    CHECK (revenue_nature = 'MRR' OR current_recurring_value = 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_servicos_canonicos_portfolio
  ON servicos_canonicos (organizacao_id, portfolio_included, service_family);

CREATE TABLE IF NOT EXISTS service_ledger_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  competence date NOT NULL,
  version text NOT NULL,
  source_file text NOT NULL,
  source_sha256 text NOT NULL,
  expected_total numeric(14,2) NOT NULL,
  imported_total numeric(14,2) NOT NULL,
  row_count integer NOT NULL,
  status text NOT NULL CHECK (status IN ('OPEN','CLOSED','SUPERSEDED')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  UNIQUE (organizacao_id, competence, version),
  CHECK (expected_total >= 0 AND imported_total >= 0),
  CHECK (status <> 'CLOSED' OR expected_total = imported_total)
);

CREATE TABLE IF NOT EXISTS service_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES service_ledger_batches(id),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  source_row_hash text NOT NULL,
  source_row_number integer NOT NULL,
  document text,
  company_name text NOT NULL,
  billed_value numeric(14,2) NOT NULL,
  service_family text NOT NULL,
  revenue_nature text NOT NULL,
  service_id uuid REFERENCES servicos_canonicos(id) ON DELETE SET NULL,
  confidence text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, source_row_hash),
  CHECK (billed_value >= 0),
  CHECK (service_family IN ('PABX','CALLFACE_AI','WHITE_LABEL','UNKNOWN')),
  CHECK (revenue_nature IN ('MRR','SETUP','PROJECT','ONE_TIME','USAGE','HARDWARE','UNKNOWN')),
  CHECK (confidence IN ('CONFIRMED','PROBABLE','AMBIGUOUS','UNRESOLVED'))
);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  package_version text NOT NULL,
  package_sha256 text NOT NULL,
  environment text NOT NULL CHECK (environment = 'HOMOLOG'),
  status text NOT NULL CHECK (status IN ('RUNNING','COMPLETED','FAILED')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  writes_inserted integer NOT NULL DEFAULT 0,
  writes_updated integer NOT NULL DEFAULT 0,
  writes_deactivated integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (organizacao_id, package_version, package_sha256)
);

CREATE TABLE IF NOT EXISTS reconciliation_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES reconciliation_runs(id),
  action_id text NOT NULL,
  table_name text NOT NULL,
  record_key text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DEACTIVATE')),
  before_state jsonb,
  after_state jsonb NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, action_id, table_name, record_key)
);

ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS servico_id uuid;
ALTER TABLE servico_billing_timeline ADD COLUMN IF NOT EXISTS servico_id uuid;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS canonical_empresa_id uuid;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS identity_confidence text;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS identity_evidence jsonb;

DO $$ BEGIN
  ALTER TABLE assinaturas ADD CONSTRAINT assinaturas_servico_id_fkey
    FOREIGN KEY (servico_id) REFERENCES servicos_canonicos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE empresas ADD CONSTRAINT empresas_canonical_empresa_id_fkey
    FOREIGN KEY (canonical_empresa_id) REFERENCES empresas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE servico_billing_timeline ADD CONSTRAINT servico_billing_timeline_servico_id_fkey
    FOREIGN KEY (servico_id) REFERENCES servicos_canonicos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_assinaturas_org_stripe_subscription
  ON assinaturas (organizacao_id, stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_servico_id ON assinaturas (servico_id);
CREATE INDEX IF NOT EXISTS idx_servico_billing_timeline_servico_id ON servico_billing_timeline (servico_id);
CREATE INDEX IF NOT EXISTS idx_empresas_canonical_empresa_id ON empresas (canonical_empresa_id);
CREATE INDEX IF NOT EXISTS idx_service_ledger_entries_service_id ON service_ledger_entries (service_id);

CREATE OR REPLACE FUNCTION prevent_closed_service_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM service_ledger_batches b WHERE b.id = OLD.batch_id AND b.status = 'CLOSED') THEN
    RAISE EXCEPTION 'closed service ledger entries are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_closed_service_ledger_entries_immutable ON service_ledger_entries;
CREATE TRIGGER trg_closed_service_ledger_entries_immutable
BEFORE UPDATE OR DELETE ON service_ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_closed_service_ledger_mutation();

CREATE OR REPLACE VIEW current_service_portfolio AS
SELECT
  organizacao_id,
  service_family,
  billing_source,
  billing_status,
  confidence,
  count(*) AS service_count,
  sum(current_recurring_value) AS current_mrr,
  max(as_of_date) AS as_of_date
FROM servicos_canonicos
WHERE portfolio_included = true
  AND revenue_nature = 'MRR'
  AND commercial_lifecycle = 'ACTIVE'
GROUP BY organizacao_id, service_family, billing_source, billing_status, confidence;


-- Tudo daqui pra baixo depende de reconciliation_runs (criada pela 0012).
-- Marcador de ordem: aplicar depois da 0012, não antes.
-- reconciliation_runs.environment veio travado em 'HOMOLOG' na 0012; abre pra PROD
-- sem enfraquecer a garantia (segue sendo só esses dois valores possíveis).
DO $$ BEGIN
  ALTER TABLE reconciliation_runs DROP CONSTRAINT reconciliation_runs_environment_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;
ALTER TABLE reconciliation_runs ADD CONSTRAINT reconciliation_runs_environment_check
  CHECK (environment IN ('HOMOLOG', 'PROD'));

-- Callface consolidação PROD<-HOMOLOG: estrutura de recuperação Zoho/legado
-- e eventos comerciais que só existia em HOMOLOG (db:push direto, nunca
-- versionada). Escopo: só o que tem dado válido pra promover (recuperação +
-- reconciliação + carteira canônica). Fora: módulo CS (contas_cs/marcos_cs/
-- onboarding_checklist, 0 linhas, revertido) e CRM2.0 (branch separada).

-- ─── Tabelas novas ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS anexos_legado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  entidade_tipo text NOT NULL,
  entidade_id uuid,
  categoria text NOT NULL DEFAULT 'anexo_generico',
  zoho_id text,
  nome_arquivo text NOT NULL,
  tamanho_bytes bigint,
  criado_em_original timestamptz,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  checksum_sha256 text
);
CREATE INDEX IF NOT EXISTS idx_anexos_legado_entidade ON anexos_legado (entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_anexos_legado_org ON anexos_legado (organizacao_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_anexos_legado_zoho_dedup ON anexos_legado (organizacao_id, zoho_id) WHERE (zoho_id IS NOT NULL);

CREATE TABLE IF NOT EXISTS billing_identities (
  id uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  canonical_empresa_id uuid REFERENCES empresas(id) ON DELETE SET NULL,
  canonical_lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  provider text NOT NULL,
  external_customer_id text NOT NULL,
  emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  phones jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, provider, external_customer_id, canonical_lead_id)
);

CREATE TABLE IF NOT EXISTS catalogo_mapeamentos_legacy (
  id uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  legacy_product_id text NOT NULL,
  legacy_name text NOT NULL,
  canonical_product_id uuid REFERENCES servicos_catalogo(id) ON DELETE SET NULL,
  canonical_name text,
  service_family text NOT NULL,
  default_revenue_nature text NOT NULL,
  active_selectable boolean NOT NULL DEFAULT false,
  historical_only boolean NOT NULL DEFAULT true,
  confidence text NOT NULL,
  evidence text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, legacy_product_id)
);

CREATE TABLE IF NOT EXISTS contrato_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid REFERENCES contratos(id) ON DELETE CASCADE,
  servico_catalogo_id uuid REFERENCES servicos_catalogo(id),
  nome text NOT NULL,
  descricao text,
  quantidade numeric(10,2) NOT NULL DEFAULT 1,
  valor_unitario numeric(12,2) NOT NULL DEFAULT 0,
  desconto numeric(5,2) DEFAULT 0,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  zoho_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  service_family text,
  revenue_nature text,
  recurring_value numeric(14,2),
  non_recurring_value numeric(14,2),
  billing_source text,
  semantic_confidence text,
  semantic_evidence jsonb,
  provenance text
);
CREATE INDEX IF NOT EXISTS idx_contrato_itens_contrato ON contrato_itens (contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_itens_servico ON contrato_itens (servico_catalogo_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contrato_itens_zoho_dedup ON contrato_itens (zoho_id) WHERE (zoho_id IS NOT NULL);

CREATE TABLE IF NOT EXISTS eventos_comerciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  negocio_id uuid REFERENCES negocios(id),
  negocio_origem_id uuid,
  contrato_id uuid REFERENCES contratos(id),
  tipo text NOT NULL,
  zoho_id text,
  confianca text NOT NULL DEFAULT 'confirmado',
  evidencia jsonb,
  responsavel_id uuid REFERENCES usuarios(id),
  ocorrido_em timestamptz NOT NULL,
  origem text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  servico_id uuid REFERENCES servicos_canonicos(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_eventos_comerciais_contrato ON eventos_comerciais (contrato_id);
CREATE INDEX IF NOT EXISTS idx_eventos_comerciais_negocio ON eventos_comerciais (negocio_id);
CREATE INDEX IF NOT EXISTS idx_eventos_comerciais_negocio_origem ON eventos_comerciais (negocio_origem_id);
CREATE INDEX IF NOT EXISTS idx_eventos_comerciais_org ON eventos_comerciais (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_eventos_comerciais_servico_id ON eventos_comerciais (servico_id);
CREATE INDEX IF NOT EXISTS idx_eventos_comerciais_tipo ON eventos_comerciais (tipo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_comerciais_zoho_dedup ON eventos_comerciais (organizacao_id, zoho_id) WHERE (zoho_id IS NOT NULL);

CREATE TABLE IF NOT EXISTS fatura_itens (
  id uuid PRIMARY KEY,
  fatura_id uuid NOT NULL REFERENCES faturas(id) ON DELETE CASCADE,
  servico_catalogo_id uuid REFERENCES servicos_catalogo(id) ON DELETE SET NULL,
  nome text NOT NULL,
  descricao text,
  quantidade numeric(14,2) NOT NULL DEFAULT 1,
  valor_unitario numeric(14,2) NOT NULL DEFAULT 0,
  desconto numeric(14,2) NOT NULL DEFAULT 0,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  moeda text NOT NULL DEFAULT 'BRL',
  zoho_id text,
  provenance text,
  created_at timestamptz NOT NULL DEFAULT now(),
  servico_id uuid REFERENCES servicos_canonicos(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_fatura_itens_servico_id ON fatura_itens (servico_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fatura_itens_zoho_id ON fatura_itens (zoho_id) WHERE (zoho_id IS NOT NULL);

CREATE TABLE IF NOT EXISTS legacy_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  entidade_tipo text NOT NULL,
  entidade_id uuid NOT NULL,
  zoho_id text NOT NULL,
  confianca text NOT NULL DEFAULT 'confirmado',
  evidencia jsonb,
  recovered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, entidade_tipo, zoho_id)
);
CREATE INDEX IF NOT EXISTS idx_legacy_provenance_entidade ON legacy_provenance (entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_legacy_provenance_org ON legacy_provenance (organizacao_id);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id uuid PRIMARY KEY,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  snapshot_date date NOT NULL,
  component text NOT NULL,
  value numeric(14,2) NOT NULL,
  as_of_date date,
  confidence text NOT NULL,
  evidence text,
  current_exact boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, snapshot_date, component)
);

-- Auditoria da correção v1.0 (evidência de proveniência, trazida junto pra
-- não perder o rastro de "por que" cada campo foi alterado).
CREATE TABLE IF NOT EXISTS correction_runs (
  id uuid PRIMARY KEY,
  ledger_sha256 text NOT NULL,
  mode text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  change_count integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS correction_change_log (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES correction_runs(id),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Colunas novas em tabelas ja existentes nos dois ambientes ─────────

ALTER TABLE contratos ADD COLUMN IF NOT EXISTS assinatura_legado_zoho jsonb;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS codigo_legado text;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS commercial_lifecycle text;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS current_recurring_value numeric(14,2);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS multa_percentual numeric(5,2);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS prazo_meses integer;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS semantic_confidence text;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS semantic_evidence jsonb;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS service_family text;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS canonical_lead_id uuid;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS identity_confidence text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS identity_evidence jsonb;

ALTER TABLE notas ADD COLUMN IF NOT EXISTS autor_display_name text;
ALTER TABLE notas ADD COLUMN IF NOT EXISTS autor_source_id text;
ALTER TABLE notas ADD COLUMN IF NOT EXISTS conteudo_raw text;

ALTER TABLE atividades ADD COLUMN IF NOT EXISTS descricao_raw text;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS superseded_by_note_id uuid;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS timeline_visible boolean NOT NULL DEFAULT true;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS usuario_display_name text;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS usuario_source_id text;

ALTER TABLE faturas ADD COLUMN IF NOT EXISTS receivable_state text;
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS semantic_confidence text;
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS semantic_evidence jsonb;

ALTER TABLE status_changes ADD COLUMN IF NOT EXISTS confianca text NOT NULL DEFAULT 'confirmado';
ALTER TABLE status_changes ADD COLUMN IF NOT EXISTS evidencia jsonb;
ALTER TABLE status_changes ADD COLUMN IF NOT EXISTS zoho_id text;

ALTER TABLE mrr_movimentos ADD COLUMN IF NOT EXISTS evento_comercial_id uuid;

ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS billing_source text;
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS non_recurring_value numeric(14,2);
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS provenance text;
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS recurring_value numeric(14,2);
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS revenue_nature text;
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS semantic_confidence text;
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS semantic_evidence jsonb;
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS service_family text;
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS zoho_id text;

-- ═══ Domain Model CRM2 (tabelas novas) ═══
-- FASE A — Schema CRM2 (aditivo, tabelas que só existem em dev/schema.ts)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  empresa_id uuid REFERENCES empresas(id),
  nome text NOT NULL,
  sobrenome text,
  email text,
  telefone text,
  whatsapp text,
  cargo text,
  lead_id_legado uuid REFERENCES leads(id),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pessoas_org ON pessoas (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_empresa ON pessoas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_email ON pessoas (email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pessoas_lead_legado ON pessoas (lead_id_legado);

CREATE TABLE IF NOT EXISTS pontos_contato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  pessoa_id uuid REFERENCES pessoas(id),
  empresa_id uuid REFERENCES empresas(id),
  source text,
  medium text,
  campaign text,
  term text,
  content text,
  landing_page text,
  referrer text,
  campaign_id text,
  source_id text,
  tipo_origem text NOT NULL,
  is_first_touch boolean NOT NULL DEFAULT false,
  is_last_touch boolean NOT NULL DEFAULT false,
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- lead_id_legado: coluna nova (dev/schema.ts original nao tinha). ALTER
-- explicito porque a tabela pode ja existir sem ela (pontosContato ja fazia
-- parte do Domain Model CRM2 antes desta formalizacao).
ALTER TABLE pontos_contato ADD COLUMN IF NOT EXISTS lead_id_legado uuid REFERENCES leads(id);
CREATE INDEX IF NOT EXISTS idx_pontos_contato_org ON pontos_contato (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_pontos_contato_pessoa ON pontos_contato (pessoa_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pontos_contato_lead_legado ON pontos_contato (lead_id_legado) WHERE lead_id_legado IS NOT NULL;

-- service_family/revenue_nature NAO entram aqui (correcao arquitetural): uma
-- oportunidade e' o container comercial, pode conter multiplos produtos/
-- naturezas simultaneos (AI MRR + PABX SETUP + WL MRR, por ex). Classificacao
-- do negocio LEGADO continua acessivel via negocio_id_legado -> negocios
-- (tabela legada, ja tem service_family/revenue_nature, intocada) — sem
-- duplicar/contaminar o Domain Model novo.
CREATE TABLE IF NOT EXISTS oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  pessoa_id uuid REFERENCES pessoas(id),
  empresa_id uuid REFERENCES empresas(id),
  pipeline_id uuid REFERENCES pipelines(id),
  stage text NOT NULL,
  responsavel_id uuid REFERENCES usuarios(id),
  valor numeric(12,2),
  mrr numeric(12,2),
  probabilidade integer,
  previsao_fechamento date,
  ganho_at timestamptz,
  perdido_at timestamptz,
  motivo_perda text,
  negocio_id_legado uuid REFERENCES negocios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_oportunidades_negocio_legado ON oportunidades (negocio_id_legado);
CREATE INDEX IF NOT EXISTS idx_oportunidades_stage ON oportunidades (stage);

-- ─── OPORTUNIDADE_ITENS (entidade nova — item/produto/servico comercial) ──
-- Uma oportunidade contem N itens; cada item tem sua propria familia/
-- natureza/recorrencia. Depois do fechamento, cada item da origem a um
-- servico_canonico correspondente (servico_canonico_id linka quando existir).
CREATE TABLE IF NOT EXISTS oportunidade_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  oportunidade_id uuid NOT NULL REFERENCES oportunidades(id) ON DELETE CASCADE,
  produto text,
  service_family text NOT NULL,
  revenue_nature text NOT NULL,
  quantidade numeric(10,2) NOT NULL DEFAULT 1,
  preco_unitario numeric(12,2) NOT NULL DEFAULT 0,
  desconto numeric(12,2) DEFAULT 0,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  servico_canonico_id uuid REFERENCES servicos_canonicos(id),
  origem_legado text NOT NULL, -- contrato_item | proposta_item
  contrato_item_id_legado uuid REFERENCES contrato_itens(id),
  proposta_item_id_legado uuid REFERENCES proposta_itens(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oportunidade_itens_oportunidade ON oportunidade_itens (oportunidade_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_oportunidade_itens_contrato_legado ON oportunidade_itens (contrato_item_id_legado) WHERE contrato_item_id_legado IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_oportunidade_itens_proposta_legado ON oportunidade_itens (proposta_item_id_legado) WHERE proposta_item_id_legado IS NOT NULL;

CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  empresa_id uuid REFERENCES empresas(id),
  pessoa_principal_id uuid REFERENCES pessoas(id),
  oportunidade_origem_id uuid REFERENCES oportunidades(id),
  cliente_desde timestamptz,
  status_financeiro text,
  lead_id_legado uuid REFERENCES leads(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_lead_legado ON clientes (lead_id_legado);

CREATE TABLE IF NOT EXISTS comercial_evidencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  negocio_id uuid NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  source_ref text,
  metadata jsonb,
  verificado_por uuid REFERENCES usuarios(id),
  verificado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (negocio_id, tipo, source_ref)
);

CREATE TABLE IF NOT EXISTS won_evidence_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  produto text,
  tipos_aceitos jsonb NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  nome text NOT NULL,
  manager_id uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  actor_id uuid REFERENCES usuarios(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  source text NOT NULL DEFAULT 'api',
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  pessoa_id uuid REFERENCES pessoas(id),
  canal text NOT NULL,
  direcao text,
  conteudo text,
  duracao_segundos integer,
  status text,
  external_id text,
  usuario_id uuid REFERENCES usuarios(id),
  ocorrido_em timestamptz NOT NULL,
  origem_legado_id uuid,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canal, external_id)
);

CREATE TABLE IF NOT EXISTS ai_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  resumo text,
  sentimento text,
  intencao text,
  objecoes jsonb,
  necessidades jsonb,
  proximos_passos text,
  score numeric(4,2),
  risco text,
  oportunidade text,
  modelo_usado text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automacao_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automacao_id uuid NOT NULL REFERENCES automacoes(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  status text NOT NULL,
  resultado jsonb,
  erro text,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cadence_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  nome text NOT NULL,
  entity_type text NOT NULL,
  steps jsonb NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cadence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  cadence_definition_id uuid NOT NULL REFERENCES cadence_definitions(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  current_step_id text,
  status text NOT NULL DEFAULT 'active',
  scheduled_at timestamptz,
  vars jsonb DEFAULT '{}'::jsonb,
  attempt integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cadence_enrollment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES cadence_enrollments(id) ON DELETE CASCADE,
  step_id text NOT NULL,
  status text NOT NULL,
  resultado jsonb,
  attempt integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metricas_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  data date NOT NULL,
  meta_valor_alvo numeric(12,2) NOT NULL DEFAULT 0,
  meta_realizado numeric(12,2) NOT NULL DEFAULT 0,
  meta_closers integer NOT NULL DEFAULT 0,
  pipeline_total numeric(14,2) NOT NULL DEFAULT 0,
  pipeline_ponderado numeric(14,2) NOT NULL DEFAULT 0,
  pipeline_negocios_abertos integer NOT NULL DEFAULT 0,
  fechado_mes_ganhos integer NOT NULL DEFAULT 0,
  fechado_mes_receita numeric(14,2) NOT NULL DEFAULT 0,
  fechado_mes_recorrente numeric(14,2) NOT NULL DEFAULT 0,
  fechado_mes_avulso numeric(14,2) NOT NULL DEFAULT 0,
  mrr_stripe numeric(14,2) NOT NULL DEFAULT 0,
  mrr_stripe_clientes integer NOT NULL DEFAULT 0,
  mrr_risco numeric(14,2) NOT NULL DEFAULT 0,
  mrr_risco_qtd integer NOT NULL DEFAULT 0,
  calculado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacao_id, data)
);

CREATE TABLE IF NOT EXISTS event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  correlation_id uuid,
  idempotency_key text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);


-- ═══ Idempotency keys usadas pelo backfill (mrr_movimentos ja formalizado acima) ═══

ALTER TABLE mrr_movimentos ADD COLUMN IF NOT EXISTS evento_comercial_id uuid REFERENCES eventos_comerciais(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mrr_movimentos_evento_comercial ON mrr_movimentos (evento_comercial_id) WHERE evento_comercial_id IS NOT NULL;
