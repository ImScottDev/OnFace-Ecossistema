-- CHECK 05 · funil (mapa secao 7: negocios = oportunidades = prod; etapas
-- 20/13/56/6/618/746 no dump de 06/10; 'ativo' fora do funil; fechadas com data;
-- perdidas com motivo; etapa_id coerente; familia NULL como prod; 164 EXPANSION).
\set ON_ERROR_STOP on
\ir _ck.sql
DO $$
DECLARE f text := ''; e text;
BEGIN
  f := f || pg_temp.ck('negocios', (SELECT count(*) FROM negocios), pg_temp.esp('negocios'));
  f := f || pg_temp.ck('oportunidades = negocios', (SELECT count(*) FROM oportunidades), pg_temp.esp('negocios'));
  f := f || pg_temp.ck('negocio_leads', (SELECT count(*) FROM negocio_leads), pg_temp.esp('negocio_leads'));
  FOREACH e IN ARRAY ARRAY['entrada','diagnostico','proposta','negociacao','ganho','perdido'] LOOP
    f := f || pg_temp.ck('oportunidades na etapa ' || e, (SELECT count(*) FROM oportunidades WHERE etapa = e), pg_temp.esp('etapa_' || e));
    f := f || pg_temp.ck('negocios na etapa ' || e, (SELECT count(*) FROM negocios WHERE etapa = e), pg_temp.esp('etapa_' || e));
  END LOOP;
  -- copia 'ativo': fora do funil
  f := f || pg_temp.ck('copias ativo (negocios)', (SELECT count(*) FROM negocios WHERE status = 'ativo'), pg_temp.esp('negocios_ativo_copia'));
  f := f || pg_temp.ck('copias ativo (oportunidades stage ativo)', (SELECT count(*) FROM oportunidades WHERE stage = 'ativo'), pg_temp.esp('negocios_ativo_copia'));
  f := f || pg_temp.ck('copia ativo com etapa nao nula',
             (SELECT count(*) FROM oportunidades WHERE stage = 'ativo' AND (etapa IS NOT NULL OR etapa_id IS NOT NULL))
           + (SELECT count(*) FROM negocios WHERE status = 'ativo' AND etapa IS NOT NULL), 0);
  f := f || pg_temp.ck('ativo com ganho_at', (SELECT count(*) FROM oportunidades WHERE stage = 'ativo' AND ganho_at IS NOT NULL)
           + (SELECT count(*) FROM negocios WHERE status = 'ativo' AND ganho_at IS NOT NULL), 0);
  -- fechadas com data, perdidas com motivo
  f := f || pg_temp.ck('ganho sem ganho_at', (SELECT count(*) FROM oportunidades WHERE stage = 'ganho' AND ganho_at IS NULL)
           + (SELECT count(*) FROM negocios WHERE status = 'ganho' AND ganho_at IS NULL), 0);
  f := f || pg_temp.ck('perdido sem perdido_at', (SELECT count(*) FROM oportunidades WHERE stage = 'perdido' AND perdido_at IS NULL), 0);
  f := f || pg_temp.ck('perdido sem motivo_perda_chave',
             (SELECT count(*) FROM negocios WHERE status = 'perdido' AND motivo_perda_chave IS NULL)
           + (SELECT count(*) FROM oportunidades WHERE stage = 'perdido' AND motivo_perda IS NULL), 0);
  f := f || pg_temp.ck('motivo_perda diferente de motivo_perda_chave',
             (SELECT count(*) FROM negocios WHERE status = 'perdido' AND motivo_perda IS DISTINCT FROM motivo_perda_chave), 0);
  f := f || pg_temp.ck('motivo_perda fora de MOTIVOS_PERDA', (SELECT count(*) FROM negocios WHERE motivo_perda_chave IS NOT NULL AND motivo_perda_chave NOT IN
                 ('sem_retorno','sem_interesse','preco','concorrente','sem_orcamento','timing','trava_negociacao','trava_contratual','projeto_cancelado','sem_fit','no_show','outro')), 0);
  f := f || pg_temp.ck('ganho e perdido ao mesmo tempo', (SELECT count(*) FROM oportunidades WHERE ganho_at IS NOT NULL AND perdido_at IS NOT NULL), 0);
  f := f || pg_temp.ck('status legado vivo (estagnado/no_show/trial) em negocios',
             (SELECT count(*) FROM negocios WHERE status IN ('outra_data','sem_retorno','trava_negociacao','trava_assinatura','no_show','trial')), 0);
  f := f || pg_temp.ck('no_show perdido sem motivo no_show',
             (SELECT count(*) FROM negocios n JOIN legado.negocios s ON s.id = n.id WHERE s.status = 'no_show' AND (n.motivo_perda_chave IS DISTINCT FROM 'no_show' OR n.no_show_em IS NULL)), 0);
  f := f || pg_temp.ck('estagnado perdido sem motivo_estagnacao',
             (SELECT count(*) FROM negocios n JOIN legado.negocios s ON s.id = n.id
               WHERE s.status IN ('outra_data','sem_retorno','trava_negociacao','trava_assinatura') AND (n.motivo_estagnacao IS DISTINCT FROM s.status OR n.estagnado_em IS NULL)), 0);
  f := f || pg_temp.ck('trial sem trial_iniciado_em',
             (SELECT count(*) FROM negocios n JOIN legado.negocios s ON s.id = n.id WHERE s.status = 'trial' AND n.trial_iniciado_em IS NULL), 0);
  -- sintetico: todo perdido tem um status_changes para 'perdido' (senao o sync regrava perdido_at = now)
  f := f || pg_temp.ck('perdido sem status_changes perdido',
             (SELECT count(*) FROM negocios n WHERE n.status = 'perdido'
                AND NOT EXISTS (SELECT 1 FROM status_changes c WHERE c.negocio_id = n.id AND c.para_status = 'perdido')), 0);
  f := f || pg_temp.ck('perdido_at diferente do ultimo status_changes perdido',
             (SELECT count(*) FROM oportunidades o WHERE o.stage = 'perdido'
                AND o.perdido_at IS DISTINCT FROM (SELECT max(c.created_at) FROM status_changes c WHERE c.negocio_id = o.negocio_id_legado AND c.para_status = 'perdido')), 0);
  -- etapa_id coerente com etapa e pipeline
  f := f || pg_temp.ck('oportunidade com etapa_id incoerente',
             (SELECT count(*) FROM oportunidades o WHERE o.etapa IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM pipeline_etapas pe WHERE pe.id = o.etapa_id AND pe.codigo = o.etapa AND pe.pipeline_id = o.pipeline_id AND pe.ativo)), 0);
  f := f || pg_temp.ck('negocio aberto com etapa perdido',
             (SELECT count(*) FROM negocios WHERE status IN ('reuniao_agendada','reuniao_realizada','proposta_apresentada','negociacao_iniciada') AND etapa IS DISTINCT FROM
                CASE status WHEN 'reuniao_agendada' THEN 'entrada' WHEN 'reuniao_realizada' THEN 'diagnostico'
                            WHEN 'proposta_apresentada' THEN 'proposta' ELSE 'negociacao' END), 0);
  f := f || pg_temp.ck('negocio sem pipeline', (SELECT count(*) FROM negocios WHERE pipeline_id IS NULL), 0);
  f := f || pg_temp.ck('etapa duplicada ativa no mesmo pipeline',
             (SELECT count(*) FROM (SELECT 1 FROM pipeline_etapas WHERE ativo AND codigo IN ('reuniao_agendada','reuniao_realizada','trial','proposta_apresentada','negociacao_iniciada')) x), 0);
  -- familia: copia do NULL de prod
  f := f || pg_temp.ck('service_family nao nula em oportunidades', (SELECT count(*) FROM oportunidades WHERE service_family IS NOT NULL), pg_temp.esp('service_family_nao_nula'));
  f := f || pg_temp.ck('service_family de negocios x prod', (SELECT count(*) FROM negocios n JOIN legado.negocios s ON s.id = n.id
               WHERE n.service_family IS DISTINCT FROM s.service_family), 0);
  f := f || pg_temp.ck('commercial_motion EXPANSION', (SELECT count(*) FROM negocios WHERE commercial_motion = 'EXPANSION'), pg_temp.esp('commercial_expansion'));
  f := f || pg_temp.ck('oportunidades EXPANSION', (SELECT count(*) FROM oportunidades WHERE commercial_motion = 'EXPANSION'), pg_temp.esp('commercial_expansion'));
  -- lead x negocio
  f := f || pg_temp.ck('leads.negocio_ativo_id apontando para negocio nao aberto',
             (SELECT count(*) FROM leads l JOIN negocios n ON n.id = l.negocio_ativo_id
               WHERE n.status NOT IN ('reuniao_agendada','reuniao_realizada','proposta_apresentada','negociacao_iniciada')), 0);
  f := f || pg_temp.ck('oportunidade sem pessoa (negocio com lead)',
             (SELECT count(*) FROM oportunidades WHERE lead_id IS NOT NULL AND pessoa_id IS NULL), 0);
  f := f || pg_temp.ck('negocios.updated_at diferente de prod',
             (SELECT count(*) FROM negocios n JOIN legado.negocios s ON s.id = n.id WHERE n.updated_at IS DISTINCT FROM s.updated_at), 0);
  f := f || pg_temp.ck('oportunidades.updated_at diferente do negocio',
             (SELECT count(*) FROM oportunidades o JOIN negocios n ON n.id = o.negocio_id_legado WHERE o.updated_at IS DISTINCT FROM n.updated_at), 0);
  f := f || pg_temp.ck('status_changes de prod', (SELECT count(*) FROM status_changes WHERE id IN (SELECT id FROM legado.status_changes)),
             (SELECT count(*) FROM legado.status_changes));
  -- o 08 acrescenta servico para empresa do universo sem servico: aqui so confere os de prod
  f := f || pg_temp.ck('servicos_canonicos de prod', (SELECT count(*) FROM servicos_canonicos WHERE id IN (SELECT id FROM legado.servicos_canonicos)), (SELECT count(*) FROM legado.servicos_canonicos));
  IF f <> '' THEN RAISE EXCEPTION E'check 05 VERMELHO:%', f; END IF;
  RAISE NOTICE 'check 05 verde';
END $$;
