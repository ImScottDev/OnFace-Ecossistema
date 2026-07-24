-- Closer fixado por lead durante o agendamento do Agente SDR (evita que o
-- round-robin troque de closer entre turnos de uma mesma conversa).
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "agenda_closer_id" uuid REFERENCES "usuarios"("id");
CREATE INDEX IF NOT EXISTS "idx_leads_agenda_closer" ON "leads" ("agenda_closer_id");
