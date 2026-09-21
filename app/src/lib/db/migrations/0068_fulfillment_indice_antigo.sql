-- Remove o índice único antigo de fulfillments (correção da 0066).
--
-- A 0066 criou `uq_fulfillment_ciclo (servico_canonico_id, tipo, cycle_number)`
-- para permitir várias jornadas por serviço, como o SPEC §18.1 exige, mas NÃO
-- removeu o `idx_fulfillments_servico`, que é UNIQUE em `servico_canonico_id`
-- sozinho. Com os dois vivos, o antigo continuava mandando: o serviço aceitava
-- onboarding OU implantação, nunca os dois.
--
-- Encontrado pelo smoke do caminho de ganho: PABX criou 1 jornada em vez de 2.
--
-- O índice volta como NÃO único, porque a busca por serviço continua valendo;
-- o que sai é só a exclusividade.

BEGIN;

DROP INDEX IF EXISTS idx_fulfillments_servico;
CREATE INDEX IF NOT EXISTS idx_fulfillments_servico ON fulfillments (servico_canonico_id);

COMMIT;
