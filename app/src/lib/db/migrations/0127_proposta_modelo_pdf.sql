-- 0127 — Modelo de PDF da proposta, escolhido por quem envia.
--
-- Aditiva e idempotente. NULL (todas as propostas que já existem) = o PDF de sempre ("padrao"):
-- nenhuma proposta muda de aparência sem alguém escolher. Valores: enxuto | completo | white_label.
-- Validação no servidor (lib/propostas/modelos-pdf.ts), sem CHECK, para um modelo novo não pedir migration.
--
-- ROLLBACK:
--   ALTER TABLE propostas DROP COLUMN IF EXISTS modelo_pdf;

ALTER TABLE propostas ADD COLUMN IF NOT EXISTS modelo_pdf text;
