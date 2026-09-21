-- Proposta e contrato passam a referenciar a oportunidade canônica (SPEC §13.1, §14).
--
-- Hoje as duas amarram em `negocio_id` e `lead_id`. O SPEC manda referenciar
-- `oportunidade_id` e `empresa_id` e remover a dependência de lead/negócio
-- depois do cutover.
--
-- Aqui só se ADICIONA. `negocio_id` e `lead_id` ficam intactos: enquanto os
-- leitores não migrarem (fase 17), removê-los quebraria o produto inteiro.

BEGIN;

ALTER TABLE propostas ADD COLUMN IF NOT EXISTS oportunidade_id uuid REFERENCES oportunidades(id) ON DELETE SET NULL;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS empresa_id      uuid REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS oportunidade_id uuid REFERENCES oportunidades(id) ON DELETE SET NULL;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS empresa_id      uuid REFERENCES empresas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_propostas_oportunidade ON propostas (oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_propostas_empresa      ON propostas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_contratos_oportunidade ON contratos (oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_contratos_empresa      ON contratos (empresa_id);

COMMIT;
