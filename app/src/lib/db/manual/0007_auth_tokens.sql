-- Tokens de convite / redefinição de senha (uso único, expiração).
-- Idempotente (projeto usa db:push, mas mantemos SQL manual pro deploy).
CREATE TABLE IF NOT EXISTS auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  tipo text NOT NULL,
  token_hash text NOT NULL,
  expira_em timestamptz NOT NULL,
  usado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_tokens_hash ON auth_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_usuario ON auth_tokens (usuario_id);
