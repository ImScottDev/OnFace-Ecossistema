-- Período de teste da proposta.
--
-- A tela de proposta já oferece a caixa "período de teste" e o número de dias,
-- mas não havia onde guardar: o dado morria no estado da tela e nunca chegava
-- ao Stripe. Na prática, o vendedor oferecia teste, o cliente aceitava, e a
-- cobrança saía na hora — o contrário do combinado.
--
-- `trial_dias` é anulável de propósito. NULL e 0 significam "sem teste", que é
-- o padrão: não existe número default aqui, quem decide é o vendedor em cada
-- proposta. O teto de 730 é o limite do próprio Stripe para `trial_period_days`.
--
-- Aditiva: coluna nova anulável, nenhuma linha reescrita.

ALTER TABLE propostas
  ADD COLUMN IF NOT EXISTS trial_dias integer;

ALTER TABLE propostas
  DROP CONSTRAINT IF EXISTS propostas_trial_dias_valido;

ALTER TABLE propostas
  ADD CONSTRAINT propostas_trial_dias_valido
  CHECK (trial_dias IS NULL OR (trial_dias >= 1 AND trial_dias <= 730));
