-- PASSO 11 · Configs do ONFACE (mapa secao 5, handoff P20/P21).
-- Le configs/*.json (gerados por export-configs.sh) e nunca o banco de dev.
--
-- Roda com o diretorio dos JSON em :cfgdir (padrao 'configs', relativo ao cwd do
-- psql; o run.sh deve passar -v cfgdir="$DIR/configs").
-- Depende: 0 (organizacoes, migration 0071 com NEXO/Hermes), 1 (usuarios), 2.
--
-- Politica de cada item:
--   agentes     os 5 PUBLICADOS e LIGADOS, provider claude_subscription,
--               credential_id NULL, created_by_id NULL (hoje e qa.e2e).
--   automacoes  entram com ativo=false ate o checklist de outbox e allowlist.
--   cadencias   'Primeiro contato inbound' e 'Recuperacao de no-show' em draft
--               (Callpilot automatico pausado; meeting.no_show nao esta na ponte).
--   templates   dedup ja feito no export.
-- Ordem em tabelas com ponteiro circular: pai com ponteiro NULL, depois a versao,
-- depois o UPDATE do ponteiro. Idempotente: ON CONFLICT (id) DO UPDATE ... WHERE
-- distinto, e nenhum UPDATE grava updated_at = now() a mais do que o necessario.

\set ON_ERROR_STOP on
\if :{?cfgdir}
\else
  \set cfgdir configs
\endif

BEGIN;

-- Uma organizacao so. Se um dia houver mais de uma, este passo precisa decidir de quem e a config.
DO $$ BEGIN
  IF (SELECT count(*) FROM organizacoes) <> 1 THEN
    RAISE EXCEPTION 'passo 11 espera exatamente 1 organizacao, achou %', (SELECT count(*) FROM organizacoes);
  END IF;
END $$;

-- Helper: upsert de um array JSON numa tabela. Usa so as colunas que existem no
-- JSON E na tabela (coluna nova no destino toma o default em vez de virar NULL).
-- sobrescreve: {coluna: 'expressao sql'} troca o valor vindo do JSON.
CREATE FUNCTION pg_temp.mz_cfg(tabela text, arr jsonb, sobrescreve jsonb DEFAULT '{}') RETURNS bigint
LANGUAGE plpgsql AS $f$
DECLARE cols text[]; sel text; atualiza text; novo text; velho text; n bigint;
BEGIN
  IF jsonb_array_length(arr) = 0 THEN RETURN 0; END IF;
  SELECT array_agg(c.column_name::text ORDER BY c.ordinal_position) INTO cols
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = tabela
     AND (arr->0) ? c.column_name::text;
  SELECT string_agg(coalesce(sobrescreve->>c, 'r.' || quote_ident(c)) || ' AS ' || quote_ident(c), ', ') INTO sel
    FROM unnest(cols) c;
  SELECT string_agg(quote_ident(c) || ' = EXCLUDED.' || quote_ident(c), ', '),
         string_agg('t.' || quote_ident(c), ', '), string_agg('EXCLUDED.' || quote_ident(c), ', ')
    INTO atualiza, velho, novo FROM unnest(cols) c WHERE c <> 'id';
  EXECUTE format(
    'INSERT INTO public.%1$I AS t (%2$s) SELECT %3$s FROM jsonb_populate_recordset(NULL::public.%1$I, $1) r
       ON CONFLICT (id) DO UPDATE SET %4$s WHERE (%5$s) IS DISTINCT FROM (%6$s)',
    tabela, (SELECT string_agg(quote_ident(c), ', ') FROM unnest(cols) c), sel, atualiza, velho, novo)
    USING arr;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $f$;

\set org '(SELECT id FROM public.organizacoes)'

-- ─── 1. Agentes ────────────────────────────────────────────────────────────
-- NEXO e Hermes ja existem (migration 0071, ids proprios): casa por (org, slug) e
-- reaproveita o id do destino, senao as versoes ficariam penduradas no agente errado.
\set j `cat ":cfgdir/ai_agents.json"`
\set jv `cat ":cfgdir/ai_agent_versions.json"`

CREATE TEMP TABLE _mz_agentes AS
SELECT e->>'slug' AS slug, (e->>'id')::uuid AS orig_id, e AS j,
       coalesce((SELECT a.id FROM ai_agents a WHERE a.organizacao_id = (SELECT id FROM organizacoes) AND a.slug = e->>'slug'),
                (e->>'id')::uuid) AS id
  FROM jsonb_array_elements(:'j'::jsonb) e;

-- A politica (publicado, claude_subscription, sem credencial) entra no JSON ANTES do
-- upsert, e nao em UPDATE depois: senao cada reexecucao desfaria e refaria a mudanca,
-- reescrevendo as linhas e o updated_at. created_by_id/credential_id nem existem no JSON.
SELECT pg_temp.mz_cfg('ai_agents',
  (SELECT jsonb_agg(j || jsonb_build_object('id', id, 'status', 'published')) FROM _mz_agentes),
  jsonb_build_object('organizacao_id', :'org')) AS agentes_tocados;

-- Versoes: o id tambem vem do destino quando (agente, versao) ja existe.
CREATE TEMP TABLE _mz_versoes AS
SELECT ag.id AS agent_id, (e->>'versao')::int AS versao, e AS j,
       coalesce((SELECT v.id FROM ai_agent_versions v WHERE v.agent_id = ag.id AND v.versao = (e->>'versao')::int),
                (e->>'id')::uuid) AS id
  FROM jsonb_array_elements(:'jv'::jsonb) e
  JOIN _mz_agentes ag ON ag.orig_id = (e->>'agent_id')::uuid;

SELECT pg_temp.mz_cfg('ai_agent_versions',
  (SELECT jsonb_agg(j || jsonb_build_object('id', id, 'agent_id', agent_id, 'status', 'published',
            'provider', 'claude_subscription', 'modelo', coalesce(j->>'modelo', 'claude-sonnet-4-6'),
            'published_at', coalesce(j->>'published_at', j->>'created_at')))
     FROM _mz_versoes),
  jsonb_build_object('organizacao_id', :'org')) AS versoes_tocadas;

-- Ponteiro da versao publicada (so existe depois das versoes). Guardado por IS DISTINCT.
UPDATE ai_agents a SET published_version_id = v.id
  FROM _mz_versoes v
 WHERE a.id = v.agent_id AND v.versao = 1 AND a.published_version_id IS DISTINCT FROM v.id;

-- ─── 2. Automacoes (ativo=false) ───────────────────────────────────────────
\set j `cat ":cfgdir/automacoes.json"`
\set jv `cat ":cfgdir/automacao_versoes.json"`
-- O pai entra SEM current_version_id (a chave sai do JSON); o UPDATE abaixo liga o ponteiro.
SELECT pg_temp.mz_cfg('automacoes',
  (SELECT jsonb_agg(e - 'current_version_id') FROM jsonb_array_elements(:'j'::jsonb) e),
  jsonb_build_object('organizacao_id', :'org', 'ativo', 'false')) AS automacoes_tocadas;
SELECT pg_temp.mz_cfg('automacao_versoes', :'jv'::jsonb, jsonb_build_object('organizacao_id', :'org')) AS versoes_auto_tocadas;
UPDATE automacoes a SET current_version_id = (e->>'current_version_id')::uuid
  FROM jsonb_array_elements(:'j'::jsonb) e
 WHERE a.id = (e->>'id')::uuid AND a.current_version_id IS DISTINCT FROM (e->>'current_version_id')::uuid;

-- ─── 3. Cadencias ──────────────────────────────────────────────────────────
-- P20: inbound e no-show nao podem disparar. A politica e aplicada no JSON ANTES do
-- upsert (e nao em UPDATE depois), senao cada reexecucao desfaria e refaria a mudanca.
-- Definicao e versoes voltam a draft, sem publicada; o rascunho (versao 2) segue como ponteiro.
\set j `cat ":cfgdir/cadence_definitions.json"`
\set jv `cat ":cfgdir/cadence_versions.json"`
\set jp `cat ":cfgdir/cadence_definition_pointers.json"`
CREATE TEMP TABLE _mz_cad_draft AS
SELECT (e->>'id')::uuid AS id FROM jsonb_array_elements(:'j'::jsonb) e
 WHERE e->>'nome' IN ('Primeiro contato inbound', 'Recuperação de no-show');

SELECT pg_temp.mz_cfg('cadence_definitions',
  (SELECT jsonb_agg(CASE WHEN (e->>'id')::uuid IN (SELECT id FROM _mz_cad_draft)
                         THEN e || '{"status":"draft","ativo":false,"published_at":null}' ELSE e END)
     FROM jsonb_array_elements(:'j'::jsonb) e),
  jsonb_build_object('organizacao_id', :'org')) AS cadencias_tocadas;
SELECT pg_temp.mz_cfg('cadence_versions',
  (SELECT jsonb_agg(CASE WHEN (e->>'cadence_definition_id')::uuid IN (SELECT id FROM _mz_cad_draft)
                         THEN e || '{"status":"draft","published_at":null}' ELSE e END)
     FROM jsonb_array_elements(:'jv'::jsonb) e),
  jsonb_build_object('organizacao_id', :'org')) AS versoes_cad_tocadas;
-- Ponteiro: a PK e cadence_definition_id (nao tem coluna id), entao vai em SQL direto.
INSERT INTO cadence_definition_pointers (cadence_definition_id, organizacao_id, draft_version_id, published_version_id)
SELECT (e->>'cadence_definition_id')::uuid, (SELECT id FROM organizacoes), (e->>'draft_version_id')::uuid,
       CASE WHEN (e->>'cadence_definition_id')::uuid IN (SELECT id FROM _mz_cad_draft)
            THEN NULL ELSE (e->>'published_version_id')::uuid END
  FROM jsonb_array_elements(:'jp'::jsonb) e
ON CONFLICT (cadence_definition_id) DO UPDATE
   SET draft_version_id = EXCLUDED.draft_version_id, published_version_id = EXCLUDED.published_version_id
 WHERE (cadence_definition_pointers.draft_version_id, cadence_definition_pointers.published_version_id)
       IS DISTINCT FROM (EXCLUDED.draft_version_id, EXCLUDED.published_version_id);

-- ─── 4. Templates e scripts ────────────────────────────────────────────────
\set j `cat ":cfgdir/whatsapp_templates.json"`
SELECT pg_temp.mz_cfg('whatsapp_templates', :'j'::jsonb, jsonb_build_object('organizacao_id', :'org')) AS wa_templates;
\set j `cat ":cfgdir/email_templates.json"`
SELECT pg_temp.mz_cfg('email_templates', :'j'::jsonb, jsonb_build_object('organizacao_id', :'org')) AS email_templates;
\set j `cat ":cfgdir/contrato_templates.json"`
SELECT pg_temp.mz_cfg('contrato_templates', :'j'::jsonb, jsonb_build_object('organizacao_id', :'org')) AS contrato_templates;
\set j `cat ":cfgdir/scripts_atendimento.json"`
SELECT pg_temp.mz_cfg('scripts_atendimento', :'j'::jsonb, jsonb_build_object('organizacao_id', :'org')) AS scripts;

COMMIT;
