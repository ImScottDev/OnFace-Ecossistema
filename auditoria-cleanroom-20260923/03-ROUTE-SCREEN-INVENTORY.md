# 03 — ROUTE / SCREEN INVENTORY (Fase 2) + insumo do REGRESSION MAP

Medição: 23/09/2026, runtime local `http://localhost:3100` (Next dev do redesign), 95 GETs sem sessão; produção comparada = worktree `callface-crm` @ `prod-real-20260920` (44cb9e5); `homolog-src` do snapshot é idêntico em inventário à produção. Banco: somente SELECT.

## 0. Fatos de runtime que condicionam toda a matriz

### 0.1 PROVADO — proxy `/api/*` do Next :3100 aponta para porta morta
- `app/next.config.ts:68`: `const apiPort = process.env.HONO_API_PORT || "3002"` + rewrite de tudo que não é `auth|webhooks|financeiro|onboarding|campanhas|contratos-publicos` para `http://localhost:${apiPort}`.
- `app/.env:4`: `HONO_API_PORT=3012`. Portas em LISTEN: 3001, 3002, 3100. **Nada em 3012.**
- Medido: `:3100/api/leads → 500`; `:3100/api/negocios → 500`; `:3001/api/leads → 401` (Hono viva exige auth); `:3012 → 000`.
- Consequência: toda tela que busca dado no cliente via `/api/*` está morta neste runtime — inclusive a casca (`components/onface/shell/` chama `/api/notificacoes` e `/api/labels`: o sino falha nas 79 rotas de `(crm2)`).
- Nota (§3.5): o default do next.config é 3002 (porta com listener); é a linha do `.env` que aponta para 3012. Nenhuma das portas coincide com a Hono saudável (3001). REGISTRADO, não corrigido.

### 0.2 PROVADO — `(crm)/pos-venda/*`: 5 rotas em **500** e SEM gate de autenticação
- Todas retornam 500 sem `Location`; corpo: `[next-auth]: useSession must be wrapped in a <SessionProvider />`.
- Causa-raiz: `app/src/app/(crm)/layout.tsx` NÃO EXISTE no redesign (existe na produção, 1785 bytes); deletado pelo commit `ee71e99` "wip(f1): lote 3 — remove o shell legado morto do grupo (crm)". `Cf2OnboardingWorkspace.tsx:7,80` usa `useSession()`.
- `app/src/middleware.ts` não contém `/pos-venda` no matcher. Sem layout e sem middleware = nenhuma verificação de sessão; o que "protege" é o crash.

### 0.3 PROVADO — os 200 públicos são cascas vazias
`/p/[id]`, `/checkout/[id]`, `/impl-pabx/[token]`, `/impl-white-label/[token]`: client components que buscam em `/api/*` (ex.: `components/public/FormularioImplantacaoPabx.tsx:658` → `/api/fulfillment-formulario/${token}`), endpoint que NÃO está nas exceções do rewrite → 3012 → morto. HTML medido: `Carregando formulário...` / só `<title>ONFACE</title>`. **Os 4 fluxos públicos estão inoperantes apesar do 200.**

### 0.4 PROVADO — `checkouts` tem 0 linhas no banco.
### 0.5 PROVADO — `fulfillments`: só `ONBOARDING | 26`. Zero PABX/WHITE_LABEL/CALLFACE_AI — as telas de implantação por família não têm dado para exibir (estado do banco, não bug).

## 1. Matriz (resumo estruturado)

Legenda FONTE: `SC/DB` server component com drizzle direto · `SA` server actions · `API` fetch cliente → `/api/*` (QUEBRADO no runtime atual) · Evidência: `RT` runtime / `CV` código-verificado.

### Totais
| Categoria | Qtd |
|---|---|
| Páginas `(crm2)` | 82 |
| Telas reais | 72 |
| Placeholders `ModuloPendente` | **7** (`/chamados`, `/pos-vendas`, `/clientes/carteira`, `/clientes/expansao`, `/automacoes/fluxos`, `/relatorios/biblioteca`, `/relatorios/performance`) — corrige o "11" da Fase 1: risco e implantação pabx/wl/ai são telas reais hoje |
| Redirects internos | 3 (`/negocios`→`/pipeline`, `/propostas/novo`→`/nova`, `/clientes/sucesso`→`/cs`) |
| Telas reais INDEPENDENTES do proxy morto | **19**: bloco vendas ONFACE (`/inicio`, `/pre-vendas`, `/pipeline`(+id), `/propostas`(+id,+nova), `/prospeccao`, `/contatos`(+3 detalhes)) via SC/SA direto no banco; + `/ajustes/geral`, `/ajustes/qualidade-dados`(×2), `/design` |
| Telas reais INOPERANTES pelo proxy morto | **53** (todo Clientes/CS/Atendimento/Automações/Relatórios/Ajustes-API/negócios detalhe/tarefas/calendário/perfil) |
| Exceção viva | `/clientes/financeiro` (backend Next local `/api/financeiro/*`, 7 abas) e `/automacoes/campanhas` (`/api/campanhas` local) — parcialmente funcionais |
| Runtime auth | 79/79 rotas `(crm2)` → 307 para /login; **zero 200 indevido** (RT) |

### Server actions canônicas (bloco vendas, funcionam sem API)
- `(crm2)/pre-vendas/actions.ts`: 18 SA (qualificar, desqualificar, nutrir, atribuição em massa, criar oportunidade…)
- `(crm2)/pipeline/actions.ts`: 13 SA (moverEtapa, perder, tentarGanhar, agendarReuniao, noShow, trial…)
- `(crm2)/propostas/actions.ts`: 9 SA · `(crm2)/prospeccao/actions.ts`: 12 SA · `(crm2)/contatos/actions.ts`: 9 SA

## 2. REGRESSÕES (evidência arquivo→arquivo; método: diff de endpoints consumidos — 91 na UI de produção, 130 no redesign, 15 abandonados)

| # | Regressão | Produção | Redesign | Veredicto |
|---|---|---|---|---|
| 2.1 | **Carteira** | `(crm)/carteira/page.tsx` 311 l. → `/api/carteira` | `/clientes/carteira` = `ModuloPendente`; `/api/carteira` montado no Hono sem NENHUM consumidor | 🔴 REGRESSÃO — placeholder no lugar da tela do vendedor |
| 2.2 | **Sequências de e-mail** | `(crm)/email/sequencias/page.tsx` 345 l. → `/api/email/sequencias` | Nenhuma tela; tabelas `email_sequencia*` sem interface | 🔴 REGRESSÃO |
| 2.3 | **Contratos (lista+detalhe)** | `(crm)/contratos/page.tsx` 260 l. + `[id]/page.tsx` 429 l. | Redirect manda para `/ajustes/contratos` = TEMPLATES (outro objeto); nenhuma tela lista/abre contrato assinado | 🔴 REGRESSÃO de escopo |
| 2.4 | **View-as / org-switch** | `CrmSidebar.tsx` + `ViewAsBanner.tsx` (UI de impersonação) | Componentes existem mas NÃO são montados (1 hit em comentário); **backend segue honrando cookie `mcrm-view-as`** (`middleware.ts:33`, `lib/auth/tenant.ts:9`, `api-server/auth.ts:12`, `routes/admin.ts:348`) — impersonação residual invisível e irreversível pela UI | 🔴 REGRESSÃO + risco |
| 2.5 | **Relatório Fechamento Comercial** | aba própria → `/api/relatorios/fechamento-comercial` | Endpoint sem consumidor; substituto `fechado-mensal` é recorte diferente | 🔴 REGRESSÃO |
| 2.6 | **WhatsApp** (parcial) | 667 l., 9 endpoints | `/atendimento` cobre core; perdidos: conversations, status (fora de ajustes), mark-all-read, avatar, unread-count/badge | 🟠 PARCIAL |
| 2.7 | **Agenda** | 499 l. → `/api/agenda/reunioes` | `/calendario` 153 l., endpoints diferentes; endpoint abandonado | 🟠 substituição mais rasa |
| 2.8 | **Enrich em lote de empresas** | `POST /api/empresas/enrich-batch` | sem consumidor | 🟠 pontual |
| 2.9 | **Onboarding** | `/api/onboarding` (rota Next local viva) | migrado p/ `/api/fulfillments` (proxy morto); `/api/onboarding` sem consumidor | 🟠 troca de backend, caminho novo inoperante |
| 2.10 | Contadores da sidebar (`/api/negocios/count`, `/api/propostas/count`) | — | sem consumidor | ℹ️ cosmético |

Substituições REAIS confirmadas (código): dashboard→/inicio, pipeline, pre-vendas, contatos(+ids), empresas(+id), propostas(+id,nova), prospeccao, negocios[id] (API quebrada), tarefas (API quebrada), financeiro (superset 7 abas, mas ver 3.1), relatórios (–1 aba, +pós-venda), configuracoes/* → ajustes/* 1:1 (14 telas), admin→ajustes/organizacoes+membros (mais raso, sem view-as), campanhas, automacoes, perfil. `inbox` de produção já era placeholder (não é regressão).

## 3. Achados estruturais de runtime

- **3.1 🔴 FINANCEIRO ÓRFÃO NA NAVEGAÇÃO**: `/clientes/financeiro` (a tela mais funcional que restou) não é alcançável pela casca montada. `components/onface/navegacao.ts:88-95` não a lista; a camada de abas secundárias (`clientes-tabs.ts`, `vendas-tabs`, `automacoes-tabs`, `ModuleTabs`, `AreaTabs`, `Sidebar.tsx` do crm2) está TODA órfã (grep: 0 montagens). Sem ponto de entrada também: `/clientes/implantacao`(+3), `/clientes/onboarding`, `/vendas`, `/automacoes/agente-ia`, `/prospeccao/apollo`, `/calendario/configuracoes`.
- **3.2 🔴** `/pos-venda/*` 500 + sem auth (ver 0.2).
- **3.3 🔴** `/chamados` e `/pos-vendas` fora do middleware → gate de PAPEL (GESTAO) não roda; hoje placeholders (impacto nulo), vira risco quando ganharem conteúdo.
- **3.4 🔴** Cookie `mcrm-view-as` honrado sem UI (ver 2.4).
- **3.5 ⚠️** `.env` 3012 vs default 3002 vs Hono real 3001.
- **3.6 ⚠️** `/vendas` = duplicata de `/tarefas` (diff: só título e `foco="comercial"`).
- **3.7 ⚠️** API Hono do redesign tem 60 arquivos de rota vs 42 em produção — 19 rotas novas (ai-platform, atendimento, cs, clientes-crm2, checkouts, contrato-templates, prospeccao, calendario, automacoes-*, carol, api-tokens, documentos/scripts-atendimento, pipeline-crm2, contatos-crm2, clientes-financeiro). **Todo o módulo Clientes/CS/Atendimento/Automações depende de backend que NÃO está em produção.**
- **3.8 ⚠️** `(crm2)` importa legado em 2 telas: `ajustes/whatsapp` (100% `components/crm/WhatsAppSessionManager`) e `ajustes/leads` (`useOrgUsuarios` de `components/crm/BoardFilters`).
- **3.9 ℹ️** 4 redirects legados pulam o login (307 direto ao destino): `/agenda`, `/onboarding`, `/email`, `/prospeccao-legado`. Sem vazamento de dado; inconsistência.

## 4. Níveis de evidência
- PROVADO NO RUNTIME ATUAL: §0.1–0.5, 79×307, 5×500, cascas públicas vazias, portas.
- CÓDIGO-VERIFICADO (não provado em runtime): colunas existe/fonte/ações da matriz e as regressões §2 (fatos de código: arquivo, linha, diff de consumo). Nenhum render autenticado foi observado — pendência para a fase de jornadas com sessão.
- Nenhuma documentação usada como prova. Nenhuma escrita em arquivo do produto/banco.
