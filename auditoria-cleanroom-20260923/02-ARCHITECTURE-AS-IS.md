# 02 — ARCHITECTURE AS-IS (Fase 3, derivada do código + banco)

Método: leitura de código + grep estrutural + SELECT no `callface_crm`. Nenhum doc como prova (exceto onde um teste executável depende dele). Caveat: o banco local tem dado real em alguns domínios e zero em outros (ver entregável 04); "0 linhas" pode ser artefato da carga de hoje, não do desenho.

## 1. Domínio canônico
- **Dois eixos paralelos** (não "novo vs velho", mas caminhos de entrega diferentes): `lib/vendas/` (canônico, 8.036 LOC) serve o **Next** (35 imports de components/onface/vendas, só 4 de rotas Hono); `lib/crm/` (legado+commercial core, 9.222 LOC) serve o **Hono** (49 imports de rotas). Ambos REAL E ATIVO.
- **Regras moram em 4 camadas**: (1) rotas Hono — maior repositório (leads.ts 2.110 linhas, relatorios.ts 1.814, clientes-crm2.ts 1.678); (2) `lib/crm/*`; (3) `lib/vendas/*`+packages; (4) worker (~500 linhas de lógica SDR hardcoded).
- **9 packages @onface com código** (REAL MAS PARCIAL — fatias finas): acquisition, sales, catalog (política pura), identity, platform-database, platform-events, platform-storage, integrations-meta (o mais completo, 724 LOC, 11 imports), integrations-callface-ai. **30 stubs `export {}` com 0 importadores** = PLANEJADO MAS AUSENTE.
- **Módulos órfãos/mortos**: `lib/billing/` (contrato BillingProvider pronto, 0 importadores); `lib/storage/` legado (só os 1.980 anexos Zoho); `arquitetura/` (só testes).

## 2. Camada de eventos
- **DOIS publicadores (DUPLICADO consciente)**: `lib/events/outbox.ts::publicarEvento` (21 importadores, best-effort em domain_events) vs `@onface/platform-events` (6 importadores, transacional obrigatório). O próprio código documenta a coexistência.
- **Tabelas de evento**: `event_outbox` (112, REAL E ATIVO), `domain_events` (2.180, 95% backfill), `timeline_events` (14.478, REAL E ATIVO), `vendas_eventos` (0, LEGADO ATIVO no UNION), `eventos_comerciais` (247, ÓRFÃO — 0 escritores/leitores no código).
- **[FATO] Ciclo FECHADO e rodando**: `event-outbox-sweep` a cada 60s → handlers (audit_log 47 tipos) + `dispatchAutomationEvent` (cria cadências) + projeção timeline + entrega Meta CAPI + consumidores nomeados (FulfillmentGroupCompleted→materializa serviço; CanonicalServiceActivated→handoff CS; PaymentFailed→cobrança). Dead-letter real com reprocessamento e alerta. Últimos eventos processados 23/09 11:41. **Há consumidores além de auditoria/timeline.**

## 3. Automações — QUATRO motores (não três)
| Motor | Tabelas | Dado | Status |
|---|---|---|---|
| Regras F5 (`automacao-engine.ts`) | automacoes/execucoes | 0/0 | REAL MAS SEM USO (7 call-sites, 0 regras) |
| Cadence Engine (`cadence-engine.ts`, 54KB) | cadence_definitions/versions/enrollments | 0/0/0 | REAL MAS SEM USO |
| Cadência SDR inbound (legado) | cadencia_execucoes | **1.306** | LEGADO AINDA ATIVO (único com dado) |
| Sequências de e-mail | email_sequencias/passos/execucoes | 0/0/0 | REAL MAS SEM USO |
| (+ retry AI SDR hardcoded no worker = 5º mecanismo) | — | — | — |
Ironia estrutural: o motor genérico que existe para unificar tem 0 linhas; o legado que ele substituiria tem 1.306. A própria API (`automacoes-cadencias.ts`) expõe `mecanismosParalelos` no payload. Consolidação parcial: motor F5 delega ações ao Cadence Engine (`executarAcaoAvulsa`).

## 4. Auth / Autorização
- Sessão NextAuth v5 emitida no Next; **Hono não tem middleware global de auth** — decodifica o JWE do cookie por handler via `getCtx(c)`. `authMiddleware`/`requireAuth` = ÓRFÃOS (0 importadores). Só 4 de 68 rotas sem gate (health, auth, checkouts, nps — por desenho).
- **RBAC populado no banco** (16 permissions, 8 roles, 97 role_permissions, 16/16 user_roles) mas **`temPermissao` checado em só ~10 de 68 módulos** (cs, api-tokens, ai-platform, 6 rotas financeiro Next, v1). 90% da superfície ainda usa a string `usuarios.role` via `isAdminView`. REAL MAS PARCIAL, com fallback para papel legado.
- Front: `middleware.ts` é a única barreira de navegação; grupo GESTAO exige isAdminView; `SDR_HIDDEN`/`CLOSER_HIDDEN` são Sets VAZIOS (SDR/closer veem menu quase inteiro).

## 5. Tenancy
- `organizacao_id` em 142 de 175 tabelas; as 33 sem são isoladas por FK do pai, globais, por usuário, ou de integração externa.
- **DOIS resolvedores de contexto DUPLICADOS**: `lib/auth/tenant.ts::getTenantContext` (Next) vs `api-server/auth.ts::getTenantFromRequest` (Hono) — o código admite "espelha o override". `@onface/platform-tenancy` que unificaria = stub vazio.
- **[FATO] Isolamento é PROCEDURAL, não estrutural**: 127 de 208 mutações não têm `organizacaoId` no WHERE — padrão "guard-then-write" (SELECT com org antes, UPDATE sem). Não achei vazamento explorável na amostra, mas a superfície depende do guard nunca ser removido. Helpers `orgScope`/`pushOwnershipScope` existem, adoção incremental. A trava `escrita-isola-tenant.test.ts` cobra invariante deliberadamente fraco (não exige org no WHERE).
- Cookies `mcrm-org-override` (só super_admin, org validada) e `mcrm-view-as` (gate de dado mais restrito que o de navegação — falha fechado).

## 6. IA / Agentes
- **31 tabelas ai_*: 29 vazias.** Só ai_models (6), ai_agents (2), ai_agent_versions (2, ambas `draft`). ai_agent_runs=0.
- Pipeline de execução REAL (gateway multi-provider groq/openai/anthropic/google, executor, tools registry, permissão delegada, prontidão) MAS **nunca executou** (0 runs). = REAL MAS PARCIAL.
- 29 endpoints em `ai-platform.ts` = CRUD completo sobre tabelas vazias = PLANEJADO MAS AUSENTE.
- AI SDR: código real, `ai_sdr_config=0` → 3 sweeps rodam vazios = REAL MAS DESLIGADO. Usa Groq (não OpenAI, com trava).
- Carol: heurístico puro, **não é IA** (declarado no código). REAL E ATIVO.

## 7. Storage — 3 caminhos
- `file_objects`/`file_links` + `lib/arquivos/servico.ts` = REAL E ATIVO mas **backend disco local** (adaptador S3/R2 PLANEJADO MAS AUSENTE — 0 registros são do snapshot).
- `anexos` (só metadado) REAL E ATIVO; `anexos_legado` (1.980, Zoho) LEGADO ATIVO (único com dado).
- Pegadinha: rewrite `/uploads/*`→`/api/uploads/*` aponta para prefixo sem route handler Next (só Hono); Traefik resolve em prod, `next dev` não reprocessa.

## 8. As 26 travas de arquitetura (+5 fora da pasta)
- 22 cobram invariantes reais (destaque: #11 `escritores-migrados` 12 testes — a mais forte; #3 `botao-nao-aponta-pro-vazio`; #18 `metrica-definicao-unica`; #16 `link-nao-leva-pro-vazio`).
- 3 hiperespecíficas (travam 1 feature: loops, risco, entrega-fase).
- **1 trivial: `fronteiras.test.ts`** — passa trivialmente com packages vazios (o próprio arquivo admite); a guarda `>10` é satisfeita pelos 14 stubs `export {}`; testes de proibição de import varrem só 7 arquivos reais; o teste de `intelligence` varre zero.
- Fora da pasta: `rotas-consumidas`, `roteamento-traefik` (cruza 3 composes × next.config × rotas — forte), `webhooks-fail-closed`, `api-publica`.

## 9. BFF / Camadas — TRÊS caminhos de dado simultâneos
- **A) browser → /api → Traefik → Hono :3001 → PG** (DOMINANTE, 101 arquivos / 228 fetches)
- **B) browser → RSC/Server Action → @/lib → PG no Next** (EXCEÇÃO — bloco vendas: pre-vendas, pipeline, contatos, propostas [escrita!], clientes/implantação, risco, tarefas, relatórios; 28 páginas com @/lib/db direto)
- **C) browser → /api/{auth,webhooks,financeiro,onboarding,campanhas,contratos-publicos} → Next route handler → PG** (ALLOWLIST — 20 handlers)
- **A regra de partição é o Traefik, não o código.** As rotas Next fora da allowlist são "código morto em prod" (declarado). Não existe BFF; existe partição por prefixo de URL na infra, com o Next acumulando 3 papéis. `/api/meta/resolve` é ÓRFÃO (fora da allowlist, sem rota Hono).

## 10. Filas BullMQ — 14 filas, 24 jobs
- 7 filas com produtor real de rota/action (lead-scoring, notifications, whatsapp-incoming/outgoing/status, enrichment, site-lead-qualify, callface-call-events).
- **3 ÓRFÃS/placebo**: `conversion-sync` e `follow-up` (corpo = console.log, zero .add no repo); `stripe-webhook-events` (sem produtor, alcançado por polling).
- Jobs rodando sobre tabelas vazias: ai-sdr-* (3), cadence-sweep, check-sequences, callface-ai-sync, snapshot-diario, cs-sweep.

## DUPLICADO (consolidado — 15 itens)
Publicador de evento (2) · motor de automação (4-5) · representação de "sequência no tempo" (5) · resolução de tenant (2) · gate de autorização (3: isAdminView/temPermissao/papel-legado) · timeline (UNION de 4 fontes) · modelo de identidade (leads/contatos/empresas vs aquisicoes/pessoas/pontos_contato) · modelo de oportunidade (negocios vs oportunidades) · bibliotecas de componente (crm/crm2/onface/ui, 91.666 LOC) · shells de rota (crm/crm2/onface-preview/onface-desenho) · pool de conexão (lib/db vs worker) · registro de filas · camada de anexo (3) · adapter de e-mail · **montagem repetida de rotas Hono** (anexos, anexos-legado, fulfillments, fulfillment-formulario montados 2× em server.ts).

## PLANEJADO MAS AUSENTE (consolidado)
`apps/*` (não existe no disco) · script `arq:fronteiras` (`checar-fronteiras.ts` inexistente, referenciado por 30 stubs) · 30 packages stub · platform-tenancy/permissions/jobs/observability/shared-ui · adaptador S3/R2 · lib/billing ligado ao domínio · publicação de agente IA (0 runs) · 29 tabelas ai_* + rotas · migração dos motores de cadência (fase declarada não feita) · orgScope adotado (127 escritas sem filtro) · authMiddleware Hono montado · fim do dual-write (fase 25) · saída de vendas_eventos do UNION (fase 26).

## Integridade
Zero drift de schema (173 pgTable = 173 tabelas). 91 migrations aplicadas. **A integração mais madura é a Meta** — único caso onde pacote + adapter + consumidor outbox + dado real fecham o ciclo inteiro.
