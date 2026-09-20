-- CARGA DA VIRADA · passo 03 — roda no banco recém-restaurado do dump de
-- produção, ANTES da cadeia de migrações de dev.
--
-- Por que existe: dev tem um índice ÚNICO em `lead_labels (lead_id, label_id)`
-- que nenhuma migration criou (veio de `drizzle-kit push`; agora está em
-- `0049`). O dado de produção tem 1 par (lead, label) repetido, e a criação do
-- índice falha.
--
-- ⚠️  ESTE PASSO APAGA LINHA. `lead_labels` é tabela de ligação pura: a linha
-- repetida não carrega informação nenhuma além do próprio vínculo, que
-- continua existindo na linha que sobrevive. Mesmo assim é DELETE e precisa de
-- OK do Scott.
--
-- Idempotente: rodar de novo não acha mais duplicata.

DELETE FROM lead_labels a
 USING lead_labels b
 WHERE a.lead_id = b.lead_id
   AND a.label_id = b.label_id
   AND a.ctid > b.ctid;
