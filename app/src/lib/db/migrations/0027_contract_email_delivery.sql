-- Rastreamento do envio da cópia final do contrato.
-- Resend permanece opcional; o estado fica no CRM para retry e auditoria.
ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS email_entrega jsonb;
