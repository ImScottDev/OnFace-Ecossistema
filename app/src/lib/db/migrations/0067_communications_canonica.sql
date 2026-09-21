-- `communications` vira a abstração canônica de comunicação (SPEC §22.2, fase 13).
--
-- A tabela existe desde o modelo V2 mas nasceu incompleta e nunca recebeu dado:
-- 0 linhas contra 25.363 no WhatsApp, 4.938 em ligações e 4.460 em e-mails.
--
-- O SPEC §22.3 é explícito: as três tabelas legadas viram fonte bruta durante a
-- migração e nenhuma tela final lê as três diretamente. Este é o primeiro passo.
--
-- EXPAND: só adiciona coluna nulável e índice.

BEGIN;

ALTER TABLE communications ADD COLUMN IF NOT EXISTS conversa_id        uuid REFERENCES conversas(id) ON DELETE SET NULL;
ALTER TABLE communications ADD COLUMN IF NOT EXISTS empresa_id         uuid REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE communications ADD COLUMN IF NOT EXISTS oportunidade_id    uuid REFERENCES oportunidades(id) ON DELETE SET NULL;
ALTER TABLE communications ADD COLUMN IF NOT EXISTS tipo               text;
ALTER TABLE communications ADD COLUMN IF NOT EXISTS provider           text;
ALTER TABLE communications ADD COLUMN IF NOT EXISTS subject            text;
ALTER TABLE communications ADD COLUMN IF NOT EXISTS summary            text;
ALTER TABLE communications ADD COLUMN IF NOT EXISTS transcript         text;
ALTER TABLE communications ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE communications ADD COLUMN IF NOT EXISTS metadata           jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Qual tabela legada originou esta linha. É o que torna o backfill idempotente
-- sem precisar de provenance separado para 34.761 linhas.
ALTER TABLE communications ADD COLUMN IF NOT EXISTS origem_tabela      text;

CREATE INDEX IF NOT EXISTS idx_communications_conversa ON communications (conversa_id, ocorrido_em DESC);
CREATE INDEX IF NOT EXISTS idx_communications_empresa  ON communications (empresa_id, ocorrido_em DESC);
CREATE INDEX IF NOT EXISTS idx_communications_pessoa   ON communications (pessoa_id, ocorrido_em DESC);
-- Uma linha legada só vira uma comunicação. Reexecutar não duplica.
CREATE UNIQUE INDEX IF NOT EXISTS uq_communications_origem
  ON communications (origem_tabela, origem_legado_id)
  WHERE origem_tabela IS NOT NULL AND origem_legado_id IS NOT NULL;

COMMIT;
