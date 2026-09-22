<h1 align="center">OnFace</h1>

<p align="center">
  A plataforma operacional da jornada do cliente da Callface — da aquisição à retenção.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.1-black?logo=next.js" />
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Hono-4-E36002?logo=hono" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Drizzle-ORM-C5F74F" />
  <img src="https://img.shields.io/badge/BullMQ-Redis-DC382D?logo=redis&logoColor=white" />
</p>

---

## Leia isto antes de qualquer coisa

**Os nomes das pastas mentem.** É o erro que mais custa tempo a quem chega:

| Pasta | O nome sugere | O que realmente é |
|---|---|---|
| `app/src/app/(onface-preview)/` | rascunho | **é o produto** — o menu oficial aponta para cá |
| `app/src/app/(crm2)/` | versão antiga | **é onde a tela real mora** |
| `app/src/app/onface-desenho/` | o desenho "de verdade" | referência congelada, **proibido mexer** |
| `app/src/app/(crm)/` | o CRM | apenas redirects para o CRM2 |

Para editar o Pipeline, você edita `app/src/app/(crm2)/pipeline/page.tsx` — não a rota do menu.

---

## O que este repositório é

A base consolidada do OnFace, criada em **20/09/2026**. Até então o trabalho estava
espalhado em três branches e, em parte, **só no servidor de produção** — porque o deploy
era feito por `rsync`, não pelo git.

Esta base reúne, numa linha só:

- a frente **ONFACE** (casca, Design System, telas de Vendas, Atividades, Início);
- o **pós-venda** completo — Ganho gera Onboarding e Implantação automaticamente;
- o **White Label** com formulário público de implantação;
- o **financeiro** — identidade de faturamento, eventos Stripe, fechamento comercial;
- todas as correções que rodavam em produção e nunca tinham sido versionadas.

> `ImScottDev/callface-crm` é o repositório anterior. Continua intacto, como arquivo histórico.

---

## Stack

| Camada | O que é |
|---|---|
| Frontend | Next.js 16.1 (App Router, RSC), React 19.2, TypeScript, Tailwind v4 |
| Design System | shadcn/ui new-york + tokens OnFace, com laboratório vivo em `/design/onface` |
| API | Hono 4 sobre `@hono/node-server` |
| Domínio | `app/src/lib` — `vendas`, `crm`, `cs`, `financeiro`, `cadencia`, `ai-platform` |
| Dados | PostgreSQL 16 + Drizzle ORM |
| Assíncrono | BullMQ sobre Redis |
| Auth | NextAuth v5 + credenciais |
| Deploy | Docker Compose + Traefik |

Números de hoje: **143 telas**, **569 endpoints**, **56 migrations**, **104 testes**.

---

## Rodando local

```bash
cd app
pnpm install
cp .env.example .env          # preencha o mínimo: DATABASE_URL, REDIS_URL, NEXTAUTH_SECRET
pnpm db:migrar                # aplica a cadeia de migrations
pnpm dev                      # Next em :3000
```

Em outro terminal, a API:

```bash
cd app && API_PORT=3011 pnpm tsx src/api-server/index.ts
```

### Duas armadilhas que custam uma hora cada

**A porta da API tem dois nomes.** `src/api-server/server.ts` lê `API_PORT` (padrão 3001);
`next.config.ts` lê `HONO_API_PORT` (padrão 3002, que é a porta de health do worker). Se você
subir a API sem `API_PORT`, todo `/api/*` quebra sem mensagem óbvia. Use o mesmo valor nos dois.

**Nunca rode `pnpm build` com o `next dev` de pé.** O build sobrescreve o `.next` e o dev passa
a servir CSS antigo na mesma URL de chunk. Se "a correção não apareceu", suspeite disso antes
de mexer no código de novo.

---

## Verificação

```bash
cd app
npx tsc --noEmit          # tipagem
pnpm test                 # 104 testes
pnpm test:ai-platform     # 11 testes
pnpm ds:contraste         # contraste de cor do Design System
pnpm ds:check             # aderência à escala do Design System
pnpm db:migrar:check      # o banco está em dia?
```

O build **é** portão de tipo desde o CP61: `npm run build` roda `tsc --noEmit` antes do `next build`, e falha no primeiro erro. `next.config.ts` mantém `typescript.ignoreBuildErrors` porque o tsc já rodou — deixar o Next checar de novo só custaria tempo. Antes disso o portão estava só na disciplina de quem lembrava: o Dockerfile constrói com `NEXT_TYPESCRIPT_CHECK=false npm run build` e nenhum tsc.
Rode `tsc` explicitamente.

---

## Onde mexer

| Quero mudar | Mexo em |
|---|---|
| A navegação principal | `app/src/components/onface/navigation.ts` — fonte única |
| Um token de cor ou escala | `app/src/app/onface.css` |
| A tela de Pipeline | `app/src/app/(crm2)/pipeline/page.tsx` + `components/onface/vendas/Pipeline.tsx` |
| Uma ação comercial | `app/src/lib/vendas/<modulo>.ts` — **e emita o evento** |
| Um endpoint | `app/src/api-server/routes/<modulo>.ts` + montar em `server.ts` |
| O schema | `app/src/lib/db/schema.ts` + uma migration nova em `migrations/` |
| Um componente do DS | `app/src/components/onface/ds/` + exemplo no laboratório |

---

## A regra que sustenta o resto

**Sistema externo não escreve direto no banco.** Toda entrada passa por uma porta da OnFace:

```
entrada externa → normalização → regra da OnFace → gravação → evento/timeline
```

Hoje isso ainda não é verdade em todo lugar, e é a dívida arquitetural central do projeto:

| Entidade | Lugares que escrevem | Passam pela regra |
|---|---|---|
| `leads` | 39 | 3 |
| `negocios` | 26 | 1 |
| `tarefas` | 13 | 1 |

É a causa raiz dos campos vazios que fazem registros sumirem das telas: **o dado entra por
porta que não aplica a regra**. O molde a seguir é `app/src/lib/vendas` — resultado tipado,
mudança e evento na mesma transação, vocabulário do negócio num arquivo só.

---

## Ambientes

| Ambiente | URL |
|---|---|
| Produção | [crm.callface.io](https://crm.callface.io) |
| Homologação | [homolog.crm.callface.io](https://homolog.crm.callface.io) |
| Dev (servidor) | [dev.crm.callface.io](https://dev.crm.callface.io) |

**Nada entra em produção sem aprovação explícita do Kauã.**

> O deploy hoje é `rsync` do `app/` para o servidor, não sai do git. Foi essa a causa do
> descolamento entre repositório e produção corrigido em 20/09 — e volta a acontecer
> enquanto o deploy não passar a sair daqui.

---

## Documentação

| Assunto | Onde |
|---|---|
| Protocolo de execução (as quatro leis) | [`ONFACE-PROTOCOLO.md`](./ONFACE-PROTOCOLO.md) |
| Receita de carga de dados de produção | [`docs/virada/PLANO-DE-CARGA.md`](./docs/virada/PLANO-DE-CARGA.md) |
| Instruções para agentes de IA | [`AGENTS.md`](./AGENTS.md) · [`CLAUDE.md`](./CLAUDE.md) |
| Estado auditado do produto, arquitetura e decisões | vault: `02_PROJETOS/Callface/ONFACE/` |
