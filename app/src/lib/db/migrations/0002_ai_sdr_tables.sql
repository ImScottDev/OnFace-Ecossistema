-- AI SDR Config (per-org)
CREATE TABLE IF NOT EXISTS "ai_sdr_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizacao_id" uuid NOT NULL REFERENCES "organizacoes"("id"),
  "ativo" boolean NOT NULL DEFAULT false,
  "groq_api_key" text,
  "modelo" text NOT NULL DEFAULT 'llama-3.3-70b-versatile',
  "system_prompt" text,
  "nome_assistente" text NOT NULL DEFAULT 'Assistente',
  "idioma_resposta" text NOT NULL DEFAULT 'pt-BR',
  "horario_comercial" jsonb,
  "fora_horario_msg" text,
  "max_tokens_resposta" integer NOT NULL DEFAULT 300,
  "temperatura_modelo" text NOT NULL DEFAULT '0.3',
  "handoff_triggers" jsonb,
  "stage_config" jsonb,
  "style_guide" text,
  "knowledge_base" text,
  "rate_limit_msgs" integer NOT NULL DEFAULT 10,
  "rate_limit_window_min" integer NOT NULL DEFAULT 60,
  "delay_min_ms" integer NOT NULL DEFAULT 2000,
  "delay_max_ms" integer NOT NULL DEFAULT 5000,
  "debounce_ms" integer NOT NULL DEFAULT 5000,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ai_sdr_config_org" ON "ai_sdr_config" ("organizacao_id");

-- AI SDR Contato State (per-contact AI state)
CREATE TABLE IF NOT EXISTS "ai_sdr_contato_state" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "contato_id" uuid NOT NULL REFERENCES "contatos"("id") ON DELETE CASCADE,
  "organizacao_id" uuid NOT NULL REFERENCES "organizacoes"("id"),
  "ai_ativo" boolean NOT NULL DEFAULT true,
  "handoff_at" timestamptz,
  "handoff_motivo" text,
  "handoff_usuario_id" uuid REFERENCES "usuarios"("id"),
  "ultima_ai_msg_at" timestamptz,
  "ai_msgs_na_janela" integer NOT NULL DEFAULT 0,
  "janela_reset_at" timestamptz,
  "qualificacao_extraida" jsonb,
  "conversation_summary" text,
  "intent_detectado" text,
  "confianca" numeric(3,2),
  "total_tokens_usados" integer NOT NULL DEFAULT 0,
  "total_msgs_ai" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ai_sdr_contato_state_contato" ON "ai_sdr_contato_state" ("contato_id");
CREATE INDEX IF NOT EXISTS "idx_ai_sdr_contato_state_org" ON "ai_sdr_contato_state" ("organizacao_id");

-- AI SDR Logs (audit trail)
CREATE TABLE IF NOT EXISTS "ai_sdr_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizacao_id" uuid NOT NULL REFERENCES "organizacoes"("id"),
  "contato_id" uuid,
  "lead_id" uuid,
  "tipo" text NOT NULL,
  "input_content" text,
  "output_content" text,
  "intent_detectado" text,
  "confianca" numeric(3,2),
  "dados_extraidos" jsonb,
  "decisao" text,
  "motivo" text,
  "tokens_input" integer,
  "tokens_output" integer,
  "latencia_ms" integer,
  "modelo_usado" text,
  "erro" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_ai_sdr_logs_org" ON "ai_sdr_logs" ("organizacao_id");
CREATE INDEX IF NOT EXISTS "idx_ai_sdr_logs_contato" ON "ai_sdr_logs" ("contato_id");
CREATE INDEX IF NOT EXISTS "idx_ai_sdr_logs_tipo" ON "ai_sdr_logs" ("tipo");
CREATE INDEX IF NOT EXISTS "idx_ai_sdr_logs_created" ON "ai_sdr_logs" ("created_at");
