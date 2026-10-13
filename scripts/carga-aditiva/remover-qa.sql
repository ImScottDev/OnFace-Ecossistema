-- Remove registros de QA/teste do alvo: [QA], [Teste], prova-, usuarios qa.*, @example.invalid, origem 'qa'.
-- Filhos: FK anulavel vira NULL (dado real que apontava para o QA fica), FK NOT NULL apaga o filho (recursivo).
-- NUNCA toca ai_agents / ai_agent_versions. Guarda o que apagou em _qa_removido (tabela, id, linha json).
-- Uso: psql -d <alvo> -v ON_ERROR_STOP=1 -1 -f remover-qa.sql
CREATE TABLE IF NOT EXISTS _qa_removido (tabela text, id text, linha jsonb, removido_em timestamptz DEFAULT now());
CREATE OR REPLACE FUNCTION pg_temp.qa_del(tab regclass, ids uuid[]) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE fk record; sub uuid[]; pkcol text;
BEGIN
  IF tab::text IN ('ai_agents','ai_agent_versions') THEN RAISE EXCEPTION 'QA referenciado por %', tab; END IF;
  FOR fk IN SELECT c.conrelid::regclass AS filho, a.attname AS col, a.attnotnull AS nn
              FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
             WHERE c.contype = 'f' AND c.confrelid = tab AND array_length(c.conkey, 1) = 1 LOOP
    IF NOT fk.nn THEN
      BEGIN
        EXECUTE format('UPDATE %s SET %I = NULL WHERE %I = ANY($1)', fk.filho, fk.col, fk.col) USING ids;
        CONTINUE;
      EXCEPTION WHEN check_violation OR not_null_violation THEN NULL;  -- NULL nao e permitido ali: apaga o filho
      END;
    END IF;
    IF true THEN
      SELECT a.attname INTO pkcol FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
       WHERE i.indrelid = fk.filho AND i.indisprimary AND i.indnatts = 1 AND a.atttypid = 'uuid'::regtype;
      IF pkcol IS NULL THEN
        EXECUTE format('DELETE FROM %s WHERE %I = ANY($1)', fk.filho, fk.col) USING ids;
      ELSE
        EXECUTE format('SELECT coalesce(array_agg(%I), ''{}'') FROM %s WHERE %I = ANY($1)', pkcol, fk.filho, fk.col) USING ids INTO sub;
        IF array_length(sub, 1) > 0 THEN PERFORM pg_temp.qa_del(fk.filho, sub); END IF;
      END IF;
    END IF;
  END LOOP;
  EXECUTE format('INSERT INTO _qa_removido SELECT %L, t.id::text, to_jsonb(t) FROM %s t WHERE t.id = ANY($1)', tab::text, tab) USING ids;
  EXECUTE format('DELETE FROM %s WHERE id = ANY($1)', tab) USING ids;
END $f$;
-- ordem: negocios e oportunidades, tarefas, contatos, pessoas, leads, empresas, usuarios
SELECT pg_temp.qa_del('negocios', coalesce(array_agg(id), '{}')) FROM negocios WHERE titulo ~* '^\[(qa|teste)\]|prova-';
SELECT pg_temp.qa_del('tarefas', coalesce(array_agg(id), '{}')) FROM tarefas WHERE titulo ~* '^\[(qa|teste)\]|prova-';
SELECT pg_temp.qa_del('contatos', coalesce(array_agg(id), '{}')) FROM contatos WHERE nome ~* '^\[(qa|teste)\]|prova-';
SELECT pg_temp.qa_del('pessoas', coalesce(array_agg(id), '{}')) FROM pessoas WHERE nome ~* '^\[(qa|teste)\]|prova-' OR email ~* '@example\.invalid';
SELECT pg_temp.qa_del('leads', coalesce(array_agg(id), '{}')) FROM leads WHERE origem = 'qa' OR nome ~* '^\[(qa|teste)\]|prova-' OR email ~* '^(qa|prova)[-.]|@example\.invalid';
SELECT pg_temp.qa_del('empresas', coalesce(array_agg(id), '{}')) FROM empresas WHERE nome ~* '^\[(qa|teste)\]|prova-';
SELECT pg_temp.qa_del('usuarios', coalesce(array_agg(id), '{}')) FROM usuarios WHERE email ~* '^qa\.' OR nome ~* '^\[(qa|teste)\]|prova-';
SELECT tabela, count(*) AS removidos FROM _qa_removido GROUP BY 1 ORDER BY 2 DESC;
