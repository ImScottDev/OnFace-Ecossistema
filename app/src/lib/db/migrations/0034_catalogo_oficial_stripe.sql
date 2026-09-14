-- Catálogo Oficial Stripe -> CRM2.
--
-- Contexto: o catálogo oficial da Callface foi criado no Stripe em live mode
-- (21 Products, 213 Prices). O CRM não tinha onde receber isso:
-- `servicos_catalogo` modela 1 produto = 1 preço (`valor_sugerido` + um
-- `stripe_product_id`), e NÃO existia nenhuma tabela de preços no banco
-- (verificado: zero tabelas com "price" no nome).
--
-- Estado real do catálogo antes desta migration: 218 linhas, TODAS com
-- `service_family = 'UNKNOWN'`, só 7 ativas. Como o `GET /servicos-catalogo`
-- filtra UNKNOWN por padrão, o builder de proposta exibia ZERO produtos —
-- o vendedor só via algo clicando em "ver outros produtos", que despeja as
-- 218 linhas históricas do Zoho.
--
-- Nada de legado é apagado, arquivado ou reclassificado aqui (regra 9 do
-- briefing). As 218 linhas continuam exatamente como estão; o que muda é que
-- elas passam a ser distinguíveis do catálogo oficial por `origem_catalogo`.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. servicos_catalogo = PRODUTO (nível Stripe Product).
-- ─────────────────────────────────────────────────────────────────────────────
-- Separa catálogo oficial de legado sem tocar em nenhuma linha existente: o
-- default 'legado' descreve corretamente as 218 linhas que já estão lá.
ALTER TABLE servicos_catalogo ADD COLUMN IF NOT EXISTS origem_catalogo text NOT NULL DEFAULT 'legado'; -- oficial_stripe | legado
ALTER TABLE servicos_catalogo ADD COLUMN IF NOT EXISTS sku_produto text;
ALTER TABLE servicos_catalogo ADD COLUMN IF NOT EXISTS descricao_extrato text;      -- como aparece na fatura do cartão
ALTER TABLE servicos_catalogo ADD COLUMN IF NOT EXISTS etiqueta_unidade text;       -- "usuário", "licença ativa", "ramal", "unidade"
ALTER TABLE servicos_catalogo ADD COLUMN IF NOT EXISTS destino_pos_venda text;      -- onboarding_callface_ai | implantacao_pabx | implantacao_white_label
ALTER TABLE servicos_catalogo ADD COLUMN IF NOT EXISTS observacao_operacional text; -- o que o vendedor precisa saber ao vender
ALTER TABLE servicos_catalogo ADD COLUMN IF NOT EXISTS catalogo_sincronizado_em timestamptz;

-- Um stripe_product_id não pode representar dois produtos CRM (regra 3 do
-- briefing: "não criar um produto CRM separado para cada price"). Índice
-- parcial porque o legado tem 212 linhas com stripe_product_id NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_servicos_catalogo_stripe_product
  ON servicos_catalogo (organizacao_id, stripe_product_id)
  WHERE stripe_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_servicos_catalogo_origem
  ON servicos_catalogo (organizacao_id, origem_catalogo, service_family);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. catalogo_precos = PRICE / VARIAÇÃO (nível Stripe Price). Tabela nova.
--
-- Por que tabela nova e não mais colunas em servicos_catalogo: um produto tem
-- N prices de verdade (Callface AI Starter = mensal + anual; PABX Hardware =
-- 45 variações; White Label Setup/Licença = 4 faixas cada). Espremer isso em
-- `valor_sugerido` obrigaria a criar 213 "produtos" CRM, que é exatamente o
-- que a regra 3 proíbe.
--
-- `revenue_nature` fica AQUI e não só no produto por um motivo medido na
-- planilha: ela varia entre prices do MESMO produto. PABX Hardware tem 11
-- prices avulsos e 34 recorrentes; Callface AI - Minutos Extras tem price de
-- uso avulso e de uso recorrente. Natureza de receita só no produto seria
-- errada para metade do catálogo.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalogo_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  servico_catalogo_id uuid NOT NULL REFERENCES servicos_catalogo(id) ON DELETE CASCADE,

  stripe_price_id text NOT NULL,
  sku text,
  lookup_key text,                    -- CHAVE_DE_PESQUISA_PRICE: busca no builder e no Stripe

  variacao text NOT NULL,             -- "Mensal", "Anual", "Faixa 1 — 1 a 99 licenças", "Telefone Fanvil X3"
  descricao text,                     -- DESCRICAO_DO_PRICE
  valor numeric(12,2) NOT NULL,
  moeda text NOT NULL DEFAULT 'BRL',

  tipo text NOT NULL,                 -- recorrente | avulso | setup (mesmo enum de proposta_itens)
  recorrente boolean NOT NULL DEFAULT false,
  periodo text,                       -- mensal | anual | unico
  revenue_nature text NOT NULL,       -- MRR | SETUP | ONE_TIME | USAGE | HARDWARE
  modelo_cobranca text,               -- recorrencia_mensal | recorrencia_anual | avulso | avulso_ou_parcelavel
  modelo_preco_stripe text,           -- Tarifa fixa | Tarifa fixa por unidade

  -- Exigência de contrato POR PRICE, não por produto nem por família.
  -- Necessário por regra explícita do briefing (item 7): White Label Licença
  -- vendida isoladamente para cliente que já é White Label NÃO exige
  -- contrato, mas o Setup exige. A planilha já declara isso
  -- (exige_contrato = nao na Licença, sim no Setup).
  exige_contrato boolean NOT NULL DEFAULT false,

  observacao text,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Chave de idempotência do import: reimportar o mesmo price atualiza, nunca
-- duplica (regra 10 do briefing).
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogo_precos_stripe_price
  ON catalogo_precos (organizacao_id, stripe_price_id);
CREATE INDEX IF NOT EXISTS idx_catalogo_precos_produto ON catalogo_precos (servico_catalogo_id, ordem);
CREATE INDEX IF NOT EXISTS idx_catalogo_precos_lookup ON catalogo_precos (organizacao_id, lookup_key);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. proposta_itens: guardar QUAL price oficial foi vendido.
--
-- Regra 6 do briefing: desconto/valor negociado NUNCA cria produto nem price
-- novo. Por isso o item guarda, ao mesmo tempo, a referência oficial
-- (product/price/sku, imutável) e o que foi realmente negociado
-- (`valor_unitario` + `desconto`, que já existiam). `valor_tabela` preserva o
-- preço de tabela do momento da venda — sem ele não dá pra auditar depois o
-- desconto concedido, porque o preço oficial pode mudar no catálogo.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS catalogo_preco_id uuid REFERENCES catalogo_precos(id);
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS stripe_product_id text;
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS stripe_price_id text;
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS sku_preco text;
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS variacao text;
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS valor_tabela numeric(12,2);

CREATE INDEX IF NOT EXISTS idx_proposta_itens_stripe_price ON proposta_itens (stripe_price_id) WHERE stripe_price_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. oportunidade_itens: mesma rastreabilidade no modelo de domínio v2.
--
-- É `oportunidade_itens` que virou serviço canônico na 2C.1, e é dele que a
-- 2C.2 vai precisar ler o price pra montar a assinatura. Sem isso o vínculo
-- com o Stripe se perderia exatamente no ponto onde a cobrança nasce.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE oportunidade_itens ADD COLUMN IF NOT EXISTS catalogo_preco_id uuid REFERENCES catalogo_precos(id);
ALTER TABLE oportunidade_itens ADD COLUMN IF NOT EXISTS stripe_product_id text;
ALTER TABLE oportunidade_itens ADD COLUMN IF NOT EXISTS stripe_price_id text;
ALTER TABLE oportunidade_itens ADD COLUMN IF NOT EXISTS sku_preco text;
