#!/bin/bash
# Recupera servicos_canonicos.canonical_product dos servicos LEGADOS que ficaram
# sem produto depois do backfill do Stripe de 13/10/2026.
#
# Regra do Scott: assinatura no Stripe -> produto vem do Stripe (nao mexe aqui);
# legado (PABX, Zoho, ledger/Spedy) -> produto vem do HISTORICO do legado; nulo
# so quando o nome nao existe em lugar nenhum.
#
# Uso:  scripts/produto-legado-20261013.sh --simular   (padrao: mostra o plano e da ROLLBACK)
#       scripts/produto-legado-20261013.sh --aplicar   (grava e da COMMIT)
#
# Seguranca: uma transacao, ON_ERROR_STOP=1. So toca linha com canonical_product
# NULO, sem assinatura Stripe (billing_source <> 'STRIPE' e current_subscription_id
# nulo) -> nunca sobrescreve os que vieram do Stripe nem valor posto por pessoa.
# Idempotente: depois de aplicado, nada mais e nulo/elegivel, rodar de novo = 0 linhas.
# Backup: linha inteira (to_jsonb) em _produto_legado_20261013 ANTES do UPDATE.
#
# DE ONDE VEM O NOME, em ordem de confianca (a primeira origem que tiver nome vale):
#  1 CONTRATO_ITENS_PROPRIO   contrato_itens do contrato ligado ao proprio servico
#                             (servicos_canonicos.contrato_id). Itens recorrentes (MRR
#                             ou sem natureza), da mesma familia, sem desconto: e o que
#                             foi contratado, itemizado (no legado vem do catalogo Zoho).
#  2 CONTRATO_SERVICOS_PROPRIO contratos.servicos (lista de produtos da proposta que
#                             gerou o contrato do pos-venda). Mesmo contrato, mesma
#                             nomenclatura do catalogo; so perde a quantidade.
#  3 CONTRATO_TIPO_PROPRIO    contratos.tipo quando e um nome de produto (nao um rotulo
#                             generico como 'assinatura' ou 'PABX').
#  4 EMPRESA_ITENS            itens dos contratos LEGADOS da mesma empresa e da mesma
#  5 EMPRESA_SERVICOS         familia (servicos do ledger/Marco Zero nao tem contrato_id;
#  6 EMPRESA_TIPO             o elo e a empresa, via contratos.empresa_id ou lead). Menos
#                             certo que 1-3 porque o vinculo e por empresa, nao por
#                             servico; por isso a familia tem de bater.
#  Sem nenhuma das seis: continua nulo (o nome nao existe no banco).
# Fora do nome: setup, desconto e EQUIPAMENTO fisico (telefone, headset, aparelho,
# gateway, fanvil). O legado marca aparelho como recorrente, mas isso e contabilidade,
# nao produto. Se so sobrar equipamento, o servico volta a nulo (nulo honesto).
# ATENCAO: o legado usa 'CallPilot' e o Stripe usa 'Callface Copilot'. Pode ser o mesmo
# produto renomeado, mas NAO ha confirmacao: o nome do legado foi mantido como esta.
# Decisao do Scott com quem conhece o historico comercial.
# Formato: nomes distintos, ordem alfabetica, unidos por ' + ' (igual aos do Stripe).
set -euo pipefail
FIM=ROLLBACK; [ "${1:---simular}" = "--aplicar" ] && FIM=COMMIT
[ "${1:---simular}" != "--simular" ] && [ "${1:-}" != "--aplicar" ] && { echo "use --simular ou --aplicar"; exit 2; }
ssh -i "$HOME/.ssh/infra_callface.pem" ubuntu@34.204.200.52 \
  "docker exec -i callface-crm2-dev-postgres psql -U callface -d callface_crm_mz -X -v ON_ERROR_STOP=1" <<SQL
BEGIN;
CREATE TABLE IF NOT EXISTS _produto_legado_20261013 (
  n bigserial PRIMARY KEY, servico_id uuid, linha jsonb, origem text, produto_novo text,
  feito_em timestamptz NOT NULL DEFAULT now());

-- elo empresa -> contrato legado, calculado uma vez (empresa direta ou via lead)
CREATE TEMP TABLE emp_contrato ON COMMIT DROP AS
SELECT DISTINCT empresa_id, contrato_id FROM (
  SELECT c.empresa_id, c.id AS contrato_id FROM contratos c WHERE c.empresa_id IS NOT NULL
  UNION ALL
  SELECT l.empresa_id, c.id FROM contratos c JOIN leads l ON l.id = c.lead_id WHERE l.empresa_id IS NOT NULL) x;
CREATE INDEX ON emp_contrato (empresa_id);

-- nomes candidatos por servico e origem
CREATE TEMP TABLE cand ON COMMIT DROP AS
WITH alvo AS (
  SELECT id, organizacao_id, empresa_id, contrato_id, service_family
    FROM servicos_canonicos
   WHERE canonical_product IS NULL AND billing_source <> 'STRIPE' AND current_subscription_id IS NULL
), nomes AS (
  -- (servico, origem, ordem de confianca, nome limpo)
  SELECT a.id, 'CONTRATO_ITENS_PROPRIO' o, 1 p, btrim(regexp_replace(i.nome,'\s+',' ','g')) nome
    FROM alvo a JOIN contrato_itens i ON i.contrato_id = a.contrato_id
   WHERE coalesce(i.revenue_nature,'MRR') = 'MRR' AND coalesce(i.service_family,a.service_family) = a.service_family
  UNION ALL
  SELECT a.id, 'CONTRATO_SERVICOS_PROPRIO', 2, btrim(regexp_replace(s,'\s+',' ','g'))
    FROM alvo a JOIN contratos c ON c.id = a.contrato_id, unnest(c.servicos) s
  UNION ALL
  SELECT a.id, 'CONTRATO_TIPO_PROPRIO', 3, btrim(c.tipo)
    FROM alvo a JOIN contratos c ON c.id = a.contrato_id
  UNION ALL
  SELECT a.id, 'EMPRESA_ITENS', 4, btrim(regexp_replace(i.nome,'\s+',' ','g'))
    FROM alvo a
    JOIN emp_contrato ec ON ec.empresa_id = a.empresa_id
    JOIN contrato_itens i ON i.contrato_id = ec.contrato_id
   WHERE coalesce(i.revenue_nature,'MRR') = 'MRR'
     AND coalesce(i.service_family,a.service_family) = a.service_family
  UNION ALL
  SELECT a.id, 'EMPRESA_SERVICOS', 5, btrim(regexp_replace(s,'\s+',' ','g'))
    FROM alvo a
    JOIN emp_contrato ec ON ec.empresa_id = a.empresa_id
    JOIN contratos c ON c.id = ec.contrato_id AND c.service_family = a.service_family, unnest(c.servicos) s
  UNION ALL
  SELECT a.id, 'EMPRESA_TIPO', 6, btrim(c.tipo)
    FROM alvo a
    JOIN emp_contrato ec ON ec.empresa_id = a.empresa_id
    JOIN contratos c ON c.id = ec.contrato_id AND c.service_family = a.service_family
)
SELECT id, o, p, nome FROM nomes
 WHERE nome <> '' AND nome !~* '(setup|desconto|telefone|headset|aparelho|gateway|fanvil)'
   AND (o NOT LIKE '%TIPO%' OR lower(nome) NOT IN ('assinatura','servico','multi_service','legado_zoho','pabx','callface_ai','white_label'));

-- plano: a origem de melhor confianca que tiver nome; nomes distintos unidos por ' + '
CREATE TEMP TABLE plano ON COMMIT DROP AS
SELECT id, o AS origem, string_agg(DISTINCT nome, ' + ' ORDER BY nome) AS produto
  FROM (SELECT *, min(p) OVER (PARTITION BY id) pmin FROM cand) x
 WHERE p = pmin
 GROUP BY id, o;

\echo '== quantos ganham nome, por origem'
SELECT origem, count(*) FROM plano GROUP BY 1 ORDER BY 1;
\echo '== por familia (sem nome apos o plano)'
SELECT s.service_family, s.billing_source, count(*) FILTER (WHERE p.id IS NOT NULL) ganha, count(*) FILTER (WHERE p.id IS NULL) continua_nulo
  FROM servicos_canonicos s LEFT JOIN plano p ON p.id = s.id
 WHERE s.canonical_product IS NULL AND s.billing_source <> 'STRIPE' AND s.current_subscription_id IS NULL
 GROUP BY 1,2 ORDER BY 1,2;
\echo '== amostra antes -> depois'
SELECT s.service_family, s.billing_source, p.origem, s.canonical_product AS antes, p.produto AS depois
  FROM plano p JOIN servicos_canonicos s ON s.id = p.id ORDER BY random() LIMIT 10;

INSERT INTO _produto_legado_20261013 (servico_id, linha, origem, produto_novo)
SELECT s.id, to_jsonb(s), p.origem, p.produto FROM servicos_canonicos s JOIN plano p ON p.id = s.id;
UPDATE servicos_canonicos s
   SET canonical_product = p.produto, updated_at = now()
  FROM plano p
 WHERE p.id = s.id AND s.canonical_product IS NULL;
${FIM};
SQL
