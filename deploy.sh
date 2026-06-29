#!/bin/bash
# Zero-downtime deploy for mCRM
# Usage: ./deploy.sh [app|api|worker|all]
# The key: build images FIRST while old container still serves traffic,
# then swap containers quickly (~1-2s gap covered by Traefik retry middleware)
set -e

TARGET="${1:-all}"
cd /opt/scott-studio/crm

echo "=== mCRM Deploy (target: $TARGET) ==="

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

# Wait for app healthcheck
echo "[3/3] Waiting for app healthcheck..."
for i in $(seq 1 30); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' mcrm-production 2>/dev/null || echo "starting")
  if [ "$STATUS" = "healthy" ]; then
    echo "✓ Deploy complete — mCRM is healthy"
    docker compose ps
    exit 0
  fi
  echo "  waiting... ($STATUS) [$i/30]"
  sleep 2
done

echo "⚠ Container did not become healthy in 60s"
docker logs mcrm-production --tail 20
exit 1
