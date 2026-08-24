-- Token opaco expirável para o destinatário acessar a cópia final assinada.
-- Somente o hash é persistido; a rota pública nunca abre o CRM nem expõe
-- credenciais do provider de assinatura.
ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS documento_publico_token_hash text,
  ADD COLUMN IF NOT EXISTS documento_publico_expira_em timestamptz;
