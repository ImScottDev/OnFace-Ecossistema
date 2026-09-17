#!/bin/bash
# Deploy sem downtime do CRM Callface.
# Uso: ./deploy.sh [app|api|worker|all]
#
# A ordem importa: constrói as imagens ENQUANTO o container antigo ainda serve
# tráfego, depois troca rápido (~1-2s, coberto pelo retry do Traefik).
#
# 14/09: o caminho e o nome do container estavam desatualizados (apontavam pro
# branding antigo `scott-studio`/`mcrm-production`, que não existe mais no
# compose), e não havia NENHUM passo de migração de banco — as 46 migrations
# eram aplicadas à mão, ambiente por ambiente, sem registro.
set -e

TARGET="${1:-all}"
cd "${CRM_DIR:-/opt/callface/crm}"

APP_CONTAINER="${APP_CONTAINER:-callface-crm-app}"

echo "=== Deploy CRM Callface (alvo: $TARGET) ==="

# ─── Conferência de ambiente e banco, ANTES de trocar qualquer container ─────
echo "[pré] Conferindo variáveis de ambiente obrigatórias..."
docker compose run --rm --no-deps --entrypoint "" api node --import tsx src/scripts/checar-env.ts --ambiente \
  || { echo "✘ ambiente incompleto — corrija o .env antes de seguir (webhooks são fail-closed)"; exit 1; }

echo "[pré] Conferindo migrations pendentes..."
if ! docker compose run --rm --no-deps --entrypoint "" api node --import tsx src/lib/db/migrar.ts --check; then
  echo "[pré] Aplicando migrations pendentes..."
  docker compose run --rm --no-deps --entrypoint "" api node --import tsx src/lib/db/migrar.ts \
    || { echo "✘ falha ao migrar — deploy abortado, nenhum container trocado"; exit 1; }
fi

case "$TARGET" in
  app)
    echo "[1/3] Building app image (old container still serving)..."
    docker compose build app
    echo "[2/3] Swapping app container..."
    docker compose up -d --no-deps --no-build app
    ;;
  api)
    echo "[1/3] Building api image (old container still serving)..."
    docker compose build api
    echo "[2/3] Swapping api container..."
    docker compose up -d --no-deps --no-build api
    ;;
  worker)
    echo "[1/3] Building worker image..."
    docker compose build worker
    echo "[2/3] Swapping worker container..."
    docker compose up -d --no-deps --no-build worker
    echo "[3/3] Done!"
    docker compose ps
    exit 0
    ;;
  all|*)
    echo "[1/5] Building all images (old containers still serving)..."
    docker compose build app api worker
    echo "[2/5] Swapping worker..."
    docker compose up -d --no-deps --no-build worker
    echo "[3/5] Swapping api..."
    docker compose up -d --no-deps --no-build api
    echo "[4/5] Swapping app..."
    docker compose up -d --no-deps --no-build app
    ;;
esac

# Espera o healthcheck do app
echo "[final] Aguardando healthcheck do app..."
for i in $(seq 1 30); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$APP_CONTAINER" 2>/dev/null || echo "starting")
  if [ "$STATUS" = "healthy" ]; then
    echo "✓ App saudável."
    # O worker carrega os 21 jobs agendados e o sweep do Event Outbox: se ele
    # ficar unhealthy, o pós-venda inteiro congela em silêncio. Vale conferir.
    WORKER_STATUS=$(docker inspect --format='{{.State.Health.Status}}' callface-crm-worker 2>/dev/null || echo "sem healthcheck")
    echo "  worker: $WORKER_STATUS"
    docker compose ps
    exit 0
  fi
  echo "  aguardando... ($STATUS) [$i/30]"
  sleep 2
done

echo "⚠ Container não ficou saudável em 60s"
docker logs "$APP_CONTAINER" --tail 20
exit 1
