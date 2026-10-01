# Construtor de Automações (Fluxos) — contrato

01/10/2026. Contrato para dois implementadores trabalharem **em paralelo**:
backend (executor, API, gatilhos) e frontend (lista e editor). Fonte única
dos tipos, do catálogo de nós e das regras compartilhadas:
**`app/src/lib/automacoes/grafo.ts`** (já existe, com teste em `grafo.test.ts`).
Referência de estrutura: `benchmark-funilvivo.md` (seção 2 e a lista de
blocos da seção 1). O visual é o ONFACE: tokens, casca e linguagem de nó do
DS (`components/onface/ds/fluxos.tsx`, classes `fx-no*`).

---

## 0. Decisões (uma por tema, sem menu)

| Tema | Decisão |
|---|---|
| Onde mora | Tabelas `automacoes` + `automacao_versoes` + `automacao_execucoes` + `automacao_passos_execucao` + `automacao_inscricoes`. Estão no schema desde a 0058, vazias em prod (medido: 0 linhas em todas, e 0 em `cadence_*`). O SPEC já as previa como substitutas de `cadence_*`. Cadências continuam no motor delas; nada é migrado agora. |
| Formato | Grafo próprio `GrafoFluxo` (`versao: 1`, `nos[]`, `arestas[]`), gravado em `automacao_versoes.nodes`/`edges`. Não é o `followupGraphSchema` das cadências: aquele não tem roteador, variável, horário, HTTP nem política de falha, e mudá-lo quebraria o editor de Cadências. |
| Executor | Novo `lib/automacoes/executor.ts`, que anda o grafo direto (sem compilar para `CadenceStep`). **As ações não são reimplementadas**: cada nó de ação chama o adapter já registrado no `cadence-engine` via `executarAcaoAvulsa` (motor de ações único, SPEC §18). Adapters novos (notificar, atualizar campo, HTTP, IA texto/classificar, remover de cadência) entram no MESMO registro (`registrarAdapter`). |
| Cursor | Um cursor por execução: **cada saída liga a no máximo um nó**, sem laço (DAG). Ramificação só por nó de lógica. Sem branches paralelos, sem merge. `validarGrafo` impõe. |
| Espera | Estado na própria linha de `automacao_execucoes` (`no_atual`, `retomar_em`). Job `fluxos-sweep` do worker a cada 1 min retoma as devidas. |
| Rodar agora / webhook / evento | Executam **inline** até a primeira espera; o resto fica com o sweep. |
| Versão | Rascunho numa coluna de `automacoes` (autosave sobrescreve). Cada **Publicar** grava uma linha imutável em `automacao_versoes` e aponta `current_version_id`. Execução fica pinada na versão em que começou. Restaurar copia a versão para o rascunho; publicar é sempre um passo explícito. |
| Ensaio | Mesmo percurso do executor, com leitura real do contexto e **zero escrita**: lógica avalia de verdade, ação vira prévia, espera é pulada, IA não é chamada. Nada vai para o banco. |
| Anti-loop | `AsyncLocalStorage` marca tudo que roda dentro de um nó; `publicarEvento` carimba `payload._automacao`. Gatilho de evento ignora evento carimbado, salvo `permitirOrigemAutomacao: true`. Profundidade ≥ 3 nunca dispara. |
| Webhook público | Rota **Next** `app/api/webhooks/automacoes/[token]/route.ts`. Motivo: no Traefik `/api/webhooks/*` é o único prefixo que vai ao Next E fica fora do basic auth do dev.crm. Uma rota Hono ficaria atrás do basic auth em dev. |
| Agendado | Agenda estruturada (intervalo / todo dia / dias da semana / todo mês + horários + fuso), não cron cru: dá para explicar na tela e não exige dependência nova. `automacoes.proxima_execucao_em` guarda o próximo disparo. |
| Regras antigas | Migram **no lugar** (mesma linha, mesmo id, histórico preservado): vira `tipo='fluxo'` com um grafo de 2 nós publicado. Colunas antigas ficam intocadas (reversível). Até migrar, o motor antigo segue rodando-as. |

Fora de escopo agora (YAGNI, cada um com o gatilho para entrar): laço "para
cada" dentro do grafo (o agendado já roda "para cada registro"), ramos
paralelos e Juntar, Ir para outro fluxo, "Construir com IA", código livre,
cobrança PIX, Meta CAPI, pastas compartilhadas. Entram quando um caso real de
cliente pedir e o executor já estiver estável em prod.

---

## 1. Modelo de dados — migração aditiva

Arquivo novo `app/src/lib/db/migrations/00NN_construtor_automacoes.sql` (próximo
número livre no momento do commit; hoje o último é `0090`). SQL à mão, como o
repo faz; aplicar local com `npm run db:migrar`. Espelhar em `schema.ts`
(o `drift-schema.test.ts` cobra).

```sql
-- automacoes: rascunho, pasta, webhook, agenda
ALTER TABLE automacoes ADD COLUMN IF NOT EXISTS rascunho            jsonb;        -- { grafo, config }
ALTER TABLE automacoes ADD COLUMN IF NOT EXISTS rascunho_salvo_em   timestamptz;
ALTER TABLE automacoes ADD COLUMN IF NOT EXISTS pasta               text;
ALTER TABLE automacoes ADD COLUMN IF NOT EXISTS webhook_token       text;
ALTER TABLE automacoes ADD COLUMN IF NOT EXISTS proxima_execucao_em timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS uq_automacoes_webhook_token ON automacoes (webhook_token) WHERE webhook_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automacoes_agenda ON automacoes (proxima_execucao_em) WHERE ativo AND tipo = 'fluxo';

-- execução: estado do cursor (relaxar NOT NULL não destrói dado)
ALTER TABLE automacao_execucoes ALTER COLUMN entity_type DROP NOT NULL;
ALTER TABLE automacao_execucoes ALTER COLUMN entity_id   DROP NOT NULL;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS modo            text;   -- evento|manual|agendado|webhook
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS estado          jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS no_atual        text;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS retomar_em      timestamptz;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS claimed_until   timestamptz;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS profundidade    integer NOT NULL DEFAULT 0;
ALTER TABLE automacao_execucoes ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_automacao_execucoes_idem ON automacao_execucoes (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automacao_execucoes_devidas ON automacao_execucoes (retomar_em) WHERE status = 'aguardando';

-- passo: reserva antes do efeito externo + saída tomada
ALTER TABLE automacao_passos_execucao ADD COLUMN IF NOT EXISTS saida           text;
ALTER TABLE automacao_passos_execucao ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_automacao_passos_idem ON automacao_passos_execucao (idempotency_key) WHERE idempotency_key IS NOT NULL;
```

Convenções de valor:

- `automacoes.tipo`: `NULL`/`'regra'` = motor antigo; `'fluxo'` = construtor.
  Linha de fluxo grava `gatilho = 'fluxo:<modo>'` (ou `'fluxo:<eventoId>'`) e
  `acao = 'fluxo'`: as colunas são NOT NULL e esses valores nunca casam com o
  motor antigo. Além disso o motor antigo passa a filtrar `tipo` (ver §6).
- `automacoes.ativo`: só pode ser `true` com `current_version_id` preenchido.
- `automacao_execucoes.status`: `executando | aguardando | sucesso | erro | cancelado`
  (o motor antigo continua gravando `sucesso | erro | condicao_nao_atendida`).
- `automacao_execucoes.estado`: `{ gatilho: {...payload}, vars: {...}, nos: { <noId>: {...saidaCampos} }, tentativas: { <noId>: n } }`.
- `automacao_passos_execucao.status`: os do CHECK existente (`PENDING|RUNNING|DONE|FAILED|SKIPPED|WAITING`).
- `automacao_inscricoes`: usada só para a política de reentrada (§4.4).

---

## 2. Grafo e catálogo — `lib/automacoes/grafo.ts`

Está tudo no arquivo; aqui só o mapa.

- `GrafoFluxo { versao: 1; nos: NoFluxo[]; arestas: ArestaFluxo[] }`.
  `NoFluxo { id ("n1"), tipo, rotulo?, posicao, config, falha?, desativado?, nota? }`.
  `ArestaFluxo { id, origem, saida, destino }` — `saida` é o id do handle de origem.
- `ConfigFluxo { reentrada, fuso, horarioComercial }` vai em `automacao_versoes.settings`.
  `trigger_config` da versão = `config` do nó gatilho (cópia para consulta rápida do dispatcher).
- `CATALOGO_NOS[tipo]`: categoria, rótulo, descrição, ícone lucide, `campos`
  (com `tipo` de input, obrigatoriedade, `mostrarSe`, `aceitaExpressao`,
  padrão), `saidas`, `saidaCampos` (o que publica em `{{ nos.<id>.* }}`),
  `efeitoExterno`, `exigeEntidade`.
- `saidasDoNo(no)`: saídas reais, incluindo dinâmicas (rotas do roteador,
  classes da IA) e a saída `erro` quando a política é `saida_erro`.
- `EVENTOS_PLATAFORMA`: eventos reais com **uma fonte cada** (outbox OU
  gatilho legado), entidade e campos do payload.
- `VARIAVEIS_CONTEXTO`, `CAMPOS_ATUALIZAVEIS`, `OPERADORES_REGRA`.
- Funções puras: `resolverExpressao`, `resolverConfig`, `caminhosUsados`,
  `avaliarRegra(s)`, `validarGrafo` (→ `Pendencia[]`), `gatilhoTemEntidade`,
  `novoNo`, `proximoIdNo`, `grafoInicial`, `minutosDeEspera`.
- Schemas zod de forma: `grafoFluxoSchema`, `configFluxoSchema`.
- DTOs da API: `FluxoResumo`, `FluxoDetalhe`, `RegraAntiga`, `VersaoResumo`,
  `ExecucaoResumo`, `DetalheExecucao`, `PassoExecucao`, `PassoEnsaio`,
  `ResultadoEnsaio`, `PedidoExecucao`, `OpcoesInspetor`.

**Regra de mudança:** `grafo.ts` é contrato. Mudança só aditiva, combinada com o
outro lado e registrada no changelog no fim deste documento.

### Catálogo (resumo)

| Categoria | Nó | Saídas | Executa com |
|---|---|---|---|
| Gatilho | `gatilho` (modo manual / agendado / evento / webhook) | ok | — |
| Lógica | `condicao` | sim, nao | `avaliarRegras` |
| | `roteador` | uma por rota + `senao` | `avaliarRegras` por rota, primeira que casa |
| | `esperar` (1 min a 90 dias) | ok | `retomar_em = agora + minutosDeEspera` |
| | `aguardar_horario` (HH:MM + dias, fuso da automação) | ok | próximo instante válido |
| | `horario_comercial` (padrão da automação ou próprio) | dentro, fora | relógio no fuso |
| | `definir_variavel` | ok | grava `estado.vars` |
| | `parar` (sucesso/erro + motivo) | — | encerra |
| Plataforma | `criar_tarefa` | ok (+erro) | adapter `crm_create_task` |
| | `mover_etapa` | ok (+erro) | `crm_update_stage` (recusa Ganho) |
| | `adicionar_tag` / `remover_tag` | ok (+erro) | `crm_add_tag` / `crm_remove_tag` |
| | `atribuir_responsavel` | ok (+erro) | `crm_assign_owner` |
| | `enviar_whatsapp` (texto ou modelo) | ok (+erro) | `whatsapp` / `whatsapp_template` (fila → worker → `wuzapiFetch` com `WHATSAPP_ALLOWLIST`) |
| | `enviar_email` | ok (+erro) | `email` (Resend) |
| | `inscrever_cadencia` | ok (+erro) | **novo** adapter `fluxo_inscrever_cadencia` → `iniciarCadencia` |
| | `remover_cadencia` | ok (+erro) | **novo** `fluxo_remover_cadencia` → `cancelarCadencia` nas inscrições vivas |
| | `notificar_usuario` | ok (+erro) | **novo** `fluxo_notificar` → insert em `notificacoes` |
| | `atualizar_campo` | ok (+erro) | **novo** `fluxo_atualizar_campo` (allowlist `CAMPOS_ATUALIZAVEIS`) |
| | `adicionar_nota` | ok (+erro) | `crm_add_note` |
| Integrações | `requisicao_http` | ok (+erro) | **novo** `fluxo_http` |
| | `discagem_callface` | ok (+erro) | `crm_callface_call` |
| IA | `ia_gerar_texto` | ok (+erro) | **novo** `fluxo_ia_texto` → `executeAgent({ mode: "live", suppressEgress: true })` |
| | `ia_classificar` | uma por classe + `outra` (+erro) | **novo** `fluxo_ia_classificar` (mesmo prompt do adapter `ai_classify`, sem depender de `step.id`) |
| | `ia_responder` | ok (+erro) | `ai_agent_message` (envia pelo agente, respeita bot silenciado) |

`exigeEntidade: true` = o nó só roda com registro no contexto; o gatilho
precisa fornecer um (`gatilhoTemEntidade`), senão é pendência de publicação.

---

## 3. Gatilhos

### 3.1 Evento da plataforma

O dispatcher recebe o fato por **um** de dois caminhos, conforme
`EventoPlataforma.fontes` (nunca os dois, para não disparar em dobro):

1. **Outbox** (`fontes.outbox`): `lib/events/consumer.ts`, logo depois de
   `dispatchAutomationEvent(evento)`, chama `dispararFluxosPorEvento(evento)`.
2. **Legado** (`fontes.legado`): no fim de `dispararAutomacoes(gatilho, ctx)`
   (`lib/crm/automacao-engine.ts`), chama `dispararFluxosPorGatilhoLegado(gatilho, ctx)`.
   Cobre `nps_recebido`, `contrato_vencendo`, `lead_inativo` e os quatro do
   Stripe (que só `dispararAutomacoesFinanceiras` sabe ligar à empresa).
   Os gatilhos legados que TAMBÉM viram outbox (`novo_lead`, `novo_negocio`,
   `mudanca_status`, `tag_adicionada`, `whatsapp_recebido`) são ignorados aqui.

Ligações novas que o backend faz nesta frente (sem elas o evento existe na
tela e não dispara — proibido):

- `negocio.etapa_mudou` pelo board `/pipeline`: `lib/vendas/pipeline.ts` grava
  `OpportunityStageChanged` em `vendas_eventos` e a ponte canônica
  (`lib/vendas/ponte-evento-canonico.ts`, `TRADUCAO`) não o deixa passar.
  Adicionar `OpportunityStageChanged: { tipo: "OpportunityStageChanged", agregado: "oportunidade" }`.
  Hoje só `negocios.ts` (legado) e o adapter publicam `StageChanged`.
- `tarefa.vencida`: no `fluxos-sweep`, só se houver fluxo ativo ouvindo:
  tarefas da org com `vence_em` entre agora−24h e agora, `concluida = false`
  e `status` aberto; chave `tarefa_vencida:<automacaoId>:<tarefaId>`.

Resolução da entidade (`entidadeDoEvento`): `aggregate_type`/`aggregate_id`
quando é lead/negocio/oportunidade/contato/empresa/cliente/servico; para
`aquisicao`, `payload.lead_legado_id` → lead; senão as chaves do payload
(`leadId`, `negocioId`, `entityType`+`entityId`...), como `entityIdFor` do
`event-dispatcher.ts`. Eventos `Opportunity*` chegam com `registro.tipo =
"oportunidade"`; a hidratação preenche `negocio` pelo `negocio_id_legado`.

Filtro: `filtros` do gatilho são regras sobre o contexto com o payload em
`gatilho.*` (o editor sugere os campos de `EventoPlataforma.campos`).

### 3.2 Manual

Só pelo botão **Rodar agora** (ou `POST /rodar`). `config.entidade` diz sobre
que tipo de registro roda; a tela pede o registro antes de rodar.

### 3.3 Agendado

`agenda.ts` (backend) calcula `proximaExecucao(config, fuso, apos)`.
Recalcula ao publicar, ao ativar e depois de cada disparo. No sweep:
`UPDATE automacoes SET proxima_execucao_em = <próximo> WHERE id = ? AND
proxima_execucao_em = <lido>` (o update condicional é o claim). Com `alvo =
"nenhuma"`: uma execução, chave `agenda:<id>:<slotISO>`. Com `alvo = lead |
negocio`: consulta com os filtros da allowlist (`alvoEtapa`, `alvoTag`,
`alvoResponsavelId`, `alvoParadoHaDias` sobre `updated_at`), sempre com
`organizacao_id`, teto 500, uma execução por registro com chave
`agenda:<id>:<slotISO>:<entityId>`.

### 3.4 Webhook

`POST /api/webhooks/automacoes/<token>` (Next). Token
`randomBytes(24).toString("base64url")`, gerado ao salvar rascunho com modo
webhook. Valida: automação `ativo`, versão publicada com gatilho webhook,
corpo JSON ≤ 256 KB. Até 60 chamadas/min por automação (conta execuções
`modo='webhook'` do último minuto) → 429. Cabeçalho `Idempotency-Key`
opcional → chave `webhook:<id>:<valor>`. Token desconhecido ou automação
desligada → 404 genérico. Resposta `202 { execucaoId }`. O corpo vai para
`gatilho.body`; `webhookEntidade` + `webhookEntidadeId` (expressão) amarram
um registro, conferindo que pertence à org da automação.

### 3.5 Anti-loop

- `lib/automacoes/contexto.ts` exporta `origemAutomacao = new AsyncLocalStorage<{ automacaoId; execucaoId; profundidade }>()`.
- O executor roda cada nó dentro de `origemAutomacao.run(...)`.
- `publicarEvento` (`lib/events/outbox.ts`) e a ponte canônica injetam
  `payload._automacao` quando há store ativa.
- O dispatcher descarta evento carimbado, salvo `permitirOrigemAutomacao`;
  descarta sempre se `profundidade >= 3` ou se o carimbo é da própria
  automação. Execução nascida de evento carimbado recebe `profundidade + 1`.

---

## 4. Executor — `lib/automacoes/executor.ts`

### 4.1 Contexto

`hidratarContexto(organizacaoId, entidade)` relê do banco **a cada retomada**
(o mesmo princípio do `hidratarVars` do cadence-engine: decisão depois de uma
espera usa o estado de agora, não o de três dias atrás):

```
{ registro: { tipo, id, nome, responsavel_id, responsavel_nome },
  lead, negocio, contato, empresa,     // pelos vínculos da entidade (mesma lógica de entityLinks)
  gatilho: estado.gatilho, vars: estado.vars, nos: estado.nos,
  agora: ISO, hoje: "dd/mm/aaaa" }
```

Toda leitura com `organizacao_id`. `lead.tags` = nomes das labels.
`contato.ultima_mensagem` = última `whatsapp_mensagens` com `direcao = 'in'`.

### 4.2 Algoritmo

```
iniciarExecucao({ automacaoId, organizacaoId, versaoId, modo, entidade?, payload, idempotencyKey?, profundidade })
  1. reentrada (§4.4); se barrada → retorna null
  2. INSERT automacao_execucoes (status 'executando', no_atual = 1º nó depois do gatilho,
     estado.gatilho = payload) ON CONFLICT (idempotency_key) DO NOTHING → replay devolve o id existente
  3. avancarExecucao(id)

avancarExecucao(id)
  1. claim: UPDATE ... SET claimed_until = now()+2min
            WHERE id AND status IN ('executando','aguardando') AND (claimed_until IS NULL OR claimed_until < now())
  2. carrega o grafo da VERSÃO da execução (version_id), nunca o rascunho
  3. ctx = hidratarContexto(...)
  4. até 100 nós nesta chamada:
       nó desativado → passo SKIPPED, segue pela saída "ok"
       passo: INSERT ... idempotency_key = '<exec>:<no>:<tentativa>' ON CONFLICT DO NOTHING
         · conflito com DONE    → reaproveita saída/resultado e segue (retomada após queda)
         · conflito com RUNNING → execução 'erro', motivo "efeito externo incerto; revisão humana"
                                   (mesma política do cadence-engine: nunca repetir envio às cegas)
       config = resolverConfig(no.config, ctx)
       roda o handler do tipo com Promise.race(timeoutSeg) dentro de origemAutomacao.run
         ação → executarAcaoAvulsa(adapter, { ..., config, chaveExecucao: 'fluxo:<exec>:<no>:<tentativa>' })
       sucesso → passo DONE (saida, entrada = config, resultado); estado.nos[no] = saidaCampos
       espera  → passo DONE com { retomadoEm }; no_atual = próximo; status 'aguardando';
                 retomar_em; solta claim; FIM da chamada
       falha   → tentativas restantes? status 'aguardando', retomar_em = +1/5/15 min, mesmo nó
                 senão aplica a política: parar → execução 'erro' | saida_erro → saída "erro" | ignorar → saída "ok"
       próximo = aresta (origem = no, saida = saida); sem aresta → execução 'sucesso'
  5. ao terminar: finished_at, status final, inscrição COMPLETED/FAILED/CANCELLED
```

Ajuste no `cadence-engine.ts` (única mudança lá): `executarAcaoAvulsa` aceita
`chaveExecucao?: string` e usa como `enrollmentId` quando vier. Sem isso a
chave atual (hash de entidade + config) faria a mesma tarefa, na mesma
entidade, nunca mais ser criada por uma automação semanal.

### 4.3 Retomada e sweep

Job `fluxos-sweep` (`worker/index.ts`, `upsertJobScheduler` a cada 60 s,
nome adicionado em `SCHEDULERS_JOBS_AGENDADOS`), nesta ordem: agendados
devidos (§3.3), tarefas vencidas (§3.1), até 100 execuções `aguardando` com
`retomar_em <= now()` → `avancarExecucao`. Best-effort por item, como o
`cadence-sweep`.

### 4.4 Reentrada (`ConfigFluxo.reentrada`)

Só para execução com entidade:
- `uma_viva` (padrão): `INSERT automacao_inscricoes (status 'ACTIVE') ON CONFLICT DO NOTHING`
  (o índice parcial `uq_automacao_inscricao_viva` já existe); conflito = não entra.
- `uma_vez`: existe qualquer inscrição dessa entidade nessa automação → não entra.
- `sempre`: sem inscrição.

`metadata.execucaoId` liga a inscrição à execução.

### 4.5 Nós que precisam de cuidado

- `requisicao_http`: só `http(s)`; resolver DNS e **recusar IP privado,
  loopback, link-local e metadata** (169.254.169.254) — SSRF; sem seguir
  redirect para host privado; timeout do nó (padrão 10 s); resposta lida até
  256 KB; `corpo` JSON se o content-type for JSON, senão texto.
- `atualizar_campo`: só os campos de `CAMPOS_ATUALIZAVEIS`; `campos_custom`
  faz merge em `negocios.campos_custom[nomeCampoCustom]`. Grava `audit_log`
  com `source: "automation"`.
- `enviar_whatsapp`/`enviar_email`: o telefone/e-mail vêm de `config.telefone`/`config.para`
  resolvidos ou do registro, passados em `vars` ao adapter. Nenhuma trava de
  envio é tocada.
- `mover_etapa` em oportunidade: o adapter escreve `oportunidades.stage`
  direto; conferir se o board lê `stage` ou `etapa`/`etapa_id` e, se for o
  caso, passar pela porta de `lib/vendas/pipeline.ts` (SPEC §16: automação
  chama comando de domínio).

### 4.6 Ensaio — `ensaiarFluxo({ organizacaoId, grafo, config, pedido })`

Mesmo percurso, mesmo `hidratarContexto`, nenhum INSERT/UPDATE:
- lógica: avaliada de verdade (`status: "ok"`);
- espera/horário: `status: "esperaria"`, prévia "Esperaria 2 dias (retomaria em 03/10 09:00)", segue na hora;
- ação/integração: `status: "simulado"`, prévia em pt-BR com a config resolvida
  ("Criaria a tarefa \"Ligar para Ana\" para Bruno, vence em 1 dia"); `saidaCampos` preenchidos com `"(ensaio)"`;
- IA: não chama modelo; `ia_classificar` segue por `pedido.escolhas[noId]` ou `outra`;
- nó com pendência: `status: "pendencia"`, `final: "pendencia"`, para ali.
Ensaia o rascunho atual (o corpo pode trazer `grafo`/`config` não salvos).

### 4.7 Execuções na tela Execuções

`lib/automacoes/execucoes.ts` já une `automacao_execucoes`: mapear
`executando → processando` e `aguardando → aguardando`, nome da automação, e
devolver o link `/automacoes/fluxos/<id>?execucao=<execId>` no detalhe.

---

## 5. API — `api-server/routes/automacoes-fluxos.ts`

Montar em `server.ts` com `app.route("/api", automacoesFluxosRoutes)` **antes**
de `app.route("/api/automacoes", automacoesRoutes)` (linha ~142): aquele tem
`/:id` e engoliria `/automacoes/fluxos`. Leitura com `getCtx`; toda escrita,
`ensaiar` e `rodar` com `exigirCtx(c, "automation.manage")`. Toda query com
`organizacaoId`. Erros `{ error: string, ... }` em pt-BR. Adicionar o arquivo
em `SO_CONFIGURACAO` (`rotas-configuracao-protegidas.test.ts`) e no mapa de
`permissoes.test.ts`.

| Método e rota | Corpo | Resposta |
|---|---|---|
| `GET /automacoes/fluxos?busca=&pasta=` | — | `{ fluxos: FluxoResumo[]; pastas: string[]; regrasAntigas: RegraAntiga[] }` |
| `GET /automacoes/fluxos/opcoes` | — | `OpcoesInspetor` |
| `GET /automacoes/fluxos/entidades?tipo=&busca=` | — | `{ id; nome; detalhe: string \| null }[]` (até 20, para escolher registro no Ensaiar/Rodar) |
| `POST /automacoes/fluxos` | `{ nome; pasta?; grafo?; config? }` | `201 FluxoDetalhe` (rascunho; `grafoInicial()` se vier vazio) |
| `GET /automacoes/fluxos/:id` | — | `FluxoDetalhe` |
| `PUT /automacoes/fluxos/:id/rascunho` | `{ grafo; config; nome?; pasta?; salvoEmBase }` | `{ salvoEm; pendencias; webhookUrl }` · `409` se `salvoEmBase` ≠ `rascunho_salvo_em` (alterado em outra aba) · `400` se o zod de forma falhar |
| `POST /automacoes/fluxos/:id/publicar` | — | `{ fluxo: FluxoDetalhe; versao: VersaoResumo }` · `422 { error, pendencias }` |
| `PATCH /automacoes/fluxos/:id` | `{ ativo?; nome?; pasta? }` | `FluxoDetalhe` · ativar sem versão → `409 "Publique antes de ativar"` |
| `POST /automacoes/fluxos/:id/duplicar` | — | `201 FluxoDetalhe` (rascunho copiado, "(cópia)", desligada, sem versões, token novo) |
| `DELETE /automacoes/fluxos/:id` | — | `204` · `409` se houver execução `aguardando` (cancelar ou desligar antes) |
| `GET /automacoes/fluxos/:id/versoes` | — | `VersaoResumo[]` (mais nova primeiro) |
| `GET /automacoes/fluxos/:id/versoes/:versaoId` | — | `{ grafo; config; versao: VersaoResumo }` |
| `POST /automacoes/fluxos/:id/versoes/:versaoId/restaurar` | — | `FluxoDetalhe` (rascunho = versão; não publica) |
| `POST /automacoes/fluxos/:id/ensaiar` | `PedidoExecucao & { grafo?; config? }` | `ResultadoEnsaio` |
| `POST /automacoes/fluxos/:id/rodar` | `PedidoExecucao` | `{ execucao: ExecucaoResumo; passos: PassoExecucao[] }` (roda a versão PUBLICADA, ligada ou não) · `409` sem versão: "Publique para rodar de verdade. Para testar o rascunho, use Ensaiar." |
| `GET /automacoes/fluxos/:id/execucoes?status=&antes=` | — | `{ itens: ExecucaoResumo[]; proximo: string \| null }` (30 por página, cursor por `iniciadaEm`) |
| `GET /automacoes/fluxos/execucoes/:execId` | — | `DetalheExecucao` |
| `POST /automacoes/fluxos/execucoes/:execId/cancelar` | — | `ExecucaoResumo` (só `aguardando`) |
| `POST /automacoes/fluxos/:id/webhook/regenerar` | — | `{ webhookUrl }` |
| `POST /automacoes/fluxos/regras/:regraId/migrar` | — | `FluxoDetalhe` · `422 { error }` se não der para migrar fielmente |

Publicar: `validarGrafo` vazio → transação: insere `automacao_versoes`
(`version = max+1`, `nodes`, `edges`, `trigger_config = config do gatilho`,
`settings = config`, `published_at`, `created_by_id`), atualiza
`current_version_id`, `updated_at` e, se agendado e ativo,
`proxima_execucao_em`. O rascunho permanece (agora igual à versão).
`alteracoesNaoPublicadas` = rascunho ≠ nodes/edges/settings da versão atual
(comparação de JSON canônico).

`webhookUrl` = `${NEXTAUTH_URL ou APP_URL}/api/webhooks/automacoes/<token>`.

`GET /api/automacoes` (rota legada) passa a devolver só regras (`tipo` nulo ou
`'regra'`), para a tela antiga não listar fluxos que não sabe editar.

---

## 6. Migração das Regras antigas

`POST .../regras/:regraId/migrar`, um por vez, iniciado pelo usuário na lista.
Converte NO LUGAR:

1. Gatilho: gatilho legado → evento do catálogo (`novo_lead → lead.criado`,
   `novo_negocio → negocio.criado`, `mudanca_status → negocio.etapa_mudou`,
   `tag_adicionada → tag.adicionada`, `whatsapp_recebido → whatsapp.recebido`,
   os demais pelo `fontes.legado`).
2. `condicao` → `filtros` do gatilho (`maior_que → maior`, `menor_que → menor`,
   campo → `gatilho.<campo>`). Se o campo não existir no payload do evento
   novo (os nomes do `ctx.campos` legado e do payload do outbox nem sempre
   batem — conferir por gatilho), **recusa com 422** e explica; a regra segue
   no motor antigo.
3. Ação → um nó: `criar_tarefa → criar_tarefa`, `notificar_usuario`,
   `atribuir_responsavel`, `mudar_status → mover_etapa`,
   `enviar_email → enviar_email` (assunto = `tituloTarefa` ou "Callface"),
   `enviar_whatsapp`, `adicionar/remover_tag_empresa → adicionar/remover_tag`
   (label resolvida pelo nome, criada se faltar, como o motor antigo faz),
   `iniciar_cadencia → inscrever_cadencia`.
4. Grava a versão 1 publicada, `tipo = 'fluxo'`, `current_version_id`, mantém
   `ativo`. **Não apaga nem altera** `gatilho/condicao/acao/acao_config`.
5. Motor antigo: `dispararAutomacoes` passa a filtrar
   `AND (tipo IS NULL OR tipo = 'regra')`. Desfazer = `tipo = NULL`,
   `current_version_id = NULL`.

Prod tem 0 regras hoje; o caminho existe para quem criar antes do corte.

---

## 7. UX — lista e editor (ONFACE)

Tokens e casca: os do protótipo (`localhost:8899`) e das telas portadas.
Coral `#fe4f2b` só como acento (seleção, caminho percorrido, gatilho);
primário `#d93c1a` (hover `#c2330f`); grafite `#12171d`; papel `#f6f6f3`;
elevação por `box-shadow: inset 0 0 0 1px #e3e7e8`. Plus Jakarta Sans em
títulos e números, Inter no corpo. Nó do canvas = linguagem `fx-no` do DS
(cartão branco, rótulo de tipo em caixa alta pequena com ícone, título,
resumo, rodapé de execução); fundo do canvas = `FundoGrafico variante="pontos"`.
Nada de cartão escuro do `FollowupFlowCanvas` nem shadcn cru.

### 7.1 Lista — `/automacoes/fluxos`

- Cabeçalho (`PaginaCabecalho`): "Fluxos", subtítulo "Trabalho que acontece
  sozinho, no horário ou quando algo muda." Ações: **Execuções** (→
  `/automacoes/execucoes?fonte=automacao`) e primário **Criar automação**.
- Criar automação abre um diálogo: "Em branco" + os modelos (§7.6). Cria via
  `POST` e navega para o editor.
- Barra: busca por nome; chips de pasta (Todas · Sem pasta · cada pasta).
- Linha: nome; `gatilhoResumo`; selo de estado (Rascunho · Publicada,
  desligada · Ativa · "Alterações não publicadas" como selo secundário);
  última execução (relativo + ponto de status); "N em 7 dias · M com erro";
  toggle (desabilitado sem versão, com dica "Publique primeiro"); menu
  (Duplicar, Mover para pasta, Excluir com confirmação que diz que o
  histórico de execuções vai junto).
- Vazio honesto: o que é uma automação, três modelos clicáveis e "Criar a primeira".
- "Regras antigas (N)" só se houver: linha com Migrar (ou o motivo de não migrar).
- "Rotinas do sistema" (as `ROTINAS_AGENDADAS` que a tela já mostra), recolhido.
- Carregando: esqueleto das linhas. Erro: faixa com "Tentar de novo".

### 7.2 Editor — `/automacoes/fluxos/[id]`

Tela cheia dentro da casca, três zonas: barra do topo, canvas, painel direito.

**Barra do topo:** Voltar · nome editável inline · selo de estado · toggle
ativo · desfazer / refazer (Cmd+Z / Shift+Cmd+Z, pilha local de 50
snapshots) · Histórico · Ensaiar · Rodar agora · "salvo há N s" (ou
"salvando…", "não salvo: <motivo>") · **Publicar** (primário).

- Autosave: 1,5 s depois da última mudança, `PUT /rascunho` com
  `salvoEmBase`. `409` → faixa "Esta automação mudou em outra aba.
  Recarregar" (não sobrescreve).
- Publicar com pendência: popover com a lista de `validarGrafo`; clicar
  numa pendência seleciona o nó e abre o campo no inspetor. Sem pendência:
  publica, toast "Versão N publicada" e, se desligada, oferece "Ativar agora".
- Rodar agora: sem versão → explica e oferece Ensaiar. Com gatilho que
  exige registro → diálogo de escolha (`GET /entidades`). Resultado abre o
  painel de execução.
- Somente leitura sem `automation.manage` (`podeGerir: false`): sem toggle,
  sem Publicar, inspetor desabilitado, faixa explicando.

**Canvas (React Flow 12, `@xyflow/react`, já instalado):** minimapa, zoom
+/−/encaixar, snap 16 px, conectar arrastando de saída para entrada, "+" em
toda saída livre (abre a paleta e já cria o nó conectado, posicionado abaixo
ou à direita), Delete remove o selecionado (gatilho não sai), Cmd+D duplica
nó. Nó com várias saídas mostra uma linha por saída com o rótulo
(Sim/Não, rotas, classes, Erro em vermelho), como o nó Opções do benchmark.
Nó com pendência: contorno de erro e a primeira pendência no rodapé. Nó
desativado: opacidade reduzida e selo "Desligado". Aresta selecionada pode
ser removida.

**Paleta:** busca + categorias com contagem (Lógica, Plataforma, IA,
Integrações), item com ícone, rótulo e descrição do catálogo. Abre pelo "+"
do canto do canvas e pelo "+" das saídas.

**Inspetor (direita, ~380 px):** título e descrição do bloco; campos do
catálogo na ordem, respeitando `mostrarSe`; um componente por `TipoCampo`
(regras, rotas, classes, pares, duração, horários, dias da semana, selects
alimentados por `GET /opcoes`); ao lado de todo campo `aceitaExpressao`, o
**seletor de variáveis** (`VARIAVEIS_CONTEXTO` + `gatilho.*` do evento
escolhido + `nos.<id>.*` só dos nós ANTERIORES no caminho), inserindo
`{{ caminho }}`. Seção "Se este bloco falhar" (Parar / Seguir pela saída de
erro / Ignorar e continuar), "Tempo limite (segundos)" e "Tentar de novo"
(0–3) nos nós com efeito externo e IA; "Desligar este bloco"; nota. Sem nó
selecionado: configurações da automação (pasta, reentrada, fuso, expediente)
e, com gatilho webhook, a URL com copiar e "Gerar outro endereço".

**Painel de execução / ensaio:** aba no painel direito. Ensaio mostra a faixa
"Ensaio: nada foi enviado nem gravado", o registro usado e a lista de passos
com prévia. Execução real lista as últimas execuções (status, registro,
quando); escolher uma pinta o caminho no canvas (nós percorridos com selo
ok/erro/aguardando, arestas percorridas em coral) e o clique num nó mostra
entrada e saída (JSON legível) e o erro. `?execucao=<id>` na URL abre direto.
Execução `aguardando` mostra "retoma em …" e Cancelar.

**Histórico:** gaveta com as versões; escolher uma mostra o grafo daquela
versão no canvas em modo leitura, faixa "Vendo a versão N — Restaurar no
rascunho / Voltar ao rascunho".

### 7.3 Estados obrigatórios

Carregando (esqueleto do canvas), erro de carga (faixa + tentar de novo), 404
("Automação não encontrada" + voltar), salvando/erro ao salvar, sem
permissão, rodar sem versão, ensaio com pendência, execução sem passos.
Nenhum botão que não age.

### 7.4 Copy

pt-BR direto, verbos de ação, sem jargão técnico na superfície ("Saída de
erro", não "error handle"). A palavra "fluxo" na URL e no menu; "automação"
nos textos.

### 7.5 Validação no editor

O editor roda `validarGrafo` a cada mudança (é puro e barato) e usa o mesmo
resultado para marcar nós, desabilitar Publicar com a contagem e alimentar o
popover. A API repete a validação ao publicar; as duas listas são idênticas
por construção.

### 7.6 Modelos prontos (`components/onface/automacoes/fluxos/modelos.ts`)

Dados puros com os tipos de `grafo.ts`. Campos que dependem da conta (tag,
usuário, cadência) ficam vazios de propósito: viram pendência e ensinam o
que preencher.

1. **Boas-vindas ao lead novo** — `lead.criado` → Horário comercial →
   dentro: WhatsApp "Oi {{ lead.primeiro_nome }}, aqui é da Callface…" →
   Criar tarefa "Ligar para {{ lead.nome }}" (1 h); fora: Aguardar até 09:00
   → WhatsApp.
2. **Negócio parado há 7 dias** — Agendado todo dia 09:00, para cada negócio
   sem atualização há 7 dias → Criar tarefa "Retomar {{ negocio.titulo }}"
   → Notificar o responsável.
3. **Pagamento falhou no Stripe** — `stripe.pagamento_falhou` → Adicionar
   tag (escolher) → Notificar (escolher) → Criar tarefa de cobrança, alta.
4. **Proposta visualizada sem retorno** — `proposta.visualizada` → Esperar
   1 dia → Condição `negocio.etapa` diferente de ganho → Criar tarefa de
   follow-up.
5. **Triagem da resposta no WhatsApp com IA** — `whatsapp.recebido` → IA:
   classificar (interessado / sem interesse / dúvida) → interessado: Mover
   etapa + Notificar; sem interesse: Adicionar tag; dúvida: Criar tarefa.

---

## 8. Divisão de arquivos (sem sobreposição)

### Compartilhado (pronto, não editar sem combinar)

- `app/src/lib/automacoes/grafo.ts`, `app/src/lib/automacoes/grafo.test.ts`

### Backend cria

- `app/src/lib/db/migrations/00NN_construtor_automacoes.sql`
- `app/src/lib/automacoes/executor.ts` — `iniciarExecucao`, `avancarExecucao`, `sweepFluxos`, `ensaiarFluxo`, handlers por tipo
- `app/src/lib/automacoes/contexto.ts` — `hidratarContexto`, `origemAutomacao` (AsyncLocalStorage)
- `app/src/lib/automacoes/adapters-fluxo.ts` — `fluxo_notificar`, `fluxo_atualizar_campo`, `fluxo_http`, `fluxo_ia_texto`, `fluxo_ia_classificar`, `fluxo_inscrever_cadencia`, `fluxo_remover_cadencia`
- `app/src/lib/automacoes/disparo.ts` — `dispararFluxosPorEvento`, `dispararFluxosPorGatilhoLegado`, `entidadeDoEvento`, agendados e tarefas vencidas
- `app/src/lib/automacoes/agenda.ts` — `proximaExecucao`
- `app/src/lib/automacoes/fluxos-servico.ts` — CRUD, publicar, versões, duplicar, migrar regra, resumo da lista (usado pela rota Hono e pela rota do webhook)
- `app/src/lib/automacoes/executor.test.ts`, `agenda.test.ts`, `disparo.test.ts`
- `app/src/api-server/routes/automacoes-fluxos.ts`
- `app/src/app/api/webhooks/automacoes/[token]/route.ts`

### Backend edita

- `app/src/lib/db/schema.ts` (colunas novas)
- `app/src/lib/cadencia/cadence-engine.ts` (só `chaveExecucao` em `executarAcaoAvulsa`)
- `app/src/lib/crm/automacao-engine.ts` (filtro de `tipo` + chamada a `dispararFluxosPorGatilhoLegado`)
- `app/src/api-server/routes/automacoes.ts` (`GET /` só regras)
- `app/src/lib/events/consumer.ts` (chamada a `dispararFluxosPorEvento`)
- `app/src/lib/events/outbox.ts` (carimbo `_automacao`)
- `app/src/lib/vendas/ponte-evento-canonico.ts` (`OpportunityStageChanged` + carimbo)
- `app/src/worker/index.ts` (job `fluxos-sweep`)
- `app/src/api-server/server.ts` (montagem)
- `app/src/lib/automacoes/execucoes.ts` (status novos, link)
- `app/src/api-server/rotas-configuracao-protegidas.test.ts`, `app/src/lib/auth/permissoes.test.ts`

### Frontend cria

- `app/src/app/(crm2)/automacoes/fluxos/[id]/page.tsx` (server: tenant, permissão, carrega `FluxoDetalhe` ou 404)
- `app/src/components/onface/automacoes/fluxos/` —
  `Editor.tsx`, `BarraTopo.tsx`, `Canvas.tsx`, `NoCanvas.tsx`, `Paleta.tsx`,
  `Inspetor.tsx`, `campos/` (um arquivo por grupo de `TipoCampo`, incluindo
  `SeletorVariaveis.tsx`), `PainelExecucao.tsx`, `Historico.tsx`,
  `Pendencias.tsx`, `EscolherRegistro.tsx`, `NovoFluxo.tsx` (diálogo
  em branco/modelos), `useEditorFluxo.ts` (estado, desfazer, autosave),
  `api.ts` (fetch tipado com os DTOs), `icones.ts` (nome lucide → componente),
  `modelos.ts`, `fluxos.css`

### Frontend edita

- `app/src/app/(crm2)/automacoes/fluxos/page.tsx`
- `app/src/components/onface/automacoes/Fluxos.tsx` (vira a lista nova)
- `app/src/components/onface/automacoes/formato.ts` (rótulos de `aguardando`, modos)

Ninguém edita `components/onface/proto/*Desenho.tsx|*Liga.tsx` (gerados),
`FollowupFlowCanvas.tsx`, nem o editor de Cadências.

### Paralelismo

O frontend começa já: tipos, catálogo, validação e modelos estão prontos;
até a API existir, `api.ts` aponta para as rotas definidas acima e a tela
mostra o erro real (sem mock). Ordem sugerida ao backend para destravar a
tela: migração → `fluxos-servico` + `GET/POST/PUT/publicar/opcoes` → ensaio →
executor/rodar → execuções → disparo por evento/agenda/webhook → migração de
regras.

---

## 9. Pronto quando (cada lado prova)

Backend:
- testes `node --import tsx --env-file-if-exists=.env --test` de grafo, executor
  (espera e retomada, política de falha, idempotência do passo, reentrada),
  agenda e disparo (uma fonte por evento, anti-loop) verdes;
- smoke `scripts/dev-smoke.sh` de todas as rotas da tabela §5 com status
  esperado, incluindo `401/403` sem permissão e `404` de outra org;
- SQL mostrando execução e passos gravados de um "Rodar agora" real com tarefa
  de teste (apagada no fim), e um ensaio sem nenhuma linha nova;
- typecheck só dos arquivos tocados.

Frontend:
- `visitar.mjs /automacoes/fluxos /automacoes/fluxos/<id>` com 0 erro de
  console, 0 request falha, screenshot conferido contra o protótipo;
- script de clique: criar pelo modelo, ligar nós pelo "+", preencher no
  inspetor, ver pendência sumir, publicar, ensaiar, rodar, abrir execução;
- typecheck só dos arquivos tocados.

---

## 10. Achados no caminho (para quem implementa)

- `compileFollowupGraph` (cadências) compila condição no modo combinado para
  ler `condition.<nodeId>` em `vars`, e nada escreve essa chave: a condição
  combinada das cadências provavelmente sempre cai no "Não". Fora desta
  frente; registrar para as Cadências.
- `crm_assign_owner` lê o dono atual por id sem `organizacao_id`
  (leitura só, mas fura a regra de tenant). Corrigir ao passar por lá.
- Dev local não roda o worker: evento por outbox e espera só andam com o
  worker de pé (`scripts/dev.sh`) ou chamando `processarEventosPendentes` /
  `sweepFluxos` num script. "Rodar agora" e webhook andam inline e não
  dependem dele.

## Changelog do contrato

- 01/10/2026 — versão inicial (grafo.ts + este documento).
