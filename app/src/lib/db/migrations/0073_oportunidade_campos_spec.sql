-- Completa `oportunidades` com os campos que o SPEC 11.1 define e que a
-- expansao da fase 04 nao criou.
--
-- Encontrado ao tentar migrar a leitura dos relatorios: eles calculam MRR e
-- setup separados, e o canonico so tinha `valor` e `mrr`. Migrar a leitura sem
-- o campo perderia a distincao entre receita recorrente e receita de
-- implantacao, que sao coisas diferentes para quem decide.
--
--   setup_estimado       receita de implantacao, separada do recorrente
--   servico_catalogo_id  QUAL produto — hoje so existe `service_family`, que e
--                        a familia, nao o item de catalogo
--   etapa_id             a etapa como REFERENCIA, nao como texto solto. O texto
--                        continua em `etapa` ate a contracao.
--
-- EXPAND puro: nulavel, sem default destrutivo, nada apagado.

BEGIN;

ALTER TABLE oportunidades
  ADD COLUMN IF NOT EXISTS setup_estimado numeric(12,2),
  ADD COLUMN IF NOT EXISTS servico_catalogo_id uuid REFERENCES servicos_catalogo(id),
  ADD COLUMN IF NOT EXISTS etapa_id uuid REFERENCES pipeline_etapas(id);

-- Backfill do setup a partir do negocio legado. So onde existe: ausencia de
-- setup e ausencia, nao zero — zero afirmaria que a venda nao teve implantacao.
UPDATE oportunidades o
   SET setup_estimado = n.valor_setup
  FROM negocios n
 WHERE n.id = o.negocio_id_legado
   AND n.valor_setup IS NOT NULL
   AND o.setup_estimado IS NULL;

-- Etapa como referencia, casando pelo codigo dentro do mesmo pipeline.
UPDATE oportunidades o
   SET etapa_id = pe.id
  FROM pipeline_etapas pe
 WHERE pe.codigo = o.etapa
   AND pe.organizacao_id = o.organizacao_id
   AND (o.pipeline_id IS NULL OR pe.pipeline_id = o.pipeline_id)
   AND o.etapa_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_oportunidades_etapa_id ON oportunidades (etapa_id)
  WHERE etapa_id IS NOT NULL;

COMMIT;

-- Reversao:
--   DROP INDEX IF EXISTS idx_oportunidades_etapa_id;
--   ALTER TABLE oportunidades
--     DROP COLUMN IF EXISTS setup_estimado,
--     DROP COLUMN IF EXISTS servico_catalogo_id,
--     DROP COLUMN IF EXISTS etapa_id;
