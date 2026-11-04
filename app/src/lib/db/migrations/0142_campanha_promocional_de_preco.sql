-- Campanha PROMOCIONAL de preço (Black Friday 2026 e as próximas).
--
-- Nome longo de propósito: `campanhas` já existe e é campanha de MÍDIA
-- (plataforma, utm_campaign, investimento mensal). São coisas diferentes e
-- aparecem lado a lado na mesma venda — o lead vem de uma campanha de mídia e
-- compra sob uma campanha promocional.
--
-- O PROBLEMA: uma campanha promocional não tem onde morar hoje. As três saídas
-- óbvias são todas erradas:
--
--   1. Produto novo no Stripe ("Callface AI - Full Black") — o time libera
--      acesso do cliente pelo Product ID, então um produto novo quebra a
--      liberação e duplica o catálogo todo ano.
--   2. Price novo no produto oficial — vira "variação" vendável para sempre,
--      e em dezembro o vendedor continua vendo "Full Black" na lista.
--   3. Cupom do Stripe como mecanismo — o desconto da campanha não é
--      percentual redondo (149,90 sobre 199,90 = 25,01%), e cupom não aparece
--      na proposta, no PDF nem no contrato, só na fatura.
--
-- A campanha é preço de VENDA com prazo, e venda mora aqui, não no Stripe. O
-- Stripe continua recebendo exatamente o que já recebia: o Price oficial com a
-- diferença em cupom (Checkout Session) ou `price_data` sobre o mesmo Product
-- oficial (assinatura faturada). Nenhum Product ID ou Price ID muda.
--
-- `valor_ancora` existe porque a comunicação e a tabela podem divergir
-- legitimamente: em 04/11/2026 o Full de tabela é R$ 179,90 e sobe para
-- R$ 199,90 em 01/12, então a Black anuncia "de 199,90 por 149,90" enquanto o
-- preço vigente no catálogo ainda é 179,90. Sem esta coluna, ou a proposta
-- mente sobre a tabela ou a campanha mente sobre o desconto.
CREATE TABLE IF NOT EXISTS campanhas_promocionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL REFERENCES organizacoes(id),
  codigo text NOT NULL,
  nome text NOT NULL,
  -- Janela de vigência. Fora dela a oferta não é aplicável, e isso é checado
  -- no momento de gravar a linha da proposta, não só na tela.
  inicio timestamptz NOT NULL,
  fim timestamptz NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campanhas_promocionais_janela_valida CHECK (fim > inicio)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campanhas_promo_codigo ON campanhas_promocionais (organizacao_id, codigo);
CREATE INDEX IF NOT EXISTS idx_campanhas_promo_vigencia ON campanhas_promocionais (organizacao_id, ativo, inicio, fim);

-- Uma oferta é (campanha, price oficial, condição). A CONDIÇÃO entra na chave
-- porque o mesmo price pode ter dois preços na mesma campanha: o Full Black é
-- R$ 149,90 sem fidelidade e R$ 119,90 com contrato de 12 meses. Sem a
-- condição na chave, um dos dois não caberia.
CREATE TABLE IF NOT EXISTS campanhas_promocionais_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES campanhas_promocionais(id) ON DELETE CASCADE,
  catalogo_preco_id uuid NOT NULL REFERENCES catalogo_precos(id) ON DELETE CASCADE,
  -- "" = oferta sem condição extra. Texto, não enum: a condição é comercial e
  -- muda a cada campanha; um enum viraria migration a cada promoção.
  condicao text NOT NULL DEFAULT '',
  valor_promocional numeric(12,2) NOT NULL,
  -- Preço a EXIBIR como "de", quando a comunicação usa uma âncora diferente do
  -- preço de tabela vigente. NULL = usa o preço do catálogo, que é o normal.
  valor_ancora numeric(12,2),
  -- Bônus operacional que a oferta concede e que alguém precisa LIBERAR na
  -- mão depois (ex.: 'agente_ia_30d_100min'). Vai para a metadata do Stripe no
  -- fechamento, que é onde o time de ativação olha.
  bonus text,
  bonus_descricao text,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Promoção que sobe o preço é erro de digitação, não oferta.
  CONSTRAINT campanhas_promocionais_precos_valor_positivo CHECK (valor_promocional > 0),
  CONSTRAINT campanhas_promocionais_precos_ancora_positiva CHECK (valor_ancora IS NULL OR valor_ancora > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campanhas_promocionais_precos_oferta ON campanhas_promocionais_precos (campanha_id, catalogo_preco_id, condicao);
CREATE INDEX IF NOT EXISTS idx_campanhas_promocionais_precos_catalogo ON campanhas_promocionais_precos (catalogo_preco_id, ativo);

-- A linha da proposta registra de QUAL oferta ela nasceu. NULL = venda fora de
-- campanha, que é o caso de toda linha existente. É esta coluna que faz a
-- campanha ser auditável depois ("quanto a Black vendeu") sem depender de
-- adivinhar pelo valor.
ALTER TABLE proposta_itens ADD COLUMN IF NOT EXISTS campanha_promocional_preco_id uuid REFERENCES campanhas_promocionais_precos(id);
CREATE INDEX IF NOT EXISTS idx_proposta_itens_campanha_promo ON proposta_itens (campanha_promocional_preco_id);
