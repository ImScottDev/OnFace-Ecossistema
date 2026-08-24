-- CRM2 financial foundation: Stripe event inbox + subscription item storage.
-- Additive and idempotent. No provider call and no data backfill is performed here.

CREATE TABLE IF NOT EXISTS assinatura_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  assinatura_id uuid NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
  stripe_subscription_item_id text,
  stripe_product_id text,
  stripe_price_id text,
  produto text,
  quantidade integer NOT NULL DEFAULT 1,
  preco_unitario numeric(12,2),
  moeda text NOT NULL DEFAULT 'BRL',
  recurring_interval text,
  service_family text NOT NULL DEFAULT 'UNKNOWN',
  revenue_nature text,
  servico_canonico_id uuid REFERENCES servicos_canonicos(id),
  desconto_percentual numeric(5,2),
  proration_behavior text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  status text,
  raw jsonb,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assinatura_itens_stripe_id
  ON assinatura_itens (stripe_subscription_item_id)
  WHERE stripe_subscription_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assinatura_itens_assinatura
  ON assinatura_itens (assinatura_id);
CREATE INDEX IF NOT EXISTS idx_assinatura_itens_org
  ON assinatura_itens (organizacao_id);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  organizacao_id uuid REFERENCES organizacoes(id),
  event_type text NOT NULL,
  api_version text,
  livemode boolean,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stripe_webhook_events_event_id
  ON stripe_webhook_events (event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
  ON stripe_webhook_events (status);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_org
  ON stripe_webhook_events (organizacao_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received
  ON stripe_webhook_events (received_at);
