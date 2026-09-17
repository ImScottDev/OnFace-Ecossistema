-- Motor único de automações/cadências + tags para todas as entidades CRM2.

CREATE TABLE IF NOT EXISTS entity_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_by_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_entity_labels_type CHECK (entity_type IN ('lead','negocio','oportunidade','cliente','empresa','contato','servico')),
  CONSTRAINT uq_entity_labels_entity_label UNIQUE (organizacao_id, entity_type, entity_id, label_id)
);
CREATE INDEX IF NOT EXISTS idx_entity_labels_entity ON entity_labels(organizacao_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_labels_label ON entity_labels(label_id);

-- Também corrige instalações onde uma versão anterior desta migração já criou
-- a constraint sem `servico`.
ALTER TABLE entity_labels DROP CONSTRAINT IF EXISTS ck_entity_labels_type;
ALTER TABLE entity_labels ADD CONSTRAINT ck_entity_labels_type
  CHECK (entity_type IN ('lead','negocio','oportunidade','cliente','empresa','contato','servico'));

ALTER TABLE cadence_enrollments
  ADD COLUMN IF NOT EXISTS source_event_id UUID REFERENCES event_outbox(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cadence_enrollments_idempotency
  ON cadence_enrollments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cadence_enrollments_one_live
  ON cadence_enrollments(cadence_definition_id, entity_type, entity_id)
  WHERE status IN ('active','waiting','waiting_reply','paused');

ALTER TABLE cadence_enrollment_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cadence_enrollment_events_idempotency
  ON cadence_enrollment_events(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Migração aditiva das tags já existentes. Não remove os bridges legados.
INSERT INTO entity_labels (organizacao_id, entity_type, entity_id, label_id, created_at)
SELECT l.organizacao_id, 'lead', ll.lead_id, ll.label_id, ll.created_at
FROM lead_labels ll
JOIN leads l ON l.id = ll.lead_id
WHERE ll.lead_id IS NOT NULL AND ll.label_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO entity_labels (organizacao_id, entity_type, entity_id, label_id, created_at)
SELECT c.organizacao_id, 'contato', cl.contato_id, cl.label_id, cl.created_at
FROM contato_labels cl
JOIN contatos c ON c.id = cl.contato_id
ON CONFLICT DO NOTHING;
