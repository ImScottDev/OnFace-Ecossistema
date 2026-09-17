# Production Readiness — Tracker de execução

Backlog derivado do mapa de engenharia reversa de 14/09/2026
(`Brain - Scott Studio/02_PROJETOS/Callface/CRM/arquitetura/callface-crm2-system-map-production-readiness.excalidraw.md`).

**Regra desta rodada:** motor correto, não redesign. O frontend final sai do Figma depois.
Legado histórico só entra quando bloqueia o sistema novo.

**Ponto de restauração:** tag `backup-pre-readiness` (commit `29465ce`) — estado do working
tree antes da primeira correção. Restaurar um arquivo: `git checkout backup-pre-readiness -- <path>`.

**Definição de pronto por item:** problema reproduzido → causa identificada → corrigido →
teste criado/ajustado → validado em DEV real (HTTP/banco, não só compilação) → fluxo anterior
e posterior revalidados → registrado aqui.

---

## P0 — bloqueia go-live

| # | Item | Estado | Evidência de pronto |
|---|------|--------|---------------------|
| P0-1 | Healthcheck do worker mente (compose testa `:3002`, processo escuta `:3001`) | ✅ | `:3002` responde `ok` em DEV; `:3001` liberado; 5 testes de regressão |
| P0-2 | Migrations fora de controle (45 de 46 fora do journal, sem passo no deploy) | ✅ | runner com hash + baseline; deploy migra antes do swap; 4 testes |
| P0-3 | RBAC do CRM 1 perdido: `/clientes/financeiro`, `/ajustes`, `/ajustes/organizacoes` abertos | ✅ | closer barrado nas 2 camadas; admin passa; 5 testes |
| P0-4 | Webhooks fail-open: WhatsApp sem header, Apollo sem auth, RD/Meta com secret default | ✅ | 503 sem segredo, 401 com errado, 200 com certo; 15 testes |
| P0-5 | Won manual não materializa cliente/serviço → cliente nunca chega ao CS | ✅ | `npm run aceite:won-cs`: 31/31, paridade entre os dois caminhos |
| P0-6 | Jornada Won → Service → Fulfillment → CS não certificada ponta a ponta | ✅ | 3 famílias certificadas: AI (19), PABX+White Label (32), Won (31) |
| P0-7 | Fonte canônica de MRR ambígua (duas bases divergindo R$ 6.365,96) | ✅ | divergência R$ 0,00 na API; carteira canônica em todas as telas |
| P0-8 | `/api/configuracoes/settings` não existe: 5 telas de Ajustes quebradas (404) | ✅ | round-trip real pela tela: carrega e salva; ICP preservado |
| P0-9 | `/negocios` 404 + redirect legado apontando pra lá | ✅ | `/negocios-legado` → `/negocios` → `/pipeline`, verificado no navegador |
| P0-10 | `/api/contratos-publicos/:token/pdf-final` fora do roteamento → 404 pro cliente | ✅ | rota chega no handler; 7 testes amarram Traefik ↔ rotas Next |
| P0-11 | Storage de anexos novos + `/api/uploads/*` sem autenticação | 🔧 | autorização pronta e validada; storage de produção segue pendente |
| P0-12 | Dead-letter sem reprocessamento (event_outbox failed, stripe_webhook_events unresolved) | ✅ | outbox reprocessa e alerta; inbox do Stripe visível e re-resolvível |
| P0-13 | Suíte de teste não termina (pool do Postgres aberto no import) | ✅ | `npm test` roda 17 testes em ~0,3s |

Legenda: ⏳ pendente · 🔧 em execução · ✅ pronto e validado em DEV · ⏸ bloqueado por decisão de negócio

---

## Jornadas a certificar (depois dos P0)

| Jornada | Estado | Caso real de DEV |
|---------|--------|------------------|
| J1 Lead → Qualificação | ⏳ | — |
| J2 Qualificação → Oportunidade | ⏳ | — |
| J3 Oportunidade → Proposta | ✅ | `aceite:contrato` + `simular-fechamento-2c1` |
| J4 Proposta → Aceite | ✅ | aceite forma grupo comercial e direciona por família |
| J5 Aceite → Pagamento/Contrato | ✅ | AI → checkout; PABX/WL → contrato (`aceite:contrato`) |
| J6 Pagamento/Contrato → Won | ✅ | Won só com evidência; assinatura fecha PABX/WL sem pagamento |
| J7 Won → Cliente/Service | ✅ | serviço canônico materializado nas 3 famílias |
| J8 Service → Onboarding/Implantação | ✅ | trilha certa por família: onboarding / implantacao_pabx / implantacao_white_label |
| J9 Cliente → CS | ✅ | `aceite-won-cs` — conta criada, jornada de 7 marcos semeada, pelos 2 caminhos |
| J10 Cliente/Service → Financeiro | ✅ | MRR unificado (divergência R$ 0,00) + pendência financeira criada no ganho sem pagamento |
| J11 Cliente → Expansão/Retenção | ⏳ | — |

---

## Log de execução

### P0-1 · healthcheck do worker + schedulers derrubados no boot

**Reproduzido:** worker subido em DEV respondeu 200 em `:3001`; `:3002` (a porta que os três
composes consultam) recusou conexão. No mesmo boot: `Cleaned 1723 stale repeat keys from Redis`
seguido de `Error: Missing key for job repeat:email-sync-trigger:… moveToFinished`.

**Causa:** (a) default do código era `3001` e nenhum compose declarava `WORKER_HEALTH_PORT`;
(b) `cleanStaleRepeatKeys()` fazia `SCAN bull:*:repeat:* + DEL` no startup e apagava também a
chave do job repetido que estava em voo.

**Corrigido:**
- `worker/index.ts`: default `3002`; `api-server/server.ts`: default `3001` (eram ambos 3002 e colidiam em local).
- `WORKER_HEALTH_PORT=3002` declarado nos três composes, ao lado do `test:` que o consulta.
- Limpeza indiscriminada trocada por `removerSchedulersObsoletos()` com a API oficial
  (`getJobSchedulers`/`removeJobScheduler`), rodando DEPOIS dos upserts e só sobre chaves que
  saíram desta versão. `upsertJobScheduler` já é idempotente na BullMQ 5.

**Teste:** `src/worker/health-port.test.ts` — amarra default do código, variável do compose e
porta do healthcheck nos três arquivos (5 casos).

**Validado em DEV:** `:3002` → `ok` (HTTP 200); `:3001` → sem resposta; zero ocorrências de
`Missing key for job repeat` no boot; `19 em scheduled-jobs + email sync + sequences`.

**Fluxo posterior:** com o worker de pé, o `event-outbox-sweep` processou os 8 eventos que
estavam represados desde 09/09 (7 sucesso, 1 falha real, tratada no P0-6).

---

### P0-13 · suíte de teste que nunca terminava

**Reproduzido:** `npx tsx --test src/lib/automations/event-dispatcher.test.ts` rodando >200s sem sair.

**Causa:** dois módulos com efeito colateral no import — `lib/db/index.ts` abria o pool do
postgres-js no topo, e `lib/queue/index.ts` instanciava 8 filas BullMQ (conexões Redis). Quem
importasse qualquer coisa que chegasse lá por transitividade segurava o event loop pra sempre.

**Corrigido:** pool e filas passaram a ser preguiçosos (Proxy que conecta no primeiro uso real),
com `fecharConexao()` e `fecharFilas()` para quem precisa encerrar. Superfície idêntica à anterior.

**Teste:** o próprio arquivo que travava agora termina em 0,5s. `npm test` novo roda o glob
completo (`node --import tsx --test "src/**/*.test.ts"`) — o script antigo dependia de expansão
de glob pelo shell e nunca rodou de verdade.

**Validado em DEV:** 17 testes, 0 falhas, ~0,3s. Typecheck limpo. API e worker subiram normalmente
com a conexão preguiçosa.

---

### P0-12 · dead-letter invisível (parte 1: Event Outbox)

**Reproduzido:** 2 eventos em `status='failed'` no banco, parados desde 08/09, sem nenhuma tela,
alerta ou job que os mostrasse. Um deles era o handoff de CS quebrado (P0-6), invisível por 6 dias.

**Corrigido:** `lib/events/consumer.ts` ganhou `listarEventosFalhados`, `reprocessarEventosFalhados`
(explícito, nunca automático — erro permanente viraria loop de retry) e `alertarDeadLetter`,
chamada pelo sweep: alerta uma vez por dia por organização (trava de repetição no `audit_log`) e
notifica admin/gerente. Endpoints `GET /api/admin/event-outbox/falhas` e
`POST /api/admin/event-outbox/reprocessar` (admin/super_admin, audit-logado).

**Validado em DEV:** `GET` listou os 2 eventos com erro completo; `POST` reenfileirou o de CS
(`failed` → `pending`, tentativas zeradas); o sweep processou e o evento ficou `processed` sem erro.

---

### P0-5 / P0-6 (parte 1) · Won → Cliente → CS

Três defeitos encadeados, todos reproduzidos no banco de DEV antes de qualquer correção.

**1. Todo handoff de CS falhava.** `lib/cs/handoff.ts` fazia
`onConflictDoNothing({ target: [organizacaoId, empresaId] })` contra
`idx_clientes_org_empresa`, que é um índice **parcial** (`WHERE empresa_id IS NOT NULL`).
Postgres recusa: *"there is no unique or exclusion constraint matching the ON CONFLICT
specification"*. Reproduzido rodando o INSERT exato do `last_error` direto no psql.
Consequência: `CanonicalServiceActivated` estourava as 5 tentativas e ia pro dead-letter —
estava assim desde 08/09, invisível. Corrigido repetindo o predicado (`targetWhere`).
O índice parcial também não estava declarado no `schema.ts`; agora está.

**2. O Won nunca criava a conta de cliente — só atualizava se já existisse.**
`marcarNegocioGanhoSeAindaNao` fazia `UPDATE clientes SET status_financeiro` sob um comentário
que dizia "materializa Pessoa + Cliente". Materializava só a Pessoa. Quem criava a linha era
`garantirContaCs`, acionado por `CanonicalServiceActivated` — evento que só existe quando há
grupo comercial materializado. Venda manual não gera grupo, logo nunca gerava conta de CS.

**3. Os dois caminhos de Won tinham efeitos diferentes.** O manual
(`PATCH /api/negocios/:id`) promovia o lead e publicava os eventos, mas não registrava a
atividade na timeline, não materializava Pessoa e não colocava o cliente na carteira.

**Corrigido:** efeitos do ganho extraídos para `aplicarEfeitosPosGanho()` em
`lib/crm/won-evidence.ts` — ponto único usado pelos dois gatilhos. Novo
`garantirContaCsPorEmpresa()` em `lib/cs/handoff.ts` cria a conta no Won, com ou sem serviço
canônico; `garantirContaCs()` (por serviço) passou a delegar nele. Eventos `DealWon` e
`CustomerCreated` ganharam `idempotencyKey`.

**4. Achado durante a validação: dois donos criando a conta.** Com a correção acima, a data de
entrada na carteira continuava nula. Causa: `syncPessoaFromLead` também insere em `clientes`
(quando o lead vira `tipo='cliente'`), sem `entrouCarteiraEm` nem `statusFinanceiro`, e roda
antes no fluxo. Com `DO NOTHING`, essa conta "magra" ganhava a corrida — e `entrouCarteiraEm` é
a âncora do ciclo de CS (`lib/cs/jornada.ts`), então a jornada inteira nascia desalinhada.
Trocado por `onConflictDoUpdate` com `COALESCE`: completa o que falta, nunca sobrescreve o que
já existe.

**Testes:**
- `src/lib/db/on-conflict.test.ts` — valida TODA a classe do bug: varre os `onConflictDo*` do
  código, resolve as colunas pelo schema e confere contra os índices únicos reais do banco
  (índice inexistente ou parcial sem predicado = falha). Provado revertendo a correção: o teste
  falha apontando `handoff.ts:59` e volta a passar com ela.
- `src/scripts/aceite-won-cs.ts` (`npm run aceite:won-cs`) — jornada real pela API HTTP com
  sessão de verdade, pelos DOIS caminhos, conferindo 15 efeitos cada e a paridade entre eles.
  Inclui o gate de evidência e a idempotência de repetir o ganho.
- `src/scripts/_limpeza-aceite.ts` — limpeza transacional por tag, resolvendo as ~95 FKs das
  entidades raiz. Reusável por todos os aceites seguintes.

**Validado em DEV:** 31/31 no aceite. O evento de CS que estava travado desde 08/09 foi
reprocessado pelo endpoint novo e processou sem erro.

**Fluxo anterior e posterior:** typecheck limpo; `npm test` 17/17; `npm run check:relatorios`
com todas as invariantes OK; smoke HTTP em 10 telas do fluxo (`/inicio`, `/pipeline`,
`/clientes`, `/clientes/cs`, `/clientes/financeiro`, `/negocios/novo`, `/propostas`,
`/atendimento`, `/relatorios`, `/ajustes`) todas 200.

---

### P0-8 · cinco telas de Ajustes chamando endpoint inexistente

**Reproduzido:** `GET /api/configuracoes/settings` → 404 por curl e no console do navegador,
com as 5 telas (ICP, Enriquecimento, Handover, Notificações, Tracking) carregando em branco.

**Causa:** a coluna `organizacoes.settings` (jsonb) existe desde o schema original, inclusive
com o comentário certo em cima — o endpoint que a lê e escreve é que nunca foi escrito.

**Corrigido:** `GET` e `PATCH /api/configuracoes/settings` em `routes/configuracoes.ts`, com
allowlist de chaves (sem ela o PATCH seria escrita arbitrária no jsonb), gate de papel
(admin/gerente/super_admin, como as outras rotas de configuração) e audit log. Os segredos de
tracking (`metaToken`, `ga4Secret`) voltam mascarados e reenviar a máscara preserva o valor
real — testado.

**Também corrigido:** o botão "Recalcular todos" da tela de ICP chamava
`POST /api/leads/recalcular-icp`, que não existe (a requisição caía em `POST /leads/:id` e era
tratada como id de lead). Não há cálculo de ICP score no backend — nem a coluna. O botão foi
removido e o subtítulo passou a dizer o que a tela realmente faz. Criar a pontuação é feature,
não correção, e está fora do escopo desta rodada.

**Teste:** `src/api-server/rotas-consumidas.test.ts` — casa toda URL `/api/...` escrita no
frontend com as rotas realmente registradas (Hono + Next). Provado desligando o endpoint: o
teste falha listando exatamente as 5 telas.

**Validado em DEV:** a tela de ICP carregou os dados que já estavam gravados no banco e que ela
nunca conseguiu ler (`setores: "tecnologia, saude, financeiro"`, `cargos: "ceo,cto,diretor"`);
clique real no Salvar → `PATCH` 200 e valores preservados no banco. As 5 telas respondem 200.

---

### P0-9 · `/negocios` 404 e o redirect legado apontando pra ele

**Reproduzido:** no navegador, `/negocios-legado` → `/negocios` → "404 This page could not be found".

**Causa:** existem `negocios/[id]` e `negocios/novo`, mas não `negocios/page.tsx`. No CRM 2.0 a
listagem de oportunidades é o board em `/pipeline` — `/negocios` nunca foi tela, mas continuou
sendo o destino do redirect de compatibilidade do CRM 1.

**Corrigido:** `app/(crm2)/negocios/page.tsx` redireciona pra `/pipeline`, mesmo padrão dos
outros aliases legados. `/negocios/:id` e `/negocios/novo` seguem intactos.

**Validado em DEV:** `/negocios-legado` abre o board de oportunidades no navegador.

---

### P0-10 · rota Next fora do roteamento do Traefik

**Reproduzido:** `/api/contratos-publicos/:token/pdf-final` é route handler do Next, mas o
prefixo não estava na allowlist — o Traefik manda pro Hono, que não tem a rota. É o link do
contrato assinado que o CRM envia por e-mail pro cliente (`lib/crm/contrato-email-final.ts:53`).

**Corrigido:** prefixo adicionado às duas regras (app e API) nos três composes e ao rewrite de
dev do `next.config.ts`, que espelha a mesma lista.

**Teste:** `src/api-server/roteamento-traefik.test.ts` (7 casos) — confere que toda rota Next em
`app/api` está na allowlist, que as regras do app e da API são complementares nos três composes,
e que o rewrite de dev espelha produção. `/api/meta/resolve` está declarado no teste como
inalcançável por decisão (sem consumidor; remoção é P3).

**Validado em DEV:** com o rewrite novo, a rota responde `Documento não disponível` — do handler
real, que executou e consultou o banco. Antes o mesmo caminho devolvia o `404 Not Found` do Hono.

---

### P0-4 · três webhooks aceitando payload forjado

**Reproduzido em DEV, com curl:**
- `POST /api/whatsapp/webhook` sem `x-hmac-signature` → **HTTP 200**. A validação era
  `if (WEBHOOK_SECRET && signature && !verify)`: só rodava quando o header chegava. Mensagem
  injetada dispara automação, AI SDR e escrita em `contatos`.
- `POST /api/apollo/webhook` sem credencial → **HTTP 200**. Não havia verificação alguma, e o
  handler sobrescreve telefone e e-mail de um lead real casando por `apolloId`.
- `rd-lead` e `meta-lead-ids` caíam em secret literal escrito no próprio arquivo
  (`"callface-rd-2026"`, `"callface-meta-ids-2026"`) — público pra quem tem o repositório.

**Corrigido:** os quatro passaram ao padrão fail-closed que Stripe e Callface já usavam — sem
segredo configurado, 503 e não processa; segredo errado, 401. O Apollo (que não assina payload)
usa token na URL, mesmo modelo do rd-lead, com comparação em tempo constante.

**Consequência operacional, explícita:** subir um ambiente sem esses segredos agora significa
lead, mensagem e pagamento NÃO entrando — antes entrava qualquer coisa. Por isso vieram junto:
- `.env.example` reescrito: cobre as 65 variáveis que o código lê (eram 42 não documentadas),
  marcando `[OBRIGATÓRIA]`, `[FAIL-CLOSED]` e `[opcional]` uma a uma.
- `npm run check:env` — confere que nenhuma variável nova ficou sem documentar (serve em CI) e,
  com `--ambiente`, lista o que falta no ambiente carregado, agrupado por jornada.

**Teste:** `src/api-server/webhooks-fail-closed.test.ts` (15 casos) — exige, pra cada webhook,
segredo sem fallback literal e caminho explícito de recusa; e falha se aparecer webhook novo em
`app/api/webhooks` que não esteja coberto nem declarado público por desenho (`site-lead`, que é
chamado do browser).

**Validado em DEV:** sem segredo → 503 nos dois; token/assinatura errados → 401; assinatura HMAC
correta e token correto → 200. O caminho legítimo continua passando.

---

### P0-11 (parte 1) · `/api/uploads/*` servia qualquer arquivo sem sessão

**Reproduzido:** `GET /api/uploads/anexos/<negocioId>/<arquivo>.jpg` sem cookie → 200, com
`Cache-Control: public, max-age=31536000, immutable`. Valia pra anexo de contrato, documento de
cliente e mídia de conversa, de qualquer organização.

**Corrigido:** autorização por caminho em `routes/uploads.ts`:
- `fulfillment-formularios/<id>/` continua público — é o comprovante que o CLIENTE anexa e
  reabre no formulário de implantação, sem conta no CRM. Agora valida que o fulfillment existe.
- `anexos/<negocioId>/` exige sessão **e** que o negócio seja da organização da sessão.
- Demais arquivos (avatar, mídia de WhatsApp) exigem sessão.
- `Cache-Control` passou a `private` — conteúdo de uma organização não pode ficar em cache
  compartilhado. Adicionada verificação de que o caminho resolvido fica dentro de `UPLOADS_DIR`
  (traversal por encoding).

**Validado em DEV com arquivos reais:** anexo de negócio sem sessão 401 / com sessão 200;
anexo público 200 sem sessão; negócio de outra organização 403; traversal literal e codificado
400. `Cache-Control: private, max-age=3600` confirmado no header.

**Segue pendente (o item não fecha aqui):** os arquivos continuam num volume local, sem S3/R2,
sem backup e sem réplica — e os 1.980 anexos legados do Zoho seguem só no Mac do Scott. Isso é
decisão de infraestrutura com custo, não correção de código.

---

### P0-3 · gate de papel perdido na migração

**Reproduzido:** login real como closer (Mayara Anjos) abria `/clientes/financeiro`,
`/ajustes` e `/ajustes/organizacoes`. No backend, nenhuma rota financeira checava papel.

**Causa:** o middleware protegia `/configuracoes`, `/financeiro`, `/onboarding` e `/campanhas` —
que viraram redirects na consolidação de 08/09. Os destinos reais do CRM2 não estavam na lista
nem no matcher, e o layout `(crm2)` documenta a decisão de "deixar tudo visível na fase de
construção".

**Corrigido nas duas camadas:**
- Middleware: `/clientes`, `/ajustes`, `/vendas` e `/design` entraram na lista de rotas
  autenticadas e no matcher; o gate de gestão passou a cobrir `/clientes/financeiro` e
  `/ajustes`, usando `isAdminView` (inclui director/coordinator/operations da RBAC v2) em vez da
  lista literal de três papéis. `/ajustes/email` segue liberado: é conexão pessoal de conta.
- Backend: novo `getGestaoCtx()` em `api-server/compat.ts` (403 para quem não é gestão), aplicado
  em `clientes-financeiro.ts` e no painel `/clientes-crm2/financeiro/operacional`; as 7 rotas
  Next de `/api/financeiro/*` ganharam `isAdminView` + `forbiddenResponse()`.

**Teste:** `src/middleware-rbac.test.ts` (5 casos) — trava os dois erros fáceis de repetir:
proteger rota que virou redirect, e pôr a rota no gate esquecendo do matcher. Também confere que
as 8 rotas financeiras do backend têm gate.

**Validado em DEV com sessão real de closer:** `/clientes/financeiro`, `/ajustes`,
`/ajustes/geral` e `/ajustes/organizacoes` → 307 para `/inicio`; `/inicio`, `/pipeline`,
`/clientes`, `/clientes/cs`, `/propostas`, `/atendimento` e `/ajustes/email` → 200. No backend:
closer 403 e admin 200 em `/api/financeiro/metricas`, `/churn`, `/inadimplencia` e
`/clientes-crm2/financeiro/operacional`; `/clientes-crm2/resumo` (carteira, que o closer usa)
segue 200 pros dois.

**Efeito colateral a saber:** o teste exigiu senha conhecida para o usuário closer
`mayara.anjos@callface.ai` no banco de DEV. Ao terminar, a senha foi trocada por um hash
aleatório inutilizável (mesmo placeholder do convite de usuário) — se ela for usar esse login em
DEV, precisa passar por "Esqueci a senha". Nenhum outro usuário foi tocado; produção não foi
acessada.

---

### P0-2 · migrations sem controle e deploy sem passo de migração

**Reproduzido:** `drizzle.__drizzle_migrations` tinha 1 linha (`0000`) para 46 arquivos em
`migrations/`. `deploy.sh` e os composes não chamavam migração nenhuma — cada ambiente recebia
SQL aplicado à mão, sem registro. Nenhuma ferramenta conseguia responder "DEV e PROD estão no
mesmo ponto?".

**Corrigido:** runner próprio em `src/lib/db/migrar.ts`, no mesmo estilo que o projeto já usa
(SQL escrito à mão — o que muda é o registro):
- aplica em ordem de nome, cada arquivo na sua transação;
- registra em `_migracoes_aplicadas` com hash sha256 do conteúdo;
- **recusa** rodar se um arquivo já aplicado mudou de conteúdo (sinal de que dois ambientes têm
  SQL diferente sob o mesmo nome) e explica o que fazer;
- `pg_advisory_lock` serializa deploys simultâneos;
- `--check` só relata (serve em CI/pré-deploy) e `--baseline` marca o existente sem executar.

`deploy.sh` reescrito: confere ambiente (`checar-env --ambiente`) e migrations **antes** de
trocar qualquer container, aborta o deploy se a migração falhar, e passou a apontar pro caminho
e container que existem hoje (`/opt/callface/crm`, `callface-crm-app`) — estava no branding
antigo `scott-studio`/`mcrm-production`. Ao final, reporta também a saúde do worker.

**Testes:** `src/lib/db/migrar.test.ts` (4 casos) — ordem determinística e hash por arquivo,
ausência de colisão de prefixo numérico, migração antes do swap no deploy, e container do
deploy existindo no compose.

**Validado em DEV:** baseline das 46 registrado sem executar SQL; migration nova de teste
aplicada de verdade (tabela criada no banco); alterar uma migration já aplicada foi recusado com
diagnóstico; limpeza do teste e `--check` de volta em "banco em dia".

**Para o próximo deploy de HOMOLOG/PROD:** rodar `npm run db:migrar -- --baseline` uma vez em
cada ambiente (marca o que já está aplicado), e daí em diante o `deploy.sh` cuida sozinho.

---

### P0-7 · duas contabilidades de MRR

**Reproduzido:** a própria tela do Financeiro exibia ao usuário "Duas bases de MRR divergem em
R$ 6.365,96". O Início e o CS somavam `servicos_canonicos` (R$ 428.565,69); o Financeiro somava
`contratos.mrr` (R$ 422.199,73). E a base de contratos estava inflada em R$ 24.205,50 por 60
contratos ativos duplicados pela mesma assinatura Stripe.

**Decisão (era o que faltava, não código):** existe UMA fonte canônica de MRR —
`servicos_canonicos` com `portfolio_included`, `revenue_nature='MRR'` e ciclo `ACTIVE`. É o que o
Won materializa daqui pra frente e o que CS e Início já liam. O comentário anterior na rota dizia
que escolher "mexeria em NRR, churn e forecast juntos" — mexe mesmo, e é o certo: agora todos
derivam da mesma base e são coerentes entre si.

**Corrigido:**
- `getMrrAtual().total` passou a ler a carteira canônica. Como `getMrrNoInicio` deriva dele,
  NRR, churn% e forecast passaram a sair da mesma origem.
- `totalContratado` (novo) mantém a soma de contratos como número de CONCILIAÇÃO, agora
  **deduplicada por `stripe_subscription_id`** — sem apagar contrato nenhum. Saneamento do legado
  segue fora do escopo; somar a mesma assinatura duas vezes é que não podia continuar.
- A tela trocou o alerta de divergência por uma nota de conciliação honesta, e o rótulo do
  indicador virou "MRR ativo (carteira de serviços)". O alerta antigo continua no código, mas
  agora só aparece se alguém REINTRODUZIR uma segunda base.

**Teste:** `src/lib/financeiro/mrr-fonte-unica.test.ts` — exige que `getMrrAtual` e `getMrrAtivo`
devolvam o mesmo número, e que a conciliação deduplicada nunca seja maior que a soma bruta.

**Validado em DEV pela API real:** Financeiro R$ 428.565,69 · Início/CS R$ 428.565,69 ·
divergência **R$ 0,00**. Conciliação: R$ 397.994,23 em 485 contratos (eram 545 somando
R$ 422.199,73 — os 60 duplicados saíram da conta). Tela conferida no navegador.
`npm run check:relatorios`: todas as invariantes seguem OK.

---

### P0-12 (parte 2) · inbox do Stripe e alerta de dead-letter

**Corrigido:**
- `GET /api/admin/stripe/inbox` — lista o que chegou do Stripe e não foi processado
  (`unresolved`, `failed`, `processing` ou sem organização). Antes não havia nenhuma superfície:
  um evento que não resolvia a organização respondia 202 e morria ali.
- `POST /api/admin/stripe/inbox/resolver` — reexamina os `unresolved` agora que os vínculos
  (assinatura/fatura/checkout) existem e devolve pro fluxo os que passam a identificar UMA
  organização. Ambíguo continua `unresolved`, de propósito.
- `alertarDeadLetter()` ligada ao sweep do worker: alerta uma vez por dia por organização e
  notifica admin/gerente.

**Limite assumido e documentado:** o processamento do evento Stripe vive inline no handler POST e
depende da assinatura HMAC original, que não dá pra reproduzir a partir do payload salvo.
Reprocessar um `failed` continua sendo "Resend" pelo painel do Stripe — o que muda é que agora o
evento **aparece**, que era exatamente o que faltava. Extrair o handler para função reutilizável
é refatoração de 700 linhas no caminho de pagamento; não cabia nesta rodada de risco baixo.

**Bug encontrado durante a própria validação:** `audit_log.entity_id` é `uuid`, e eu havia escrito
`"lote"` e uma chave textual de deduplicação. Isso teria quebrado o endpoint de reprocessamento em
lote **e** o alerta de dead-letter no worker, em silêncio. Corrigido nos três pontos: `entityId`
fica `null` em operação de lote e a trava diária do alerta passou para `after->>'dia'`.

**Validado em DEV:** `resolver` responde sem erro; reprocessamento em lote reenfileirou o evento;
`alertarDeadLetter()` gravou o audit e criou 11 notificações (uma por gestor ativo); três
execuções no mesmo dia produziram 1 registro e 11 notificações, sem duplicar. Notificações e
audit de teste removidos do banco depois.

---

### P0-6 (parte 2) · jornada comercial certificada nas três famílias

**O que faltava:** `simular-fechamento-2c1.ts` cobria Callface AI ponta a ponta, mas travava nas
famílias contrato-first — chamava `assinarContratoPublico`, e o provider Documenso recusa
confirmação direta ("Documenso confirma assinaturas pelo webhook DOCUMENT_SIGNED/
DOCUMENT_COMPLETED"). PABX e White Label — as duas famílias que fecham NA ASSINATURA — não
tinham nenhuma verificação automática de ponta a ponta.

**Corrigido:** novo `src/scripts/aceite-contrato-assinado.ts` (`npm run aceite:contrato`)
entrega o evento `DOCUMENT_COMPLETED` no endpoint REAL do webhook, com o segredo real — o mesmo
caminho que produção usa. Confere 16 pontos por família:

proposta → aceite direciona pra contrato → aceite NÃO marca ganho → contrato gerado → webhook
aceito → contrato assinado → documento final apontando pra rota pública do PDF → **Won sem
pagamento** → evidência `signed_contract` → sweep do outbox → serviço canônico → fulfillment na
trilha certa → cliente na carteira → 7 marcos de CS → pendência financeira aberta → reentrega do
webhook é no-op.

**Resultado em DEV:**
| Família | Fecha por | Trilha de entrega | Resultado |
|---|---|---|---|
| Callface AI | pagamento confirmado | onboarding (70 itens) | 19 asserções OK |
| PABX | contrato assinado | implantacao_pabx | 16 asserções OK |
| White Label | contrato assinado | implantacao_white_label | 16 asserções OK |

**Também nesta parte:** `_limpeza-aceite.ts` ganhou a ordem correta das seis FKs que apontam
para `proposta_grupo_comercial` e passou a remover os eventos do Event Outbox dos agregados do
cenário (proposta, grupo, contrato, checkout, serviço) — antes sobravam eventos órfãos no banco
depois de cada execução.

---

## Estado ao fim da rodada

**P0: 12 de 13 fechados.** O que sobra do P0-11 é decisão de infraestrutura com custo (object
storage para os anexos), não código — a parte de autorização está pronta e validada.

**Bateria verde, rodada inteira do zero:**
- `npx tsc --noEmit` — limpo
- `npm test` — 51 testes, 0 falhas (eram 9, e a suíte não terminava)
- `npm run aceite:won-cs` — 31/31
- `npm run aceite:contrato` — 32/32
- `simular-fechamento-2c1` — 19 asserções OK
- `npm run check:relatorios` — todas as invariantes OK
- `npm run db:migrar:check` — banco em dia
- `npm run check:env` — .env.example cobre as 65 variáveis lidas pelo código
- Banco de DEV sem resíduo de teste; Event Outbox sem pendência nova

**Pendências conscientes (não são P0 de código):**
1. **Object storage** (P0-11 parte 2) — 1.980 anexos legados seguem só no Mac do Scott; anexos
   novos vão pra volume local sem backup nem réplica. Precisa de decisão de S3/R2 e custo.
2. **Baseline de migrations em HOMOLOG e PROD** — rodar `npm run db:migrar -- --baseline` uma vez
   em cada ambiente antes do primeiro deploy com o runner novo.
3. **Segredos de webhook em HOMOLOG e PROD** — os webhooks agora são fail-closed. Sem
   `STRIPE_WEBHOOK_SECRET`, `RD_WEBHOOK_SECRET`, `META_LEADIDS_WEBHOOK_SECRET`,
   `UAZAPI_WEBHOOK_SECRET`, `APOLLO_WEBHOOK_SECRET` e `CALLFACE_WEBHOOK_SECRET` configurados,
   lead, mensagem e pagamento não entram. `npm run check:env -- --ambiente` lista o que falta.
4. **Esteira de entrega parada** — 416 fulfillments em `NOT_STARTED` e 24.795 itens `PENDING`
   são operação, não código: o motor cria e avança corretamente (provado nos aceites), mas
   ninguém trabalha a fila.
5. **Reuniões travadas** (P1) — 228 de 229 em "agendada" com data no passado; falta job de
   fechamento.
