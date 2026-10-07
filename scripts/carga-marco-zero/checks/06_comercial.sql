-- CHECK passo 06 · contratos, propostas, itens, anexos. Mapa secao 7:
-- contratos 441 (prod menos assinatura), propostas 1.585, itens 2.762,
-- propostas com cabecalho zerado 0, revenue_nature NULL 0, contratos com PDF 211.
\set ON_ERROR_STOP on

DO $$
DECLARE falhas text[] := '{}'; n bigint; esp bigint;
BEGIN
  SELECT count(*) INTO esp FROM legado.contratos WHERE lower(btrim(tipo)) IS DISTINCT FROM 'assinatura';
  SELECT count(*) INTO n FROM public.contratos;
  IF n <> esp THEN falhas := array_append(falhas, format('contratos: esperado %s (prod sem assinatura), onface %s', esp, n)); END IF;

  SELECT count(*) INTO n FROM public.contratos WHERE lower(btrim(tipo)) = 'assinatura';
  IF n > 0 THEN falhas := array_append(falhas, format('%s contratos tipo assinatura entraram', n)); END IF;

  SELECT count(*) INTO esp FROM legado.contrato_itens i JOIN public.contratos c ON c.id = i.contrato_id;
  SELECT count(*) INTO n FROM public.contrato_itens;
  IF n <> esp THEN falhas := array_append(falhas, format('contrato_itens: esperado %s, onface %s', esp, n)); END IF;

  IF (SELECT count(*) FROM public.propostas) <> (SELECT count(*) FROM legado.propostas) THEN
    falhas := array_append(falhas, 'propostas diferente de prod'); END IF;
  IF (SELECT count(*) FROM public.proposta_itens) <> (SELECT count(*) FROM legado.proposta_itens) THEN
    falhas := array_append(falhas, 'proposta_itens diferente de prod'); END IF;
  IF (SELECT count(*) FROM public.anexos_legado) <> (SELECT count(*) FROM legado.anexos_legado) THEN
    falhas := array_append(falhas, 'anexos_legado diferente de prod'); END IF;

  -- P5: nenhum status fora do vocabulario do ONFACE
  SELECT count(*) INTO n FROM public.propostas WHERE status IN ('Em Construção','Negotiation','Proposta Ganha');
  IF n > 0 THEN falhas := array_append(falhas, format('%s propostas com status legado (P5)', n)); END IF;

  -- A16: cabecalho zerado so e aceito se os itens somam zero
  SELECT count(*) INTO n FROM public.propostas p
   WHERE coalesce(p.total_recorrente,0) + coalesce(p.total_avulso,0) = 0
     AND (SELECT coalesce(sum(i.subtotal),0) FROM public.proposta_itens i WHERE i.proposta_id = p.id) <> 0;  -- itens que se anulam (500 e -500) ficam zerados
  IF n > 0 THEN falhas := array_append(falhas, format('%s propostas com cabecalho zerado e itens somando valor', n)); END IF;

  SELECT count(*) INTO n FROM public.proposta_itens WHERE revenue_nature IS NULL;
  IF n > 0 THEN falhas := array_append(falhas, format('%s proposta_itens sem revenue_nature', n)); END IF;

  -- M7: contratos com PDF (211 em 06/10)
  SELECT count(DISTINCT entidade_id) INTO n FROM public.anexos_legado WHERE entidade_tipo = 'contrato' AND entidade_id IS NOT NULL;
  IF n < 211 THEN falhas := array_append(falhas, format('contratos com PDF: %s (esperado >= 211)', n)); END IF;
  SELECT count(*) INTO n FROM public.anexos_legado a WHERE a.entidade_tipo = 'contrato' AND a.entidade_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.contratos c WHERE c.id = a.entidade_id);
  IF n > 0 THEN falhas := array_append(falhas, format('%s anexos apontam para contrato inexistente', n)); END IF;

  -- servicos_canonicos.contrato_id so para contrato que entrou (FK cobre, aqui o que sobrou de prod)
  SELECT count(*) INTO n FROM public.servicos_canonicos sc JOIN legado.servicos_canonicos l ON l.id = sc.id
   WHERE l.contrato_id IS NOT NULL AND sc.contrato_id IS NULL
     AND EXISTS (SELECT 1 FROM public.contratos c WHERE c.id = l.contrato_id);
  IF n > 0 THEN falhas := array_append(falhas, format('%s servicos_canonicos sem contrato_id que deveriam ter', n)); END IF;

  -- M10: updated_at e created_at de prod. Contrato e proposta com updated_at diferente do legado = now().
  SELECT count(*) INTO n FROM public.contratos c JOIN legado.contratos l ON l.id = c.id WHERE c.updated_at IS DISTINCT FROM l.updated_at;
  IF n > 0 THEN falhas := array_append(falhas, format('%s contratos com updated_at diferente de prod (M10)', n)); END IF;
  SELECT count(*) INTO n FROM public.propostas c JOIN legado.propostas l ON l.id = c.id WHERE c.updated_at IS DISTINCT FROM l.updated_at;
  IF n > 0 THEN falhas := array_append(falhas, format('%s propostas com updated_at diferente de prod (M10)', n)); END IF;

  -- service_family so com evidencia: nenhum PABX sem tipo/produto que diga PABX
  SELECT count(*) INTO n FROM public.contratos WHERE service_family = 'PABX' AND upper(tipo) !~ 'PABX|RAMAL|LINHA SIP|YEASTAR';
  IF n > 0 THEN falhas := array_append(falhas, format('%s contratos PABX sem evidencia', n)); END IF;

  IF cardinality(falhas) > 0 THEN RAISE EXCEPTION 'CHECK 06 VERMELHO: %', array_to_string(falhas, ' | '); END IF;
  RAISE NOTICE 'CHECK 06 verde';
END $$;
