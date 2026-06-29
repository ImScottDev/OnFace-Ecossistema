-- Add tracking fields for Enhanced Conversions and Meta CAPI
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sobrenome text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS gbraid text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS wbraid text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS event_id text;
