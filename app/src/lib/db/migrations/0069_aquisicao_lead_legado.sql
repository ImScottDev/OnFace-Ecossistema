-- Liga a aquisicao canonica ao lead legado que a originou.
--
-- `oportunidades` ja tem `negocio_id_legado` pela mesma razao: durante o
-- cutover de leitura (fase 17) a tela precisa abrir o registro legado a partir
-- do canonico. Hoje essa ligacao so existe em `backfill_provenance`, que e
-- tabela de auditoria do backfill — usar ela em JOIN de runtime e caro e
-- frágil, alem de misturar auditoria com operacao.
--
-- A coluna e nulavel de proposito: aquisicao criada pelo caminho canonico
-- (SPEC §8) nao tem lead legado nenhum, e isso e o estado final desejado.

BEGIN;

ALTER TABLE aquisicoes ADD COLUMN IF NOT EXISTS lead_legado_id uuid;

-- Backfill a partir da provenance, que e a fonte de verdade de quem virou quem.
UPDATE aquisicoes a
   SET lead_legado_id = bp.id_origem::uuid
  FROM backfill_provenance bp
 WHERE bp.entidade_canonica = 'aquisicao'
   AND bp.tabela_origem = 'leads'
   AND bp.id_canonico = a.id
   AND a.lead_legado_id IS NULL;

-- Um lead vira no maximo uma aquisicao. Parcial porque o alvo do refactor e
-- justamente a aquisicao sem lead nenhum.
CREATE UNIQUE INDEX IF NOT EXISTS uq_aquisicoes_lead_legado
    ON aquisicoes (lead_legado_id) WHERE lead_legado_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aquisicoes_abertas
    ON aquisicoes (organizacao_id, updated_at DESC) WHERE closed_at IS NULL;

COMMIT;

-- Reversao:
--   DROP INDEX IF EXISTS uq_aquisicoes_lead_legado;
--   DROP INDEX IF EXISTS idx_aquisicoes_abertas;
--   ALTER TABLE aquisicoes DROP COLUMN IF EXISTS lead_legado_id;
