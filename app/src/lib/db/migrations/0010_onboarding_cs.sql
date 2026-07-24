-- Onboarding + CS (Onda 1): critério de conclusão real do onboarding +
-- gatilho automático pra conta de CS. Ver callface/onboarding-cs.md no vault.

CREATE TABLE IF NOT EXISTS "onboarding_checklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid REFERENCES "organizacoes"("id"),
	"negocio_id" uuid NOT NULL REFERENCES "negocios"("id") ON DELETE CASCADE,
	"item" text NOT NULL,
	"concluido_em" timestamp with time zone,
	"concluido_por" uuid REFERENCES "usuarios"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_onboarding_checklist_negocio_item" ON "onboarding_checklist" ("negocio_id", "item");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_onboarding_checklist_negocio" ON "onboarding_checklist" ("negocio_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "contas_cs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid REFERENCES "organizacoes"("id"),
	"negocio_id" uuid NOT NULL REFERENCES "negocios"("id"),
	"contrato_id" uuid REFERENCES "contratos"("id"),
	"lead_id" uuid REFERENCES "leads"("id"),
	"onboarding_finalizado_em" timestamp with time zone NOT NULL,
	"health_score" integer DEFAULT 100 NOT NULL,
	"health_score_atualizado_em" timestamp with time zone,
	"status_saude" text DEFAULT 'saudavel' NOT NULL,
	"proximo_marco_em" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_contas_cs_negocio" ON "contas_cs" ("negocio_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contas_cs_org" ON "contas_cs" ("organizacao_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contas_cs_status_saude" ON "contas_cs" ("status_saude");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "marcos_cs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conta_cs_id" uuid NOT NULL REFERENCES "contas_cs"("id") ON DELETE CASCADE,
	"previsto_para" timestamp with time zone NOT NULL,
	"realizado_em" timestamp with time zone,
	"resultado_texto" text,
	"sinal" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_marcos_cs_conta" ON "marcos_cs" ("conta_cs_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_marcos_cs_previsto" ON "marcos_cs" ("previsto_para");
