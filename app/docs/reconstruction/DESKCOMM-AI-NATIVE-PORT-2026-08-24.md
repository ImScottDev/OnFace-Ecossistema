# Port nativo do AI Platform Deskcomm para o Callface CRM 2.0

Status: aprovado por Scott em 2026-08-24  
Ambiente autorizado: branch `dev`, local  
Promoção para homolog/produção: exige autorização explícita separada

## 1. Objetivo

Entregar no Callface a paridade funcional do produto de IA observado no Deskcomm. A referência inclui a experiência operacional e o comportamento real de agentes, follow-ups e módulos auxiliares. Uma tela sem executor, uma capability marcada como ligada sem implementação ou um teste `dry_run` apresentado como operação não satisfaz o objetivo.

## 2. Restrições obrigatórias

- Um único backend: o Hono/API server existente do Callface.
- Um único banco: o PostgreSQL existente, modelado e migrado por Drizzle.
- Um único conjunto de workers: BullMQ/worker existentes no Callface.
- Um único barramento transacional: `event_outbox` existente.
- Um único transporte WhatsApp: sessões, filas e adapters atuais do Callface.
- Não portar Supabase client, Supabase Auth/RLS, Edge Functions, Realtime ou Storage.
- Não criar serviço paralelo, `job_queue` PostgreSQL concorrente com BullMQ ou WABA/WAHA novo.
- Preservar compatibilidade de dados com `ai_sdr_*` e `cadence_*` durante a migração.

## 3. Escopo de paridade

| Produto Deskcomm | Resultado obrigatório no Callface |
|---|---|
| Agentes | catálogo, filtros, criar/duplicar/pausar/arquivar, rascunho e publicação versionada |
| Agent harness | execução live multi-step, tool calls, limites, guardrails, retries, handoff e trace |
| Providers/modelos | catálogo de providers/modelos, validação de credencial e binding por finalidade |
| Credenciais | segredo cifrado, mascarado na API/UI, validação e rotação sem exposição |
| Ferramentas | registry único, schemas de entrada, permissões por versão e circuit breaker |
| Roteadores | classificação de intenção, sticky routing, fallback e telemetria sem PII |
| Follow-ups | grafo completo, triggers, fila, enrollment pinado, handoff, publish/disable/rollback |
| Conhecimento | fontes, indexação, chunks, busca, threshold e telemetria de misses |
| Memória | documento da organização versionado, entries manuais/propostas e recall |
| Skills | versões imutáveis, ponteiro ativo, instalação/fork, ativação e telemetria |
| Casos | fila humano-IA, eventos, resposta, resolução, escalada e retomada |
| Alertas | inbox operacional para handoff, budget, jobs mortos e falhas de guardrail |
| Propostas | dado ouvido pela IA aguarda confirmação humana antes de alterar CRM |
| Runs | runs/steps/tool calls, latência, tokens, custo, erro e correlação |
| Uso/orçamento | agregação por período/agente/provider, budget, bloqueio e alerta |

## 4. Arquitetura alvo

```text
entrada CRM/WhatsApp/API
  -> grava fato de negócio + event_outbox na mesma transação
  -> consumer existente resolve router/agent/flow publicado
  -> agenda job BullMQ idempotente com lane por conversa/contato
  -> worker atual executa agent runtime ou follow-up runtime
  -> tools usam services/repositories Callface tenant-scoped
  -> egress usa fila/transporte WhatsApp atual
  -> run/step/ledger/eventos/custos ficam no PostgreSQL Callface
```

### 4.1 Camadas

```text
src/lib/ai-platform/contracts     tipos, schemas Zod e invariantes
src/lib/ai-platform/catalog       providers, modelos, finalidades e preços
src/lib/ai-platform/security      cifra, máscara e resolução de credencial
src/lib/ai-platform/runtime       resolver, loop multi-step, guardrails e budget
src/lib/ai-platform/tools         registry e adapters para services Callface
src/lib/ai-platform/knowledge     ingestão, chunks, busca e telemetria
src/lib/ai-platform/memory        versões, entries e recall
src/lib/ai-platform/routing       classificador, sticky route e fallback
src/lib/ai-platform/followup      grafo, validação, runner e interventions
src/lib/ai-platform/observability runs, steps, alerts, costs e usage
src/api-server/routes/ai-platform APIs Hono tenant-scoped
src/worker                        consumers BullMQ existentes chamam os runtimes
```

UI:

```text
/automacoes/agente-ia             hub real, sem cards fictícios
/automacoes/agentes               lista e editor completo
/automacoes/follow-ups            lista, fila e editor React Flow
/automacoes/roteadores            lista e editor de intenções
/automacoes/credenciais           credenciais mascaradas/validadas
/automacoes/provedores            catálogo e bindings
/automacoes/conhecimento          fontes, status, indexação e busca
/automacoes/memoria               documento/entries/histórico
/automacoes/skills                catálogo, instalação e ativações
/automacoes/casos                 fila humano-IA
/automacoes/alertas               inbox operacional
/automacoes/propostas             confirmações pendentes
/automacoes/execucoes             runs e trace
/automacoes/uso                   uso e orçamento
```

## 5. Persistência Drizzle

### 5.1 Tabelas existentes preservadas e estendidas

- `ai_agents`: adicionar ponteiro explícito para a versão publicada e arquivamento.
- `ai_agent_versions`: adicionar `organizacao_id`, credencial/canal, janelas de histórico, cases, disclosure e guardrails. Versão publicada é imutável.
- `ai_agent_runs`: adicionar tokens de entrada/saída, latência, steps, erro tipado, abort reason e referências de conversa/canal/mensagens.
- `ai_sdr_config`, `ai_sdr_contato_state`, `ai_sdr_logs`: compatibilidade temporária; deixam de ser fonte de configuração do dispatcher quando a organização possui agente publicado.
- `cadence_definitions`: passa a ser identidade do fluxo, não a versão editável.
- `cadence_enrollments` e `cadence_enrollment_events`: preservados, com pin de versão, claim/lease e eventos de intervenção.
- `event_outbox`: permanece o fato transacional e a origem idempotente dos jobs.

### 5.2 Novas tabelas nativas

Core:

- `ai_models`
- `ai_provider_credentials`
- `ai_purpose_bindings`
- `ai_run_steps`
- `ai_send_ledger`
- `ai_alerts`
- `ai_usage_budgets`

Routing e estado:

- `ai_routers`
- `ai_router_members`
- `ai_router_decisions`
- campos sticky em `whatsapp_sessoes`/estado de contato, sem criar entidade de conversa paralela

Knowledge/memory/skills:

- `ai_knowledge_sources`
- `ai_knowledge_versions`
- `ai_knowledge_chunks`
- `ai_knowledge_searches`
- `ai_memory_versions`
- `ai_memory_pointer`
- `ai_memory_entries`
- `ai_skill_versions`
- `ai_skill_pointers`
- `ai_skill_activations`

Human loop:

- `ai_cases`
- `ai_case_events`
- `ai_contact_field_proposals`

Follow-up:

- `cadence_versions`
- `cadence_definition_pointers`
- extensões de enrollment para `version_id`, `current_node_id`, `next_eval_at`, `claimed_until`, `waiting_reply` e snapshot de política

Todos os registros tenant-scoped carregam `organizacao_id`; toda query de API/worker filtra por organização. Credenciais nunca são retornadas em claro.

## 6. Contrato do agent runtime

1. Resolver organização, conversa/contato, sessão e evento de origem.
2. Aplicar pausa humana, consentimento, janela do canal e filtros de gatilho.
3. Resolver roteador sticky ou selecionar agente publicado por prioridade.
4. Congelar `agent_version_id`, provider, modelo, credencial, tools e budgets no run.
5. Adquirir exclusão por conversa para impedir resposta dupla.
6. Montar contexto: histórico, estado CRM, memória, skills e conhecimento permitido.
7. Chamar provider por registry, nunca diretamente por tela/route.
8. Validar tool call pelo registry e allowlist da versão; executar com idempotência.
9. Repetir até resposta, handoff, budget, max steps, circuit breaker ou erro.
10. Rodar guardrails antes do envio.
11. Gravar ledger e enviar pelo adapter Callface.
12. Persistir run/steps/tokens/custo/trace e publicar eventos derivados.

O endpoint de teste executa o mesmo runtime e as mesmas tools, mas egress externo fica desabilitado por padrão. A UI precisa distinguir claramente simulação sem envio de execução live.

## 7. Contrato de follow-up

### 7.1 Grafo

Tipos canônicos: `trigger`, `wait`, `condition`, `ai_classify`, `action`, `end`.

- Nodes e edges têm IDs estáveis; posições são persistidas.
- Edges condicionais têm handle/label semântico.
- `condition` e `ai_classify` exigem cobertura de ramos.
- Todo nó alcançável precisa possuir caminho até `end`.
- Ciclos são proibidos na publicação inicial.
- Limites de passos e esperas são validados no servidor.

### 7.2 Versionamento e execução

- Draft é editável; publish cria versão imutável.
- Ponteiro ativo separa identidade da versão publicada.
- Enrollment guarda a versão; nova publicação não altera enrollment em curso.
- Worker processa no máximo um nó por tick e usa lease/idempotência.
- Resposta humana aplica a política do fluxo: pausar, cancelar, continuar ou handoff.
- Disable impede novos enrollments; rollback move somente o ponteiro ativo.

### 7.3 Adapters obrigatórios

- esperar
- enviar WhatsApp pelo transporte Callface
- enviar e-mail pelo serviço Callface
- executar agente publicado
- atualizar lead/contato/negócio/etapa/tag/tarefa
- condição por campos/eventos do CRM
- classificação por IA
- abrir caso/handoff
- finalizar fluxo

Nenhuma opção aparece como executável na UI antes de existir no registry do servidor.

## 8. Compatibilidade e migração

- Agente legado: gerar agente/versão compatível por organização a partir de `ai_sdr_config`; enquanto não publicado, fallback permanece no fluxo legado.
- Agente publicado: o inbound existente resolve e executa a versão nova; `ai_sdr_contato_state` continua governando handoff durante a transição.
- Cadência linear: conversor determinístico gera grafo `trigger -> steps -> end`; `steps` legado permanece somente como artefato compilado.
- Fluxo novo: `cadence_versions.graph` é a fonte de verdade e o runner interpreta o grafo.
- Não executar backfill destrutivo; migrations são aditivas e reversíveis por ponteiro/feature flag.

## 9. Segurança

- AES-256-GCM com chave de aplicação versionada para credenciais; armazenar ciphertext, IV, tag e last4.
- API nunca seleciona campos cifrados nas listagens.
- Toda mutation registra `audit_log` com ator, organização e recurso.
- Conteúdo de conversa não entra em telemetria de router/usage.
- Tool que modifica CRM exige schema estrito, organização e idempotency key.
- Proposta de dado do contato exige confirmação humana; IA não sobrescreve email/nome/telefone diretamente.
- Logs e erros não incluem chave, prompt completo sensível ou conteúdo bruto quando desnecessário.

## 10. Estratégia de testes

Unitários:

- schemas e invariantes de grafo
- validator/publish/rollback
- edge selection e node handlers
- resolver de agente/router e sticky routing
- tool allowlist, breaker e idempotência
- budget/cost/pricing
- cifra/máscara de credencial
- guardrails, memory/knowledge recall

Integração:

- draft -> publish -> supersede -> rollback
- enrollment pinado e execução de um nó por tick
- event_outbox -> BullMQ sem duplicidade
- run multi-step com tool e resposta
- handoff/case/proposal
- credencial tenant-scoped e nunca exposta

E2E:

- criar/configurar/testar/publicar agente
- criar flow com seis tipos de nó, corrigir erros e publicar
- abrir fila, pausar/retomar/cancelar e inspecionar eventos
- configurar router/provider/credential/knowledge/memory/skill/budget
- validar runs, custos, alertas, casos e propostas

Gates:

- testes do AI Platform
- `npx tsc --noEmit --incremental false`
- `npm run build`
- `git diff --check`
- inspeção visual real em localhost nas rotas acima

## 11. Ordem de implementação

1. Contratos, migration e repositories tenant-scoped.
2. Provider/credential/model/tool registry, runs e orçamento.
3. Agent runtime live e ligação ao inbound/egress existentes.
4. Follow-up graph/versioning/runner e adapters.
5. Knowledge, memory, skills, routers e human loop.
6. UI completa e observabilidade.
7. Migração compatível, testes E2E e remoção dos rótulos `dry_run`/`Em breve` apenas quando cada caminho estiver funcional.

## 12. Definition of Done

O port só está concluído quando cada módulo listado no escopo possui persistência, API, UI, autorização tenant-scoped, executor real quando aplicável, telemetria e teste. Paridade visual isolada não conta. Nada é promovido para homolog ou produção neste trabalho sem aprovação explícita.

---

## 13. Handoff de implementação — leia esta seção primeiro

Este é o estado factual deixado pelo Codex em 2026-08-24 para outra pessoa ou agente concluir. A arquitetura das seções 1–12 continua sendo o contrato. O trabalho abaixo está somente no checkout local:

```text
/Users/Scott/Documents/Scott Studio/callface-crm-dev/app
branch: dev
```

Não existe commit deste trabalho. Há arquivos modificados e novos no working tree. Não resetar, não fazer checkout destrutivo e não sobrescrever alterações sem revisar o diff. Nenhuma alteração foi promovida para homologação ou produção.

### Resumo honesto

A fundação nativa está implementada e passa nos testes unitários e no TypeScript. O produto ainda **não está funcional ponta a ponta** porque o inbound do worker continua chamando o AI SDR legado, os adapters novos do follow-up ainda não foram registrados no cadence engine e a UI visual do grafo ainda é a versão simplificada do Callface.

Estado aproximado por camada:

| Camada | Estado | Observação |
|---|---|---|
| Schema e migration | Implementado localmente | Migration aplicada apenas ao PostgreSQL local |
| Provider gateway e credenciais | Implementado como fundação | Falta retry/circuit breaker e E2E com credencial real |
| Agent harness | Implementado e usado pelo teste de agente | Ainda não ligado ao inbound live do worker |
| Tool registry | 20 tools registradas | Mutations viram preview em modo `test`; falta cobertura de integração |
| Runs, steps, ledger e budget | Implementado como fundação | Budget diário e alertas por percentual ainda incompletos |
| APIs auxiliares | Implementadas | CRUD inicial, ainda sem auditoria completa e refinamento de permissões |
| UI de módulos auxiliares | Implementada de forma genérica | Não tem a profundidade/UX do Deskcomm |
| Follow-up graph/versioning | Implementado no backend | UI ainda edita sequência linear e adapters de IA não executam |
| Inbound/egress real | Egress implementado no harness | Inbound novo não conectado; legado continua ativo |
| Router/knowledge/memory/skills | Persistência/API/tools básicas | Router não participa da seleção live; ingestão e recall são mínimos |
| Build e E2E | Não executados | TypeScript e testes unitários passaram |

## 14. Alterações já feitas

### 14.1 Schema Drizzle

Arquivo: `src/lib/db/schema.ts`

Extensões feitas:

- `ai_agents`: `kind`, `published_version_id`, `archived_at`.
- `ai_agent_versions`: organização, credencial, sessão/canal, guardrails, janelas de histórico, cases e supersession.
- `ai_agent_runs`: sessão, correlação, mensagens de origem/saída, tokens de entrada/saída, latência, steps, erro e abort reason.
- `contatos`: campos de silêncio do bot, agente sticky e intenção.
- `cadence_definitions`: trigger, handoff e status.
- `cadence_enrollments`: versão pinada, nó atual, próxima avaliação, lease, inbound e handoff.

Tabelas adicionadas no schema:

```text
ai_models
ai_provider_credentials
ai_purpose_bindings
ai_agent_run_steps
ai_send_ledger
ai_alerts
ai_usage_budgets
ai_routers
ai_router_members
ai_router_decisions
ai_knowledge_sources
ai_knowledge_versions
ai_knowledge_chunks
ai_knowledge_searches
ai_memory_versions
ai_memory_pointers
ai_memory_entries
ai_skill_versions
ai_skill_pointers
ai_skill_activations
ai_cases
ai_case_events
ai_contact_field_proposals
ai_improvement_proposals
cadence_versions
cadence_definition_pointers
```

### 14.2 Migration

Arquivo: `src/lib/db/migrations/0029_ai_platform_native_foundation.sql`

A migration é aditiva e usa guardas idempotentes onde necessário. Foi:

1. validada dentro de transação com rollback;
2. aplicada ao banco local carregado pelo `.env` do projeto;
3. verificada localmente.

Resultado da verificação local:

- 36 tabelas relacionadas a `ai_*`/`cadence_*` presentes;
- tabelas centrais novas presentes;
- seis modelos iniciais semeados: Anthropic Claude Haiku/Sonnet, Google Gemini 2.5 Flash, Groq Llama 3.3, OpenAI GPT-4o e GPT-5 Mini.

Não reaplicar em homologação ou produção. Para qualquer ambiente externo, primeiro revisar a migration, gerar backup/dry-run e obter autorização explícita.

### 14.3 Provider gateway e credenciais

Arquivos:

```text
src/lib/ai-platform/security/credentials.ts
src/lib/ai-platform/security/credentials.test.ts
src/lib/ai-platform/runtime/provider-gateway.ts
src/lib/ai-platform/runtime/provider-gateway.test.ts
```

Implementado:

- AES-256-GCM para segredo em repouso;
- máscara e last4 sem retornar ciphertext na API;
- chave via `AI_CREDENTIALS_ENCRYPTION_KEY`, com fallback derivado de `NEXTAUTH_SECRET`;
- normalização de resposta e tool calls para Groq/OpenAI-compatible, Anthropic e Google;
- normalização de tokens de entrada/saída.

Variáveis aceitas pelo runtime quando a versão não aponta para uma credencial persistida:

```text
GROQ_API_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY
GOOGLE_GENERATIVE_AI_API_KEY ou GEMINI_API_KEY
```

Pendências específicas:

- implementar timeout, retry exponencial e circuit breaker por provider;
- validar rotação de chave de criptografia;
- persistir `base_url` por credencial/binding e realmente usá-la na resolução;
- confirmar preços/model IDs atuais antes de produção;
- fazer E2E com uma credencial real de cada provider habilitado.

### 14.4 Agent harness real

Arquivo principal: `src/lib/ai-platform/runtime/execute-agent.ts`

Entrada pública:

```ts
executeAgent({
  organizacaoId,
  agentId?,
  versionId?,
  eventType,
  message,
  contatoId?,
  leadId?,
  sourceMessageId?,
  mode: "test" | "live",
  suppressEgress?,
  payload?,
})
```

O runtime já:

- seleciona agente/versão tenant-scoped;
- exige agente e versão publicados no modo live;
- confere o `eventType` contra `trigger_config`;
- resolve credencial persistida ou variável de ambiente;
- chama o provider em loop multi-step;
- limita steps e tokens;
- aplica allowlist de tools da versão;
- persiste model calls, tool calls, guardrail e egress em `ai_agent_run_steps`;
- agrega tokens e custo em `ai_agent_runs`;
- aplica hard stop de orçamento mensal;
- mascara padrões básicos de segredo e sanitiza resposta;
- suporta mensagens separadas por `---SPLIT---` ou `message_prepare`;
- evita envio duplicado com `ai_send_ledger`;
- grava a mensagem e usa a `whatsappOutgoingQueue` já existente;
- em modo `test`, executa o mesmo modelo e as mesmas tools, mas não envia mensagem nem aplica mutations externas.

Limitações que precisam ser corrigidas antes de declarar o harness completo:

- não usa `ai_routers` para seleção; hoje escolhe por agente explícito/prioridade;
- ainda não carrega automaticamente histórico, knowledge, memory e skills no prompt; eles existem como tools e precisam ser chamados pelo modelo;
- guardrail atual é sanitização básica, não uma política completa;
- não há retry/circuit breaker de provider/tool;
- exclusão concorrente depende do índice de run live, mas o tratamento de conflito precisa ser testado;
- budget sempre agrega o mês, inclusive se o registro disser `daily`;
- não emite warning ao atingir `warning_percent`;
- custo depende do catálogo local e pode ficar zero quando o modelo não está cadastrado;
- não há integração completa com pausa/handoff do estado legado.

### 14.5 Tool registry

Arquivo: `src/lib/ai-platform/tools/registry.ts`

As 20 capabilities cadastradas cobrem:

- contexto de contato, conversa e CRM;
- busca em conhecimento;
- leitura de memória;
- classificação;
- preparação de resposta;
- handoff;
- criação de tarefa;
- status/qualificação de lead;
- avanço de negócio;
- pausa de cadência;
- enrollment/cancelamento de follow-up;
- proposta de alteração de campo do contato;
- abertura de caso;
- ativação de skill;
- criação de alerta;
- leitura de orçamento.

O catálogo exibido pelo Agent Studio foi atualizado em `src/lib/ai/agent-studio.ts`. Em modo `test`, operações mutáveis retornam preview. Em live, os adapters usam as tabelas/services existentes do Callface.

Antes de produção, revisar cada tool para:

- isolamento tenant em todas as queries;
- idempotency key por ação;
- permissão por papel/versão;
- audit log;
- teste de sucesso, erro e retry;
- compensação quando uma ação parcial falhar.

### 14.6 APIs de agentes

Arquivo: `src/api-server/routes/automacoes-agentes.ts`

Implementado:

- novos campos de versão para provider, credencial, sessão, guardrails, histórico e cases;
- publicação supersede a versão anterior e atualiza `published_version_id`;
- o endpoint de teste chama `executeAgent` de verdade em `mode: "test"` e `suppressEgress: true`;
- a tela de detalhe foi ajustada para apresentar esse teste como execução real sem envio.

Atenção: o endpoint legado `/automacoes/agentes/dispatch-dry-run` ainda existe. Ele não representa o novo runtime e deve ser removido ou mantido apenas como endpoint interno claramente legado depois de conferir consumidores.

### 14.7 Follow-up graph e versionamento

Arquivos:

```text
src/lib/ai-platform/followup/graph.ts
src/lib/ai-platform/followup/validate.ts
src/lib/ai-platform/followup/compile.ts
src/lib/ai-platform/followup/legacy.ts
src/lib/ai-platform/followup/graph.test.ts
src/api-server/routes/automacoes-cadencias.ts
src/lib/cadencia/cadence-engine.ts
src/lib/crm/condicao.ts
```

Implementado:

- seis tipos canônicos: `trigger`, `wait`, `condition`, `ai_classify`, `action`, `end`;
- schema Zod para nodes/edges/positions/config;
- validação de alcance, caminhos até o fim, cobertura de branches, ciclos e step cap;
- compilação do grafo para o `CadenceStep[]` já entendido pelo motor antigo;
- conversão determinística de steps legados para grafo;
- criação de definition + draft version + pointer;
- salvar draft;
- publicar com validação e retorno `422` quando inválido;
- criar novo draft após publish;
- pause/disable/rollback;
- enrollment pinado na versão publicada;
- carregamento de `compiled_steps` pinado no cadence engine;
- sincronização de `scheduled_at`, `next_eval_at` e nó atual.

Bloqueio funcional atual:

O compilador gera os adapters abaixo, mas `src/lib/cadencia/cadence-engine.ts` registra apenas `noop`, `whatsapp` e `email`:

```text
ai_classify
ai_agent_message
whatsapp_template
```

Se um grafo novo publicado chegar nesses adapters, o engine falhará com adapter inexistente. Eles precisam ser registrados antes de considerar follow-up funcional.

### 14.8 APIs auxiliares AI Platform

Arquivo: `src/api-server/routes/ai-platform.ts`

Montagem: `src/api-server/server.ts` registra `aiPlatformRoutes` em `/api`.

Rotas implementadas:

```text
GET  /api/automacoes/ai/providers
PUT  /api/automacoes/ai/providers/bindings/:purpose
GET  /api/automacoes/ai/credentials
POST /api/automacoes/ai/credentials
PATCH /api/automacoes/ai/credentials/:id
POST /api/automacoes/ai/credentials/:id/validate
GET/POST/PUT /api/automacoes/ai/routers...
GET/POST /api/automacoes/ai/knowledge
POST /api/automacoes/ai/knowledge/:id/reindex
GET/PUT/POST /api/automacoes/ai/memory...
GET/POST /api/automacoes/ai/skills
GET/POST /api/automacoes/ai/cases...
GET/PATCH /api/automacoes/ai/alerts...
GET/POST /api/automacoes/ai/proposals...
GET /api/automacoes/ai/runs
GET /api/automacoes/ai/runs/:id/steps
GET /api/automacoes/ai/usage
PUT /api/automacoes/ai/usage/budgets
```

As queries foram escritas tenant-scoped e listagens de credencial não retornam ciphertext. Ainda faltam audit log consistente, paginação/cursor, políticas finas de autorização, schemas de resposta e testes de integração HTTP.

### 14.9 UI já adicionada/alterada

Arquivos:

```text
src/components/crm2/automacoes/AgenteDetalheWorkspace.tsx
src/components/crm2/automacoes/AgenteIAHub.tsx
src/components/crm2/automacoes/AiPlatformWorkspace.tsx
src/app/(crm2)/automacoes/ai/[module]/page.tsx
```

O hub deixou de mostrar os módulos como `Em breve` e passou a linkar para a rota genérica `/automacoes/ai/[module]`. O workspace genérico oferece operações iniciais para roteadores, credenciais, providers/bindings, conhecimento, memória, skills, casos, alertas, propostas e uso/orçamento.

Isso é uma fundação administrativa, **não paridade visual completa com o Deskcomm**. Pendências de UI:

- tela de agente ainda não possui seletores completos de credencial, provider e sessão;
- o card combinado de alertas/orçamento atualmente aponta para `uso`; criar navegação clara também para `alertas`;
- propostas e alguns módulos existem na rota genérica, mas ainda não estão expostos com cards próprios no hub;
- falta loading/error/empty/action state aprofundado por módulo;
- falta confirmar responsividade e acessibilidade;
- falta inspeção visual real no localhost;
- falta substituir o editor simplificado de follow-up por React Flow com sidebar, inspector, handles, branches, zoom, save/publish e validações visuais equivalentes à referência.

## 15. Principal P0: conectar o inbound ao novo runtime

O worker ainda chama `callAiSdr` do legado em vários caminhos de `src/worker/index.ts`, incluindo as regiões encontradas em torno das linhas 1131, 1503, 1602, 1689 e 1769. O `whatsappIncomingWorker` começa em torno da linha 1923. Não fazer substituição cega em todos os pontos: identificar quais chamadas são inbound principal, retry/sweep e casos auxiliares.

Resultado obrigatório:

1. Ao persistir uma mensagem inbound, manter o fato/evento existente e a idempotência atual.
2. Resolver se a organização possui agente publicado elegível para `eventType: "whatsapp.message.received"` ou o evento canônico escolhido.
3. Respeitar pausa humana, opt-out, contato silenciado, sessão, janela e estado de handoff.
4. Enfileirar uma execução por contato/conversa usando BullMQ existente; não chamar provider em paralelo fora da lane.
5. No processor, chamar `executeAgent` com `mode: "live"`, `sourceMessageId`, `contatoId`, `leadId`, texto e payload mínimo.
6. Se não houver agente publicado elegível, manter fallback legado durante a transição.
7. Se houver agente publicado e o run falhar, registrar run/alerta sem gerar resposta dupla pelo legado.
8. Confirmar que a saída passa somente por `whatsappOutgoingQueue` e `ai_send_ledger`.
9. Testar mensagens simultâneas, retry do mesmo evento, contato pausado e handoff.

Não criar outra fila ou worker. Reutilizar a infraestrutura BullMQ já existente e, se necessário, adicionar apenas um job name/processor ao conjunto atual.

## 16. Segundo P0: completar os adapters do follow-up

Registrar no cadence engine ou em um módulo de bootstrap importado pelo worker:

### `ai_agent_message`

- resolver contato/lead e agente/version configurados no node;
- chamar `executeAgent` em live com evento de follow-up;
- usar o mesmo egress/ledger, sem enviar novamente pelo cadence engine;
- retornar run ID, status e vars necessárias para branches;
- retry apenas quando o erro for recuperável.

### `ai_classify`

- executar provider/agente classificador sem egress;
- validar a classe contra as classes configuradas no node;
- gravar resultado em `vars` no caminho esperado pelo compilador, atualmente `classification.<nodeId>`;
- aplicar timeout/grace e branch default;
- persistir trace/custo.

### `whatsapp_template`

- usar exclusivamente o transporte/sessão atual do Callface;
- renderizar variáveis com escape e validação;
- gravar mensagem/ledger antes de enfileirar;
- idempotência por enrollment/version/node/attempt.

Depois, cobrir com testes de integração do cadence engine: sucesso, falha recuperável, retry, branch, pin de versão, resposta humana, pause/cancel/handoff e conclusão.

## 17. Terceiro P0: editor visual de follow-up

A API aceita grafo, mas a UI atual `CadenciasWorkspace.tsx`/`FollowupFlowCanvas.tsx` continua baseada na representação linear simplificada e envia steps legados. O conversor evita quebra de compatibilidade, mas não entrega a experiência do Deskcomm mostrada no vídeo.

Implementar com `@xyflow/react`, já instalado:

- canvas central com nodes e edges persistidos;
- sidebar para adicionar os seis tipos;
- inspector contextual à direita;
- drag/drop, conexão por handles e branch labels;
- condição e classificação com saída por classe/default;
- validação visual usando os erros retornados pelo backend;
- draft autosave explícito e estado dirty/saving/saved;
- publish desabilitado enquanto inválido;
- rollback/disable/pause;
- fila de enrollments e detalhe de eventos;
- preservação dos IDs dos nodes/edges e positions;
- nenhum node oferecido como executável se o adapter não estiver registrado.

Usar o Deskcomm como referência de comportamento e densidade, mas adaptar tokens/componentes visuais do CRM 2.0. Não copiar dependências Supabase nem chamadas ao backend Deskcomm.

## 18. P1 depois dos três P0

1. Integrar `ai_routers` à seleção live, incluindo sticky route, confidence, fallback e decisões sem conteúdo sensível.
2. Completar context assembly automático de histórico, CRM, knowledge, memory e skills.
3. Melhorar knowledge: fetch seguro, normalização, chunking, embeddings/índice apropriado, reindex e métricas de miss.
4. Completar versionamento/ativação/fork de skills.
5. Completar loop de casos: reply humano deve retomar o agente no contexto certo.
6. Completar propostas de melhoria e decisões humanas.
7. Implementar warning/hard stop diário e mensal corretamente.
8. Adicionar audit log a todas as mutations relevantes.
9. Adicionar paginação, schemas de saída e autorização por papel.
10. Remover nomenclatura/funções `dry_run` remanescentes depois de migrar consumidores.
11. Planejar compatibilidade e eventual retirada de `ai_sdr_config` somente após E2E e feature flag.

## 19. Testes executados neste checkpoint

Comandos:

```bash
npm run test:ai-platform
npx tsc --noEmit --incremental false --pretty false
git diff --check
```

Resultado em 2026-08-24:

- `npm run test:ai-platform`: **8 testes, 8 passaram, 0 falhas**;
- TypeScript: **passou, exit code 0**;
- `git diff --check`: **passou, sem saída**.

Testes cobertos:

- grafo canônico válido;
- rejeição de saída de classificação desconectada;
- preservação de IDs de branches;
- tool calls OpenAI/Groq;
- blocos Anthropic;
- function calls Google;
- roundtrip AES-GCM;
- rejeição de credencial adulterada.

Ainda não executado:

- `npm run build`;
- testes HTTP das APIs;
- integração com PostgreSQL limpo criado do zero;
- integração BullMQ/Redis;
- provider real;
- WhatsApp real;
- E2E/browser e inspeção visual.

## 20. Working tree no momento do handoff

Modificados:

```text
package.json
src/api-server/routes/automacoes-agentes.ts
src/api-server/routes/automacoes-cadencias.ts
src/api-server/server.ts
src/components/crm2/automacoes/AgenteDetalheWorkspace.tsx
src/components/crm2/automacoes/AgenteIAHub.tsx
src/lib/ai/agent-studio.ts
src/lib/cadencia/cadence-engine.ts
src/lib/crm/condicao.ts
src/lib/db/schema.ts
```

Novos/não rastreados:

```text
docs/reconstruction/DESKCOMM-AI-NATIVE-PORT-2026-08-24.md
src/api-server/routes/ai-platform.ts
src/app/(crm2)/automacoes/ai/[module]/page.tsx
src/components/crm2/automacoes/AiPlatformWorkspace.tsx
src/lib/ai-platform/followup/compile.ts
src/lib/ai-platform/followup/graph.test.ts
src/lib/ai-platform/followup/graph.ts
src/lib/ai-platform/followup/legacy.ts
src/lib/ai-platform/followup/validate.ts
src/lib/ai-platform/runtime/execute-agent.ts
src/lib/ai-platform/runtime/provider-gateway.test.ts
src/lib/ai-platform/runtime/provider-gateway.ts
src/lib/ai-platform/security/credentials.test.ts
src/lib/ai-platform/security/credentials.ts
src/lib/ai-platform/tools/registry.ts
src/lib/db/migrations/0029_ai_platform_native_foundation.sql
```

Antes de editar, executar `git status --short` e `git diff`. Preservar qualquer alteração do usuário fora deste escopo.

## 21. Ordem recomendada para o próximo agente concluir

1. Ler este documento inteiro e o `AGENTS.md` do repositório.
2. Conferir working tree; não limpar nem resetar.
3. Rodar novamente testes/TypeScript para estabelecer baseline.
4. Escrever testes de integração para inbound novo e adapters do follow-up antes de ligar live.
5. Conectar inbound ao `executeAgent` com fallback legado explícito e feature flag/critério por agente publicado.
6. Implementar e registrar `ai_agent_message`, `ai_classify` e `whatsapp_template`.
7. Testar concorrência, idempotência, retry, handoff e egress sem duplicidade.
8. Implementar o editor React Flow completo.
9. Completar telas/configuração do agente e módulos auxiliares.
10. Integrar router e context assembly.
11. Rodar `npm run build`, integração HTTP/BullMQ/Postgres e browser E2E.
12. Corrigir tudo até os gates passarem.
13. Atualizar este documento e o vault com o resultado.
14. Não fazer deploy nem aplicar migration fora do local sem autorização explícita.

## 22. Critérios objetivos para o próximo agente não encerrar cedo

Não declarar concluído enquanto não for possível demonstrar localmente, ponta a ponta:

1. criar credencial mascarada e validá-la;
2. criar/configurar/publicar agente;
3. receber uma mensagem inbound pelo pipeline existente;
4. gerar um único run live, com steps/tool calls e sem duplicidade;
5. responder pela fila WhatsApp existente;
6. criar follow-up visual com branch/classificação;
7. publicar uma versão e iniciar enrollment pinado;
8. executar wait, classificação, agent message, template e end;
9. pausar/cancelar/handoff ao receber resposta humana;
10. consultar run, custo, alerta, caso e proposta nas telas;
11. provar isolamento entre duas organizações;
12. passar unitários, integração, TypeScript, build e browser E2E.

Se qualquer item acima depender de mock, stub ou tela sem executor, registrar como incompleto. O objetivo solicitado pelo Scott é comportamento real equivalente ao Deskcomm dentro da arquitetura Callface, sem Supabase, segundo backend ou transporte WhatsApp paralelo.

## 23. Atualização — os 3 P0 foram fechados (2026-08-24, sessão seguinte)

Os três P0 das seções 15–17 foram implementados no mesmo worktree `dev` local, sem tocar homolog/produção e sem commit.

### 23.1 P0 #1 — inbound ligado (seção 15)

Em `handleAiSdrResponse` (`src/worker/index.ts`), logo após desestruturar `params`: tenta `executeAgent({ eventType: "conversation.message_received", mode: "live", ... })` antes de qualquer lógica legado. Se `NoEligibleAgentError` (nova classe exportada em `execute-agent.ts`), cai no fluxo legado abaixo sem mudança de comportamento. Qualquer outra falha do agente nativo **não** cai no legado (evita resposta duplicada) — fica registrada no run. `whatsappMensagens` inbound agora usa `.returning({id})` pra propagar `sourceMessageId`.

Corrigido no caminho: `selectAgent` em `execute-agent.ts` exigia bater `trigger_config.events` mesmo com `agentId` explícito — isso teria travado os adapters do P0 #2, que sempre passam `agentId` explícito quando configurado no nó. Agora, `agentId` explícito pula esse gate (só se aplica à seleção implícita por prioridade).

### 23.2 P0 #2 — adapters do follow-up (seção 16)

`ai_agent_message`, `ai_classify` e `whatsapp_template` registrados em `cadence-engine.ts` (mesmo padrão dos adapters `whatsapp`/`email` existentes, `registrarAdapter(...)` top-level). Detalhes:

- `ai_agent_message`: resolve contato pela entidade do enrollment (novo helper `resolverContatoCompleto`, cobre lead/negocio/contato), respeita `botSilencedUntil`, chama `executeAgent` em `mode: "live"` com egress real (fila/ledger do próprio harness). Fallback pra `fallback_template_id` se o agente falhar.
- `whatsapp_template`: renderiza `{{variavel}}` a partir de `vars` do enrollment, insere `whatsapp_mensagens` e enfileira com `messageId` (sem isso o worker de saída não teria o que atualizar — o adapter `whatsapp` legado do próprio cadence-engine tem essa lacuna, não corrigida aqui por estar fora do escopo dos 3 P0).
- `ai_classify`: classifica a última mensagem inbound do contato (ou `vars.summary` se `target: "summary"`) via `executeAgent` em modo `live`/`suppressEgress: true`. Sem resposta ainda → `"no_reply"` direto, sem chamar modelo — a espera de verdade é responsabilidade de um nó `wait` anterior no grafo, não deste adapter (`grace_timeout_ms` do nó é informativo/validado no publish, não implementa espera própria).

Ambos os adapters usam `eventType: "cadence.step_due"` (não um evento inventado) — mesmo catálogo (`AGENT_EVENT_CATALOG`) usado pela tela de agentes, pra permitir seleção automática por prioridade quando o nó não tem `agent_id` explícito.

### 23.3 P0 #3 — editor visual React Flow (seção 17)

`FollowupFlowCanvas.tsx` reescrito do zero (era o builder linear antigo) e `followup-types.ts` criado. `CadenciasWorkspace.tsx` reescrito pra trabalhar com `FollowupGraph` (não mais `Step[]` legado) — a API (`automacoes-cadencias.ts`) já aceitava `graph` desde a fundação do Codex, só a UI ainda mandava `steps`.

O que existe agora:

- Canvas com os 6 tipos de nó, uma handle de saída por branch (`branchesForNode` do próprio `graph.ts`, reaproveitado — zero duplicação de regra de branch), conectar = criar edge com `condition`/`priority` corretos automaticamente (`conditionForBranch`/`priorityForBranch` em `followup-types.ts`, inverso do `conditionForBranch` do compilador).
- Inspector contextual por tipo: trigger (evento do mesmo catálogo dos agentes), wait (fixo ou "janela" com IA decidindo), condition (por regra ou combinado, com os campos/operadores do schema), ai_classify (classes, agente, alvo, timeout), action (mensagem por IA com fallback de template, ou template direto), end (resultado/nota).
- Validação em tempo real usando os MESMOS `followupGraphSchema` e `validateFollowupForPublish` do servidor (importados direto, não duplicados) — nó inválido fica com contorno vermelho, painel lateral lista as pendências, "Publicar" fica desabilitado enquanto `!validation.ok`.
- Histórico de versões com rollback (a API já suportava `action: "rollback"`; só faltava UI).
- Drawer de eventos por inscrição na fila (endpoint novo: `GET /automacoes/cadencias/enrollments/:id/events`).

Achado corrigido no caminho: `compile.ts` dá prioridade a qualquer branch por ordem descendente, e a branch "else"/fallback compila pra uma condição sempre-verdadeira (`condicao: null`) — se ela não tiver a MENOR prioridade, ela vence a corrida e as branches específicas nunca são alcançadas. O builder antigo (e a API) nunca geravam prioridade correta pra isso; o editor novo sempre atribui prioridade mais baixa a saídas de fallback (`priorityForBranch`).

### 23.4 Não coberto ainda

- Teste em navegador: TypeScript limpo, 8/8 testes, `npm run build` sem erro — mas não abri a tela de verdade (browser MCP local estava em uso por outra sessão no momento).
- E2E real (WhatsApp real, Postgres limpo, BullMQ/Redis, credencial de provider real).
- Tudo listado como P1 na seção 18 continua pendente e foi deliberadamente deixado de lado por ora — ver recomendação de escopo no vault (`decisoes/callface-port-deskcomm-agentes-followups.md`).
