-- Commercial Core (Oportunidade -> Won -> Serviço Canônico) — fechamento
-- ponta a ponta pedido pelo Kauã (16/08). Ver ADR-EXEC-020 em
-- ARCHITECTURE_DECISIONS.md.
--
-- service_family em servicos_catalogo é a peça que faltava pra composição
-- comercial (oportunidade_itens) nunca precisar inferir família por nome de
-- produto: cada item do catálogo DECLARA sua família, exatamente como já
-- fazia com requer_contrato (0010). Sem string-match em runtime.

ALTER TABLE servicos_catalogo
  ADD COLUMN IF NOT EXISTS service_family text;

-- Backfill dos itens já categorizados (0010) — mapeamento 1:1 direto da
-- categoria livre existente, não invenção de regra nova.
UPDATE servicos_catalogo SET service_family = 'CALLFACE_AI'
  WHERE categoria = 'callface_ai' AND service_family IS NULL;
UPDATE servicos_catalogo SET service_family = 'PABX'
  WHERE categoria = 'pabx' AND service_family IS NULL;
UPDATE servicos_catalogo SET service_family = 'UNKNOWN'
  WHERE service_family IS NULL;

ALTER TABLE servicos_catalogo
  ALTER COLUMN service_family SET NOT NULL,
  ALTER COLUMN service_family SET DEFAULT 'UNKNOWN';

-- Item de catálogo White Label pra fechar o Commercial Core ponta a ponta —
-- não existia nenhum ativo (achado real: só PABX/Callface AI categorizados).
-- requer_contrato=true por padrão (mesmo tratamento de PABX: reseller com
-- compromisso de infra, não é self-serve) — decisão de negócio a confirmar
-- com o Kauã, registrada em crm2-decisoes-pendentes.md; reversível sem
-- mexer em código, só no dado do catálogo.
INSERT INTO servicos_catalogo (organizacao_id, nome, descricao, tipo, categoria, service_family, requer_contrato, unidade, ativo, ordem)
SELECT o.id, 'White Label - Licença Mensal', 'Licença mensal White Label (reseller)', 'recorrente', 'white_label', 'WHITE_LABEL', true, 'mensal', true, 100
FROM organizacoes o
WHERE NOT EXISTS (SELECT 1 FROM servicos_catalogo sc WHERE sc.organizacao_id = o.id AND sc.categoria = 'white_label' AND sc.tipo = 'recorrente');

INSERT INTO servicos_catalogo (organizacao_id, nome, descricao, tipo, categoria, service_family, requer_contrato, unidade, ativo, ordem)
SELECT o.id, 'White Label - Setup Inicial', 'Setup/onboarding White Label (cobrança única)', 'setup', 'white_label', 'WHITE_LABEL', true, 'projeto', true, 101
FROM organizacoes o
WHERE NOT EXISTS (SELECT 1 FROM servicos_catalogo sc WHERE sc.organizacao_id = o.id AND sc.categoria = 'white_label' AND sc.tipo = 'setup');
