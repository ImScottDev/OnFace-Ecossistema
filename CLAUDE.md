# CRM Callface — Instruções pro Claude / agentes

## O que é

CRM interno da Callface (SaaS B2B de telefonia + IA — Callpilot é o módulo de
agente de voz IA, discador preditivo é o módulo de discagem em massa).
Multi-tenant (`organizacaoId` em toda query), Next.js (app) + Hono (api) +
BullMQ (worker), Postgres + Redis, Drizzle ORM, NextAuth v5.

## Fluxo de trabalho (git) — LEIA ANTES DE COMMITAR OU FAZER DEPLOY

Existem 3 ambientes reais, cada um é uma branch neste mesmo repo:

- **`main`** = espelho fiel do que está rodando em produção (`crm.callface.io`,
  EC2 `/opt/callface/crm/`). Só recebe merge de coisa já validada em homolog.
- **`homolog`** = espelho de homolog (`homolog.crm.callface.io`,
  `/opt/callface/crm-homolog/`). Ambiente de teste do time — nada vai pra
  `main` sem passar por aqui primeiro e ser aprovado pelo Scott.
- **branch de feature/refactor** = seu trabalho do dia, criada a partir de
  onde ela vai ser testada primeiro.

Fluxo: trabalhar local (branch própria) → push → merge pra `homolog` → testar
em homolog de verdade → só com OK explícito do Scott, merge `homolog` → `main`
→ deploy em produção.

**IMPORTANTE — isso é código versionado, o deploy em si NÃO é via git:**
nem produção nem homolog têm `.git` na EC2. Deploy é rsync/scp do `app/`
+ `docker compose build && up -d` direto no servidor (ver receita em
`_deploy-prod/` e nas memórias do vault `reference_crm_callface_prod` /
`reference_callface_crm_homolog`). O git garante que existe UMA fonte de
verdade auditável; quem materializa isso no servidor ainda é manual.

Histórico da reconciliação (por que isso existe, o que tinha divergido entre
prod/homolog/git) está em `crm-callface-status.md` no vault, entrada de
07/08/2026.

## Ambiente de dev local

Postgres 16 + Redis nativos via Homebrew (não Docker — não está instalado
nessa máquina). Tudo em `app/.env` (gitignored, nunca commitar).

**Pra abrir o ambiente:**
```bash
./scripts/dev.sh
```
Ou dá duplo-clique em `Callface CRM - Dev.command` na Área de Trabalho.
Sobe Postgres/Redis (se não estiverem no ar), depois app (`:3000`), api
(`:3001`) e worker, os 3 juntos. Ctrl+C encerra os 3.

**Pra atualizar o banco local com dado fresco de produção:**
```bash
./scripts/refresh-dev-db.sh
```
`pg_dump` de produção → restaura local. On-demand (roda quando for começar a
trabalhar), não é replicação contínua.

**Regra de segurança do `.env` de dev — NUNCA quebrar isso:** ao gerar/atualizar
o `.env` local a partir do `.env` real de produção, sempre neutralizar (deixar
vazio) as chaves de integrações que causam efeito colateral real ou que
rotacionam token compartilhado com produção:
- `STRIPE_API_KEY` / `STRIPE_WEBHOOK_SECRET` (nunca cobrar cliente real)
- `RESEND_API_KEY` (nunca mandar e-mail real)
- `MICROSOFT_CLIENT_SECRET` (refresh de token OAuth é compartilhado com prod —
  se completar com sucesso local, pode invalidar a sessão de produção)
- `RD_REFRESH_TOKEN` (mesmo risco de rotação de token compartilhado)

`GROQ_API_KEY` e `META_ACCESS_TOKEN` podem ficar com o valor real (uso é
read-only / sem custo por rodar local).

**NUNCA hardcodar secret em script committado** (achado real: `start-worker.sh`
antigo tinha uma `GROQ_API_KEY` de verdade em texto puro — removido em 07/08).
Segredo sempre vem do `.env`, nunca literal no código/script.

## Paths importantes

- App: `app/src/`
- Schema: `app/src/lib/db/schema.ts`
- Worker: `app/src/worker/index.ts`
- API (Hono): `app/src/api-server/`
- Scripts de infra: `scripts/` (raiz do repo — dev.sh, refresh-dev-db.sh)
