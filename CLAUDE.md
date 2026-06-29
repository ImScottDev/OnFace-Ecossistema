# Scott Studio | CRM — Instructions for Claude

## What This Is

CRM + SDR automation for Scott Studio's "Prospecção Ativa" workflow:
1. Scott finds leads in Meta Ad Library → adds to CRM
2. CIPA analysis (BullMQ worker: heuristics + PageSpeed + Groq) → generates insumo_comercial
3. SDR Agent (n8n) reaches out via WhatsApp using CLOSER framework
4. Qualifies → hands off to Scott

## Deploy (OBRIGATÓRIO)

**NUNCA rode `docker compose up -d` diretamente.**

```bash
./deploy.sh all     # app + api + worker
./deploy.sh app     # só app
./deploy.sh worker  # só worker
```

O deploy.sh faz build ENQUANTO o container antigo roda, depois swap rápido (~2s via Traefik retry).

## Infraestrutura

- **Proxy reverso**: Traefik v3 (DNS challenge Cloudflare)
- **Containers**: app (Next.js), api (Hono), worker (BullMQ)
- **DB**: PostgreSQL 16
- **Cache/Queue**: Redis 7
- **VPS**: 159.203.130.124 — requer upgrade para 4GB RAM

## Stack

- Next.js 16 + Hono API + Drizzle ORM + BullMQ + Redis + PostgreSQL
- Auth: NextAuth v5 (credentials)
- Multi-tenant: organizacaoId em todas as queries
- Theme: Dark bg #0A0A0A, primary orange #EF6B3A, fonts Inter + JetBrains Mono

## Paths importantes

- App: `./app/src/`
- Schema: `./app/src/lib/db/schema.ts`
- Worker: `./app/src/worker/index.ts`
- API routes: `./app/src/api-server/routes/`
- SDR memory: `./app/src/api-server/routes/sdr.ts`
- Queue defs: `./app/src/lib/queue/index.ts`
- Logos: `./app/public/brand/`
- Docker: `./docker-compose.yml`

## Scott Studio Features

- **CIPA Analysis**: 9-category LP diagnostic (BullMQ job `cipa-analysis`)
- **InsumoComercial**: Groq llama-3.3-70b analysis output
- **SDR Memory**: PostgreSQL `sdr_memory` table — `/api/sdr/memory/:phone`
- **n8n Integration**: Webhook `primeiro-contato` triggers SDR Agent

## n8n SDR Agent

- URL: https://n8n.scottdev.com.br
- Workflows: `SDR — Primeiro Contato` + `SDR Agent — Conversa WhatsApp`
- WhatsApp: Evolution API at evolution.scottdev.com.br
