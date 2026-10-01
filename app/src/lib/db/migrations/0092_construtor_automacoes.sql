-- Construtor de Automações (Fluxos). Contrato: docs/design/construtor-automacoes.md §1.
-- Tudo aditivo: colunas novas, índices novos e dois NOT NULL relaxados
-- (execução agendada sem registro não tem entidade). Nenhuma linha é apagada
-- nem reescrita; as colunas do motor antigo de regras ficam intocadas.

-- automacoes: rascunho, pasta, webhook, agenda
ALTER TABLE automacoes ADD COLUMN IF NOT EXISTS rascunho            jsonb;
ALTER TABLE automacoes ADD COLUMN IF NOT EXISTS rascunho_salvo_em   timestamptz;
ALTER TABLE automacoes ADD COLUMN IF NOT EXISTS pasta               text;
ALTER TABLE automacoes ADD COLUMN IF NOT EXISTS webhook_token       text;
ALTER TABLE automacoes ADD COLUMN IF NOT EXISTS proxima_execucao_em timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS uq_automacoes_webhook_token ON automacoes (webhook_token) WHERE webhook_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automacoes_agenda ON automacoes (proxima_execucao_em) WHERE ativo AND tipo = 'fluxo';

-- execução: estado do cursor
ALTER TABLE automacao_execucoes ALTER COLUMN entity_type DROP NOT NULL;
ALTER TABLE automacao_execucoes ALTER COLUMN entity_id   DROP NOT NULL;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS modo            text;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS estado          jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS no_atual        text;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS retomar_em      timestamptz;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS claimed_until   timestamptz;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS profundidade    integer NOT NULL DEFAULT 0;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_automacao_execucoes_idem ON automacao_execucoes (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automacao_execucoes_devidas ON automacao_execucoes (retomar_em) WHERE status = 'aguardando';

-- passo: reserva antes do efeito externo + saída tomada
ALTER TABLE automacao_passos_execucao ADD COLUMN IF NOT EXISTS saida           text;
ALTER TABLE automacao_passos_execucao ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_automacao_passos_idem ON automacao_passos_execucao (idempotency_key) WHERE idempotency_key IS NOT NULL;
