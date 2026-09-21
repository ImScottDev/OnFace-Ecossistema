-- Cliente como perfil de CS e serviço ligado à oportunidade (SPEC §16.2, §17).
--
-- `clientes` deixa de ser outra identidade de empresa e passa a ser o perfil 1:1
-- de customer success DELA. `servicos_canonicos` ganha a ligação com a
-- oportunidade que o originou, que hoje só existe indiretamente pelo contrato.
--
-- EXPAND: só adiciona coluna nulável e índice. As colunas de ponte legada
-- (`lead_id_legado`, `lead_id`) ficam até a contração.

BEGIN;

-- SPEC §17: o serviço do cliente aponta para a oportunidade de origem.
ALTER TABLE servicos_canonicos ADD COLUMN IF NOT EXISTS oportunidade_origem_id uuid REFERENCES oportunidades(id) ON DELETE SET NULL;
ALTER TABLE servicos_canonicos ADD COLUMN IF NOT EXISTS oferta_comercial_id    uuid REFERENCES ofertas_comerciais(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_servicos_oportunidade ON servicos_canonicos (oportunidade_origem_id);

-- SPEC §16.2: campos do perfil de CS que a tabela ainda não tem.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS responsavel_cs_id  uuid REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS lifecycle_status   text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ultimo_contato_em  timestamptz;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS proxima_revisao_em timestamptz;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS health_atual       integer;

-- `responsavel_id` já existia e significa o mesmo que `responsavel_cs_id`.
-- Copia o valor para o campo canônico em vez de manter duas verdades.
UPDATE clientes SET responsavel_cs_id = responsavel_id
 WHERE responsavel_cs_id IS NULL AND responsavel_id IS NOT NULL;

COMMIT;
