-- 0121 — Catálogo: o que foi vendido congela na linha da proposta; o catálogo entende período e faixa.
--
-- `proposta_itens` ganha `exige_contrato` e `periodo`, copiados do price no momento da criação
-- (como já são `valor_tabela`, `stripe_price_id`, `service_family`...). O aceite passa a ler daqui;
-- NULL = linha antiga, e o aceite cai no catálogo como antes.
-- `catalogo_precos` ganha `intervalo_contagem` (interval_count do Stripe: trimestral = month x 3) e
-- `faixa_min`/`faixa_max` (metadata.faixa_min/faixa_max do price; White Label por faixa de licenças).
-- Nenhuma coluna existente muda de significado.
--
-- Aditiva e idempotente.

ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS exige_contrato boolean;
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS periodo text;
ALTER TABLE catalogo_precos ADD COLUMN IF NOT EXISTS intervalo_contagem integer;
ALTER TABLE catalogo_precos ADD COLUMN IF NOT EXISTS faixa_min integer;
ALTER TABLE catalogo_precos ADD COLUMN IF NOT EXISTS faixa_max integer;
