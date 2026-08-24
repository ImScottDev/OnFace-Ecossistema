-- Preserve the structured signer snapshot on the generated contract.
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS signatarios jsonb;
