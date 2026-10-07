-- CHECK do passo 10 · timeline_events e communications. Roda depois de 10_timeline.sql.
\set ON_ERROR_STOP on
-- Ajudantes de check (iguais em todo arquivo de check; temp, somem com a sessao).
-- Cada check grava em _mz_res e, no fim, para com RAISE EXCEPTION se algo falhou.
-- Com `-v mz_acumula=1` (o 99_final) nao para: o 99 junta tudo e para uma vez so.
CREATE TEMP TABLE IF NOT EXISTS _mz_res (ordem serial, grupo text, nome text, obtido text, esperado text, ok boolean, info boolean DEFAULT false);
CREATE OR REPLACE FUNCTION pg_temp.mz_cnt(consulta text) RETURNS numeric LANGUAGE plpgsql AS $f$
DECLARE n numeric; BEGIN EXECUTE consulta INTO n; RETURN coalesce(n, 0); END $f$;
CREATE OR REPLACE FUNCTION pg_temp.mz_eq(g text, nome text, obtido numeric, esperado numeric) RETURNS void LANGUAGE sql AS $f$
  INSERT INTO _mz_res (grupo, nome, obtido, esperado, ok) VALUES (g, nome, obtido::text, esperado::text, obtido IS NOT DISTINCT FROM esperado) $f$;
CREATE OR REPLACE FUNCTION pg_temp.mz_min(g text, nome text, obtido numeric, minimo numeric) RETURNS void LANGUAGE sql AS $f$
  INSERT INTO _mz_res (grupo, nome, obtido, esperado, ok) VALUES (g, nome, obtido::text, '>= ' || minimo, obtido >= minimo) $f$;
CREATE OR REPLACE FUNCTION pg_temp.mz_info(g text, nome text, valor text) RETURNS void LANGUAGE sql AS $f$
  INSERT INTO _mz_res (grupo, nome, obtido, esperado, ok, info) VALUES (g, nome, valor, 'informativo', true, true) $f$;
\o /dev/null
\set filipe '''fcb69714-2213-4cb4-90e0-4c1d2a93c4bc'''

-- [Scott] Nenhum evento de tarefa do Filipe, por nenhum dos dois caminhos possiveis.
SELECT pg_temp.mz_eq('10', 'timeline: eventos de tarefa do Filipe',
  pg_temp.mz_cnt('select count(*) from timeline_events where (metadata->''backfill''->>''origem'' = ''tarefas'' and metadata->''backfill''->>''id'' in (select id::text from legado.tarefas where usuario_id = ' || :'filipe' || ')) or (actor_id = ' || :'filipe' || ' and tipo ilike ''tarefa%'')'), 0);
-- A carga nao cria domain_events; o evento carregado nunca aponta para um.
SELECT pg_temp.mz_eq('10', 'timeline: domain_event_id nao nulo (carga)',
  pg_temp.mz_cnt('select count(*) from timeline_events where metadata->''backfill''->>''fase'' = ''marco-zero'' and domain_event_id is not null'), 0);
SELECT pg_temp.mz_eq('10', 'timeline: eventos sem nenhuma ancora',
  pg_temp.mz_cnt('select count(*) from timeline_events where empresa_id is null and pessoa_id is null and aquisicao_id is null and oportunidade_id is null'), 0);
SELECT pg_temp.mz_eq('10', 'timeline: ids duplicados por origem (idempotencia)',
  pg_temp.mz_cnt('select count(*) from (select metadata->''backfill''->>''origem'' o, metadata->''backfill''->>''id'' i from timeline_events where metadata->''backfill''->>''fase'' = ''marco-zero'' group by 1,2 having count(*) > 1) x'), 0);

-- Nada ancorado fica de fora: linha de origem que TEM lead com pessoa/aquisicao ou negocio com
-- oportunidade e nao gerou evento. (Sem ancora nao entra, de proposito: sai no info abaixo.)
-- tabela | coluna de lead | coluna de negocio (NULL quando a origem nao tem)
SELECT pg_temp.mz_eq('10', 'timeline: ' || t.tabela || ' ancoradas sem evento',
  pg_temp.mz_cnt(format($q$select count(*) from %1$I s where not exists (select 1 from timeline_events e where e.id = md5('mz-tl:%1$s:' || s.id::text)::uuid)
      and (%2$s)$q$, t.tabela, t.ancora)), 0),
  pg_temp.mz_info('10', 'timeline: ' || t.tabela || ' sem ancora (nao entram)',
  pg_temp.mz_cnt(format($q$select count(*) from %1$I s where not exists (select 1 from timeline_events e where e.id = md5('mz-tl:%1$s:' || s.id::text)::uuid)$q$, t.tabela))::text)
  FROM (VALUES
    ('atividades', 'exists (select 1 from pessoas p where p.lead_id_legado = s.lead_id) or exists (select 1 from aquisicoes a where a.lead_legado_id = s.lead_id) or exists (select 1 from oportunidades o where o.negocio_id_legado = s.negocio_id)'),
    ('notas', 'exists (select 1 from pessoas p where p.lead_id_legado = s.lead_id) or exists (select 1 from aquisicoes a where a.lead_legado_id = s.lead_id) or exists (select 1 from oportunidades o where o.negocio_id_legado = s.negocio_id) or s.empresa_id is not null'),
    ('status_changes', 'exists (select 1 from pessoas p where p.lead_id_legado = s.lead_id) or exists (select 1 from aquisicoes a where a.lead_legado_id = s.lead_id) or exists (select 1 from oportunidades o where o.negocio_id_legado = s.negocio_id)'),
    ('ligacoes', 'exists (select 1 from pessoas p where p.lead_id_legado = s.lead_id) or exists (select 1 from aquisicoes a where a.lead_legado_id = s.lead_id) or exists (select 1 from oportunidades o where o.negocio_id_legado = s.negocio_id)')
  ) t(tabela, ancora);

-- communications: uma por mensagem; e-mail repetido por message_id colapsa na primeira (unique canal+external_id).
SELECT pg_temp.mz_eq('10', 'communications whatsapp',
  pg_temp.mz_cnt('select count(*) from communications where canal = ''whatsapp'''),
  pg_temp.mz_cnt('select count(distinct coalesce(uazapi_message_id, id::text)) from whatsapp_mensagens'));
SELECT pg_temp.mz_eq('10', 'communications ligacao',
  pg_temp.mz_cnt('select count(*) from communications where canal = ''ligacao'''),
  pg_temp.mz_cnt('select count(distinct coalesce(callface_call_id, id::text)) from ligacoes'));
SELECT pg_temp.mz_eq('10', 'communications email',
  pg_temp.mz_cnt('select count(*) from communications where canal = ''email'''),
  pg_temp.mz_cnt('select count(distinct coalesce(message_id, id::text)) from emails'));
SELECT pg_temp.mz_eq('10', 'communications whatsapp: mensagens fora de communications',
  pg_temp.mz_cnt('select count(*) from whatsapp_mensagens w where not exists (select 1 from communications c where c.origem_tabela = ''whatsapp_mensagens'' and c.origem_legado_id = w.id)'), 0);
SELECT pg_temp.mz_info('10', 'communications ' || canal || ' sem pessoa', count(*)::text)
  FROM communications WHERE pessoa_id IS NULL GROUP BY canal;
SELECT pg_temp.mz_info('10', 'timeline_events total', count(*)::text) FROM timeline_events;
\o

\if :{?mz_acumula}
\else
  SELECT grupo, nome, obtido, esperado, CASE WHEN info THEN 'info' WHEN ok THEN 'ok' ELSE 'FALHOU' END AS resultado
    FROM _mz_res ORDER BY ordem;
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM _mz_res WHERE NOT ok) THEN
      RAISE EXCEPTION 'check % falhou: %', (SELECT string_agg(DISTINCT grupo, ',') FROM _mz_res WHERE NOT ok),
        (SELECT string_agg(nome || ' (obtido ' || obtido || ', esperado ' || esperado || ')', '; ') FROM _mz_res WHERE NOT ok);
    END IF;
  END $$;
\endif
