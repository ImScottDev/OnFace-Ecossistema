-- Cadência SDR — execuções por lead+toque (13 toques da régua inbound)
-- Unique (lead_id, ordem): reenviar sobrescreve (upsert).
CREATE TABLE IF NOT EXISTS "cadencia_execucoes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizacao_id" uuid NOT NULL REFERENCES "organizacoes"("id"),
  "lead_id" uuid NOT NULL REFERENCES "leads"("id"),
  "ordem" integer NOT NULL,
  "canal" text NOT NULL,
  "status" text NOT NULL DEFAULT 'enviado',
  "enviado_por_id" uuid REFERENCES "usuarios"("id"),
  "sessao_id" uuid REFERENCES "whatsapp_sessao"("id"),
  "conteudo_enviado" text,
  "enviado_em" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_cadencia_lead_ordem" ON "cadencia_execucoes" ("lead_id", "ordem");
CREATE INDEX IF NOT EXISTS "idx_cadencia_org" ON "cadencia_execucoes" ("organizacao_id");
CREATE INDEX IF NOT EXISTS "idx_cadencia_lead" ON "cadencia_execucoes" ("lead_id");
