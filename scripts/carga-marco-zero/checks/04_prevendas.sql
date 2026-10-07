-- CHECK 04 · pre-vendas (mapa secao 7: etapa do lead = etapa da aquisicao; desqualificado
-- e qualificado iguais nos dois lados; no-show devolvidos a QUALIFICADO).
\set ON_ERROR_STOP on
\ir _ck.sql
DO $$
DECLARE f text := ''; noshow_esperado bigint;
BEGIN
  f := f || pg_temp.ck('aquisicoes = leads', (SELECT count(*) FROM aquisicoes), pg_temp.esp('leads'));
  f := f || pg_temp.ck('aquisicao sem etapa', (SELECT count(*) FROM aquisicoes WHERE etapa_id IS NULL), 0);
  f := f || pg_temp.ck('etapa do lead <> etapa da aquisicao',
             (SELECT count(*) FROM aquisicoes a JOIN leads l ON l.id = a.lead_legado_id
                JOIN pipeline_etapas pe ON pe.id = a.etapa_id WHERE l.estagio_pre_vendas IS DISTINCT FROM pe.codigo), 0);
  f := f || pg_temp.ck('desqualificado: aquisicoes x leads',
             (SELECT count(*) FROM aquisicoes WHERE desqualificado_em IS NOT NULL), (SELECT count(*) FROM leads WHERE desqualificado_em IS NOT NULL));
  f := f || pg_temp.ck('desqualificado: etapa x fato',
             (SELECT count(*) FROM aquisicoes a JOIN pipeline_etapas pe ON pe.id = a.etapa_id WHERE pe.codigo = 'desqualificado'),
             (SELECT count(*) FROM aquisicoes WHERE desqualificado_em IS NOT NULL));
  f := f || pg_temp.ck('qualificado: aquisicoes x leads',
             (SELECT count(*) FROM aquisicoes WHERE qualificado), (SELECT count(*) FROM leads WHERE qualificado));
  f := f || pg_temp.ck('qualificado sem qualificado_em', (SELECT count(*) FROM aquisicoes WHERE qualificado AND qualificado_em IS NULL), 0);
  f := f || pg_temp.ck('motivo de desqualificacao: aquisicoes x leads',
             (SELECT count(*) FROM aquisicoes a JOIN leads l ON l.id = a.lead_legado_id
               WHERE a.motivo_desqualificacao IS DISTINCT FROM l.desqualificacao_motivo), 0);
  f := f || pg_temp.ck('nutricao sem motivo', (SELECT count(*) FROM aquisicoes a JOIN pipeline_etapas pe ON pe.id = a.etapa_id
               WHERE pe.codigo = 'nutricao' AND a.nutricao_status IS NULL), 0);
  f := f || pg_temp.ck('nutricao_status fora da nutricao', (SELECT count(*) FROM aquisicoes a JOIN pipeline_etapas pe ON pe.id = a.etapa_id
               WHERE pe.codigo <> 'nutricao' AND a.nutricao_status IS NOT NULL), 0);
  f := f || pg_temp.ck('nutricao_status estagnado_legado', (SELECT count(*) FROM aquisicoes WHERE nutricao_status = 'estagnado_legado'), 0);
  f := f || pg_temp.ck('nutricao_status fora de MOTIVOS_NUTRICAO', (SELECT count(*) FROM aquisicoes
               WHERE nutricao_status IS NOT NULL AND nutricao_status NOT IN
                 ('sem_resposta','sem_interesse_agora','timing','sem_orcamento','contrato_vigente','decisao_interna','retomar_em_data','outro')), 0);
  f := f || pg_temp.ck('desqualificacao_motivo fora de MOTIVOS_DESQUALIFICACAO', (SELECT count(*) FROM leads
               WHERE desqualificacao_motivo IS NOT NULL AND desqualificacao_motivo NOT IN
                 ('fora_icp','contato_invalido','sem_fit','sem_necessidade','duplicado','no_show','nao_respondeu','fora_perfil','outro')), 0);
  f := f || pg_temp.ck('nao-lead aberto no board (closed_at NULL)',
             (SELECT count(*) FROM aquisicoes a JOIN leads l ON l.id = a.lead_legado_id WHERE l.tipo IS DISTINCT FROM 'lead' AND a.closed_at IS NULL), 0);
  f := f || pg_temp.ck('aquisicao sem pessoa', (SELECT count(*) FROM aquisicoes WHERE pessoa_id IS NULL), 0);
  -- no-show: lead tipo=lead, negocio no_show, nao desqualificado, sem sdr_*, sem outro negocio
  -- aberto/estagnado/perdido. Conta direto em prod, sem passar pela tabela de apoio.
  SELECT count(*) INTO noshow_esperado FROM legado.leads l
   WHERE l.tipo = 'lead' AND l.sdr_status IS DISTINCT FROM 'disqualified' AND l.sdr_status NOT LIKE 'sdr\_%'
     AND EXISTS (SELECT 1 FROM legado.negocios n WHERE n.lead_id = l.id AND n.status = 'no_show')
     AND NOT EXISTS (SELECT 1 FROM legado.negocios n WHERE n.lead_id = l.id
                      AND n.status IN ('reuniao_agendada','reuniao_realizada','trial','proposta_apresentada','negociacao_iniciada',
                                       'outra_data','sem_retorno','trava_negociacao','trava_assinatura','perdido'));
  f := f || pg_temp.ck('no-show devolvidos a qualificado',
             (SELECT count(*) FROM aquisicoes a JOIN pipeline_etapas pe ON pe.id = a.etapa_id JOIN leads l ON l.id = a.lead_legado_id
               WHERE pe.codigo = 'qualificado' AND l.tipo = 'lead'
                 AND EXISTS (SELECT 1 FROM legado.negocios n WHERE n.lead_id = l.id AND n.status = 'no_show')
                 AND NOT EXISTS (SELECT 1 FROM legado.negocios n WHERE n.lead_id = l.id AND n.status IN
                     ('reuniao_agendada','reuniao_realizada','trial','proposta_apresentada','negociacao_iniciada','outra_data','sem_retorno','trava_negociacao','trava_assinatura','perdido'))),
             noshow_esperado);
  f := f || pg_temp.ck('lead com negocio aberto fora de oportunidade',
             (SELECT count(*) FROM _mz_lead_estado e WHERE e.tipo = 'lead' AND e.etapa NOT IN ('oportunidade', 'desqualificado')
                AND EXISTS (SELECT 1 FROM _mz_negocio_depara d WHERE d.lead_id = e.lead_id AND d.aberto)), 0);
  f := f || pg_temp.ck('pontos_contato first-touch = aquisicoes',
             (SELECT count(*) FROM pontos_contato WHERE is_first_touch AND aquisicao_id IS NOT NULL), (SELECT count(*) FROM aquisicoes));
  f := f || pg_temp.ck('cadencia_execucoes', (SELECT count(*) FROM cadencia_execucoes), (SELECT count(*) FROM legado.cadencia_execucoes));
  f := f || pg_temp.ck('cadence_enrollments (devem ficar vazios)', (SELECT count(*) FROM cadence_enrollments), 0);
  f := f || pg_temp.ck('aquisicoes.updated_at diferente do lead',
             (SELECT count(*) FROM aquisicoes a JOIN leads l ON l.id = a.lead_legado_id WHERE a.updated_at IS DISTINCT FROM l.updated_at), 0);
  IF f <> '' THEN RAISE EXCEPTION E'check 04 VERMELHO:%', f; END IF;
  RAISE NOTICE 'check 04 verde';
END $$;
