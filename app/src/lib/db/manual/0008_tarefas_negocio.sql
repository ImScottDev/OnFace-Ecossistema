-- Tarefas dentro do negócio + data/hora de vencimento (lembrete/follow-up).
-- Idempotente.
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS vence_em timestamptz;
CREATE INDEX IF NOT EXISTS idx_tarefas_negocio_id ON tarefas(negocio_id);
