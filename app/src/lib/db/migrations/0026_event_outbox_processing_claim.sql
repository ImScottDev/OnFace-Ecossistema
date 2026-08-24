-- Claim observável do consumidor do outbox. A coluna permite recuperar
-- eventos presos sem usar created_at como aproximação do início do claim.
ALTER TABLE event_outbox
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;
