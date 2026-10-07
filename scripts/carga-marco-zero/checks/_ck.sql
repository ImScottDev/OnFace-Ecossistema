-- Helpers dos checks (incluido com \ir _ck.sql). Cada check acumula as falhas em
-- uma string e termina em RAISE EXCEPTION se sobrar alguma, para o run.sh parar.
--   pg_temp.ck(rotulo, atual, esperado)  '' se bater, senao a linha da falha
--   pg_temp.esp(chave)                   numero esperado em _mz_esperado (erro se nao existir)
\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION pg_temp.ck(rotulo text, atual bigint, esperado bigint) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN atual IS NOT DISTINCT FROM esperado THEN ''
              ELSE format(E'\n  %s: %s (esperado %s)', rotulo, atual, esperado) END $$;
CREATE OR REPLACE FUNCTION pg_temp.esp(k text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v bigint;
BEGIN
  SELECT valor INTO v FROM _mz_esperado WHERE chave = k;
  IF NOT FOUND THEN RAISE EXCEPTION '_mz_esperado sem a chave %', k; END IF;
  RETURN v;
END $$;
