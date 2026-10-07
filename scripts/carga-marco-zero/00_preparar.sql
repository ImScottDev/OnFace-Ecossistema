-- CARGA MARCO ZERO · passo 00 · preparar.
-- Liga o banco de PROD (dump fresco do minuto da virada) ao alvo por postgres_fdw,
-- importa o schema inteiro em `legado` e cria as tres tabelas de apoio dos
-- passos seguintes. NAO escreve em nenhuma tabela de negocio.
--
-- Variaveis psql (o run.sh passa todas): legado_db (obrigatoria), legado_host,
-- legado_port, legado_user, legado_pass, inicio.
--
-- Tabelas de apoio (persistem no alvo ate `run.sh --limpar`):
--   _mz_meta          chave/valor; 'inicio' = horario de inicio da carga, lido pelo
--                     check final de updated_at.
--   _mz_depara        status legado de negocio -> etapa, status novo, motivo.
--   _mz_negocio_depara  o de-para aplicado a CADA negocio (etapa, status novo,
--                     motivo de perda, datas de perdido/ganho/no-show/trial).
--                     Uma fonte so: 03 (lead x negocio aberto), 04 e 05 leem dela.
--   _mz_esperado      contagens que o dump fresco deve produzir (chave, valor
--                     recalculado agora, base_06out = numero do mapa em 06/10).
--                     Os checks comparam o ALVO contra `valor`; quando `valor` e
--                     `base_06out` divergem o passo avisa (o dump mudou), o que
--                     nao e erro.
\set ON_ERROR_STOP on
\if :{?legado_db}
\else
  \echo 'falta -v legado_db=<banco de prod>'
  \quit
\endif
\if :{?legado_host}
\else
  \set legado_host localhost
\endif
\if :{?legado_port}
\else
  \set legado_port 5432
\endif
\if :{?legado_user}
\else
  \set legado_user :USER
\endif
\if :{?legado_pass}
\else
  \set legado_pass ''
\endif
\if :{?inicio}
\else
  \set inicio `date -u +%Y-%m-%dT%H:%M:%SZ`
\endif

CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- Servidor e mapeamento recriados a cada execucao: a origem pode ter mudado de
-- host/banco entre o ensaio e a virada.
DROP SCHEMA IF EXISTS legado CASCADE;
DROP SERVER IF EXISTS legado CASCADE;
SELECT format('CREATE SERVER legado FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host %L, port %L, dbname %L)',
              :'legado_host', :'legado_port', :'legado_db') \gexec
SELECT format('CREATE USER MAPPING FOR CURRENT_USER SERVER legado OPTIONS (user %L%s)',
              :'legado_user',
              CASE WHEN :'legado_pass' <> '' THEN format(', password %L', :'legado_pass') ELSE '' END) \gexec
CREATE SCHEMA legado;
IMPORT FOREIGN SCHEMA public FROM SERVER legado INTO legado;

-- A origem tem que ser prod de verdade: sem estas tabelas o passo seguinte
-- carregaria zero linhas sem reclamar.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['usuarios','empresas','leads','negocios','status_changes','negocio_leads','labels'] LOOP
    IF to_regclass('legado.' || t) IS NULL THEN
      RAISE EXCEPTION 'legado sem a tabela % (banco de origem errado?)', t;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM legado.leads) = 0 THEN RAISE EXCEPTION 'legado.leads vazio'; END IF;
END $$;

-- ───────────────────────── _mz_meta ─────────────────────────
CREATE TABLE IF NOT EXISTS _mz_meta (chave text PRIMARY KEY, valor text NOT NULL);
INSERT INTO _mz_meta VALUES ('inicio', :'inicio'), ('legado_db', :'legado_db')
  ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;

-- ───────────────────────── _mz_depara ─────────────────────────
-- [Scott 06/10] reuniao_agendada=entrada; reuniao_realizada=diagnostico; trial e
-- proposta_apresentada=proposta; negociacao_iniciada=negociacao; ganho; perdido;
-- no_show=perdido (motivo no_show); outra_data, sem_retorno, trava_negociacao e
-- trava_assinatura=perdido com motivo. 'ativo' (copia de carteira) fica FORA do
-- funil: etapa NULL e status 'ativo'.
DROP TABLE IF EXISTS _mz_depara CASCADE;
CREATE TABLE _mz_depara (
  status_legado text PRIMARY KEY,
  etapa         text,        -- codigo de pipeline_etapas; NULL = fora do funil
  status_novo   text NOT NULL, -- negocios.status (STATUS_LEGADO_DA_ETAPA, dominio.ts)
  motivo_chave  text,        -- MOTIVOS_PERDA; NULL no 'perdido' (sai do texto livre)
  estagnado     boolean NOT NULL DEFAULT false
);
INSERT INTO _mz_depara VALUES
  ('reuniao_agendada',     'entrada',     'reuniao_agendada',     NULL, false),
  ('reuniao_realizada',    'diagnostico', 'reuniao_realizada',    NULL, false),
  ('trial',                'proposta',    'proposta_apresentada', NULL, false),
  ('proposta_apresentada', 'proposta',    'proposta_apresentada', NULL, false),
  ('negociacao_iniciada',  'negociacao',  'negociacao_iniciada',  NULL, false),
  ('ganho',                'ganho',       'ganho',                NULL, false),
  ('perdido',              'perdido',     'perdido',              NULL, false),
  ('no_show',              'perdido',     'perdido',              'no_show', false),
  ('outra_data',           'perdido',     'perdido',              'timing', true),
  ('sem_retorno',          'perdido',     'perdido',              'sem_retorno', true),
  ('trava_negociacao',     'perdido',     'perdido',              'trava_negociacao', true),
  ('trava_assinatura',     'perdido',     'perdido',              'trava_contratual', true),
  ('ativo',                NULL,          'ativo',                NULL, false);

-- ───────────────────────── _mz_negocio_depara ─────────────────────────
-- Texto livre de perda -> MOTIVOS_PERDA (dominio.ts). O original vai para
-- motivo_perda_detalhe no passo 05. O que nao casa e 'outro', nunca descartado.
CREATE FUNCTION pg_temp.mz_motivo_perda(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN t IS NULL OR btrim(t) = '' THEN 'outro'
    WHEN t ~* '^\s*(outro|erro_operacional)\s*$' THEN 'outro'
    WHEN t ~* 'nao_respondeu|acompanhamentos perdidos|aus.ncia de respostas|sem retorno' THEN 'sem_retorno'
    WHEN t ~* 'concorr|fechou com a |propostas melhores' THEN 'concorrente'
    WHEN t ~* 'fora_perfil|n\S{1,3}\s+qualificado' THEN 'sem_fit'
    WHEN t ~* 'pre.o|valor|preco_alto' THEN 'preco'
    WHEN t ~* 'budget|verba|condi..es financeiras' THEN 'sem_orcamento'
    WHEN t ~* 'internalizar|troca de ferramenta|upgrad' THEN 'projeto_cancelado'
    WHEN t ~* 'sem interesse' THEN 'sem_interesse'
    ELSE 'outro'
  END $$;

DROP TABLE IF EXISTS _mz_negocio_depara CASCADE;
CREATE TABLE _mz_negocio_depara AS
WITH sc AS (
  SELECT negocio_id, para_status, max(created_at) AS ultimo, count(*) AS n
    FROM legado.status_changes WHERE negocio_id IS NOT NULL GROUP BY 1, 2
)
SELECT n.id AS negocio_id,
       n.lead_id,
       n.status AS status_legado,
       d.etapa,
       coalesce(d.status_novo, n.status) AS status_novo,
       d.estagnado,
       -- perdido: chave sai do texto livre; estagnado e no-show: chave fixa do de-para
       CASE WHEN d.status_novo = 'perdido'
            THEN coalesce(d.motivo_chave, pg_temp.mz_motivo_perda(n.motivo_perda)) END AS motivo_chave,
       (coalesce(d.status_novo, n.status) IN ('reuniao_agendada','reuniao_realizada','proposta_apresentada','negociacao_iniciada')) AS aberto,
       -- datas do fato ORIGINAL (nunca now(), nunca a data da carga)
       CASE WHEN d.status_novo = 'perdido' THEN coalesce(sc_orig.ultimo, n.updated_at) END AS perdido_at,
       CASE WHEN n.status = 'ganho' THEN coalesce(n.ganho_at, sc_orig.ultimo, n.updated_at) END AS ganho_at,
       CASE WHEN d.estagnado THEN coalesce(sc_orig.ultimo, n.updated_at) END AS estagnado_em,
       coalesce(sc_ns.ultimo, CASE WHEN n.status = 'no_show' THEN n.updated_at END) AS no_show_em,
       greatest(coalesce(sc_ns.n, 0), CASE WHEN n.status = 'no_show' THEN 1 ELSE 0 END)::int AS no_show_contagem,
       coalesce(sc_tr.ultimo, CASE WHEN n.status = 'trial' THEN n.updated_at END) AS trial_iniciado_em,
       CASE WHEN d.etapa IS NOT NULL THEN coalesce(sc_orig.ultimo, n.updated_at) END AS etapa_desde,
       -- 'perdido'/'no_show'/estagnado sem status_changes proprio => o passo 05 cria o sintetico
       (d.status_novo = 'perdido' AND sc_perd.negocio_id IS NULL) AS precisa_sintetico
  FROM legado.negocios n
  LEFT JOIN _mz_depara d ON d.status_legado = n.status
  LEFT JOIN sc sc_orig ON sc_orig.negocio_id = n.id AND sc_orig.para_status = n.status
  LEFT JOIN sc sc_ns   ON sc_ns.negocio_id = n.id AND sc_ns.para_status = 'no_show'
  LEFT JOIN sc sc_tr   ON sc_tr.negocio_id = n.id AND sc_tr.para_status = 'trial'
  LEFT JOIN sc sc_perd ON sc_perd.negocio_id = n.id AND sc_perd.para_status = 'perdido';
ALTER TABLE _mz_negocio_depara ADD PRIMARY KEY (negocio_id);
CREATE INDEX ON _mz_negocio_depara (lead_id);

-- Status que o de-para nao conhece: parar agora e melhor que carregar etapa NULL.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT status_legado, count(*) n FROM _mz_negocio_depara WHERE status_novo = status_legado AND etapa IS NULL AND status_legado <> 'ativo' GROUP BY 1 LOOP
    RAISE EXCEPTION 'status de negocio sem de-para: % (% linhas). Decida a etapa e inclua em _mz_depara.', r.status_legado, r.n;
  END LOOP;
END $$;

-- ───────────────────────── _mz_esperado ─────────────────────────
DROP TABLE IF EXISTS _mz_esperado CASCADE;
CREATE TABLE _mz_esperado (chave text PRIMARY KEY, valor bigint NOT NULL, base_06out bigint, nota text);
-- (chave, expressao que conta no legado, numero do mapa em 06/10)
INSERT INTO _mz_esperado (chave, valor, base_06out)
SELECT c, v, b FROM (VALUES
  ('usuarios',        (SELECT count(*) FROM legado.usuarios WHERE email NOT LIKE 'qa.%'), 16),
  ('leads',           (SELECT count(*) FROM legado.leads), 4084),
  ('negocios',        (SELECT count(*) FROM legado.negocios), 1620),
  ('negocio_leads',   (SELECT count(*) FROM legado.negocio_leads), 1244),
  ('etapa_entrada',     (SELECT count(*) FROM _mz_negocio_depara WHERE etapa = 'entrada'), 20),
  ('etapa_diagnostico', (SELECT count(*) FROM _mz_negocio_depara WHERE etapa = 'diagnostico'), 13),
  ('etapa_proposta',    (SELECT count(*) FROM _mz_negocio_depara WHERE etapa = 'proposta'), 56),
  ('etapa_negociacao',  (SELECT count(*) FROM _mz_negocio_depara WHERE etapa = 'negociacao'), 6),
  ('etapa_ganho',       (SELECT count(*) FROM _mz_negocio_depara WHERE etapa = 'ganho'), 618),
  ('etapa_perdido',     (SELECT count(*) FROM _mz_negocio_depara WHERE etapa = 'perdido'), 746),
  ('negocios_ativo_copia', (SELECT count(*) FROM _mz_negocio_depara WHERE status_legado = 'ativo'), 161),
  ('service_family_nao_nula', (SELECT count(*) FROM legado.negocios WHERE service_family IS NOT NULL), 2),
  ('commercial_expansion',    (SELECT count(*) FROM legado.negocios WHERE origem_negocio = 'carteira'), 164),
  ('cnpj_duplicado_extras', (SELECT coalesce(sum(n - 1), 0) FROM (
        SELECT count(*) n FROM legado.empresas
         WHERE length(regexp_replace(coalesce(cnpj, ''), '\D', '', 'g')) IN (11, 14)
           AND regexp_replace(cnpj, '\D', '', 'g') !~ '^(\d)\1+$'   -- mesma regra do merge no 03
         GROUP BY regexp_replace(cnpj, '\D', '', 'g') HAVING count(*) > 1) x), 17),
  ('empresas',        (SELECT count(*) FROM legado.empresas), 2293),
  -- consumidos pelos checks dos passos 06 a 11 (outras frentes)
  ('contratos_sem_assinatura', (SELECT count(*) FROM legado.contratos WHERE lower(btrim(tipo)) IS DISTINCT FROM 'assinatura'), 441),
  ('propostas',       (SELECT count(*) FROM legado.propostas), 1585),
  ('proposta_itens',  (SELECT count(*) FROM legado.proposta_itens), 2762),
  ('faturas',         (SELECT count(*) FROM legado.faturas), 1085),
  ('fatura_itens',    (SELECT count(*) FROM legado.fatura_itens), 226),
  ('assinaturas',     (SELECT count(*) FROM legado.assinaturas), 378),
  ('mrr_movimentos',  (SELECT count(*) FROM legado.mrr_movimentos), 737),
  ('stripe_webhook_events', (SELECT count(*) FROM legado.stripe_webhook_events), 483),
  ('billing_identities',    (SELECT count(*) FROM legado.billing_identities), 224),
  ('tarefas_sem_filipe', (SELECT count(*) FROM legado.tarefas WHERE usuario_id IS DISTINCT FROM 'fcb69714-2213-4cb4-90e0-4c1d2a93c4bc'), 280),
  ('reunioes',        (SELECT count(*) FROM legado.reunioes), 328),
  ('ligacoes',        (SELECT count(*) FROM legado.ligacoes), 5786),
  ('emails',          (SELECT count(*) FROM legado.emails), 9530),
  ('whatsapp_mensagens', (SELECT count(*) FROM legado.whatsapp_mensagens), 33165)
) AS x(c, v, b);

SELECT chave, valor, base_06out FROM _mz_esperado WHERE valor IS DISTINCT FROM base_06out ORDER BY chave;
\echo '  (linhas acima: o dump fresco diverge do mapa de 06/10; os checks usam o valor recalculado)'
