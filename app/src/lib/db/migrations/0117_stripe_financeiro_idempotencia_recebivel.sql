-- 0113 — Stripe: idempotência da timeline financeira e backfill de faturas.receivable_state.
--
-- 1) A timeline financeira grava em `vendas_eventos` com `contexto.stripeChave` (a chave do FATO, não
--    do evento: invoice.created e invoice.finalized contam a mesma fatura emitida). O índice único
--    garante que reentrega do Stripe e reprocesso pela fila não dupliquem linha, nem em corrida.
-- 2) `faturas.receivable_state` estava nulo em todas as faturas. Preenche as do Stripe a partir do
--    status local + vencimento (mesma regra de `estadoDoRecebivel` e de `recalcularRecebiveis`).
--
-- Aditiva e idempotente: rodar de novo não muda nada.

CREATE UNIQUE INDEX IF NOT EXISTS uq_vendas_eventos_stripe_chave
  ON vendas_eventos (organizacao_id, (contexto->>'stripeChave'))
  WHERE (contexto->>'stripeChave') IS NOT NULL;

UPDATE faturas SET receivable_state = CASE status
    WHEN 'paga' THEN 'paid'
    WHEN 'void' THEN 'void'
    WHEN 'uncollectible' THEN 'uncollectible'
    WHEN 'aberta' THEN CASE WHEN vencimento IS NOT NULL AND vencimento < now() THEN 'overdue' ELSE 'open' END
    WHEN 'falhou' THEN 'overdue'
  END,
  updated_at = now()
WHERE origem = 'stripe'
  AND receivable_state IS NULL
  AND status IN ('paga', 'void', 'uncollectible', 'aberta', 'falhou');
