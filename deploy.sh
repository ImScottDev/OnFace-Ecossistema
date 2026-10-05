#!/bin/bash
# Deploy do ONFACE: commit do repo → servidor → imagens → ambiente → migrations → troca.
#
#   ./deploy.sh dev            # roda da raiz do repo, na máquina de quem publica
#
# Alvos:
#   dev  → /opt/callface/crm2-dev, compose `crm2-dev`, https://dev.crm.callface.io
#
# Produção não tem alvo aqui de propósito: a virada é um procedimento à parte
# (docs/operacao/virada/) e só acontece com o OK do Kauã.
#
# Regras que este script garante, e por quê:
#   - Publica exatamente um commit (`git archive HEAD`). Rsync de pasta de
#     trabalho levava lixo local e deixava no servidor tudo que o repo apagou:
#     em 05/10 o servidor tinha 73 arquivos que o repo já não tinha, entre eles
#     uma tela que abria sem login.
#   - `--delete` espelha o repo, protegendo o que é do servidor: .env, uploads,
#     segredos do Documenso e backups (deploy nunca apaga backup).
#   - Build com --cpuset-cpus=1, uma imagem por vez: a EC2 tem 2 vCPU e
#     produção roda na mesma máquina. Sem isso o build derrubou produção (01/10).
#   - Ambiente e migrations são conferidos com a imagem NOVA, antes de trocar
#     container. Com a imagem antiga a migration nova nunca é aplicada.
#   - `.onface-release` registra o commit publicado.
set -euo pipefail

ALVO="${1:-}"
case "$ALVO" in
  dev)
    DIR=/opt/callface/crm2-dev
    PROJETO=crm2-dev
    PREFIXO_IMAGEM=crm2-dev
    CONTAINER_APP=callface-crm2-dev-app
    CONTAINER_WORKER=callface-crm2-dev-worker
    ;;
  *)
    echo "uso: ./deploy.sh dev" >&2
    exit 1
    ;;
esac

HOST="${DEPLOY_HOST:-ubuntu@34.204.200.52}"
CHAVE="${DEPLOY_CHAVE:-$HOME/.ssh/infra_callface.pem}"
SSH=(ssh -i "$CHAVE" "$HOST")

cd "$(git rev-parse --show-toplevel)"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "✘ há mudança não commitada: o deploy publica só o que está no commit" >&2
  exit 1
fi
REV="$(git rev-parse HEAD)"
echo "=== ONFACE → $ALVO ($REV) ==="

# ─── 1. Código: o commit, espelhado no servidor ─────────────────────────────
echo "[1/4] Enviando o commit..."
STAGE="/tmp/onface-release-$REV"
git archive --format=tar HEAD | "${SSH[@]}" "rm -rf $STAGE && mkdir -p $STAGE && tar -x -C $STAGE"
"${SSH[@]}" "sudo rsync -a --delete \
  --exclude=/.env --exclude=/.env.* \
  --exclude=/uploads/ --exclude=/app/public/uploads/ \
  --exclude=/infra/documenso/.env --exclude=/infra/documenso/certs/ \
  --exclude=/.onface-release \
  --exclude='_backup*' --exclude='*.sql.gz' --exclude='*.dump' --exclude='*.bak-*' \
  $STAGE/ $DIR/ && rm -rf $STAGE"

# ─── 2. Imagens, uma por vez, presas a 1 CPU ────────────────────────────────
for SERVICO in app api worker; do
  ARQ=Dockerfile; [ "$SERVICO" = app ] || ARQ="Dockerfile.$SERVICO"
  echo "[2/4] Build $SERVICO (o container antigo continua servindo)..."
  "${SSH[@]}" "cd $DIR && sudo env DOCKER_BUILDKIT=0 docker build --cpuset-cpus=1 --memory=4g --memory-swap=9g -f $ARQ -t $PREFIXO_IMAGEM-$SERVICO ."
done

# ─── 3. Ambiente e banco, com a imagem nova, antes de trocar container ──────
COMPOSE="cd $DIR && sudo docker compose -p $PROJETO"
echo "[3/4] Conferindo variáveis obrigatórias..."
"${SSH[@]}" "$COMPOSE run --rm --no-deps --entrypoint '' api node app/dist/checar-env-runtime.mjs" \
  || { echo "✘ ambiente incompleto — corrija o .env antes de seguir (webhooks são fail-closed)" >&2; exit 1; }
echo "[3/4] Migrations..."
if ! "${SSH[@]}" "$COMPOSE run --rm --no-deps --entrypoint '' api env MIGRATIONS_DIR=/repo/app/dist/migrations node app/dist/migrar.mjs --check"; then
  "${SSH[@]}" "$COMPOSE run --rm --no-deps --entrypoint '' api env MIGRATIONS_DIR=/repo/app/dist/migrations node app/dist/migrar.mjs" \
    || { echo "✘ falha ao migrar — nenhum container foi trocado" >&2; exit 1; }
fi

# ─── 4. Troca e saúde ───────────────────────────────────────────────────────
echo "[4/4] Trocando worker, api e app..."
"${SSH[@]}" "$COMPOSE up -d --no-deps --no-build worker api app"
for i in $(seq 1 45); do
  STATUS="$("${SSH[@]}" "sudo docker inspect --format='{{.State.Health.Status}}' $CONTAINER_APP" 2>/dev/null || echo starting)"
  if [ "$STATUS" = healthy ]; then
    "${SSH[@]}" "echo $REV | sudo tee $DIR/.onface-release >/dev/null"
    # O worker carrega os jobs agendados e o sweep do outbox: se ele ficar
    # unhealthy, o pós-venda congela em silêncio.
    echo "✓ app saudável · worker: $("${SSH[@]}" "sudo docker inspect --format='{{.State.Health.Status}}' $CONTAINER_WORKER" 2>/dev/null || echo '?')"
    echo "✓ publicado: $REV"
    exit 0
  fi
  echo "  aguardando app... ($STATUS) [$i/45]"
  sleep 2
done
echo "⚠ o app não ficou saudável em 90s" >&2
"${SSH[@]}" "sudo docker logs $CONTAINER_APP --tail 30" >&2
exit 1
