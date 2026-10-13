-- 0106 — Catálogo: desativa os 15 produtos 'prod_VM7m…' (test mode do Stripe)
--
-- Aditiva e idempotente; nada é apagado. Esses 15 `servicos_catalogo` com
-- origem 'oficial_stripe' não existem na conta live, têm 0 Prices ativos e
-- duplicavam o nome dos produtos reais na lista de proposta.
--
-- 1. REAPONTA os itens de proposta que ainda apontavam para eles. Eram 3
--    (todos "PABX - BINA Inteligente", propostas 0bedcca0…, 9e11d459…,
--    74adda68…; itens 7388e585…, 90928e42…, 6fc979db…), ligados a Prices
--    inativos de test mode. Cada um passa ao Price LIVE do produto de mesmo
--    nome e mesmo valor (BINA 1000 e 3000 Minutos), sem mudar valor nem total.
-- 2. DESATIVA os produtos e seus Prices (soft: ativo = false).

UPDATE proposta_itens pi
   SET servico_catalogo_id = vivo_sc.id,
       catalogo_preco_id   = vivo_cp.id,
       stripe_product_id   = vivo_sc.stripe_product_id,
       stripe_price_id     = vivo_cp.stripe_price_id,
       sku_preco           = COALESCE(vivo_cp.sku, pi.sku_preco)
  FROM servicos_catalogo teste_sc, catalogo_precos teste_cp,
       servicos_catalogo vivo_sc, catalogo_precos vivo_cp
 WHERE teste_sc.id = pi.servico_catalogo_id
   AND teste_sc.stripe_product_id LIKE 'prod\_VM7m%'
   AND teste_cp.id = pi.catalogo_preco_id
   AND vivo_sc.organizacao_id = teste_sc.organizacao_id
   AND vivo_sc.nome = teste_sc.nome
   AND vivo_sc.stripe_product_id NOT LIKE 'prod\_VM7m%'
   AND vivo_sc.ativo = true
   AND vivo_cp.servico_catalogo_id = vivo_sc.id
   AND vivo_cp.ativo = true
   AND vivo_cp.valor = teste_cp.valor
   -- só reaponta quando o par é inequívoco
   AND (SELECT count(*) FROM catalogo_precos x
         WHERE x.servico_catalogo_id = vivo_sc.id AND x.ativo = true AND x.valor = teste_cp.valor) = 1;

UPDATE catalogo_precos cp
   SET ativo = false, updated_at = now()
  FROM servicos_catalogo sc
 WHERE sc.id = cp.servico_catalogo_id
   AND sc.stripe_product_id LIKE 'prod\_VM7m%'
   AND cp.ativo = true;

UPDATE servicos_catalogo
   SET ativo = false
 WHERE stripe_product_id LIKE 'prod\_VM7m%'
   AND ativo = true;
