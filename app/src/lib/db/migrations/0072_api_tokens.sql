-- Tokens da API publica (SPEC 30.2, 23).
--
-- A autenticacao de hoje e cookie de sessao, que e certo para o navegador e
-- errado para integracao: cookie nao tem escopo, nao tem validade propria, nao
-- da para revogar um sem derrubar a pessoa, e nao diz quem consumiu o quê.
--
-- O token NUNCA e guardado em claro. Guarda-se o SHA-256, igual senha. Quem
-- perde o token gera outro; o banco nao tem como devolver o original, e isso e
-- a propriedade desejada — um dump do banco nao vira acesso.
--
-- `prefixo` existe para a pessoa reconhecer qual token e qual na tela sem que o
-- segredo apareca: sao os primeiros caracteres, que nao servem para autenticar.

BEGIN;

CREATE TABLE IF NOT EXISTS api_tokens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id   uuid NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  nome             text NOT NULL,
  prefixo          text NOT NULL,
  token_sha256     text NOT NULL,
  -- Escopos sao permissoes do RBAC (SPEC 31). O token nunca pode mais que o
  -- papel de quem o criou, e a verificacao acontece no pedido, nao aqui.
  escopos          text[] NOT NULL DEFAULT '{}',
  criado_por_id    uuid REFERENCES usuarios(id),
  expira_em        timestamptz,
  ultimo_uso_em    timestamptz,
  revogado_em      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_api_tokens_hash ON api_tokens (token_sha256);
CREATE INDEX IF NOT EXISTS idx_api_tokens_org ON api_tokens (organizacao_id) WHERE revogado_em IS NULL;

-- Toda chamada autenticada deixa rastro: sem isso nao da para responder "quem
-- puxou esses dados e quando", que e a primeira pergunta de qualquer incidente.
CREATE TABLE IF NOT EXISTS api_token_usos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id       uuid NOT NULL REFERENCES api_tokens(id) ON DELETE CASCADE,
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  metodo         text NOT NULL,
  caminho        text NOT NULL,
  status         integer NOT NULL,
  ip             inet,
  ocorrido_em    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_token_usos_token ON api_token_usos (token_id, ocorrido_em DESC);

COMMIT;

-- Reversao:
--   DROP TABLE IF EXISTS api_token_usos;
--   DROP TABLE IF EXISTS api_tokens;
