#!/bin/bash
# Puxa um dump fresco do banco real de produção e restaura no Postgres local
# de dev (Homebrew, porta 5432, db callface_crm, role callface).
#
# Rode isso sempre que quiser trabalhar com dado de hoje. Não é sincronização
# contínua — é on-demand, do jeito que um time pequeno realmente usa isso.
#
# Uso: ./scripts/refresh-dev-db.sh
set -e

SSH_KEY="$HOME/.ssh/infra_callface.pem"
EC2_HOST="ubuntu@34.204.200.52"
REMOTE_CONTAINER="callface-crm-postgres"
LOCAL_DB="callface_crm"
LOCAL_USER="callface"
DUMP_FILE="/tmp/callface-crm-prod-$(date +%Y%m%d-%H%M%S).dump"

echo "[1/4] Gerando dump em produção (pg_dump dentro do container)..."
ssh -i "$SSH_KEY" "$EC2_HOST" \
  "docker exec $REMOTE_CONTAINER pg_dump -U callface -d callface_crm -Fc -f /tmp/dump.dump"

echo "[2/4] Trazendo o dump pro Mac..."
ssh -i "$SSH_KEY" "$EC2_HOST" "docker cp $REMOTE_CONTAINER:/tmp/dump.dump /tmp/dump.dump && cat /tmp/dump.dump" > "$DUMP_FILE"

echo "[3/4] Recriando o banco local do zero..."
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
dropdb --if-exists -U "$LOCAL_USER" -h localhost "$LOCAL_DB"
createdb -O "$LOCAL_USER" -h localhost "$LOCAL_DB"

echo "[4/4] Restaurando dump no banco local..."
pg_restore -U "$LOCAL_USER" -h localhost -d "$LOCAL_DB" --no-owner --no-privileges "$DUMP_FILE"

echo "✓ Banco de dev atualizado com dado real de produção ($DUMP_FILE)"
