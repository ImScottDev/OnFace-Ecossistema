#!/bin/bash
# Preparo e manutenção do servidor de HOMOLOGAÇÃO (/opt/callface/crm2-homolog).
# Roda do seu Mac; tudo acontece na EC2. Não toca produção (crm2-dev) nem o legado (crm).
#
#   scripts/homolog-servidor.sh preparar          # 1ª vez: pasta, .env novo, banco e Redis de pé
#   scripts/homolog-servidor.sh recarregar-banco  # copia produção para a homologação (apaga o que há lá)
#
# Segredos do .env são gerados NO servidor e nunca passam por aqui nem pelo git.
# Nada do .env de produção é copiado: homologação nasce sem Stripe, e-mail, WhatsApp, Meta,
# Microsoft, RD, Documenso e IA. Para ligar algum, edite o .env no servidor, conscientemente.
set -euo pipefail
HOST="${DEPLOY_HOST:-ubuntu@34.204.200.52}"
CHAVE="${DEPLOY_CHAVE:-$HOME/.ssh/infra_callface.pem}"
SSH=(ssh -o ConnectTimeout=15 -i "$CHAVE" "$HOST")
DIR=/opt/callface/crm2-homolog
cd "$(git rev-parse --show-toplevel)"

case "${1:-}" in
preparar)
  git archive --format=tar HEAD docker-compose.yml scripts/homolog-sanear.sql \
    | "${SSH[@]}" "sudo mkdir -p $DIR/uploads $DIR/scripts && sudo chown -R ubuntu:ubuntu $DIR && tar -x -C $DIR && chmod 777 $DIR/uploads"
  "${SSH[@]}" "bash -s" <<'REMOTE'
set -euo pipefail
cd /opt/callface/crm2-homolog
if [ ! -f .env ]; then
  r() { openssl rand -hex 32; }
  DB_PASSWORD="$(openssl rand -hex 16)"
  AUTH="$(openssl rand -base64 32)"
  umask 077
  cat > .env <<ENV
# Homologação (qa.crm.callface.io). Gerado por scripts/homolog-servidor.sh em $(date +%F).
# SEM efeito colateral real: Stripe, e-mail, WhatsApp, Meta, Microsoft, RD, Documenso e IA ficam VAZIOS de propósito.
# Segredos próprios; nenhum é o de produção.
COMPOSE_PROJECT_NAME=crm2-homolog
STACK=crm2-homolog
ROTA=crm2homolog
REDE=crm2homolog-network
PG_PORTA=5434
CRM_DOMAIN=qa.crm.callface.io
NODE_ENV=production
DB_PASSWORD=$DB_PASSWORD
DATABASE_URL=postgres://callface:$DB_PASSWORD@callface-crm2-homolog-postgres:5432/callface_crm_mz
REDIS_URL=redis://callface-crm2-homolog-redis:6379
AUTH_URL=https://qa.crm.callface.io
NEXTAUTH_URL=https://qa.crm.callface.io
AUTH_TRUST_HOST=true
AUTH_SECRET=$AUTH
NEXTAUTH_SECRET=$AUTH
HONO_API_PORT=3002
WORKER_HEALTH_PORT=3002
POSVENDA_CANONICO=on
NEXT_PUBLIC_POSVENDA_CANONICO=on
CALLFACE_AI_TAREFAS_CS=off
# Chaves de cifra próprias: credenciais cifradas que vierem na cópia do banco ficam ilegíveis aqui.
EMAIL_ENCRYPTION_KEY=$(r)
AI_CREDENTIALS_ENCRYPTION_KEY=$(r)
# Webhooks de entrada: valor aleatório (a checagem exige existir; ninguém de fora o conhece).
RD_WEBHOOK_SECRET=$(r)
META_LEADIDS_WEBHOOK_SECRET=$(r)
META_WEBHOOK_VERIFY_TOKEN=$(r)
CALLFACE_WEBHOOK_SECRET=$(r)
CALLFACE_INBOUND_TOKEN=$(r)
UAZAPI_WEBHOOK_SECRET=$(r)
DOCUMENSO_WEBHOOK_SECRET=$(r)
# Trava de WhatsApp: número que não existe. Nada sai.
WHATSAPP_ALLOWLIST=0000000000
# Stripe: sem chave. Checkout em modo teste e live proibido.
STRIPE_CHECKOUT_MODE=test
ALLOW_STRIPE_LIVE_CHECKOUT=false
STRIPE_API_KEY=
STRIPE_WEBHOOK_SECRET=
# Vazios de propósito (efeito colateral ou token compartilhado com produção):
RESEND_API_KEY=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
RD_CLIENT_ID=
RD_CLIENT_SECRET=
RD_REFRESH_TOKEN=
UAZAPI_BASE_URL=
UAZAPI_API_KEY=
DOCUMENSO_API_URL=
DOCUMENSO_API_TOKEN=
CALLFACE_AI_DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
META_ACCESS_TOKEN=
META_ADS_ACCESS_TOKEN=
META_CAPI_ACCESS_TOKEN=
META_LEADS_ACCESS_TOKEN=
OPENAI_API_KEY=
GROQ_API_KEY=
CLAUDE_CODE_OAUTH_TOKEN=
# Lidas pelo compose (serviço wuzapi, que a homologação não sobe):
WUZAPI_ADMIN_TOKEN=
WUZAPI_GLOBAL_ENCRYPTION_KEY=
WUZAPI_GLOBAL_HMAC_KEY=
ENV
  echo ".env criado (segredos novos)"
else
  echo ".env já existe: mantido"
fi
sudo docker compose -p crm2-homolog up -d postgres redis
REMOTE
  echo "✓ homologação preparada. Próximo: scripts/homolog-servidor.sh recarregar-banco"
  ;;
recarregar-banco)
  "${SSH[@]}" "bash -s" <<'REMOTE'
set -euo pipefail
cd /opt/callface/crm2-homolog
PROD=callface-crm2-dev-postgres
HOM=callface-crm2-homolog-postgres
DB=callface_crm_mz
# Quem estava de pé volta a subir no fim; para soltar o banco, para antes.
VOLTAR="$(sudo docker compose -p crm2-homolog ps --status running --services | grep -E '^(worker|api|app)$' | tr '\n' ' ' || true)"
[ -z "$VOLTAR" ] || sudo docker compose -p crm2-homolog stop worker api app
sudo docker exec $HOM psql -U callface -d postgres -v ON_ERROR_STOP=1 -qc "DROP DATABASE IF EXISTS $DB WITH (FORCE)" -c "CREATE DATABASE $DB"
# Leitura em produção (pg_dump não bloqueia ninguém); o dado nunca sai da EC2.
sudo docker exec $PROD pg_dump -U callface -d $DB -Fc --no-owner --no-acl \
  | sudo docker exec -i $HOM pg_restore -U callface -d $DB --no-owner --no-acl --exit-on-error
sudo docker exec -i $HOM psql -U callface -d $DB -v ON_ERROR_STOP=1 -q < scripts/homolog-sanear.sql
sudo docker exec $HOM psql -U callface -d $DB -Atc "select 'leads=' || count(*) from leads"
[ -z "$VOLTAR" ] || sudo docker compose -p crm2-homolog up -d --no-deps $VOLTAR
echo "✓ cópia de produção carregada e saneada${VOLTAR:+ (subiu de novo: $VOLTAR)}"
REMOTE
  ;;
*)
  echo "uso: scripts/homolog-servidor.sh preparar | recarregar-banco" >&2
  exit 1
  ;;
esac
