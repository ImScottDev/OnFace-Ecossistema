# syntax=docker/dockerfile:1
# Imagens do ONFACE, construídas a partir da RAIZ do repositório. Um arquivo,
# dois alvos:
#
#   --target app      Next (frontend + rotas /api que vivem no Next)
#   --target backend  API Hono e worker BullMQ: a MESMA imagem; o compose
#                     escolhe o processo pelo `command`
#
# Quem constrói é o GitHub Actions (.github/workflows/imagens.yml), que publica
# no GHCR com a tag do commit; a VPS só baixa e troca. `./deploy.sh dev
# --construir-aqui` usa este mesmo arquivo como fallback no servidor.
#
# Por que este desenho (deploy de 48 min em 12/10/2026):
#   - O install dependia de `COPY . .`: qualquer linha mudada refazia o install
#     do monorepo inteiro, três vezes (app, api, worker). Agora o install só
#     enxerga os manifests (estágio `manifestos`) e fica em cache até o
#     lockfile ou um package.json mudar. A camada de node_modules da imagem
#     final sai idêntica entre deploys, e a VPS não a baixa de novo.
#   - api e worker eram dois builds iguais (mesmo install, mesmo esbuild,
#     mesmo runner com chromium). Viraram uma imagem.
#
# O contexto é a raiz porque o `app` depende dos `@onface/*` de `packages/`
# por `workspace:*` (protocolo do pnpm). O build roda em cima do estágio de
# deps (FROM, não COPY --from): os symlinks do pnpm continuam válidos.

FROM node:22-alpine AS base
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

# ─── Só os manifests: é a ÚNICA coisa de que o install depende ──────────────
# Este estágio refaz a cada mudança (é barato), mas o que sai dele só muda
# quando um manifest muda, e o COPY seguinte é cacheado pelo conteúdo.
FROM base AS manifestos
COPY . /src
RUN cd /src && mkdir -p /out && cp pnpm-lock.yaml pnpm-workspace.yaml package.json /out/ && \
    find app packages -name package.json -not -path '*/node_modules/*' | \
    while read -r f; do mkdir -p "/out/$(dirname "$f")" && cp "$f" "/out/$f"; done

FROM base AS deps
COPY --from=manifestos /out/ ./
RUN --mount=type=cache,id=onface-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

# ─── Next ───────────────────────────────────────────────────────────────────
FROM deps AS build-app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# 1,5 GB de heap: o fallback na VPS divide uma EC2 de 8 GB com produção.
ENV NODE_OPTIONS="--max-old-space-size=1536"
# `next build` direto, sem o `tsc --noEmit` do `run build`: o tsc do monorepo
# morre por memória dentro do container (CP63). O portão de tipo roda em
# `.github/workflows/portao.yml`, em todo push, antes de qualquer imagem.
RUN --mount=type=cache,id=onface-next,target=/repo/app/.next/cache \
    pnpm --filter ./app exec next build

# ─── API + worker ───────────────────────────────────────────────────────────
FROM deps AS build-backend
COPY . .
# Uma chamada só do esbuild para todos os entrypoints (`saida=entrada`).
# `--packages=external` deixa as dependências em node_modules; os nove
# `@onface/*` são EMBUTIDOS pelo alias, senão o container morre com
# ERR_MODULE_NOT_FOUND (são TypeScript puro, sem build próprio, SPEC §34).
# migrar e checar-env-runtime: o deploy roda migrations e confere o ambiente
# com a imagem NOVA antes de trocar containers, sem tsx no runtime.
# smoke-*: rodam dentro do worker DEV (assinatura Claude, NEXO, Documenso).
RUN cd app && pnpm dlx esbuild@0.28.2 \
    api/index=src/api-server/index.ts \
    worker/index=src/worker/index.ts \
    migrar=src/lib/db/migrar.ts \
    checar-env-runtime=src/scripts/checar-env-runtime.ts \
    smoke-claude-subscription=src/scripts/smoke-claude-subscription.ts \
    smoke-claude-subscription-tools=src/scripts/smoke-claude-subscription-tools.ts \
    smoke-nexo-claude-subscription=src/scripts/smoke-nexo-claude-subscription.ts \
    smoke-documenso-e2e=src/scripts/testar-documenso-local.ts \
    --bundle --platform=node --format=esm --target=node22 --outdir=dist \
    --out-extension:.js=.mjs --packages=external --alias:@=./src \
    --alias:@onface/acquisition=../packages/domain/acquisition/index.ts \
    --alias:@onface/catalog=../packages/domain/catalog/index.ts \
    --alias:@onface/identity=../packages/domain/identity/index.ts \
    --alias:@onface/sales=../packages/domain/sales/index.ts \
    --alias:@onface/integrations-callface-ai=../packages/integrations/callface-ai/index.ts \
    --alias:@onface/integrations-meta=../packages/integrations/meta/index.ts \
    --alias:@onface/platform-database=../packages/platform/database/index.ts \
    --alias:@onface/platform-events=../packages/platform/events/index.ts \
    --alias:@onface/platform-storage=../packages/platform/storage/index.ts

FROM node:22-alpine AS backend
# ffmpeg (áudio) + chromium (PDF de proposta via puppeteer)
RUN apk add --no-cache ffmpeg chromium nss freetype harfbuzz ca-certificates ttf-freefont ttf-liberation
WORKDIR /repo
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 onface --ingroup nodejs && \
    mkdir -p /repo/app/public/uploads && chown -R onface:nodejs /repo/app/public
# node_modules vem do estágio de deps (só muda com o lockfile), em camada
# própria; `packages/` NÃO vem, o domínio já está no bundle. Os dois
# node_modules porque o pnpm liga o do app ao da raiz por symlink.
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/app/node_modules ./app/node_modules
COPY --from=build-backend /repo/app/package.json ./app/
COPY --from=build-backend /repo/app/src/lib/db/migrations ./app/dist/migrations
# Texto oficial dos contratos: a API garante os modelos na subida.
COPY --from=build-backend /repo/app/src/lib/crm/templates-contrato ./app/dist/templates-contrato
ENV MODELOS_CONTRATO_DIR=/repo/app/dist/templates-contrato
COPY --from=build-backend /repo/app/dist ./app/dist
USER onface
EXPOSE 3001
# O compose define o processo: api → app/dist/api/index.mjs,
# worker → app/dist/worker/index.mjs.
CMD ["node", "app/dist/api/index.mjs"]

FROM node:22-alpine AS app
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=768"
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
# Em monorepo o `standalone` preserva a árvore a partir de
# `outputFileTracingRoot`: o servidor sai em `app/server.js`.
COPY --from=build-app --chown=nextjs:nodejs /repo/app/.next/standalone ./
COPY --from=build-app --chown=nextjs:nodejs /repo/app/.next/static ./app/.next/static
COPY --from=build-app --chown=nextjs:nodejs /repo/app/public ./app/public
RUN mkdir -p /app/app/public/uploads && chown nextjs:nodejs /app/app/public/uploads
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "app/server.js"]
