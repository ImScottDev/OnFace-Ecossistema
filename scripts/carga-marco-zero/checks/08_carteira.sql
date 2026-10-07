-- CHECK passo 08 · carteira. Mapa secao 7 e checklist do 03_HISTORICO (serie de receita).
-- Numeros de 06/10: serie 2021-03 a 2026-09, 602 documentos, R$ 25.295.202,48; jul 445.375,74,
-- ago 435.626,64, set 512.404,49 (324 documentos); set = 476.414,49 MRR + 29.990 setup (Helbor)
-- + 6.000 debito recuperado (TX); fulfillments 42.
-- Variavel opcional: jenifer_email (default jenifer.matos@callface.ai).
\set ON_ERROR_STOP on
\if :{?jenifer_email}
\else
  \set jenifer_email 'jenifer.matos@callface.ai'
\endif
SELECT set_config('mz.jenifer_email', :'jenifer_email', false) \gset

DO $$
DECLARE falhas text[] := '{}'; n bigint; v numeric; jen uuid;
BEGIN
  -- ── serie de receita ──
  SELECT count(DISTINCT documento), sum(valor), min(competencia)::text, max(competencia)::text INTO n, v
    FROM public.cliente_receita_mensal;
  IF n <> 602 THEN falhas := array_append(falhas, format('documentos na serie: %s (esperado 602)', n)); END IF;
  IF v <> 25295202.48 THEN falhas := array_append(falhas, format('soma da serie %s (esperado 25295202,48)', v)); END IF;
  IF (SELECT min(competencia) FROM public.cliente_receita_mensal) <> '2021-03-01'
     OR (SELECT max(competencia) FROM public.cliente_receita_mensal) <> '2026-09-01' THEN
    falhas := array_append(falhas, 'serie nao vai de 2021-03 a 2026-09'); END IF;

  IF (SELECT sum(valor) FROM public.cliente_receita_mensal WHERE competencia = '2026-07-01') <> 445375.74 THEN falhas := array_append(falhas, 'jul/26 <> 445.375,74'); END IF;
  IF (SELECT sum(valor) FROM public.cliente_receita_mensal WHERE competencia = '2026-08-01') <> 435626.64 THEN falhas := array_append(falhas, 'ago/26 <> 435.626,64'); END IF;
  IF (SELECT sum(valor) FROM public.cliente_receita_mensal WHERE competencia = '2026-09-01') <> 512404.49 THEN falhas := array_append(falhas, 'set/26 <> 512.404,49'); END IF;
  IF (SELECT count(DISTINCT documento) FROM public.cliente_receita_mensal WHERE competencia = '2026-09-01') <> 324 THEN falhas := array_append(falhas, 'set/26 nao tem 324 documentos'); END IF;
  IF (SELECT sum(valor) FROM public.cliente_receita_mensal WHERE competencia BETWEEN '2021-01-01' AND '2021-12-01') <> 1968445.35
     OR (SELECT sum(valor) FROM public.cliente_receita_mensal WHERE competencia BETWEEN '2022-01-01' AND '2022-12-01') <> 4121633.90
     OR (SELECT sum(valor) FROM public.cliente_receita_mensal WHERE competencia BETWEEN '2023-01-01' AND '2023-12-01') <> 4990959.76
     OR (SELECT sum(valor) FROM public.cliente_receita_mensal WHERE competencia BETWEEN '2024-01-01' AND '2024-12-01') <> 5092492.43
     OR (SELECT sum(valor) FROM public.cliente_receita_mensal WHERE competencia BETWEEN '2025-01-01' AND '2025-12-01') <> 5219301.55
     OR (SELECT sum(valor) FROM public.cliente_receita_mensal WHERE competencia BETWEEN '2026-01-01' AND '2026-09-01') <> 3902369.49 THEN
    falhas := array_append(falhas, 'totais por ano divergem do xlsx oficial'); END IF;

  -- ── natureza: sempre separada, nunca vazia ──
  SELECT count(*) INTO n FROM public.cliente_receita_mensal WHERE revenue_nature NOT IN ('MRR', 'SETUP', 'ONE_TIME', 'DEBITO_RECUPERADO');
  IF n > 0 THEN falhas := array_append(falhas, format('%s linhas sem natureza definida', n)); END IF;
  IF (SELECT coalesce(sum(valor),0) FROM public.cliente_receita_mensal WHERE competencia = '2026-09-01' AND revenue_nature = 'SETUP') <> 29990 THEN falhas := array_append(falhas, 'setup de set/26 <> 29.990 (Helbor)'); END IF;
  IF (SELECT coalesce(sum(valor),0) FROM public.cliente_receita_mensal WHERE competencia = '2026-09-01' AND revenue_nature = 'DEBITO_RECUPERADO') <> 6000 THEN falhas := array_append(falhas, 'debito recuperado de set/26 <> 6.000 (TX)'); END IF;
  IF (SELECT coalesce(sum(valor),0) FROM public.cliente_receita_mensal WHERE competencia = '2026-09-01' AND revenue_nature = 'MRR') <> 476414.49 THEN falhas := array_append(falhas, 'MRR de set/26 <> 476.414,49'); END IF;
  -- Matte e G30 sao MRR; Helbor so setup
  IF EXISTS (SELECT 1 FROM public.cliente_receita_mensal WHERE competencia = '2026-09-01' AND documento IN ('54164925000105','55617458000186') AND revenue_nature <> 'MRR') THEN falhas := array_append(falhas, 'Matte/G30 de set/26 fora do MRR'); END IF;
  IF EXISTS (SELECT 1 FROM public.cliente_receita_mensal WHERE competencia = '2026-09-01' AND documento = '02967401000140' AND revenue_nature <> 'SETUP') THEN falhas := array_append(falhas, 'Helbor de set/26 fora do SETUP'); END IF;
  -- "nada de UNKNOWN acima de 7 lancamentos" em set (familia)
  SELECT count(*) INTO n FROM public.cliente_receita_mensal WHERE competencia = '2026-09-01' AND service_family = 'UNKNOWN';
  IF n > 7 THEN falhas := array_append(falhas, format('%s lancamentos de set/26 sem familia (maximo 7)', n)); END IF;

  -- ── clientes ──
  SELECT id INTO jen FROM public.usuarios WHERE lower(email) = lower(current_setting('mz.jenifer_email'));
  IF jen IS NULL THEN falhas := array_append(falhas, 'Jenifer nao existe em usuarios'); END IF;
  SELECT count(DISTINCT r.empresa_id) INTO n FROM public.cliente_receita_mensal r
   WHERE r.competencia = '2026-09-01' AND r.empresa_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.empresa_id = r.empresa_id);
  IF n > 0 THEN falhas := array_append(falhas, format('%s empresas com faturamento em set/26 sem linha em clientes', n)); END IF;
  SELECT count(*) INTO n FROM public.clientes WHERE responsavel_id IS DISTINCT FROM jen;
  IF n > 0 THEN falhas := array_append(falhas, format('%s clientes sem a Jenifer como responsavel', n)); END IF;
  SELECT count(*) INTO n FROM public.clientes WHERE responsavel_cs_id IS NOT NULL;
  IF n > 0 THEN falhas := array_append(falhas, format('%s clientes com responsavel_cs_id (deve ficar NULL)', n)); END IF;
  SELECT count(*) INTO n FROM public.clientes c WHERE c.cliente_desde >= (SELECT min(created_at) FROM public.clientes);
  IF n > 0 THEN falhas := array_append(falhas, format('%s clientes com cliente_desde = data da carga', n)); END IF;
  SELECT count(*) INTO n FROM public.clientes WHERE lifecycle_status IS NULL OR status_financeiro IS NULL;
  IF n > 0 THEN falhas := array_append(falhas, format('%s clientes sem lifecycle/status', n)); END IF;
  SELECT count(*) INTO n FROM public.leads l WHERE l.tipo = 'cliente' AND l.responsavel_id IS DISTINCT FROM jen
     AND l.empresa_id IN (SELECT empresa_id FROM public.clientes);
  IF n > 0 THEN falhas := array_append(falhas, format('%s leads tipo cliente da carteira fora da Jenifer', n)); END IF;
  IF (SELECT count(*) FROM public.clientes WHERE status_financeiro = 'ativo') = 0 THEN falhas := array_append(falhas, 'nenhum cliente ativo'); END IF;

  -- ── servicos alinhados ao universo, sem familia inventada ──
  SELECT count(*) INTO n FROM public.clientes c WHERE c.status_financeiro = 'ativo'
     AND NOT EXISTS (SELECT 1 FROM public.servicos_canonicos sc WHERE sc.empresa_id = c.empresa_id);
  IF n > 0 THEN falhas := array_append(falhas, format('%s clientes ativos sem servico', n)); END IF;
  SELECT count(*) INTO n FROM public.servicos_canonicos sc
   WHERE (sc.portfolio_included OR sc.commercial_lifecycle = 'ACTIVE')
     AND NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.empresa_id = sc.empresa_id AND c.status_financeiro = 'ativo');
  IF n > 0 THEN falhas := array_append(falhas, format('%s servicos ACTIVE/portfolio de quem nao e cliente ativo (P12)', n)); END IF;
  SELECT count(*) INTO n FROM public.servicos_canonicos
   WHERE billing_source = 'MARCO_ZERO' AND service_family <> 'UNKNOWN' AND (evidence ->> 'evidencia_familia') IN ('sem_evidencia') ;
  IF n > 0 THEN falhas := array_append(falhas, format('%s servicos criados com familia sem evidencia', n)); END IF;
  SELECT count(*) INTO n FROM public.servicos_canonicos
   WHERE billing_source = 'MARCO_ZERO' AND service_family = 'PABX' AND coalesce(evidence ->> 'evidencia_familia', '') NOT LIKE 'contrato:%' AND coalesce(evidence ->> 'evidencia_familia', '') NOT LIKE 'faturamento:%';
  IF n > 0 THEN falhas := array_append(falhas, format('%s servicos PABX sem evidencia (default PABX proibido)', n)); END IF;

  -- ── fulfillments ──
  IF (SELECT count(*) FROM public.fulfillments) <> (SELECT count(*) FROM legado.fulfillments) THEN falhas := array_append(falhas, 'fulfillments <> prod'); END IF;
  IF (SELECT count(*) FROM public.fulfillment_itens) <> (SELECT count(*) FROM legado.fulfillment_itens) THEN falhas := array_append(falhas, 'fulfillment_itens <> prod'); END IF;
  IF (SELECT count(*) FROM public.fulfillment_formularios) <> (SELECT count(*) FROM legado.fulfillment_formularios) THEN falhas := array_append(falhas, 'fulfillment_formularios <> prod'); END IF;
  IF (SELECT count(*) FROM public.fulfillment_ramais) <> (SELECT count(*) FROM legado.fulfillment_ramais) THEN falhas := array_append(falhas, 'fulfillment_ramais <> prod'); END IF;
  IF (SELECT count(*) FROM public.fulfillment_linhas_portabilidade) <> (SELECT count(*) FROM legado.fulfillment_linhas_portabilidade) THEN falhas := array_append(falhas, 'fulfillment_linhas_portabilidade <> prod'); END IF;
  IF EXISTS (SELECT 1 FROM public.fulfillments WHERE tipo IS DISTINCT FROM 'ONBOARDING') THEN falhas := array_append(falhas, 'fulfillment com tipo diferente de ONBOARDING'); END IF;
  IF EXISTS (SELECT 1 FROM public.fulfillments WHERE status = 'CANCELED' AND cancelled_at IS NULL) THEN falhas := array_append(falhas, 'fulfillment CANCELED sem cancelled_at'); END IF;

  IF cardinality(falhas) > 0 THEN RAISE EXCEPTION 'CHECK 08 VERMELHO: %', array_to_string(falhas, ' | '); END IF;
  RAISE NOTICE 'CHECK 08 verde';
END $$;
