#!/bin/bash
# Sobe o ambiente de dev local do CRM Callface: Postgres + Redis (Homebrew,
# ligados uma vez, ficam rodando sempre) + app (Next.js:3000) + api
# (Hono:3001) + worker (BullMQ) em paralelo, lendo app/.env.
#
# Uso: ./scripts/dev.sh
# Pra parar tudo: Ctrl+C uma vez (mata os 3 processos).
set -e
cd "$(dirname "$0")/.."

export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

echo "→ Checando Postgres e Redis..."
brew services list | grep -q "postgresql@16 *started" || brew services start postgresql@16
brew services list | grep -q "^redis *started" || brew services start redis

if ! pg_isready -h localhost -q; then
  echo "✗ Postgres não respondeu. Roda 'brew services restart postgresql@16' e tenta de novo."
  exit 1
fi
if ! redis-cli ping > /dev/null 2>&1; then
  echo "✗ Redis não respondeu. Roda 'brew services restart redis' e tenta de novo."
  exit 1
fi
echo "✓ Postgres e Redis no ar."

cd app

cleanup() {
  echo ""
  echo "→ Encerrando app/api/worker..."
  kill $(jobs -p) 2>/dev/null
}
trap cleanup EXIT INT TERM

# next dev carrega .env sozinho. api/worker usam a flag --env-file do
# próprio tsx (NODE_OPTIONS não aceita --env-file por segurança, e
# `--import tsx/esm` bate num bug de ciclo require/ESM do Node 26 aqui).
echo "→ Subindo app (http://localhost:3000), api e worker..."
npm run dev &
npx tsx watch --env-file=.env src/api-server/index.ts &
npx tsx watch --env-file=.env src/worker/index.ts &

wait
