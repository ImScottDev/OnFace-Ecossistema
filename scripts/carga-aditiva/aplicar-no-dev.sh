#!/usr/bin/env bash
# CARGA ADITIVA NO DEV. Rodar do Mac, SO depois do deploy (migrations 0103/0104 aplicadas) e com o OK do Kaua/Scott.
# Prod: somente leitura (pg_dump). Dev: backup, banco scratch com o prod fresco, carga aditiva, remocao de QA, scratch derrubado.
# Nada de ALTER DATABASE RENAME/DROP no banco ativo. O scratch tem nome proprio e e o unico banco removido.
#   ./scripts/carga-aditiva/aplicar-no-dev.sh [--parar-apps]
set -euo pipefail
K="$HOME/.ssh/infra_callface.pem"; H="ubuntu@34.204.200.52"; PG=callface-crm2-dev-postgres; DB=callface_crm_mz
TS=$(date +%Y%m%d-%H%M); SCR="callface_freshprod_$TS"; D="$HOME/callface-virada"
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"; PLAN="${PLANILHA:-$HOME/Downloads/Faturamento callface 09-2026-(Planilha1).csv}"
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"; mkdir -p "$D"
sh() { ssh -i "$K" "$H" "$@"; }; dpsql() { sh "docker exec -i $PG psql -U callface -X -q -v ON_ERROR_STOP=1 $*"; }

echo "[1] disco e migrations"; sh "df -h / | tail -1"
[ "$(dpsql -d $DB -At -c "select count(*) from _migracoes_aplicadas where nome like '0103%' or nome like '0104%'")" = 2 ] || { echo "0103/0104 ainda nao aplicadas: espere o deploy" >&2; exit 1; }
[ "${1:-}" = "--parar-apps" ] && sh "docker stop callface-crm2-dev-app callface-crm2-dev-api callface-crm2-dev-worker"

echo "[2] backup do dev (pg_dump) -> $D/dev-antes-aditivo-$TS.dump"
sh "docker exec $PG pg_dump -U callface -d $DB -Fc -Z6" > "$D/dev-antes-aditivo-$TS.dump"; pg_restore -l "$D/dev-antes-aditivo-$TS.dump" >/dev/null

echo "[3] prod fresco (somente leitura) -> scratch $SCR no container do dev"
sh "docker exec callface-crm-postgres pg_dump -U callface -d callface_crm -Fc -Z6" > "$D/prod-fresco-$TS.dump"
dpsql -d postgres -c "CREATE DATABASE $SCR OWNER callface"
sh "docker exec -i $PG pg_restore -U callface -d $SCR --no-owner --no-privileges -j1" < "$D/prod-fresco-$TS.dump" || true  # avisos de extensao sao esperados

echo "[4] carga aditiva (tunel local -> dev, banco $DB; legado = $SCR)"
ssh -i "$K" -f -N -L 15432:$(sh "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $PG"):5432 "$H"
trap 'pkill -f "15432:" || true' EXIT
echo "  (senha do usuario callface do dev em PGPASSWORD)"; : "${PGPASSWORD:?exporte PGPASSWORD (senha do postgres do dev, esta em /opt/callface/crm2-dev/.env)}"
export PGHOST=localhost PGPORT=15432 PGUSER=callface LEGADO_HOST=localhost LEGADO_PORT=15432 LEGADO_USER=callface LEGADO_PASS="$PGPASSWORD"
( cd "$RAIZ/scripts/carga-marco-zero" && ./run.sh --legado "$SCR" --alvo "$DB" --ate 10 --sem-checks --planilha "$PLAN" )
psql -X -d "$DB" -v ON_ERROR_STOP=1 -1 -f "$RAIZ/scripts/carga-aditiva/remover-qa.sql"

echo "[5] prova: nada do dev perdido alem do QA"
cd "$RAIZ/scripts/carga-aditiva"
echo "  restaurando backup como banco de comparacao _antes"
dpsql -d postgres -c "CREATE DATABASE ${DB}_antes_$TS OWNER callface"
sh "docker exec -i $PG pg_restore -U callface -d ${DB}_antes_$TS --no-owner --no-privileges" < "$D/dev-antes-aditivo-$TS.dump" || true
./comparar.sh "$DB" "${DB}_antes_$TS" --colunas | tee "$D/dev-comparacao-$TS.txt" | head -80

echo "[6] derrubando scratch e comparacao; subindo apps"
dpsql -d postgres -c "DROP DATABASE $SCR" -c "DROP DATABASE ${DB}_antes_$TS"
sh "docker start callface-crm2-dev-app callface-crm2-dev-api callface-crm2-dev-worker" || true
echo "FIM. backup: $D/dev-antes-aditivo-$TS.dump"
