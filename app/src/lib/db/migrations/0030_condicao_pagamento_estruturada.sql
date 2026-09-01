-- Condição de pagamento estruturada na proposta (25/08, billing avançado).
-- Aditivo, null-safe: proposta que não usa os campos novos mantém o
-- comportamento atual do checkout Stripe (métodos padrão da conta, boleto
-- com os 3 dias padrão do Stripe).
ALTER TABLE propostas
  ADD COLUMN IF NOT EXISTS condicao_pagamento_tipo text,
  ADD COLUMN IF NOT EXISTS parcelas integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS vencimento_dias integer;
