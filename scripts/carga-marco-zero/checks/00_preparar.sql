-- CHECK 00 · a origem esta ligada e o de-para cobre todo negocio.
\set ON_ERROR_STOP on
\ir _ck.sql
DO $$
DECLARE f text := '';
BEGIN
  f := f || pg_temp.ck('legado.leads', (SELECT count(*) FROM legado.leads), pg_temp.esp('leads'));
  f := f || pg_temp.ck('_mz_negocio_depara', (SELECT count(*) FROM _mz_negocio_depara), pg_temp.esp('negocios'));
  f := f || pg_temp.ck('negocio sem de-para (etapa NULL fora o ativo)',
             (SELECT count(*) FROM _mz_negocio_depara WHERE etapa IS NULL AND status_legado <> 'ativo'), 0);
  f := f || pg_temp.ck('perdido sem motivo_chave', (SELECT count(*) FROM _mz_negocio_depara WHERE status_novo = 'perdido' AND motivo_chave IS NULL), 0);
  f := f || pg_temp.ck('_mz_meta inicio', (SELECT count(*) FROM _mz_meta WHERE chave = 'inicio'), 1);
  -- as etapas canonicas que o de-para usa existem em todo pipeline de vendas
  f := f || pg_temp.ck('pipeline de vendas sem etapa canonica',
             (SELECT count(*) FROM pipelines p CROSS JOIN (VALUES ('entrada'),('diagnostico'),('proposta'),('negociacao'),('ganho'),('perdido')) c(cod)
               WHERE p.tipo = 'SALES' AND NOT EXISTS (SELECT 1 FROM pipeline_etapas e WHERE e.pipeline_id = p.id AND e.codigo = c.cod)), 0);
  f := f || pg_temp.ck('pipeline aquisicao sem as 7 etapas',
             (SELECT count(*) FROM pipeline_etapas e JOIN pipelines p ON p.id = e.pipeline_id AND p.slug = 'aquisicao'
               WHERE e.codigo IN ('novo','em_contato','qualificacao','qualificado','oportunidade','nutricao','desqualificado')), 7);
  IF f <> '' THEN RAISE EXCEPTION E'check 00 VERMELHO:%', f; END IF;
  RAISE NOTICE 'check 00 verde';
END $$;
