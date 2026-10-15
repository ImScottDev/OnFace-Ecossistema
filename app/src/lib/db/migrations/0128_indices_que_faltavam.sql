-- 0128 — Os índices que o código já supunha existir.
--
-- `status_changes` tem 6.977 linhas e UM índice: a chave primária. Os dois
-- acessos reais (histórico do lead, histórico do negócio) filtram por
-- `lead_id`/`negocio_id` e varrem a tabela inteira: 827.205 sequential scans
-- lendo 5.680.410.008 linhas no ciclo de vida dela. Hoje custa ~1,4 ms porque a
-- tabela cabe em cache; o comentário em `api-server/routes/leads.ts:1097` já
-- afirma que a coluna "é indexada por lead", e não era.
--
-- As outras colunas são chave estrangeira sem índice nas tabelas que mais
-- crescem — `communications` (50,5 mil linhas), `timeline_events` (33,5 mil),
-- `atividades` (15,3 mil). Além da leitura, FK sem índice faz todo DELETE do
-- pai varrer o filho inteiro. Medido na auditoria de 14/10/2026.
--
-- Aditiva e idempotente: só cria índice, não muda dado nem coluna. CONCURRENTLY
-- não se usa aqui porque o runner roda em transação; as tabelas são pequenas o
-- bastante para o lock ser instantâneo.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_status_changes_lead;
--   DROP INDEX IF EXISTS idx_status_changes_negocio;
--   DROP INDEX IF EXISTS idx_communications_usuario;
--   DROP INDEX IF EXISTS idx_communications_oportunidade;
--   DROP INDEX IF EXISTS idx_timeline_events_organizacao;
--   DROP INDEX IF EXISTS idx_timeline_events_aquisicao;
--   DROP INDEX IF EXISTS idx_atividades_negocio;

CREATE INDEX IF NOT EXISTS idx_status_changes_lead ON status_changes (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_changes_negocio ON status_changes (negocio_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_communications_usuario ON communications (usuario_id);
CREATE INDEX IF NOT EXISTS idx_communications_oportunidade ON communications (oportunidade_id);

CREATE INDEX IF NOT EXISTS idx_timeline_events_organizacao ON timeline_events (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_aquisicao ON timeline_events (aquisicao_id);

CREATE INDEX IF NOT EXISTS idx_atividades_negocio ON atividades (negocio_id);
