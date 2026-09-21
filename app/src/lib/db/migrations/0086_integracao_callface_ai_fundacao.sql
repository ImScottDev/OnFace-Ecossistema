-- 0086 — fundação da integração com o SaaS Callface AI
--
-- As quatro tabelas da recomendação da auditoria (external_identities,
-- tenant_snapshots, usage_events, reconciliation_candidates) JÁ existiam, e
-- estavam vazias: 0 identidades, 0 snapshots. O Cliente 360 já lê a primeira e
-- por isso mostrava "não conectado" nos 237 serviços CALLFACE_AI. O que faltava
-- não era schema, era o que produz dado.
--
-- Esta migration acrescenta o que a fundação exige e não existia:
--
-- 1. ESTADO DE SINCRONIZAÇÃO. Sem ele não há sync incremental, retry seguro nem
--    observabilidade: a próxima execução não sabe onde a anterior parou, e uma
--    falha do banco externo vira silêncio.
--
-- 2. JANELA nos snapshots. A tabela tinha contadores de uso sem dizer a QUE
--    período se referem. "127 chamadas" sem janela não é métrica, é número.
--
-- 3. AMBIGUIDADE explícita. Medido contra produção em 21/09/2026: de 1.803.331
--    chamadas em 90 dias, 97,53% têm organização resolvível por uma cadeia só,
--    2,30% têm DUAS cadeias que apontam para organizações diferentes e 0,18%
--    não têm cadeia nenhuma. Guardar só o total atribuído esconderia os 2,3%.
--
-- Nada é escrito no banco do Callface AI. Esta migration só toca a ONFACE.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS integracao_sync_estado;
--   ALTER TABLE callface_ai_tenant_snapshots
--     DROP COLUMN IF EXISTS janela_dias, DROP COLUMN IF EXISTS chamadas_ambiguas,
--     DROP COLUMN IF EXISTS chamadas_sem_atribuicao, DROP COLUMN IF EXISTS sessoes_copilot,
--     DROP COLUMN IF EXISTS contatos_base, DROP COLUMN IF EXISTS usuarios_com_atividade,
--     DROP COLUMN IF EXISTS reunioes, DROP COLUMN IF EXISTS apps_ativos,
--     DROP COLUMN IF EXISTS webhooks_ativos, DROP COLUMN IF EXISTS ultima_atividade_em,
--     DROP COLUMN IF EXISTS coletado_em;
--   DROP INDEX IF EXISTS uq_callface_ai_snapshot_janela;

CREATE TABLE IF NOT EXISTS integracao_sync_estado (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id    uuid NOT NULL REFERENCES organizacoes(id),
  provider          text NOT NULL,
  recurso           text NOT NULL,
  -- Onde a última execução parou. Para recurso baseado em tempo é um ISO; para
  -- recurso paginado, o id do último item. Texto porque o formato é do recurso.
  cursor            text,
  ultimo_sync_em    timestamp with time zone,
  ultimo_sucesso_em timestamp with time zone,
  status            text NOT NULL DEFAULT 'nunca_rodou',
  erro              text,
  tentativas        integer NOT NULL DEFAULT 0,
  itens_ultimo_sync integer,
  duracao_ms        integer,
  created_at        timestamp with time zone NOT NULL DEFAULT now(),
  updated_at        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ck_integracao_sync_status
    CHECK (status IN ('nunca_rodou','ok','parcial','falhou','indisponivel','desabilitado'))
);

-- Um estado por (organização, provedor, recurso). É o que torna o sync
-- idempotente sob concorrência: duas execuções disputam a MESMA linha.
CREATE UNIQUE INDEX IF NOT EXISTS uq_integracao_sync_estado
  ON integracao_sync_estado (organizacao_id, provider, recurso);
CREATE INDEX IF NOT EXISTS idx_integracao_sync_status
  ON integracao_sync_estado (provider, status, ultimo_sync_em DESC);

ALTER TABLE callface_ai_tenant_snapshots
  ADD COLUMN IF NOT EXISTS janela_dias            integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS chamadas_ambiguas      integer,
  ADD COLUMN IF NOT EXISTS chamadas_sem_atribuicao integer,
  ADD COLUMN IF NOT EXISTS sessoes_copilot        integer,
  ADD COLUMN IF NOT EXISTS contatos_base          integer,
  ADD COLUMN IF NOT EXISTS usuarios_com_atividade integer,
  ADD COLUMN IF NOT EXISTS reunioes               integer,
  ADD COLUMN IF NOT EXISTS apps_ativos            integer,
  ADD COLUMN IF NOT EXISTS webhooks_ativos        integer,
  ADD COLUMN IF NOT EXISTS ultima_atividade_em    timestamp with time zone,
  -- Quando a leitura no SaaS aconteceu. `snapshot_at` é o instante de
  -- referência da janela; os dois divergem quando o sync roda atrasado.
  ADD COLUMN IF NOT EXISTS coletado_em            timestamp with time zone;

-- Reexecutar o sync da mesma janela ATUALIZA a linha, não empilha outra. É o
-- que faz o job ser retry-safe sem deduplicação posterior.
CREATE UNIQUE INDEX IF NOT EXISTS uq_callface_ai_snapshot_janela
  ON callface_ai_tenant_snapshots (external_identity_id, snapshot_at, janela_dias);
