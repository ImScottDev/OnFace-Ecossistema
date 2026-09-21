-- 0079 — `source_process` volta a significar origem do processo comercial.
--
-- O backfill 07 gravou a string 'BACKFILL_07' em `oportunidades.source_process`,
-- que é uma coluna de NEGÓCIO: ela diz de onde a oportunidade veio (PRE_SALES,
-- OUTBOUND_DIRECT, MANUAL, EXPANSION) e aparece na tela como "Origem".
--
-- Efeito medido: 1.560 de 1.561 oportunidades com o marcador. No card do
-- pipeline o rótulo cai no default e mostra "—"; na página da oportunidade o
-- valor é exibido cru, então lia-se "Origem: BACKFILL_07". E 1.497 dessas têm
-- a origem de verdade no negócio legado, PRE_SALES, que a tela poderia estar
-- mostrando esse tempo todo.
--
-- A proveniência não se perde: `backfill_provenance` já tem as 1.561 linhas da
-- fase 07, que é o lugar próprio dela. Marcador de carga em coluna de negócio é
-- dado de processo interno ocupando campo de produto.
--
-- Onde não há origem no legado (63 linhas), o valor vira NULL em vez de um
-- palpite: o SPEC §42 proíbe inventar, e "não sei" é uma resposta melhor que
-- uma errada.

UPDATE oportunidades o
   SET source_process = n.source_process
  FROM negocios n
 WHERE o.negocio_id_legado = n.id
   AND o.source_process = 'BACKFILL_07';

UPDATE oportunidades
   SET source_process = NULL
 WHERE source_process = 'BACKFILL_07';
