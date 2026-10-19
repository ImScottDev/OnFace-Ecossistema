-- 0129 — propriedade e visibilidade das cadências.
--
-- Cadências anteriores não têm autor confiável: permanecem compartilhadas.
-- owner_id fica nulo apenas nesses legados; toda criação nova grava o usuário
-- autenticado como proprietário.

ALTER TABLE cadence_definitions
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'shared';

UPDATE cadence_definitions
   SET visibility = 'shared'
 WHERE visibility IS NULL OR visibility NOT IN ('personal', 'shared');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cadence_definitions_visibility_check'
  ) THEN
    ALTER TABLE cadence_definitions
      ADD CONSTRAINT cadence_definitions_visibility_check CHECK (visibility IN ('personal', 'shared'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cadence_definitions_org_visibility_owner
  ON cadence_definitions (organizacao_id, visibility, owner_id);
