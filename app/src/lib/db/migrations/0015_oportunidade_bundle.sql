-- Commercial Core v3 (ADR-EXEC-022) — correção da unidade operacional do
-- pipeline. Achado real (16/08, correção do próprio Kauã sobre o v2): uma
-- oportunidade/negócio não deve conter simultaneamente linhas comerciais
-- INDEPENDENTES (Callface AI + PABX). Cada linha com ciclo próprio vira sua
-- PRÓPRIA oportunidade, com resultado (ganho/perdido) independente — sem
-- PARTIAL_WON como status de entidade. As oportunidades nascidas da mesma
-- negociação ficam relacionadas via oportunidade_bundle (agregação, não
-- status).

CREATE TABLE IF NOT EXISTS oportunidade_bundle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  nome text NOT NULL, -- ex: "Máxima Educacional — Nova venda"
  lead_id uuid REFERENCES leads(id),
  empresa_id uuid REFERENCES empresas(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oportunidade_bundle_org ON oportunidade_bundle(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_oportunidade_bundle_lead ON oportunidade_bundle(lead_id);

-- negocios (legado/operacional) é a fonte de verdade do pipeline — bundle_id
-- fica aqui (não só em oportunidades) porque é onde o vendedor realmente
-- opera (board, stage, responsável).
ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS bundle_id uuid REFERENCES oportunidade_bundle(id);
CREATE INDEX IF NOT EXISTS idx_negocios_bundle ON negocios(bundle_id);

ALTER TABLE oportunidades
  ADD COLUMN IF NOT EXISTS bundle_id uuid REFERENCES oportunidade_bundle(id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_bundle ON oportunidades(bundle_id);
