-- CARGA DA VIRADA · faturamento, passo 01 — mescla empresas duplicadas por CNPJ.
--
-- Por que existe: a mesma empresa está cadastrada duas vezes, uma com nome
-- comercial e outra com razão social ("TOPO GROWTH" e "JEAN R DA SILVA" têm o
-- mesmo CNPJ 30.203.636/0001-00). Isso acontece porque o contato comercial e
-- quem paga a nota costumam ser cadastrados em momentos diferentes, por pessoas
-- diferentes. Medido no dump de 05/10/2026: 16 CNPJs duplicados, 17 registros
-- excedentes.
--
-- Decisão do Scott (05/10): mesclar mantendo a RAZÃO SOCIAL que consta na
-- planilha de faturamento / NFS-e, que é o nome fiscal correto. O outro nome
-- não se perde: vira `nome_fantasia` quando a coluna existe.
--
-- Como funciona: os UPDATEs das FKs são GERADOS a partir de `pg_constraint`,
-- não escritos à mão. São 34 tabelas apontando para `empresas` hoje; escrever
-- uma a uma garante esquecer alguma e perder histórico em silêncio — que é
-- exatamente o risco desta virada. Gerando do catálogo, uma FK nova entra
-- sozinha.
--
-- Pré-requisito: a tabela `tmp_set` (faturamento do mês, com `doc` normalizado
-- e `nome`) precisa existir. Ela é criada por `scripts/carga-faturamento.sh`.
--
-- IDEMPOTENTE: depois de rodar, não há mais duplicata, então a segunda execução
-- não encontra par e é no-op.

-- `similarity()` vem do pg_trgm; o banco restaurado do dump pode nao ter a
-- extensao. Criar aqui mantem o arquivo autossuficiente.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
DECLARE
  par record;
  fk  record;
  movidas int;
  total_movidas int := 0;
  total_pares int := 0;
  conflitos int := 0;
BEGIN
  IF to_regclass('public.tmp_set') IS NULL THEN
    RAISE EXCEPTION 'tmp_set não existe — rode via scripts/carga-faturamento.sh';
  END IF;

  -- Escolha do sobrevivente, em ordem de precedência:
  --   1. o cadastro cujo nome bate com o da planilha de faturamento (nome fiscal);
  --   2. na ausência de match, o mais antigo (preserva o histórico mais longo).
  FOR par IN
    WITH dups AS (
      SELECT regexp_replace(e.cnpj,'[^0-9]','','g') AS doc, e.id, e.nome, e.created_at,
             similarity(upper(e.nome), upper(COALESCE(s.nome,''))) AS aderencia_fiscal
        FROM empresas e
        LEFT JOIN tmp_set s ON s.doc = regexp_replace(e.cnpj,'[^0-9]','','g')
       WHERE e.cnpj IS NOT NULL AND e.cnpj <> ''
         AND regexp_replace(e.cnpj,'[^0-9]','','g') <> ''
    ),
    ranqueado AS (
      SELECT doc, id, nome,
             row_number() OVER (PARTITION BY doc
                                ORDER BY aderencia_fiscal DESC NULLS LAST, created_at ASC, id ASC) AS pos,
             count(*)    OVER (PARTITION BY doc) AS n
        FROM dups
    )
    SELECT r.doc,
           (SELECT id   FROM ranqueado x WHERE x.doc = r.doc AND x.pos = 1) AS sobrevivente,
           (SELECT nome FROM ranqueado x WHERE x.doc = r.doc AND x.pos = 1) AS nome_sobrevivente,
           r.id   AS duplicado,
           r.nome AS nome_duplicado
      FROM ranqueado r
     WHERE r.n > 1 AND r.pos > 1
  LOOP
    total_pares := total_pares + 1;
    RAISE NOTICE 'mesclando [%] "%" -> "%"', par.doc, par.nome_duplicado, par.nome_sobrevivente;

    FOR fk IN
      SELECT c.conrelid::regclass::text AS tabela, a.attname AS coluna
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.confrelid = 'empresas'::regclass AND c.contype = 'f'
         -- a auto-referência é tratada no fim: a linha duplicada vai sumir
         AND NOT (c.conrelid = 'empresas'::regclass AND a.attname = 'canonical_empresa_id')
    LOOP
      -- Um UNIQUE na tabela de destino pode recusar a linha repassada (dois
      -- vínculos da mesma pessoa com a mesma empresa, por exemplo). Nesse caso
      -- a linha do duplicado é redundante com a do sobrevivente: descartar é
      -- correto, mas precisa ser CONTADO, nunca silencioso.
      BEGIN
        EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', fk.tabela, fk.coluna, fk.coluna)
          USING par.sobrevivente, par.duplicado;
        GET DIAGNOSTICS movidas = ROW_COUNT;
        total_movidas := total_movidas + movidas;
      EXCEPTION WHEN unique_violation THEN
        EXECUTE format('DELETE FROM %s WHERE %I = $1', fk.tabela, fk.coluna) USING par.duplicado;
        GET DIAGNOSTICS movidas = ROW_COUNT;
        conflitos := conflitos + movidas;
        RAISE NOTICE '  % linha(s) redundante(s) em %.% descartada(s) por UNIQUE',
                     movidas, fk.tabela, fk.coluna;
      END;
    END LOOP;

    -- O nome que sai de cena não se perde.
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name='empresas' AND column_name='nome_fantasia') THEN
      EXECUTE 'UPDATE empresas SET nome_fantasia = COALESCE(nome_fantasia, $1) WHERE id = $2'
        USING par.nome_duplicado, par.sobrevivente;
    END IF;

    UPDATE empresas SET canonical_empresa_id = par.sobrevivente WHERE canonical_empresa_id = par.duplicado;
    DELETE FROM empresas WHERE id = par.duplicado;
  END LOOP;

  -- Declara a própria perda para o gate de sanidade.
  --
  -- `checar-carga.sh` compara cada tabela contra a foto tirada antes da carga e
  -- reprova se alguma perdeu linha. A mescla faz `empresas` perder linha de
  -- propósito. Pôr `empresas` na allowlist estática do script cegaria o gate
  -- para perda REAL de empresa daqui em diante; declarar aqui limita a
  -- tolerância exatamente ao que esta mescla removeu — uma linha a mais que
  -- suma ainda reprova.
  CREATE TABLE IF NOT EXISTS _carga_perdas_declaradas (
    tabela        text NOT NULL,
    linhas        bigint NOT NULL,
    motivo        text NOT NULL,
    declarado_em  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tabela, motivo)
  );
  INSERT INTO _carga_perdas_declaradas (tabela, linhas, motivo)
  VALUES ('empresas', total_pares,
          'mescla de cadastros duplicados por CNPJ (nome fantasia x razão social)')
  ON CONFLICT (tabela, motivo) DO UPDATE SET linhas = EXCLUDED.linhas, declarado_em = now();

  RAISE NOTICE '── mescla concluída: % par(es), % referência(s) repassada(s), % redundante(s) descartada(s)',
               total_pares, total_movidas, conflitos;
END $$;
