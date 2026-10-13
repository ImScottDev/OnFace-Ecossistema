#!/bin/bash
# Virada de domínio (OK do Kauã em 13/10/2026): ONFACE assume crm.callface.io,
# o legado vai para homolog.crm.callface.io com o worker parado (só consulta).
# Backups dos bancos já feitos em /opt/callface/backup-*-pre-virada-20261013-0401.dump.
# Volta: scripts/virada-dominio-voltar.sh <carimbo impresso no fim>.
set -euo pipefail
ssh -i "$HOME/.ssh/infra_callface.pem" ubuntu@34.204.200.52 'bash -s' <<'EOF'
set -euo pipefail
T=$(date +%Y%m%d-%H%M)
echo "1) legado: worker parado"
docker update --restart=no callface-crm-worker >/dev/null; docker stop callface-crm-worker >/dev/null
echo "2) sync do relay desligado"
crontab -l > /tmp/cron.bak-$T
crontab -l | sed "s#^\* \* \* \* \* /usr/bin/python3 /opt/callface/wa-relay/sync.py#\# virada-$T &#" | crontab -
echo "3) homolog antigo parado (libera o domínio)"
for c in app api worker; do docker update --restart=no callface-crm-homolog-$c >/dev/null; docker stop callface-crm-homolog-$c >/dev/null; done
echo "4) legado -> homolog.crm.callface.io"
cd /opt/callface/crm
sudo cp docker-compose.yml docker-compose.yml.bak-virada-$T; sudo cp .env .env.bak-virada-$T
sudo sed -i 's#Host(`crm.callface.io`)#Host(`homolog.crm.callface.io`)#g' docker-compose.yml
sudo sed -i -E 's#^(AUTH_URL|NEXTAUTH_URL)=https://crm.callface.io#\1=https://homolog.crm.callface.io#' .env
docker compose up -d --no-deps --no-build app api 2>&1 | tail -3
echo "5) ONFACE -> crm.callface.io"
cd /opt/callface/crm2-dev
sudo cp .env .env.bak-virada-$T
sudo sed -i -E 's#^(AUTH_URL|NEXTAUTH_URL|UAZAPI_WEBHOOK_URL)=https://dev.crm.callface.io#\1=https://crm.callface.io#; s#^WHATSAPP_ALLOWLIST=.*#WHATSAPP_ALLOWLIST=#' .env
if grep -q '^CRM_DOMAIN=' .env; then sudo sed -i 's#^CRM_DOMAIN=.*#CRM_DOMAIN=crm.callface.io#' .env; else echo 'CRM_DOMAIN=crm.callface.io' | sudo tee -a .env >/dev/null; fi
docker compose -p crm2-dev up -d --no-build app api worker 2>&1 | tail -3
echo "6) relay WhatsApp: entrega só ao ONFACE"
R=/opt/callface/wa-relay/nginx.conf; sudo cp $R $R.bak-virada-$T
S=$(sudo grep -oE 'secret=[^;]+' $R | head -1)
sudo python3 - "$R" "$S" <<'PY'
import sys
p, s = sys.argv[1], sys.argv[2]
c = open(p).read()
c = c.replace("mirror /mirror;", "").replace("mirror_request_body on;", "")
c = c.replace("set $antigo http://callface-crm-api:3001;", "set $antigo http://callface-crm2-dev-api:3001;")
c = c.replace("proxy_pass $antigo/api/whatsapp/webhook;", "proxy_pass $antigo/api/whatsapp/webhook?" + s + ";")
open(p, "w").write(c)
PY
docker exec callface-wa-relay nginx -t 2>&1 | tail -1 && docker exec callface-wa-relay nginx -s reload
sleep 20
echo "crm.callface.io/login -> $(curl -s -o /dev/null -w '%{http_code}' https://crm.callface.io/login)"
echo "homolog.crm.callface.io/login -> $(curl -s -o /dev/null -w '%{http_code}' https://homolog.crm.callface.io/login)"
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'crm2-dev-(app|api|worker)|callface-crm-(app|api)$'
echo "VIRADA OK. Carimbo para voltar: $T"
EOF
