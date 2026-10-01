-- Contrato, aditivo e renovação convivem na MESMA família de serviço. Até
-- aqui só existia service_family (produto), então dois templates PABX ativos
-- colidiam: escolherTemplate pegava o primeiro que casasse, arbitrário.
-- Default CONTRATO preserva o comportamento de todo template já cadastrado.
ALTER TABLE contrato_templates
  ADD COLUMN IF NOT EXISTS tipo_documento text NOT NULL DEFAULT 'CONTRATO';

ALTER TABLE contrato_templates
  DROP CONSTRAINT IF EXISTS ck_contrato_templates_tipo_documento;
ALTER TABLE contrato_templates
  ADD CONSTRAINT ck_contrato_templates_tipo_documento
  CHECK (tipo_documento IN ('CONTRATO', 'ADITIVO', 'RENOVACAO'));

DROP INDEX IF EXISTS idx_contrato_templates_family;
CREATE INDEX IF NOT EXISTS idx_contrato_templates_family
  ON contrato_templates (organizacao_id, tipo_documento, service_family, ativo);
