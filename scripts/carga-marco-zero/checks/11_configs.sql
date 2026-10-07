-- CHECK do passo 11 · configs do ONFACE (agentes, automacoes, cadencias, templates). Roda depois de 11_configs_onface.sql.
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
-- Configs do ONFACE (mapa secao 5). Os 5 agentes, as 6 automacoes, as 4 cadencias etc. sao a lista fechada.
SELECT pg_temp.mz_eq('11', 'agentes publicados, claude_subscription, sem credencial',
  pg_temp.mz_cnt('select count(*) from ai_agents a join ai_agent_versions v on v.id = a.published_version_id
                   where a.status = ''published'' and v.status = ''published'' and v.provider = ''claude_subscription'' and v.credential_id is null'), 5);
SELECT pg_temp.mz_eq('11', 'agentes no total', pg_temp.mz_cnt('select count(*) from ai_agents'), 5);
SELECT pg_temp.mz_eq('11', 'agentes com created_by_id (era qa.e2e)', pg_temp.mz_cnt('select count(*) from ai_agents where created_by_id is not null'), 0);
SELECT pg_temp.mz_eq('11', 'versoes de agente com credencial', pg_temp.mz_cnt('select count(*) from ai_agent_versions where credential_id is not null'), 0);
SELECT pg_temp.mz_eq('11', 'agentes sem versao publicada apontada', pg_temp.mz_cnt('select count(*) from ai_agents where published_version_id is null'), 0);

SELECT pg_temp.mz_eq('11', 'cadencias', pg_temp.mz_cnt('select count(*) from cadence_definitions'), 4);
SELECT pg_temp.mz_eq('11', 'cadencias inbound e no-show fora de draft/inativas',
  pg_temp.mz_cnt('select count(*) from cadence_definitions where nome in (''Primeiro contato inbound'', ''Recuperação de no-show'') and (status <> ''draft'' or ativo)'), 0);
SELECT pg_temp.mz_eq('11', 'cadencias inbound e no-show com versao publicada apontada',
  pg_temp.mz_cnt('select count(*) from cadence_definition_pointers p join cadence_definitions d on d.id = p.cadence_definition_id
                   where d.nome in (''Primeiro contato inbound'', ''Recuperação de no-show'') and p.published_version_id is not null'), 0);
SELECT pg_temp.mz_eq('11', 'cadencias sem ponteiro', pg_temp.mz_cnt('select count(*) from cadence_definitions d where not exists (select 1 from cadence_definition_pointers p where p.cadence_definition_id = d.id)'), 0);
SELECT pg_temp.mz_eq('11', 'cadence_enrollments (devem nascer vazios)', pg_temp.mz_cnt('select count(*) from cadence_enrollments'), 0);

SELECT pg_temp.mz_eq('11', 'automacoes', pg_temp.mz_cnt('select count(*) from automacoes'), 6);
SELECT pg_temp.mz_eq('11', 'automacoes ativas (entram desligadas)', pg_temp.mz_cnt('select count(*) from automacoes where ativo'), 0);
SELECT pg_temp.mz_eq('11', 'automacoes sem versao', pg_temp.mz_cnt('select count(*) from automacoes where current_version_id is null'), 0);
SELECT pg_temp.mz_eq('11', 'nomes de automacao repetidos', pg_temp.mz_cnt('select count(*) from (select 1 from automacoes group by organizacao_id, nome having count(*) > 1) x'), 0);
SELECT pg_temp.mz_eq('11', 'execucoes/inscricoes de automacao (nao entram)', pg_temp.mz_cnt('select (select count(*) from automacao_execucoes) + (select count(*) from automacao_inscricoes)'), 0);
SELECT pg_temp.mz_eq('11', 'ai_agent_runs (nao entram)', pg_temp.mz_cnt('select count(*) from ai_agent_runs'), 0);

SELECT pg_temp.mz_min('11', 'whatsapp_templates', pg_temp.mz_cnt('select count(*) from whatsapp_templates'), 10);
SELECT pg_temp.mz_min('11', 'email_templates', pg_temp.mz_cnt('select count(*) from email_templates'), 4);
SELECT pg_temp.mz_eq('11', 'nomes repetidos em templates e scripts',
  pg_temp.mz_cnt('select (select count(*) from (select 1 from whatsapp_templates group by organizacao_id, nome having count(*) > 1) a)
                       + (select count(*) from (select 1 from email_templates group by organizacao_id, nome having count(*) > 1) b)
                       + (select count(*) from (select 1 from scripts_atendimento group by organizacao_id, titulo having count(*) > 1) c)
                       + (select count(*) from (select 1 from contrato_templates group by organizacao_id, nome, versao having count(*) > 1) d)'), 0);
SELECT pg_temp.mz_eq('11', 'contrato_templates', pg_temp.mz_cnt('select count(*) from contrato_templates'), 3);
SELECT pg_temp.mz_eq('11', 'scripts_atendimento', pg_temp.mz_cnt('select count(*) from scripts_atendimento'), 6);
SELECT pg_temp.mz_eq('11', 'usuarios qa.% (nao entram)', pg_temp.mz_cnt('select count(*) from usuarios where email like ''qa.%'''), 0);
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
