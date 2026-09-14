CREATE TABLE IF NOT EXISTS cliente_receita_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  empresa_id uuid REFERENCES empresas(id) ON DELETE SET NULL,
  customer_key text NOT NULL,
  cliente_nome text NOT NULL,
  documento text,
  competencia date NOT NULL,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  quantidade_lancamentos integer NOT NULL DEFAULT 1,
  service_family text NOT NULL DEFAULT 'UNKNOWN',
  revenue_nature text NOT NULL DEFAULT 'UNKNOWN',
  canonical_product text,
  confidence text NOT NULL DEFAULT 'UNRESOLVED',
  source text NOT NULL,
  source_file text,
  source_row text,
  evidence jsonb NOT NULL DEFAULT '{}',
  source_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cliente_receita_mensal_source
  ON cliente_receita_mensal(organizacao_id, source_hash);

CREATE INDEX IF NOT EXISTS idx_cliente_receita_mensal_empresa_mes
  ON cliente_receita_mensal(organizacao_id, empresa_id, competencia);

CREATE INDEX IF NOT EXISTS idx_cliente_receita_mensal_documento_mes
  ON cliente_receita_mensal(organizacao_id, documento, competencia);

CREATE INDEX IF NOT EXISTS idx_cliente_receita_mensal_familia
  ON cliente_receita_mensal(organizacao_id, service_family, revenue_nature, confidence);
