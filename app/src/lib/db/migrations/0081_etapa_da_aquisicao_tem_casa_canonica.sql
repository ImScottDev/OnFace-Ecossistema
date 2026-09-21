-- 0081 — a etapa da aquisição passa a ter casa no modelo canônico (SPEC §8.2)
--
-- O problema medido: mover um card para "Em contato" no board escrevia
-- leads.estagio_pre_vendas, e o board lê aquisicoes. A etapa canônica era
-- DERIVADA de fatos (last_touch_at > first_touch_at), e mover o card não é um
-- fato de toque — então o card voltava para Novo na releitura. Duas verdades
-- dentro da mesma tela, provado por smoke-tela-escreve-tela-le.
--
-- A SPEC §8.2 já dizia onde a etapa mora: pipelines + pipeline_etapas, com
-- aquisicoes.etapa_id apontando. As duas colunas existem e estavam em 0 de
-- 3.989. Esta migration cria o pipeline de AQUISIÇÃO, suas etapas, e materializa
-- em etapa_id EXATAMENTE o que o board já mostra hoje — nenhum card muda de
-- coluna por causa desta migration.
--
-- Aditiva. Nada é removido: a derivação continua como fallback e
-- leads.estagio_pre_vendas continua sendo escrita enquanto houver leitor.
--
-- ROLLBACK:
--   ALTER TABLE pipelines DROP COLUMN IF EXISTS tipo;
--   UPDATE aquisicoes SET etapa_id = NULL, pipeline_id = NULL
--    WHERE pipeline_id IN (SELECT id FROM pipelines WHERE slug = 'aquisicao');
--   DELETE FROM pipeline_etapas WHERE pipeline_id IN (SELECT id FROM pipelines WHERE slug = 'aquisicao');
--   DELETE FROM pipelines WHERE slug = 'aquisicao';

ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'SALES';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
     WHERE table_name = 'pipelines' AND constraint_name = 'ck_pipelines_tipo'
  ) THEN
    ALTER TABLE pipelines ADD CONSTRAINT ck_pipelines_tipo
      CHECK (tipo IN ('ACQUISITION', 'SALES'));
  END IF;
END $$;

-- Um pipeline de aquisição por organização.
INSERT INTO pipelines (organizacao_id, nome, slug, ordem, stages, closed_stages, is_default, ativo, tipo)
SELECT o.id, 'Pré-vendas', 'aquisicao', 0, '[]'::jsonb, '[]'::jsonb, false, true, 'ACQUISITION'
  FROM organizacoes o
 WHERE NOT EXISTS (SELECT 1 FROM pipelines p WHERE p.organizacao_id = o.id AND p.slug = 'aquisicao');

-- As sete etapas: cinco do board principal e as duas saídas em aba própria.
INSERT INTO pipeline_etapas (organizacao_id, pipeline_id, codigo, nome, ordem, tipo_fechamento)
SELECT p.organizacao_id, p.id, e.codigo, e.nome, e.ordem, e.fechamento
  FROM pipelines p
  CROSS JOIN (VALUES
      ('novo',           'Novo',           0, 'OPEN'),
      ('em_contato',     'Em contato',     1, 'OPEN'),
      ('qualificacao',   'Qualificação',   2, 'OPEN'),
      ('qualificado',    'Qualificado',    3, 'OPEN'),
      ('oportunidade',   'Oportunidade',   4, 'WON'),
      ('nutricao',       'Nutrição',       5, 'OPEN'),
      ('desqualificado', 'Desqualificado', 6, 'DISQUALIFIED')
  ) AS e(codigo, nome, ordem, fechamento)
 WHERE p.slug = 'aquisicao'
   AND NOT EXISTS (SELECT 1 FROM pipeline_etapas pe WHERE pe.pipeline_id = p.id AND pe.codigo = e.codigo);

-- Materializa a etapa que o board JÁ mostra. A ordem das condições é a mesma de
-- packages/domain/acquisition/queries/board-pre-vendas.ts, e o refinamento por
-- leads.estagio_pre_vendas = 'qualificacao' é o mesmo que consultas.ts aplica —
-- 'qualificacao' é o único estado sem prova própria no canônico.
WITH etapa_calculada AS (
  SELECT a.id AS aquisicao_id,
         CASE
           WHEN a.desqualificado_em IS NOT NULL THEN 'desqualificado'
           WHEN COALESCE(a.nutricao_status, '') <> '' THEN 'nutricao'
           WHEN EXISTS (SELECT 1 FROM oportunidades o
                         WHERE o.organizacao_id = a.organizacao_id
                           AND (o.pessoa_id = a.pessoa_id OR o.empresa_id = a.empresa_id)
                           AND o.ganho_at IS NULL AND o.perdido_at IS NULL) THEN 'oportunidade'
           WHEN a.qualificado THEN 'qualificado'
           WHEN l.estagio_pre_vendas = 'qualificacao' THEN 'qualificacao'
           WHEN a.last_touch_at IS NOT NULL AND a.first_touch_at IS NOT NULL
                AND a.last_touch_at > a.first_touch_at THEN 'em_contato'
           ELSE 'novo'
         END AS codigo
    FROM aquisicoes a
    LEFT JOIN leads l ON l.id = a.lead_legado_id
   WHERE a.etapa_id IS NULL
)
UPDATE aquisicoes a
   SET pipeline_id = p.id, etapa_id = pe.id, updated_at = a.updated_at
  FROM etapa_calculada ec
  JOIN pipelines p ON p.slug = 'aquisicao'
  JOIN pipeline_etapas pe ON pe.pipeline_id = p.id AND pe.codigo = ec.codigo
 WHERE a.id = ec.aquisicao_id AND p.organizacao_id = a.organizacao_id;

CREATE INDEX IF NOT EXISTS idx_aquisicoes_etapa_codigo ON aquisicoes (organizacao_id, etapa_id) WHERE closed_at IS NULL;
