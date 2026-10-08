-- O termo aditivo de DOWNGRADE tem texto próprio (redução de valores, multa por
-- redução de escopo, vigência pelo e-mail de desativação). Até aqui
-- downgrade/upgrade/aditivo caíam todos em ADITIVO, que é o texto de acréscimo.
-- Só amplia a lista permitida: nenhum template existente muda.
ALTER TABLE contrato_templates
  DROP CONSTRAINT IF EXISTS ck_contrato_templates_tipo_documento;
ALTER TABLE contrato_templates
  ADD CONSTRAINT ck_contrato_templates_tipo_documento
  CHECK (tipo_documento IN ('CONTRATO', 'ADITIVO', 'DOWNGRADE', 'RENOVACAO'));
