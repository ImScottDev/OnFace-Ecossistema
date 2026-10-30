-- A família ASSISTANT (Callface Assistant, lançada em 30/10/2026) não passava
-- pelas travas de família do banco: `servicos_canonicos` e
-- `service_ledger_entries` só aceitavam PABX, CALLFACE_AI, WHITE_LABEL e
-- UNKNOWN. A oportunidade e a proposta gravavam normalmente, mas a venda
-- quebraria no Ganho, ao materializar o serviço canônico — o ponto mais caro
-- possível para descobrir isso.
--
-- Idempotente: derruba a trava pelo nome e recria com o valor novo.
ALTER TABLE servicos_canonicos DROP CONSTRAINT IF EXISTS ck_servicos_canonicos_family;
ALTER TABLE servicos_canonicos ADD CONSTRAINT ck_servicos_canonicos_family
  CHECK (service_family = ANY (ARRAY['PABX', 'CALLFACE_AI', 'WHITE_LABEL', 'ASSISTANT', 'UNKNOWN']));

ALTER TABLE servicos_canonicos DROP CONSTRAINT IF EXISTS servicos_canonicos_service_family_check;
ALTER TABLE servicos_canonicos ADD CONSTRAINT servicos_canonicos_service_family_check
  CHECK (service_family = ANY (ARRAY['PABX', 'CALLFACE_AI', 'WHITE_LABEL', 'ASSISTANT', 'UNKNOWN']));

ALTER TABLE service_ledger_entries DROP CONSTRAINT IF EXISTS service_ledger_entries_service_family_check;
ALTER TABLE service_ledger_entries ADD CONSTRAINT service_ledger_entries_service_family_check
  CHECK (service_family = ANY (ARRAY['PABX', 'CALLFACE_AI', 'WHITE_LABEL', 'ASSISTANT', 'UNKNOWN']));
