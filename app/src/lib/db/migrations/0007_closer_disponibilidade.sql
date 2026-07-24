-- Agenda nativa das closers (sem Calendly/Outlook por enquanto).
-- closer_disponibilidade: 1 linha por closer, horário de trabalho recorrente + pausa de almoço.
-- closer_bloqueios: bloqueios pontuais (folga, compromisso externo, férias), não recorrentes.
CREATE TABLE IF NOT EXISTS "closer_disponibilidade" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizacao_id" uuid NOT NULL REFERENCES "organizacoes"("id"),
  "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id"),
  "horario_trabalho" jsonb NOT NULL,
  "pausa_almoco" jsonb,
  "ativo" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_closer_disponibilidade_usuario" ON "closer_disponibilidade" ("usuario_id");
CREATE INDEX IF NOT EXISTS "idx_closer_disponibilidade_org" ON "closer_disponibilidade" ("organizacao_id");

CREATE TABLE IF NOT EXISTS "closer_bloqueios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizacao_id" uuid NOT NULL REFERENCES "organizacoes"("id"),
  "usuario_id" uuid NOT NULL REFERENCES "usuarios"("id"),
  "inicio" timestamptz NOT NULL,
  "fim" timestamptz NOT NULL,
  "motivo" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_closer_bloqueios_usuario" ON "closer_bloqueios" ("usuario_id");
CREATE INDEX IF NOT EXISTS "idx_closer_bloqueios_org" ON "closer_bloqueios" ("organizacao_id");
