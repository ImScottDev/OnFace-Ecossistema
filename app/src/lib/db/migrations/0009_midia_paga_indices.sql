-- Índices pro relatório de Mídia Paga (aditivo, sem risco). O funil por campanha
-- hoje faz GROUP BY utm_campaign e filtra negocios por (status, ganho_at) sem
-- índice dedicado — necessário pra um relatório consultado diariamente.
CREATE INDEX IF NOT EXISTS "idx_leads_utm_campaign_lookup" ON "leads" ("utm_campaign") WHERE "utm_campaign" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_negocios_status_ganho_at" ON "negocios" ("status", "ganho_at");
