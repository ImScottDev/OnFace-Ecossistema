-- CARGA MARCO ZERO · passo 02 · config sem CRM (mapa 2.2, 2.5 catalogo, 3).
-- labels (+ 'quente'), servicos_catalogo, catalogo_mapeamentos_legacy, campanhas,
-- service_ledger_batches. ofertas_comerciais e catalogo_precos NAO existem em prod
-- (o mapa os cita, mas o dump nao tem as tabelas): ficam como a migration criou.
\set ON_ERROR_STOP on
BEGIN;
\ir _lib.sql

SELECT 'labels' AS tabela, pg_temp.mz_carga('labels', 'legado.labels') AS linhas;

-- Label 'quente': gatilho da automacao 'Lead quente: ligar hoje' (passo 11). Nao
-- existe em prod, so no dev do Scott. Mesmo id e cor do dev, para o export de
-- configs continuar apontando para a mesma label. Nao sobrescreve quem ja existe.
INSERT INTO labels (id, nome, cor, organizacao_id, created_at)
SELECT '6a8f415f-315f-40a6-9574-9cbcb3dd4ec0', 'quente', '#0e7490', (SELECT id FROM organizacoes LIMIT 1),
       (SELECT valor::timestamptz FROM _mz_meta WHERE chave = 'inicio')
 WHERE NOT EXISTS (SELECT 1 FROM labels WHERE lower(nome) = 'quente');

-- Catalogo: direto. O indice unico (organizacao_id, stripe_product_id) nao aceita o
-- dado de prod (11 produtos Stripe apontados por varias linhas, resquicio do PABX
-- legado). Regra: o vinculo so sobrevive se UMA linha ATIVA for a unica do grupo.
-- Empate ou nenhuma ativa: ninguem vence e o grupo inteiro perde o vinculo (nome,
-- preco e familia ficam). Nenhuma linha e apagada.
CREATE TEMP TABLE _cat AS
SELECT s.*,
       (s.stripe_product_id IS NOT NULL AND (
          count(*) OVER (PARTITION BY s.organizacao_id, s.stripe_product_id) = 1
          OR (s.ativo AND count(*) FILTER (WHERE s.ativo) OVER (PARTITION BY s.organizacao_id, s.stripe_product_id) = 1)
       )) AS _vinculo_ok
  FROM legado.servicos_catalogo s;
SELECT 'servicos_catalogo' AS tabela,
       pg_temp.mz_carga('servicos_catalogo', '_cat', 'true',
         jsonb_build_object('stripe_product_id', 'CASE WHEN s._vinculo_ok THEN s.stripe_product_id END')) AS linhas;

-- Mapeamento produto legado -> catalogo (revisado_por/reviewed_status so existem no
-- destino: ficam no default, pendente).
SELECT 'catalogo_mapeamentos_legacy' AS tabela,
       pg_temp.mz_carga('catalogo_mapeamentos_legacy', 'legado.catalogo_mapeamentos_legacy', 'true',
         jsonb_build_object('canonical_product_id', '(SELECT c.id FROM public.servicos_catalogo c WHERE c.id = s.canonical_product_id)')) AS linhas;

SELECT 'campanhas' AS tabela, pg_temp.mz_carga('campanhas', 'legado.campanhas') AS linhas;
SELECT 'service_ledger_batches' AS tabela, pg_temp.mz_carga('service_ledger_batches', 'legado.service_ledger_batches') AS linhas;

COMMIT;
