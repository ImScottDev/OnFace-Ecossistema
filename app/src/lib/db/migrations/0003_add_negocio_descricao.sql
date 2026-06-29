-- Add descricao field to negocios for project description from site form
ALTER TABLE "negocios" ADD COLUMN IF NOT EXISTS "descricao" text;
