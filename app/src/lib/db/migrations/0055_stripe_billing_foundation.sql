-- Stripe × CRM billing foundation (2026-09-14)
-- Additive only. This migration never changes Stripe and never deletes CRM data.

CREATE TABLE IF NOT EXISTS billing_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  empresa_id uuid REFERENCES empresas(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  canonical_stripe_customer_id text,
  cnpj_normalized text,
  primary_email_normalized text,
  status text NOT NULL DEFAULT 'REVIEW',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('CONFIRMED', 'REVIEW', 'CONFLICT'))
);

-- Produção já possuía uma versão não-versionada de billing_identities, usada
-- pela reconciliação legada. Evoluímos a tabela in-place: não há rename,
-- drop ou reinterpretação de external_customer_id/canonical_* antigos.
ALTER TABLE billing_identities ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE billing_identities ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE billing_identities ADD COLUMN IF NOT EXISTS canonical_stripe_customer_id text;
ALTER TABLE billing_identities ADD COLUMN IF NOT EXISTS cnpj_normalized text;
ALTER TABLE billing_identities ADD COLUMN IF NOT EXISTS primary_email_normalized text;
ALTER TABLE billing_identities ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE billing_identities ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE billing_identities b
SET empresa_id = COALESCE(b.empresa_id, (to_jsonb(b)->>'canonical_empresa_id')::uuid),
    lead_id = COALESCE(b.lead_id, (to_jsonb(b)->>'canonical_lead_id')::uuid),
    canonical_stripe_customer_id = COALESCE(b.canonical_stripe_customer_id, to_jsonb(b)->>'external_customer_id'),
    primary_email_normalized = COALESCE(b.primary_email_normalized, lower(to_jsonb(b)->'emails'->>0)),
    status = COALESCE(b.status, CASE WHEN to_jsonb(b)->>'confidence' = 'CONFIRMED' THEN 'CONFIRMED' ELSE 'REVIEW' END),
    updated_at = now();
UPDATE billing_identities b
SET cnpj_normalized = regexp_replace(e.cnpj, '\\D', '', 'g')
FROM empresas e
WHERE e.id = b.empresa_id
  AND b.cnpj_normalized IS NULL
  AND length(regexp_replace(coalesce(e.cnpj, ''), '\\D', '', 'g')) = 14;
CREATE INDEX IF NOT EXISTS idx_billing_identity_canonical_customer
  ON billing_identities (organizacao_id, canonical_stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_identity_empresa_v2
  ON billing_identities (organizacao_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_billing_identity_cnpj
  ON billing_identities (organizacao_id, cnpj_normalized)
  WHERE cnpj_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_identity_email
  ON billing_identities (organizacao_id, primary_email_normalized)
  WHERE primary_email_normalized IS NOT NULL;

CREATE TABLE IF NOT EXISTS billing_customer_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_identity_id uuid NOT NULL REFERENCES billing_identities(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  is_canonical boolean NOT NULL DEFAULT false,
  resolution_source text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stripe_customer_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_alias_one_canonical_per_identity
  ON billing_customer_aliases (billing_identity_id)
  WHERE is_canonical;
CREATE INDEX IF NOT EXISTS idx_billing_alias_identity
  ON billing_customer_aliases (billing_identity_id);

CREATE TABLE IF NOT EXISTS billing_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid REFERENCES organizacoes(id) ON DELETE SET NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'RUNNING',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifact_path text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED'))
);

CREATE TABLE IF NOT EXISTS billing_resolution_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id uuid REFERENCES billing_audit_runs(id) ON DELETE SET NULL,
  organizacao_id uuid REFERENCES organizacoes(id) ON DELETE SET NULL,
  queue text NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  crm_entity_type text,
  crm_entity_id uuid,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommended_action jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (queue IN ('CONFIRMED', 'REVIEW', 'CONFLICT')),
  CHECK (status IN ('OPEN', 'APPROVED', 'REJECTED', 'APPLIED'))
);
CREATE INDEX IF NOT EXISTS idx_billing_cases_queue
  ON billing_resolution_cases (organizacao_id, queue, status);
CREATE INDEX IF NOT EXISTS idx_billing_cases_customer
  ON billing_resolution_cases (stripe_customer_id);

CREATE TABLE IF NOT EXISTS billing_correction_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id uuid REFERENCES billing_audit_runs(id) ON DELETE SET NULL,
  billing_identity_id uuid REFERENCES billing_identities(id) ON DELETE SET NULL,
  organizacao_id uuid REFERENCES organizacoes(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  before jsonb NOT NULL DEFAULT '{}'::jsonb,
  after jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_applied text NOT NULL,
  operator text NOT NULL,
  reversible boolean NOT NULL DEFAULT true,
  reverted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_ledger_audit_run
  ON billing_correction_ledger (audit_run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_billing_ledger_entity
  ON billing_correction_ledger (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  processed_at timestamptz,
  UNIQUE (stripe_event_id),
  CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'))
);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
  ON stripe_webhook_events (status, received_at);
