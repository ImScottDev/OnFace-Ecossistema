<p align="center">
  <img src="app/public/brand/callface-logo-white.png" alt="Callface CRM" width="320" />
</p>

<h3 align="center">A telefonia que nasceu inteligente.</h3>

<p align="center">
  CRM comercial da Callface — pré-vendas (SDR), pipeline de fechamento, propostas com checkout, e IA embutida. Tudo num lugar só.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Hono-API-E36002?logo=hono" />
  <img src="https://img.shields.io/badge/BullMQ-Workers-DC382D?logo=redis" />
  <img src="https://img.shields.io/badge/Groq-AI-000?logo=groq" />
  <img src="https://img.shields.io/badge/Stripe-Billing-635BFF?logo=stripe&logoColor=white" />
</p>

<p align="center">
  <strong>Live:</strong> <a href="https://crm.callface.io">crm.callface.io</a>
</p>

---

## O que é

CRM comercial interno da **Callface** (SaaS B2B de telefonia inteligente / VoIP + IA, grupo Wevy). É onde o time comercial opera o funil de ponta a ponta: o lead entra (RD Station ou plataforma Callface), a **SDR humana** qualifica no board de Pré-vendas, converte em oportunidade, o **closer** conduz no Pipeline até a proposta, e a proposta vira pagamento via **checkout Stripe** (assinatura mensal) → contrato → cliente em carteira.

O sistema nasceu como fork de um CRM próprio (stack Hono/Drizzle/Next 16/BullMQ) e foi moldado pra operação da Callface. Há IA embutida (AI SDR via Groq, disponível mas **não usada no go-live atual** — a qualificação hoje é humana).

> **Nota de estado:** o projeto está em produção (`crm.callface.io`) e em evolução ativa. Há resquícios do fork original ainda no código (feature de análise de LP "CIPA", `leads-bm`, domínios antigos) que estão em processo de limpeza — ver seção [Legado em limpeza](#legado-em-limpeza). Não são o produto; são dívida técnica a remover.

---

## Fluxo de trabalho (modelo atual)

A operação separa **Lead** (topo de funil, da SDR) de **Oportunidade/Negócio** (fundo de funil, do closer). Oportunidade só nasce quando a SDR qualifica.

### Entrada de leads

```
RD Station (form/LP) ──┐
                       ├──► POST /api/webhooks/rd-lead ──► Lead (tipo=lead, sdr_status=pending)
Plataforma Callface ───┘        (parser decodifica traffic_source base64, extrai utm_*,
                                 deriva origem, dedup por email/telefone)
```

### Board Pré-vendas (SDR — humana)

```
Novo (pending) → Em Contato (contacted) → Qualificando (qualifying)
       → [Qualificado]  → cria a Oportunidade no Pipeline + mantém o lead no board (badge OPP)
       → [Desqualificado]
       (colunas Qualificado/Desqualificado colapsadas, estilo Ganho/Perdido)
       (view Estagnados: Sem Retorno / Sem Interesse / Retomar Depois)
```

A SDR preenche a **Qualificação SDR** (quem faz as calls, tomador de decisão, CNPJ, CRM atual, nº de usuários) no lead — esses dados viajam automaticamente pra oportunidade na conversão.

### Pipeline do closer (Oportunidade/Negócio)

```
novo → qualificacao → contato_feito → reuniao_realizada
   → proposta_apresentada → negociacao_iniciada → em_fechamento → [ganho / perdido]
```

### Proposta → Pagamento → Cliente

```
Proposta (itens do catálogo, recorrente/avulso/setup)
   → "Enviar ao Cliente": gera checkout Stripe (assinatura mensal, email pré-preenchido,
      metadata propostaId/negocioId) + email branded via Resend + link no WhatsApp
   → cliente paga → webhook checkout.session.completed
   → negócio marcado GANHO + cria Contrato + promove Cliente (entra na Carteira)
```

### Ordem dos boards

`Pré-vendas (SDR) → Novos Negócios → Carteira → Estagnados`

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + Framer Motion + Recharts + dnd-kit |
| **Backend** | Hono (API standalone :3001) + Next.js API Routes + Drizzle ORM |
| **Database** | PostgreSQL 16 (46 tabelas, multi-tenant por `organizacaoId`) |
| **Workers** | BullMQ + Redis 7 |
| **Auth** | NextAuth v5 (credentials, JWT) |
| **IA** | Groq llama-3.3-70b (AI SDR nativo — disponível, não ativo no go-live) |
| **Billing** | Stripe (checkout de assinatura via REST) |
| **Email transacional** | Resend (proposta branded) |
| **Email caixa** | Google OAuth + Microsoft O365 + IMAP/SMTP |
| **WhatsApp** | WuzAPI (multi-sessão) |
| **Ingestão de leads** | RD Station (webhook + parser de UTM/traffic_source) |
| **Marketing data** | Meta Marketing API / Insights (gasto por campanha → CPL/CPQ/CPC) |
| **Deploy** | Docker (app + api + worker) em EC2, atrás de Traefik + Cloudflare |

---

## Features

### CRM Core
- **Leads** — Captura via RD Station + manual, scoring (ICP ponderado), `sdr_status` pra board de pré-vendas, qualificação SDR estruturada
- **Pré-vendas (SDR)** — Kanban de leads por `sdr_status`, drag-and-drop, timeline de movimentação com autoria, ação "Converter em oportunidade", colunas espelho do pipeline do closer
- **Empresas** — Auto-criação ao cadastrar lead, dados de enriquecimento
- **Negócios / Pipeline** — Kanban drag-and-drop do closer, múltiplos pipelines, qualificação SDR herdada (read-only), agenda de reunião no handover
- **Propostas** — Itens do catálogo (recorrente/avulso/setup), desconto, **checkout Stripe** + envio por email (Resend) e WhatsApp, aceite via pagamento
- **Contratos** — Gerados ao fechar negócio, tracking de MRR
- **Carteira** — Clientes ativos vs churned, MRR, ticket médio
- **Contatos** — Gestão unificada WhatsApp/Email

### Comunicação
- **WhatsApp** — Multi-sessão via WuzAPI, inbox com tabs, envio de mídia, AI SDR opcional por contato
- **Email** — Contas Google/Microsoft/IMAP, inbox por thread, templates, sequências automatizadas

### Inteligência (IA)
- **AI SDR (nativo)** — SDR via Groq com tool-use (respond, qualify_lead, handoff, advance_stage, schedule_meeting), memória persistente, rate limit, debounce, horário comercial, style guide. **Disponível, mas a operação atual usa SDR humana.**

### Operacional
- **Dashboard ("Meu Dia")** — Alertas, agenda de reuniões do usuário, KPIs company-wide, mini pipeline, atividades
- **Relatórios** — 3 abas (Marketing, Comercial, Pós-Venda), seletor de período, **piso go-live** (histórico migrado não suja os gráficos). Marketing cruza gasto Meta (por campanha) com contadores CRM (por `utm_campaign`): **CPL / CPQ / CPC**
- **Campanhas** — Cold outreach (tabela + wizard)
- **Financeiro / Inbox / Onboarding** — Módulos da operação Callface
- **Tarefas & Reuniões**, **NPS**, **Campos Custom**, **Labels**, **Notas**, **Notificações**

### Admin
- **Multi-tenant** — Orgs isoladas; roles `super_admin` / `admin` / `gerente` / `vendedor`
- **Super Admin** — Override de org (view-as), gestão de orgs e usuários
- **Configurações** — Pipeline (stages/cores/SLA), AI SDR, contas de email, sessões WhatsApp, catálogo de serviços, campos custom, ICP (pesos)

---

## Arquitetura

```
Internet
  │
Cloudflare (DNS + CDN)
  │
EC2 (Ubuntu, 8GB) ── Traefik v3 (SSL + reverse proxy)
  │
  ├── crm.callface.io
  │     ├── Next.js App (:3000)   — UI + Next API Routes (app/api/*)
  │     ├── Hono API   (:3001)    — api-server/routes/* (Traefik manda /api/* pra cá)
  │     └── BullMQ Worker (:3002) — filas + Chromium + ffmpeg
  │
  ├── PostgreSQL 16 (interno)
  └── Redis 7 (interno)
```

> **Roteamento de API (importante):** em produção o Traefik envia `/api/*` pro **Hono**. Rota nova de API deve ir no Hono (`api-server/routes/`), não no Next route handler — senão dá 404 em prod. `getCtx` tem `realRole` pra view-as do super admin.

### Containers
| Container | Porta | Função |
|-----------|-------|--------|
| app | 3000 | Next.js (standalone) |
| api | 3001 | Hono (esbuild bundle) |
| worker | 3002 | BullMQ workers + Chromium + ffmpeg |

### Worker / Filas (BullMQ)
`lead-scoring`, `site-lead-qualify`, `whatsapp-incoming`, `whatsapp-outgoing`, `whatsapp-status-update`, `enrichment`, `notifications`, `follow-up`. Schedulers sem fila: `slaWorker` (SLA/contratos/NPS a cada 5min), `emailSyncWorker`, `emailSequenceWorker`.

---

## Database

46 tabelas PostgreSQL 16, multi-tenant (`organizacaoId` em todas as queries). Schema em `app/src/lib/db/schema.ts`. Migrations em `app/src/lib/db/migrations/`.

Principais: `organizacoes`, `usuarios`, `leads`, `empresas`, `negocios`, `propostas` + `propostaItens`, `contratos`, `contatos`, `whatsappMensagens`/`whatsappSessao`, `emails`/`emailContas`, `pipelines`, `aiSdrConfig`/`aiSdrContatoState`/`aiSdrLogs`/`sdrMemory`, `servicosCatalogo`, `atividades`, `statusChanges`, `tarefas`, `reunioes`, `negocioLeads` (junction lead↔negócio), `customFields`, `labels`, `nps`, `campanhas`.

---

## API

Duas camadas. **Em prod, `/api/*` vai pro Hono via Traefik** (ver nota de roteamento acima).

| Camada | Local | Papel |
|--------|-------|-------|
| Hono API | `app/src/api-server/routes/` (31 módulos) | Camada principal de API em produção |
| Next API Routes | `app/src/app/api/` | Webhooks (`rd-lead`, `site-lead`, `stripe`), uploads, auth, e rotas servidas pelo Next em dev |

Módulos Hono: `leads`, `negocios`, `empresas`, `propostas`, `contratos`, `contatos`, `contatos-unified`, `email`, `whatsapp`, `ai-sdr`, `sdr`, `apollo`, `enrichment`, `admin`, `relatorios`, `pipelines`, `configuracoes`, `custom-fields`, `servicos-catalogo`, `labels`, `notas`, `notificacoes`, `nps`, `tarefas`, `reunioes`, `automacoes`, `carteira`, `perfil`, `usuarios`, `uploads`, `auth`, `health`.

---

## Páginas (App Router — `app/src/app/(crm)/`)

`dashboard` · `leads` · `empresas` · `contatos` · `pre-vendas` · `pipeline` · `negocios` · `propostas` · `contratos` · `carteira` · `campanhas` · `inbox` · `whatsapp` · `email` · `relatorios` · `financeiro` · `onboarding` · `automacoes` · `perfil` · `prospeccao`* · `configuracoes` · `admin`

Públicas: `login`. (`*prospeccao` é legado do fork — ver seção abaixo.)

---

## Setup Local (Dev)

### Pré-requisitos
- Node.js 20+
- Docker Desktop (PostgreSQL + Redis)

### 1. Suba PostgreSQL + Redis (portas isoladas: PG 5433, Redis 6380)
```bash
docker compose -f docker-compose.dev.yml up -d
# confere: docker ps → callface-postgres (5433) e callface-redis (6380)
```

### 2. Configure o ambiente
Copie `.env.example` pra `app/.env` e preencha. Mínimo pra subir:
```env
DATABASE_URL=postgresql://callface:callface2026dev@localhost:5433/callface_crm
REDIS_URL=redis://localhost:6380
AUTH_SECRET=<openssl rand -base64 32>
AUTH_URL=http://localhost:3010
GROQ_API_KEY=<sua chave>
```

### 3. Crie as tabelas e seed
```bash
cd app
npx drizzle-kit push
npm run db:seed
npm run db:seed-servicos
```

### 4. Rode (porta 3010)
```bash
npm run dev -- -p 3010
```
Acesse **http://localhost:3010** — Login: `scott@scottdev.com.br` / `scott2026`

### 5. Worker (opcional — WhatsApp, Email Sync, AI SDR)
```bash
REDIS_URL="redis://localhost:6380" DATABASE_URL="..." GROQ_API_KEY="..." npx tsx src/worker/index.ts
```

### Scripts (`app/package.json`)
```bash
npm run dev              # Next.js dev
npm run build            # build de produção
npm run db:push          # push do schema
npm run db:generate      # gerar migration
npm run db:migrate       # rodar migrations
npm run db:studio        # Drizzle Studio (GUI)
npm run db:seed          # seed org + user + dados exemplo
npm run db:seed-servicos # seed catálogo de serviços
npm run db:cleanup-seed  # limpar dados de seed
```

---

## Deploy (Produção)

Em **EC2** (`/opt/callface/crm`), atrás de Traefik + Cloudflare, domínio `crm.callface.io`.

> Deploy hoje é **manual via `scp`** (`deploy.sh`), **não** é pull do git. O repositório serve como fonte da verdade do código e contexto; a EC2 ainda recebe os arquivos por cópia + rebuild dos containers. Migrar pra deploy git-based é um TODO.

```bash
./deploy.sh all     # app + api + worker
./deploy.sh app     # só frontend
./deploy.sh api     # só API
./deploy.sh worker  # só worker
```

---

## Branding (Callface)

| Token | Valor |
|-------|-------|
| **Carmim (primary)** | `#e23752` |
| **Roxo** | `#8e27ef` |
| **Lima (accent)** | `#c8ff00` |
| **Fonte títulos** | Kanit |
| **Fonte corpo** | Noto Sans |
| Raio / estilo | radius 8px, flat, sombra neutra (sem sombra colorida) |

Rodapé/login mantêm a assinatura **"© Scott Studio · Direitos reservados"** (decisão de produto — Scott Studio é quem construiu/opera o CRM).

---

## Legado em limpeza

Resquícios do CRM original (fork) que **ainda estão no código mas não são o produto Callface**. Em processo de remoção — ignore pra entender o sistema atual:

- **CIPA / análise de LP** — feature de diagnóstico de landing pages (Puppeteer + PageSpeed + Groq) do projeto original. Ainda referenciada em `worker/index.ts`, `lib/db/schema.ts`, `lib/ai/sdr.ts`, rotas e algumas telas. Não faz parte do fluxo Callface.
- **`leads-bm` / Biblioteca de Anúncios Meta** — prospecção via Meta Ad Library. A página pública e a rota Hono já saíram; restam a tabela (`migrations/0005_leads_bm.sql`, `schema.ts`) e `lib/integrations/meta-insights.ts` (este último **ainda é usado** pelo relatório de gasto por campanha — não remover sem checar).
- **Página `/prospeccao`** — herdada do fork.
- **Domínios antigos** — `.env.example`, CORS em `api-server/server.ts` e seed ainda citam `scottdev.com.br` / `scottstudio.com.br`. Produção usa `callface.io`.

---

<p align="center">
  <strong>Callface CRM</strong> — A telefonia que nasceu inteligente.<br/>
  <sub>© Scott Studio · Direitos reservados</sub>
</p>
