-- CHECK 02 · labels (+quente), catalogo, campanhas, ledger batches.
\set ON_ERROR_STOP on
\ir _ck.sql
DO $$
DECLARE f text := '';
BEGIN
  f := f || pg_temp.ck('labels (prod + quente)', (SELECT count(*) FROM labels), (SELECT count(*) FROM legado.labels) + 1);
  f := f || pg_temp.ck('label quente', (SELECT count(*) FROM labels WHERE lower(nome) = 'quente'), 1);
  f := f || pg_temp.ck('servicos_catalogo', (SELECT count(*) FROM servicos_catalogo WHERE id IN (SELECT id FROM legado.servicos_catalogo)),
             (SELECT count(*) FROM legado.servicos_catalogo));
  f := f || pg_temp.ck('catalogo_mapeamentos_legacy', (SELECT count(*) FROM catalogo_mapeamentos_legacy), (SELECT count(*) FROM legado.catalogo_mapeamentos_legacy));
  f := f || pg_temp.ck('campanhas', (SELECT count(*) FROM campanhas), (SELECT count(*) FROM legado.campanhas));
  f := f || pg_temp.ck('service_ledger_batches', (SELECT count(*) FROM service_ledger_batches), (SELECT count(*) FROM legado.service_ledger_batches));
  f := f || pg_temp.ck('stripe_product_id repetido em servicos_catalogo',
             (SELECT count(*) FROM (SELECT 1 FROM servicos_catalogo WHERE stripe_product_id IS NOT NULL
                                     GROUP BY organizacao_id, stripe_product_id HAVING count(*) > 1) x), 0);
  IF f <> '' THEN RAISE EXCEPTION E'check 02 VERMELHO:%', f; END IF;
  RAISE NOTICE 'check 02 verde';
END $$;
