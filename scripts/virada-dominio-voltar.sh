#!/bin/bash
# Desfaz scripts/virada-dominio.sh: legado volta a crm.callface.io com worker,
# ONFACE volta a dev.crm.callface.io. Uso: scripts/virada-dominio-voltar.sh <carimbo>
set -euo pipefail
T="${1:?informe o carimbo impresso pela virada}"
ssh -i "$HOME/.ssh/infra_callface.pem" ubuntu@34.204.200.52 "T=$T bash -s" <<'EOF'
set -euo pipefail
cd /opt/callface/crm2-dev && sudo cp .env.bak-virada-$T .env && docker compose -p crm2-dev up -d --no-build app api worker 2>&1 | tail -2
cd /opt/callface/crm && sudo cp docker-compose.yml.bak-virada-$T docker-compose.yml && sudo cp .env.bak-virada-$T .env
docker compose up -d --no-deps --no-build app api 2>&1 | tail -2
docker update --restart=unless-stopped callface-crm-worker >/dev/null; docker start callface-crm-worker >/dev/null
sudo cp /opt/callface/wa-relay/nginx.conf.bak-virada-$T /opt/callface/wa-relay/nginx.conf && docker exec callface-wa-relay nginx -s reload
crontab /tmp/cron.bak-$T
echo "voltou. crm.callface.io -> $(curl -s -o /dev/null -w '%{http_code}' https://crm.callface.io/login)"
EOF
