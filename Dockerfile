# Imagem do app ONFACE (Next), construída a partir da RAIZ do repositório.
#
# O contexto é a raiz porque o `app` depende dos `@onface/*` de `packages/`
# por `workspace:*`, protocolo do pnpm: com contexto `./app` e `npm ci` (o
# arranjo antigo), a imagem não constrói.
#
# O install e o build ficam no MESMO estágio de propósito. O pnpm liga os
# pacotes do workspace por symlink para dentro de `node_modules`, e copiar essa
# árvore entre estágios (`COPY --from=deps`) quebra os links. Perde-se uma
# camada de cache; ganha-se uma imagem que constrói.
FROM node:22-alpine AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile

ENV NEXT_TELEMETRY_DISABLED=1
# O DEV divide uma EC2 de 8 GB com os serviços atuais. O build do Next com 3 GB
# deixava a máquina inteira em swap; 1,5 GB mantém o processo contido sem
# afetar o runtime do app, que tem seu próprio teto abaixo.
ENV NODE_OPTIONS="--max-old-space-size=1536"

# `next build` direto, e NÃO `run build`, que desde o CP61 roda `tsc --noEmit`
# antes.
#
# A intenção era ter o portão de tipo também aqui. Medido no CP63: o `tsc` sobre
# o monorepo inteiro é morto por falta de memória dentro do container — exit 137
# com 1536 MB de heap, e de novo com 4096, porque a máquina de build tem 3,8 GB
# no total. Insistir deixaria a imagem impossível de construir, que é pior do
# que não ter o portão neste ponto.
#
# O portão não sumiu, mudou de lugar: `.github/workflows/portao.yml` roda o
# typecheck em todo push e PR, ANTES de qualquer imagem existir, e `npm run
# build` local continua rodando os dois. O que se perde aqui é uma segunda
# checagem do que o CI já checou; o que se ganha é uma imagem que constrói.
RUN pnpm --filter ./app exec next build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=768"
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Em monorepo o `standalone` preserva a árvore do repositório a partir de
# `outputFileTracingRoot`, então o servidor sai em `app/server.js` e os
# `@onface/*` vêm junto em `node_modules`. Copiar o conteúdo achatado deixaria o
# servidor sem encontrar o próprio domínio.
COPY --from=builder --chown=nextjs:nodejs /repo/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/app/.next/static ./app/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/app/public ./app/public

RUN mkdir -p /app/app/public/uploads && chown nextjs:nodejs /app/app/public/uploads
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "app/server.js"]
