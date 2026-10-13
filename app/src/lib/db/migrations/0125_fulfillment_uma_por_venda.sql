-- 0125 — Uma entrega por VENDA (oportunidade), não por item vendido.
--
-- Decisão do dono: "uma venda de três itens é um único onboard". Até aqui `criarFulfillmentsParaServicos`
-- criava um fulfillment por serviço canônico: Callface AI com 2 itens recorrentes + 1 setup = 3 jornadas.
--
-- O que muda no modelo:
--  - `fulfillments.oportunidade_id`: a venda que originou a entrega (NULL = entrega antiga ou sem venda).
--  - `fulfillments.fulfillment_anterior_id`: upgrade/upsell. A entrega anterior do MESMO cliente e da MESMA
--    família cujas etapas concluídas esta não repete.
--  - `fulfillments.etapas_herdadas`: as etapas (workstream + título) que NÃO foram recriadas por já terem
--    sido cumpridas na entrega anterior. Fica registrado, não some.
--  - `fulfillment_servicos`: todos os serviços canônicos que a entrega cobre. `fulfillments.servico_canonico_id`
--    segue sendo o serviço PRINCIPAL (o primeiro), para que toda leitura existente continue funcionando.
--
-- Não apaga nem altera entrega existente. O histórico não é consolidado aqui (backfill separado, com dry-run).
-- Aditiva e idempotente.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS fulfillment_servicos;
--   ALTER TABLE fulfillments DROP COLUMN IF EXISTS etapas_herdadas, DROP COLUMN IF EXISTS fulfillment_anterior_id,
--     DROP COLUMN IF EXISTS oportunidade_id;

ALTER TABLE fulfillments ADD COLUMN IF NOT EXISTS oportunidade_id uuid REFERENCES oportunidades(id);
ALTER TABLE fulfillments ADD COLUMN IF NOT EXISTS fulfillment_anterior_id uuid REFERENCES fulfillments(id);
ALTER TABLE fulfillments ADD COLUMN IF NOT EXISTS etapas_herdadas jsonb;

CREATE INDEX IF NOT EXISTS idx_fulfillments_oportunidade ON fulfillments (oportunidade_id) WHERE oportunidade_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS fulfillment_servicos (
  fulfillment_id      uuid NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
  servico_canonico_id uuid NOT NULL REFERENCES servicos_canonicos(id) ON DELETE CASCADE,
  organizacao_id      uuid NOT NULL REFERENCES organizacoes(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fulfillment_id, servico_canonico_id)
);
CREATE INDEX IF NOT EXISTS idx_fulfillment_servicos_servico ON fulfillment_servicos (servico_canonico_id);

-- Trava de idempotência da venda: uma entrega por (oportunidade, família, tipo, ciclo). Linhas antigas têm
-- oportunidade_id NULL e ficam fora do índice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fulfillment_venda
  ON fulfillments (oportunidade_id, service_family, tipo, cycle_number)
  WHERE oportunidade_id IS NOT NULL;
