-- CARGA MARCO ZERO · helper comum dos passos 00-05 (incluido com \ir _lib.sql).
--
-- pg_temp.mz_carga(destino, origem, filtro, sobrescreve, chave) copia `origem`
-- para public.<destino> pelas colunas que existem nos DOIS lados mais as de
-- `sobrescreve` ({coluna: 'expressao sql sobre s'}). Coluna so do destino toma o
-- default da tabela.
--
-- Idempotente: INSERT ... ON CONFLICT (chave) DO UPDATE ... WHERE (linha atual)
-- IS DISTINCT FROM (linha nova). Segunda execucao nao toca linha nenhuma, e
-- nenhuma coluna de data e preenchida com now(): created_at/updated_at vem da
-- origem (backfill que toca updated_at faz o board mostrar "17min" em tudo).
-- Devolve quantas linhas foram inseridas ou realmente mudadas.
--   origem    relacao (legado.leads, _mz_lead_estado, tabela temporaria...)
--   filtro    predicado SQL sobre o alias s
--   preserva  colunas gravadas so no INSERT: passos posteriores as ajustam (ex.: dono
--             da carteira, vinculo com contrato) e reexecutar este passo nao pode desfazer.
--             ARRAY['*'] = a tabela inteira so recebe INSERT (ON CONFLICT DO NOTHING)
CREATE OR REPLACE FUNCTION pg_temp.mz_carga(destino text, origem text, filtro text DEFAULT 'true',
                                            sobrescreve jsonb DEFAULT '{}', chave text DEFAULT 'id',
                                            preserva text[] DEFAULT '{}')
RETURNS bigint LANGUAGE plpgsql AS $f$
DECLARE cols text[]; lista text; sel text; atualiza text; velho text; novo text; n bigint;
BEGIN
  SELECT array_agg(a.attname::text ORDER BY a.attnum) INTO cols
    FROM pg_attribute a
   WHERE a.attrelid = ('public.' || quote_ident(destino))::regclass AND a.attnum > 0 AND NOT a.attisdropped
     AND (sobrescreve ? a.attname::text OR EXISTS (
           SELECT 1 FROM pg_attribute o
            WHERE o.attrelid = origem::regclass AND o.attnum > 0 AND NOT o.attisdropped AND o.attname = a.attname));
  SELECT string_agg(quote_ident(c), ', '),
         string_agg(coalesce(sobrescreve->>c, 's.' || quote_ident(c)), ', ')
    INTO lista, sel FROM unnest(cols) c;
  SELECT string_agg(quote_ident(c) || ' = EXCLUDED.' || quote_ident(c), ', '),
         string_agg('t.' || quote_ident(c), ', '), string_agg('EXCLUDED.' || quote_ident(c), ', ')
    INTO atualiza, velho, novo FROM unnest(cols) c WHERE c <> chave AND c <> ALL (preserva);
  IF '*' = ANY(preserva) THEN
    EXECUTE format('INSERT INTO public.%1$I AS t (%2$s) SELECT %3$s FROM %4$s s WHERE %5$s ON CONFLICT (%6$s) DO NOTHING',
                   destino, lista, sel, origem, filtro, chave);
  ELSE
    EXECUTE format(
      'INSERT INTO public.%1$I AS t (%2$s) SELECT %3$s FROM %4$s s WHERE %5$s
         ON CONFLICT (%6$s) DO UPDATE SET %7$s WHERE (%8$s) IS DISTINCT FROM (%9$s)',
      destino, lista, sel, origem, filtro, chave, atualiza, velho, novo);
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $f$;
