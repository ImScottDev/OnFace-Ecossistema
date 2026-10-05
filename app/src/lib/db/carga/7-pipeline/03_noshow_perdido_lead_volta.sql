-- CARGA DA VIRADA · pipeline — NO-SHOW vira PERDIDO com motivo, e o lead volta
-- para Pré-vendas para remarcação.
--
-- Decisão do Scott (05/10, revisando a anterior): no-show NÃO fica em Entrada.
-- "O que for no-show pode colocar como perdido, e o motivo a gente tem que
-- colocar motivo no-show, e acontecer esse rolê de voltar lá em pré-vendas e
-- aparecer que foi no-show para a pessoa tentar remarcar."
--
-- São 51 negócios com `status='no_show'` em produção, onde eles têm coluna
-- própria no board. No ONFACE a oportunidade é encerrada como Perdido com o
-- motivo registrado — não some, e dá para listar por motivo — e o LEAD volta
-- para Qualificado em Pré-vendas com a marca de no-show, que é onde o SDR
-- retrabalha e reagenda.
--
-- A data da perda é a do no-show real (última movimentação para esse status),
-- nunca now().
--
-- IDEMPOTENTE nas duas pontas.

-- 1. oportunidade -> perdido com motivo
UPDATE oportunidades o
   SET etapa_id     = COALESCE((SELECT pe.id FROM pipeline_etapas pe
                                 WHERE pe.pipeline_id = o.pipeline_id AND pe.codigo = 'perdido' LIMIT 1),
                               o.etapa_id),
       etapa        = 'perdido',
       stage        = 'perdido',
       perdido_at   = COALESCE(
                        (SELECT max(sc.created_at) FROM status_changes sc
                          WHERE sc.negocio_id = n.id AND sc.para_status = 'no_show'),
                        n.updated_at, n.created_at),
       motivo_perda = 'no-show',
       updated_at   = now()
  FROM negocios n
 WHERE o.negocio_id_legado = n.id
   AND n.status = 'no_show'
   AND COALESCE(o.etapa, '') <> 'perdido';

-- 2. o lead volta para QUALIFICADO em Pré-vendas, marcado como no-show, para
--    o SDR remarcar. A aquisição é reaberta: closed_at volta a NULL.
UPDATE aquisicoes a
   SET etapa_id          = COALESCE((SELECT pe.id FROM pipeline_etapas pe
                                      JOIN pipelines p ON p.id = pe.pipeline_id
                                     WHERE p.tipo = 'ACQUISITION' AND pe.codigo = 'qualificado' LIMIT 1),
                                    a.etapa_id),
       qualificado       = true,
       closed_at         = NULL,
       desqualificado_em = NULL,
       updated_at        = now()
  FROM negocios n
 WHERE a.lead_legado_id = n.lead_id
   AND n.status = 'no_show';

DO $$
DECLARE n_perd int; n_lead int;
BEGIN
  SELECT count(*) INTO n_perd FROM negocios n JOIN oportunidades o ON o.negocio_id_legado = n.id
   WHERE n.status = 'no_show' AND o.etapa = 'perdido' AND o.motivo_perda = 'no-show';
  SELECT count(DISTINCT a.id) INTO n_lead FROM negocios n JOIN aquisicoes a ON a.lead_legado_id = n.lead_id
   WHERE n.status = 'no_show' AND a.closed_at IS NULL;
  RAISE NOTICE '── no-show: % oportunidades em PERDIDO com motivo · % leads de volta em Pré-vendas', n_perd, n_lead;
END $$;
