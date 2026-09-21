-- Fulfillment com múltiplas jornadas por serviço (SPEC §18.1, fase 11).
--
-- Hoje é efetivamente um fulfillment por serviço. O SPEC exige suportar VÁRIAS
-- jornadas ao longo do tempo: um serviço passa por onboarding, depois por
-- renovação, e eventualmente por offboarding. Com unicidade por serviço, a
-- segunda jornada não cabe.
--
-- Troca UNIQUE(serviço) por UNIQUE(serviço, tipo, ciclo).

BEGIN;

ALTER TABLE fulfillments ADD COLUMN IF NOT EXISTS servico_canonico_id uuid REFERENCES servicos_canonicos(id) ON DELETE CASCADE;
ALTER TABLE fulfillments ADD COLUMN IF NOT EXISTS cycle_number        integer NOT NULL DEFAULT 1;
ALTER TABLE fulfillments ADD COLUMN IF NOT EXISTS due_at              timestamptz;
ALTER TABLE fulfillments ADD COLUMN IF NOT EXISTS cancelled_at        timestamptz;

-- `tipo` já existe? Se não, nasce com ONBOARDING, que é o que as 25 linhas
-- atuais são de fato.
ALTER TABLE fulfillments ADD COLUMN IF NOT EXISTS tipo text;
UPDATE fulfillments SET tipo = coalesce(tipo, 'ONBOARDING') WHERE tipo IS NULL;

-- Vocabulário fechado do SPEC §18.1.
ALTER TABLE fulfillments DROP CONSTRAINT IF EXISTS ck_fulfillments_tipo;
ALTER TABLE fulfillments ADD CONSTRAINT ck_fulfillments_tipo
  CHECK (tipo IN ('ONBOARDING','IMPLEMENTATION','RENEWAL','OFFBOARDING'));

-- Uma jornada por serviço, tipo e ciclo. Permite o mesmo serviço ter
-- onboarding (ciclo 1), implantação (ciclo 1) e renovação (ciclo 2).
CREATE UNIQUE INDEX IF NOT EXISTS uq_fulfillment_ciclo
  ON fulfillments (servico_canonico_id, tipo, cycle_number)
  WHERE servico_canonico_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fulfillments_servico ON fulfillments (servico_canonico_id);

COMMIT;
