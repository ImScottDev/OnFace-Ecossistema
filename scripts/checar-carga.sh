#!/bin/bash
# Checks de sanidade do banco carregado. Roda depois de ensaio-carga.sh — e é o
# mesmo check que decide se homolog/prod podem virar.
#
# Só lê. FAIL-CLOSED por construção: existem três desfechos e nenhum deles é
# "verde por omissão".
#   exit 0 — todos os checks EXECUTARAM e passaram
#   exit 1 — algum check executou e REPROVOU
#   exit 2 — algum check não conseguiu EXECUTAR (psql caiu, catálogo vazio,
#            banco inacessível). Silêncio nunca vira aprovação.
#
# Uso: ./scripts/checar-carga.sh [nome_do_banco]
set -euo pipefail

DB="${1:-callface_crm_ensaio}"
LOCAL_USER="callface"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
URL="postgresql://$LOCAL_USER@localhost:5432/$DB"
DEV_URL="${DEV_URL:-postgresql://$LOCAL_USER@localhost:5432/callface_crm}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FALHAS=0

reprovar() { echo "  ✘ $1"; FALHAS=$((FALHAS + 1)); }
abortar()  { echo; echo "✘ ERRO DE EXECUÇÃO no check $1 — o resultado deste check é DESCONHECIDO," >&2
             echo "  o que não é o mesmo que aprovado. Nada vira com isso em aberto." >&2
             echo "  detalhe: $2" >&2; exit 2; }

# Pré-condição: o banco tem que responder. Sem isso, todo check abaixo seria
# um falso verde.
if ! saida=$(psql "$URL" -Atc "SELECT 1" 2>&1) || [ "$saida" != "1" ]; then
  abortar "pré-condição" "banco '$DB' não respondeu: $saida"
fi

echo "── A · migrações: nada pendente ──────────────────────────────────"
# O runner distingue sozinho "pendente" (exit 1) de falha de conexão (exit 1
# também), então conferimos a mensagem: só "banco em dia" é aprovação.
set +e
saida_a=$(cd "$RAIZ/app" && DATABASE_URL="$URL" ./node_modules/.bin/tsx src/lib/db/migrar.ts --check 2>&1)
status_a=$?
set -e
echo "$saida_a"
if [ "$status_a" -ne 0 ]; then
  case "$saida_a" in
    *"migration(s) pendente(s)"*|*"ALTERADA"*) reprovar "cadeia de migrações não está em dia" ;;
    *) abortar "A" "migrar.ts --check não conseguiu rodar: $saida_a" ;;
  esac
elif ! printf '%s' "$saida_a" | grep -q "banco em dia"; then
  abortar "A" "saída inesperada de migrar.ts --check: $saida_a"
fi

echo
echo "── B · contagem por tabela: antes x depois da carga ──────────────"
if ! snapshot=$(psql "$URL" -Atc "SELECT to_regclass('public._carga_contagem_antes')" 2>&1); then
  abortar "B" "não deu para checar o snapshot: $snapshot"
fi
if [ -z "$snapshot" ]; then
  # Sem foto do "antes" não existe check de perda de linha. Isso é ausência de
  # evidência, não evidência de ausência — aborta.
  abortar "B" "banco sem '_carga_contagem_antes'. Rode via ensaio-carga.sh, que tira a foto antes de escrever."
fi
set +e
saida_b=$(psql "$URL" -v ON_ERROR_STOP=1 2>&1 <<'SQL'
DO $$
DECLARE r record; n bigint; perdidas int := 0;
  -- Perdas de linha JÁ DECLARADAS em docs/virada/PLANO-DE-CARGA.md, seção
  -- "Perdas". Qualquer tabela fora desta lista que perca linha reprova.
  aceitas text[] := ARRAY['lead_labels'];
BEGIN
  FOR r IN SELECT tabela, linhas FROM _carga_contagem_antes ORDER BY tabela LOOP
    IF to_regclass('public.' || quote_ident(r.tabela)) IS NULL THEN
      RAISE WARNING 'tabela % SUMIU depois da carga (tinha % linhas)', r.tabela, r.linhas;
      perdidas := perdidas + 1;
      CONTINUE;
    END IF;
    EXECUTE format('SELECT count(*) FROM %I', r.tabela) INTO n;
    IF n <> r.linhas THEN
      RAISE NOTICE 'tabela %: % -> % (delta %)%', r.tabela, r.linhas, n, n - r.linhas,
        CASE WHEN n < r.linhas AND r.tabela = ANY(aceitas) THEN '  [perda declarada]' ELSE '' END;
      IF n < r.linhas AND NOT (r.tabela = ANY(aceitas)) THEN perdidas := perdidas + 1; END IF;
    END IF;
  END LOOP;
  IF perdidas > 0 THEN
    RAISE EXCEPTION '% tabela(s) perderam linhas ou sumiram na carga', perdidas;
  END IF;
  RAISE NOTICE 'nenhuma tabela perdeu linha.';
END $$;
SQL
)
status_b=$?
set -e
echo "$saida_b"
if [ "$status_b" -ne 0 ]; then
  case "$saida_b" in
    *"perderam linhas ou sumiram"*) reprovar "houve perda de linha não declarada" ;;
    *) abortar "B" "$saida_b" ;;
  esac
elif ! printf '%s' "$saida_b" | grep -q "nenhuma tabela perdeu linha"; then
  abortar "B" "saída inesperada: $saida_b"
fi

echo
echo "── C · FKs órfãs ─────────────────────────────────────────────────"
if ! ORFAS=$(psql "$URL" -Atc "
SELECT string_agg(q, E'\nUNION ALL\n') FROM (
  SELECT format(
    'SELECT %L AS fk, count(*) AS n FROM %I f LEFT JOIN %I p ON f.%I = p.%I WHERE f.%I IS NOT NULL AND p.%I IS NULL',
    con.conname, cf.relname, cp.relname, af.attname, ap.attname, af.attname, ap.attname) AS q
    FROM pg_constraint con
    JOIN pg_class cf ON cf.oid = con.conrelid
    JOIN pg_class cp ON cp.oid = con.confrelid
    JOIN pg_attribute af ON af.attrelid = con.conrelid  AND af.attnum = con.conkey[1]
    JOIN pg_attribute ap ON ap.attrelid = con.confrelid AND ap.attnum = con.confkey[1]
   WHERE con.contype = 'f' AND array_length(con.conkey, 1) = 1
) s" 2>&1); then
  abortar "C" "não deu para montar a varredura de FK: $ORFAS"
fi
if [ -z "$ORFAS" ]; then
  # Um banco carregado do CRM tem centenas de FKs. Zero é sintoma de consulta
  # que não rodou, não de banco sem chave estrangeira.
  abortar "C" "a varredura voltou vazia — nenhuma FK de coluna única encontrada, o que é implausível neste schema"
fi
if ! psql "$URL" -Atc "SELECT fk, n FROM ($ORFAS) t WHERE n > 0 ORDER BY n DESC" > "$TMP/orfas.txt" 2>"$TMP/orfas.err"; then
  abortar "C" "a varredura de FK falhou: $(cat "$TMP/orfas.err")"
fi
if [ -s "$TMP/orfas.txt" ]; then
  echo "  FKs com linha órfã:"; cat "$TMP/orfas.txt"
  reprovar "há FK órfã"
else
  echo "  ✔ nenhuma FK órfã"
fi

echo
echo "── D · schema carregado x schema de dev ──────────────────────────"
CAT="$RAIZ/app/src/lib/db/catalogo-comparavel.sql"
[ -f "$CAT" ] || abortar "D" "catalogo-comparavel.sql não encontrado em $CAT"
for par in "carga:$URL" "dev:$DEV_URL"; do
  rot="${par%%:*}"; u="${par#*:}"
  if ! psql "$u" -v ON_ERROR_STOP=1 -f "$CAT" > "$TMP/cat-$rot.raw" 2>"$TMP/cat-$rot.err"; then
    abortar "D" "catálogo de '$rot' falhou: $(cat "$TMP/cat-$rot.err")"
  fi
  sed '/^$/d' "$TMP/cat-$rot.raw" | grep -v '_carga_contagem_antes' | sort > "$TMP/cat-$rot.txt"
  # Catálogo vazio compara igual a catálogo vazio — seria o falso verde perfeito.
  linhas=$(wc -l < "$TMP/cat-$rot.txt" | tr -d ' ')
  [ "$linhas" -ge 500 ] || abortar "D" "catálogo de '$rot' voltou com só $linhas linha(s) — esperado > 500"
done
if diff -u "$TMP/cat-dev.txt" "$TMP/cat-carga.txt" > "$TMP/diff.txt"; then
  echo "  ✔ schema idêntico ao de dev"
else
  total=$(grep -cE '^[+-][^+-]' "$TMP/diff.txt" || true)
  echo "  ⚠ divergências (─ só em dev, + só no carregado):"
  grep -E '^[+-][^+-]' "$TMP/diff.txt" | head -60 || true
  echo "  ... total: $total linha(s). Cada uma precisa estar"
  echo "      declarada em docs/virada/PLANO-DE-CARGA.md como diferença aceita."
fi

echo
echo "── E · amostras de negócio ───────────────────────────────────────"
if ! psql "$URL" -v ON_ERROR_STOP=1 2>"$TMP/e.err" <<'SQL'
SELECT 'leads' t, count(*) FROM leads
UNION ALL SELECT 'negocios', count(*) FROM negocios
UNION ALL SELECT 'empresas', count(*) FROM empresas
UNION ALL SELECT 'usuarios', count(*) FROM usuarios
UNION ALL SELECT 'contratos', count(*) FROM contratos
UNION ALL SELECT 'faturas', count(*) FROM faturas
UNION ALL SELECT 'assinaturas', count(*) FROM assinaturas
UNION ALL SELECT 'servicos_catalogo', count(*) FROM servicos_catalogo
UNION ALL SELECT 'servicos_canonicos', count(*) FROM servicos_canonicos
ORDER BY 1
SQL
then
  abortar "E" "as amostras de negócio falharam: $(cat "$TMP/e.err")"
fi

echo
if [ "$FALHAS" -eq 0 ]; then
  echo "✔ checks de sanidade OK — os 5 executaram e passaram"
  exit 0
fi
echo "✘ $FALHAS check(s) reprovaram"
exit 1
