-- CHECK passo 07 · financeiro. Mapa secao 7: faturas 1.085, fatura_itens 226,
-- assinaturas 378, mrr_movimentos 737, stripe_webhook_events 483,
-- billing_identities 224. Compara contra o legado (o numero de prod do minuto),
-- nao contra constante. Para no primeiro vermelho (RAISE EXCEPTION).
\set ON_ERROR_STOP on

DO $$
DECLARE r record; falhas text[] := '{}'; n bigint; livres bigint;
BEGIN
  -- contagens iguais as de prod
  FOR r IN
    SELECT t, (SELECT count(*) FROM legado.billing_identities) AS esp, (SELECT count(*) FROM public.billing_identities) AS got FROM (VALUES ('billing_identities')) v(t)
    UNION ALL SELECT 'billing_customer_aliases', (SELECT count(*) FROM legado.billing_customer_aliases), (SELECT count(*) FROM public.billing_customer_aliases)
    UNION ALL SELECT 'assinaturas', (SELECT count(*) FROM legado.assinaturas), (SELECT count(*) FROM public.assinaturas)
    UNION ALL SELECT 'faturas', (SELECT count(*) FROM legado.faturas), (SELECT count(*) FROM public.faturas)
    UNION ALL SELECT 'fatura_itens', (SELECT count(*) FROM legado.fatura_itens), (SELECT count(*) FROM public.fatura_itens)
    UNION ALL SELECT 'mrr_movimentos', (SELECT count(*) FROM legado.mrr_movimentos), (SELECT count(*) FROM public.mrr_movimentos)
    UNION ALL SELECT 'service_ledger_entries', (SELECT count(*) FROM legado.service_ledger_entries), (SELECT count(*) FROM public.service_ledger_entries)
    UNION ALL SELECT 'stripe_webhook_events', (SELECT count(*) FROM legado.stripe_webhook_events), (SELECT count(*) FROM public.stripe_webhook_events)
  LOOP
    IF r.esp <> r.got THEN falhas := array_append(falhas, format('%s: prod %s, onface %s', r.t, r.esp, r.got)); END IF;
  END LOOP;

  -- valores nao mudam na copia
  IF (SELECT coalesce(sum(valor),0) FROM legado.faturas) <> (SELECT coalesce(sum(valor),0) FROM public.faturas) THEN
    falhas := array_append(falhas, 'soma de faturas.valor diverge de prod'); END IF;
  IF (SELECT coalesce(sum(mrr),0) FROM legado.assinaturas) <> (SELECT coalesce(sum(mrr),0) FROM public.assinaturas) THEN
    falhas := array_append(falhas, 'soma de assinaturas.mrr diverge de prod'); END IF;
  IF (SELECT coalesce(sum(delta),0) FROM legado.mrr_movimentos) <> (SELECT coalesce(sum(delta),0) FROM public.mrr_movimentos) THEN
    falhas := array_append(falhas, 'soma de mrr_movimentos.delta diverge de prod'); END IF;

  -- assinatura nao e contrato: nenhuma fatura/assinatura aponta para contrato tipo assinatura
  SELECT count(*) INTO n FROM public.contratos WHERE lower(btrim(tipo)) = 'assinatura';
  IF n > 0 THEN falhas := array_append(falhas, format('%s contratos tipo assinatura no destino', n)); END IF;

  -- pagamentos: um por fatura stripe paga com data e empresa, mesma soma
  SELECT count(*) INTO n FROM public.faturas f
   WHERE f.origem='stripe' AND f.status='paga' AND f.paga_em IS NOT NULL AND f.empresa_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.pagamentos p WHERE p.fatura_id = f.id AND p.status = 'PAID');
  IF n > 0 THEN falhas := array_append(falhas, format('%s faturas pagas sem pagamento', n)); END IF;
  IF (SELECT coalesce(sum(p.amount),0) FROM public.pagamentos p) <>
     (SELECT coalesce(sum(f.valor),0) FROM public.faturas f WHERE f.origem='stripe' AND f.status='paga' AND f.paga_em IS NOT NULL AND f.empresa_id IS NOT NULL) THEN
    falhas := array_append(falhas, 'soma de pagamentos diverge das faturas pagas'); END IF;

  -- fatura_itens que perderam o catalogo: so e erro se o catalogo de prod entrou inteiro
  SELECT count(*) INTO n FROM legado.fatura_itens l JOIN public.fatura_itens f ON f.id = l.id
   WHERE l.servico_catalogo_id IS NOT NULL AND f.servico_catalogo_id IS NULL;
  SELECT count(*) INTO livres FROM legado.servicos_catalogo l WHERE NOT EXISTS (SELECT 1 FROM public.servicos_catalogo c WHERE c.id = l.id);
  IF n > 0 AND livres = 0 THEN falhas := array_append(falhas, format('%s fatura_itens sem catalogo com catalogo completo', n));
  ELSIF n > 0 THEN RAISE NOTICE 'AVISO: % fatura_itens sem servico_catalogo_id (% ids do catalogo de prod nao entraram no passo 2)', n, livres; END IF;

  -- informativo: faturas pagas sem empresa (nao viram pagamento)
  SELECT count(*) INTO n FROM public.faturas WHERE origem='stripe' AND status='paga' AND empresa_id IS NULL;
  RAISE NOTICE 'info: % faturas stripe pagas sem empresa (sem pagamento derivado)', n;

  IF cardinality(falhas) > 0 THEN RAISE EXCEPTION 'CHECK 07 VERMELHO: %', array_to_string(falhas, ' | '); END IF;
  RAISE NOTICE 'CHECK 07 verde';
END $$;
