-- CARGA DA VIRADA · passo 02 — roda no banco recém-restaurado do dump de
-- produção, ANTES da cadeia de migrações de dev.
--
-- Por que existe: a migration 0034 cria
--   CREATE UNIQUE INDEX idx_servicos_catalogo_stripe_product
--     ON servicos_catalogo (organizacao_id, stripe_product_id)
--     WHERE stripe_product_id IS NOT NULL;
-- e o dado real de produção viola isso. São 11 `stripe_product_id` apontados
-- por mais de uma linha de `servicos_catalogo` — 146 linhas no total, resquício
-- do catálogo PABX legado, onde vários itens de hardware foram amarrados a um
-- mesmo produto Stripe genérico. Em dev isso não aparece porque o banco local
-- já passou por limpeza de catálogo; o dump de prod não.
--
-- ⚠️  ESTE PASSO MEXE EM DADO. Ele NÃO apaga linha nenhuma: apenas desfaz o
-- vínculo Stripe errado (stripe_product_id := NULL), mantendo nome, preço,
-- família e histórico de todas as 146 linhas.
--
-- REGRA DE SOBREVIVÊNCIA — por que é assim:
--   A ordem natural (mais ativo, mais recente) só resolve 1 dos 11 grupos.
--   Nos outros 10, TODAS as linhas do grupo são inativas e têm o mesmo
--   `created_at` (2026-06-12 06:05:40.763777-03, carga única da migração do
--   Zoho). Qualquer desempate adicional cairia no `id` — ou seja, o vínculo
--   Stripe seria atribuído a um item de hardware escolhido por sorteio de UUID.
--   Isso é escolha arbitrária mexendo em dado, e foi reprovado em revisão.
--   Regra adotada: HAVENDO EMPATE NO TOPO, NINGUÉM VENCE — zera o grupo
--   inteiro. Conservador: o sistema fica sem vínculo em vez de com o vínculo
--   errado. Eleger vencedor à mão, se o Scott quiser, é tarefa pós-virada.
--
-- Efeito medido no dump de 18/09: 145 das 146 linhas ficam com
-- `stripe_product_id` NULL. A única que mantém o vínculo é a linha ATIVA de
-- `prod_VBTJdoSBgwMkCL`, que vence sem empate. Os 10 grupos zerados estão
-- listados em `docs/virada/PLANO-DE-CARGA.md`, seção 2.2.1, para ratificação.
--
-- Idempotente: rodar de novo não acha mais grupo duplicado e não faz nada.

WITH classificado AS (
  SELECT id, organizacao_id, stripe_product_id,
         rank() OVER (PARTITION BY organizacao_id, stripe_product_id
                      ORDER BY ativo DESC, created_at DESC NULLS LAST) AS posicao
    FROM servicos_catalogo
   WHERE stripe_product_id IS NOT NULL
),
grupos AS (
  SELECT organizacao_id, stripe_product_id,
         count(*)                            AS linhas,
         count(*) FILTER (WHERE posicao = 1) AS empatados_no_topo
    FROM classificado
   GROUP BY 1, 2
),
perdedoras AS (
  SELECT c.id
    FROM classificado c
    JOIN grupos g USING (organizacao_id, stripe_product_id)
   WHERE g.linhas > 1                -- só grupos que violam o índice único
     AND (c.posicao > 1              -- perdeu na ordem, ou…
          OR g.empatados_no_topo > 1)-- …empatou no topo: o grupo inteiro cai
)
UPDATE servicos_catalogo s
   SET stripe_product_id = NULL
  FROM perdedoras p
 WHERE s.id = p.id;
