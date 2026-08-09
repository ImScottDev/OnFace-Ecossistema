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

## ADR-EXEC-005 — Documentação da reconstrução vive no repo, não só no vault

**Contexto**: instrução do Kauã — outro agente/sessão precisa retomar sem reconstruir raciocínio, mesmo sem acesso ao vault Obsidian.

**Decisão**: `docs/reconstruction/{RECONSTRUCTION_STATE,ARCHITECTURE_DECISIONS,IMPLEMENTATION_PROGRESS}.md` no repo `callface-crm`, branch de trabalho. Vault (`blueprint-crm2-vs-current-state.md`, `plano-reconstrucao-crm-2.0.md`, `crm-callface-status.md`) continua sendo a fonte de contexto de produto/negócio — o repo é a fonte de execução técnica.
