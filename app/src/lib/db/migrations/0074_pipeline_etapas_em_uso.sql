-- Semeia em `pipeline_etapas` as etapas que o produto DE FATO usa, e liga
-- `oportunidades.etapa_id`.
--
-- O problema encontrado ao tentar ligar a etapa: a tabela canonica foi semeada
-- pelo backfill 07 a partir de `pipelines.stages`, que e a configuracao do CRM
-- 1 (reuniao_agendada, reuniao_realizada, trial, proposta_apresentada,
-- negociacao_iniciada, em_fechamento). O modulo Vendas do CRM 2.0 usa outro
-- vocabulario: entrada, diagnostico, proposta, negociacao, ganho, perdido.
--
-- Resultado: 1.561 oportunidades e ZERO com etapa_id, porque nenhum codigo
-- casava. A tabela canonica de etapas descrevia um pipeline que ninguem usa.
--
-- As etapas antigas NAO sao apagadas: elas sao a configuracao de um pipeline
-- legado, com SLA e cor, e apagar aqui seria contrair antes da hora. Elas
-- ficam, e quem usa etapa passa a achar a etapa certa.

BEGIN;

INSERT INTO pipeline_etapas (organizacao_id, pipeline_id, codigo, nome, ordem, tipo_fechamento, ativo)
SELECT p.organizacao_id, p.id, e.codigo, e.nome, e.ordem, e.fechamento, true
  FROM pipelines p
 CROSS JOIN (VALUES
   ('entrada',     'Entrada',     0, 'OPEN'),
   ('diagnostico', 'Diagnóstico', 1, 'OPEN'),
   ('proposta',    'Proposta',    2, 'OPEN'),
   ('negociacao',  'Negociação',  3, 'OPEN'),
   ('ganho',       'Ganho',       4, 'WON'),
   ('perdido',     'Perdido',     5, 'LOST')
 ) AS e(codigo, nome, ordem, fechamento)
ON CONFLICT (pipeline_id, codigo) DO NOTHING;

-- Liga a oportunidade a etapa do SEU pipeline. Sem pipeline definido, usa
-- qualquer etapa de mesmo codigo na organizacao: o codigo e o mesmo em todos
-- os pipelines, entao a etapa e a mesma coisa.
UPDATE oportunidades o
   SET etapa_id = pe.id
  FROM pipeline_etapas pe
 WHERE pe.codigo = o.etapa
   AND pe.organizacao_id = o.organizacao_id
   AND (o.pipeline_id IS NULL OR pe.pipeline_id = o.pipeline_id)
   AND o.etapa_id IS NULL;

COMMIT;

-- Reversao:
--   UPDATE oportunidades SET etapa_id = NULL;
--   DELETE FROM pipeline_etapas WHERE codigo IN
--     ('entrada','diagnostico','proposta','negociacao','ganho','perdido');
