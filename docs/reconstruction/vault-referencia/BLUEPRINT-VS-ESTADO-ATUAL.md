---
tags: [scott-studio, projeto-interno, callface, crm, decisao]
---

> **Nota**: cópia de referência do vault Obsidian (fonte de contexto de produto/negócio), snapshot de 09/08/2026. Pode conter wikilinks `[[...]]` no formato Obsidian, que não resolvem fora dele — informativo, não é link quebrado. Este é o documento original de cruzamento do blueprint completo do CRM 2.0 (107 pontos) contra o estado do código antes da reconstrução — é a referência-base pra qualquer revisão arquitetural externa.

# Blueprint CRM 2.0 × Current State — tracking vivo

Documento de trabalho da reconstrução do CRM Callface. O Kauã está enviando o
"BLUEPRINT DEFINITIVO" em blocos (107 pontos totais). Este arquivo acumula o
cruzamento bloco a bloco contra o [[project_crm_callface|current state já auditado]]
(8 agentes paralelos, 08/08/2026, ver entrada em `crm-callface-status.md`
mesma data) — serve pra não perder o fio entre sessões/compactação de contexto.

Não é decisão fechada. É rastreamento de alinhamento vs conflito, pra virar
insumo da reconstrução real quando o blueprint completo chegar.

## Convenção
- ✅ **Alinhado** — blueprint confirma/reaproveita algo que já existe e funciona bem hoje
- ⚠️ **Conflito estrutural** — o legado faz o oposto do que o blueprint pede; vira trabalho de rebuild real, não ajuste
- 🆕 **Greenfield** — não existe nada parecido hoje, construção do zero
- ❓ **Pergunta aberta** — blueprint deixou decisão em aberto ou ambígua, vale levar pro Kauã

---

## Blocos 01–20 (recebidos 08/08/2026)

**01 Executive Overview / 02 Contexto / 03 Ecossistema** — moldura geral, bate
com o que já era conhecido (CRM nasceu fork Scott Studio, virou Callface).
Sem conflito técnico aqui, é o "porquê" do projeto.

**04 Personas** — SDR "híbrido/AI-first" já existe como intenção no legado
(Natália) mas ⚠️ **conflito confirmado na auditoria**: o motor conversacional
chama endpoint da OpenAI com nome de modelo Groq, sem env var compatível
documentada — precisa confirmar com o Kauã se está rodando de verdade hoje
antes de decidir se o AI SDR do blueprint é "evoluir a Natália" ou "recomeçar".

**05 Modelo Operacional** (Aquisição→Entrada→Dedup→Distribuição→Qualificação→
Contato→Reunião→Oportunidade→Negociação→Proposta→Contrato/Pagamento→Won→
Customer→Onboarding) — ⚠️ **conflito estrutural real**: no legado, `POST /leads`
já cria o **negócio** (oportunidade) no mesmo instante pra maioria dos leads de
LP (`leads.ts:518-563`), sem passar por qualificação separada antes. O
blueprint pede estágios sequenciais claros (Lead qualifica → só depois vira
Deal); hoje lead e deal nascem juntos na maioria dos casos. Rebuild real do
funil de entrada, não um ajuste.

**06 Lead Intake Layer** ("nenhuma integração deve escrever regra comercial
espalhada") — ⚠️ **conflito estrutural confirmado**: hoje cada integração
(RD-lead, site-lead, meta-lead-ids, Apollo) reimplementa sua própria lógica de
dedup por email/telefone, sem camada central. Exatamente o oposto do que o
blueprint pede. É greenfield de fato — não tem uma "Lead Intake Layer" hoje,
tem N webhooks paralelos.

**07 Arquitetura funcional / 08 Mapa de navegação / 09 Inventário de telas** —
o mapa trata `/leads`, `/contacts`, `/companies`, `/deals`, `/customers` como
entidades e rotas claramente distintas. 🆕 Isso é exatamente o modelo de
domínio que a auditoria confirmou **não existir hoje**: "Cliente" é só
`leads.tipo='cliente'` no mesmo registro do Lead, e existem 2 conceitos de
"Contato" desconectados (discriminador em `leads` vs. tabela `contatos` de
canal). O princípio do Kauã (`LEAD ≠ CONTACT ≠ COMPANY ≠ DEAL ≠ CUSTOMER`) é
greenfield de modelagem, não existe hoje.

**10 Command Center** — 🆕 não existe equivalente. O legado tem `CrmTopbar`+
`NotificationDropdown` **órfãos** (nunca renderizados, sem breadcrumb hoje) e
um Dashboard que roda ~10 blocos de query síncrona pesada sem cache
(`getDashboardData`, sem `unstable_cache`) — vale não repetir esse padrão de
performance no Command Center novo.

**11 Leads (lista + detail)** — parcialmente ✅: o legado já tem Drawer
consistente (`LeadDrawer.tsx` sobre `DetailDrawer` base) com timeline, mas
sem a camada de IA (resumo/sentimento/intenção/próximos passos) que o
blueprint pede na seção AI do Lead Detail — isso é 🆕.

**12 Communication Intelligence** — ✅ **parcialmente alinhado e é o melhor
ponto de partida do legado**: a integração de telefonia Callface já entrega
resumo de IA, transcrição, resultado, idempotência real (`callface.ts`,
chave de idempotência + `onConflictDoNothing`). WhatsApp e Email hoje **não**
têm essa camada de IA (sentimento/intenção/objeção) fora do fluxo específico
do AI SDR — construir a timeline unificada com IA em WhatsApp/Email é 🆕,
mas a base de Ligações é reaproveitável.

**13 Deals** — ⚠️ conflito de modelagem: blueprint pede campos como
"primary contact" e "products" no Deal. Hoje existem **dois caminhos
concorrentes** pra ligar lead↔negócio: `negocios.leadId` (FK 1:1 legado) e
`negocio_leads` (N:N com `papel`) — nada garante que coincidam. Contrato
(`contratos`) nem tem `empresaId` próprio, precisa navegar via lead ou via
negócio, que podem discordar entre si.

**14 Pipeline / regra de Won** — ver 15.

**15 Definição de Won** — ✅✅ **validação forte**: a "Cenário C — proposta
arquitetural" do blueprint (Commercial Commitment = `SIGNED_CONTRACT` OU
`SUCCESSFUL_PAYMENT`, Deal só vira Won com regra configurada) é **literalmente
o gate que o time já implementou** no legado (commit `2111650`, branch
`wip/local-pre-sync`, nunca mergeado — ver auditoria 08/08). Ou seja: o
blueprint está pedindo algo que já foi resolvido uma vez e perdido. Forte
argumento pra reaplicar aquele trabalho como ponto de partida do rebuild,
não reprojetar do zero.

**16 Proposals** — ✅ fluxo conceitual (Deal→Generate→Products→Price→
Checkout→Send) já existe e funciona bem no legado (`propostas.ts` +
`stripe-checkout.ts`, com CPF/CNPJ obrigatório, idempotência no aceite).
Ponto real de dívida: catálogo/produto tem `produto=NULL` histórico em ~22
contratos (parte já corrigida no código, falta backfill de dado).

**17 Proposta personalizada com IA** — 🆕 não existe hoje. É o tipo de
capacidade que Communication Intelligence (12) precisa alimentar — depende
de 12 estar construído antes de fazer sentido.

**18 Contratos — "não obrigatório pra toda venda"** — ⚠️ conflito direto: hoje
`marcarPropostaAceita` **sempre** insere um contrato, e `contratos.leadId` é
`notNull` (contrato sempre atado a um Lead, nunca modelado como opcional
paralelo ao Payment). O modelo `Deal ├── Payment └── Contract` independente
é rebuild real do fluxo de aceite.

**19/20 Cadências + Cadência SDR** — 🆕 quase tudo. Hoje são **dois motores
paralelos sem builder visual**: (a) cadência manual com 13 toques
hardcoded no código-fonte (`sdr-inbound.ts`), sem configurabilidade; (b) AI
SDR via sweeps de cron (5min/15min/diário) — não é event-driven de verdade
(`LeadCreated → AI SDR Activated` reativo instantâneo), é polling periódico.
"Automations" como tabela configurável existe no schema mas **sem executor**
(a própria UI do legado admite "em breve"). O Cadence Builder visual do
blueprint é greenfield total.

---

## Blocos 21–40 (recebidos 08/08/2026)

**21 AI SDR (capacidades)** — ✅ parcialmente alinhado: a lista de capacidades
(ligar, WhatsApp, email, sugerir horário, agendar, atualizar CRM, resumo,
próximo passo) já é o que a Natália tenta fazer hoje. Mas o modelo de
execução é diferente: hoje é **sweep por cron** (5/15min) sobre leads
parados, não um agente reagindo a evento em tempo real com acesso
controlado por permissão explícita. O blueprint pede "acesso controlado" —
hoje o acesso é total via as mesmas queries que qualquer rota usa, sem
camada de permissão dedicada pro agente.

**22 Human Handoff** — ✅✅ **forte alinhamento, pouco trabalho novo aqui**: a
lógica de handoff do legado já é sofisticada — 4 gatilhos distintos (tool
call do modelo, keyword pré-chamada, valor alto pré-chamada, falha de
agendamento), com handoffs "leves" reativáveis vs. "duros" permanentes. O
estado 3-fases do blueprint (`AI_HANDLING → HUMAN_REQUIRED → HUMAN_ASSIGNED`)
formaliza isso — vale preservar a heurística/prompt engineering existente,
só dar nome de estado explícito a ela.

**23 AI Assistant (copiloto interno, linguagem natural)** — 🆕 não existe
nada parecido hoje. Nenhum componente de busca/query em linguagem natural
foi encontrado na auditoria de frontend (o `CommandPalette` é só navegação
estática pra 11 destinos fixos).

**24 AI Agent Autônomo** — 🆕 greenfield, depende de 25+40 existirem primeiro
(precisa de engine de automação real + event bus pra ter o que executar).

**25 Automações (trigger+conditions+actions)** — ⚠️ achado importante: a
**taxonomia de triggers/actions do blueprint já existe quase idêntica** no
schema atual (tabela `automacoes`: `gatilho`/`condicao`/`acao`/`acaoConfig`,
7 gatilhos, 5 operadores, 6 tipos de ação) — mas confirmado na auditoria que
**nenhum worker executa essa tabela**. O que funciona hoje como "automação"
é um conjunto de ~10 cron jobs hardcoded (SLA, follow-up de proposta,
renovação, reativação de lead perdido) que fazem manualmente o que o
blueprint quer como engine genérica e orientada a evento. Ou seja: o modelo
de dados de automação já foi pensado corretamente uma vez; falta o motor.

**26/37 Entidades principais + Relacionamentos** — 🆕⚠️ **o achado mais
importante deste bloco**: no modelo novo, `Deal` referencia `contact_id` e
`company_id` diretamente — **não referencia `Lead`**. Isso resolve de raiz
os dois problemas centrais da auditoria (Customer não existe como entidade;
2 conceitos de Contato desconectados), formalizando Lead como entidade
transitória de qualificação e Contact como o registro permanente de
pessoa. Ver pergunta 3 abaixo — isso tem uma implicação de rastreabilidade
que precisa confirmação.

**27 Activity (entidade unificada)** — parcialmente ✅: já existe precedente
(`atividades`, embora com `negocioId`/`usuarioId` nullable). Tipo novo
"AI interaction" como Activity de primeira classe não existe hoje — interação
de IA fica espalhada em `whatsapp_mensagens` + `ai_sdr_logs` sem entidade
comum.

**28 Communication (distinta de Activity)** — 🆕 confirma o achado da seção
12: hoje `ligacoes`/`whatsapp_mensagens`/`emails` são 3 tabelas paralelas
sem abstração comum de "Communication". Greenfield real.

**29 Task** — ✅ maior parte já existe (`tarefas`, com `leadId`/`negocioId`
nullable). Nuance: a auditoria de núcleo comercial achou "tarefa é
majoritariamente manual"; a auditoria de worker achou o oposto — vários
crons criam tarefa automaticamente (renovação, lead perdido, follow-up de
proposta, confirmação de reunião). As duas coexistem: criação automática
existe, só não passa por trilha de `automation_id` (que nem existe hoje).

**30 Cadence (entidade com steps/enrollment_rules/exit_rules)** — 🆕 hoje é
array fixo de 13 toques com copy hardcoded no código-fonte
(`sdr-inbound.ts`), não é dado configurável. Conteúdo/copy é reaproveitável,
estrutura é greenfield total.

**31 Automation (com execution_history/version)** — reforça 25: não existe
histórico de execução nem versionamento de automação hoje (nem faria
sentido, já que nada executa).

**32 Product** — ✅ boa sobreposição com `servicosCatalogo` (já linkado a
Stripe product/price).

**33 Subscription (separado de Deal)** — ✅ conceito já existe
(`assinaturas`), mas é **exatamente onde vive o bug de MRR duplicado não
corrigido** (auditoria 08/08) — a separação Deal/Subscription está correta
na cabeça, quebrada na implementação atual do sync.

**34 Customer** — 🆕 confirma achado da auditoria: não existe como entidade
agregadora (empresa+contatos+assinaturas+produtos+deals+onboarding+status
financeiro). Hoje é só uma flag dentro de Lead.

**35 Event Store** — 🆕 quase total. Precedentes fracos: tabela `eventos`
(sem `organizacaoId` — mesmo furo de isolamento já achado em outras tabelas)
e `status_changes` (só pra mudança de estágio, não é event store genérico).
Nenhum dos dois tem `aggregate_type`/`correlation_id`/`idempotency_key`/
`version` do jeito que o blueprint pede.

**36 Audit Log (before/after)** — 🆕 mas é resposta direta a um achado de
segurança real: a auditoria confirmou **zero log de impersonation/org-switch**
hoje. Esse componente do blueprint fecha esse furo especificamente.

**38 State machines** — Lead: bom alinhamento parcial (`sdrStatus` hoje é
pending→contacted→qualifying→scheduled/disqualified; blueprint é mais
limpo, com ASSIGNED explícito e saídas claras NO_RESPONSE/UNSUBSCRIBED vs.
as flags ad-hoc atuais `sdr_sem_retorno`/`sdr_sem_interesse`). Deal: o
`LOST → REOPENED` do blueprint **formaliza algo que já existe informalmente**
— hoje `no_show` empurra o lead de volta pra "qualifying" via
`resolveFollowupOwnerId`, sem ser um estado de negócio reaberto de verdade.
Nota: o pipeline atual tem estágio `trial` que não aparece na máquina
canônica do blueprint — provavelmente cabe como estágio customizado por
pipeline (já suportado), não like perda de conhecimento de domínio.

**39 Event Catalog / 40 Event-driven architecture** — ⚠️🆕 **é o ponto que
resolve mais achados da auditoria de uma vez só**: hoje `DealWon` não é um
evento publicado, é lógica de efeito colateral duplicada em 2 lugares
(`negocios.ts` E `aceitar-proposta.ts`, cada um criando contrato/promovendo
lead/notificando por conta própria). Se o CRM passar a publicar o fato
("Deal foi ganho") e os consumidores (Finance, Analytics, Notifications)
reagirem de forma independente, a duplicação de regra de negócio encontrada
repetidas vezes na auditoria (won, notificações, automações) desaparece
estruturalmente — não é feature nova, é a correção arquitetural que a
causa raiz dos bugs já achados está pedindo.

---

## Blocos 61–80 (recebidos 08/08/2026)

**61 Responsividade** — ❓ não coberto pela auditoria (o agente de
frontend/UX não checou breakpoints/mobile especificamente). Sem dado hoje
pra dizer alinhado ou não.

**62 Observabilidade (request ID/correlation ID/event ID por hop)** — 🆕
greenfield quase total. O único precedente real é a `idempotencyKey` da
integração Callface (idempotência local, não tracing distribuído). Não há
correlation ID atravessando webhook→fila→consumer→API externa hoje;
debugging depende de log de container solto.

**63 Integration failure model (Stripe fora não trava o CRM)** — ✅ já existe
**um** precedente exatamente nesse espírito: `enviarPropostaComCheckout`
já degrada graciosamente hoje — se nenhum produto tem `stripeProductId`
mapeado ou o Stripe falha por qualquer motivo, a proposta vai pra "enviada"
com `checkoutUrl=null` em vez de travar (antes disso era bug, ficava em
rascunho com erro 502 pra sempre). É prova de que o princípio já foi
aplicado uma vez — falta generalizar como padrão sistemático (circuit
breaker/fallback) em vez de tratamento pontual por fluxo.

**64/65 Migração (extraction→normalization→validation→cutover controlado)**
— reforça achado crítico da auditoria: **o `schema.ts` local não é fonte
confiável pro passo de Extraction** — só 15 das 54 tabelas têm rastro de
migration no repo, e já existe caso confirmado de drift real (tabelas de
CS/Onboarding existindo em produção e não no schema local, 30/07). Antes de
qualquer extração de dado, o passo 0 tem que ser introspecção direta do
Postgres de produção (`\dt`+`\d` real), não confiar no Drizzle schema local.

**66 Arquitetura técnica (React/TS/Vite, Supabase/Supabase Auth)** — ⚠️⚠️
**maior conflito encontrado até agora, precisa decisão explícita antes de
seguir**: isso contradiz o stack real do projeto (Next.js 16 + Hono + Drizzle
+ NextAuth v5 + Postgres puro, **sem Supabase**). Inclusive já existe uma
decisão anterior registrada (sessão de 11/jun): "mantém Hono/Drizzle, NÃO
Supabase". Ver pergunta 4 abaixo — preciso saber se isso é intenção real de
troca de stack ou texto de template genérico que sobrou no blueprint.

**67 Backend Domain Modules (modular monolith, não microservices prematuro)**
— ✅ boa notícia, e parcialmente já existe: `app/src/lib/` já é organizado
por domínio (`crm`, `email`, `whatsapp`, `integrations`, `ai`, `financeiro`,
`propostas`) — é o esqueleto certo, só falta impor fronteira real (hoje as
rotas do Hono continuam organizadas por entidade, não por módulo de domínio,
e nada impede um domínio importar direto de dentro de outro). O principio
"modular monolith antes de microservices" também bate com o time de 6
pessoas — não cabe complexidade operacional de microservices agora.

**68 Jobs/Queues** — ✅✅ forte alinhamento, é a área mais madura do legado
hoje: o worker BullMQ já cobre quase toda a lista (webhook Callface/WhatsApp,
Stripe sync, IA (site-lead-qualify), envio de mensagem, e-mail, enrichment,
importação). Falta só cadência-como-job (hoje é hardcoded) e geração de
documento como job dedicado (hoje puppeteer roda inline).

**69 API Design (ações explícitas: `/deals/:id/win`, `/cadences/:id/enroll`)**
— ⚠️ recomendação concreta pro rebuild: hoje `PATCH /negocios/:id` é
genérico e é exatamente onde a lógica de "ganho" ficou duplicada (achado do
bloco 15/40). Endpoints de ação explícitos (`win`/`lost`) são o lugar certo
pra centralizar esse gate em vez de deixá-lo dependente de qual campo o
client mandou no PATCH.

**70** — repete 40, mesma leitura.

**71–80 (User flows)** — majoritariamente reforçam achados já registrados
(Lead Intake greenfield, cadência de não-atendimento = 2 motores hoje,
Won→Customer→Subscription→Onboarding valida a entidade Customer do bloco
34). Dois pontos novos:
- **78 Lost ("Reason Required", nunca apagar)** — ✅ já tem precedente de UI:
  `LossReasonModal.tsx` existe no legado. Reaproveitável.
- **80 AI Agent (Insight→Proposta→Permission Check→Execute→Log Action)** —
  o "Log Action" aqui é o mesmo Audit Log do bloco 36 sendo usado como
  trilha de execução do agente autônomo — consistente, reforça que 36 não é
  opcional se 24/80 forem implementados.

---

## Perguntas acumuladas pro Kauã (não bloqueiam, só registrar)

1. **SDR/Natália**: confirmar se está respondendo de verdade em produção hoje,
   dado o achado do endpoint OpenAI-com-modelo-Groq (ver bloco 04).
2. **Won (bloco 15)**: o gate que o blueprint propõe já foi construído e
   perdido — proposta é reaplicar aquele commit como base em vez de
   reprojetar? (pergunta de sequenciamento, não de arquitetura)
3. ~~**Deal sem referência a Lead (bloco 26/37)**~~ — **RESOLVIDO 08/08,
   decisão do Kauã**: Attribution/Touchpoints é camada de domínio própria,
   independente do lifecycle do Lead — não é campo copiado pro Deal. Ver
   seção "DECISÃO — Attribution/Acquisition Layer" abaixo.
4. ~~**Stack (bloco 66)**~~ — **RESOLVIDO 08/08**: Kauã confirmou que não é
   troca de stack de verdade, o bloco 66 (React/Vite/Supabase) foi erro/
   resquício de template no blueprint. Stack real segue Next.js 16 + Hono +
   Drizzle + NextAuth v5 + Postgres puro — reconstrução é evoluir esse
   stack com os módulos de domínio corretos, não reescrever em Vite.

---

## Blocos 41–60 (recebidos 08/08/2026)

**41 Integrações** — ✅ Callface/WhatsApp/Email bidirecionais batem quase
1:1 com o que já existe e funciona (Callface é o melhor exemplo do legado:
idempotência real, resumo/sentimento/transcrição). RD Station "só origem de
lead" bate com o achado da auditoria, **mas** o legado tem uma peça extra
que o blueprint não menciona: `rd-criativo.ts` faz enrichment periódico
CRM→RD (preenche UTM via RD) — ou seja, hoje RD não é 100% unidirecional
como o blueprint descreve. Meta também é mais rico hoje do que o "Meta→Lead
→Attribution" simplificado: existe staging (`meta_lead_staging`) pra
resolver race condition de webhook chegando antes do lead — lógica difícil
de recriar do zero, vale preservar esse conhecimento específico.

**42 PBX/Holding + Financial Integration Layer** — 🆕 achado de negócio
importante: a visão explicita que **PBX fatura pela Holding/Wive, não pelo
Stripe** — hoje o `stripe-sync.ts` assume implicitamente que Stripe é a
única fonte financeira (é literalmente onde vive o bug de MRR duplicado).
A Financial Integration Layer proposta precisa ser uma abstração real sobre
múltiplas fontes (Stripe pra AI, Holding/Wive pra PBX), não só "sincronizar
com Stripe melhor". Bate com achado antigo já registrado: "PABX nunca foi
ingerido no CRM, segue só em planilha Excel da Wevy".

**43 Database Architecture (camadas)** — reorganiza tudo que já foi
mapeado nos blocos 26/37, mas com 2 categorias novas sem equivalente hoje:
`INTELLIGENCE` (AIAnalysis/AIInsight/AIAction genéricos, atacháveis a
qualquer entidade) e `INTEGRATION` (Integration/Webhook/ExternalObject/
SyncState como registro central). Hoje extração de IA fica presa por
feature (SDR tem `qualificacaoExtraida` só pra si, ligação tem resumo só
pra si, WhatsApp/email não têm nada) — não existe uma entidade comum. E
estado de integração vive espalhado em colunas ad hoc por tabela
(`whatsapp_sessao`, `email_contas`), não num registro central de sync.

**44 Princípios de banco** — checklist direto contra o que a auditoria já
achou:
| Princípio | Estado hoje |
|---|---|
| Toda entidade organizacional tem `organization_id` | ⚠️ violado: `contratos`/`assinaturas`/`faturas`/`mrr_movimentos` nullable, 6 tabelas sem a coluna |
| ID interno não depende de ID externo | ⚠️ violado: `contratos.stripeSubscriptionId` como texto solto duplica FK que `assinaturas` já modela |
| Webhook idempotente | ✅ parcial: Callface tem de verdade; WhatsApp depende de unique constraint (quebra em vez de ser gracioso); Apollo webhook sem auth nenhuma |
| Evento com correlation ID | 🆕 tabela `eventos` não tem esse campo hoje |
| Histórico de estado preservado | ✅ já existe: `status_changes` |
| Mudança crítica auditável | ⚠️ violado: zero audit log de impersonation/org-switch |
| Dado financeiro não vem de campo manual | ⚠️ violado: `mrrEstimado`/`valorSetup` etc. ainda existem em `leads` E `negocios`, marcados "legacy" mas não removidos |
| Analytics não depende de query frágil de UI | ⚠️ violado: dashboard roda ~10 blocos de query síncrona sem cache; `AUDITORIA.md` interno já documentou 6 definições concorrentes de "lead qualificado" |

**45 Data Warehouse/Analytics separado** — 🆕 mas é literalmente a correção
arquitetural pro problema que o próprio time já diagnosticou por escrito
(`AUDITORIA.md`, 3 gerações de código de relatório coexistindo). Não é
feature nova, é o remédio de um problema já nomeado.

**46 Fonte da verdade (tabela domínio→fonte)** — ✅ valida a intenção que o
Kauã já tinha declarado no kickoff ("CRM não deve virar sistema financeiro
paralelo") e o desenho atual do módulo financeiro (deriva de Stripe, não
inventa número) — a intenção está certa, a execução é que quebra (bug de
MRR). Vale formalizar essa tabela como documento oficial de ownership de
dado quando a reconstrução começar.

**47/48 Dashboards vendedor/gestor** — detalhe de KPI sobre o Command
Center já registrado (bloco 10); dashboard atual não organiza por essas
lentes (Aquisição/SDR/Sales/Time/Revenue), é mais monolítico.

**49 Funil gerencial com drill-down** — 🆕 não existe hoje (relatórios são
`useQuery` por aba/período, sem interação de drill-through pra lista de
leads por trás do número).

**52/53/54 IA transversal + extração estruturada** — reforça Communication
Intelligence (12); confirma que hoje extração de IA é **silo por feature**
(SDR extrai qualificação só pra si; ligação tem resumo só pra si) — exatamente
o motivo de precisar da entidade `AIAnalysis` genérica do bloco 43.

**55 Permissões (7 roles: ADMIN/DIRECTOR/MANAGER/COORDINATOR/CLOSER/SDR/
OPERATIONS + org/team/ownership)** — ⚠️ hoje só existem 5 roles (admin/
gerente/closer/sdr/leitor, sem DIRECTOR/COORDINATOR/OPERATIONS, e "leitor"
não está na lista nova — confirmar se é intencional). Ownership-based rule
(closer só vê próprios negócios) já existe, mas ad hoc dentro de
`negocios.ts`, não como engine de permissão reusável — é rebuild real, não
extensão.

**56 Descontos com aprovação** — 🆕 não existe hoje (`propostas.ts` não tem
limite/aprovação de desconto, é campo livre).

**57 Segurança (checklist)** — mapeia quase item a item pros achados de
segurança já confirmados na auditoria:
- RBAC ✅ existe (simples) · organization isolation ⚠️ furos confirmados (orgId nullable, IDOR em enrich-bulk) · server-side authorization ✅ consistente via `getCtx()` · **audit trail ⚠️ confirmado ausente** · webhook signature validation ⚠️ inconsistente entre integrações (Callface ok, WhatsApp com bypass se header vazio, Apollo sem nada, RD/Meta com token fallback hardcoded no código) · rate limiting ❓ nenhuma auditoria encontrou evidência, provável ausência · encryption ✅ parcial (tokens de e-mail sim, resto não avaliado).

**58 Edge cases** — 2 gaps reais que valem nota:
- **"Usuário removido → reatribuir deals/leads/tasks/cadences"**: não existe
  hoje. Quando um usuário é desativado (`ativo=false`), nada reatribui o
  que era dele — relaciona direto com o achado de 03/08 (18 leads sem
  responsável) e é o mesmo tipo de risco, só que pelo lado contrário
  (usuário sai, deixa órfão).
- **"Lead duplicado → oferecer merge"**: hoje o comportamento é diferente —
  os webhooks (RD/site-lead/meta) fazem dedup automático por email/telefone
  e já atualizam o registro existente **sem perguntar nada** ao usuário.
  O blueprint pede confirmação humana antes de mesclar — é mudança de
  comportamento de produto, não só arquitetura, vale confirmar que é
  essa a intenção (mais fricção, menos risco de merge errado).

**59 UI states** — ⚠️ confirma o achado do frontend: `Skeleton`/`EmptyState`
existem mas só em 1-2 telas; 34 arquivos reimplementam "Carregando..." na
mão. "Partial failure" (`"12 de 15 contatos importados, 3 falharam"`) não
tem equivalente hoje em nenhum fluxo de import em massa (enrich-bulk,
Apollo import) — falha parcial hoje é silenciosa.

**60 Design system** — referências batem com o que já era esperado
(mencionado até no brief inicial do Kauã). Padrão de interação Drawer/
Kanban(`@dnd-kit`)/Timeline já tem implementação real pra copiar; não existe
hoje um design system/tokens formal além de utility classes Tailwind.

---

## Blocos 81–100 (recebidos 08/08/2026)

**81 Analytics model** — formaliza taxonomia de métrica (Acquisition/SDR/
Sales/Revenue/Productivity), consistente com 47/48 já registrados. Sem
achado novo, é o glossário oficial pra usar no rebuild do Analytics Layer.

**82 Data Quality Layer** — ⚠️⚠️ **o achado mais valioso deste bloco**: os
10 checks propostos (`Duplicate`, `Missing Owner`, `Missing Source`,
`Invalid Contact`, `Invalid Company`, `Inconsistent Stage`, `Invalid Amount`,
`Orphan Deal`, `Missing Product`, `Financial mismatch`) **mapeiam quase
1:1 pros achados concretos da auditoria original**:
| Check | Achado real correspondente |
|---|---|
| Duplicate | contratos duplicados por venda (bug MRR não corrigido) |
| Missing Owner | 18 leads sem responsável (03/08, já teve fix parcial) |
| Invalid Contact/Company | CPF/CNPJ ausente (parte já corrigida no checkout), 2 conceitos de Contato desconectados |
| Inconsistent Stage | nenhum CHECK/enum real no banco pra estágio, qualquer string é aceita |
| Orphan Deal | UUIDs sem `.references()` (`negocioOrigemId`, `propostaOriginalId` etc.) |
| Missing Product | 22 contratos com `produto=NULL` (fix de código feito, backfill de dado não) |
| Financial mismatch | exatamente o gap de R$18k/R$12k de MRR já medido |

Construir esse Data Quality Layer não é feature nova isolada — é o painel
que teria **detectado e monitorado continuamente** cada um dos bugs
já achados manualmente ao longo dos últimos meses. Prioridade alta pro
roadmap de dados.

**83 Auditoria de comunicação (timeline por negócio)** — ✅ já foi
construído uma vez e funcionou: entrada de 29/07 no `crm-callface-status.md`
registra timeline unificada (ligação/WhatsApp/email/nota/breadcrumb de
estágio) reaproveitada tanto em Lead quanto em Negócio, validada em
homolog. É precedente de UX real, não greenfield puro.

**84 Proposta de valor / 88 Future ARO / 90 Critério de sucesso** — visão
de produto, sem cruzamento técnico novo (reforça 01/24/80).

**85/86/87 MVP / Should / Could** — útil pra calibrar tamanho do esforço:
cruzando com o que já foi mapeado, "Foundation" e "Data" (event system,
audit, data quality) do MUST HAVE são **quase 100% greenfield** hoje;
"Core CRM", "Commercial" e "Communication" **já existem e funcionam**, mas
precisam de cirurgia de modelo de domínio (Contact/Customer/Deal) e correção
de bugs conhecidos (MRR), não construção do zero. É uma distinção
importante pro sequenciamento: a Fase 0 do roadmap (89) carrega o peso
maior de trabalho novo puro; Fases 1–3 são mais "reconstruir sobre
conhecimento existente".

**89 Roadmap (Fases 0–7)** — nota: Fase 0 (Foundation) não é só
infraestrutura — é onde os furos de segurança/integridade já confirmados
(orgId nullable, zero audit trail, sem event correlation) se resolvem como
efeito colateral de fazer a fundação certa. Fase 2 (Commercial) é onde o
bug de MRR mora — vale considerar se esse fix não devia ser aplicado antes
mesmo da Fase 2 formal, já que sangra dinheiro a cada venda no legado
enquanto a Fase 2 não chega.

**91–93 Figma handoff / protótipos / componentes** — processo de design,
sem cruzamento de código relevante, exceto: `Topbar` como componente já
tem implementação real no legado (`CrmTopbar.tsx`), só que **órfã** (nunca
renderizada hoje) — ao desenhar esse componente no Figma, é "revive e
conserta", não "invente do zero". `Kanban` (Pipeline board via `@dnd-kit`)
e `Timeline` (`LeadTimeline`) também têm implementação real pra servir de
referência de interação.

**94 Matriz de rastreabilidade** — consolida tudo que já foi cruzado nos
blocos anteriores numa tabela única (necessidade→módulo→tela→entidade→
automação→evento→integração). Sem achado novo, é o documento de
referência-mestre uma vez que a reconstrução começar.

**95–100 ADRs** — formalizam decisões já cruzadas:
- **ADR001/002/003** (reconstruir, modular monolith, event-driven) — sem
  novidade, ratificam blocos 64/67/40.
- **ADR004 (Stripe prioritário + Financial Integration Layer durante
  transição)** — ✅ valida exatamente o achado do bloco 42: a própria ADR
  admite que a transição (PBX ainda na Holding/Wive) exige a camada de
  abstração, não assume Stripe puro desde o dia 1.
- **ADR005 (Won baseado em evidência)** — ✅✅ esta ADR é literalmente a
  ratificação formal do fix que **já foi implementado e perdido** (commit
  `2111650`). Achado consistente terceira vez (blocos 15, 40, 70, agora 99)
  — é o item de maior consenso entre blueprint e trabalho já feito no
  legado. Forte candidato a ser a primeira coisa reaplicada no rebuild.
- **ADR006 (IA como infraestrutura)** — ratifica bloco 52.

---

## Blocos 101–107 (recebidos 08/08/2026) — BLUEPRINT COMPLETO

**101 ADR007 (analytics separado do OLTP)** — ratifica bloco 45, sem
novidade.

**102 Pontos em aberto (do próprio autor do blueprint)** —
- **Nenhum bloqueante** pra iniciar arquitetura/Figma, segundo o blueprint.
- **Assinatura eletrônica**: mecanismo definitivo fica pra depois, abstrair
  via `SignatureProvider`. Bate com achado da auditoria: hoje não existe
  fluxo de assinatura nenhum, contrato é só registro de banco com enum de
  status. Sem urgência, só desenhar a interface de abstração agora.
- **Agenda**: "definir provider oficial de calendário" — na prática **já
  existe um de facto hoje**: Microsoft Graph/Outlook (M365 é o ambiente real
  da Callface, closers têm sync de agenda via `outlook-reuniao-sync`,
  round-robin de closer já checa conflito no Outlook). Não é decisão em
  aberto de verdade, é formalizar como `CalendarProvider` abstrato em vez
  de continuar hardcoded ao Microsoft Graph especificamente.
- **Billing PBX**: quando/como migra pra Stripe, não bloqueia o CRM — igual
  ao que já foi registrado no bloco 42/ADR004.

**103–106 (mudança conceitual, visão final, princípio central, blueprint
único)** — sínteses/diagramas consolidando tudo que já foi cruzado nos
blocos anteriores (Command Center→CustomerGraph→Communication→AI Layer→
Automation→Commercial→Won→Customer→CS+Finance→Business Hub). Sem conflito
novo. **105 é a diretriz mais importante de "como pensar" daqui pra
frente**: desenhar em torno de jornada/estado, não de tela — vale usar
isso como critério de aceite de qualquer proposta de UI/fluxo que eu vier
a sugerir.

**107 O que o blueprint significa pra implementação** — ⚠️ **redefine a
relação entre este documento e o current state**: a partir de agora, **o
código atual não é mais referência de como o CRM deve funcionar** — é só
fonte de legado a ser avaliada CONTRA o blueprint. Ou seja, meu papel deixa
de ser "achar meio-termo entre legado e blueprint" e passa a ser: (a)
extrair conhecimento/dado/integração aproveitável do legado, (b) confirmar
onde o código atual já bate com o blueprint por acidente (reuso real), (c)
sinalizar onde o legado faz o oposto do blueprint e precisa ser descartado
mesmo que funcione hoje. O pipeline oficial passa a ser: Blueprint → Domain
Model → DB Schema → API Contracts → Event Contracts → UX IA → Figma →
Screens → Prototype → Implementation → Migration → Validation → Production.

---

## STATUS: Blueprint completo (blocos 01–107 absorvidos, 08/08/2026)

Cruzamento completo contra o current state auditado no mesmo dia. Pergunta
aberta pendente de resposta do Kauã: item 3 da lista abaixo (atribuição de
Lead quando Deal não referencia Lead) ainda não foi respondida e agora é
bloqueante de verdade pro Domain Model formal (próximo passo do pipeline
oficial, bloco 107).

Próximo passo natural segundo o próprio blueprint (107): iniciar o rascunho
do **Domain Model** (entidades + invariantes + máquinas de estado,
consolidando blocos 26/34/37/38/43 com os achados de current state) — ainda
não iniciado, aguardando sinal do Kauã. Kauã está mandando considerações
adicionais sobre Attribution antes disso (ver abaixo) — mais chegando.

---

## DECISÃO — Attribution/Acquisition Layer (08/08/2026, decisão do Kauã)

Resolve a pergunta 3 acima. Registrado aqui porque é decisão arquitetural
fechada, não mais cruzamento de blueprint.

**Decisão**: a atribuição de origem/campanha/UTM **não** depende de
`lead_id` no Deal. Lead e Deal são entidades diferentes; Deal pode existir
depois que o Lead "deixou de existir" na jornada (convertido). Por isso
Attribution é camada de domínio própria, não propriedade exclusiva do Lead.

**Distinção central (a mais importante)**: não confundir origem do LEAD
com origem do DEAL. Um cliente pode entrar por Google, ser engajado por
campanha Meta no meio do caminho, responder WhatsApp, ser qualificado,
receber ligação, entrar em oportunidade, comprar — `deal.source = "Meta"`
perde a metade dessa história. Touchpoints se conectam a **Person/Contact/
Company** (identidade persistente), não ao Lead (entidade transitória) —
por isso a atribuição sobrevive à conversão mesmo quando o Lead operacional
não existe mais.

**Jornada conceitual**: `Campaign/Acquisition Source → Attribution/
Touchpoints → Person/Contact/Company → Deal → Customer → Subscription →
Revenue`.

**Requisitos mínimos da v1** (não é multi-touch algorítmico completo, mas
o schema não pode impedir isso depois):
- campos a preservar: `source`, `medium`, `campaign`, `term`, `content`,
  landing page, referrer, timestamps, campaign/source IDs quando
  disponíveis, tipo de origem (manual/orgânica/indicação/SDR/importação)
- **first touch** e **last touch** explícitos, não só um campo solto
- todas as entradas (site, campanhas, RD Station, cadastro manual,
  importação, outros integradores) alimentam a MESMA camada de
  aquisição/atribuição — não pode ser um campo por integração

**Objetivo de analytics que isso precisa suportar** (funil completo por
campanha, atravessando o lifecycle inteiro):
`Campanha X → leads → qualificados → reuniões → oportunidades → clientes →
MRR`, sem depender de um `lead_id` que deixou de existir na jornada.
Perguntas-tipo: "quanto de MRR a Meta gerou", "qual campanha traz clientes
de ticket maior", "qual origem gera cliente que fica mais tempo", "qual
campanha gera lead mas não gera receita".

**Cruzamento com current state**: confirma que isso é greenfield total
hoje. O legado só tem `utm_*` cru **duplicado** direto em `leads` e
`negocios` (achado do bloco 26 da auditoria de schema), sem distinção
first/last touch, sem conceito de touchpoint, e a atribuição some se o
negócio não herdar via `leadId` — exatamente o problema que essa decisão
resolve de raiz.

**Status**: decisão de modelagem fechada. Aguardando mais considerações do
Kauã antes de desenhar a entidade/tabela formal.

---

## GUARDRAILS FINAIS (08/08/2026) — blueprint declarado maduro pelo Kauã

Kauã encerrou a entrega do blueprint com 10 guardrails + 1 seção nova
(Data Governance) + declaração explícita: "não acho que esteja faltando
outra rodada de discovery" — a pergunta deixou de ser "o que o CRM deveria
ser" e passou a ser "como construímos exatamente o CRM que definimos sem
recriar os problemas do legado". Ordem mandatória confirmada: **modelo de
domínio → banco → contratos de API/eventos → regras de negócio → serviços
→ integração/migração → UX/UI → implementação das telas**. Não começar
pelo front-end.

**Os 10 guardrails — a maioria reforça achados já cruzados, listados por
bloco de origem** (não repetir análise, só apontar onde já está registrado):
1. Fonte da verdade financeira explícita (CRM=comercial, Stripe=financeiro,
   Callface=uso, Business Hub=inteligência) → blocos 42/46/ADR004.
2. Lead≠Contact≠Company≠Customer≠Deal "sagrado" → blocos 26/34/37.
3. Comunicação como Interaction Intelligence → blocos 12/28/43 (camada
   `INTELLIGENCE`).
4. AI SDR como agente com memória/máquina de estados, não automação simples
   → blocos 21/22/24. **Nota**: a máquina de handoff do legado (AI_HANDLING/
   HUMAN_REQUIRED, 4 gatilhos distintos) já é sofisticada — extrair a
   heurística, trocar o modelo de execução (cron sweep → agente reativo a
   evento).
5. Cadência como produto (Cadence Builder) → blocos 19/20/30.
6. Next Best Action → blocos 10/50 (Command Center), cristaliza o
   princípio 105 em entregável concreto.
7. Data Integrity/Reconciliation → blocos 44/82 (Data Quality Layer). **Já
   existe prototipo real pra essa reconciliação Stripe×CRM especificamente**:
   o script `MRR-10` (rodado ad hoc em 30/07 pra medir a duplicidade de
   contrato) já faz o cruzamento contratos↔assinaturas↔Stripe por
   subscription_id — virar isso em job permanente é entrega barata e já
   validada.
8. DealWon impossível de mentir → blocos 15/40/70/99 (quarta vez que esse
   ponto aparece — maior consenso de todo o processo).
9. Personalized Proposal Engine como módulo próprio → bloco 17.
10. CRM API-first/eventos/IDs globais preparado pro ecossistema → blocos
    03/70/107.

**Seção nova — "35 Data Governance & Source of Truth"**: formaliza o bloco
46 (tabela domínio→fonte) **acrescentando a peça que faltava: "quem pode
ESCREVER o quê"**, não só "de onde vem o dado pra leitura". Isso é
literalmente a regra que, se tivesse existido desde o início, teria
impedido o achado da auditoria de schema: campos manuais de MRR/valor
(`mrrEstimado`, `valorSetup` etc.) ainda existem em `leads` E `negocios`,
marcados "legacy" mas nunca removidos — porque nunca houve uma regra
explícita dizendo "só o Financial Core pode escrever valor de receita".

**Pushback de arquiteto (2 pontos, porque foi pedido pra eu questionar
decisão quando houver alternativa melhor, não só validar)**:

1. **Event Layer — não introduzir broker novo.** O guardrail 1 pede "CRM
   consome eventos financeiros" e a arquitetura geral (bloco 40) pede
   Event Bus/Queue. Pra um time de 6 pessoas, a implementação certa é
   **outbox table no Postgres + BullMQ/Redis que já existe** (o worker já
   cobre quase toda a superfície de jobs necessária, bloco 68), não um
   message broker novo (Kafka/RabbitMQ/EventBridge). Dá o desacoplamento
   pedido sem adicionar peça de infra que ninguém no time vai operar bem
   sozinho.
2. **Guardrail 8 (Won à prova de mentira) tem um buraco real com o
   guardrail 1 (PBX ainda fatura pela Holding/Wive, não Stripe) — ver
   bloco 42.** Se Won só aceita `SIGNED_CONTRACT` ou `SUCCESSFUL_PAYMENT`
   (evidência via Stripe/assinatura de contrato), **como fecha uma venda
   de PBX que não passa pelo Stripe** durante a transição? Sem uma terceira
   via de evidência bem definida (ex: atestação manual financeira com
   dupla aprovação + audit log obrigatório, nunca silenciosa), o gate
   correto pra AI vai travar incorretamente vendas de PBX legítimas — ou
   alguém vai pressionar por um jeito de contornar o gate, recriando
   exatamente o problema que o guardrail 8 quer evitar. Vale decidir esse
   terceiro caminho de evidência antes de fechar o Domain Model, não depois.

**Status**: blueprint declarado maduro/completo pelo próprio Kauã. Próximo
passo mandatório segundo ele mesmo: Domain Model formal, antes de qualquer
banco/API/UI. Confirmar com ele se já é sinal de "vai".

---

## CONVERSA ORIGINAL (ChatGPT, camada 1 da hierarquia) — lida por completo em 08/08/2026

Kauã pediu leitura completa de uma conversa ChatGPT compartilhada
(70 mensagens, extraída via Playwright direto do DOM já que o link share
truncava em WebFetch simples — arquivo bruto salvo em
`.playwright-mcp/chatgpt-transcript-decoded.txt` nesta mesma pasta do
vault, útil se precisar reconsultar sem re-extrair). Hierarquia que o Kauã
definiu: **1. Conversa completa > 2. Blueprint > 3. Código atual (current
state) > 4. Minhas análises**. Relatório de leitura completo feito por
agente; pontos que MUDAM ou COMPLEMENTAM o que já estava registrado:

**Decisão de negócio grande, não estava no blueprint escrito**: Kauã
planeja **eliminar o cargo de SDR humano** — considera a pessoa atual
inadequada ("é uma porcaria"). Isso eleva a prioridade real do AI SDR: não
é "mais um canal de automação", é o substituto planejado do time de SDR.
Contexto sensível, registrar com discrição operacional.

**Confirma e reforça pela 5ª vez** (contando as reincidências no blueprint):
regra `WON = SIGNED CONTRACT OR CONFIRMED PAYMENT` nasce diretamente de um
problema admitido pelo próprio Kauã na conversa original — "o time marca
como ganho, às vezes, em cliente que só deu certeza verbal que vai pagar".
Não é hipótese de boas práticas, é correção de um problema real já
confessado.

**"Billing Provider" nunca foi fechado como Stripe-only, mesmo sob pressão**:
em pelo menos 4 pontos da conversa original o ChatGPT resistiu à vontade do
Kauã de cravar Stripe como arquitetura fixa, mantendo sempre a abstração
("Stripe hoje, Holding/PBX/outro amanhã"). Valida e reforça o achado já
registrado (bloco 42/ADR004) — a resistência a essa decisão já aconteceu
uma vez antes, não sou eu inventando cautela nova.

**Company (não Lead) é o "fio condutor"** — frase literal da conversa
original, resolvendo explicitamente a mesma tensão que o achado "Lead God
Object" da minha própria auditoria de schema já sinalizava (schema atual
mistura Lead/Contato/Cliente no mesmo registro).

**Lição de processo importante (achado #14 do relatório do agente) —
LOOPING**: em certo ponto da conversa original, o ChatGPT recomeçou a
apresentar como "próxima etapa" algo que já tinha sido feito páginas atrás
(re-numerou etapas 3 vezes ao longo da conversa, sem nunca reconciliar).
Kauã confrontou direto ("não sei se a gente já tá entrando em looping") e o
ChatGPT admitiu sem rodeio. **Isso é uma regra prática pra mim**: nunca
reapresentar trabalho já feito como se fosse novo, e se something parecer
repetido, dizer isso explicitamente em vez de deixar o Kauã perceber sozinho.

**Achados técnicos de uma auditoria que o ChatGPT fez direto no GitHub —
PRECISAM SER VERIFICADOS contra o código real antes de virar fato** (a
conversa é autoridade pra DECISÃO, mas pra FATO de código atual, minha
própria auditoria/código real vale mais, por isso não assumo isso como
verdade ainda):
- Alegado: **47 assinaturas ativas (~R$15,9 mil/mês) fora do espelho local**
  por falha de relacionamento via `stripeCustomerId` (fallback por email
  teria sido criado depois). Minha auditoria não achou isso especificamente
  — pode ser sintoma do mesmo problema de sync que já achei, ou algo
  adicional. **Verificar antes de agir.**
- Alegado: **85 reuniões de julho travadas em status "agendada"**, mesmo
  com `status_changes` tendo os eventos reais de `reuniao_realizada` —
  relatório mostraria zero reuniões realizadas. Não confirmado na minha
  auditoria. **Verificar antes de agir.**
- Confirma (bate com minha auditoria independente): `marcarPropostaAceita()`
  com múltiplas operações sequenciais não-atômicas; múltiplos campos de
  receita duplicados entre `leads`/`negocios`/`propostas`/`contratos`/
  `assinaturas`/`mrr_movimentos`; `leads.tipo` assumindo contato/lead/cliente
  no mesmo registro; tabela `eventos` confundindo tracking comportamental
  com domain event; 3 gerações de lógica de relatório com 6+ definições
  divergentes de "qualificado" (isso já estava no `AUDITORIA.md` interno,
  bate 1:1). Scorecard informal do ChatGPT: Arquitetura 7/10, Modelo de
  domínio 5/10, Data integrity 5/10, Integrações 8/10, Observabilidade 4/10
  — na mesma faixa do que minha auditoria sugeriu.

**Nuances que não estão no texto final do blueprint**, valem preservar:
- Apresentação comercial personalizada por IA deve operar **dentro de um
  Master Template com blocos controlados** (protege marca/preço/
  posicionamento/compliance) — não é geração livre. Isso refina o bloco 17.
- Fluxo de proposta hoje já gera link Stripe automaticamente, mas o **botão
  de assinatura está admitidamente quebrado** em produção — verificar.
- WhatsApp com IA já foi tentado antes e teve **alucinações documentadas**
  — contexto real por trás da cautela do bloco 4/21/22 sobre handoff.
- Thresholds de desconto (0-5%/5-15%/>15%, bloco 56) foram dados como
  exemplo ilustrativo, não decisão fechada — confirmar valores reais depois.
- 6 seções do blueprint estão marcadas como inferência do ChatGPT, não
  confirmadas literalmente pelo Kauã: 15 (Won), 18 (Contratos), 42 (PBX/
  Holding), 45 (Data Warehouse), 61 (Responsividade), 67 (Backend Modules)
  — provável ordem de prioridade pra validar com ele se surgir dúvida.

**Como o Kauã trabalha** (útil pra colaboração): aprova rápido e informal
quando confia no processo ("manda bala", "continua"), mas corrige na hora e
com precisão quando percebe desvio ou repetição — não deixa acumular
frustração calada. Muda de registro (formal, estruturado) quando o pedido é
crítico/definitivo (o próprio mega-prompt do blueprint é exemplo disso).
Contribui com nuance de operação real quando perguntado, mesmo confiando
bastante no processo. Zero tolerância a sensação de "girar em círculo" —
a pior reação de toda a conversa original foi por causa de looping, não de
erro técnico.

**Status**: conversa original 100% absorvida. Pronto pra seguir como
parceiro de trabalho na reconstrução, não só executor.
