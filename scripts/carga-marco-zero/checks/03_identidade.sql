-- CHECK 03 · identidade (mapa secao 7: leads = prod; CNPJ duplicado 0; pessoas sem
-- lead 0; estagio 'novo' so nos pending reais).
\set ON_ERROR_STOP on
\ir _ck.sql
DO $$
DECLARE f text := '';
BEGIN
  f := f || pg_temp.ck('leads', (SELECT count(*) FROM leads), pg_temp.esp('leads'));
  f := f || pg_temp.ck('empresas (prod menos duplicatas de CNPJ)', (SELECT count(*) FROM empresas),
             pg_temp.esp('empresas') - pg_temp.esp('cnpj_duplicado_extras'));
  f := f || pg_temp.ck('CNPJ duplicado',
             (SELECT count(*) FROM (SELECT 1 FROM empresas WHERE length(regexp_replace(coalesce(cnpj, ''), '\D', '', 'g')) IN (11, 14)
                                     GROUP BY regexp_replace(cnpj, '\D', '', 'g') HAVING count(*) > 1) x), 0);
  f := f || pg_temp.ck('empresa descartada no merge ainda existe', (SELECT count(*) FROM empresas e JOIN _mz_empresa_merge m ON m.origem_id = e.id), 0);
  f := f || pg_temp.ck('lead que perdeu a empresa', (SELECT count(*) FROM leads l JOIN legado.leads s ON s.id = l.id
                                                      WHERE s.empresa_id IS NOT NULL AND l.empresa_id IS NULL), 0);
  f := f || pg_temp.ck('pessoas = leads', (SELECT count(*) FROM pessoas), pg_temp.esp('leads'));
  f := f || pg_temp.ck('pessoas sem lead', (SELECT count(*) FROM pessoas WHERE lead_id_legado IS NULL), 0);
  f := f || pg_temp.ck('lead sem estagio_pre_vendas', (SELECT count(*) FROM leads WHERE estagio_pre_vendas IS NULL), 0);
  -- B4: 'novo' nunca em massa. tipo=lead em 'novo' so quem e pending de verdade.
  f := f || pg_temp.ck('lead tipo=lead em novo sem ser pending',
             (SELECT count(*) FROM leads l JOIN legado.leads s ON s.id = l.id
               WHERE l.tipo = 'lead' AND l.estagio_pre_vendas = 'novo' AND s.sdr_status IS DISTINCT FROM 'pending'), 0);
  f := f || pg_temp.ck('lead_labels', (SELECT count(*) FROM lead_labels),
             (SELECT count(*) FROM (SELECT DISTINCT lead_id, label_id FROM legado.lead_labels) x));
  f := f || pg_temp.ck('entity_labels(lead) = lead_labels', (SELECT count(*) FROM entity_labels WHERE entity_type = 'lead'), (SELECT count(*) FROM lead_labels));
  f := f || pg_temp.ck('vinculo sem pessoa/empresa', (SELECT count(*) FROM pessoa_empresa_vinculos v
             WHERE NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.id = v.pessoa_id)), 0);
  f := f || pg_temp.ck('pessoa com empresa e sem vinculo', (SELECT count(*) FROM pessoas p WHERE p.empresa_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM pessoa_empresa_vinculos v WHERE v.pessoa_id = p.id AND v.empresa_id = p.empresa_id)), 0);
  f := f || pg_temp.ck('leads.updated_at diferente de prod',
             (SELECT count(*) FROM leads l JOIN legado.leads s ON s.id = l.id WHERE l.updated_at IS DISTINCT FROM s.updated_at), 0);
  f := f || pg_temp.ck('leads.created_at diferente de prod',
             (SELECT count(*) FROM leads l JOIN legado.leads s ON s.id = l.id WHERE l.created_at IS DISTINCT FROM s.created_at), 0);
  f := f || pg_temp.ck('outbound pending fora de prospeccao_estado novo',
             (SELECT count(*) FROM leads l JOIN legado.leads s ON s.id = l.id
               WHERE lower(btrim(s.origem)) = 'outbound' AND s.sdr_status = 'pending' AND l.prospeccao_estado IS DISTINCT FROM 'novo'), 0);
  IF f <> '' THEN RAISE EXCEPTION E'check 03 VERMELHO:%', f; END IF;
  RAISE NOTICE 'check 03 verde';
END $$;
