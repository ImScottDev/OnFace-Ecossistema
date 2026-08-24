-- Contract flow: seller-owned signatories are captured before proposal send.
-- Additive and idempotent. Existing proposals remain valid and continue to
-- use the pre-existing contract/signature behavior until edited.
ALTER TABLE propostas
  ADD COLUMN IF NOT EXISTS signatarios jsonb;

CREATE INDEX IF NOT EXISTS idx_propostas_signatarios
  ON propostas USING gin (signatarios);
