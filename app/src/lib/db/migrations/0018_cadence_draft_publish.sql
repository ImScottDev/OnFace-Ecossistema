-- Separa configuracao em edicao do fluxo que o worker executa.
ALTER TABLE cadence_definitions
  ADD COLUMN IF NOT EXISTS draft_steps JSONB,
  ADD COLUMN IF NOT EXISTS versao INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE cadence_definitions
SET draft_steps = steps
WHERE draft_steps IS NULL;
