# Callface CRM 2.0 — Architecture Decision Records

Formato curto: contexto → decisão → consequência. ADRs numeradas herdadas do blueprint (`blueprint-crm2-vs-current-state.md`, vault) mantêm a numeração original quando aplicável; novas decisões tomadas durante a execução recebem `ADR-EXEC-NNN`.

---

## ADR-EXEC-001 — Event bus: outbox Postgres + BullMQ existente, sem broker novo

**Contexto**: blueprint pede arquitetura orientada a eventos (ADR003 original). Time de 6 pessoas, já opera BullMQ/Redis.

**Decisão**: implementar Event Outbox como tabela Postgres (`event_outbox`) escrita na mesma transação da mudança de domínio, consumida por worker BullMQ. Não introduzir Kafka/RabbitMQ/EventBridge.

**Consequência**: desacoplamento real sem nova peça de infra pra operar. Se volume/latência exigir mais no futuro, é decisão a revisitar — não hoje.

---

## ADR-EXEC-002 — Terceira via de evidência de "Won" para PBX — PENDENTE, não fechada

**Contexto**: guardrail "Won só com contrato assinado ou pagamento confirmado" (blueprint bloco 15/99) assume evidência via Stripe/assinatura. PBX fatura pela Holding/Wive, fora do Stripe.

**Decisão**: **ainda não tomada**. Proposta em avaliação: atestação manual financeira com dupla aprovação + audit_log obrigatório (nunca silenciosa), como terceiro caminho de evidência só pra `produto='pabx'`.

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
