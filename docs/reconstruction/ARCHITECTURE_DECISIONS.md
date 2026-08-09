# Callface CRM 2.0 — Architecture Decision Records

Formato curto: contexto → decisão → consequência. ADRs numeradas herdadas do blueprint (`blueprint-crm2-vs-current-state.md`, vault) mantêm a numeração original quando aplicável; novas decisões tomadas durante a execução recebem `ADR-EXEC-NNN`.

---

## ADR-EXEC-001 — Event bus: outbox Postgres + BullMQ existente, sem broker novo

**Contexto**: blueprint pede arquitetura orientada a eventos (ADR003 original). Time de 6 pessoas, já opera BullMQ/Redis.

**Decisão**: implementar Event Outbox como tabela Postgres (`event_outbox`) escrita na mesma transação da mudança de domínio, consumida por worker BullMQ. Não introduzir Kafka/RabbitMQ/EventBridge.

**Consequência**: desacoplamento real sem nova peça de infra pra operar. Se volume/latência exigir mais no futuro, é decisão a revisitar — não hoje.

---

## ADR-EXEC-002 — Terceira via de evidência de "Won" para PBX — arquitetura RESOLVIDA (09/08), calibração de política ainda pendente

**Contexto**: guardrail "Won só com contrato assinado ou pagamento confirmado" (blueprint bloco 15/99) assume evidência via Stripe/assinatura. PBX fatura pela Holding/Wive, fora do Stripe.

**Atualização 09/08 (revisão do Kauã)**: o gap arquitetural está resolvido — ver ADR-EXEC-012 (Commercial Evidence Policy). O que falta agora é só CALIBRAÇÃO de negócio (quais tipos de evidência valem pra produto='pabx' — ver `won_evidence_policies`), não construção. Registrado em `crm2-decisoes-pendentes.md`.

**Decisão original (mantida como contexto histórico)**: atestação manual financeira com dupla aprovação + audit_log obrigatório (nunca silenciosa), como terceiro caminho de evidência só pra `produto='pabx'` — a "dupla aprovação" é exatamente o tipo de calibração fina que ainda não foi decidida (o default construído usa aprovação única de admin/gerente, reversível).

**Dado real pra informar a decisão (09/08, gate já implementado em `negocios.ts`)**:
dos 425 negócios `status='ganho'` no banco local, 158 (37%) não têm nenhuma
evidência (nem proposta aceita, nem contrato). 143 desses 158 (90%) têm
`zoho_id` — são legado importado, não atividade recente. Só ~15 são de fato
recentes/sem zoho_id, distribuídos esparsamente (2-5/mês nos últimos meses)
— provavelmente os casos reais de PABX/venda manual. **O gate implementado
não afeta dado histórico** (só bloqueia transição NOVA sem evidência) —
esses ~15/mês são o tamanho real do problema que a terceira via de
evidência (ADR pendente) precisa resolver, não é volume alto.

**Bloqueia**: fechamento pleno de F4 (Commercial). Não bloqueia F0-F3.

---

## ADR-EXEC-003 — Schema V2 em paralelo, não refatoração do schema legado

**Contexto**: já era a recomendação que surgiu na conversa original (ChatGPT) quando o risco de "refatorar banco vivo" foi pesado contra "criar schema novo ao lado". Bate com o princípio de strangler pattern do blueprint (bloco 65).

**Decisão**: tabelas novas do Domain Model (Contact/Company/Deal v2/Attribution/Customer) nascem como tabelas novas, convivendo com `leads`/`negocios` legado via dual-write até corte controlado na F8.

**Consequência**: mais tabelas temporariamente, mas zero downtime e zero corrida contra o tempo pra migrar tudo de uma vez.

---

## ADR-EXEC-004 — Verificação de achados técnicos: dado real de produção via `refresh-dev-db.sh`, não suposição

**Contexto**: 2 achados técnicos vieram de uma auditoria feita pelo ChatGPT lendo o repositório (não validado independentemente). Hierarquia definida pelo Kauã: conversa > blueprint > código real > análises.

**Decisão**: todo achado técnico é verificado por query direta no banco local (espelho real de produção via `refresh-dev-db.sh`) antes de entrar em qualquer plano de correção.

**Resultado da verificação (08/08/2026)**:
- MRR duplicado: CONFIRMADO, 36 pares ativos, R$17.449,30/mês de excesso (cresceu de R$12.092,70/16 pares em 30/07 — bug segue ativo).
- Reuniões travadas em "agendada": CONFIRMADO, 53 reuniões de julho.
- Assinaturas fora do espelho (~47, ~R$15,9k): NÃO reproduzido — descartado como achado atual.
- `organizacao_id` nullable em tabela financeira: schema permite, mas 0 violação real — constraint `NOT NULL` aplicável sem backfill.

---

## ADR-EXEC-006 — Rewrite de paridade dev/produção no roteamento Next↔Hono

**Contexto**: a auditoria original caracterizou as rotas Next.js duplicadas
(`app/src/app/api/*`) como "código morto em produção" porque o Traefik
roteia `/api/*` (exceto `auth`/`webhooks`/`financeiro`/`onboarding`/
`campanhas`) direto pro container Hono. **Isso é verdade só em produção.**
Em `next dev` local não existe Traefik — o frontend chama `fetch("/api/...")`
relativo, que cai na porta 3000 (Next), executando exatamente as rotas
"mortas". Verificado empiricamente: `/api/tarefas` (só existe no Hono) via
`:3000` sem este fix daria 404; com o fix, responde igual ao Hono direto.

**Decisão**: `next.config.ts` ganha um `rewrite` condicional a
`NODE_ENV === "development"` que espelha EXATAMENTE a regra do Traefik
(`docker-compose.yml`, routers `callface-crm`/`callface-crm-api`),
proxyando `/api/*` (com a mesma lista de exceções) pra
`http://localhost:${HONO_API_PORT || 3001}`. Em produção o rewrite nem
entra em jogo pra esses paths — Traefik já intercepta antes da request
chegar no processo Next.

**Consequência**: dev local passa a testar exatamente o caminho que
produção executa (Hono como autoridade real). Isso destravou a remoção seg­
ura das 101 rotas Next.js duplicadas (antes disso, deletá-las teria
quebrado o dev local, mesmo sendo seguro em produção).

---

## ADR-EXEC-008 — Branch `homolog` atual é backup do Kauã, NÃO é target de deploy do CRM 2.0

**Contexto**: investigando como sincronizar F0 pro ambiente de homolog,
descobri que a branch git `homolog` (origin/homolog, commit `2bcca3d`
"freeze do estado real de homolog 07/08") não é simplesmente "main
atrasado" — é uma bifurcação deliberada que captura o estado real do
servidor de homolog em 07/08, incluindo WIP nunca decidido: módulo CS/
Onboarding completo (revertido em prod, mas nunca saiu do filesystem de
homolog), `callpilot-trigger.ts` pausado, e — achado valioso — **o fix de
MRR duplicado completo e FUNCIONAL** (`lib/crm/contratos.ts`:
`avaliarContratosAtivosDoLead`/`marcarContratoRenovado`, wired de verdade em
`lib/crm/aceitar-proposta.ts` e `api-server/routes/contratos.ts` — não só
existindo solto como no `wip/local-pre-sync`). O próprio commit de freeze
avisa um risco real: `LossReasonModal.tsx` (feature ATIVA em produção) não
existe nessa branch.

**Decisão (confirmada pelo Kauã, 09/08)**: essa branch/ambiente é backup
intencional dele — ele vai revisar com calma depois e decidir o que
aproveitar. **Não integrar, não fazer merge, não tocar.** O CRM 2.0 precisa
de um ambiente de homolog PRÓPRIO, novo, separado desse.

**Valor pra depois**: quando chegar a Fase 4 (Won gate + fix de MRR), a
implementação de referência de `avaliarContratosAtivosDoLead` já existe
pronta e testada nessa branch — vale revisar como ponto de partida quando
o Kauã autorizar, em vez de reprojetar do zero.

---

## ADR-EXEC-009 — Fix do endpoint AI SDR (OpenAI→Groq) + achado de credencial inválida

**Contexto**: achado confirmado na auditoria original — `lib/ai/sdr.ts` chamava
`api.openai.com` com nome de modelo Groq (`llama-3.3-70b-versatile`), sem
`OPENAI_API_KEY` documentada em nenhum lugar do projeto.

**Decisão/fix**: `callAiSdr` agora chama `api.groq.com/openai/v1/chat/completions`
de verdade, lê `GROQ_API_KEY` (não mais fallback pra `OPENAI_API_KEY`), e
ganhou fallback em cascata de 3 modelos Groq (mesmo padrão já validado em
`worker/index.ts` no job `site-lead-qualify` — rate limit independente por
modelo).

**Achado real, não resolvido por mim (precisa do Kauã)**: testei a chamada
de ponta a ponta com a `GROQ_API_KEY` real do `.env` local — o request agora
chega corretamente no Groq (confirmado: a resposta de erro vem do próprio
Groq, `invalid_api_key`, não mais um 404 genérico do OpenAI), mas **a chave
armazenada está inválida/expirada**. Confirmado via `curl` direto, isolado
do código (mesmo resultado). Isso não é bug de código — é credencial que
precisa ser renovada no console da Groq e atualizada no `.env` (local e,
quando chegar a hora, homolog/produção). **Bloqueia validar o AI SDR de
ponta a ponta de verdade até isso ser resolvido.**

**Consequência**: o código está corrigido e verificável estruturalmente
(endpoint/modelo/formato certos), mas não posso confirmar que a Natália
"funciona" de ponta a ponta sem uma chave válida — ficaria sendo suposição.

---

## ADR-EXEC-010 — Investigação da causa raiz do "Missing Owner" recorrente (F6)

**Contexto**: o Data Quality Layer (F6) achou 54 leads `tipo='lead'` sem
`responsavel_id` — inicialmente li isso como "o bug de 03/08 (18 leads)
recorrendo e crescendo", o que seria preocupante (fix quebrado).

**Investigação (09/08)**: os 54 leads têm **origem='outbound'**,
**sdr_status='pending'** (nunca avançou), e — o dado decisivo — **o EXATO
MESMO `created_at`** até o microssegundo (`2026-08-05 18:53:54.647357-03`).
Isso não é criação orgânica um a um pela aplicação — é um **INSERT em lote
único**, de um script/import externo, 4 dias antes desta sessão. Confirmado
que nenhum ponto do código atual (`grep` completo por `"outbound"`) cria
lead com essa origem — os 3 lugares que usam essa string só a CONSOMEM
(filtro de relatório/meta), nunca a escrevem. "outbound" é valor
reconhecido pelo sistema de relatórios, mas não é produzido por nenhuma
rota/webhook/worker existente hoje.

**Conclusão real**: **não é o mesmo bug de 03/08 recorrendo** — aquele fix
(fallback reativo, dispara quando `sdr_status` muda) continua funcionando
pra qualquer lead que passe pelo fluxo normal da aplicação. Este é um
evento distinto: alguém (Kauã ou outro processo) rodou um import em lote
de prospecção fora do código da aplicação, sem preencher responsável.
Mesmo SINTOMA (Missing Owner), causa raiz DIFERENTE — não precisa de fix
de código, precisa de decisão humana de reconciliação (atribuir os 54 a
alguém, mesmo padrão do backfill de 03/08). **Não fiz essa reconciliação
sozinho** — fica registrada aqui pra decisão do Kauã, mesmo critério de
"correção em massa exige checkpoint humano" já aplicado o resto da sessão.

---

## ADR-EXEC-011 — Analytics separado da OLTP: snapshot pré-computado, não reimplementação de agregação (F6)

**Contexto**: F6 pedia "Analytics separado do OLTP" — o dashboard hoje
recomputa ~10 blocos de query síncrona a cada page load. Ao ler o código
real (`dashboard/page.tsx`, 780 linhas), achei um risco maior do que o
escopo sugeria: os números agregados de empresa não são um cálculo simples
— têm comentário explícito documentando um bug real já corrigido em 22/07
("card somava mrr + valor_projeto e dava R$27.270 quando a meta mostrava
R$18.177, o projeto de um híbrido entrava dobrado"). Existem fontes
CANÔNICAS já estabelecidas pra evitar recorrência (`getFechadoPeriodo`,
`getPipelineAtual`, MRR = espelho do Stripe, nunca soma de contratos do
CRM).

**Decisão**: em vez de reimplementar a agregação numa tabela de projeção
(risco real de reintroduzir o mesmo tipo de bug de contagem duplicada que
já causou dor nesse projeto — MRR duplicado, card de meta errado), o
módulo novo (`lib/analytics/snapshot-diario.ts`) **chama as mesmas funções
canônicas** já usadas pelo dashboard e só cacheia o resultado em
`metricas_diarias` (job agendado, 1h). Escopo desta rodada: só o agregado
de EMPRESA (visão admin, `soMeu=false`) — os números pessoais/por-usuário
do dashboard são naturalmente baratos e já ficam de fora.

**Consequência**: infraestrutura de projeção real, construída e validada
(todos os 7 campos do snapshot bateram exatamente com os números já
confirmados visualmente no dashboard em F7 — meta, pipeline, fechado do
mês, MRR Stripe, MRR em risco). O dashboard **ainda lê direto da OLTP**
— não foi trocado pra ler do snapshot nesta rodada (strangler pattern,
mesmo critério do resto do projeto: construir em paralelo, só trocar
depois de rodar de verdade por um tempo e o Kauã validar). Endpoint de
leitura novo: `GET /api/relatorios/snapshot-diario` (calcula on-demand se
ainda não rodou hoje pra aquela org, não fica vazio esperando o cron).

**Pendência registrada**: trocar o dashboard pra ler do snapshot em vez de
recomputar — decisão futura separada, não decidida agora.

---

## ADR-EXEC-012 — Commercial Evidence Policy: Won desacoplado de Stripe (F4)

**Contexto**: revisão do Kauã (09/08) sobre o relatório de duplicidade de contratos identificou o achado mais importante da sessão — Stripe não pode ser tratado como fonte universal de receita da Callface. É fonte da verdade do que é faturado *pelo Stripe*; PBX/venda manual fatura fora dele. O gate de Won anterior (ADR original, "proposta aceita OU contrato existente") já não acoplava a Stripe diretamente, mas também não tinha um caminho extensível pra registrar QUALQUER tipo de evidência futura — só sabia checar 2 tabelas específicas.

**Decisão**: Won não é mais `if (evidência específica) won = true` — é uma pergunta genérica: "esse negócio tem evidência comercial válida conforme a política do produto dele?". Arquitetura:
- `comercial_evidencia` (tabela nova): registro tipado de evidência por negócio — `tipo` (`stripe_payment` | `stripe_subscription` | `signed_contract` | `manual_contract` | `admin_approval`), `sourceRef`, `metadata`, `verificadoPor` (null = automático).
- `won_evidence_policies` (tabela nova): por org × produto (produto=null = catch-all), define quais tipos de evidência valem. Sem política configurada, cai num default idêntico ao comportamento anterior (nunca regride).
- `lib/crm/won-evidence.ts`: `avaliarEvidenciaWon()` (usado pelo gate), `registrarEvidencia()` (chamado nos pontos reais de origem — hoje: `aceitar-proposta.ts` registra `signed_contract`), `registrarEvidenciaManual()` (endpoint novo `POST /negocios/:id/evidencia-manual`, admin/gerente, sempre audit-logado — a via PBX/manual).
- Fallback lazy: se um negócio nunca passou por um ponto que registra evidência (dado histórico, ou caminho ainda não coberto como `stripe-sync.ts`), o gate cai no critério legado (proposta aceita OU contrato existente) e AUTO-REGISTRA a evidência retroativamente — sem precisar de script de backfill em massa.

**O que NÃO foi decidido (calibração de negócio, registrada em `crm2-decisoes-pendentes.md`)**: quais tipos de evidência valem pra `produto='pabx'` — a política catch-all seedada hoje é idêntica ao comportamento anterior (`signed_contract`/`stripe_subscription`/`stripe_payment`), então PBX ainda não consegue fechar via `admin_approval` até alguém inserir uma linha em `won_evidence_policies` pra `produto='pabx'` incluindo esse tipo. Validado com dado real (script descartável): evidência manual registrada e auditada corretamente, mas o gate CONTINUA bloqueando até a política aceitar aquele tipo — prova que a política é real, não um carimbo.

**Escopo não coberto nesta rodada**: `stripe-sync.ts` (contrato criado direto de assinatura Stripe, fora do fluxo de proposta) não registra evidência explicitamente — os contratos criados ali frequentemente não têm `negocioId` (não passam por negócio), e a MRR-fix já validada nesse arquivo é sensível o suficiente pra não arriscar tocar sem necessidade real agora. O fallback lazy já cobre os casos onde o contrato tem `negocioId`.

---

## ADR-EXEC-013 — Cadence Engine: arquitetura construída sem esperar credencial de IA (F5)

**Contexto**: instrução explícita do Kauã (09/08) — "não espere a Groq para construir a arquitetura [do Cadence Builder]... a validação real do agente fica bloqueada pela credencial, mas a arquitetura não". A cadência real hoje existe de 2 formas independentes, cada uma reimplementando sua própria noção de "quando é a próxima tentativa": (1) `cadencia/sdr-inbound.ts` — 13 toques hardcoded, disparo manual pelo SDR; (2) `runAiSdrRetrySweep` no worker — 2 tiers de retry (24h/40h) com lógica de `if` embutida direto na função que também chama a IA e envia WhatsApp, tudo junto.

**Decisão**: construir um motor de cadência genérico (`lib/cadencia/cadence-engine.ts`) — state machine com steps tipados (`wait` | `action`), branching por condição (reusa `avaliarCondicao`, extraído de `automacao-engine.ts` pra um módulo compartilhado `lib/crm/condicao.ts` — mesma gramática, uma implementação só), retry com backoff configurável por step, cancelamento auditável, e um registry de **adapters** (`registrarAdapter(nome, fn)`) — "chamar a IA" é só mais um adapter possível, o engine não sabe nem precisa saber que existe Groq/OpenAI/WhatsApp/email. Schema novo: `cadence_definitions` (steps como grafo jsonb) + `cadence_enrollments` (instância rodando, por entidade) + `cadence_enrollment_events` (audit trail). Sweep periódico no worker (`cadence-sweep`, 5min) já rodando de verdade.

**Validado com dado real** (2 scripts descartáveis, removidos): grafo de 3 steps com branch condicional (pulou um step com base em `vars` atualizado pelo step anterior), retry com 2 falhas simuladas + backoff + sucesso na 3ª tentativa, audit trail completo e correto, cancelamento com motivo, idempotência de enrollment (não duplica), e o sweep pegando exatamente o enrollment vencido e ignorando o que estava agendado pro futuro.

**O que NÃO foi feito (decisão consciente, não corte de escopo por pressa)**: migrar a cadência real do AI SDR ou do SDR inbound pra rodar em cima deste motor. Isso mudaria comportamento de um fluxo de receita que já funciona em produção (mesmo que localmente) — é o tipo de corte que merece ser feito com cuidado e validação (idealmente com a credencial Groq renovada pra testar E2E de verdade), não decisão unilateral só porque a arquitetura ficou pronta. O motor existe, testado, sem nenhum enrollment real usando-o ainda — zero risco de regressão nos 2 sistemas que já funcionam.

---

## ADR-EXEC-007 — Data Governance: quem escreve o quê

**Contexto**: guardrail 35 do blueprint ("Data Governance & Source of
Truth") — não é só "de onde vem o dado pra leitura" (isso já existia no
bloco 46), é **quem tem autoridade de ESCREVER**. Sem essa regra explícita,
o legado acumulou campos manuais de receita (`leads.mrrEstimado`,
`negocios.valorSetup` etc.) que nunca deveriam ter existido como fonte
paralela.

**Decisão** — tabela de autoridade de escrita por domínio:

| Domínio | Quem escreve | Quem só lê |
|---|---|---|
| Identidade (usuarios/organizacoes/teams) | Admin/Operations via `/admin/*` | Todo o resto |
| Lead/Contact/Company/Deal (comercial) | CRM (rotas Hono `api-server/routes/*`) | Analytics, Business Hub (futuro) |
| Attribution/Touchpoints | Lead Intake Layer (F1), nunca UI direta | CRM, Analytics |
| Comunicação (Call/WhatsApp/Email) | Integrações (`lib/integrations/*`) + worker | CRM, AI |
| MRR/Assinatura/Fatura/Contrato (valor) | **Só** `stripe-sync.ts`/webhook Stripe + fluxo de aceite de proposta. **Nunca** campo manual editável em tela. | CRM (exibe), Financeiro, Business Hub |
| Won/Lost (`negocios.status`) | Endpoint de ação explícito (`PATCH /negocios/:id`, F4 evolui pra `/deals/:id/win` dedicado) validando evidência (contrato/pagamento) | Analytics |
| Audit Log / Event Outbox | Escrito pelo próprio código de domínio na mesma transação, nunca editado depois | Observability, compliance |
| CS/Onboarding/Finance/Business Hub (futuro) | Cada sistema é dono do próprio domínio; CRM só publica evento, nunca escreve direto lá | — |

**Consequência prática imediata**: os campos legacy de valor manual em
`leads`/`negocios` (`mrrEstimado`, `valorSetup`, `valorProjeto`,
`mrrFechado`, já marcados "legacy" no schema desde a auditoria original)
**não devem receber nova escrita** a partir de F1 — ficam congelados como
histórico até serem removidos na migração de F8. Nenhuma tela nova deve
escrever neles.

**Enforcement hoje**: convenção documentada + code review, não constraint de
banco (não dá pra impedir INSERT/UPDATE num campo texto/decimal via schema
sem trigger). Se isso continuar sendo violado na prática, uma trigger de
banco ou uma camada de write-guard fica como candidato de F1+.

---

## ADR-EXEC-005 — Documentação da reconstrução vive no repo, não só no vault

**Contexto**: instrução do Kauã — outro agente/sessão precisa retomar sem reconstruir raciocínio, mesmo sem acesso ao vault Obsidian.

**Decisão**: `docs/reconstruction/{RECONSTRUCTION_STATE,ARCHITECTURE_DECISIONS,IMPLEMENTATION_PROGRESS}.md` no repo `callface-crm`, branch de trabalho. Vault (`blueprint-crm2-vs-current-state.md`, `plano-reconstrucao-crm-2.0.md`, `crm-callface-status.md`) continua sendo a fonte de contexto de produto/negócio — o repo é a fonte de execução técnica.
