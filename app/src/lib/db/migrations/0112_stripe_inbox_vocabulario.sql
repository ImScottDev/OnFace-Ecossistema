-- 0112 — Stripe: o inbox de webhooks fala um vocabulário só (minúsculo).
--
-- O banco de produção foi criado à mão com `status` em MAIÚSCULAS
-- (PENDING/PROCESSED/...) e um CHECK que só aceita maiúsculas; o código novo
-- grava e lê minúsculo (`pending`, `processed`, `failed`...). Em produção,
-- 1 `invoice.paid` ficou PENDING desde 14/09 sem que nada o reconhecesse.
--
-- Esta migration só normaliza o DADO e tira a trava que impede o vocabulário
-- novo. O código também compara sem diferenciar caixa
-- (`lib/integrations/stripe-webhook-events.ts`), então uma carga que volte a
-- trazer maiúsculas não derruba o reprocessamento.
--
-- Aditiva e idempotente: rodar de novo não muda nada.

ALTER TABLE stripe_webhook_events DROP CONSTRAINT IF EXISTS stripe_webhook_events_status_check;

UPDATE stripe_webhook_events
   SET status = lower(status), updated_at = now()
 WHERE status <> lower(status);

ALTER TABLE stripe_webhook_events ALTER COLUMN status SET DEFAULT 'pending';
