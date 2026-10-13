#!/usr/bin/env bash
# CARGA ADITIVA · prova de que nada foi perdido. Compara o banco ALVO (depois)
# com um banco "antes" (copia/backup tirado antes da carga), tabela a tabela:
#   perdidas   linhas do ANTES que nao existem mais no DEPOIS (por chave primaria; sem PK, por linha inteira)
#   alteradas  mesma chave, conteudo diferente (a carga mexeu)
#   novas      linhas do DEPOIS que nao existiam no ANTES
# Saida: tabela x contagens (so tabelas com algo) e, com --colunas, quais colunas mudaram.
# Somente leitura no alvo (cria e remove o schema foreign `antes`).
#
#   ./comparar.sh <banco_alvo> <banco_antes> [--colunas]
# Conexao: PGHOST/PGPORT/PGUSER/PGPASSWORD do ambiente (o antes tem que estar no mesmo servidor).
set -euo pipefail
ALVO="${1:?uso: $0 <alvo> <antes> [--colunas]}"; ANTES="${2:?}"; COLS="${3:-}"
PSQL="${PSQL:-psql}"; export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
H="${ANTES_HOST:-${PGHOST:-localhost}}"; P="${ANTES_PORT:-${PGPORT:-5432}}"; U="${PGUSER:-$(id -un)}"
q() { "$PSQL" -X -q -d "$ALVO" -v ON_ERROR_STOP=1 "$@"; }
q -c "CREATE EXTENSION IF NOT EXISTS postgres_fdw" >/dev/null
q <<SQL
DROP SCHEMA IF EXISTS antes CASCADE; DROP SERVER IF EXISTS antes_srv CASCADE;
CREATE SERVER antes_srv FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host '$H', port '$P', dbname '$ANTES');
CREATE USER MAPPING FOR CURRENT_USER SERVER antes_srv OPTIONS (user '$U'${PGPASSWORD:+, password '$PGPASSWORD'});
CREATE SCHEMA antes;
IMPORT FOREIGN SCHEMA public FROM SERVER antes_srv INTO antes;
SQL
trap 'q -c "DROP SCHEMA IF EXISTS antes CASCADE; DROP SERVER IF EXISTS antes_srv CASCADE" >/dev/null' EXIT
q -P pager=off <<'SQL'
CREATE FUNCTION pg_temp.cmp() RETURNS TABLE(tabela text, antes bigint, depois bigint, perdidas bigint, alteradas bigint, novas bigint)
LANGUAGE plpgsql AS $f$
DECLARE r record; pk text; pka text; pkd text; a bigint; d bigint; p bigint; c bigint; n bigint;
BEGIN
  FOR r IN SELECT c.relname AS t FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
            WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relname !~ '^(_mz_|_carga_|tmp_)'
              AND to_regclass('antes.' || quote_ident(c.relname)) IS NOT NULL ORDER BY 1 LOOP
    SELECT string_agg(quote_ident(x.attname), ',' ORDER BY k.ord),
           string_agg('a.' || quote_ident(x.attname), ',' ORDER BY k.ord),
           string_agg('d.' || quote_ident(x.attname), ',' ORDER BY k.ord)
      INTO pk, pka, pkd
      FROM pg_index i CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum, ord)
      JOIN pg_attribute x ON x.attrelid = i.indrelid AND x.attnum = k.attnum
     WHERE i.indrelid = ('public.' || quote_ident(r.t))::regclass AND i.indisprimary;
    EXECUTE format('SELECT count(*) FROM antes.%I', r.t) INTO a;
    EXECUTE format('SELECT count(*) FROM public.%I', r.t) INTO d;
    IF pk IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM antes.%1$I a WHERE NOT EXISTS (SELECT 1 FROM public.%1$I d WHERE (%2$s) = (%3$s))', r.t, pkd, pka) INTO p;
      EXECUTE format('SELECT count(*) FROM public.%1$I d WHERE NOT EXISTS (SELECT 1 FROM antes.%1$I a WHERE (%2$s) = (%3$s))', r.t, pkd, pka) INTO n;
      EXECUTE format('SELECT count(*) FROM antes.%1$I a JOIN public.%1$I d ON (%2$s) = (%3$s) WHERE to_jsonb(a) IS DISTINCT FROM to_jsonb(d)', r.t, pka, pkd) INTO c;
    ELSE
      EXECUTE format('SELECT count(*) FROM (SELECT to_jsonb(a) FROM antes.%1$I a EXCEPT ALL SELECT to_jsonb(d) FROM public.%1$I d) x', r.t) INTO p;
      EXECUTE format('SELECT count(*) FROM (SELECT to_jsonb(d) FROM public.%1$I d EXCEPT ALL SELECT to_jsonb(a) FROM antes.%1$I a) x', r.t) INTO n;
      c := NULL;
    END IF;
    tabela := r.t || CASE WHEN pk IS NULL THEN ' (sem PK)' ELSE '' END; antes := a; depois := d; perdidas := p; alteradas := c; novas := n;
    RETURN NEXT;
  END LOOP;
END $f$;
SELECT * FROM pg_temp.cmp() WHERE perdidas <> 0 OR coalesce(alteradas, 0) <> 0 OR novas <> 0 OR antes <> depois ORDER BY 1;
SELECT 'TOTAL perdidas' AS item, coalesce(sum(perdidas), 0) AS valor FROM pg_temp.cmp();
SQL
if [ "$COLS" = "--colunas" ]; then
q -P pager=off <<'SQL'
CREATE FUNCTION pg_temp.cols() RETURNS TABLE(tabela text, coluna text, linhas bigint) LANGUAGE plpgsql AS $f$
DECLARE r record; pk text; pka text; pkd text;
BEGIN
  FOR r IN SELECT c.relname AS t FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
            WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relname !~ '^(_mz_|_carga_|tmp_)'
              AND to_regclass('antes.' || quote_ident(c.relname)) IS NOT NULL ORDER BY 1 LOOP
    SELECT string_agg('a.' || quote_ident(x.attname), ',' ORDER BY k.ord), string_agg('d.' || quote_ident(x.attname), ',' ORDER BY k.ord)
      INTO pka, pkd
      FROM pg_index i CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum, ord)
      JOIN pg_attribute x ON x.attrelid = i.indrelid AND x.attnum = k.attnum
     WHERE i.indrelid = ('public.' || quote_ident(r.t))::regclass AND i.indisprimary;
    CONTINUE WHEN pka IS NULL;
    RETURN QUERY EXECUTE format(
      'SELECT %L::text, e.k, count(*) FROM antes.%2$I a JOIN public.%2$I d ON (%3$s) = (%4$s),
         LATERAL jsonb_each(to_jsonb(a)) e(k, v) WHERE to_jsonb(d) -> e.k IS DISTINCT FROM e.v GROUP BY e.k', r.t, r.t, pka, pkd);
  END LOOP;
END $f$;
SELECT * FROM pg_temp.cols() ORDER BY 1, 3 DESC;
SQL
fi
