-- Lembrete automático de reunião 30min antes via WhatsApp (Kauã, 10/08)
ALTER TABLE reunioes
  ADD COLUMN IF NOT EXISTS lembrete_30min_enviado_em timestamptz;
