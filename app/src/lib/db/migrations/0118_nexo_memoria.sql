-- 0118 — NEXO: memória própria (um fato por registro, com resumo para decidir se serve agora)
--
-- Aditiva e idempotente. Só cria tabela e índices; nada existente é tocado.
--
-- Por que uma tabela nova: `ai_memory_entries` é política da ORGANIZAÇÃO e o
-- Context Builder a injeta no prompt dos agentes de atendimento (anotação do
-- chat vazaria para o SDR); `ai_memoria_fatos` é amarrada a contato/lead/empresa
-- e não tem resumo nem ligação entre registros. Esta é do USUÁRIO, dentro da
-- organização: ninguém recupera a memória de outra pessoa nem de outra organização.
--
-- Modelo do vault: `titulo` + `resumo` curto servem para decidir se o registro é
-- relevante; `corpo` só é lido quando o NEXO abre o registro; `liga_a` liga
-- registros entre si. A recuperação é por relevância (busca em português, mesma
-- normalização do conhecimento), nunca "carrega tudo".
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS nexo_memoria;

CREATE TABLE IF NOT EXISTS nexo_memoria (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id   uuid NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  usuario_id       uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo           text NOT NULL,
  resumo           text NOT NULL,
  corpo            text,
  liga_a           uuid[] NOT NULL DEFAULT '{}',
  conversa_id      uuid,
  status           text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'arquivada')),
  created_at       timestamp with time zone NOT NULL DEFAULT now(),
  updated_at       timestamp with time zone NOT NULL DEFAULT now(),
  busca            tsvector GENERATED ALWAYS AS (
    setweight(onface_texto_busca(titulo), 'A') ||
    setweight(onface_texto_busca(resumo), 'B') ||
    setweight(onface_texto_busca(coalesce(corpo, '')), 'C')
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_nexo_memoria_dono ON nexo_memoria (organizacao_id, usuario_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nexo_memoria_busca ON nexo_memoria USING GIN (busca);
