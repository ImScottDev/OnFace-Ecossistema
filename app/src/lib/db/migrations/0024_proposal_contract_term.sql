-- Prazo contratual informado antes do envio da proposta.
-- Sem default: o envio de proposta que exige contrato valida explicitamente
-- que o vendedor preencheu o prazo.
ALTER TABLE propostas
  ADD COLUMN IF NOT EXISTS prazo_contrato_meses integer;
