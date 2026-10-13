-- 0119 — Stripe: marca de "não é do CRM" em assinaturas e faturas.
--
-- A conta Stripe é compartilhada com o SaaS Callface e o sync espelhou objetos do SaaS em
-- `assinaturas` e `faturas` (regra em app/src/lib/integrations/stripe-origem.ts). O sync agora
-- filtra na origem; o que já entrou é MARCADO aqui, não apagado, por
-- app/src/scripts/marcar-saas-fora-do-espelho.ts (que guarda backup das linhas antes).
-- NULL = é do CRM. Quem lê MRR/carteira/cobrança deve ignorar linha com a marca preenchida.
--
-- Aditiva e idempotente.

ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS fora_do_espelho_em timestamptz;
ALTER TABLE assinaturas ADD COLUMN IF NOT EXISTS fora_do_espelho_motivo text;
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS fora_do_espelho_em timestamptz;
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS fora_do_espelho_motivo text;
