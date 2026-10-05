-- CARGA DA VIRADA · pipeline, passo 01 — os estagnados viram PERDIDO, com motivo
-- e com a data real.
--
-- Em produção, "Estagnados" é um board separado, com quatro colunas: sem retorno
-- de contato (64), trava na negociação (22), trava na assinatura do contrato (2)
-- e quer negociar em outra data (157). O ONFACE tem quatro etapas abertas
-- (entrada, diagnóstico, proposta, negociação) e não tem board de estagnados.
--
-- O backfill 07 não tinha de/para para esses status e os espalhou pelas etapas
-- abertas, sem critério: 157 "outra_data" caíram 101 em proposta, 35 em entrada,
-- 13 em diagnóstico e 8 em negociação. Para quem abre a tela, viram negócio
-- ativo — e o funil passa a somar R$ 161 mil que não está em jogo.
--
-- Decisão do Scott (05/10): todos viram PERDIDO, cada um com o motivo do status
-- de origem, e a data da perda é a data em que o negócio entrou na etapa em que
-- está hoje — não a data da carga.
--
-- A DATA vem de `status_changes` (6.212 linhas de movimentação real): a mudança
-- mais recente daquele negócio PARA o status atual. É o fato de quando ele
-- parou. Quem não tem registro de movimentação cai em `updated_at` do negócio, e
-- o relatório diz quantos foram — `now()` nunca é usado, porque inventaria uma
-- data de perda que não aconteceu.
--
-- `motivo_estagnacao` e `estagnado_em` guardam o estado de origem, então nada se
-- perde: dá para reabrir a lista exata depois.
--
-- IDEMPOTENTE: a segunda execução não encontra mais estagnado fora de perdido.

WITH alvo AS (
  SELECT o.id AS oportunidade_id,
         n.id AS negocio_id,
         n.status,
         CASE n.status
           WHEN 'outra_data'       THEN 'quer negociar em outra data'
           WHEN 'sem_retorno'      THEN 'sem retorno de contato'
           WHEN 'trava_negociacao' THEN 'trava na negociação'
           WHEN 'trava_assinatura' THEN 'trava na assinatura do contrato'
         END AS motivo,
         -- quando ele entrou no status em que está hoje
         COALESCE(
           (SELECT max(sc.created_at) FROM status_changes sc
             WHERE sc.negocio_id = n.id AND sc.para_status = n.status),
           n.updated_at,
           n.created_at
         ) AS parou_em,
         (SELECT max(sc.created_at) FROM status_changes sc
           WHERE sc.negocio_id = n.id AND sc.para_status = n.status) IS NULL AS sem_movimentacao,
         (SELECT pe2.id FROM pipeline_etapas pe2
           WHERE pe2.pipeline_id = o.pipeline_id AND pe2.codigo = 'perdido' LIMIT 1) AS etapa_perdido
    FROM negocios n
    JOIN oportunidades o ON o.negocio_id_legado = n.id
   WHERE n.status IN ('outra_data', 'sem_retorno', 'trava_negociacao', 'trava_assinatura')
)
UPDATE oportunidades o
   SET etapa_id          = COALESCE(a.etapa_perdido, o.etapa_id),
       etapa             = 'perdido',
       stage             = 'perdido',
       perdido_at        = a.parou_em,
       motivo_perda      = a.motivo,
       motivo_estagnacao = COALESCE(o.motivo_estagnacao, a.status),
       estagnado_em      = COALESCE(o.estagnado_em, a.parou_em),
       updated_at        = now()
  FROM alvo a
 WHERE o.id = a.oportunidade_id
   AND COALESCE(o.etapa, '') <> 'perdido';

DO $$
DECLARE r record; sem_data int;
BEGIN
  RAISE NOTICE '── estagnados agora em PERDIDO, por motivo ──';
  FOR r IN
    SELECT o.motivo_perda AS motivo, count(*) AS n,
           to_char(min(o.perdido_at), 'YYYY-MM-DD') AS mais_antiga,
           to_char(max(o.perdido_at), 'YYYY-MM-DD') AS mais_recente
      FROM oportunidades o
     WHERE o.motivo_perda IN ('quer negociar em outra data', 'sem retorno de contato',
                              'trava na negociação', 'trava na assinatura do contrato')
     GROUP BY 1 ORDER BY 2 DESC
  LOOP
    RAISE NOTICE '  % · % negócios · de % a %', rpad(r.motivo, 34), r.n, r.mais_antiga, r.mais_recente;
  END LOOP;

  SELECT count(*) INTO sem_data
    FROM negocios n JOIN oportunidades o ON o.negocio_id_legado = n.id
   WHERE n.status IN ('outra_data','sem_retorno','trava_negociacao','trava_assinatura')
     AND NOT EXISTS (SELECT 1 FROM status_changes sc WHERE sc.negocio_id = n.id AND sc.para_status = n.status);
  RAISE NOTICE '  (% sem registro de movimentação — data veio de updated_at do negócio)', sem_data;
END $$;
