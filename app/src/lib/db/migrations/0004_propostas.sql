-- Servicos Catalogo (dependency for proposta_itens)
CREATE TABLE IF NOT EXISTS "servicos_catalogo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL REFERENCES "organizacoes"("id"),
	"nome" text NOT NULL,
	"descricao" text,
	"tipo" text NOT NULL,
	"moeda" text DEFAULT 'BRL' NOT NULL,
	"valor_unitario" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Contratos (dependency for propostas)
CREATE TABLE IF NOT EXISTS "contratos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL REFERENCES "organizacoes"("id"),
	"lead_id" uuid NOT NULL REFERENCES "leads"("id"),
	"negocio_id" uuid REFERENCES "negocios"("id"),
	"numero" integer NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"data_inicio" date,
	"data_fim" date,
	"valor_mensal" numeric(12, 2) DEFAULT '0',
	"valor_total" numeric(12, 2) DEFAULT '0',
	"observacoes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Propostas
CREATE TABLE IF NOT EXISTS "propostas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL REFERENCES "organizacoes"("id"),
	"lead_id" uuid NOT NULL REFERENCES "leads"("id"),
	"negocio_id" uuid REFERENCES "negocios"("id"),
	"numero" integer NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"proposta_original_id" uuid,
	"moeda" text DEFAULT 'BRL' NOT NULL,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"data_emissao" date,
	"data_validade" date,
	"observacoes" text,
	"condicoes_pagamento" text,
	"total_recorrente" numeric(12, 2) DEFAULT '0',
	"total_avulso" numeric(12, 2) DEFAULT '0',
	"total_geral" numeric(12, 2) DEFAULT '0',
	"criado_por_id" uuid REFERENCES "usuarios"("id"),
	"contrato_id" uuid REFERENCES "contratos"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_propostas_org" ON "propostas" ("organizacao_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_propostas_lead" ON "propostas" ("lead_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_propostas_status" ON "propostas" ("organizacao_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_propostas_numero" ON "propostas" ("organizacao_id", "numero");
--> statement-breakpoint

-- Proposta Itens
CREATE TABLE IF NOT EXISTS "proposta_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposta_id" uuid NOT NULL REFERENCES "propostas"("id") ON DELETE CASCADE,
	"servico_catalogo_id" uuid REFERENCES "servicos_catalogo"("id"),
	"nome" text NOT NULL,
	"descricao" text,
	"tipo" text NOT NULL,
	"moeda" text DEFAULT 'BRL' NOT NULL,
	"quantidade" numeric(10, 2) DEFAULT '1' NOT NULL,
	"valor_unitario" numeric(12, 2) DEFAULT '0' NOT NULL,
	"desconto" numeric(5, 2) DEFAULT '0',
	"desconto_tipo" text DEFAULT 'percentual' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_proposta_itens_proposta" ON "proposta_itens" ("proposta_id");
