#!/bin/bash
# Preparo e manutenção do servidor de HOMOLOGAÇÃO (/opt/callface/crm2-homolog).
# Roda do seu Mac; tudo acontece na EC2. Não toca produção (crm2-dev) nem o legado (crm).
#
#   scripts/homolog-servidor.sh preparar          # pasta, .env refeito de produção (re-rodável), banco e Redis de pé
#   scripts/homolog-servidor.sh env CHAVE=valor   # muda uma variável do .env e recria os containers
#   scripts/homolog-servidor.sh recarregar-banco  # copia produção para a homologação (apaga o que há lá)
#
# O .env de homologação é COPIADO do de produção, NO servidor (segredo nunca passa por aqui nem pelo git),
# trocando só o que é do ambiente (domínio, banco, Redis) e acrescentando as três travas:
# WHATSAPP_ALLOWLIST, EMAIL_ALLOWED_DOMAINS e AREAS_EM_BREVE. Ver docs/operacao/homologacao.md.
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
PROD_ENV=/opt/callface/crm2-dev/.env
DOM=dev.crm.callface.io
# Preserva o que é desta pilha: senha do banco (o volume já nasceu com ela) e as
# travas que o Scott ajustou. Re-rodar "preparar" traz as chaves novas de produção
# sem desfazer isso.
velho() { [ -f .env ] && grep -m1 "^$1=" .env | cut -d= -f2- || true; }
DB_PASSWORD="$(velho DB_PASSWORD)"; DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -hex 16)}"
WA="$(velho WHATSAPP_ALLOWLIST)"; WA="${WA:-0000000000}"
EM="$(velho EMAIL_ALLOWED_DOMAINS)"; EM="${EM:-callface.ai}"
AR="$(velho AREAS_EM_BREVE)"
[ ! -f .env ] || cp -p .env .env.bak-anterior
umask 077
# Cópia do .env de produção SEM as chaves que são do ambiente (reescritas abaixo).
# Os segredos de terceiros (Stripe, Microsoft, Resend, Documenso, IA...) ficam iguais.
{
  echo "# Homologação ($DOM). Gerado por scripts/homolog-servidor.sh em $(date +%F) a partir do .env de produção."
  echo "# IDÊNTICO ao de produção, exceto o bloco 'DO AMBIENTE' e as TRAVAS no fim. Nunca versionar."
  sudo grep -vE '^(#|$)|^(COMPOSE_PROJECT_NAME|STACK|ROTA|REDE|PG_PORTA|CRM_DOMAIN|AUTH_URL|NEXTAUTH_URL|NEXT_PUBLIC_APP_URL|UAZAPI_WEBHOOK_URL|DB_PASSWORD|DATABASE_URL|REDIS_URL|IMAGE_TAG|WHATSAPP_ALLOWLIST|EMAIL_ALLOWED_DOMAINS|AREAS_EM_BREVE|DOCUMENSO_API_URL)=' "$PROD_ENV"
  cat <<ENV
# ── DO AMBIENTE (o que muda em relação a produção) ──
COMPOSE_PROJECT_NAME=crm2-homolog
STACK=crm2-homolog
ROTA=crm2homolog
REDE=crm2homolog-network
PG_PORTA=5434
CRM_DOMAIN=$DOM
AUTH_URL=https://$DOM
NEXTAUTH_URL=https://$DOM
UAZAPI_WEBHOOK_URL=https://$DOM/api/webhooks/whatsapp
DB_PASSWORD=$DB_PASSWORD
DATABASE_URL=postgres://callface:$DB_PASSWORD@callface-crm2-homolog-postgres:5432/callface_crm_mz
REDIS_URL=redis://callface-crm2-homolog-redis:6379
# O worker daqui não está na rede do Documenso (que é a de produção): usa o endereço público.
DOCUMENSO_API_URL=https://sign.callface.io/api/v2
# ── TRAVAS (só impedem atingir terceiros; ver docs/operacao/homologacao.md) ──
# WhatsApp: só estes números recebem. Troque com: scripts/homolog-servidor.sh env WHATSAPP_ALLOWLIST=5511...,5511...
WHATSAPP_ALLOWLIST=$WA
# E-mail e convites (Resend, Outlook, Gmail, SMTP, assinatura Documenso, agenda): só estes domínios.
EMAIL_ALLOWED_DOMAINS=$EM
# Áreas fechadas ("em breve"): vazio = tudo aberto. Em produção: AREAS_EM_BREVE=automacoes
AREAS_EM_BREVE=$AR
ENV
} > .env.novo
mv .env.novo .env
echo ".env refeito a partir de produção: $(grep -c . .env) linhas (sem imprimir valores)"
sudo docker compose -p crm2-homolog up -d postgres redis
REMOTE
  echo "OK homologação preparada. Próximo: scripts/homolog-servidor.sh recarregar-banco"
  ;;
env)
  # scripts/homolog-servidor.sh env CHAVE=valor  (muda uma variável do .env de homologação e recria os containers)
  PAR="${2:?uso: scripts/homolog-servidor.sh env CHAVE=valor}"
  [[ "$PAR" =~ ^[A-Z0-9_]+=[A-Za-z0-9_.,:/@-]*$ ]] || { echo "formato: CHAVE=valor (sem espaço nem aspas)" >&2; exit 1; }
  "${SSH[@]}" "bash -s" "$PAR" <<'REMOTE'
set -euo pipefail
cd /opt/callface/crm2-homolog
CH="${1%%=*}"
sudo sed -i "/^$CH=/d" .env && echo "$1" | sudo tee -a .env >/dev/null
RODANDO="$(sudo docker compose -p crm2-homolog ps --status running --services | grep -E '^(worker|api|app)$' | tr '\n' ' ' || true)"
[ -z "$RODANDO" ] || sudo docker compose -p crm2-homolog up -d --no-deps --force-recreate $RODANDO
echo "OK $CH atualizado${RODANDO:+ (recriados: $RODANDO)}"
REMOTE
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
# Trava dura: nenhum token do Microsoft/Gmail pode ter sobrado na cópia (ver docs, seção Microsoft).
RESTOU="$(sudo docker exec $HOM psql -U callface -d $DB -Atc "select count(*) from email_contas where access_token is not null or refresh_token is not null")"
[ "$RESTOU" = 0 ] || { echo "ERRO: $RESTOU conta(s) de e-mail com token na cópia; não suba o worker." >&2; exit 1; }
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
