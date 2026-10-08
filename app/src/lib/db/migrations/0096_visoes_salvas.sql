-- Visões salvas das listas (hoje: Contatos & Empresas).
--
-- O botão "Salvar visão" guardava a visão só no estado da tela: sumia ao
-- recarregar e não existia para o próprio usuário em outro navegador. Cada
-- visão é do usuário (`usuario_id`) e da tela (`tela`); `config` guarda busca,
-- filtros, aba e visão exatamente como a lista os monta.
--
-- Aditiva e idempotente: tabela nova, nenhuma linha existente tocada.

CREATE TABLE IF NOT EXISTS visoes_salvas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  usuario_id     uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tela           text NOT NULL,
  nome           text NOT NULL,
  config         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visoes_salvas_usuario_tela
  ON visoes_salvas (organizacao_id, usuario_id, tela);
