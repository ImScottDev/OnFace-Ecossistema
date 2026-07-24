-- 0006 — Tabela de metas + migração de papéis (vendedor -> closer)
-- Projeto usa db:push, não migrations versionadas. Aplicar em prod via:
--   psql "$DATABASE_URL" -f src/lib/db/manual/0006_metas_roles.sql
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.

CREATE TABLE IF NOT EXISTS metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  periodo date NOT NULL,
  tipo text NOT NULL, -- reunioes_agendadas | mrr_fechado | leads_qualificados | contratos_fechados
  valor_alvo numeric(12,2) NOT NULL,
  criado_por uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_metas_org_user_periodo_tipo
  ON metas (organizacao_id, usuario_id, periodo, tipo);
CREATE INDEX IF NOT EXISTS idx_metas_org_periodo
  ON metas (organizacao_id, periodo);

-- Papéis: vendedor legado vira closer
UPDATE usuarios SET role = 'closer' WHERE role = 'vendedor';
