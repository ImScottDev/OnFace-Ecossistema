#!/usr/bin/env bash
# CARGA MARCO ZERO · runner. Carrega o dump FRESCO de prod (--legado) no banco
# ONFACE ja migrado (--alvo), passo a passo.
#
#   ./run.sh --legado <banco_prod> --alvo <banco_onface> [opcoes]
#
# Cada passo NN_*.sql roda numa transacao e e seguido do seu checks/NN_*.sql, que
# termina em RAISE EXCEPTION se um numero nao bater. O primeiro passo ou check
# vermelho PARA a carga (exit 1); nada depois dele roda. Passos e checks que ainda
# nao existem sao pulados (cada frente escreve o seu): 00..05 (base), 06 (comercial),
# 07 (financeiro), 08 (carteira), 09/09b (operacao), 10 (timeline), 11 (configs),
# 12_pos_carga.sh (sweep de CS e reconciliacao) e, no fim, checks/99_final.sql.
#
# Opcoes:
#   --legado <db>     banco de PROD restaurado do dump do minuto da virada (so leitura, via postgres_fdw)
#   --alvo <db>       banco ONFACE (migrations aplicadas, sem dado de negocio)
#   --de NN           retoma a partir do passo NN (mantem o horario de inicio da carga original)
#   --ate NN          para depois do passo NN (ensaio parcial; nao roda o check final)
#   --so NN           roda apenas o passo NN e o seu check
#   --planilha <csv>  planilha de faturamento de set/26 (latin1, ';'), repassada ao 08 como :planilha
#   --limpar          ao terminar VERDE, remove o schema `legado`, o servidor fdw e as tabelas _mz_*
#   --sem-checks      so para depurar; a virada NUNCA roda assim
# Conexao: usa PGHOST/PGPORT/PGUSER/PGPASSWORD do ambiente, tanto para o alvo quanto
# para a ligacao fdw com o legado (LEGADO_HOST, LEGADO_PORT, LEGADO_USER, LEGADO_PASS
# sobrescrevem so a ligacao com o legado).
# Idempotente: a segunda execucao num banco ja carregado nao altera nenhuma linha
# (INSERT ... ON CONFLICT DO UPDATE ... WHERE IS DISTINCT FROM, nunca updated_at = now()).
set -euo pipefail
cd "$(dirname "$0")"
AQUI="$(pwd)"
export LC_ALL=C

LEGADO=""; ALVO=""; DE=""; ATE=""; SO=""; PLANILHA=""; LIMPAR=0; CHECKS=1
while [ $# -gt 0 ]; do
  case "$1" in
    --legado) LEGADO="$2"; shift 2;;
    --alvo) ALVO="$2"; shift 2;;
    --de) DE="$2"; shift 2;;
    --ate) ATE="$2"; shift 2;;
    --so) SO="$2"; shift 2;;
    --planilha) PLANILHA="$2"; shift 2;;
    --limpar) LIMPAR=1; shift;;
    --sem-checks) CHECKS=0; shift;;
    -h|--help) sed -n 2,30p "$0"; exit 0;;
    *) echo "opcao desconhecida: $1" >&2; exit 2;;
  esac
done
[ -n "$LEGADO" ] && [ -n "$ALVO" ] || { echo "uso: $0 --legado <db> --alvo <db> [--de NN] [--so NN] [--planilha csv] [--limpar]" >&2; exit 2; }
[ "$LEGADO" != "$ALVO" ] || { echo "legado e alvo sao o mesmo banco" >&2; exit 2; }

PSQL="${PSQL:-psql}"
LEGADO_HOST="${LEGADO_HOST:-${PGHOST:-localhost}}"
LEGADO_PORT="${LEGADO_PORT:-${PGPORT:-5432}}"
LEGADO_USER="${LEGADO_USER:-${PGUSER:-$(id -un)}}"
LEGADO_PASS="${LEGADO_PASS:-${PGPASSWORD:-}}"

mkdir -p logs revisao
INICIO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
LOG="logs/carga-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1
t0=$(date +%s)
echo "== CARGA MARCO ZERO  inicio $INICIO  legado=$LEGADO  alvo=$ALVO  log=$LOG"

alvo_psql() { "$PSQL" -X -q -d "$ALVO" -v ON_ERROR_STOP=1 "$@"; }

# Retomada: o horario de inicio e o da carga original (o check final de updated_at
# compara contra ele; um inicio mais novo esconderia escrita de um passo anterior).
if [ -n "$DE" ] || [ -n "$SO" ]; then
  ORIG="$(alvo_psql -At -c "SELECT valor FROM _mz_meta WHERE chave = 'inicio'" 2>/dev/null || true)"
  [ -n "$ORIG" ] && INICIO="$ORIG" && echo "   retomando com inicio original $INICIO"
fi

vars=(-v "legado_db=$LEGADO" -v "legado_host=$LEGADO_HOST" -v "legado_port=$LEGADO_PORT" -v "legado_user=$LEGADO_USER"
      -v "legado_pass=$LEGADO_PASS" -v "inicio=$INICIO" -v "revisao_dir=$AQUI/revisao" -v "cfgdir=$AQUI/configs"
      -v "planilha=$PLANILHA")

vermelho() { echo; echo "!! VERMELHO em $1 apos $(( $(date +%s) - t0 ))s. Carga PARADA; corrija e retome com --de ${2:-$1}." >&2; exit 1; }

# executa um arquivo .sql: sem BEGIN proprio ele vai inteiro numa transacao
roda_sql() {
  local f="$1" modo=(--single-transaction)
  grep -q '^BEGIN;' "$f" && modo=()
  alvo_psql ${modo[@]+"${modo[@]}"} "${vars[@]}" -f "$f"
}

passos=$( (ls -1 [0-9][0-9]*_*.sql [0-9][0-9]*_*.sh 2>/dev/null || true) | sort)
for f in $passos; do
  nn="${f%%_*}"                       # 00, 01, ... 09b
  num="${nn%%[a-z]*}"                 # 09
  [ -n "$SO" ] && [ "$nn" != "$SO" ] && [ "$num" != "$SO" ] && continue
  [ -n "$DE" ] && [[ "$nn" < "$DE" ]] && continue
  [ -n "$ATE" ] && [[ "$num" > "$ATE" ]] && continue
  echo; echo "== passo $nn  $f  ($(date +%H:%M:%S))"
  case "$f" in
    *.sql) roda_sql "$f" || vermelho "$nn";;
    *.sh)  ALVO="$ALVO" LEGADO="$LEGADO" INICIO="$INICIO" PLANILHA="$PLANILHA" bash "$f" || vermelho "$nn";;
  esac
  if [ "$CHECKS" = 1 ]; then
    for c in checks/${nn}_*.sql; do
      [ -e "$c" ] || { echo "   (sem check para $nn)"; continue; }
      echo "-- check $c"
      alvo_psql "${vars[@]}" -f "$c" || vermelho "check $nn" "$nn"
    done
  fi
done

if [ "$CHECKS" = 1 ] && [ -z "$SO" ] && [ -z "$ATE" ] && [ -e checks/99_final.sql ]; then
  echo; echo "== check final"
  alvo_psql "${vars[@]}" -f checks/99_final.sql || vermelho "check final" 99
fi

if [ "$LIMPAR" = 1 ] && [ -z "$SO" ] && [ -z "$ATE" ]; then
  echo; echo "== limpando ligacao com o legado e tabelas de apoio"
  alvo_psql -c "DROP SCHEMA IF EXISTS legado CASCADE; DROP SERVER IF EXISTS legado CASCADE; DROP FUNCTION IF EXISTS public._mz_empresa(uuid);" \
            -c "DO \$\$ DECLARE t text; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '\_mz\_%' LOOP EXECUTE format('DROP TABLE %I CASCADE', t); END LOOP; END \$\$;"
fi
echo; echo "== VERDE em $(( $(date +%s) - t0 ))s (inicio $INICIO)"
