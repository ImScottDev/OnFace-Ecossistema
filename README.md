<p align="center">
  <img src="app/public/brand/callface-logo-white.png" alt="Callface CRM" width="320" />
</p>

<h3 align="center">A telefonia que nasceu inteligente.</h3>

<p align="center">
  CRM comercial da Callface — pré-vendas (SDR), pipeline de fechamento, propostas com checkout, financeiro, onboarding/CS, telefonia integrada e IA embutida. Tudo num lugar só.
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
  <strong>Produção:</strong> <a href="https://crm.callface.io">crm.callface.io</a> ·
  <strong>Homologação:</strong> <a href="https://homolog.crm.callface.io">homolog.crm.callface.io</a>
</p>

---

## Índice

- [O que é](#o-que-é)
- [Fluxo de trabalho (modelo atual)](#fluxo-de-trabalho-modelo-atual)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Database](#database)
- [API](#api)
- [Worker / Filas](#worker--filas)
- [Auth e permissões](#auth-e-permissões)
- [Módulos e features](#módulos-e-features)
- [Integrações externas](#integrações-externas)
- [Páginas (frontend)](#páginas-frontend)
- [Setup Local (Dev)](#setup-local-dev)
- [Deploy](#deploy)
- [Branding (Callface)](#branding-callface)
- [Estado do produto — o que está ativo, pausado ou é dívida técnica](#estado-do-produto--o-que-está-ativo-pausado-ou-é-dívida-técnica)

---

## O que é

CRM comercial interno da **Callface** (SaaS B2B de telefonia inteligente / VoIP + IA, grupo Wevy). É onde o time comercial opera o funil de ponta a ponta: o lead entra (RD Station ou plataforma Callface), a **SDR humana** qualifica no board de Pré-vendas (com régua de cadência de 13 toques), converte em oportunidade, o **closer** conduz no Pipeline até a proposta, e a proposta vira pagamento via **checkout Stripe** (assinatura mensal) → contrato → cliente em carteira → onboarding → acompanhamento de CS.

O sistema nasceu como fork de um CRM próprio da Scott Studio (stack Hono/Drizzle/Next 16/BullMQ) e foi moldado pra operação da Callface. Há IA embutida em duas frentes distintas, que não devem ser confundidas:

- **AI SDR (nativo, texto/WhatsApp)** — agente Groq que vive dentro do próprio CRM, com tool-use pra qualificar e agendar. Está implementado e disponível, mas **a operação hoje usa SDR humana** — não é o motor de qualificação em produção.
- **Callpilot (voz, plataforma Callface)** — agente de IA de voz que liga pro lead, orquestrado por uma automação externa (Puppeteer) que cria e ativa campanhas na Callface. Está implementado mas **pausado** — ver [Estado do produto](#estado-do-produto--o-que-está-ativo-pausado-ou-é-dívida-técnica).

> **Nota de estado:** o projeto está em produção (`crm.callface.io`) e em evolução ativa, com ambiente de homologação (`homolog.crm.callface.io`) pra validar antes de promover. Há resquícios do fork original ainda no código (feature de análise de LP "CIPA", `leads-bm`, domínios antigos) em processo de limpeza — ver [Legado em limpeza](#legado-em-limpeza).

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

Leads de Meta Lead Ads que chegam sem UTM completo são enriquecidos via API do RD Station (`lib/integrations/rd-criativo.ts`, job de backfill/cinto-e-suspensório pra `utm_content`).

### Board Pré-vendas (SDR — humana) + régua de cadência

```
Novo (pending) → Em Contato (contacted) → Qualificando (qualifying)
       → [Qualificado]  → cria a Oportunidade no Pipeline + mantém o lead no board (badge OPP)
       → [Desqualificado]
       (colunas Qualificado/Desqualificado colapsadas, estilo Ganho/Perdido)
       (view Estagnados: Sem Retorno / Sem Interesse / Retomar Depois)
```

A SDR preenche a **Qualificação SDR** (quem faz as calls, tomador de decisão, CNPJ, CRM atual, nº de usuários) no lead — esses dados viajam automaticamente pra oportunidade na conversão.

Cada lead inbound roda numa **régua de cadência de 13 toques** (ligação + WhatsApp + e-mail, ~14 dias, scripts prontos com placeholders `{primeiro_nome}`/`{empresa}`/`{seu_nome}` resolvidos server-side, editáveis pela SDR antes de enviar — `lib/cadencia/sdr-inbound.ts`). Se a SDR não faz o primeiro contato em 48h, o lead escala automaticamente pra "Follow up" (`lib/crm/sdr-escalation.ts`).

### Pipeline do closer (Oportunidade/Negócio)

```
novo → qualificacao → contato_feito → reuniao_realizada
   → proposta_apresentada → negociacao_iniciada → em_fechamento → [ganho / perdido]
```

Reuniões são agendadas por round-robin nativo entre closers ativos (`lib/crm/agenda-closers.ts`), respeitando disponibilidade semanal + bloqueios pontuais e, quando o closer conecta a própria conta, também a agenda real do Outlook (Microsoft Graph).

### Proposta → Pagamento → Cliente

```
Proposta (itens do catálogo, recorrente/avulso/setup)
   → "Enviar ao Cliente": gera checkout Stripe (assinatura mensal, email pré-preenchido,
      metadata propostaId/negocioId) + email branded via Resend + link no WhatsApp
   → cliente paga → webhook checkout.session.completed
   → negócio marcado GANHO + cria Contrato + promove Cliente (entra na Carteira)
```

### Cliente → Onboarding → CS

```
Contrato ativo → Onboarding (checklist por produto: ai / pabx / ai_pabx)
   → item "primeiro uso real" confirmado automaticamente via tabela de ligações
   → checklist 100% → Health Score de CS calculado (0.7 saúde de cobrança Stripe + 0.3 pontualidade do onboarding)
```

### Ordem dos boards

`Pré-vendas (SDR) → Novos Negócios → Carteira → Estagnados`

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + Framer Motion + Recharts + dnd-kit |
| **Backend** | Hono (API standalone :3001) + Next.js API Routes + Drizzle ORM |
| **Database** | PostgreSQL 16 (57+ tabelas, multi-tenant por `organizacaoId`) |
| **Workers** | BullMQ + Redis 7 |
| **Auth** | NextAuth v5 (credentials, JWT) |
| **IA (texto)** | Groq llama-3.3-70b (AI SDR nativo — disponível, não ativo no go-live) |
| **IA (voz)** | Callpilot — agente de voz da plataforma Callface, orquestrado via Puppeteer (pausado) |
| **Billing** | Stripe (checkout de assinatura via REST + sync híbrido webhook/polling) |
| **Email transacional** | Resend (proposta branded) |
| **Email caixa** | Google OAuth + Microsoft O365 + IMAP/SMTP |
| **WhatsApp** | WuzAPI (multi-sessão) |
| **Ingestão de leads** | RD Station (webhook + parser de UTM/traffic_source) |
| **Marketing data** | Meta Marketing API / Insights (gasto por campanha → CPL/CPQ/CPC/ROAS) |
| **Telefonia** | Callface (webhook de eventos de ligação + fila de discagem/discador preditivo) |
| **Deploy** | Docker (app + api + worker) em EC2, atrás de Traefik + Cloudflare |

---

## Arquitetura

```
Internet
  │
Cloudflare (DNS + CDN)
  │
EC2 (Ubuntu, 8GB) ── Traefik v3 (SSL + reverse proxy)
  │
  ├── crm.callface.io (prod) / homolog.crm.callface.io (homolog, banco isolado clonado)
  │     ├── Next.js App (:3000)   — UI + Next API Routes (app/api/*)
  │     ├── Hono API   (:3001)    — api-server/routes/* (Traefik manda /api/* pra cá)
  │     └── BullMQ Worker (:3002) — filas + Chromium + ffmpeg
  │
  ├── PostgreSQL 16 (interno)
  └── Redis 7 (interno)
```

> **Roteamento de API (importante):** em produção o Traefik envia `/api/*` pro **Hono**. Rota nova de API deve ir no Hono (`api-server/routes/`), não no Next route handler — senão dá 404 em prod. Exceções conhecidas que continuam no Next: `/api/financeiro` e `/api/webhooks/*`. `getCtx` tem `realRole` pra view-as do super admin.

### Containers

| Container | Porta | Função |
|-----------|-------|--------|
| app | 3000 | Next.js (standalone) |
| api | 3001 | Hono (esbuild bundle) |
| worker | 3002 | BullMQ workers + Chromium + ffmpeg |

---

## Database

57+ tabelas PostgreSQL 16, multi-tenant (`organizacaoId` em todas as queries). Schema em `app/src/lib/db/schema.ts`. Migrations em `app/src/lib/db/migrations/`.

| Domínio | Tabelas |
|---------|---------|
| **CRM core** | `organizacoes`, `usuarios`, `leads`, `metaLeadStaging`, `pipelines`, `negocios`, `negocioLeads`, `eventos`, `atividades`, `statusChanges`, `empresas`, `contatos`, `notas`, `labels`, `leadLabels`, `negocioLabels`, `customFields`, `contatoListas`, `leadListas`, `buscasSalvas`, `campanhas`, `reunioes`, `tarefas`, `notificacoes` |
| **Financeiro** | `contratos`, `assinaturas` (espelho Stripe subscriptions), `faturas` (espelho Stripe invoices), `mrrMovimentos`, `propostas`, `propostaItens`, `servicosCatalogo` |
| **Telefonia** | `ligacoes` (série histórica de chamadas vindas da Callface) |
| **Cadência / SDR / IA** | `cadenciaExecucoes`, `sdrMemory`, `aiSdrConfig`, `aiSdrContatoState`, `aiSdrLogs`, `outreachCampanhas`, `automacoes` |
| **Onboarding / CS** | `onboardingChecklist`, `contasCs` (health_score, status_saude), `marcosCs`, `npsRespostas` |
| **Agenda / closers** | `closerDisponibilidade`, `closerBloqueios`, `leads.agenda_closer_id` (fixa o closer durante agendamento pelo Agente SDR) |
| **WhatsApp** | `whatsappSessao`, `whatsappMensagens`, `whatsappTemplates`, `leadUserUnread` |
| **E-mail** | `emailContas`, `emails`, `emailTemplates`, `emailSequencias`, `emailSequenciaPassos`, `emailSequenciaExecucoes` |
| **Auth** | `authTokens` (convite/reset de senha por hash) |
| **Outros** | `metas` |

### Migrations recentes

| Migration | O que adiciona |
|-----------|-----------------|
| `0006_cadencia_execucoes.sql` | `cadencia_execucoes` — execução por lead+toque da régua de 13 toques (unique `lead_id, ordem` pra upsert em reenvio) |
| `0007_closer_disponibilidade.sql` | `closer_disponibilidade` (horário recorrente + almoço) e `closer_bloqueios` (bloqueios pontuais) |
| `0008_lead_agenda_closer.sql` | `leads.agenda_closer_id` — evita troca de closer no meio da conversa via round-robin |
| `0009_midia_paga_indices.sql` | índices pro relatório de Mídia Paga (`idx_leads_utm_campaign_lookup`, `idx_negocios_status_ganho_at`) |
| `0010_onboarding_cs.sql` | `onboarding_checklist`, `contas_cs`, `marcos_cs` — Onda 1 de Onboarding + CS |

---

## API

Duas camadas. **Em prod, `/api/*` vai pro Hono via Traefik** (ver nota de roteamento acima).

| Camada | Local | Papel |
|--------|-------|-------|
| Hono API | `app/src/api-server/routes/` (39 módulos) | Camada principal de API em produção |
| Next API Routes | `app/src/app/api/` | Webhooks (`rd-lead`, `site-lead`, `stripe`, `callface`, `meta-lead-ids`), financeiro, uploads, auth |

### Módulos Hono (`api-server/routes/`)

| Módulo | Expõe |
|--------|-------|
| `admin` | CRUD de organizações/usuários, troca de organização, view-as, disparo manual do job de escalonamento SDR |
| `agenda` | Disponibilidade semanal do closer, bloqueios, fila round-robin, pausa/retomada de rodízio, slots reais |
| `ai-sdr` | Config do Agente SDR (IA WhatsApp), estado por contato, toggle manual, logs, stats, preview de estilo |
| `apollo` | Apollo.io — busca de leads, import em massa, créditos, buscas salvas, webhook |
| `auth-flow` | Definição de senha por token (convite/reset) e "esqueci minha senha" |
| `automacoes` | CRUD de regras de automação (trigger→ação) |
| `cadencia` | Estado da régua de 13 toques por lead, marcação de toque enviado |
| `carteira` | Listagem da carteira de clientes ativos |
| `configuracoes` | Integrações da organização e config do pipeline |
| `contatos` / `contatos-unified` | Ações sobre contato WhatsApp/lead, conversão, CRUD unificado |
| `contratos` | CRUD, finalização de contrato |
| `custom-fields` | CRUD de campos customizados |
| `email` | Contas conectadas, envio, templates, sequências, threads, sync/backfill |
| `empresas` | CRUD, enriquecimento individual/batch/bulk |
| `enrichment` | Status do serviço de enriquecimento |
| `health` | Healthcheck |
| `labels` | CRUD de etiquetas |
| `leads` | Maior módulo: CRUD, enrich, WhatsApp, labels, vínculo empresa/negócio, conversão, envio pra discagem |
| `ligacoes` | Histórico de chamadas (Callface) |
| `me` | Dados do usuário autenticado |
| `metas` | Criação/consulta de metas |
| `negocios` | CRUD de negócios, contagem, labels |
| `notas` | CRUD de anotações |
| `notificacoes` | Listagem/marcação de notificações |
| `nps` | Resposta pública de pesquisa via token |
| `perfil` | Dados de perfil, troca de senha |
| `pipelines` | CRUD de pipelines customizados |
| `propostas` | CRUD, PDF, envio com checkout Stripe, aceite, nova versão, recusa |
| `relatorios` | Resumo, tendências, equipe, comercial, growth, marketing, pós-venda, tracking, mídia paga, fechado mensal, esteira SDR |
| `reunioes` | CRUD de reuniões |
| `sdr` | Memória de conversa do agente IA por telefone |
| `servicos-catalogo` | CRUD do catálogo de serviços |
| `tarefas` | CRUD de tarefas |
| `uploads` | Serve arquivos enviados |
| `usuarios` | Convite, listagem, atualização |
| `whatsapp` | Webhook de entrada, envio, conversas, templates, status de sessão |

---

## Worker / Filas

Filas BullMQ + Redis (`lib/queue/index.ts`): `lead-scoring`, `notifications`, `conversion-sync`, `follow-up`, `whatsapp-incoming`, `whatsapp-outgoing`, `whatsapp-status-update`, `enrichment`, `cipa-analysis` (legado), `ai-sdr`, `site-lead-qualify`, `callface-call-events` (retry generoso: 5 tentativas, backoff exponencial 30s).

Workers processados (`worker/index.ts`):

- **whatsapp-incoming** — maior handler: cria/atualiza contato, round-robin de atribuição, download de mídia, avatar, cross-save entre sessões da mesma org, dispara o AI SDR (rate-limit/debounce/handoff por keyword ou valor alto), integra com agenda de closers pra oferecer slots
- **whatsapp-outgoing** / **whatsapp-status-update** — envio e status de entrega/leitura
- **callface-call-events** — consome webhook de ligação finalizada da Callface (`processCallfaceCallEvent`)
- **email-sync** / **email-sequence** — sincronização de caixa e execução de sequência automatizada
- **lead-scoring**, **enrichment**, **site-lead-qualify** — enriquecimento e scoring
- **scheduled-jobs** ("slaWorker") — SLA, escalonamento de SDR, syncs periódicos (inclui sync Stripe a cada 30min, sync de reuniões Outlook a cada 15min)
- **notifications**, **conversion-sync** (placeholder), **follow-up** (placeholder)

Sobe também um health-check HTTP próprio na porta 3002 (`/health`) pro Docker healthcheck.

---

## Auth e permissões

- **Login** — NextAuth v5 (`lib/auth/config.ts`), provider Credentials (e-mail+senha, bcrypt), JWT, sessão de 30 dias, refresh de nome/role a cada 30min com timeout de 3s pra nunca travar o middleware.
- **Roles canônicos** (`lib/auth/roles.ts`) — `admin`, `gerente`, `closer`, `sdr`, `leitor`. Legados no banco: `vendedor` (→closer) e `super_admin` (→admin, único que acessa `/admin`). Closer e SDR "acumulam" visão um do outro (decisão registrada 01/07).
- **Middleware** (`middleware.ts`) — protege rotas do CRM; `/admin/*` exige `super_admin` (considerando override via cookie `mcrm-view-as`); `/configuracoes`, `/financeiro`, `/onboarding`, `/campanhas` exigem `admin`/`gerente`/`super_admin` — exceção: `/configuracoes/email` liberado a qualquer papel (conexão pessoal de e-mail).
- **Multi-tenant** (`lib/auth/tenant.ts`) — `getTenantContext()` resolve a organização da sessão; `super_admin` troca de org via cookie `mcrm-org-override`.
- **Tokens de uso único** (`lib/auth/tokens.ts`) — convite/reset de senha, hash SHA-256, TTL configurável, consumidos por `auth-flow.ts`.

---

## Módulos e features

### CRM Core
- **Leads** — Captura via RD Station + manual, scoring (ICP ponderado), `sdr_status` pra board de pré-vendas, qualificação SDR estruturada
- **Pré-vendas (SDR)** — Kanban por `sdr_status`, drag-and-drop, timeline com autoria, régua de cadência de 13 toques, escalonamento automático em 48h sem contato
- **Empresas** — Auto-criação ao cadastrar lead, dados de enriquecimento
- **Negócios / Pipeline** — Kanban drag-and-drop do closer, múltiplos pipelines, qualificação SDR herdada (read-only), agenda de reunião no handover
- **Propostas** — Itens do catálogo (recorrente/avulso/setup), desconto, PDF (Puppeteer), checkout Stripe + envio por email (Resend) e WhatsApp, aceite via pagamento
- **Contratos** — Gerados ao fechar negócio, tracking de MRR
- **Carteira** — Clientes ativos vs churned, MRR, ticket médio
- **Contatos** — Gestão unificada WhatsApp/Email

### Comunicação
- **WhatsApp** — Multi-sessão via WuzAPI, inbox com tabs, envio de mídia, AI SDR opcional por contato
- **Email** — Contas Google/Microsoft/IMAP, inbox por thread, templates, sequências automatizadas

### Inteligência (IA)
- **AI SDR (nativo, texto)** — SDR via Groq com tool-use (respond, qualify_lead, handoff, advance_stage, schedule_meeting), memória persistente, rate limit, debounce, horário comercial, style guide. **Disponível, mas a operação atual usa SDR humana.**
- **Callpilot (voz)** — agente de IA de voz da plataforma Callface, acionado por automação externa. **Pausado** — ver [Estado do produto](#estado-do-produto--o-que-está-ativo-pausado-ou-é-dívida-técnica).

### Telefonia
- **Ligações (Callface)** — webhook de eventos de ligação finalizada grava histórico na timeline do lead/negócio/contato, com resumo, transcrição, link de áudio e % de fechamento reportado pela IA
- **Discador preditivo (fila de discagem Callface)** — envio de contato pra campanha de discagem da Callface a partir do CRM

### Financeiro
- **Camada única de métricas SaaS** (`lib/financeiro/metricas.ts`) — MRR atual/por produto (`ai` via Stripe, `pabx` via planilha Wevy), churn voluntário × involuntário, aging de inadimplência
- **Sync híbrido Stripe** — webhook em tempo real + polling a cada 30min (`lib/integrations/stripe-sync.ts`), lock transacional (`pg_advisory_xact_lock`) pra evitar corrida entre webhook e worker
- Abas: Visão Geral / Cobrança / Clientes — acesso restrito a admin/gerente/super_admin

### Onboarding & CS
- **Checklist por produto** (`ai` / `pabx` / `ai_pabx`) — item "primeiro uso real" confirmado automaticamente via tabela `ligacoes`
- **Health Score de CS** (`lib/cs/health-score.ts`) — v1 simples (sem Mixpanel ainda): 0.7 saúde de cobrança + 0.3 pontualidade do onboarding

### Operacional
- **Dashboard ("Meu Dia")** — Alertas, agenda de reuniões do usuário, KPIs company-wide, mini pipeline, atividades
- **Relatórios** — 5 abas (Pré-vendas/SDR, Comercial, Growth, Marketing, Mídia Paga), camada de fonte única por domínio em `lib/relatorios/*` pós-auditoria de divergências (ver [Estado do produto](#estado-do-produto--o-que-está-ativo-pausado-ou-é-dívida-técnica))
- **Agenda** — disponibilidade/bloqueios/reuniões do closer, fila round-robin
- **Campanhas**, **Automações**, **Tarefas & Reuniões**, **NPS**, **Campos Custom**, **Labels**, **Notas**, **Notificações**

### Admin
- **Multi-tenant** — Orgs isoladas; roles `super_admin` / `admin` / `gerente` / `closer` / `sdr` / `leitor`
- **Super Admin** — Override de org (view-as), gestão de orgs e usuários
- **Configurações** — Pipeline (stages/cores/SLA), AI SDR, contas de email, sessões WhatsApp, catálogo de serviços, campos custom, ICP (pesos)

---

## Integrações externas

| Integração | Arquivo | O que faz |
|------------|---------|-----------|
| **RD Station** | `lib/integrations/rd-station.ts` | Webhook de entrada (`POST /api/webhooks/rd-lead`), decodifica `traffic_source` base64, extrai UTMs, dedup por email/telefone |
| **RD Station (criativo)** | `lib/integrations/rd-criativo.ts` | Enriquece `utm_content` de leads de Meta Lead Ads que chegam sem UTM completo |
| **Stripe (checkout)** | `lib/integrations/stripe-checkout.ts` | Cria link de checkout (assinatura mensal) a partir de proposta, expira sessão |
| **Stripe (sync)** | `lib/integrations/stripe-sync.ts` | Fonte da verdade de billing: fetch da API (subscriptions/invoices) + write transacional, webhook + polling a cada 30min |
| **Meta Marketing API** | `lib/integrations/meta-insights.ts` | Insights de campanha/adset/ad (gasto, CPL) via `META_ACCESS_TOKEN`, cruza com tracking do CRM por `utm_campaign` |
| **Callface (telefonia)** | `lib/integrations/callface.ts` | Consome webhook de eventos de ligação (grava em `ligacoes`, notifica reunião combinada); envia contato pra fila de discagem/discador preditivo (`enviarParaDiscagem`), idempotente por `call_id` |
| **Callpilot (voz, automação)** | `lib/integrations/callpilot-trigger.ts` | Cria e ativa campanha de agente de voz na Callface via Puppeteer (sem API pública pra isso); fallback pro AI SDR via WhatsApp se a ligação falhar. **Pausado em produção** |
| **Microsoft 365 / Outlook** | `lib/crm/outlook-reuniao-sync.ts` | Agenda real do closer (`getFullAvailability`, `getBusyTimes`, `createOutlookEvent`), escopos delegados por closer (cada um conecta a própria conta), sync periódico de reagendamento/cancelamento a cada 15min |
| **Google OAuth / IMAP / SMTP** | módulo `email` | Contas de e-mail conectadas por usuário |
| **WuzAPI** | módulo `whatsapp` | WhatsApp multi-sessão |
| **Resend** | `lib/crm/enviar-proposta.ts` | Envio de e-mail transacional branded (proposta) |
| **Apollo.io** | rota `apollo` | Prospecção B2B — busca/import de leads, créditos, buscas salvas |

---

## Páginas (frontend)

App Router — `app/src/app/(crm)/`:

`dashboard` · `pipeline` · `leads` · `negocios` · `contatos` · `empresas` · `contratos` · `propostas` · `financeiro`* · `relatorios`* · `carteira` · `pre-vendas` · `onboarding`* · `agenda` · `automacoes` · `campanhas` · `configuracoes`* · `admin`** · `whatsapp` · `email` · `prospeccao`*** · `perfil`

Pública: `login`, `definir-senha`, `esqueci-senha`.

`*` restrito a admin/gerente/super_admin · `**` restrito a super_admin · `***` legado do fork, ver [Legado em limpeza](#legado-em-limpeza).

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

### 5. Worker (opcional — WhatsApp, Email Sync, AI SDR, Callface)
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

## Deploy

Em **EC2** (`/opt/callface/crm`), atrás de Traefik + Cloudflare, domínio `crm.callface.io`. Ambiente de homologação espelhado em `/opt/callface/crm-homolog` (`homolog.crm.callface.io`), banco isolado clonado do prod, Resend/Stripe desligados — **testar mudanças de risco lá antes de promover, só com aval do Scott**.

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
| Raio / estilo | radius 8px, flat, sombra neutra (sem sombra colorida na marca) |

Rodapé/login mantêm a assinatura **"© Scott Studio · Direitos reservados"** (decisão de produto — Scott Studio é quem construiu/opera o CRM).

---

## Estado do produto — o que está ativo, pausado ou é dívida técnica

Seção honesta sobre o que realmente está rodando hoje (24/07/2026), pra ninguém tomar decisão em cima de algo que só existe como plano.

### Ativo em produção
- Fluxo completo Lead → Pré-vendas → Pipeline → Proposta → Stripe → Contrato → Carteira
- Régua de cadência SDR inbound (13 toques) + escalonamento automático em 48h
- Webhook de ligações Callface → timeline do lead/negócio/contato (`ligacoes`), desde 23/07
- Envio de contato pra fila de discagem/discador preditivo da Callface
- Agenda nativa de closers (round-robin, disponibilidade, bloqueios) + sync de reagendamento do Outlook a cada 15min (best-effort — só funciona se o closer conectou a própria conta; não há acesso a agenda de terceiros)
- Sync híbrido Stripe (webhook + polling 30min)
- Onboarding (checklist ai/pabx/ai_pabx) e Health Score de CS v1

### Pausado (código existe, não está rodando)
- **Callpilot — automação "lead Novo → ligação de voz automática com horário real"** (`lib/integrations/callpilot-trigger.ts`). Validado ponta a ponta com ligação real, mas pausado em 23/07 por decisão do Kauã: o passo de ativação da campanha (via Puppeteer, sem API pública) tem timing instável e falhou em testes consecutivos. Pendência aberta: definir o fallback quando a ligação falha e o WhatsApp também está desligado (hoje o lead ficaria preso em "Novo").
- **AI SDR nativo (texto/WhatsApp)** — implementado, com tool-use e memória, mas a operação usa SDR humana. Não confundir com o Callpilot acima.

### Dívida técnica / dado incompleto conhecido
- **Financeiro** — 22 contratos ativos com `produto=NULL` (~R$18,3k de MRR) somem do filtro "Callface AI"; sync Stripe tem janela de 60 dias que congela faturas mais antigas; sem métricas completas de MRR novo/expansão/contração/NRR/LTV/CAC; `motivo_cancelamento` quase nunca preenchido; **PABX nunca entrou no CRM** (segue só na planilha Excel da Wevy)
- **Relatórios** — 3 gerações de código coexistem (queries legadas + `lib/relatorios/comercial.ts` + `lib/relatorios/midia-paga.ts`); definição de "lead qualificado" tem histórico de divergir entre abas (canônica: lead distinto com negócio criado no período); `status_changes` é a fonte correta de eventos de funil, mas nem todo relatório migrou pra usá-la ainda
- **Decisões de negócio pendentes**: critério formal de "estagnado" (dias/regra), se meta de SDR soma closers cobrindo, o que fazer com leads antigos parados sem negócio
- **Integração Callface**: só a Fase 1 (webhook de entrada de ligações) está em produção; fila automática por regra, timeline rica de métricas de closure % e click-to-call via extensão Chrome seguem como plano. Perguntas técnicas em aberto pro suporte da Callface (payload/idempotência do webhook, endpoint de originar ligação via API, timezone do scheduling)

### Legado em limpeza

Resquícios do CRM original (fork) que **ainda estão no código mas não são o produto Callface** — ignore pra entender o sistema atual:

- **CIPA / análise de LP** — feature de diagnóstico de landing pages (Puppeteer + PageSpeed + Groq) do projeto original. Ainda referenciada em `worker/index.ts`, `lib/db/schema.ts`, rotas e algumas telas. Não faz parte do fluxo Callface.
- **`leads-bm` / Biblioteca de Anúncios Meta** — prospecção via Meta Ad Library. Página pública e rota Hono já saíram; resta a tabela (`migrations/0005_leads_bm.sql`) e `lib/integrations/meta-insights.ts` (este **ainda é usado** pelo relatório de Mídia Paga — não remover sem checar).
- **Página `/prospeccao`** — herdada do fork.
- **Domínios antigos** — `.env.example`, CORS em `api-server/server.ts` e seed ainda citam `scottdev.com.br` / `scottstudio.com.br`. Produção usa `callface.io`.

---

<p align="center">
  <strong>Callface CRM</strong> — A telefonia que nasceu inteligente.<br/>
  <sub>© Scott Studio · Direitos reservados</sub>
</p>
