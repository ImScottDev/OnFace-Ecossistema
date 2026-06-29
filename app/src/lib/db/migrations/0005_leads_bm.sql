-- 0005: Leads BM (Biblioteca de Anúncios) support
-- Adds necessidades_constatadas to negocios and ensures servicos_catalogo has all columns

-- Add necessidades_constatadas to negocios
ALTER TABLE "negocios" ADD COLUMN IF NOT EXISTS "necessidades_constatadas" text[];

-- Ensure servicos_catalogo has valor_sugerido, unidade, ordem columns
-- (migration 0004 created the table with valor_unitario instead of valor_sugerido)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'servicos_catalogo' AND column_name = 'valor_sugerido') THEN
    ALTER TABLE "servicos_catalogo" ADD COLUMN "valor_sugerido" numeric(12, 2) DEFAULT '0';
    -- Migrate data from valor_unitario if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'servicos_catalogo' AND column_name = 'valor_unitario') THEN
      UPDATE "servicos_catalogo" SET "valor_sugerido" = "valor_unitario";
    END IF;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'servicos_catalogo' AND column_name = 'unidade') THEN
    ALTER TABLE "servicos_catalogo" ADD COLUMN "unidade" text DEFAULT 'mensal' NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'servicos_catalogo' AND column_name = 'ordem') THEN
    ALTER TABLE "servicos_catalogo" ADD COLUMN "ordem" integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_servicos_catalogo_org" ON "servicos_catalogo" ("organizacao_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_servicos_catalogo_ativo" ON "servicos_catalogo" ("organizacao_id", "ativo");
