# Ambiente de Dev — como esta reconstrução foi rodada de verdade

O `README.md` na raiz do repo descreve o setup via Docker Compose (Postgres 5433, Redis 6380, app na porta 3010). **Toda a reconstrução do CRM 2.0 (esta branch) foi rodada e validada com um setup diferente**: Postgres/Redis via Homebrew, portas padrão, app na porta 3000. Foi decisão técnica (mais simples pra essa máquina específica, sem depender do Docker Desktop) — não muda nada sobre como o sistema se comporta em produção, é só infraestrutura local. Documentado aqui pra quem for reproduzir o ambiente exato em que este trabalho foi validado.

## Pré-requisitos
- Node.js (o projeto foi rodado com Node v26.5.0 nesta sessão)
- Postgres 16 via Homebrew: `brew install postgresql@16`
- Redis via Homebrew: `brew install redis`

## 1. Subir Postgres + Redis
```bash
brew services start postgresql@16
brew services start redis
```

## 2. Banco de dados
Criar o role/banco local (nomes usados nesta sessão: role `callface`, banco `callface_crm`, senha `callface2026dev`):
```bash
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
createuser callface -s   # ou ajuste conforme sua instalação
createdb -O callface callface_crm
```

**Schema**: esta sessão usou `drizzle-kit push --force` (introspecção direta no banco) pra TODAS as mudanças de schema, não `drizzle-kit generate` — o histórico de migrations em `app/src/lib/db/migrations/` está **defasado** em relação ao schema atual (só tem os arquivos até 07/08, várias tabelas novas desta sessão — `cadence_definitions`, `cadence_enrollments`, `cadence_enrollment_events`, `comercial_evidencia`, `won_evidence_policies`, `metricas_diarias`, `pessoas`, `pontos_contato`, `oportunidades`, `clientes`, `teams`, `audit_log`, `event_outbox`, entre outras — não têm arquivo `.sql` de migration correspondente).

Duas formas de reproduzir o schema atual:
- **Opção A (recomendada pra validar rápido)**: restaurar `docs/reconstruction/schema-snapshot-2026-08-09.sql` — dump `pg_dump --schema-only` do banco local real no fim desta sessão (09/08/2026). Reflete o estado exato do schema, não é uma migration incremental.
  ```bash
  psql -U callface -d callface_crm -f docs/reconstruction/schema-snapshot-2026-08-09.sql
  ```
- **Opção B**: `cd app && npx drizzle-kit push --force` — aplica `src/lib/db/schema.ts` (a fonte da verdade) direto no banco, mesmo método usado a sessão inteira.

**Dado real**: o banco local foi populado via `./scripts/refresh-dev-db.sh` (pg_dump de produção via SSH, restaurado local) — script real no repo, mas exige acesso SSH à infra da Callface. Sem isso, use `npm run db:seed` (dado de exemplo, não o dataset real usado nesta sessão).

## 3. `.env`
Copiar `.env.example` (raiz do repo) pra `app/.env`. Chaves mínimas pra subir local sem integrações externas:
```env
DATABASE_URL=postgresql://callface:callface2026dev@localhost:5432/callface_crm
REDIS_URL=redis://localhost:6379
AUTH_SECRET=<qualquer string fixa — openssl rand -base64 32>
AUTH_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development
```
`STRIPE_API_KEY` e `GROQ_API_KEY` foram deixados **deliberadamente vazios/inválidos** nesta sessão (regra do projeto: nunca cobrar cliente real; a chave de Groq real do time estava expirada) — várias features (AI SDR real, sync de pagamento real) não puderam ser validadas de ponta a ponta por isso, documentado em `ARCHITECTURE_DECISIONS.md` (ADR-EXEC-009) e `RECONSTRUCTION_STATE.md`.

## 4. Subir tudo
```bash
./scripts/dev.sh
```
Sobe Next.js (`:3000`), o servidor de API Hono (`:3001`) e o worker BullMQ, os 3 juntos, lendo `app/.env`. Ctrl+C uma vez mata os 3.

**Achado real desta sessão**: o processo do api-server (`tsx watch`) não recarrega sozinho de forma confiável em todo cenário — se editar algo em `src/api-server/` e a mudança não parecer refletir, mate o processo `node .../src/api-server/index.ts` manualmente e deixe o `tsx watch` (processo pai) resubir, ou rode `npx tsx watch --env-file=.env src/api-server/index.ts` direto numa aba nova.

## 5. Login
Contas locais usadas nesta sessão (senha resetada localmente, **só no banco de dev, sem relação com produção**):
- `scott@scottdev.com.br` / `callface2026` — role `super_admin`
- `kaua.araujo@callface.ai` / `callface2026` — role `admin`

`/admin/*` (Organizações, Usuários, Qualidade de Dados, Duplicidade de Contratos) é restrito a `super_admin` por `src/middleware.ts` (regra pré-existente, não desta sessão).

## O que NÃO foi tocado em produção/homolog
Nada. Toda mudança desta reconstrução (código, schema, dado) ficou restrita a este banco/ambiente local. Nenhum commit foi promovido pra `homolog` ou `main` até este ponto — é exatamente o snapshot que está sendo subido pro GitHub agora, pra revisão externa, antes de qualquer promoção.
