-- CARGA DA VIRADA · passo 01 — roda no banco recém-restaurado do dump de
-- produção, ANTES da cadeia de migrações de dev.
--
-- Por que existe: `stripe_webhook_events` foi criada à mão em produção com um
-- formato diferente do que a migration 0021 declara. Como 0021 usa
-- `CREATE TABLE IF NOT EXISTS`, ela pula a criação e logo em seguida tenta
-- `CREATE UNIQUE INDEX ... (event_id)` — coluna que não existe lá. A cadeia
-- morre em 0021 com `column "event_id" does not exist`. Foi isso que quebrou o
-- deploy da Fila de Cobrança.
--
-- O que este arquivo faz: converge a tabela vinda do dump para o formato de
-- `schema.ts` SEM perder as linhas já gravadas. É idempotente; se a tabela não
-- existir, é no-op e a 0021 cria a tabela do jeito certo.
--
-- NÃO entra em `migrations/` de propósito: o runner aplica migrations em ordem
-- de nome, e a correção precisa acontecer ANTES de 0021. Editar 0021 também não
-- serve: em dev ela já está registrada com hash, e o runner recusa rodar quando
-- um arquivo já aplicado muda de conteúdo.

DO $$
BEGIN
  IF to_regclass('public.stripe_webhook_events') IS NULL THEN
    RAISE NOTICE 'stripe_webhook_events não existe — nada a reconciliar (0021 vai criar).';
    RETURN;
  END IF;

  -- 1. stripe_event_id → event_id (preserva as 84 linhas e o índice único)
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='stripe_webhook_events'
                AND column_name='stripe_event_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='stripe_webhook_events'
                AND column_name='event_id') THEN
    ALTER TABLE stripe_webhook_events RENAME COLUMN stripe_event_id TO event_id;
  END IF;

  -- 2. colunas que schema.ts declara e a tabela manual não tem
  ALTER TABLE stripe_webhook_events
    ADD COLUMN IF NOT EXISTS organizacao_id uuid REFERENCES organizacoes(id),
    ADD COLUMN IF NOT EXISTS api_version    text,
    ADD COLUMN IF NOT EXISTS livemode       boolean,
    ADD COLUMN IF NOT EXISTS created_at     timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now();

  -- 3. status: prod grava MAIÚSCULO ('PENDING'), o código novo grava minúsculo.
  --    O CHECK antigo só aceita maiúsculo — mantê-lo faria todo insert novo
  --    estourar. Normaliza os dados, tira o CHECK e ajusta o default.
  ALTER TABLE stripe_webhook_events DROP CONSTRAINT IF EXISTS stripe_webhook_events_status_check;
  UPDATE stripe_webhook_events SET status = lower(status) WHERE status <> lower(status);
  ALTER TABLE stripe_webhook_events ALTER COLUMN status SET DEFAULT 'pending';

  -- 4. índices que 0021 espera pelo nome
  CREATE UNIQUE INDEX IF NOT EXISTS uq_stripe_webhook_events_event_id ON stripe_webhook_events (event_id);
  CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_org ON stripe_webhook_events (organizacao_id);
  CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received ON stripe_webhook_events (received_at);
END $$;

-- Diferenças aceitas de propósito (não convergem, e está tudo bem):
--   `processing_started_at` — coluna a mais em prod, nullable, ignorada pelo
--     código novo. Dropar seria destrutivo sem ganho.
--   `idx_stripe_webhook_events_status` — em prod é (status, received_at), em dev
--     é (status). O de prod é superconjunto e atende as mesmas consultas.
