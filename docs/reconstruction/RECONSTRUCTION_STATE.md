# Callface CRM 2.0 — Estado da Reconstrução

> Arquivo de retomada. Se o contexto acabar, leia este arquivo primeiro — ele
> deve permitir continuar exatamente de onde parou, sem reconstruir raciocínio.
> Atualizado continuamente durante a execução, não só ao fim de fase.

**Branch de trabalho**: `feature/crm2-fase0-foundation` (a partir de `main`, que espelha produção). **Produção e homolog não são tocados nesta fase** — tudo roda local (Postgres/Redis via Homebrew, `./scripts/dev.sh`) até haver critério explícito de promoção.

**Fonte do plano**: `/Users/Scott/Documents/Brain - Scott Studio/projetos/callface/produto/plano-reconstrucao-crm-2.0.md` (vault) — 10 fases (F0-F9), regra INCREMENTAL ≠ PROVISÓRIO, Done em 5-6 dimensões (Technical/Data/Product/UX/Observability/Operational).

---

## Nota importante (09/08) — branch `homolog` é backup do Kauã, não é target

A branch git `homolog` (origin/homolog) captura o estado real do servidor
de homolog em 07/08 — é backup intencional do Kauã pra ele revisar depois
(módulo CS/Onboarding, callpilot-trigger, fix de MRR completo em
`lib/crm/contratos.ts`, todos ainda sem decisão dele). **NUNCA fazer merge
nela, nunca tratar como target de deploy.** Ver ADR-EXEC-008. O CRM 2.0
precisa de um ambiente de homolog PRÓPRIO — decisão de infra (mesma EC2 com
stack isolado vs. servidor novo) ainda não tomada, não é urgente até o
primeiro checkpoint real de promoção (provável fim de F1).

**Cadência de promoção decidida**: por checkpoint de fase/sub-fase coerente,
não por micro-commit. Trabalho local/dev contínuo; sync pra homolog (quando
o ambiente novo existir) nos pontos em que a fase atinge Technical+Data
Done, pra ter algo estável de verdade pra validar — não um alvo em fluxo
constante.

## V1 Frontend — materialização por domínio (09/08, em andamento)

**Instrução do Kauã** (após corrigir o mal-entendido de "congelar"): terminar backend/domínio inteiro (F0-F6, integrações, RBAC, eventos, migração), depois materializar uma V1 completa de frontend organizada por domínio (App Shell → Command Center → Pessoas&Empresas → Leads&Qualificação → Pipeline Comercial → Deal/Customer 360 → Communications → Atividades → Automação → Analytics/Data Quality → Administração). Regra explícita: o frontend materializa o domínio já construído, não inventa funcionalidade nova só pra preencher tela.

**Auditoria real do App Shell (passo 1 da ordem)**: achado — já está ~90% construído, não é greenfield. `CrmSidebar` (nav com gating por papel via `canSee`, org switcher, view-as/impersonação de leitura, colapsável, contadores ao vivo, mobile), `CrmTopbar` (breadcrumb, trigger de busca, notificações, pill de usuário), `CommandPalette` (Cmd+K, wired via `CustomEvent`), `Providers` (React Query + tratamento global de erro) — tudo real, funcionando, verificado visualmente. Não é trabalho a refazer. "Meu Dia" (`/dashboard`) já cobre boa parte do que seria "Command Center" (KPIs, pipeline, alertas, atividades), com ramificação por papel (admin/gerente vê agregado, closer/sdr vê pessoal) — precisa validação mais profunda antes de decidir se é um gap real ou só um nome diferente do mesmo conceito.

**1º gap real fechado — AI SDR Human Handoff, invisível até agora**: achado ao auditar "Leads & Qualificação" — `aiSdrContatoState.handoffStatus` (`ai_handling`/`human_required`/`human_assigned`) existe desde 09/08 (F3, máquina de estados real, usada em `whatsapp.ts`/`ai-sdr.ts`/worker), mas **nenhuma tela nunca expôs esse campo** — zero uso em `app/src/app` ou `components`. Um lead marcado pela IA como "precisa de humano" ficava invisível pra qualquer closer/SDR, só descobrível lendo a conversa manualmente — risco real de resposta perdida.
- [x] `GET /api/whatsapp/conversations` (`whatsapp.ts`) — left join com `aiSdrContatoState`, retorna `handoffStatus` por conversa (join 1:1 seguro, `idx_ai_sdr_contato_state_contato` é unique).
- [x] Inbox do WhatsApp (`/whatsapp`): badge vermelho pulsante (ícone robô) no card da conversa quando `human_required`; botão-filtro "N aguardando humano assumir" (toggle) acima da busca, só aparece quando há pelo menos 1.
- [x] **Validado visualmente via Playwright com dado real**: login real → view "Todos" → 1 conversa real (`luccaslabres`) marcada manualmente como `human_required` pra teste → badge apareceu certinho no card, filtro isolou a conversa corretamente, contagem "1 aguardando humano assumir" correta. Dado de teste removido depois, confirmado 0 resto.
- [x] `npx tsc --noEmit` limpo (mesmos 6 erros de baseline).
- [ ] Não incluído (consciente): nenhum botão explícito "assumir sem responder" — o fluxo já existente (mandar mensagem manual = assume automaticamente, ver `whatsapp.ts:295-308`) continua sendo a única forma de sair de `human_required`, suficiente pra esta entrega. Indicador de status dentro do `ChatPanel` (ao abrir a conversa) não foi feito ainda — badge na lista já cobre a necessidade de triagem, que era o gap real.

**2º gap real fechado — Cmd+K era só navegação fixa, não busca de verdade (domínio Pessoas&Empresas)**: achado ao auditar "busca global" — `CommandPalette` sempre foi uma lista estática de páginas com fuzzy-match local, nenhuma entidade (lead/empresa/negócio) era buscável por ali, mesmo com os 3 endpoints reais (`leads.ts`/`empresas.ts`/`negocios.ts`) já aceitando `?search=` há tempo.
- [x] `CommandPalette.tsx`: a partir de 2 caracteres, debounce de 250ms dispara os 3 endpoints reais em paralelo (`limit=5` cada, `AbortController` cancela busca obsoleta) — nenhum endpoint novo criado, só reaproveita o que já existia e era testado.
- [x] Resultados aparecem agrupados (Contatos/Empresas/Negócios) com sublabel (empresa vinculada), navegação por teclado (↑↓/Enter) funciona sobre a lista combinada (comandos estáticos + resultados reais).
- [x] **Validado visualmente via Playwright com dado real**: buscou "Filipe" → 5 contatos reais + 3 negócios reais retornados e agrupados corretamente, clique num resultado navegou pra `/contatos/{id}` real, zero erro de console.
- [x] `npx tsc --noEmit` limpo (mesmos 6 erros de baseline).

**3º gap real fechado + 1 bug de correção descoberto na validação — evidência de Won na tela do negócio (domínio Deal/Customer 360)**: achado ao auditar "evidências" no detalhe do negócio — a Commercial Evidence Policy (F4, ADR-EXEC-012) e o endpoint `POST /negocios/:id/evidencia-manual` existiam desde 09/08, mas **nenhuma tela expunha isso**. Na prática: um closer clicando "Ganho" num negócio sem contrato/pagamento recebia um 400 silencioso — a mutation de `/negocios/[id]/page.tsx` nunca checava `res.ok`, então o erro do backend era engolido, o botão "não fazia nada" sem explicar por quê.
- [x] `updateNegocio` (mutation) corrigida pra checar `res.ok` e lançar com a mensagem real do backend; `onError` agora, se for especificamente o gate de evidência rejeitando E o usuário for admin/gerente, abre um modal pra anexar evidência manual (`manual_contract`/`admin_approval` + nota obrigatória) em vez de só mostrar erro.
- [x] Modal envia pro endpoint real, e em caso de sucesso tenta marcar "ganho" de novo automaticamente.
- [x] **Bug real encontrado DURANTE a validação, corrigido na hora**: o gate de evidência roda DEPOIS do insert de `status_changes`/disparo de automação (`mudanca_status`)/evento `StageChanged` no código de `negocios.ts` — ou seja, mesmo quando o gate ia rejeitar "ganho", o histórico já registrava "reuniao_agendada → ganho" (nunca aconteceu de verdade) e uma automação de "negócio ganho" já podia ter disparado. Confirmado com dado real: 3 cliques em "Ganho" rejeitados geraram 3 linhas falsas em `status_changes`. Fix: gate de evidência movido pra rodar ANTES do insert de `status_changes` (mesmo padrão já usado pela trava de valor de `proposta_apresentada`, que já fazia isso certo). Revalidado: negócio sem evidência rejeitado de novo, **zero linha nova em `status_changes`** — confirmado por query direta.
- [x] Segunda camada de proteção de UX: se o usuário anexa evidência mas a política do produto ainda não aceita esse tipo (ex: `manual_contract` — calibração pendente, ver `DECISOES-PENDENTES.md` item 1), mostra mensagem clara em vez de reabrir o modal em loop.
- [x] **Validado ponta a ponta via Playwright com dado real**: negócio de teste sem evidência → clique "Ganho" → 400 → modal abre → anexa evidência → retry → rejeitado de novo (política não aceita ainda, esperado) → mensagem clara mostrada, sem loop. Dado de teste (lead, negócio, contrato, evidência, status_changes, eventos, audit_log) totalmente removido, confirmado 0 resto.
- [x] `npx tsc --noEmit` limpo (mesmos 6 erros de baseline).

**Correção 09/08 (mesmo dia, reportado pelo Kauã em tempo real)**: "aparece uma notificação mas não tem lugar nenhum pra pessoa subir nada" — o fix acima só cobria a tela de detalhe do negócio (`/negocios/[id]`). Achado: existem **3 implementações independentes** da mesma troca de status (`negocios/[id]/page.tsx`, `pipeline/page.tsx` — drag-and-drop do board, `NegocioDrawer.tsx` — quick-action usado de Pipeline/Pré-vendas/Contatos/Carteira), cada uma com sua própria mutation/fetch — exatamente o mesmo padrão de lógica duplicada que já causou o bug de MRR. Só a primeira tinha o modal de evidência; as outras 2 só mostravam toast de erro sem ação possível.
- [x] Mesmo fix (checagem de `res.ok` já existia nas 3; modal de evidência + retry + guarda contra loop) replicado em `pipeline/page.tsx` (mutation `updateStatus`, usada pelo drag-and-drop) e `NegocioDrawer.tsx` (`handleStatusChange`, usada pelo dropdown de Status e pelo botão "Ganho" do drawer — provavelmente a via mais usada no dia a dia).
- [x] **Validado visualmente via Playwright com dado real nas 2 novas superfícies**: board Kanban (card de teste, pipeline_id ajustado pra aparecer no filtro "Callface AI") e o dropdown de Status dentro do `NegocioDrawer` (aberto a partir da lista do Pipeline) — modal de evidência abriu corretamente nos 2 lugares, status não mudou até confirmar. Dado de teste removido, confirmado 0 resto.
- [x] `npx tsc --noEmit` limpo (mesmos 6 erros de baseline).
- [ ] Nota de dívida técnica reconhecida, não corrigida agora (fora do escopo do bug reportado): as 3 implementações continuam duplicadas (não foi extraída pra um hook/helper compartilhado). Se surgir uma 4ª tela com a mesma troca de status, vai precisar do mesmo fix manual de novo — candidato real a refactor (`useUpdateNegocioStatus()` compartilhado) quando a V1 de frontend avançar mais.

## Auditoria do domínio Communications (09/08) — achado real, decisão de não construir agora

Auditei o que existe hoje: `/whatsapp` (inbox completo, com o badge de handoff já ligado) e `/email` (inbox completo) — cada canal tem sua própria tela robusta. `LeadTimeline` (usada em `/contatos/[id]` e `/negocios/[id]`) já existe, mas é um **log de atividades** (nota/ligação/reunião/proposta/follow-up — resumos curtos), **não** o conteúdo real das mensagens de WhatsApp/Email intercaladas cronologicamente num só lugar. É exatamente o gap que F2 já tinha documentado como pendente ("timeline unificada").

**Decisão**: não construir agora. Diferente do badge de handoff ou do modal de evidência (campos que já existiam no backend, só precisavam de UI mecânica e óbvia), uma timeline unificada de verdade é uma decisão de UX real — como intercalar 3 fontes de dado diferentes, paginação, tempo real, o que mostrar resumido vs completo — exatamente o tipo de coisa que a trilha de design (Figma) deveria decidir, não eu inventando sozinho. Registrado como pendente real de F2/Communications pra entrar na V1 de frontend quando a ordem por domínio chegar lá, idealmente já com referência visual.

## Automação — Builder de regras real (domínio Automação, 09/08)

**Achado**: `/automacoes` era 100% read-only — listava regras via query direta no servidor, mas criar/editar dizia explicitamente "peça pro time técnico via API". O motor (`automacao-engine.ts`) e o schema (`automacoes`, CRUD completo em `api-server/routes/automacoes.ts` — GET/POST/PATCH/DELETE, 7 gatilhos × 6 ações totalmente enumerados) já existiam prontos, só faltava a tela. Diferente da timeline unificada, isso não é decisão de design nova — é CRUD direto sobre um domínio já 100% definido (enums fixos), então dá pra materializar sem inventar nada.

- [x] Página convertida de server component read-only pra client component completo: criar, editar, ativar/desativar (toggle), excluir. Campos de `acaoConfig` aparecem condicionalmente conforme a ação escolhida (só os que `executarAcao()` de fato lê — não construí campo pra `diasInatividade`/`diasAntesVencimento`, que existem no schema mas não são lidos em nenhum lugar real, seria UI de mentirinha).
- [x] Nova rota `GET /automacoes/execucoes-resumo` (precisa vir antes de `/:id` no Hono, mesmo padrão de outras rotas) — total + última execução por regra, pra lista mostrar histórico real sem N+1.
- [x] **Validado ponta a ponta com dado real, incluindo o motor de verdade**: criou uma regra via UI (novo_lead → criar_tarefa) → criou um lead real via API → **a automação disparou de verdade** (tarefa real criada, `automacao_execucoes` registrou `status: sucesso`) → resumo de execução (“1 execução”) apareceu correto na lista após reload. Testado também toggle ativo/inativo, edição (form pré-preenchido) e exclusão (com confirm), todos funcionando. Dado de teste (regra, lead, tarefa, execução) removido, confirmado 0 resto.
- [x] `npx tsc --noEmit` limpo (mesmos 6 erros de baseline).

## V1 Frontend — App Shell novo + Command Center (09/08) — fundação estabelecida

**Marco real**: Kauã trouxe a 1ª tela oficial do Figma (Command Center, tema claro) como contrato visual/UX oficial da V2. Ver ADR-EXEC-018 pra todas as decisões (Theme System, coexistência com o legado, Insight Engine, cálculos novos, o gap real achado e corrigido durante a validação).

- [x] Theme System (`--cf2-*`, escopado, dark entra depois sem reconstruir componente) + tipografia própria (Manrope/Geist/Inter via next/font).
- [x] App Shell novo (`app/(crm2)/`) — Sidebar com a nav oficial do Figma + seção Legado (Carteira/Financeiro/Contratos/Prospecção/Campanhas/Admin), Topbar (saudação real, busca ⌘K reusando o CommandPalette já validado, notificações, avatar). Coexiste com `(crm)` legado, zero risco pra telas existentes.
- [x] Command Center real em `/inicio` (gated a `isAdminView` — closer/sdr continuam no dashboard pessoal legado): MRR+delta vs mês anterior, meta+progresso, pipeline ativo, gráfico diário acumulado (mês atual×anterior, direto de `negocios.ganhoAt` — não depende de `metricas_diarias` ter histórico), ranking top vendedores (reusa `getMetasPorVendedor`, movida de `dashboard/page.tsx` pra `lib/metas.ts` pra evitar duplicar a mesma query), Insight Engine heurístico real, Funil de Leads, Pipeline Comercial, Minhas Atividades, Comunicações (contagem real, taxa explicitamente indisponível), Atividade em Tempo Real (feed real cross-canal). Abas Visão Geral/Pipeline/Pendências navegáveis por URL (`?tab=`).
- [x] **Achado corrigido durante a validação**: 1ª versão de "conversão por etapa" deu **231%** com dado real (razão entre contagens de estágios adjacentes não é conversão de verdade sem coorte). Removido, virou indisponível explícito — não mascarado.
- [x] Validado ponta a ponta: Playwright (login real, navegação, abas, Legado expansível, salto pra rota legada sem erro) + requisição HTTP autenticada direta confirmando SSR correto por aba. Todo número bate com o banco real (conferido manualmente: meta R$50.000/realizado R$2.777,80+R$1.767,80, insight "R$22.222" = 25.000−2.777,80 exato).
- [x] `npx tsc --noEmit` limpo (mesmos 6 erros de baseline).
- [ ] Fora de escopo desta entrega (registrado, não esquecido): dark theme (só a arquitetura que permite), migração de Carteira/Financeiro/Contratos/Prospecção/Campanhas/Admin pra dentro da nova IA, resto dos domínios (Atendimento/Pessoas&Empresas/Qualificação/Pipeline Comercial/Negócios/Atividades/Automações/Indicadores como telas próprias no tema novo) — evoluem em cima desta mesma fundação.

**Correções de fidelidade ao Figma (mesmo dia, feedback direto do Kauã)**:
- [x] Abas Visão Geral/Pipeline/Pendências: achado real — a 1ª versão condicionava a TELA INTEIRA à aba selecionada (errado). Corrigido: só o grupo chart+ranking troca (mesmo agrupamento real do Figma, `grupo que altera visao geral/pipeline/pendencias`); Insights/Funil de Leads/Pipeline Comercial/Atividades/Comunicações ficam sempre visíveis, em qualquer aba.
- [x] Navegador de mês (‹ Agosto ›) virou funcional de verdade — `‹`/`›` navegam por `?mes=YYYY-MM`, recalculando todos os dados do mês pedido (antes só mostrava o mês atual, estático).
- [x] Margem lateral sem sentido no main-content — removido `max-w-[1200px] mx-auto` que eu tinha adicionado por conta própria (não existe no Figma, o conteúdo ocupa 100% do espaço disponível).
- [x] Grid de fundo do Figma (`bg-grid-effect`, linhas a cada 60px, opacity 40%) — não tinha sido implementado, adicionado via `repeating-linear-gradient` no `<main>`.
- [x] Botão de recolher sidebar (ícone "☰" ao lado do logo no Figma) — não existia, adicionado com o mesmo padrão de persistência (localStorage) do `CrmSidebar` legado; colapsado vira rail de ícones.
- [x] Funil de Leads ganhou a mesma marcação de vazão que o Pipeline Comercial já tinha ("26 negócios") — cada card agora mostra "N no mês" (quantos entraram nesse bucket este mês) ao lado do total snapshot, pedido do Kauã pra dar leitura de entrada/vazão.
- [x] "26 deals" → "26 negócios" (Pipeline Comercial estava em inglês).
- [x] Clique nos toggles (aba/mês/período do Funil de Leads) jogava a página pro topo — comportamento padrão do `<Link>` do Next.js em qualquer navegação. Corrigido com `scroll={false}` nos 4 links de filtro in-place. Validado via Playwright: `scrollTop` fixado em 700px, clique num toggle visível na viewport, `scrollTop` permanece 700 (não zera). Confirmado também que o falso-negativo do 1º teste (tab "Pipeline" com a página scrollada bem além do topo) era o próprio Playwright auto-scrollando o elemento pra dentro da viewport antes de clicar — não bug da aplicação.
- [x] Card do usuário (rodapé do sidebar) parecia "flutuando" sobre o menu — causa real: a nav interna tem scroll próprio (`overflow-y-auto`) que corta a lista de grupos sem nenhuma indicação visual, e o footer ficava encostado exatamente na borda desse corte, sem divisória — dava a impressão de estar sobreposto ao invés de ancorado. Corrigido com `border-top` + `padding-top` fixo (`shrink-0`) separando visualmente o footer da área rolável da nav.
- [x] Seta de abrir/fechar (like o Legado) estendida pra todos os grupos do menu (Menu/CRM/Automação/Relatórios/Configurações) — antes só o Legado tinha esse padrão. `NavGroup` ganhou estado próprio de open/close (`defaultOpen`), Legado continua fechado por padrão, os demais abertos.
- [x] Validado de novo com Playwright + dado real após cada correção.

## Eventos/Event-Driven — Event Outbox real (09/08)

**Gatilho**: revisão arquitetural externa (o Kauã revisou o snapshot congelado contra o blueprint completo) apontou `event_outbox` como o gap 🔴 de maior prioridade — a tabela existia desde F0, mas nada nunca publicava nem consumia. Depois de um mal-entendido de prompt sobre "congelar/parar" (esclarecido pelo Kauã: seguir fechando backend/domínio inteiro, depois materializar V1 completa de frontend por domínio — não parar), a instrução real e prioritária foi: fechar este gap antes de seguir.

- [x] `lib/events/outbox.ts` (publicar) + `lib/events/consumer.ts` (consumir, registry de handlers + retry/dead-letter em 5 tentativas) — ver ADR-EXEC-016.
- [x] Eventos reais ligados nos mesmos 7 call sites onde `dispararAutomacoes` já dispara (F5): `LeadCreated`, `DealCreated` (×2 pontos — negocios.ts POST e leads.ts quando cria negócio junto do lead), `StageChanged`, `DealLost`, `DealWon`+`CustomerCreated` (dentro do gate de evidência de Won, payload com `contratoId`/`produto`/`evidencias`/`mrr` reais).
- [x] Job agendado `event-outbox-sweep` no worker (1min) chamando `processarEventosPendentes()`.
- [x] Consumidor real #1: jornal de auditoria de domínio (`audit_log`, `action: event.<Tipo>`) — decoplado do código que publica, prova que o barramento funciona pra múltiplos assinantes.
- [x] **Validado ponta a ponta com dado real, via API real** (não script direto): login real → `POST /leads` → 2 eventos publicados → sweep automático processou em <70s → `audit_log` recebeu os 2 → `PATCH /negocios/:id` status=ganho (gate de evidência real, fallback legado via contrato existente, sem duplicar contrato) → 3 eventos publicados (`StageChanged`+`DealWon`+`CustomerCreated`) com payload correto → processados. Dado de teste (1 lead, 1 negócio, 1 contrato, eventos, audit_log) removido depois, confirmado 0 resto.
- [x] `npx tsc --noEmit` limpo (mesmos 6 erros de baseline, nenhum novo).
- [ ] Não incluído nesta entrega (consciente, não é gap esquecido): `whatsapp_recebido`/`contrato_vencendo`/`lead_inativo`/`nps_recebido` ainda não publicam evento (automação já cobre via chamada direta, menor valor sem consumidor real do outro lado); nenhum consumidor de negócio real (CS/Onboarding/Financeiro/Business Hub) existe ainda — só o jornal de auditoria.

## Fase atual: F7 — Frontend/UX (implementação, greenfield — ver nota abaixo)

**Branch atual**: `feature/crm2-fase7-frontend` (checkpoint do CrmTopbar já commitado, `b3ca3e2`).

**Nota de honestidade sobre o plano original**: a trilha de design paralela (prevista desde Fase 1 no plano) nunca foi formalmente iniciada em nenhuma fase anterior. F7 na prática não é "implementar o que já foi desenhado" — é greenfield de implementação de tela, decisão consciente de reduzir risco reaproveitando o que já existia pronto no código em vez de desenhar do zero sem trilha de design.

### F7 — progresso
- [x] **`CrmTopbar` revivido**: componente já existia 100% completo (breadcrumb, busca Cmd+K, `NotificationDropdown`, pill de usuário, logout) mas nunca era montado em nenhum lugar — achado confirmado na auditoria original, não é UI nova inventada agora. Montado em `app/src/app/(crm)/layout.tsx`.
- [x] **Bug real encontrado na verificação visual, corrigido**: hydration mismatch em `CrmTopbar.tsx` — `isMac` era calculado direto no corpo do componente (`typeof navigator !== "undefined"`), server renderiza "Ctrl+K", client troca pra "⌘K" depois de montar, React descarta a árvore inteira e loga erro. Bug estava latente desde que o componente foi escrito, só apareceu agora porque nunca tinha sido renderizado antes. Fix: `isMac` virou `useState(false)` + `useEffect` (client-only), SSR sempre manda "Ctrl+K" primeiro, corrige depois de montar — sem mismatch.
- [x] **Verificado de ponta a ponta via Playwright** (login real com `scott@scottdev.com.br`, navegação pra `/dashboard`, snapshot + screenshot): topbar renderiza corretamente (breadcrumb "Meu Dia", busca, sino, pill "Scott Ferraz / Super Admin", logout), sem overlap/quebra de layout, dado real carregando (MRR R$48.845, meta 9%). Confirmado ANTES e DEPOIS do fix (12 erros de console → 10, os 2 que sobraram eram exatamente o hydration mismatch + o `TypeError` derivado dele).
- [x] **CORREÇÃO IMPORTANTE (09/08, mais tarde na sessão) da nota abaixo — minha própria má-diagnose anterior**: eu tinha registrado a rajada de 401 como "recupera sozinho, não bloqueia" — **estava ERRADO**. Achado real ao investigar o relato do Kauã de "login funciona mas qualquer tela me desloga": esses 401 NÃO se recuperam — `Providers.tsx` tem um handler global (`window.fetch` override) que redireciona pra `/login` em QUALQUER 401 de origem própria. Causa raiz de verdade: `api-server/auth.ts` tinha o nome do cookie de sessão **fixo** na variante HTTPS (`__Secure-authjs.session-token`) pra derivar a chave de decriptação (NextAuth usa o nome do cookie como salt do HKDF) — em dev local (HTTP, sem prefixo `__Secure-`), a chave derivada ficava **sempre errada**, 401 em 100% das vezes (determinístico, não corrida) pra qualquer endpoint que passa por essa rota Hono (perfil/notificações/contadores/admin). Nunca acontecia nas PÁGINAS Next.js (dashboard, admin) porque essas usam o `auth()` do próprio NextAuth, caminho diferente e correto.
  - Fix: `getKey`/`decodeSession` agora recebem o nome do cookie e cacheiam uma chave por nome, tentando os 2 nomes possíveis — mesmo padrão que a leitura do cookie já fazia, só a derivação da chave estava fixa.
  - **Achado adicional no processo**: o processo do `api-server` (`tsx watch`) estava rodando há 2 DIAS sem reiniciar (desde sexta), não pegando nenhuma mudança de código desta sessão inteira em nenhum endpoint Hono — tive que matar e resubir manualmente. Isso significa que testes anteriores desta sessão que dependiam do api-server real (não de chamada direta de função) podem ter rodado contra código de sexta-feira; os testes que usei (chamada direta de função via script tsx) não foram afetados, mas registrar esse risco.
  - Validado: 9 endpoints que davam 401 (perfil/notificações/leads/whatsapp/propostas/negocios/carteira/admin×2) voltaram 200, testado 5x consecutivas pra estabilidade.
  - **Este era o bug real que o Kauã reportou ao vivo** ("login funciona, qualquer tela me desloga") — resolvido, confirmado por ele testando de verdade.
  - **Verificação visual completa via Playwright, pós-fix**: navegação real por várias telas (dashboard→leads→dashboard) sem nenhum 401 no console. Sino de notificação (badge "9+") e dropdown renderizando notificações reais (negócios ganhos com valor/data) — **essa funcionalidade inteira estava invisível antes do fix** (dependia de `/api/notificacoes`, que sempre 401ava). Contadores da sidebar (Contatos 1270, Propostas 530, Carteira 144) também confirmados com dado real. O bug não só causava logout — também deixava várias features do CRM silenciosamente mortas mesmo pra quem "conseguia" ficar logado numa página só.
- [x] `npx tsc --noEmit` limpo (só os 6 erros de baseline pré-existentes, mesmos de sempre).
- [ ] Nota lateral: durante a verificação, a senha local do usuário seed (`scott@scottdev.com.br`) não batia com `scott2026` documentado no README/seed.ts (hash divergente, causa não investigada — pode ter sido alterada manualmente em sessão anterior). Resetada localmente pra `scott2026` via script descartável (bcrypt, direto no Postgres local) pra poder testar — ação só no banco LOCAL, reversível, não é mudança de código nem afeta homolog/produção.
- [ ] Resto de F7 (Command Center, telas de Lead/Deal/Communication, Cadence Builder visual, Automation Builder visual) — não iniciado, greenfield real, maior escopo, pendente.

## F7 — follow-up: página "Qualidade de Dados" (09/08)

**Decisão registrada com honestidade**: entre (a) F5 Cadence Builder, (b)
continuar F6 (trocar dashboard pra ler do snapshot), (c) achar item de
menor risco em F7 — escolhi (c). Trocar o dashboard pra ler do snapshot
(b) é uma mudança de comportamento real (dado fica potencialmente
desatualizado em até 1h) numa tela já verificada funcionando — isso é
decisão de produto/UX (o Kauã aceita essa defasagem?), não só técnica, não
decidi isso sozinho. Cadence Builder (a) continua maior risco + bloqueado
por credencial. Uma página nova simples e utilitária (não é Command
Center, não precisa de trilha de design real) que só EXPÕE o que já foi
construído e testado (F6 Data Quality Layer) é o menor risco real
disponível — mesmo padrão de "reaproveitar o que já existe" do
`CrmTopbar`.

- [x] `/admin/qualidade-dados` — página nova (server component, gate por `isAdminView`), chama `rodarDataQuality()`/`calcularScoreSaude()` (F6, já testado com dado real) direto, sem endpoint novo. Reaproveita o kit visual já existente (`Stat`/`Secao` de `relatorios/components/kit.tsx`) — sem inventar novo padrão visual.
- [x] Link novo na sidebar (seção Admin, só super_admin, mesmo critério dos outros 2 links dessa seção).
- [x] Breadcrumb do `CrmTopbar` atualizado (`/admin/qualidade-dados` → "Qualidade de Dados") — sem isso caía no fallback genérico "Detalhe".
- [x] **Verificado com dado real via Playwright + curl**: os 10 checks renderizam com os números exatos já documentados em F6 (Duplicate 36, Missing Owner 54, Missing Source 346, Invalid Contact 3, Invalid Company 25, Inconsistent Stage 251, Invalid Amount/Orphan Deal/Missing Product em 0, Financial mismatch com `mrr_excesso`), Health Score 20% confirmado, amostras renderizando.
- [x] **Achado real durante a verificação, investigado e descartado como bug de produto**: a sessão parecia expirar em quase toda navegação via Playwright (redirecionava pro `/login` sem motivo aparente). Investiguei via `curl` direto com cookie de sessão real (bypassando o browser) — 5 requisições consecutivas, todas `200 OK` em ~100ms, sem timeout, sem falha. **Conclusão: era flakiness do cookie jar da instância do Playwright MCP nesta sessão, não um bug real do produto** (correção da hipótese inicial, que culpava o timeout de 8s do `resolveSession()` em `layout.tsx` — esse mecanismo existe e é real, mas não foi o causador aqui).
- [x] `tsc` limpo, dev server + api server saudáveis depois da mudança.

## Bug adicional da MESMA classe corrigido: org-switch/view-as mudos em dev local (09/08)

Continuando a puxar o fio do bug de sessão (ADR-EXEC-015), procurei outros lugares assumindo HTTPS/produção — achei: `api-server/routes/admin.ts` tinha `secure: true` **fixo** nos cookies `mcrm-org-override` (trocar de organização, super_admin) e `mcrm-view-as` (visualizar como outro usuário). Navegadores NUNCA aceitam cookie `Secure` sobre HTTP puro — essas 2 features ficavam completamente mudas em dev local, sem nenhum erro visível (o cookie simplesmente não persiste, a chamada retorna 200 mas nada muda).

- [x] Trocado pra `secure: IS_SECURE_CONTEXT` (`NODE_ENV === "production"`) nos 2 pontos — mesmo padrão de decisão que o NextAuth já usa internamente.
- [x] **Validado com dado real de ponta a ponta** (org temporária criada, testada, removida): `Set-Cookie` sem `Secure` confirmado, cookie persistiu no jar, `GET /api/admin/org-switch` confirmou `currentOrgId` refletindo a troca de verdade. Limpeza completa depois.
- [x] Limpeza de processos órfãos do `tsx watch` do api-server (3 gerações acumuladas ao longo da sessão, por causa desse mesmo processo não recarregar sozinho) — mantida só a geração ativa.
- [x] `tsc` limpo, health check ok.

## Incidente resolvido: login local do Kauã falhando (09/08) — 2 causas, não 1

Kauã reportou "tento logar local, em menos de 5s já sou deslogado" — investigação encontrou DUAS causas diferentes, encadeadas:

**Causa 1 — senha desatualizada no espelho local**: log real do dev server (`.next/dev/logs/next-development.log`) mostrou tentativas reais com `[auth][error] CredentialsSignin` — não era logout, era rejeição de credencial (visualmente parece "cair" de volta pro login). O banco local é espelho de produção tirado há alguns dias; hash de senha pode estar desatualizado tanto pra `kaua.araujo@callface.ai` quanto pra `scott@scottdev.com.br` (achado ao vivo: ele tentou o super_admin local e TAMBÉM deu CredentialsSignin, mesmo eu tendo validado essa senha via curl minutos antes — suspeita de autofill do navegador com senha antiga salva).
- [x] Ambas as contas resetadas localmente pra senha unificada `callface2026` (bcrypt, scripts descartáveis, removidos) — só banco LOCAL, zero relação com produção, reversível.
- [x] Validado via curl pra as 2 contas: login + sessão funcionando.

**Causa 2 — middleware restringe `/admin/*` a `super_admin`, achado real ao investigar**: mesmo com senha certa, a conta `kaua.araujo@callface.ai` (role=`admin`) NUNCA veria `/admin/qualidade-dados` nem `/admin/duplicidade-contratos` — `src/middleware.ts` (pré-existente, não fui eu que escrevi) tem uma regra explícita: `pathname.startsWith("/admin") && effectiveRole !== "super_admin"` → redirect pro `/dashboard`. É o MESMO critério que já protegia "Organizações"/"Usuários" no menu (que eu segui inconscientemente ao adicionar o link, mas as 2 páginas em si checavam `isAdminView` — mais permissivo que o middleware, que sempre ganha).
- [x] Confirmado via curl: `scott@scottdev.com.br` (super_admin) acessa as 2 páginas normalmente; `kaua.araujo@callface.ai` (admin) é redirecionado pelo middleware antes mesmo da página rodar.
- [x] Kauã optou por continuar acompanhando com a conta `scott@scottdev.com.br` local — nenhuma mudança de permissão foi feita (promover o próprio usuário dele pra super_admin seria alterar permissão, checkpoint que não decido sozinho).
- [x] **Padrão a reconhecer no futuro**: se um usuário reportar "login cai/redireciona" no ambiente local, (1) checar `.next/dev/logs/next-development.log` por `CredentialsSignin` primeiro, (2) se a senha estiver certa, checar `src/middleware.ts` por restrição de role no path antes de suspeitar de bug de sessão.

## F7 — follow-up: aba "Pós-venda" construída (reconsiderado, 09/08)

Reconsiderei a decisão anterior (registrar sem construir): reexaminando, `TabPosVenda.tsx` usa EXATAMENTE o mesmo kit visual (`Stat`/`Secao`/`BarraLinha`) já aplicado 2x nesta sessão (`/admin/qualidade-dados`, `/admin/duplicidade-contratos`) — não é desenho de tela nova, é o mesmo template repetido com dado diferente. Dado que é literalmente a prioridade #1 do negócio (redução de churn) e o backend já existia testado, construir passou a fazer mais sentido que só registrar.

- [x] `TabPosVenda.tsx` — nova aba em Relatórios (não `/admin/*`, fica junto das outras 6 abas reais: Comercial/Marketing/SDR/etc). MRR ativo, NPS médio+distribuição, **churn histórico** (com nota clara de que é diferente do churn mensal da aba Financeiro — aprendi essa lição com o achado do "MRR ativo" mais cedo hoje), contratos vencendo em 90 dias, MRR por tipo de contrato.
- [x] Rotulagem cuidadosa desde o início (não depois de um achado de confusão, como no caso do MRR) — `churnRate` aqui é acumulado (cancelados/total já criado), bem diferente do `churnLogoPct`/`churnReceitaPct` mensal do Financeiro. Sub-texto explícito no Stat card.
- [x] **Validado com dado real via curl + Playwright**: endpoint retorna dado real (R$119.801,57 MRR, 217 contratos, mrrPorTipo com várias categorias reais), tab renderiza visualmente idêntica ao resto do app, sessão persistiu durante a navegação (confirma estabilidade do fix de sessão).
- [x] `tsc` limpo, health check ok.

## F8 — primeiro passo real (adiantado, zero risco): 4 filas mortas removidas (09/08)

F8 (Migração/Decomissão) formalmente ainda não começou (depende de burn-in em produção, que não existe ainda) — mas o próprio plano cita "decomissionar código morto (filas mortas como `cipa-analysis`)" como parte do objetivo. Ao continuar o pente-fino, achei que essa fila EXATA (citada no plano como exemplo) ainda existia — e mais 3 no mesmo estado.

- [x] **4 filas confirmadas 100% mortas** (grep por variável E por nome de string, nenhum produtor `.add()` em lugar nenhum, sem `upsertJobScheduler` registrando job periódico): `cipaAnalysisQueue` (nem produtor nem worker), `aiSdrQueue` (idem), `conversionSyncQueue`/`followUpQueue` (tinham worker, mas o worker só fazia `console.log` — nunca recebiam job real, sem produtor).
- [x] Removidas as 4 exports em `lib/queue/index.ts` + os 2 workers stub (`conversionSyncWorker`/`followUpWorker`) + a referência deles no `Promise.all` do shutdown gracioso em `worker/index.ts`.
- [x] `tsc` limpo (nenhuma outra referência quebrada — prova que estavam mesmo mortas). Worker reiniciado automaticamente via `tsx watch`, saudável.
- [ ] Isso NÃO é "iniciar F8" — é aproveitar um achado seguro e zero-risco que o próprio plano já antecipava, sem tocar em nada que dependa de burn-in/produção.

## F4 — follow-up: "duas verdades" de MRR na aba Financeiro, esclarecido (09/08)

Continuando o pente-fino (procurando outros cálculos de MRR/receita independentes, mesmo padrão de risco do bug original), achei: `lib/financeiro/metricas.ts` tem um comentário no topo dizendo "MRR vem de `mrr_movimentos`, nunca recalculado diferente por aba" — mas a PRIMEIRA função do próprio arquivo (`getMrrAtual`) contradiz isso, somando direto de `contratos.mrr`.

**Verificado com dado real se era bug**: comparei os 3 métodos — `contratos.mrr` soma R$119.801,57; `mrr_movimentos` e o espelho Stripe (`assinaturas`) batem em R$48.844,50 (match exato). **Não é bug novo** — é a MESMA lacuna já sinalizada no card "O que fazer agora" do dashboard ("Contratos no CRM somam R$119.802, mas o Stripe cobra R$48.845"). `getMrrAtual` mede intencionalmente o total contratado no CRM (inclui boleto/manual, fora do Stripe), `mrr_movimentos`/`assinaturas` medem só o que passa pelo Stripe — são métricas DIFERENTES por natureza, não a mesma coisa calculada 2x errado.

**O que era real**: a UI (`TabVisaoGeral.tsx`, aba Financeiro) mostrava esse número só como **"MRR ativo"**, sem nenhum qualificador — alguém vendo essa tela isolada do dashboard veria 2 números de "MRR" bem diferentes sem explicação, risco real de decisão errada.

- [x] Label corrigido pra "MRR ativo (contratos no CRM)" + sub-texto explicando a diferença do MRR Stripe.
- [x] Comentário do topo do arquivo corrigido pra descrever a realidade (2 métricas diferentes, cada uma documentada), não uma regra que o próprio código não segue.
- [x] `tsc` limpo. Página é client component (renderiza pós-hidratação, curl não pega o texto — mudança é só JSX, risco zero, não toquei nenhum cálculo).
- [x] Nenhuma mudança de cálculo — só clareza. O número em si continua correto pro que representa.

## F6 — follow-up: invariantes de relatório trazidos pro Data Quality Layer (09/08)

Ao fazer um pente-fino mais amplo (procurando outros lugares que calculam MRR/receita, mesmo padrão de risco do bug original), achei `src/scripts/checar-invariantes-relatorios.ts` — checker pré-existente da auditoria de 21/07 (soma por vendedor vs total, funil monotônico), que só roda quando alguém lembra de executar manualmente. **Não estava nem registrado no `package.json`** — adicionei `npm run check:relatorios`.

- [x] Rodei o script contra o banco local pela primeira vez nesta sessão — **todas as invariantes OK**, confirma que nada do que mudei hoje quebrou nenhuma régua existente.
- [x] Trouxe 3 dos 5 invariantes pro Data Quality Layer (`lib/crm/data-quality.ts`) — rodam sempre via `/admin/qualidade-dados`, não só quando alguém lembra do script: "Σ por responsável = total", "funil SDR monotônico", "funil de vendas monotônico".
- [x] **Bug real achado e corrigido no processo**: `db.execute(sql\`...ANY(${array})\`)` do Drizzle não expande array em array literal Postgres (vira parâmetros posicionais, quebra `ANY`) — diferente do tagged template do pacote `postgres` puro usado no script original. Corrigido com `sql.raw` de array literal explícito (seguro aqui — lista é constante fixa no código, não input de usuário).
- [x] **Validado**: os 3 novos checks reproduzem exatamente o mesmo resultado do script original (0 problemas em todos), página confirmada via curl.
- [x] `tsc` limpo, dev/api saudáveis.

## F6 — follow-up: 2 checks novos de integridade do Domain Model (F1/F2) (09/08)

Depois de fechar F1/F2 tecnicamente, construí a validação continuada — não basta ter testado uma vez com script descartável, o Data Quality Layer (F6, já existe, já tem UI) é o lugar certo pra isso rodar sempre.

- [x] **Achado real ao construir**: minha primeira query ("leads sem `pessoas.leadIdLegado`") deu 32 problemas — mas **não é gap real**, são exatamente os 32 leads que o backfill original deduplicou por e-mail de propósito (reengajamento: `leadIdLegado` só aponta pro lead ORIGINAL que criou a pessoa, um lead novo com o mesmo e-mail não ganha seu próprio `leadIdLegado`). Confirmado 10/10 numa amostra: todos batiam com uma pessoa existente via e-mail. Corrigi a query antes de expor um falso positivo na UI (mesmo tipo de cuidado já aplicado no check "Inconsistent Stage" de F6 original).
- [x] `Domain Model Sync (Leads)` — conta certo (nem por `leadIdLegado`, nem por e-mail) e `Domain Model Sync (Negócios)` (1:1 sem dedup, mais simples) — 2 checks novos em `lib/crm/data-quality.ts`, aparecem automático em `/admin/qualidade-dados` (reusa a UI já existente, não criei nada novo).
- [x] **Resultado real, validado**: 0 e 0 — confirma de verdade (não só afirma) que o trabalho de dual-write de F1/F2 fechado nesta sessão está completo agora.
- [x] `tsc` limpo, página verificada via curl (ambos os Stat cards renderizando `value:0`, cor "ganho").

## F5 — follow-up: página `/automacoes` com copy desatualizada corrigida (09/08)

**Achado pequeno, real, honesto sobre onde parei**: a página de automações mostrava "serão adicionadas em breve" — texto que ficou desatualizado desde que o motor real (F5) começou a funcionar nesta sessão. Corrigi a mensagem pra refletir a realidade (motor ligado em 7 gatilhos, só falta cadastrar regra) e adicionei contagem/data da última execução por regra (reusa `automacao_execucoes`, dado real).

**Decisão consciente de NÃO ir além**: não construí um formulário de criação de regra — isso é UI nova de verdade (formulário, validação, UX de configuração de condição/ação por tipo), diferente das 2 páginas admin anteriores (que só EXPÕEM dado/lógica já testada via leitura). Cruzaria pra território de "trilha de design" que venho respeitando a sessão inteira. Registrado como candidato real de F7 quando a trilha de design existir.

- [x] Copy corrigida, contagem de execução por regra adicionada.
- [x] `tsc` limpo, verificado via curl (copy nova confirmada no HTML).

## F4 — follow-up: 58 contratos ambíguos, classificação por evidência (09/08)

Instrução do Kauã: não revisar os 58 um a um, construir classificação automática primeiro. `classificarAmbiguosPorEvidencia()` — ver **ADR-EXEC-014**.

- [x] Compara cada ambíguo com o vizinho MAIS PRÓXIMO NO TEMPO do mesmo grupo (qualquer contrato, não só outro ambíguo — achado de escopo corrigido no meio da implementação: comparar só ambíguo×ambíguo deixava 43/58 sem vizinho).
- [x] Limiares calibrados com dado real (13 pares analisados): ≤5% valor + ≤1 dia → `duplicata_provavel`; ≥40% valor OU ≥5 dias → `legitimo_provavel`; resto → `revisao_necessaria`.
- [x] **Resultado real**: 33 `duplicata_provavel`, 23 `legitimo_provavel`, só **2 `revisao_necessaria`** — dos 58 originais, sobra muito pouco pra revisão humana de verdade.
- [x] `/admin/duplicidade-contratos` atualizada com os 3 sub-tiers (Stat cards + label por contrato com diff de valor/tempo). Script CLI também atualizado (mesma função, não duplicada).
- [x] Validado: script CLI rodado com dado real (33/23/2 confirmado), página confirmada via curl (labels dos 3 tiers presentes no HTML).
- [x] `tsc` limpo.
- [ ] **Nenhuma correção aplicada** — `duplicata_provavel` é sinal de alta confiança pra fila de consolidação, não ordem de merge. Decisão de consolidar continua humana (mas agora em lote de 33 casos com padrão claro, não 58 individuais).

## F5 — Cadence Engine: arquitetura construída sem esperar a Groq (09/08)

Instrução explícita do Kauã: "não espere a Groq pra construir a arquitetura do Cadence Builder... validar o AGENTE é bloqueado pela credencial, construir a arquitetura não". Motor genérico construído — ver **ADR-EXEC-013** pra detalhe completo.

- [x] `lib/crm/condicao.ts` — `avaliarCondicao` extraído de `automacao-engine.ts` (agora reusado por 2 sistemas, uma implementação só).
- [x] Schema novo: `cadence_definitions` + `cadence_enrollments` + `cadence_enrollment_events`.
- [x] `lib/cadencia/cadence-engine.ts` — `iniciarCadencia`/`avancarEnrollment`/`cancelarCadencia`/`sweepCadenciasDevidas` + registry de adapters (`registrarAdapter`). Zero dependência de provider de IA no motor.
- [x] Job agendado no worker (`cadence-sweep`, 5min) já rodando.
- [x] **Validado com dado real** (2 scripts descartáveis, removidos): branch condicional, retry com backoff (2 falhas + sucesso), audit trail, cancelamento, idempotência, sweep pegando só o vencido.
- [x] `tsc` limpo, dev/api/worker saudáveis.
- [ ] **Decisão consciente, não corte por pressa**: migrar a cadência real (AI SDR retry tiers em `runAiSdrRetrySweep`, ou os 13 toques de `sdr-inbound.ts`) pra rodar em cima deste motor NÃO foi feito — mudaria comportamento de fluxo de receita real, merece validação (idealmente com Groq renovada) antes de cortar o que já funciona. Motor pronto, zero enrollment real usando ainda, zero risco de regressão nos 2 sistemas atuais.

## F4 — follow-up: Commercial Evidence Policy — Won desacoplado de Stripe (09/08)

**Recalibração importante do critério de autonomia** (revisão extensa do Kauã): decidir sozinho TUDO que é técnico/arquitetural; só parar quando a decisão depende de regra de NEGÓCIO que altera receita/dado histórico/permissão/operação. Eu estava tratando "falta decisão de negócio" como razão pra não avançar peças arquiteturais adjacentes que podia construir — isso mudou o resto desta sessão. Salvei essa calibração em memória (`feedback_autonomia_tecnica_vs_checkpoint_negocio`).

O achado mais importante da revisão: Stripe não é fonte universal de receita, só fonte do que É faturado pelo Stripe — PBX/venda manual precisa de um caminho de evidência que não pressupõe Stripe. Construída a arquitetura completa (ver **ADR-EXEC-012**): `comercial_evidencia` + `won_evidence_policies` (schema novo), `lib/crm/won-evidence.ts` (`avaliarEvidenciaWon`/`registrarEvidencia`/`registrarEvidenciaManual`), gate de Won em `negocios.ts` migrado pra usar essa política em vez do check ad-hoc anterior, endpoint novo `POST /negocios/:id/evidencia-manual` (admin/gerente, sempre audit-logado) — a 3ª via de evidência pra PBX que estava pendente desde F4.

- [x] **Validado com dado real** (script descartável, removido): 3 casos testados — negócio sem evidência (bloqueado), negócio com contrato existente (fallback legado funciona E auto-registra evidência retroativamente), negócio com evidência manual anexada mas tipo não aceito pela política (CONTINUA bloqueado — prova que a política é real, não um carimbo).
- [x] Política catch-all seedada no banco real, idêntica ao comportamento anterior (zero regressão): `signed_contract`/`stripe_subscription`/`stripe_payment`.
- [x] `tsc` limpo, dev/api server saudáveis.
- [ ] **Calibração de negócio ainda pendente** (não decidida, registrada em `crm2-decisoes-pendentes.md`): quais tipos de evidência valem pra `produto='pabx'` — hoje `admin_approval`/`manual_contract` existem no sistema mas nenhuma política os aceita ainda, então PBX ainda não fecha por essa via até alguém inserir a linha de política certa.
- [ ] `stripe-sync.ts` não registra evidência explicitamente ainda (contratos criados ali muitas vezes não têm `negocioId`) — fallback lazy cobre quando tem. Não tocado por precaução (fix de MRR já validado ali é sensível).
- [x] Fechados no mesmo commit (achados da auditoria de F1, mecânicos): `aceitar-proposta.ts` — o clone de negócio "ativo" pra carteira agora tem `.returning()` + dual-write (única lacuna que restava do mapeamento original de F1); `leads.ts` `POST /leads/:id/vincular-negocio` — achado NOVO durante a auditoria (negócio criado nesse endpoint nunca tinha sido sincronizado, não estava em nenhuma lista anterior).

## F7 — follow-up: "Duplicidade de Contratos" + consolidação de decisões pendentes (09/08)

**Decisão registrada com honestidade**: entre (a) mais um item pequeno de F7, (b) revisitar Cadence Builder com escopo reduzido, (c) consolidar as decisões humanas pendentes acumuladas — fiz (a) E (c) juntas, não só uma. Depois de 3 checkpoints seguidos de trabalho autônomo empilhando pendências (58 contratos ambíguos, evidência PBX, 54 leads órfãos, decisão do snapshot, credencial Groq, Cadence Builder), continuar só acumulando mais sem sintetizar pro Kauã revisar deixaria de valer a pena — ele não pediu pra eu decidir essas coisas de produto/negócio, pediu execução técnica. Cadence Builder (b) continua sendo o item de maior risco (mexe no fluxo de receita do AI SDR) e ainda sem forma de validar E2E — registrado como pendência a decidir junto com o Kauã, não construído sozinho nesta rodada.

- [x] `/admin/duplicidade-contratos` — página nova (mesmo padrão de `/admin/qualidade-dados`: server component, gate `isAdminView`, reaproveita o kit visual). Lógica de agregação extraída do script `db:relatorio-duplicidade-contratos` pra uma função reusável (`gerarRelatorioDuplicidade` em `lib/crm/contrato-duplicidade.ts`) — script e UI chamam a MESMA função agora, evita duplicar a lógica em dois lugares (mesmo padrão de risco já identificado no F6/ADR-EXEC-011).
- [x] Link na sidebar (Admin, super_admin) + breadcrumb no `CrmTopbar`.
- [x] **Validado**: script CLI refatorado rodado com dado real — números idênticos aos já documentados em F4 (57 grupos, 68 upsell, 4 obsoleto, 58 ambíguo, R$17.449,30 excesso), confirma que a extração não mudou o resultado. Página verificada via `curl` com sessão real (login programático) — HTML confirma os mesmos 4 números renderizados corretamente.
- [x] `tsc` limpo, dev server + api server saudáveis.
- [x] **Resumo consolidado de decisões pendentes escrito no vault**: `projetos/callface/produto/crm2-decisoes-pendentes.md` (Brain - Scott Studio) — 7 itens (contratos ambíguos, evidência PBX, leads órfãos, defasagem do snapshot, credencial Groq, Cadence Builder, homolog do CRM 2.0), cada um com contexto/onde ver/decisão que falta. Linkado em `crm-callface-status.md`. Nenhuma decisão de produto/negócio tomada sozinho — só consolidado pra revisão.

## F5 — follow-up: 3 gatilhos periódicos migrados pro motor novo (09/08)

Fechando a pendência registrada em F5 ("migrar `lead_inativo`/`contrato_vencendo`/`nps_recebido` pro motor novo"). **Achado real ao investigar**: os 3 gatilhos já existiam no type union (`GatilhoAutomacao`) e no enum de UI (`automacoes.ts`) desde que o motor foi construído — mas nenhum dos 3 nunca era disparado de verdade (`grep dispararAutomacoes(` confirma). Se algum usuário tivesse configurado uma regra com esses gatilhos, ela nunca rodaria — bug real, mas de impacto zero hoje (`select gatilho, count(*) from automacoes` retornou 0 linhas, nenhuma regra configurada ainda).

- [x] `contrato_vencendo` — ligado no handler `alerta-renovacao` (worker, cron 24h), ao lado da criação de tarefa hardcoded (não substitui).
- [x] `lead_inativo` — ligado no handler `reativar-lead-perdido` (worker, cron 24h), mesmo critério.
- [x] `nps_recebido` — **não era periódico, correção da nota anterior**: é reativo, dispara em `POST /nps/:token` (endpoint público, sem sessão — resolve `organizacaoId` a partir do lead atualizado).
- [x] **Testado E2E com dado real** (script descartável, removido): 3 regras reais criadas em `automacoes`, `dispararAutomacoes` chamado pros 3 gatilhos com contexto real, confirmado `automacao_execucoes` com `status='sucesso'` e tarefa de fato criada pros 3, cleanup rodado (dado de teste removido, nenhuma tarefa real do lead tocada — bug no próprio script de teste corrigido antes de rodar: um `delete` inicial ia apagar todas as tarefas do lead real, trocado por filtro exato no prefixo de teste).
- [x] `tsc` limpo, dev server saudável (`curl /login` → 200) depois da mudança.

## F6 — follow-up: snapshot diário (Analytics separado do OLTP, primeiro passo) (09/08)

**Decisão registrada com honestidade**: entre F6 (Analytics/OLTP) e F5
(Cadence Builder) como próximo passo, escolhi F6 — Cadence Builder mexe no
fluxo real de envio do AI SDR (maior risco, e ainda bloqueado por
`GROQ_API_KEY` inválida pra validar E2E de qualquer forma), Analytics é só
leitura, sem tocar fluxo de escrita/receita, mais fácil validar sem
credencial externa.

**Achado real ao ler o código antes de construir**: o dashboard
(`dashboard/page.tsx`, 780 linhas) não é um cálculo simples de agregação —
tem histórico documentado de bug real de contagem duplicada (achado
22/07: card de meta somava mrr+valor_projeto e dobrava híbridos) e fontes
canônicas já estabelecidas (`getFechadoPeriodo`/`getPipelineAtual`, MRR =
Stripe nunca CRM). Ver ADR-EXEC-011 pra decisão completa — resumo: o
snapshot CHAMA essas mesmas funções canônicas, nunca reimplementa a
agregação, exatamente pra não arriscar reintroduzir esse tipo de bug.

- [x] Schema novo `metricas_diarias` (snapshot por org/dia, `unique(organizacaoId, data)`), aplicado via `drizzle-kit push --force`.
- [x] `lib/analytics/snapshot-diario.ts`: `calcularSnapshotDiario(organizacaoId)` chama `getMetaComercialAgregada`/`getPipelineAtual`/`getFechadoPeriodo` + as 2 queries de MRR Stripe (ativo/em risco) — as MESMAS já usadas pelo dashboard, upsert em `metricas_diarias`.
- [x] Job agendado no worker (`snapshot-diario`, a cada 1h, mesmo padrão dos outros `upsertJobScheduler`) + handler que roda pra todas as orgs (best-effort por org).
- [x] Endpoint de leitura `GET /api/relatorios/snapshot-diario` — lê o snapshot de hoje, calcula on-demand se ainda não rodou (não fica vazio esperando o cron).
- [x] **Validado com dado real, cross-check exato**: rodei `calcularSnapshotDiario` pro org real e comparei contra os números já confirmados visualmente no dashboard (mesma sessão, F7): meta R$4.545,60/R$50.000 (2 closers) ✓, pipeline R$91.938,53 ✓, fechado do mês R$4.815,50/17 negócios ✓, MRR Stripe R$48.844,50/116 clientes ✓, MRR em risco R$10.106,80/10 ✓ — todos os 7 campos bateram exatamente. Script de teste descartável removido depois.
- [x] `tsc` limpo, dev server + api server saudáveis (`/login` 200, `/api/health` 200) depois da mudança.
- [ ] **Dashboard AINDA lê direto da OLTP** — não foi trocado pra ler do snapshot nesta rodada (strangler pattern: construir em paralelo primeiro, trocar depois de rodar de verdade por um tempo). Pendência registrada, decisão futura separada.
- [ ] Escopo desta rodada foi só o agregado de EMPRESA (`soMeu=false`) — números pessoais/por-usuário não entraram (são baratos e naturais de já ficar de fora).

## Fase — F1 (histórico) — Domain Model (F0 completo localmente)

**Branch atual**: `feature/crm2-fase1-domain-model` (a partir de `feature/crm2-fase0-foundation`, que já foi commitada e não precisa mais de trabalho — só falta promover pra homolog quando o ambiente novo existir).

**Subfase atual**: schema novo criado e validado (`pessoas`/`pontos_contato`/`oportunidades`/`clientes`, commit `40d0ddb`) → próximo passo é o script de backfill/reconciliação do legado.

### F0 — status final: completo localmente, 6/6 tasks
Todas as 6 tasks de F0 (schema hardening, dev/prod routing parity + remoção de rotas mortas, IDOR, reunioes.status, RBAC v2, Data Governance) foram concluídas e commitadas (`14ad2a3`, `cc68e19` na branch `feature/crm2-fase0-foundation`). Detalhe completo na seção "F0 — histórico" mais abaixo. RBAC v2 e Data Governance (que apareciam como "em andamento" numa versão anterior deste arquivo) **estão concluídos**: papéis novos (Director/Coordinator/Operations) em `roles.ts`, `teams`+`usuarios.teamId`, helpers `orgScope`/`pushOwnershipScope`, audit log real ligado em `org-switch`/`view-as`, e ADR-EXEC-007 (Data Governance) documentado.

### F1 — progresso
- [x] Branch `feature/crm2-fase1-domain-model` criada.
- [x] Schema novo desenhado e aplicado no banco local (`drizzle-kit push --force`), `tsc` limpo, commit `40d0ddb`:
  - `pessoas` (identidade persistente, Contact do blueprint) — `leadIdLegado` é só bridge de migração.
  - `pontos_contato` (Attribution/Touchpoints) — ancorado em Pessoa/Empresa, nunca em Lead. `isFirstTouch`/`isLastTouch` explícitos.
  - `oportunidades` (Deal v2) — referencia `pessoa_id`/`empresa_id`, sem `lead_id` obrigatório. `negocioIdLegado` é bridge de migração.
  - `clientes` (Customer, entidade nova) — `statusFinanceiro` é cache de leitura, nunca fonte de escrita (Data Governance).
- [x] **Script de backfill escrito e executado** (`app/src/lib/db/backfill-domain-model.ts`, `npm run db:backfill-domain-model`) — idempotente (TRUNCATE das 4 tabelas novas antes de reconstruir, seguro porque nada ainda lê/escreve nelas).
- [x] **Resultado no banco local, validado**: 3.164 leads → 3.132 pessoas (32 dedupados por e-mail = reengajamento real) + 3.164 pontos_contato (1:1 com leads) + 231 clientes (de 240 leads tipo='cliente', dedup por empresa). 1.092 negócios → 1.092 oportunidades (1:1), **zero sem pessoa resolvida**.
- [x] **Validação de integridade extra (não só contagem)**: zero pessoa com >1 `isLastTouch`, zero pessoa com >1 `isFirstTouch`, zero pessoa com touchpoint mas sem first touch, zero oportunidade órfã. Casos reais de reengajamento (32 pessoas, 2 touchpoints cada) confirmados por query.
- [x] **Dual-write real implementado**: `lib/crm/sync-domain-model.ts` (`syncPessoaFromLead`, `syncOportunidadeFromNegocio`) — mesma lógica do backfill, mas idempotente por registro único (upsert por `leadIdLegado`/`negocioIdLegado`), best-effort (nunca lança erro que quebre o fluxo legado). Ligado em: `POST /leads` (criação), `PATCH /leads/:id` (update), `POST /negocios` (criação), `PATCH /negocios/:id` (update), e `converterLeadEmOportunidade` (usado tanto pelo endpoint manual quanto pelo Agente SDR — cobre o caminho automático também).
- [x] **Testado de ponta a ponta** (script descartável, removido depois): criei lead+negócio reais via as mesmas funções que as rotas chamam, confirmei pessoa/touchpoint/oportunidade criados corretamente (isFirstTouch/isLastTouch certos, pessoaId linkado), limpei os dados de teste. `tsc` limpo, dev server (`:3000`/`:3001`) saudável depois do reload automático (`tsx watch`/Turbopack).
- [ ] Validar F1 pelas 5 dimensões de Done (ver plano) — Technical+Data+Operational OK agora; falta UX (nenhuma tela ainda expõe o novo Domain Model, fica pra trilha paralela de design + F7) e Observability mais formal (hoje só `console.error` no catch, não tem métrica/alerta de falha de sync).
- [x] **Mapeamento de todos os pontos de escrita** (`grep insert(leads)/insert(negocios)` no repo inteiro): achado real — criação de lead/negócio está espalhada em pelo menos 9 lugares, o mesmo padrão de "regra duplicada" que já tinha causado o bug de MRR. Cobertos com dual-write (por ordem de valor real: tráfego externo + receita primeiro):
  - `POST/PATCH /leads`, `POST/PATCH /negocios` (rotas principais).
  - `converterLeadEmOportunidade` (cobre tanto o endpoint manual quanto o Agente SDR).
  - `webhooks/site-lead/route.ts` e `webhooks/rd-lead/route.ts` (as 2 entradas reais de lead externo — site institucional e RD Station/Meta).
  - `lib/crm/aceitar-proposta.ts` (`marcarPropostaAceita`) — o caminho de receita real (Won), usado tanto pelo aceite manual quanto pelo webhook do Stripe.
- [x] **Fechados nesta rodada (09/08)**: os 4 pontos de menor tráfego que ficavam pendentes agora têm dual-write — `contatos-unified.ts` (contato manual novo), `apollo.ts` (import de prospecção em lote, dentro do loop), `contatos.ts` (2 pontos: criar-lead a partir de contato, e converter contato→lead+negócio), `propostas.ts:299` (negócio fallback quando proposta vem só com lead, sem deal). Todos best-effort (a função já engole erro internamente), mesmo padrão dos pontos já cobertos. **Validado com dado real** (script descartável, removido): criei lead tipo='contato' + negócio real mimetizando exatamente os 2 padrões novos, confirmei pessoa E oportunidade sincronizadas corretamente (pessoaId linkado certo), cleanup completo (achei e corrigi um bug no próprio cleanup do script de teste — esqueceu de deletar `pontos_contato` antes de `pessoas`, FK). Único ponto ainda não coberto: o 2º negócio (clone "ativo" pra carteira) dentro de `aceitar-proposta.ts` — secundário, o evento principal de Won já está coberto via `pAtual.negocioId`.
- [x] Testado (`tsc` limpo, dev server saudável) depois de cada rodada de mudança.
- [x] **Observability**: falha de sync agora grava em `audit_log` (`action: "domain_model_sync.failed"`), não só `console.error` — consultável de verdade, não preso em log de container.
- [ ] Validar F1 pelas 5 dimensões de Done — Technical+Data+Operational+Observability OK pros pontos cobertos de dual-write; falta só UX (nenhuma tela ainda expõe o novo Domain Model, fica pra trilha de design + F7, não bloqueia seguir).

## Fase atual: F6 — Analytics (Data Quality Layer construído e rodado)

- [x] **Data Quality Layer real** (`lib/crm/data-quality.ts` + `db:relatorio-data-quality`): 10 checks do blueprint bloco 82, todos com query real contra o banco local (não simulado). Rodado de verdade, resultado salvo em `docs/reconstruction/relatorios/2026-08-09-data-quality.md`.
- [x] **CRM Data Health: 20%** — mas o número importa menos que o que apareceu:
  - Duplicate: 36 (mesmo achado de F4, validação cruzada — duas implementações independentes bateram no mesmo R$17.449,30).
  - **Missing Owner: 54** (tipo='lead') — **investigado a fundo (09/08), causa raiz NÃO é o bug de 03/08 recorrendo**: os 54 têm o exato mesmo `created_at` (import em lote único de 4 dias atrás, `origem='outbound'`, fora do código da aplicação — nenhuma rota atual cria lead com essa origem). Mesmo sintoma, causa diferente. Ver ADR-EXEC-010. Não corrigido sozinho — decisão de reconciliação fica com o Kauã.
  - Missing Source: 346, Invalid Contact: 3, Invalid Company: 25, Invalid Amount: 2 — achados novos, não estavam mapeados antes.
  - Inconsistent Stage: 251 — **corrigi um falso positivo meu próprio** durante a construção (esqueci `status='ativo'` no filtro de exceção) — depois de investigar com dado real, não é erro de dado, é status operacional (ativo/outra_data/sem_retorno/trava_negociacao/trava_assinatura) nunca formalizado na config do pipeline. Documentado como nuance, não come reportado como bug.
  - Orphan Deal: 0, Missing Product: 0 — limpos (o fix de produto NULL já documentado em F4 se confirma aqui).
- [x] `tsc` limpo, dev server saudável.
- [ ] **Analytics separado do OLTP** (projeção por evento, dashboard hoje faz ~10 blocos de query síncrona sem cache) — NÃO iniciado nesta sessão, é a outra metade de F6, escopo maior (requer decidir o modelo de projeção). Registrado como pendência real.
- [ ] **Command Center** — fica pra depois, é mais UX (trilha de design + F7), conforme já decidido no plano.

## Fase — F5 (histórico) — Automation (motor real construído e testado)

- [x] `automacao_execucoes` (schema novo — histórico de execução, blueprint bloco 31).
- [x] **Motor real** (`lib/crm/automacao-engine.ts`): `dispararAutomacoes(gatilho, contexto)` — busca regras ativas do gatilho, avalia `condicao` (5 operadores: igual/diferente/contem/maior_que/menor_que), executa `acao` (6 tipos implementados de verdade, reaproveitando infra já existente: `criar_tarefa`/`notificar_usuario`/`mudar_status`/`atribuir_responsavel` são puro DB; `enviar_email` via `sendResendEmail` — já no-op gracioso sem chave; `enviar_whatsapp` via `whatsappOutgoingQueue` já existente), grava em `automacao_execucoes` sempre (sucesso/erro/condição não atendida). Best-effort — automação falhando nunca quebra o fluxo real que disparou.
- [x] **Testado de ponta a ponta com dado real** (script descartável, removido): criei regra real (novo_lead→criar_tarefa), lead real, disparei o motor, confirmei execução registrada E tarefa criada corretamente, limpei os dados de teste.
- [x] Gatilhos ligados nos pontos reais: `novo_lead`+`novo_negocio` (`POST /leads`), `novo_negocio` (`POST /negocios`), `mudanca_status` (`PATCH /negocios/:id`), `whatsapp_recebido` (worker, mensagem ao vivo).
- [x] `tsc` limpo, dev server saudável.
- [ ] **Não testável E2E localmente**: ações `enviar_email`/`enviar_whatsapp` — sem `RESEND_API_KEY` nem sessão WhatsApp conectada localmente (mesmo padrão de F3/F4: código real, chamando infra real, mas sem credencial local pra confirmar entrega de verdade).
- [ ] **Gatilhos ainda não ligados** (periódicos, hoje cobertos por cron hardcoded que já funciona): `lead_inativo`, `contrato_vencendo`, `nps_recebido` — migrar esses pro motor novo é follow-up natural, não fiz agora pra não arriscar quebrar 4 crons que já funcionam sem necessidade.
- [ ] **Cadence Builder — NÃO INICIADO**: hoje ainda é array hardcoded de 13 toques em `sdr-inbound.ts`. É a segunda metade de F5 (motor de automação genérico ≠ motor de cadência de SDR) — registrado como pendência real, não fiz nesta sessão por escopo/tempo.
- [ ] UX (Cadence Builder visual, Automation Builder visual) — fica pra trilha de design + F7, mesmo critério das fases anteriores.

## Fase — F4 (histórico) — Commercial (Won gate + fix de MRR duplicado) — MAIOR RISCO FINANCEIRO DO PLANO

Tudo construído do ZERO nesta fase, a partir dos requisitos já documentados
— **nada copiado da branch `homolog`** (backup do Kauã, ver ADR-EXEC-008).

- [x] `lib/crm/contrato-duplicidade.ts`: helper `avaliarContratosAtivosDuplicados`
  (3 casos: upsell_confirmado/obsoleto_confirmado/ambiguo, desempate via
  tabela `assinaturas`) + `marcarContratoComoRenovado`.
- [x] **FIX DA CAUSA RAIZ** (`stripe-sync.ts`): `syncStripe()` agora checa
  `contratos.stripeSubscriptionId` ANTES de decidir criar vs. reaproveitar —
  fecha o bug confirmado (36 pares, R$17.449,30/mês, crescendo a cada venda
  desde 30/07). **Não testável E2E localmente** — `STRIPE_API_KEY` é
  deliberadamente vazia em dev (nunca cobrar cliente real, regra do
  `CLAUDE.md` do próprio repo). Validei a lógica por leitura cuidadosa +
  tracing manual do fluxo de variáveis, não por execução real.
- [x] Preventivo em `aceitar-proposta.ts`: aplica o helper de 3 casos antes
  de cada aceite de proposta — `obsoleto_confirmado` marca renovado
  automático, `ambiguo` grava em `audit_log` pra revisão humana, nunca
  decide sozinho.
- [x] **Relatório de diagnóstico SÓ LEITURA** (`db:relatorio-duplicidade-contratos`,
  saída salva em `docs/reconstruction/relatorios/2026-08-09-duplicidade-contratos.md`):
  57 grupos de contrato ativo duplicado no total (não só os 36 pares do bug
  de sync) — 68 upsell_confirmado, 4 obsoleto_confirmado, **58 ambíguo**.
  MRR em excesso confirmado: R$17.449,30. **NENHUMA correção aplicada** —
  checkpoint humano explícito, decisão fica com o Kauã.
- [x] **Gate de Won à prova de evidência** (`negocios.ts`, transição pra
  `status=ganho`): agora exige proposta aceita OU contrato já existente
  antes de permitir — fecha o loophole real onde um contrato "de fallback"
  era criado sem checar evidência nenhuma. Validado com dado real: dos 425
  negócios `ganho` históricos, 158 (37%) não têm evidência, mas 143 desses
  (90%) têm `zoho_id` (legado importado, o gate não retroage nesses) — só
  ~15 são recentes/sem zoho_id (~2-5/mês), tamanho real do problema que a
  terceira via de evidência (PBX/manual, ADR-EXEC-002, ainda pendente)
  precisa resolver. Dado registrado no ADR pra informar essa decisão futura.
- [x] `tsc` limpo em cada etapa, dev server saudável.
- [ ] Terceira via de evidência pra PBX/venda manual — ainda pendente,
  agora com dado real (ADR-EXEC-002 atualizado).
- [ ] UX (endpoint de ação explícito `/deals/:id/win` dedicado, em vez do
  gate embutido no PATCH genérico) — fica pra F7, o gate funciona hoje
  mesmo sem essa refatoração de API shape.

## Fase — F3 (histórico) — AI SDR Agent

- [x] **Bug do endpoint corrigido** (`lib/ai/sdr.ts`): chamava `api.openai.com` com nome de modelo Groq, sem `OPENAI_API_KEY` documentada. Agora chama `api.groq.com` de verdade, lê `GROQ_API_KEY`, com fallback em cascata de 3 modelos (mesmo padrão já validado no worker). Ver ADR-EXEC-009.
- [ ] **BLOQUEADO — precisa do Kauã**: `GROQ_API_KEY` no `.env` local está inválida/expirada (confirmado via curl direto, isolado do código). Não posso validar o AI SDR de ponta a ponta de verdade (conversação real) até isso ser renovado no console da Groq.
- [x] **Human Handoff formalizado**: `ai_sdr_contato_state.handoffStatus` novo (`ai_handling | human_required | human_assigned`), mantido em sincronia com `aiAtivo` (compat com código legado). Os 4 gatilhos existentes (keyword, valor_alto, tool-call, sem_retorno) agora setam `human_required`; a reativação leve (handoff reativável) volta pra `ai_handling`; **novo**: humano enviando mensagem manual pra contato em `human_required` transiciona pra `human_assigned` (`POST /whatsapp/send`) — fecha o ciclo AI_HANDLING→HUMAN_REQUIRED→HUMAN_ASSIGNED que antes só existia como binário (`aiAtivo` true/false).
- [x] `tsc` limpo, schema aplicado localmente, dev server saudável.
- [ ] **Próximo passo**: trigger por evento (LeadCreated) substituindo o sweep por cron — depende de um consumidor real pro `event_outbox` (F0 criou a tabela, ainda sem consumidor). Avaliar se compensa construir isso agora ou registrar como pendência de F5 (Automação), já que hoje o sweep por cron funciona (mesmo não sendo o ideal arquitetural).

## Fase — F2 (histórico, ver acima resumido) — Communication Intelligence (schema + dual-write nos canais principais)

- [x] Schema `communications` (unifica Call/WhatsApp/Email, ancorado em `pessoaId`) + `ai_analysis` (genérico, atachável a qualquer entidade) — commit `1d4a550`.
- [x] Dual-write ligado nos 3 canais, no ponto de maior volume real de cada um:
  - `processCallfaceCallEvent` (ligação) — reaproveita a idempotência real já existente + grava `ai_analysis` quando há resumo/transcrição. Commit `c41a6cd`.
  - Worker WhatsApp, path de mensagem recebida ao vivo (linha ~2237) — idempotência via `unique(canal, external_id)`.
  - Worker `processAndStoreEmails` (sync incremental/full da caixa, cobre entrada E saída) — idempotência via `providerMessageId`.
- [x] `tsc` limpo, dev server saudável depois de cada mudança.
- [x] **Fechados 09/08** (mesmo padrão mecânico aplicado em F1): envio manual de WhatsApp (`api-server/routes/whatsapp.ts` `/whatsapp/send`), cross-save de sessão WhatsApp (mesmo handler), envio de e-mail de sequência automatizada (`worker/index.ts`, job `check-sequences`) — todos os 3 pontos restantes de F2 agora com dual-write `communications`. Validado com dado real (script descartável, removido): 3 inserts mimetizando exatamente o padrão de cada ponto, todos linkados corretamente à `pessoa` via `leadIdLegado`, cleanup completo. **F2 agora está tecnicamente completo** (todos os pontos mapeados cobertos), só falta UX (timeline unificada, trilha de design + F7).
- [ ] Timeline unificada (UI) usando `communications` — ainda não, fica pra trilha de design + F7 (mesmo critério de F1: schema/dado primeiro, tela depois).

### F1 — considerado suficiente pra seguir pra F2
Backfill validado + dual-write nos pontos de maior valor real + observability de falha. Os pontos de menor tráfego não cobertos (contatos-unified, apollo, contatos.ts, fallback de propostas.ts) ficam registrados como pendência, não bloqueiam — mesmo critério de "incremental ≠ provisório mas não trava tudo antes de avançar" do plano.

### Riscos abertos (atualizados)
- Fix de MRR duplicado (F4): **achado novo relevante 09/08** — não está só no commit `2111650` (`wip/local-pre-sync`), está TAMBÉM completo e wired de verdade na branch `homolog` (backup do Kauã, ver ADR-EXEC-008) — `avaliarContratosAtivosDoLead`/`marcarContratoRenovado` chamados em `aceitar-proposta.ts` e `api-server/routes/contratos.ts`. **NÃO integrar essa branch agora** — Kauã vai revisar essa branch com calma depois, mas serve de referência pronta quando chegar F4.
- Terceira via de evidência de "Won" pra PBX (não passa por Stripe) — decisão ainda pendente, bloqueia fechamento pleno de F4.
- Backfill de `reunioes.status` (F0) rodado só no banco LOCAL — precisa reaplicar quando homolog/produção forem tocados.
- **Ambiente de homolog do CRM 2.0 ainda não provisionado** — decisão de infra (mesma EC2 com stack isolado vs. servidor novo) não urgente até 1º checkpoint real de promoção (provável fim de F1). NUNCA usar a branch git `homolog` existente como target (é backup do Kauã).
- Nada do trabalho de F0/F1 foi promovido pra homolog ou produção — tudo só local.

---

## F0 — histórico (detalhe completo, fase já encerrada localmente)

### Concluído
- [x] Ambiente local confirmado operacional (Postgres 5432 + Redis 6379 via Homebrew, `app/.env` com `DATABASE_URL` real).
- [x] Banco local confirmado com dado espelhado de produção (3.164 leads, 1.092 negócios, 312 contratos, 262 assinaturas, 159 reuniões, 4.707 status_changes).
- [x] Branch `feature/crm2-fase0-foundation` criada a partir de `main`.
- [x] **Verificação dos 2 achados técnicos pendentes (via query direta no banco local)**:
  - **MRR duplicado — CONFIRMADO, quantificado com precisão**: 36 pares de `contratos` com o mesmo `stripe_subscription_id`, todos `status='ativo'`, criados segundos/minutos um do outro (padrão: um com `negocio_id` preenchido — via `marcarPropostaAceita` — outro sem — via `syncStripe()`). **Excesso real: R$17.449,30/mês** (36 linhas duplicadas). Cresceu de R$12.092,70 (30/07, 16 pares) — confirma que o bug segue ativo a cada venda por checkout Stripe. Causa raiz já documentada em `blueprint-crm2-vs-current-state.md` (vault): `lib/integrations/stripe-sync.ts` (`syncStripe()`) nunca checa a tabela `contratos` por `stripeSubscriptionId` antes de inserir.
  - **Reuniões travadas em "agendada" — CONFIRMADO**: 53 reuniões (de 128 reuniões de julho, todas ainda `status='agendada'`) estão vinculadas a negócios que tiveram evento real `reuniao_realizada` em `status_changes` no mesmo mês. `reunioes.status` nunca é atualizado quando o negócio avança de estágio — bug de escrita real, explica a divergência de contagem de reunião entre relatórios (SDR/Growth/Marketing usam fontes diferentes, achado já registrado no `AUDITORIA.md` do repo).
  - **Assinaturas fora do espelho (~47, ~R$15,9k/mês, claim do ChatGPT) — NÃO REPRODUZIDO hoje**: 0 contratos ativos sem assinatura espelhada. Descartado como achado atual (provavelmente já corrigido antes, ou impreciso na origem).
  - **`organizacao_id` nullable em tabela financeira — confirmado no schema, mas 0 violação real hoje** (`contratos`/`assinaturas`/`faturas`/`mrr_movimentos` todos com 0 linha nula). Constraint `NOT NULL` pode ser adicionada sem backfill.

### Concluído (continuação)
- [x] **Schema hardening**: `organizacao_id NOT NULL` aplicado em `contratos`/`assinaturas`/`faturas`/`mrr_movimentos` (0 backfill necessário, confirmado 0 violação real). Aplicado via `drizzle-kit push --force` local (generate/migrate tradicional travou em prompt interativo — confirma na prática o achado de drift de migration já documentado; ver ADR-EXEC-004).
- [x] Tabelas novas criadas em `schema.ts` + aplicadas no banco local: `teams`, `audit_log`, `event_outbox` (todas com índices, `audit_log`/`event_outbox` cobrem os achados de segurança/observabilidade já confirmados).
- [x] **Achado arquitetural real, corrigido**: rotas Next.js "mortas em produção" (Traefik) na verdade respondiam de verdade em `next dev` local (sem Traefik, frontend chama `fetch("/api/...")` relativo, cai no Next). Corrigido com rewrite condicional (`NODE_ENV=development`) em `next.config.ts` espelhando exatamente a regra do Traefik — testado e confirmado (`/api/tarefas` via :3000 agora responde igual ao Hono direto; `/api/auth/session` continua no Next). Documentado como decisão em `ARCHITECTURE_DECISIONS.md`.
- [x] **101 arquivos de rotas Next.js duplicadas/mortas removidos** (`git rm`) — admin, apollo, automacoes, carteira, configuracoes, contatos, contatos-unified, contratos, custom-fields, email, empresas, enrichment, health, labels, leads, negocios, notas, notificacoes, nps, perfil, pipelines, propostas, reunioes, servicos-catalogo, usuarios, whatsapp. Mantidos (exceção real, confirmada no Traefik): auth, webhooks, financeiro, onboarding, campanhas, meta.
- [x] **IDOR corrigido**: `POST /leads/enrich-bulk` (`leads.ts`) — `ids` do client agora re-resolvidos contra `ctx.organizacaoId` antes de enfileirar.
- [x] **Bug de `reunioes.status` corrigido** (código + dado): `negocios.ts`, transição pra `reuniao_realizada` agora atualiza a reunião vinculada ainda `agendada` pra `realizada`. Backfill controlado rodado no banco LOCAL (mirror): 58 reuniões corrigidas, 0 travada restante confirmado por query.
- [x] `npx tsc --noEmit` limpo — só os 6 erros de baseline pré-existentes (não relacionados, 2 inclusive desapareceram junto com a remoção das rotas mortas que os continham).
- [x] Servidor de dev (app :3000 + api :3001, processo persistente da equipe desde 07/08) validado saudável depois de todas as mudanças — reiniciado só o `next dev` (necessário pra pegar o `next.config.ts` novo), api/worker não tocados.

### RBAC v2 e Data Governance (Tasks #5/#6 — CONCLUÍDAS, commit `cc68e19`)
- [x] `roles.ts`: papéis novos (director/coordinator/operations) sem quebrar as regras de acúmulo SDR/closer já existentes (decisão Scott 01/jul, preservada).
- [x] `teams` + `usuarios.teamId` (referência circular resolvida via `AnyPgColumn`).
- [x] `api-server/auth.ts`: helpers `orgScope`/`pushOwnershipScope` — infraestrutura reusável, adoção incremental rota a rota em F1+.
- [x] `admin.ts`: audit log real ligado em `POST /admin/org-switch` e `POST /admin/view-as` — fecha o achado de segurança confirmado (zero log de impersonation/org-switch).
- [x] ADR-EXEC-007 (Data Governance — tabela de autoridade de escrita por domínio) documentado em `ARCHITECTURE_DECISIONS.md`.

### Decisões arquiteturais (ver `ARCHITECTURE_DECISIONS.md` pra detalhe completo)
ADR-EXEC-001 (outbox sem broker novo) · 002 (evidência Won×PBX, pendente) · 003 (Schema V2 em paralelo) · 004 (verificação de achados via query real) · 005 (docs no repo) · 006 (dev/prod routing parity) · 007 (Data Governance) · 008 (branch `homolog` é backup do Kauã, não integrar).

Fim do histórico F0 — ver seção "Fase atual: F1" no topo deste arquivo para o estado real e próximo passo.

## Achado — Pipeline Comercial (Command Center) subconta "Negociação" (10/08)

Kauã notou "tem muito mais em negociação" do que o card mostra (21 negócios/R$1.939). Confirmado com dado real: **não é bug de zerar valor** — é o bucket "Negociação" só contar `negocios.status = 'negociacao_iniciada'` (21 no banco, 71% com proposta expirada). O volume real que ele sente existe está em outros status hoje fora de qualquer bucket: `ativo` (68 negócios, R$75.187) + `proposta_apresentada` (43, R$74.670).

**Proposta do Kauã pra tratar depois** (não implementado agora, ele mesmo pediu "depois"):
1. Revisar o mapeamento de status→bucket do Pipeline Comercial (`getPipelineComercial`, `lib/analytics/command-center.ts`) pra cobrir os status reais de "em negociação", não só o literal.
2. Quando `propostas.dataValidade` vence e o status vira `expirada`, disparar automaticamente tarefa + notificação pro responsável (hoje não existe esse gatilho — nem no Automation Builder nem em job agendado). O valor do negócio deve continuar sendo mostrado normalmente (não depende da proposta vencer).

Ambos ficam registrados aqui como próximo passo, fora do escopo da tela de Atendimento em andamento.

## V1 Frontend — Central de Atendimento (Figma node 53:518, 10/08)

Segunda tela do CRM 2.0 sobre o mesmo App Shell (`(crm2)/atendimento`). Análise prévia (padrão do brief original) cruzou o Figma com o Domain Model antes de implementar — achados e decisões do Kauã:

**Achado real, não previsto**: `communications` (tabela unificadora F2) está com 0 linhas no ambiente local (dual-write certo desde F2, mas nunca houve backfill do histórico) e o vínculo `contatos.leadId` cobre só **11 de 957 contatos** (~1%). Ativar leitura real de `communications` pra montar a aba "Todas" produziria um inbox quase vazio, escondendo dado real que existe nas tabelas antigas. Decisão (Kauã optou por "ativar communications", mas dado real bloqueou): seguido pragmático — "Todas" mescla as 3 fontes reais na leitura (`contatos`=WhatsApp, `emails`=E-mail por thread, `ligacoes`=Ligação), sem depender de `communications`/`pessoas` ainda. Gap de vínculo contato↔lead registrado como projeto de dados separado, fora do escopo desta tela.

**Decisões do Kauã aplicadas**:
- RBAC: `(crm2)` liberado pra qualquer papel autenticado (fase de construção, decisão explícita — antes só admin/gerente/super_admin).
- "Resolver": mantido — fecha gap real (não existia status aberta/resolvida em `contatos`). Campo novo `contatos.status` (default `aberta`).
- "ALTA" (prioridade): removido — sem fonte real, seria inventar.
- "Cliente/Lead": mantido, real (`clientes.leadIdLegado` — existe cliente convertido daquele lead ou não).
- "Negócio Ativo" fixo: virou cascata real por prioridade — Negócio Ativo (status não-fechado) → Proposta Enviada (`propostas.status='enviada'`) → Reunião Agendada (`reunioes` futura) → CTA "Agendar Reunião" (cria reunião real via `/reunioes`). Sem inventar % de conversão (mesmo princípio do achado dos 231% no Command Center).
- "Callface AI Copilot" (sugestão de resposta): **não implementado nesta rodada** — decisão do Kauã, geração de texto real precisa de LLM (Groq), e ele quer tratar isso junto de um fluxo maior (dado de ligação/mensagem/e-mail alimentando IA) depois.
- Handoff entre vendedores esclarecido: `responsavelId` (dono no CRM) é independente de `sessaoId` (número de WhatsApp de origem) — trocar responsável NÃO muda o número de envio; quem responde sempre envia pelo próprio WhatsApp (`/whatsapp/send` já resolve a sessão pelo usuário que está mandando, não pela sessão salva no contato). Confirmado no código existente, nenhuma mudança necessária; só exposto na UI (`via WhatsApp de X`, usando `sessaoUsuarioNome` que já vinha da API).

**Implementado**: `GET/POST /api/atendimento/*` (conversas mescladas, contexto em cascata, resolver), `GET /api/ligacoes` sem params vira listagem geral (antes só por lead/negócio), 8 componentes novos (`components/crm2/atendimento/*`) — lista/thread WhatsApp real (envio funcional)/thread E-mail real (resposta funcional, exige `contaId` do e-mail original)/detalhe de Ligação (resumo IA + transcrição + áudio, tudo real)/painel de contexto/modais de Atribuir e Nova Mensagem.

**Bug de layout achado pelo Kauã e corrigido**: a tela crescia sem limite (e-mail longo empurrava a página inteira) em vez de rolar internamente — causa raiz era a cadeia de `height` quebrada no wrapper do App Shell (`(crm2)/layout.tsx`), que fazia `h-full` não resolver contra nada definido. Corrigido com `h-full min-h-0` no wrapper — não afeta o Dashboard (que depende do scroll normal da página pra conteúdo longo).

**Validado end-to-end com dado real via Playwright**: WhatsApp (thread real com histórico + envio), E-mail (thread real), Ligação (resumo/transcrição/áudio reais de uma chamada de verdade), painel de contexto mostrando negócio ativo real com valor e etapa, estado honesto "sem lead vinculado" quando não há dado pra mostrar.

**Não implementado, registrado como gap consciente**: Insight/Copilot de IA (deferido pelo Kauã); "Atribuir" pra e-mail/ligação (só WhatsApp tem esse conceito hoje); backfill de `communications`/correção do vínculo contato↔lead (projeto de dados separado).

## Correções de fidelidade/segurança na Central de Atendimento (mesmo dia, feedback direto do Kauã)

- [x] **Vazamento de privacidade entre vendedores (achado crítico do Kauã, prioridade máxima)**: o filtro "Todos" (e o "todos" de e-mail/ligação) deixava admin/super_admin ver WhatsApp/e-mail/ligação de QUALQUER vendedor. Corrigido: `buscarWhatsapp`/`buscarEmail`/`buscarLigacao` agora escopam por `responsavelId`/`usuarioId`/conta própria pra TODOS os papéis, sem exceção — só "Atribuir" muda quem tem acesso a uma conversa. Supervisão de verdade (ver como outro vendedor) fica como feature separada e explícita, não um toggle passivo. Validado com dado real: "todos" antes retornava 3 donos distintos, depois só o do usuário logado.
- [x] **"Resolver" removido por completo** (Kauã mudou de ideia: "não faz sentido, atribuir sim") — botão, endpoint `POST /atendimento/contatos/:id/resolver`, coluna `contatos.status` (dropada do banco), filtro por status. Só "Atribuir" ficou.
- [x] **"Todas" virou fila de pendência, não histórico**: filtra pra só mostrar WhatsApp/E-mail não lidos (abrir já marca como lido — WhatsApp já fazia isso, e-mail passou a fazer via `PATCH /email/:id {lido:true}` ao abrir a thread). Ligação fica sempre visível em "Todas" (não tem sinal de "não lida" pra aplicar o mesmo filtro sem inventar um).
- [x] **Empresa/Negócio/Proposta no painel direito agora são clicáveis** (iam pra lugar nenhum antes) — linkam pra `/empresas/:id`, `/negocios/:id`, `/propostas/:id` reais.
- [x] **Aba Ligar**: histórico de ligações real (igual antes), mas agora sem seleção mostra um **discador real** (teclado numérico + busca de contato no painel direito, com badge real "Negociação"/"Proposta" quando aplicável) em vez do vazio genérico — usa o mesmo mecanismo já existente no resto do CRM (`callfaceCallUrl`, deep link pro webphone da Callface; não existe endpoint de originar chamada por API, confirmado no código).
- [x] **Detalhe de ligação portado do componente real de produção** (`LigacaoModal` em `components/crm/LigacoesSection.tsx`) em vez da versão simplificada inicial — Chance de Fechar (com sparkline), Urgência, Contato identificado pela IA, aviso de reunião combinada, abas Resumo/Transcrição, Interesses/Objeções/Palavras-chave/Próximos passos (tudo via `lib/utils/parse-resumo-callface.ts`, parser real do markdown que a Callface manda — nenhum desses campos é coluna do banco, documentado no próprio parser), link "Abrir na Callface".
- [x] **Paridade de chat com o legado**: tique de status (pending/sent/delivered/read/failed, `StatusIcon`), menu de anexo funcional (Foto/Vídeo, Documento, Localização, Contato — mesmos 4 do Figma/legado, tudo enviando de verdade via `/whatsapp/send`), ações no hover (Responder/Reagir/Apagar via `/whatsapp/actions`, mesmo endpoint do legado), nome de quem enviou por mensagem quando o time inteiro atende o mesmo contato.
- [x] Validado de novo com dado real via Playwright + curl após cada correção.

## V1 Frontend — Calendário (Figma nós 79:*, 10/08)

Terceira tela do CRM 2.0 sobre o mesmo App Shell (`(crm2)/calendario` + `/calendario/configuracoes`). Análise prévia encontrou um fato importante: **a integração com Outlook não estava quebrada** — foi corrigida em julho (refresh token real, escopo `Calendars.ReadWrite` já concedido) e funciona em produção hoje. O que nunca existiu foi a TELA de calendário visual — `/agenda` (legado) era só a tela de configuração de disponibilidade da closer.

**Correção importante de raciocínio, motivada pelo próprio Kauã**: eu tinha avaliado que a visão "Equipe" não poderia mostrar disponibilidade real cruzada entre vendedores (achando que precisaria de consentimento de admin da Microsoft). O Kauã apontou o raciocínio certo: como cada vendedor conecta a própria conta (token individual já armazenado por pessoa em `emailContas`), o backend pode consultar a agenda de cada um com o token dela mesma e agregar tudo — sem precisar de nenhuma permissão cross-user. Implementado assim: `GET /calendario/equipe` faz um loop por closer conectado usando o próprio token de cada um (`getBusyTimes`, mesmo padrão já usado em `/agenda/closers/:id/slots-reais`) + reuniões reais do CRM pra quem ainda não conectou.

**Centralização de notas** (pedido do Kauã: "toda nota, independente de onde foi colocada, precisa ser centralizada"): a tabela `notas` já centralizava lead/negócio/empresa — estendida com `reuniaoId` e `clienteId` em vez de criar uma tabela nova. O campo "Observações" do evento usa essa mesma tabela.

**Implementado**:
- `api-server/routes/calendario.ts` (novo): `GET /calendario/eventos`, `GET /calendario/resumo` (próximos/atrasados/**conflitos reais** — detecção de overlap de horário via SQL, nunca existia antes), `GET /calendario/equipe` (agregação real Outlook+CRM).
- `POST /reunioes` (rota genérica) passou a criar evento real no Outlook (Teams + convite pro cliente) quando o responsável tem conta Microsoft conectada — antes só 2 fluxos bem específicos faziam isso (converter lead em oportunidade, auto-agendamento da IA). Fallback honesto e explícito quando não tem conta conectada (mensagem exata pedida pelo Kauã: "criado no CRM, mas não gerou link nem foi enviado pro cliente — conecte seu e-mail pra ter a experiência completa").
- 3 views reais (Mês/Semana/Dia) + Equipe, sem lib de calendário externa (Date nativo, mesmo princípio do legado).
- Drawer de detalhe com notas centralizadas + ações reais (marcar realizado/no-show/cancelar, cancela no Outlook também).
- Modal Novo Evento com detecção de conflito client-side (contra os eventos já carregados do dia) + busca de lead real.
- Reskin de `/agenda` → `/calendario/configuracoes` (mesma lógica real de disponibilidade/pausa/bloqueios, só tema claro).
- `.env.example` documentado com `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID` (gap de documentação real encontrado, não existia antes).

**Não implementado / gap consciente**: campo "SP" (pontos de gamificação) do Figma — sem fonte real no banco, omitido. Recorrência de evento — schema/UI não têm esse conceito ainda (evento único por criação), fica pra rodada futura se pedido. Título real de evento Outlook-only (pessoal, nunca passou pelo CRM) na visão Equipe aparece só como bloco "Ocupado" cinza (a função `getBusyTimes` usada não seleciona o campo `subject` do Graph — decisão de não tocar numa função já testada/usada em produção pra evitar risco de regressão; se quiser título completo também, é extensão pequena e segura).

## Correções pós-validação do Calendário (mesmo dia, feedback direto do Kauã)

- [x] **Bloqueio de agenda agora cria evento real no Outlook**: `POST /agenda/bloqueios` cria um evento "ocupado" (sem link do Teams — novo parâmetro `semTeams` em `createOutlookEvent`, usa `showAs: "busy"` em vez de reunião online) na conta Microsoft do closer, se conectada; `DELETE /agenda/bloqueios/:id` cancela o evento correspondente antes de apagar. Best-effort (nunca bloqueia o fluxo do CRM se o Outlook falhar), mesmo padrão já usado no resto do sistema. Coluna nova `closer_bloqueios.outlook_event_id`.
- [x] **Almoço e bloqueios agora aparecem visualmente no grid** (Kauã: "o almoço não aparece no calendário e nem bloqueia pra criar agenda") — novo endpoint `GET /calendario/disponibilidade` (horário de trabalho + pausa de almoço + bloqueios futuros, escopado ao responsável) consumido pelas views Dia/Semana (`GridDia.tsx`/`GridSemana.tsx`) como faixa hachurada na timeline. Visão Mês não mostra (não tem timeline de hora) e visão Equipe não mostra (escopo separado — cada membro tem sua própria disponibilidade, feature futura se pedido).
- [x] **Aviso de conflito no modal Novo Evento**: além do conflito contra eventos já agendados (já existia), agora avisa também se o horário escolhido cai na pausa de almoço ou num bloqueio ativo — mesmo padrão não-bloqueante ("pode criar mesmo assim, mas é bom conferir"), sem impedir a criação.
- [x] **Visão Equipe não ficava responsiva com muitos membros** (Kauã, testando com 11 closers reais) — grid usava `1fr` puro por coluna, espremendo os cards até ficar ilegível. Corrigido: colunas com `minmax(140px, 1fr)` (nunca espremem além do legível) e o cabeçalho passou a rolar dentro do MESMO container do corpo (sticky), corrigindo também um desalinhamento latente entre cabeçalho e corpo ao rolar horizontalmente (antes eram dois scrolls independentes).
- [x] **Botão "Agendar Reunião" de Atendimento agora usa o mesmo modal rico do Calendário** (Kauã: "pode ter como base esse modal de reunião") — `ContextPanel.tsx` (Atendimento) trocou seu modal inline simplificado pelo `Cf2NovoEventoModal` do Calendário, pré-preenchido com o lead/empresa/negócio já conhecidos da conversa (`leadPreSelecionado`) e título sugerido. Ganha de graça: geração real de link do Teams, convite pro cliente, e os mesmos avisos de conflito.
- Validado com Playwright: faixa de almoço renderizando corretamente (visível quando não há evento cobrindo o horário), aviso de conflito de almoço aparecendo no modal ao escolher 12:00-12:30, scroll da visão Equipe com cabeçalho e corpo permanecendo alinhados até a última coluna. `tsc --noEmit` limpo (só os 5 erros pré-existentes do `(crm)` legado, não tocados). Reuso do modal em Atendimento validado por tipo/wiring — sem conversa de teste com lead vinculado no seed atual pra clicar o botão end-to-end (gap de dado de teste, não de código).

## Carol — Sales Copilot (widget flutuante, V1 heurístico sem IA, 10/08)

Quarto módulo do CRM 2.0: motor de prioridade heurístico (`lib/carol/priority-engine.ts`) + 8 endpoints (`api-server/routes/carol.ts`, todos escopados a `ctx.userId` — Carol é pessoal, nunca visão de gestão) + widget flutuante (`components/crm2/carol/Widget.tsx`, montado no App Shell inteiro via `(crm2)/layout.tsx`).

**Regra de ouro do motor (documentada no topo do arquivo)**: nunca inventar. Cada `PrioridadeItem` carrega `motivos: string[]` reais e reproduzíveis (ex: "Última interação há 4 dias", "R$ 18.900 de potencial") — score é combinação explícita de sinais reais (tempo sem interação, valor, proximidade de reunião, atraso), pesos documentados no código, nada oculto. Mesma disciplina do Insight Engine do Command Center — troca por LLM depois sem mudar a interface.

**Correção de segunda rodada, motivada pelo próprio Kauã ("a Carol não ficou ruim mas... ela precisa ser uma personagem")**: a V1 inicial usava pills horizontais + cards de dados brutos (estilo dashboard). Kauã pediu explicitamente formato de **chat real**: Carol "fala" em bolha de mensagem com tom amigável, botões empilhados um embaixo do outro (não lado a lado), clicar em um botão gera uma resposta em formato de mensagem (não só uma lista fria de dados) e depois volta pros botões oferecendo ajudar em algo mais — exatamente o padrão de widget de chat (Intercom/Drift), não um painel de BI.

**Implementado na correção**:
- 8 ilustrações oficiais da Carol baixadas do Figma (node 98:4, "Character Sheet") e commitadas em `public/carol/*.png` — Padrão, Venda Fechada, Dica, Alerta, Pensando, Meta Batida, Aprovado, Até logo. Pose varia de verdade conforme o conteúdo real da resposta (ex: lista com item `urgencia:"alta"` → pose Alerta; lista vazia → pose Aprovado; fechou negócio crescendo vs mês anterior → Meta Batida), nunca uma pose fixa.
- Feed de mensagens acumulado (`CarolMensagem[]`) que cresce a cada interação, com a mensagem de abertura variando pela rota atual (consciência contextual: em `/atendimento` ela já oferece "quer que eu te mostre quem precisa de retorno hoje?", em `/pipeline` oferece negócios de atenção, etc.) — mesmo texto processado apenas na abertura do painel, não sobrescreve a conversa em andamento.
- Cada resposta é uma frase real construída a partir do dado (`construirResposta`), com os itens/estatísticas reais anexados abaixo da bolha como mini-cards — nunca statement genérico tipo "aqui está a lista".
- Indicador "Deixa eu ver aqui..." (pose Pensando) enquanto a resposta carrega.
- Bug real encontrado e corrigido durante a validação: a frase de performance dizia "saindo na frente do mês passado" mesmo quando o fechado do mês era R$ 0 (comparação `>=` sem checar se havia algo fechado) — corrigido pra só comemorar quando `fechadoMes.receita > 0`.
- Bug real encontrado e corrigido (não documentado até agora, achado nesta mesma sessão): `/carol/performance` retorna os campos reais de `getPipelineAtual`/`getFechadoPeriodo` (`negociosAbertos`/`ganhos`), mas o frontend original assumia nomes inventados (`quantidade`) — aparecia "undefined negócio(s)" na tela. Corrigido nos dois lados (tipo + JSX).

**Não implementado / gap consciente**: a "piada do Scott ser um gato" mencionada no brief original não foi implementada — o texto exato da piada não estava mais disponível pra reconstruir sem inventar; fica pendente de nova instrução literal do Kauã se ele quiser. Geração de resposta por LLM continua fora de escopo (mesma decisão já tomada pra Atendimento).

**Validado com Playwright**: abrir o painel mostra saudação contextual real; clicar em cada uma das 7 ações populares uma resposta real (ex: reunião real "nao sei ein" aparecendo dentro da bolha da Carol); `tsc --noEmit` limpo. Nota: durante a validação a sessão de browser automatizada apresentou instabilidade de navegação (cliques antigos "vazando" pra páginas diferentes após uma sessão muito longa de testes) — diagnosticado como artefato do ambiente de teste (Playwright + dev server sobrecarregado), não bug da aplicação; confirmado repetindo a interação com refs frescos, que funcionou corretamente todas as vezes.

## Contatos & Empresas (V1 lista, 5 nós do Figma, 10/08)

Quinto módulo do CRM 2.0. Análise prévia (mesmo padrão de sempre) cruzou os 5 designs do Figma com o domain model real antes de implementar — investigação dedicada (relatório completo salvo na sessão) encontrou vários achados importantes:

**"Pessoa" não é uma tabela única**: cada linha vem de `leads` com `tipo IN ('contato','lead','cliente')` — existe uma tabela `pessoas` (Schema V2, dual-write best-effort ~99% sincronizado) mas a fonte de verdade em produção até a F8 continua sendo `leads` (mesma leitura que a página legada `/contatos` já fazia). Implementado lendo de `leads` direto, sem inventar uma segunda fonte.

**"Relacionamento" (Cliente/Qualificado/Lead) não existe como campo**: regra aplicada (documentada no código, `api-server/routes/contatos-crm2.ts`): Cliente se a empresa tem qualquer pessoa com `tipo='cliente'`; Qualificado se tem negócio ativo (fora de ganho/perdido) vinculado; Lead nos demais casos. Essa é a melhor aproximação real disponível hoje (a única fonte real de "Qualificado" no sistema inteiro é uma coluna derivada do board SDR) — **fica marcado para o Kauã confirmar ou ajustar a regra**, não foi inventado do nada, mas também não é um campo explícito.

**Agregação de negócios por empresa não existia em nenhuma rota**: achado real — 23% dos negócios têm `empresaId` nulo mas 100% têm `leadId` preenchido. Corrigido somando `negocios.empresaId` OU (quando nulo) o `empresaId` do lead vinculado via `negocios.leadId`, sem duplicar.

**MRR/Meta/Pipeline removidos da tela** — 2 dos 5 designs do Figma traziam a hero-metrics-bar do Command Center (MRR Atual/Meta do Mês/Pipeline Ativo), que o próprio Kauã apontou como "coisas nada a ver pra essa seção". Substituído pelo KPI strip real e relevante ao domínio (Total de Pessoas/Leads/Contatos/Clientes/Empresas), presente nos outros 3 designs — contagens 100% reais (3164/1030/1894/240/1559 hoje).

**Colisão de rota resolvida**: `/contatos` já existia no `(crm)` legado (lista + `/contatos/[id]`). Como o próprio Sidebar novo já apontava `/contatos` direto pro CRM 2.0 desde 09/08 ("pra quem já tem tela nova, aponta direto"), a página de LISTA legada foi movida pra `/contatos-legado` (preservada, reversível via git, adicionada na seção Legado do menu) — a página de DETALHE `/contatos/[id]` não foi tocada (usada por vários pontos do CRM antigo: dashboard, CommandPalette, sidebar legado).

**Implementado**: `api-server/routes/contatos-crm2.ts` (3 endpoints: `/kpis`, `/empresas`, `/pessoas`, todos com agregação real via SQL — pessoas por empresa, negócios com fallback de empresaId, última atividade/interação real via `MAX(atividades.created_at)`, próxima atividade via `MIN(tarefas.data_vencimento)` pendente); `components/crm2/contatos/Workspace.tsx` (abas Pessoas/Empresas, busca, filtro por tipo, paginação, tabelas reais).

**Não implementado ainda / próximos passos**: Quick View lateral (portar `LeadDrawer.tsx` legado pro visual `--cf2-*`), modal "+ Nova Pessoa" com criar-empresa-inline, seleção múltipla com barra de ações em massa (o legado já tem esse padrão em `/contatos-legado`, é portar as ações certas). Linhas hoje linkam pra `/empresas/:id` (empresa, real) e `/contatos-legado/:id` (pessoa, real, mas ainda no tema antigo) até o Quick View existir.

**Validado com Playwright**: KPIs reais renderizando, troca de aba Pessoas/Empresas funcional, busca real filtrando (27 resultados pra "Callface"), badges de relacionamento corretos (Cliente/Qualificado/Lead) com dado de produção. `tsc --noEmit` limpo.

**Validado com Playwright**: Mês (grid real, hoje destacado), Equipe (11 membros reais, status "Outlook conectado"/"Só CRM" correto por pessoa, zero erro de console), typecheck limpo em todas as etapas.

---

## EXECUÇÃO AUTÔNOMA DE PONTA A PONTA (mandato do Kauã, 10/08, sessão longa)

Kauã saiu pra dormir e pediu execução 100% autônoma até o CRM 2.0 virar "produto navegável de ponta a ponta", sem esperar aprovação a cada tela. Checkpoints de negócio (não técnicos) ficam em `docs/reconstruction/crm2-decisoes-pendentes.md`. Daqui pra baixo, tudo dessa execução contínua.

### Bug real de arquitetura encontrado e corrigido: tokens `--cf2-*` não chegavam em portais

Achado testando o board de Qualificação: qualquer `createPortal(..., document.body)` (menu de ações do card, `AgendarReuniaoModal`) renderizava **quase invisível** — fundo/texto sem contraste. Causa: `[data-cf2-theme="light"]` só existia numa `<div>` interna do `(crm2)/layout.tsx`; um portal em `document.body` é IRMÃO dessa div, não descendente, então as variáveis CSS não cascateavam. Corrigido com `components/crm2/ThemeRoot.tsx` — componente client que espelha o atributo em `document.documentElement` (`<html>`) enquanto o App Shell novo está montado, e remove no unmount (não vaza pro `(crm)` legado). Esse bug provavelmente afetava (ou afetaria) qualquer modal futuro que use portal — resolvido na raiz, não caso a caso.

### Command K pertence ao App Shell novo

`components/crm2/CommandPalette.tsx` (novo) — tema `--cf2-*`, busca paralela real em 5 entidades (pessoas via `contatos-unified`, empresas, negócios, propostas, atividades/tarefas), ações rápidas (Criar Negócio) + navegação real do menu. `Providers.tsx` ganhou `variant: "legacy" | "cf2"` — evita também o `<Toaster theme="dark">` vazar pro shell novo (achado extra durante a correção: os toasts de sucesso/erro apareciam escuros em tela clara). `tarefas.ts` ganhou `?search=` (respeitando o mesmo escopo de privacidade pessoal/gestão já existente).

### Qualificação — board completo migrado pro cf2, fluxo validado ponta a ponta com dado real

Auditoria prévia (ver seção detalhada mais abaixo se precisar reconstruir contexto) confirmou TUDO que o fluxo legado faz de verdade antes de portar — exatamente como o Kauã pediu ("não simplesmente redesenhe o modal, faça o fluxo funcionar"):

- `components/crm2/qualificacao/Workspace.tsx`: board Kanban com os estágios reais (`pending/contacted/qualifying` + colunas espelho do closer `m_qualified/m_reuniao/m_convertido` + `disqualified` + estagnação), drag-and-drop real, menu de ações real, exportação CSV pro discador (mesma lógica).
- `components/crm2/qualificacao/AgendarReuniaoModal.tsx`: reskin completo do modal legado (`AgendarReuniaoModal.tsx`) — 100% da lógica preservada (fila de rodízio real, slots reais CRM+Outlook, payload idêntico), só o visual mudou.
- Drawers de Lead/Empresa/Negócio (`LeadDrawer`/`EmpresaDrawer`/`NegocioDrawer`) **continuam sendo os legados** (funcionais, tema escuro) — reskin deles é o escopo de Quick View (tasks já rastreadas), não duplicado aqui.
- Rota `/pre-vendas` — mesma colisão de `/contatos`: lista legada movida pra `/pre-vendas-legado` (preservada, no menu Legado), Sidebar/CommandPalette já apontavam pra `/pre-vendas` direto (intenção documentada desde 09/08).

**Validado end-to-end com dado real (não só visualmente)**: qualifiquei um lead de verdade (via UI, botão "Qualificar (cria oportunidade)" → modal → "Qualificar e agendar") e confirmei no banco: negócio criado (`status: reuniao_agendada`, responsável = closer da fila de rodízio real), reunião criada (data/hora/tipo/duração corretos), atividade criada (`tipo: reuniao`, descrição correta) — e confirmei via `GET /calendario/eventos?responsavelId=...` que essa reunião **aparece de fato no Calendário novo**, com todos os campos batendo (leadId/negocioId/responsavelId/título/empresa). Fechamento real do loop Qualificação → Reunião → Calendário.

**Gap consciente**: `onQualificarSemAgendar` ("Qualificar sem agendar") não foi clicado nesse teste (caminho já coberto pela lib compartilhada, mesma função `converterLeadEmOportunidade`) — comportamento idêntico ao "com reunião" exceto não criar `reunioes`/`atividades`, já confirmado por leitura de código na auditoria, não repeti o teste de UI por já ser a mesma função testada.

### Cadências — decisão entre dois motores + UI real no Atendimento

Antes de construir qualquer tela, precisava resolver uma ambiguidade real: existem DOIS sistemas de cadência no código, e usar o errado seria implementar contra algo que não roda em produção.

- **`lib/cadencia/cadence-engine.ts`** — motor genérico completo (steps `wait`/`action`, branches por condição, adapters, retry/backoff, `iniciarCadencia`/`avancarEnrollment`/`sweepCadenciasDevidas`). O próprio cabeçalho do arquivo documenta que ele **não está ligado a nenhum fluxo real** — migrar o AI SDR ou o SDR inbound pra rodar em cima dele é decisão que merece validação antes de cortar o que já funciona (ADR-EXEC-013), não decisão unilateral.
- **`lib/cadencia/sdr-inbound.ts` + `api-server/routes/cadencia.ts`** — sistema REAL em produção: 13 toques com copy própria da Callface (`{primeiro_nome}`/`{empresa}`/`{seu_nome}`), editável antes de enviar, envio de verdade por WhatsApp/email com sessão do usuário, log de execução por `[leadId, ordem]`.

Decisão: portar a UI que já opera o sistema real (`components/crm/CadenciaPanel.tsx`, hoje só acessível dentro do drawer legado), não construir uma tela nova contra o motor genérico não-usado. Fazer o contrário seria "inventar uma segunda engine" na prática — trocar o comportamento real de produção por algo nunca testado, exatamente o que o Kauã pediu pra não fazer.

- `components/crm2/cadencia/CadenciaPanel.tsx` (novo): porta 1:1 da lógica do painel legado — `GET /api/cadencia/:leadId`, accordion por toque (ícone/cor por canal), editar conteúdo/assunto antes de enviar, `POST /enviar` (com erro tratado pra `NO_SESSION`/`NO_EMAIL`), `POST /ligacao` pra registrar ligação, aviso de sessão WhatsApp ausente, histórico de quando/quem enviou. Só o visual foi convertido pros tokens `--cf2-*`.
- Integrado no `Cf2ContextPanel` do Atendimento (`components/crm2/atendimento/ContextPanel.tsx`) como seção colapsável "CADÊNCIAS", visível só quando a conversa tem `leadId` — dá pra ver e agir na régua de 13 toques sem sair da conversa, exatamente o "não perder contexto ao pular de tela" pedido pelo Kauã pro Atendimento.
- Validado por leitura/contrato (payloads e query keys idênticos aos do painel legado já testado em produção) + `tsc --noEmit` limpo nos dois arquivos — não repeti teste de envio real (dispararia mensagem real de WhatsApp/email pra um lead real, fora do escopo de "não publicar em prod" — testar isso a fundo é o mesmo risco que enviar cadência real sem necessidade).

### Automações — tela lista + builder de fluxo no cf2

Motor real confirmado (`lib/crm/automacao-engine.ts`: 7 gatilhos × 6 ações, 1 condição + 1 ação por regra — não um grafo arbitrário). Construí `components/crm2/automacoes/Workspace.tsx`: lista com histórico de execução por regra (`GET /automacoes/:id/execucoes`, endpoint novo) e builder em formato de fluxo-cards (Gatilho→Condição→Ação, conectores verticais) inspirado na referência visual (Opero) que o Kauã mandou, mas simplificado pro que o motor de fato suporta. Reaproveitados os label maps reais (`GATILHO_OPTIONS`/`ACAO_OPTIONS`/`OPERADOR_OPTIONS`) já validados na tela legada. Rota antiga movida pra `/automacoes-legado`, mesmo padrão de strangler já usado em `/contatos` e `/pre-vendas`. 3 automações reais criadas via API pra revisão do Kauã. Validado com Playwright: criação, listagem, toggle ativo/inativo — tudo com dado real.

## Propostas — fluxo comercial condicional + página pública (mandato detalhado do Kauã, 10/08)

Kauã interrompeu a execução autônoma pra dar direção específica em Propostas — pediu processo completo: analisar → cruzar domain model/legado → identificar inconsistências → definir fluxo correto → implementar → testar ponta a ponta, evoluindo o Figma (4 telas) como referência visual, não como spec fixa.

### Achados da investigação (antes de qualquer código)

- `propostas`/`propostaItens` já reais e completos. Catálogo real (`servicos_catalogo`, 218 linhas migradas do Zoho) tem só 8 itens ativos hoje, todos Callface AI — **PABX não tinha nenhum item ativo** (todo plano PABX real existe mas estava marcado inativo). **White Label não existe em nenhum lugar do código/dados** — não foi inventada categoria pra ele.
- Aceite/pagamento via Stripe já funcionava ponta a ponta (checkout → webhook → `marcarPropostaAceita` → contrato → negócio ganho → Commercial Evidence), mas conflava "proposta aceita" com "negócio ganho" — não dava pra separar "cliente confirmou intenção" de "Won de verdade" (pedido explícito do Kauã pro fluxo público: aceite é um passo, pagamento/assinatura é outro).
- **Bug real encontrado**: todo ponto de criação de contrato no sistema (4 call sites) forçava `produto: "ai"` hardcoded, mesmo em venda PABX — corrigido no caminho novo via `determinarProdutoProposta()`.
- Commercial Evidence (ADR-EXEC-012) e Event Outbox (ADR-EXEC-016) já são arquitetura real e viva — estendidos em vez de duplicados.

### Modelo novo (extensível, nada hardcoded na UI)

- `servicosCatalogo.categoria` + `requerContrato` (boolean explícito no catálogo — não inferido do nome).
- `propostas.proximoPasso` ("pagamento"|"contrato", derivado dos itens no envio via `lib/crm/proposta-fluxo.ts::determinarProximoPasso`), `visualizacoes`/`primeiraVisualizacaoEm`/`ultimaVisualizacaoEm`, `clienteRespondeuEm` (distinto de "aceita" no status — aceite comercial ≠ Won), `motivoRecusa`.
- `contratos.assinaturaStatus`/`assinadoNome`/`assinadoIp`/`assinadoEm` — aceite eletrônico simples, não assinatura qualificada (ver decisão pendente #2 em `crm2-decisoes-pendentes.md`).
- `event_outbox` ganhou `ProposalSent|ProposalViewed|ProposalAccepted|ProposalRejected` + `aggregateType: "proposta"`, consumidos pelo mesmo audit-log automático já provado em Lead/Deal.
- `lib/crm/notificar-proposta.ts` segue o padrão real de `notificarNegocioGanho` — notifica o responsável do negócio (não gestão inteira, já que aceite ≠ Won ainda).
- `lib/crm/proposta-publica.ts` — todas as ações do cliente sem conta no CRM (visualizar/aceitar/recusar/pedir ajuste/assinar), mesmo modelo de confiança (UUID não-enumerável) que o PDF/checkout já usavam.

### Fluxo A (Callface AI, pagamento) vs Fluxo B (PABX, contrato)

`enviarPropostaComCheckout` agora bifurca em `determinarProximoPasso`: caminho "pagamento" mantém geração de checkout Stripe como antes; caminho "contrato" (novo, `enviarPropostaSemCheckout`) não toca Stripe, só ativa a proposta e manda o link público. Aceite público (`aceitarPropostaPublica`) bifurca de novo: pagamento → só registra intenção e devolve o `checkoutUrl` (Won continua só vindo do webhook, evidência real, ADR-EXEC-007 intacto); contrato → cria `contratos` em `pendente_assinatura` sem marcar Won ainda. Assinatura (`assinarContratoPublico`, aceite eletrônico simples) é o momento real de Won pro caminho contrato: marca negócio ganho, registra evidência `signed_contract`, notifica, e cria uma **tarefa real de cobrança manual** (sem billing automático pra PABX — gap real, não fingido, ver decisão pendente #3).

### Página pública nova (`/p/[id]`)

Substituiu o `route.ts` antigo (redirect puro pro Stripe) por uma página real (`components/public/PropostaPublica.tsx`): mostra itens/totais/condições, botões Aceitar/Recusar/Solicitar ajuste, formulário de assinatura simples quando aplicável, estados finais (recusada/expirada/assinada) e link secundário de PDF. Achado e corrigido no caminho: o logo que eu ia usar (`/brand/logo-full-black.png`) continha a marca da **Scott Studio**, não da Callface — asset mal rotulado, órfão, sem outro uso no código; troquei pro SVG real da Callface (`callface-logo.svg`) antes de publicar.

### Testado ponta a ponta com dado real (dev local)

Criei 3 propostas de teste reais (leads reais do dev DB, sem negócio ativo prévio) — 2 Callface AI, 1 PABX (ativei 1 plano PABX real que estava inativo no catálogo, só pra ter dado real testável, categoria/requerContrato setados). Validado via API + Playwright + psql:

- **Fluxo B completo**: enviar (sem checkout, `proximoPasso: "contrato"`) → visualizar (contador+evento `ProposalViewed`) → aceitar público (status `aceita`, contrato `pendente_assinatura`, produto `pabx` correto, notificação certa, sem marcar Won ainda) → assinar (contrato `ativo`/`aceite_simples`, negócio `ganho`, evidência `signed_contract` registrada, tarefa de cobrança criada, notificação de negócio ganho disparada pra gestão+responsável). Visual confirmado com screenshot real da página pública nos 3 estados (ações disponíveis, formulário de assinatura, recusada).
- **Fluxo A validado até o limite do ambiente**: criação/envio/aceite público funcionam e o Won continua evidence-gated corretamente (status não muda pra "aceita" no aceite público, só no webhook) — a geração real de checkout Stripe não pôde ser testada fim-a-fim porque a `STRIPE_API_KEY` está deliberadamente vazia neste ambiente de dev (comentário no `.env`: evita o worker puxar billing real pro banco semente) — limitação pré-existente do ambiente, não regressão. A correção de produto hardcoded foi validada isoladamente (`determinarProdutoProposta` retorna "ai" certo pra item Callface AI).
- Evento `ProposalRejected`/`ProposalAccepted`/`ProposalViewed`/`ProposalSent` confirmados no `event_outbox` com `status: processed` (worker consumiu e gravou em `audit_log` automaticamente, sem código novo de consumo).

### Correção urgente: `/propostas` continuava na tela legada

Achado real do Kauã testando ao vivo: construí todo o backend (fluxo condicional, página pública, eventos) sem nunca criar `(crm2)/propostas/page.tsx` — `/propostas` continuava resolvendo pra tela antiga (dark, "MP velho") porque não havia colisão de rota pra forçar a migração. Corrigido na hora:

- `GET /propostas/kpis` (novo — precisa vir antes de `/propostas/:id` na ordem de registro das rotas Hono, mesma pegadinha já vista em `/automacoes/execucoes-resumo` vs `/automacoes/:id`; sem isso "kpis" era capturado como `:id` e quebrava com erro de UUID inválido).
- `components/crm2/propostas/Workspace.tsx`: lista real (KPI strip com os 6 buckets que o Kauã pediu + valor total ativo, busca, filtro status/período, tabela com negócio/responsável/visualizações/aguardando-ação). Validado com o dataset real (500+ propostas, sem quebrar).
- `components/crm2/propostas/NovaProposta.tsx` (`/propostas/novo`): busca de cliente → builder por categoria real do catálogo (navegação lateral Callface AI/PABX, itens com preço real, tag "exige contrato" quando aplicável) → carrinho com qtd/valor editável → salvar rascunho ou enviar (reusa `POST /propostas` + `POST /propostas/:id/enviar` sem duplicar lógica). Testado ponta a ponta via Playwright: cliente real selecionado, item adicionado, rascunho salvo, redirecionou e confirmado no banco.
- Rota antiga movida pra `/propostas-legado` (preservada). **Detalhe/edição de proposta existente (`[id]`) continua legado** por ora — não foi o gap que o Kauã sinalizou (ele reclamou da lista e da criação por categoria), fica pra próxima rodada.
- **Nota de ambiente**: dev API server (`tsx watch`) não recarregou sozinho duas vezes nesta sessão depois de edição de arquivo — sintoma: comportamento antigo persistindo mesmo com código novo correto (confirmado testando a função isolada). Se algo parecer "não aplicou", reiniciar o processo manualmente (`kill` + `npx tsx watch --env-file=.env src/api-server/index.ts`) antes de investigar mais.

### Negócio → Criar Proposta herda contexto

`Cf2NovaPropostaWorkspace` ganhou `?negocioId=`/`?leadId=`: busca o negócio/lead real, pula a etapa de busca de cliente, cai direto no builder com o cabeçalho já mostrando negócio+empresa. Tenta casar `negocios.servicosInteresse` (texto livre, sem vínculo com catálogo) por nome contra o catálogo real — o que bate pré-popula o carrinho, o resto fica de fora (não inventa item). Todos os pontos reais que linkam "Nova Proposta" com contexto (`NegocioDrawer`, `LeadDrawer`, `negocios/[id]`, `contatos/[id]`, dashboard, lista legada) atualizados de `/propostas/nova` (legado) pra `/propostas/novo` (cf2). Testado via Playwright: negócio real → builder direto, sem tela de busca → salvo com `negocioId` correto (não duplica negócio, como o fluxo standalone faz de propósito quando não há negócio).

### Aba Propostas dentro do Negócio — já existia, só precisava do link certo

Auditoria antes de construir de novo: `NegocioDrawer.tsx` já tinha uma seção "Propostas" completa e funcional (número, status coloridos, valor, itens expandíveis) — construída antes desta sessão. O único gap real era o link "+ Nova" apontando pro fluxo legado sem categoria; corrigido junto com a atualização geral dos links (seção anterior). Não dava pra reconstruir isso do zero sem duplicar o que já funcionava.

### Testes E2E dos 4 fluxos nomeados pelo Kauã — status final

- **Fluxo A (Callface AI, pagamento)**: criação → envio (gera checkout Stripe) → aceite público (intenção registrada, sem virar Won ainda) validado ponta a ponta. Geração real de checkout não testável neste ambiente (chave Stripe deliberadamente vazia, ver nota anterior) — limitação de ambiente, não da implementação.
- **Fluxo B (PABX, contrato)**: completo e validado ponta a ponta com dado real, incluindo assinatura, Won, evidência, tarefa de cobrança, notificação.
- **Fluxo C (tela Propostas → Nova Proposta)**: validado via Playwright — busca de cliente, categoria, carrinho, salvar rascunho, redirecionamento, dado confirmado no banco.
- **Fluxo D (Negócio → Criar Proposta)**: validado via Playwright — contexto herdado corretamente, sem criar negócio duplicado (diferente do fluxo C, que cria negócio novo quando não há um vinculável).

### Pendente pra próxima rodada

Reskin do detalhe/edição de proposta existente (`[id]`) — visual apenas, lógica já funciona. Página pública (`/p/[id]`) fica como está — Kauã disse que vai mandar uma referência visual própria antes de eu iterar de novo nela.

## Automação real: lembrete de reunião 30min antes via WhatsApp

Pedido explícito do mandato inicial de Automações. Não passa pelo motor de automações (`automacao-engine.ts` é por evento síncrono, não por horário) — é sweep periódico no worker (`lembrete-reuniao-30min`, a cada 5min, mesmo padrão de `event-outbox-sweep`/`cadence-sweep`), buscando reuniões `agendada` com `data` entre agora+25min e agora+35min sem `lembrete30minEnviadoEm` ainda. Mensagem personalizada (nome do lead/responsável/horário/link) via `whatsappOutgoingQueue`, mesma fila real do resto do sistema — sem mecanismo paralelo.

**Testado ponta a ponta até o limite do ambiente**: reunião real criada (+30min), query da janela/dedup/personalização/fila confirmados certos via teste isolado. O envio de fato falhou por infra ausente no dev local (`ENOTFOUND callface-crm-wuzapi` — o gateway WhatsApp real não está rodando/alcançável fora do docker-compose completo) — mesma classe de limitação já documentada pro Stripe, não bug de lógica. Dado de teste removido depois.

## Contatos & Empresas — Quick View lateral + Nova Pessoa (retomando #63/#64)

Linhas de Pessoa/Empresa abrem `LeadDrawer`/`EmpresaDrawer` (legado, reutilizado — mesmo padrão já estabelecido) em vez de navegar pra fora da lista. Cross-navegação real entre Lead↔Empresa↔Negócio via os callbacks `onOpenLead`/`onOpenEmpresa`/`onOpenNegocio` que os 3 drawers já tinham — só faltava o estado certo no Workspace novo pra alternar entre eles. Validado com dado real via Playwright, incluindo timeline mostrando a proposta recusada de um teste anterior desta sessão (prova de coerência ponta a ponta entre os módulos).

Modal "Nova Pessoa": campos mínimos reais (nome/telefone obrigatórios), `POST /api/leads` existente, sem endpoint novo. Ao criar, invalida lista+KPIs e já abre o Quick View da pessoa criada. "Nova Empresa" desabilitado com tooltip honesto (não existe endpoint de criação direta de empresa) em vez de fingir.

**Gap consciente, não esquecido**: seleção múltipla / ações em massa (resto do #64) não implementado — não há regra de negócio definida pra quais ações em massa fariam sentido (excluir? atribuir responsável em lote? mudar status?). Inventar isso sem pedido explícito do Kauã seria over-engineering.

---

## Resumo da sessão (10/08) — mandato autônomo + intervenções pontuais do Kauã

Nesta sessão longa: App Shell/Command K, Qualificação, Pipeline/Calendário, Cadências, Automações (lista+builder+3 exemplos reais), módulo de Propostas inteiro (domain model condicional, backend, página pública, notificações, 4 fluxos testados), automação de lembrete de reunião, e Contatos (Quick View + Nova Pessoa). Duas correções urgentes no meio do caminho (Kauã testando ao vivo): tema em portais e roteamento de `/propostas` pra tela antiga — ambas resolvidas na hora.

**Pendente pra próxima rodada, em ordem de prioridade real**: reskin visual do detalhe de proposta existente, Atividades (revisão + integração cruzada), responsividade das telas principais, testes E2E completos dos 6 fluxos nomeados no mandato original (Lead→Qualificação→Reunião→Calendário→Atendimento→Pipeline; Negócio→Atividade→Proposta→Won; Contato→WhatsApp→Atividade→Negócio; Reunião→Automação→Lembrete→Histórico; Automação→Gatilho→Condição→Ação→Execução→Histórico; Busca global→Pessoa→Negócio). Página pública de Propostas fica intocada até o Kauã mandar a referência visual dele.

---

## PAUSA no frontend — sync do banco de dev com produção real (10/08, tarde)

Kauã pausou o avanço de frontend: a migração original Zoho→CRM (12/06, ver `produto/migracao-zoho-crm.md`) deixou PABX incompleto (só entrou snapshot histórico, sem billing recorrente) e outras variáveis "pra próxima fase" nunca fechadas. Ele vai fazer uma exportação completa do Zoho e organizar, e a gente decide junto o que fazer — até lá, autonomia técnica pausada nessa frente.

**Ação concreta pedida e executada**: banco de dev precisava refletir produção de verdade (não a base semente antiga, cheia de gap). Passos:

1. `pg_dump` da produção via SSH (`callface-crm-postgres`, container real, `docker exec` — **só leitura, zero escrita em prod**), 119MB → dump de 15MB.
2. Backup do dev antigo antes de sobrescrever (`_backups/dev_pre_prod_sync_*.dump`, git-ignorado — nunca versionar dado real).
3. Restaurado no Postgres local (`callface_crm`): 54 tabelas legadas, 3.196 leads, 1.104 negócios, 1.560 empresas, 319 contratos, 1.240 propostas — dado real de produção agora em dev.
4. **Prod não tinha nenhuma das tabelas/colunas novas de F0-F7** (event_outbox, comercial_evidencia, pessoas, pontos_contato, teams, won_evidence_policies, etc. — nem os campos de fluxo condicional de Propostas desta sessão). `npx drizzle-kit push` reconciliou tudo em duas passadas (a 1ª travou num índice único de `lead_labels` — 1 duplicata real, inofensiva, removida só nessa cópia local; a 2ª aplicou limpo).
5. Categoria/requerContrato do catálogo reaplicada (mesma lógica da migração 0010) — **sem reativar nenhum item PABX artificialmente essa vez**, já que agora é dado real e essa decisão é do Kauã, não minha.
6. `api-server`/`worker` reiniciados, app validado via Playwright: dashboard/Propostas com número real ("Virtua Software | Pabx Yeastar" — negócio PABX real que não existia na base semente antiga, prova concreta do gap que o Kauã sentiu).

**Resultado**: dev agora é espelho fiel de produção + toda a arquitetura nova desta sessão por cima. Nenhuma escrita em produção em nenhum momento — só leitura (pg_dump) e depois limpeza do arquivo temporário no servidor.

**Aguardando**: exportação organizada do Zoho feita pelo Kauã, pra decidir junto o que fica pra trás precisa entrar. Frontend pausado até então.

---

## Reenquadramento do projeto: não é migração, é Data Recovery + Data Modeling + Product Design + Migration (10/08, noite)

Kauã trouxe 2 exemplos concretos (LOGITHINK e Vetlog) contra o backup real do Zoho que ele mesmo exportou ("Complete Data Backup", pastas `Attachments`/`Data_001` em `~/Downloads`) provando o mesmo padrão: Zoho tem jornada comercial completa (oportunidade inicial + evento pós-venda ligado via `Oportunidade Origem` — upgrade/churn/renovação — + nota real + contrato nativo + assinatura eletrônica), CRM atual só mostra a venda original, eternamente "ganho". Reenquadrou o projeto inteiro a partir disso, com um framework conceitual explícito pro CRM 2.0: **Oportunidade** (o que aconteceu comercialmente) ≠ **Contrato** (o que foi contratado) ≠ **Lifecycle do cliente** (Prospect→Cliente→Ativo→Churn) ≠ **Eventos** (Won/Upgrade/Downgrade/Renewal/Churn/Reactivation) — nunca conflatar Deal Stage com status atual do cliente.

Regra explícita de reporte, corrigindo minha própria formulação inicial: nenhum achado é veredito ("X está errado/deve ser corrigido") — é evidência que precisa reconciliação ("Identificamos X registros cuja situação precisa ser reconciliada"). Proibições explícitas enquanto essa fase durar: não corrigir nada no CRM, não reimportar, não alterar schema definitivo, não decidir regra de churn a partir de 2 casos, não confiar cegamente em nenhuma das duas fontes. Autorizado: auditar tudo, mapear tudo, reconstruir jornadas, propor modelo canônico — só então migrar.

**Execução**: 6 agentes de investigação em paralelo (background), cada um 100% leitura, sem tocar em nada — inventário Zoho, inventário CRM atual, reconciliação Oportunidades↔Negócios, Propostas↔Contratos nativo, Contatos↔Empresas↔Leads, Atividades↔Notas↔Histórico↔Assinaturas. Os 6 relatórios completos ficam em `docs/reconstruction/auditoria-legado-zoho/01` a `06`; síntese consolidada seguindo a estrutura de 18 entregáveis pedida pelo Kauã em `00-SINTESE-CONSOLIDADA.md`.

**Achados mais graves da síntese** (todos com grau de confiança explícito no documento):
- 99,3% dos contratos nativos do Zoho (prazo, multa de 30%) nunca migraram — hoje não existe onde nem 1 dos 319 contratos do CRM tem essa informação.
- 121 negócios "ganho" no CRM já têm evento pós-venda documentado no Zoho depois do ganho (45 são churn = R$64.387/mês, 14,4% do MRR "ganho").
- Um pipeline PT-BR inteiro do Zoho (~R$957 mil, 516 oportunidades) migrou em 0-3% dos casos.
- Histórico de status/dono de lead (5.346 linhas), trilha de assinatura eletrônica (368 documentos ZohoSign) e notas visíveis no produto (4.560) — perda estrutural de 100%, não há onde essas informações morariam mesmo tentando recuperar.
- **Achado vivo, não histórico**: 449 leads (46% do módulo Zoho Leads) continuam entrando no Zoho depois do corte de 12/06 e nunca chegaram ao CRM — é o único item da lista que é bug operacional atual, não arqueologia.
- Padrões de processo ruim do próprio Zoho documentados pra não replicar no CRM 2.0: nome do registro usado como lógica de negócio (`EMPRESA | CHURN | vendedor`), 2 pipelines de Stage PT/EN nunca normalizados, campo de recorrência/MRR como texto livre.

Documento também traz proposta inicial de modelo canônico (rascunho, não fechado) e lista explícita de casos ambíguos que exigem decisão do Kauã, não minha.

**Aguardando**: leitura/direção do Kauã sobre a síntese antes de qualquer próximo passo — nenhuma correção, reimportação ou mudança de schema foi feita nem está planejada até então.

---

## Fase 2 da auditoria: semântica, temporalidade e procedência (10-11/08/2026)

Depois de ler a síntese da fase 1, Kauã pediu uma segunda etapa: não "o que existe/falta" (já respondido), mas **"o que cada coisa significa e como reconstruir a verdade histórica sem reproduzir a estrutura/processos ruins do Zoho"** — análise semântica + temporal + de procedência, ainda sem tocar em nada do CRM. Framework de 3 categorias temporais explícito (legado Zoho / dados do CRM vindos do legado / dados novos pós-cutover, já que o CRM está em produção desde 12/06/2026 e isso precisa ser preservado).

5 frentes em paralelo (background, 100% leitura), relatórios em `docs/reconstruction/auditoria-legado-zoho/fase2-semantica-temporal/`, síntese em `00-SINTESE-FASE2.md`:

- **A** — mapa semântico: classificação das 1.551 oportunidades do Zoho em 13 categorias reais (não "módulo Zoho"); refinamento do achado da fase 1 de 244 para 247 eventos pós-venda distintos; achado novo de 145 casos de alteração pós-venda sem token de evento no nome.
- **B** — timeline evidence-based de 20 empresas de maior impacto (CONFIRMED/INFERRED/AMBIGUOUS em cada evento) — **achado mais grave**: 2 churns aconteceram na própria semana desta auditoria (Ammo Varejo 20/07, Compucenter 04/08) e nenhum está no CRM — não é mais só arqueologia de migração, é o gap acontecendo agora.
- **C** — procedência forense: as 563 faturas são 100% Stripe; 171 dos 319 contratos nascem no mesmo microssegundo de 01/07 (backfill, não uso orgânico), 78 vêm do fluxo orgânico real (proposta aceita→negócio ganho). **Achado urgente**: 76 contratos (38 pares) ainda duplicados por `stripe_subscription_id` um dia depois do fix que corrigiu a causa raiz — passivo de MRR duplicado pode não ter sido limpo.
- **D** — os 449 leads pós-cutover, processados 100% (não amostra): **conclusão inverte a leitura da fase 1** — 89,5% são duplicata da mesma submissão que também chegou certinho no CRM (causa raiz: workflow n8n RD Station→Zoho continuou ativo pós-corte, dedupe só olha pro Zoho, nunca pro CRM novo), 7,1% já são clientes pagantes. Só 12 (2,7%) são leads reais represados de fato.
- **E** — state vs event no schema: achou o mesmo anti-padrão do Zoho ("fato como texto livre") reencarnado no CRM 2.0 (`contrato-duplicidade.ts`); validou que a hipótese das 4 dimensões (Opportunity/Contract/Lifecycle/Event) do Kauã é fortemente sustentada pelos dados só para Opportunity≠Event — Contract≠Lifecycle é antecipação de escala, não correção de sintoma medido.

**3 achados que pedem decisão rápida, não é só material de modelagem**: (1) os 76 contratos duplicados podem estar inflando MRR reportado agora; (2) os 2 churns recentes mostram que o gap está ativo, não é só histórico; (3) o workflow n8n pode continuar duplicando lead hoje — sem acesso ao painel da Wevy/Zoho nesta sessão pra confirmar se ainda está ligado.

**Status**: síntese da fase 2 entregue, aguardando leitura/direção do Kauã antes do modelo canônico definitivo e de qualquer migração/reconstrução.

---

## Fase 3 — Recovery Architecture + CRM 2.0 Compatibility (ADR, 11/08/2026)

Kauã leu fases 1+2 e corrigiu o escopo: o foco volta a ser **recuperar o legado Zoho pro CRM operacional atual** (não implementar/modificar o CRM 2.0 do dev nesta etapa), mas toda decisão de recovery precisa ser compatível/mapeável pro Domain Model V2 que já existe no dev (schema.ts, sync-domain-model.ts, backfill-domain-model.ts, ARCHITECTURE_DECISIONS.md, PLANO-RECONSTRUCAO-CRM2.md — nada disso foi redesenhado, só confrontado). Sequência de ambientes confirmada por ele: Zoho+produção real → reconstrução em homologação → QA → mesma migração em produção → produção consolidada → refresh do dev → CRM 2.0 continua.

**Entregável**: `docs/reconstruction/ADR-FASE3-RECOVERY-ARCHITECTURE.md`. Só arquitetura/decisão — nenhuma migration aplicada, nenhum ambiente alterado.

**Achado de guardrail mais importante desta fase**: nenhuma tabela do Domain Model CRM 2.0 (F0-F7 — `event_outbox`, `comercial_evidencia`, `pessoas`, `oportunidades`, `clientes`, `won_evidence_policies` etc.) existe em homologação ou produção hoje — tudo isso só existe no dev local. Isso significa que "confrontar com o que já existe no dev" só pode ser conceitual/de mapeamento futuro nesta fase — qualquer schema novo pro recovery só pode nascer no schema legado (que é o que de fato roda em homolog/produção).

**Delta de modelagem proposto pro Lifecycle Event** (a peça que a fase 2 já tinha identificado como faltante): em vez de tabela nova, **estender `mrr_movimentos`** (já existe em produção, já é append-only, já alimentada pelo `stripe-sync.ts`, já tem vocabulário de evento — `novo`/`expansao`/`contracao`/`churn`/`reativacao`). Delta: colunas novas nullable (`negocio_id`, `negocio_origem_id`, `zoho_id`, `confianca`, `evidencia`) + 2 valores novos de `tipo` (`renovacao`, `alteracao_contratual`). Resolve a lacuna real (não referenciar Oportunidade) sem inventar mecanismo novo — e upgrade/downgrade mapeiam pro vocabulário financeiro já existente (`expansao`/`contracao`) preservando o rótulo original do Zoho em `evidencia`, sem perder a semântica comercial própria que a fase 2 exigiu preservar.

Documento cobre as 14 dimensões pedidas (Companies/Contacts/Leads/Opportunities/Proposals/Contracts/Products/Invoices/Notes/Stage History/Calls-Meetings-Tasks-Emails/ZohoSign/Attachments/Campos Customizados/Attribution), a matriz forward-migration Zoho→CRM atual→CRM 2.0, regras de precedência/temporalidade, estratégia de provenance, lista de mudanças mínimas de schema (13 colunas novas, todas aditivas/nullable, + 1 tabela leve opcional pra Attachments), lista do que preservar sem remodelar, plano de dry-run em homologação (já resincada e com paridade de schema confirmada nesta mesma sessão) e critérios objetivos de go/no-go — incluindo um achado de segurança operacional: recovery precisa escrever direto no banco, nunca via rotas da API, senão reativa automação/notificação (mesmo tipo de bug do ADR-EXEC-017, 167k notificações duplicadas).

**Status**: ADR entregue pra revisão, 5 perguntas em aberto listadas no fim do documento pro Kauã decidir. Nada implementado ainda.
