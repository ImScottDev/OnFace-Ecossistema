# 04. Escritores (quem grava em cada entidade)

Levantamento AS-IS, somente leitura. Nada foi alterado no banco nem no código.
Base de código: `/Users/Scott/Documents/Scott Studio/callface-crm-dev/app/src`.
Banco consultado: `callface_crm` local, carga de produção de 20/09/2026.

Este documento descreve o que existe. Não propõe arquitetura, não indica qual
tabela deve vencer, não recomenda solução.

## 1. Escopo e método

### 1.1 Como os escritores foram encontrados

O projeto usa dois estilos de acesso a dados e os dois foram varridos:

| Estilo | Padrão buscado | Onde predomina |
|---|---|---|
| Drizzle query builder | `db.insert(X)`, `db.update(X)`, `db.delete(X)`, `tx.insert(X)` | rotas Hono, rotas Next, worker, `src/lib/crm`, `src/lib/cs` |
| SQL cru em template | `db.execute(sql\`INSERT INTO ...\`)`, `tx.execute(sql\`UPDATE ...\`)` | `src/lib/vendas`, server actions do ONFACE |

Comandos executados na raiz `app/src`:

```
grep -rnoE '\.(insert|update|delete)\((leads|leadsT|empresas|pessoas|pessoasTable|contatos|contatosT|negocios|negociosT|oportunidades|tarefas|tarefasT|atividades|ativT|contratos|clientes|fulfillments|communications|commsT)\)' --include='*.ts' --include='*.tsx' .

grep -rnoiE '(INSERT +INTO +<tabela>\b|DELETE +FROM +<tabela>\b|UPDATE +<tabela>\b)' --include='*.ts' --include='*.tsx' .
```

Um detalhe que muda o resultado: o `worker/index.ts` importa o schema com
renomeação por desestruturação (`worker/index.ts:868`:
`leads: leadsT, negocios: negociosT, contatos: contatosT`; `worker/index.ts:1928`:
`atividades: ativT`; `worker/index.ts:2204`: `communications: commsT`). Um grep
por `insert(leads)` perde 24 escritas do worker. Os aliases estão incluídos na
varredura acima. Não existe nenhum outro alias de import para essas tabelas no
repositório, e não existe escrita com nome de tabela dinâmico: `sql.raw` só
aparece em filtros e listas de IDs, nunca em `INSERT`/`UPDATE`/`DELETE`
(verificado com `grep -rn 'sql\.raw(' --include='*.ts' .`).

### 1.2 O que entra na contagem principal

Entram: `api-server/routes/*` (rotas Hono), `app/api/**/route.ts` (rotas Next e
webhooks), `app/(crm2)/**/actions.ts` e `app/(onface-preview)/**/actions.ts`
(server actions), `worker/index.ts` (BullMQ) e os módulos de `src/lib/*`
chamados por eles.

Ficam fora da contagem principal e vão para a seção 15:
`*.test.ts`, `lib/db/seed.ts`, `lib/db/cleanup-seed.ts`,
`lib/db/backfill-domain-model.ts`, tudo em `src/scripts/`, as migrations `.sql`
e o grupo de rotas `app/onface-desenho/` (que aborta em produção por
`proibirEmProducao()`, `app/onface-desenho/atividades/actions.ts:18`).

### 1.3 Significado das duas colunas de julgamento

**"Passa por service/regra?"**

| Valor | Critério |
|---|---|
| `Sim (lib/vendas)` | A escrita acontece dentro de `src/lib/vendas`, que valida o estado antes e grava o evento em `vendas_eventos` na mesma transação (`lib/vendas/eventos.ts:86`, `lib/vendas/executor.ts:9`). |
| `Parcial (domínio + outbox)` | A escrita acontece dentro de um módulo de `src/lib/*` que também chama `publicarEvento` (`lib/events/outbox.ts:96`). |
| `Parcial (domínio, sem evento)` | A escrita acontece dentro de um módulo de `src/lib/*`, mas esse módulo não emite nenhum evento. |
| `Não` | `INSERT`/`UPDATE`/`DELETE` solto no handler da rota, do webhook, do worker ou da server action. |

**"Escreve direto?"**

`Sim` quando o comando SQL sai do próprio ponto de entrada (rota, webhook,
worker, server action) sem nenhum módulo de domínio entre ele e a tabela.
`Não (via <módulo>)` quando o ponto de entrada delega a escrita para um módulo.

### 1.4 Volume em banco das entidades documentadas

Query executada:

```
psql -U callface -d callface_crm -t -A -F'|' -c "SELECT 'leads',count(*) FROM leads UNION ALL SELECT 'empresas',count(*) FROM empresas UNION ALL ... ;"
```

| Tabela | Linhas |
|---|---|
| leads | 3989 |
| empresas | 2199 |
| pessoas | 0 |
| contatos | 1663 |
| negocios | 1562 |
| oportunidades | 0 |
| tarefas | 462 |
| atividades | 13044 |
| contratos | 742 |
| clientes | 275 |
| fulfillments | 25 |
| communications | 0 |
| billing_identities | 224 |
| billing_customer_aliases | 2 |
| vendas_eventos | 0 |

Os mesmos números constam em `_raw/tabelas-contagem-exata.txt`.

---

## 2. LEADS

102 escritores em runtime. 19 dentro de `src/lib/vendas`.

### 2.1 API (rota Hono)

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| api-server/routes/apollo.ts:176 | `POST /import` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/apollo.ts:366 | `POST /webhook` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/cadencia.ts:254 | `POST /cadencia/:leadId/enviar` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/cadencia.ts:305 | `POST /cadencia/:leadId/enviar` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/cadencia.ts:369 | `POST /cadencia/:leadId/ligacao` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos-crm2.ts:276 | `PUT /contatos-crm2/pessoas/:id/responsavel` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos-unified.ts:154 | `POST /contatos-unified` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/contatos-unified.ts:205 | `PATCH /contatos-unified/:id` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos-unified.ts:222 | `DELETE /contatos-unified/:id` | DELETE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos-unified.ts:247 | `POST /contatos-unified/:id/converter` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos.ts:69 | `POST /contatos/:id/atribuir` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos.ts:149 | `POST /contatos/:id/converter` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos.ts:221 | `POST /contatos/:id/criar-lead` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/contratos.ts:331 | `PATCH /contratos/:id` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contratos.ts:340 | `PATCH /contratos/:id` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contratos.ts:391 | `POST /contratos/:id/finalizar` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/email.ts:330 | `POST /email/send` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/email.ts:680 | `POST /email/mark-all-read` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/email.ts:1190 | `PATCH /email/:id` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/email.ts:1194 | `PATCH /email/:id` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:527 | `POST /leads` (declarada em `leads.ts:457`, com CORS aberto) | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1114 | `PATCH /leads/:id` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1192 | `POST /leads/:id` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1302 | `DELETE /leads/:id` | DELETE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1362 | `POST /leads/:id/enrich` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1401 | `POST /leads/:id/enrich` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1489 | `POST /leads/:id/enrich` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1571 | `POST /leads/:id/iniciar-whatsapp` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1789 | `POST /leads/:id/vincular-empresa` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1858 | `POST /leads/:id/vincular-negocio` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1899 | `POST /leads/:id/converter-oportunidade` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/negocios.ts:431 | `POST /negocios` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/negocios.ts:720 | `PATCH /negocios/:id` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/notas.ts:84 | `POST /notas` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/nps.ts:90 | `POST /:token` (resposta pública de NPS) | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/prospeccao.ts:376 | `POST /prospeccao/import` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/whatsapp.ts:333 | `POST /whatsapp/send` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/whatsapp.ts:937 | `GET /whatsapp/messages/:leadId` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/whatsapp.ts:1120 | `POST /whatsapp/mark-all-read` | UPDATE | Não | Sim | API (rota Hono) |

Observação factual: `api-server/routes/whatsapp.ts:937` é uma escrita dentro de
um handler `GET` (zera contador de não lidas).

### 2.2 UI (server action)

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| app/(crm2)/pre-vendas/actions.ts:183 | `acaoAssociarEmpresa` | UPDATE (SQL cru) | Não | Sim | UI (server action) |

A mesma tela também chega em `leads` pelas funções de `lib/vendas/pre-vendas.ts`
(seção 2.5). A linha 183 é a única escrita da própria action.

### 2.3 Webhook

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| app/api/webhooks/meta-lead-ids/route.ts:107 | `POST` | UPDATE | Não | Sim | webhook |
| app/api/webhooks/rd-lead/route.ts:218 | `POST` | UPDATE | Não | Sim | webhook |
| app/api/webhooks/rd-lead/route.ts:266 | `POST` | INSERT | Não | Sim | webhook |
| app/api/webhooks/site-lead/route.ts:167 | `POST` | UPDATE | Não | Sim | webhook |
| app/api/webhooks/stripe/route.ts:90 | `handlePaymentConfirmed` | UPDATE | Não | Sim | webhook |
| app/api/webhooks/stripe/route.ts:261 | `gravarDadosFiscaisNoCRM` | UPDATE | Não | Sim | webhook |

`app/api/webhooks/site-lead/route.ts:6` importa `criarLead` de
`@/lib/vendas/pre-vendas` e `app/api/webhooks/rd-lead/route.ts:11` importa
`garantirAtividadePrimeiroContato`/`resolverResponsavelInbound` do mesmo módulo.
Ou seja: os dois webhooks usam `lib/vendas` para parte do fluxo e escrevem
direto na tabela para outra parte.

### 2.4 Módulos de domínio em `src/lib` (fora de `lib/vendas`)

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| lib/ai-platform/tools/registry.ts:144 | ferramenta `lead.update_status` (`registry.ts:139`) | UPDATE | Parcial (domínio + outbox) | Não (via registry) | worker / API (runtime do agente IA) |
| lib/ai-platform/tools/registry.ts:157 | ferramenta `lead.qualify` (`registry.ts:149`) | UPDATE | Parcial (domínio + outbox) | Não (via registry) | worker / API (runtime do agente IA) |
| lib/cadencia/cadence-engine.ts:364 | `mutateTag` | UPDATE | Parcial (domínio + outbox) | Não (via cadence-engine) | worker, API (rota Hono) |
| lib/cadencia/cadence-engine.ts:375 | `mutateTag` | UPDATE | Parcial (domínio + outbox) | Não (via cadence-engine) | worker, API (rota Hono) |
| lib/crm/automacao-engine.ts:87 | `executarAcao` | UPDATE | Parcial (domínio, sem evento) | Não (via automacao-engine) | API (rota Hono), webhook, worker |
| lib/crm/automacao-engine.ts:96 | `executarAcao` | UPDATE | Parcial (domínio, sem evento) | Não (via automacao-engine) | API (rota Hono), webhook, worker |
| lib/crm/checkout.ts:141 | `criarCheckoutParaGrupo` | UPDATE | Parcial (domínio + outbox) | Não (via checkout) | API (rota Hono), webhook |
| lib/crm/converter-oportunidade.ts:122 | `converterLeadEmOportunidade` | UPDATE | Parcial (domínio, sem evento) | Não (via converter-oportunidade) | API (rota Hono), worker |
| lib/crm/converter-oportunidade.ts:228 | `converterLeadEmOportunidade` | UPDATE | Parcial (domínio, sem evento) | Não (via converter-oportunidade) | API (rota Hono), worker |
| lib/crm/delete-negocio.ts:60 | `limparVinculosNegocio` | UPDATE | Parcial (domínio, sem evento) | Não (via delete-negocio) | API (rota Hono) |
| lib/crm/lead-scoring.ts:123 | `calculateLeadScore` | UPDATE | Parcial (domínio, sem evento) | Não (via lead-scoring) | worker |
| lib/crm/sdr-escalation.ts:56 | `runSdrFollowupEscalation` | UPDATE | Parcial (domínio, sem evento) | Não (via sdr-escalation) | worker, API (rota Hono) |
| lib/crm/won-evidence.ts:348 | `aplicarEfeitosPosGanho` | UPDATE | Parcial (domínio + outbox) | Não (via won-evidence) | API (rota Hono), webhook, UI |
| lib/integrations/callface.ts:438 | `processCallfaceCallEvent` | UPDATE | Parcial (domínio, sem evento) | Não (via callface) | worker, API (rota Hono) |
| lib/integrations/rd-criativo.ts:108 | `enriquecerCriativosRd` | UPDATE | Parcial (domínio, sem evento) | Não (via rd-criativo) | worker |
| lib/integrations/stripe-sync.ts:254 | `syncStripe` | UPDATE | Parcial (domínio, sem evento) | Não (via stripe-sync) | worker, webhook, API (rota Hono) |

### 2.5 `src/lib/vendas` (SQL cru, com evento)

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| lib/vendas/pre-vendas.ts:173 | `criarLead` | INSERT | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action), webhook |
| lib/vendas/pre-vendas.ts:303 | `atribuirResponsavel` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pre-vendas.ts:341 | `registrarPrimeiroContato` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pre-vendas.ts:351 | `registrarPrimeiroContato` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pre-vendas.ts:404 | `moverEtapa` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pre-vendas.ts:447 | `salvarQualificacao` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pre-vendas.ts:478 | `qualificar` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pre-vendas.ts:527 | `nutrir` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pre-vendas.ts:588 | `desqualificar` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pre-vendas.ts:631 | `voltarParaQualificado` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pipeline.ts:235 | `criarOportunidade` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pipeline.ts:254 | `criarOportunidade` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pipeline.ts:308 | `criarOportunidadeDoLead` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pipeline.ts:722 | `reagendarAposNoShow` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/prospeccao.ts:91 | `adicionarProspect` | INSERT | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/prospeccao.ts:185 | `mudarEstado` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/prospeccao.ts:301 | `preQualificar` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/prospeccao.ts:392 | `descartar` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/prospeccao.ts:429 | `atribuirProspect` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |

### 2.6 Worker

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| worker/index.ts:410 | `crossSaveInterSession` | UPDATE | Não | Sim | worker |
| worker/index.ts:534 | `handlePhoneOutgoing` | UPDATE | Não | Sim | worker |
| worker/index.ts:1195 | `handleAiSdrResponse` | UPDATE (`leadsT`) | Não | Sim | worker |
| worker/index.ts:1255 | `handleAiSdrResponse` | UPDATE (`leadsT`) | Não | Sim | worker |
| worker/index.ts:1269 | `handleAiSdrResponse` | UPDATE (SQL cru, `jsonb_set` em `campos_custom`) | Não | Sim | worker |
| worker/index.ts:1342 | `handleAiSdrResponse` | UPDATE (`leadsT`) | Não | Sim | worker |
| worker/index.ts:1407 | `handleAiSdrResponse` | UPDATE (`leadsT`) | Não | Sim | worker |
| worker/index.ts:1496 | `handleAiSdrResponse` | UPDATE (`leadsT`) | Não | Sim | worker |
| worker/index.ts:1640 | `runAiSdrFirstContactSweep` | UPDATE (`leadsT`) | Não | Sim | worker |
| worker/index.ts:1781 | `runAiSdrRetrySweep` | UPDATE (`leadsT`) | Não | Sim | worker |
| worker/index.ts:1807 | `runAiSdrRetrySweep` | UPDATE (`leadsT`) | Não | Sim | worker |
| worker/index.ts:1824 | `runAiSdrRetrySweep` | UPDATE (`leadsT`) | Não | Sim | worker |
| worker/index.ts:1903 | `runAiSdrRetrySweep` | UPDATE (`leadsT`) | Não | Sim | worker |
| worker/index.ts:2383 | `whatsappIncomingWorker` (`index.ts:1997`), handler de mensagem recebida | UPDATE | Não | Sim | worker |
| worker/index.ts:2587 | `whatsappOutgoingWorker` (`index.ts:2451`) | UPDATE | Não | Sim | worker |
| worker/index.ts:2980 | `slaWorker` (`index.ts:2649`), job `alerta-renovacao` (`index.ts:2954`) | UPDATE | Não | Sim | worker |
| worker/index.ts:3468 | `processAndStoreEmails` (`index.ts:3315`) | UPDATE (`leadsT`) | Não | Sim | worker |
| worker/index.ts:3674 | `enrichmentWorker` (`index.ts:3629`) | UPDATE | Não | Sim | worker |
| worker/index.ts:3704 | `enrichmentWorker` | UPDATE | Não | Sim | worker |
| worker/index.ts:4058 | `siteLeadQualifyWorker` (`index.ts:3866`) | UPDATE (`leadsT`) | Não | Sim | worker |
| worker/index.ts:4071 | `siteLeadQualifyWorker` | UPDATE (`leadsT`) | Não | Sim | worker |

---

## 3. EMPRESAS

22 escritores em runtime. 3 dentro de `src/lib/vendas`.

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| api-server/routes/apollo.ts:135 | `POST /import` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/clientes-crm2.ts:562 | `PATCH /clientes-crm2/:empresaId/tags` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/empresas.ts:105 | `POST /empresas` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/empresas.ts:181 | `POST /empresas/enrich-batch` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/empresas.ts:197 | `POST /empresas/enrich-batch` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/empresas.ts:345 | `PATCH /empresas/:id` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/empresas.ts:384 | `DELETE /empresas/:id` | DELETE | Não | Sim | API (rota Hono) |
| api-server/routes/empresas.ts:419 | `POST /empresas/:id/enrich` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/empresas.ts:462 | `POST /empresas/:id/enrich` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/empresas.ts:483 | `POST /empresas/:id/enrich` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/empresas.ts:532 | `applyOrgUpdate` (helper local, `empresas.ts:496`) | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1460 | `POST /leads/:id/enrich` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1775 | `POST /leads/:id/vincular-empresa` | INSERT | Não | Sim | API (rota Hono) |
| app/api/webhooks/stripe/route.ts:283 | `gravarDadosFiscaisNoCRM` | UPDATE | Não | Sim | webhook |
| lib/crm/automacao-engine.ts:114 | `executarAcao` | UPDATE | Parcial (domínio, sem evento) | Não (via automacao-engine) | API (rota Hono), webhook, worker |
| lib/crm/checkout.ts:140 | `criarCheckoutParaGrupo` | UPDATE | Parcial (domínio + outbox) | Não (via checkout) | API (rota Hono), webhook |
| lib/crm/resolver-empresa.ts:59 | `resolverEmpresaId` | INSERT | Parcial (domínio, sem evento) | Não (via resolver-empresa) | API (rota Hono), webhook |
| lib/vendas/identidade.ts:164 | `resolverEmpresa` | INSERT | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/identidade.ts:187 | `completarEmpresa` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/propostas.ts:139 | `salvarDadosJuridicos` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| worker/index.ts:3719 | `enrichmentWorker` (`index.ts:3629`) | UPDATE | Não | Sim | worker |
| worker/index.ts:3756 | `enrichmentWorker` | UPDATE | Não | Sim | worker |

Há dois caminhos independentes de criação de empresa a partir de um lead:
`lib/crm/resolver-empresa.ts:59` (`resolverEmpresaId`, sem evento) e
`lib/vendas/identidade.ts:164` (`resolverEmpresa`, com evento `CompanyCreated`
em `identidade.ts:174`), além do `INSERT` direto da rota em
`api-server/routes/leads.ts:1775`.

---

## 4. PESSOAS

5 escritores em runtime. 3 dentro de `src/lib/vendas`. Tabela com 0 linhas em
produção.

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| lib/crm/sync-domain-model.ts:84 | `syncPessoaFromLead` | UPDATE | Parcial (domínio, sem evento) | Não (via sync-domain-model) | API (rota Hono), webhook |
| lib/crm/sync-domain-model.ts:111 | `syncPessoaFromLead` | INSERT | Parcial (domínio, sem evento) | Não (via sync-domain-model) | API (rota Hono), webhook |
| lib/vendas/identidade.ts:267 | `resolverPessoa` | INSERT | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/identidade.ts:293 | `completarPessoa` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/identidade.ts:348 | `vincularPessoaEmpresa` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |

`pessoas` tem 5 escritores em código e 0 linhas no banco. `syncPessoaFromLead`
é importado por `api-server/routes/apollo.ts`, `contatos-unified.ts`,
`contatos.ts`, `leads.ts`, `negocios.ts`, `propostas.ts`,
`app/api/webhooks/rd-lead/route.ts` e `app/api/webhooks/site-lead/route.ts`.
Por que nenhuma dessas chamadas produziu linha nesta carga: **NÃO CONFIRMADO**.

---

## 5. CONTATOS

34 escritores em runtime. Nenhum dentro de `src/lib/vendas`.

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| api-server/routes/ai-platform.ts:220 | `POST /automacoes/ai/proposals/fields/:id/decision` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/atendimento.ts:293 | `POST /atendimento/conversas/:id/acao` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos.ts:61 | `POST /contatos/:id/atribuir` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos.ts:99 | `POST /contatos/:id/atribuir` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos.ts:235 | `POST /contatos/:id/criar-lead` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos.ts:271 | `POST /contatos/:id/desvincular` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos.ts:316 | `POST /contatos/:id/vincular-lead` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos.ts:325 | `POST /contatos/:id/vincular-lead` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos.ts:339 | `POST /contatos/:id/vincular-lead` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos.ts:367 | `propagateLeadId` (helper local, `contatos.ts:356`) | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contatos.ts:382 | `propagateLeadId` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1142 | `PATCH /leads/:id` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1299 | `DELETE /leads/:id` | DELETE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1551 | `POST /leads/:id/iniciar-whatsapp` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1570 | `POST /leads/:id/iniciar-whatsapp` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/whatsapp.ts:933 | `GET /whatsapp/messages/:leadId` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/whatsapp.ts:1131 | `POST /whatsapp/mark-all-read` | UPDATE | Não | Sim | API (rota Hono) |
| lib/ai-platform/runtime/execute-agent.ts:158 | `sendMessages` | UPDATE | Parcial (domínio, sem evento) | Não (via execute-agent) | worker / API (runtime do agente IA) |
| lib/cadencia/cadence-engine.ts:179 | `resolverContatoCompleto` | INSERT | Parcial (domínio + outbox) | Não (via cadence-engine) | worker, API (rota Hono) |
| lib/cadencia/cadence-engine.ts:215 | `enviarWhatsappTemplate` | UPDATE | Parcial (domínio + outbox) | Não (via cadence-engine) | worker, API (rota Hono) |
| worker/index.ts:179 | `findOrCreateContato` | UPDATE | Não | Sim | worker |
| worker/index.ts:263 | `findOrCreateContato` | INSERT | Não | Sim | worker |
| worker/index.ts:286 | `findOrCreateContato` | UPDATE | Não | Sim | worker |
| worker/index.ts:354 | `crossSaveInterSession` | INSERT | Não | Sim | worker |
| worker/index.ts:402 | `crossSaveInterSession` | UPDATE | Não | Sim | worker |
| worker/index.ts:525 | `handlePhoneOutgoing` | UPDATE | Não | Sim | worker |
| worker/index.ts:1454 | `handleAiSdrResponse` | UPDATE (`contatosT`) | Não | Sim | worker |
| worker/index.ts:1622 | `runAiSdrFirstContactSweep` | UPDATE (`contatosT`) | Não | Sim | worker |
| worker/index.ts:1624 | `runAiSdrFirstContactSweep` | INSERT (`contatosT`) | Não | Sim | worker |
| worker/index.ts:1718 | `runAiSdrFirstContactSweep` | UPDATE (`contatosT`) | Não | Sim | worker |
| worker/index.ts:1885 | `runAiSdrRetrySweep` | UPDATE (`contatosT`) | Não | Sim | worker |
| worker/index.ts:2180 | `whatsappIncomingWorker`, job `history-sync` (`index.ts:2063`) | UPDATE (`contatosT`) | Não | Sim | worker |
| worker/index.ts:2374 | `whatsappIncomingWorker`, handler de mensagem recebida | UPDATE | Não | Sim | worker |
| worker/index.ts:2579 | `whatsappOutgoingWorker` (`index.ts:2451`) | UPDATE | Não | Sim | worker |

Existem três funções distintas que criam contato: `api-server/routes/leads.ts:1551`,
`lib/cadencia/cadence-engine.ts:179` (`resolverContatoCompleto`) e
`worker/index.ts:263` (`findOrCreateContato`), mais um quarto ponto de criação
cruzada em `worker/index.ts:354` (`crossSaveInterSession`).

---

## 6. NEGOCIOS

42 escritores em runtime. 11 dentro de `src/lib/vendas`.

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| api-server/routes/contatos.ts:156 | `POST /contatos/:id/converter` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/cs.ts:506 | `POST /cs/clientes/:empresaId/expansao` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:548 | `POST /leads` (`leads.ts:457`) | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:568 | `POST /leads` | UPDATE (SQL cru, campo `descricao`) | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:990 | `PATCH /leads/:id` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1273 | `DELETE /leads/:id` | DELETE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1839 | `POST /leads/:id/vincular-negocio` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/negocios.ts:438 | `POST /negocios` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/negocios.ts:754 | `PATCH /negocios/:id` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/negocios.ts:943 | `DELETE /negocios/:id` | DELETE | Não | Sim | API (rota Hono) |
| api-server/routes/notas.ts:88 | `POST /notas` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/notas.ts:93 | `POST /notas` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/propostas.ts:810 | `POST /propostas` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/whatsapp.ts:337 | `POST /whatsapp/send` | UPDATE | Não | Sim | API (rota Hono) |
| app/api/onboarding/[id]/route.ts:39 | `PATCH` | UPDATE | Não | Sim | API (rota Next) |
| lib/ai-platform/tools/registry.ts:167 | ferramenta `deal.advance` (`registry.ts:162`) | UPDATE | Parcial (domínio + outbox) | Não (via registry) | worker / API (runtime do agente IA) |
| lib/cadencia/cadence-engine.ts:365 | `mutateTag` | UPDATE | Parcial (domínio + outbox) | Não (via cadence-engine) | worker, API (rota Hono) |
| lib/cadencia/cadence-engine.ts:376 | `mutateTag` | UPDATE | Parcial (domínio + outbox) | Não (via cadence-engine) | worker, API (rota Hono) |
| lib/crm/automacao-engine.ts:85 | `executarAcao` | UPDATE | Parcial (domínio, sem evento) | Não (via automacao-engine) | API (rota Hono), webhook, worker |
| lib/crm/automacao-engine.ts:94 | `executarAcao` | UPDATE | Parcial (domínio, sem evento) | Não (via automacao-engine) | API (rota Hono), webhook, worker |
| lib/crm/converter-oportunidade.ts:121 | `converterLeadEmOportunidade` | UPDATE | Parcial (domínio, sem evento) | Não (via converter-oportunidade) | API (rota Hono), worker |
| lib/crm/converter-oportunidade.ts:206 | `converterLeadEmOportunidade` | INSERT | Parcial (domínio, sem evento) | Não (via converter-oportunidade) | API (rota Hono), worker |
| lib/crm/oportunidade-bundle.ts:94 | `organizarVendaMultiLinha` | UPDATE | Parcial (domínio, sem evento) | Não (via oportunidade-bundle) | API (rota Hono) |
| lib/crm/oportunidade-bundle.ts:96 | `organizarVendaMultiLinha` | INSERT | Parcial (domínio, sem evento) | Não (via oportunidade-bundle) | API (rota Hono) |
| lib/crm/sync-negocio-valores.ts:35 | `syncNegocioValoresFromPropostas` | UPDATE | Parcial (domínio, sem evento) | Não (via sync-negocio-valores) | API (rota Hono), worker |
| lib/crm/won-evidence.ts:287 | `marcarNegocioGanhoSeAindaNao` | UPDATE | Parcial (domínio + outbox) | Não (via won-evidence) | API (rota Hono), webhook, UI |
| lib/cs/checkpoint.ts:118 | `executarCheckpoint` | INSERT | Parcial (domínio, sem evento) | Não (via cs/checkpoint) | API (rota Hono) |
| lib/integrations/callface.ts:441 | `processCallfaceCallEvent` | UPDATE | Parcial (domínio, sem evento) | Não (via callface) | worker, API (rota Hono) |
| lib/vendas/pipeline.ts:152 | `criarOportunidade` | INSERT | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pipeline.ts:379 | `aplicarEtapa` (chamada por `moverEtapa`, `pipeline.ts:334`) | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pipeline.ts:410 | `definirProximaAcao` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pipeline.ts:433 | `marcarEstagnacao` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pipeline.ts:475 | `alterarFamilia` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pipeline.ts:513 | `perder` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pipeline.ts:585 | `tentarGanhar` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pipeline.ts:664 | `registrarNoShow` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pipeline.ts:716 | `reagendarAposNoShow` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pipeline.ts:743 | `iniciarTrial` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| lib/vendas/pipeline.ts:758 | `encerrarTrial` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| worker/index.ts:1324 | `handleAiSdrResponse` | UPDATE (`negociosT`) | Não | Sim | worker |
| worker/index.ts:4045 | `siteLeadQualifyWorker` (`index.ts:3866`) | UPDATE | Não | Sim | worker |
| worker/index.ts:4064 | `siteLeadQualifyWorker` | UPDATE | Não | Sim | worker |

Cinco funções distintas fazem `INSERT` em `negocios` fora de `lib/vendas`:
`api-server/routes/contatos.ts:156`, `api-server/routes/cs.ts:506`,
`api-server/routes/leads.ts:548`, `api-server/routes/negocios.ts:438`,
`api-server/routes/propostas.ts:810`, mais
`lib/crm/converter-oportunidade.ts:206`, `lib/crm/oportunidade-bundle.ts:96` e
`lib/cs/checkpoint.ts:118`.

---

## 7. OPORTUNIDADES

5 escritores em runtime. 1 dentro de `src/lib/vendas`. Tabela com 0 linhas em
produção.

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| lib/cadencia/cadence-engine.ts:366 | `mutateTag` | UPDATE | Parcial (domínio + outbox) | Não (via cadence-engine) | worker, API (rota Hono) |
| lib/cadencia/cadence-engine.ts:377 | `mutateTag` | UPDATE | Parcial (domínio + outbox) | Não (via cadence-engine) | worker, API (rota Hono) |
| lib/crm/sync-domain-model.ts:230 | `syncOportunidadeFromNegocio` | UPDATE | Parcial (domínio, sem evento) | Não (via sync-domain-model) | API (rota Hono), webhook |
| lib/crm/sync-domain-model.ts:232 | `syncOportunidadeFromNegocio` | INSERT | Parcial (domínio, sem evento) | Não (via sync-domain-model) | API (rota Hono), webhook |
| lib/vendas/pipeline.ts:782 | `espelharNoDominioV2` (`pipeline.ts:776`) | UPDATE (SQL cru, `UPDATE ... FROM negocios`) | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |

`espelharNoDominioV2` chama `syncOportunidadeFromNegocio` antes de aplicar o
próprio `UPDATE`, dentro de `try/catch` com log e sem propagar erro
(`pipeline.ts:783-796`). `oportunidades` só recebe escrita como espelho de
`negocios`: não há nenhum `INSERT` de origem própria.

Tabela relacionada `oportunidade_itens` (0 linhas): 9 escritores em runtime, todos
em `src/lib/crm`, nenhum em `lib/vendas`:
`lib/crm/composicao-comercial.ts:93, 102, 149, 151, 208, 237`,
`lib/crm/grupo-comercial.ts:122`, `lib/crm/politica-familia.ts:281`,
`lib/crm/servico-canonico.ts:84`.

Tabela relacionada `oportunidade_bundle` (0 linhas): 2 escritores,
`lib/crm/oportunidade-bundle.ts:78` (INSERT) e `lib/vendas/pipeline.ts:123`
(INSERT, SQL cru dentro de `criarOportunidade`).

---

## 8. TAREFAS

26 escritores em runtime. 3 dentro de `src/lib/vendas`. Existe ainda um
escritor no próprio banco: o trigger `trg_tarefas_sincronizar_status`
(seção 8.1).

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| api-server/routes/cs.ts:401 | `POST /cs/riscos/:id/resolver` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/cs.ts:692 | `POST /cs/tarefas/:id/concluir` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/cs.ts:724 | `POST /cs/tarefas/:id/reagendar` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1289 | `DELETE /leads/:id` | DELETE | Não | Sim | API (rota Hono) |
| api-server/routes/tarefas.ts:267 | `POST /tarefas` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/tarefas.ts:367 | `PATCH /tarefas/:id` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/tarefas.ts:399 | `DELETE /tarefas/:id` | DELETE | Não | Sim | API (rota Hono) |
| app/(onface-preview)/onface-preview/atividades/actions.ts:64 | `acaoCriarAtividade` | INSERT (SQL cru, `origem = 'MANUAL'`) | Não | Sim | UI (server action) |
| app/(onface-preview)/onface-preview/atividades/actions.ts:105 | `acaoMudarStatus` | UPDATE (SQL cru) | Não | Sim | UI (server action) |
| app/(onface-preview)/onface-preview/atividades/actions.ts:123 | `acaoAlternarConclusao` | UPDATE (SQL cru) | Não | Sim | UI (server action) |
| lib/ai-platform/tools/registry.ts:134 | ferramenta `task.create` (`registry.ts:128`) | INSERT | Parcial (domínio + outbox) | Não (via registry) | worker / API (runtime do agente IA) |
| lib/cadencia/cadence-engine.ts:336 | adapter `crm_create_task` (`cadence-engine.ts:330`) | INSERT | Parcial (domínio + outbox) | Não (via cadence-engine) | worker, API (rota Hono) |
| lib/crm/automacao-engine.ts:61 | `executarAcao` | INSERT | Parcial (domínio, sem evento) | Não (via automacao-engine) | API (rota Hono), webhook, worker |
| lib/crm/delete-negocio.ts:68 | `limparVinculosNegocio` | DELETE | Parcial (domínio, sem evento) | Não (via delete-negocio) | API (rota Hono) |
| lib/crm/fulfillment.ts:241 | `criarFulfillmentsParaServicos` | INSERT | Parcial (domínio, sem evento) | Não (via fulfillment) | API (rota Hono) |
| lib/crm/pos-venda.ts:411 | `criarPosVendaDoNegocio` | INSERT | Parcial (domínio, sem evento) | Não (via pos-venda) | API (rota Hono) |
| lib/cs/checkpoint.ts:78 | `executarCheckpoint` | UPDATE | Parcial (domínio, sem evento) | Não (via cs/checkpoint) | API (rota Hono) |
| lib/cs/tarefas.ts:70 | `criarTarefaCs` | INSERT | Parcial (domínio, sem evento) | Não (via cs/tarefas) | API (rota Hono) |
| lib/integrations/callface.ts:493 | `processCallfaceCallEvent` | INSERT | Parcial (domínio, sem evento) | Não (via callface) | worker, API (rota Hono) |
| lib/vendas/pre-vendas.ts:109 | `garantirAtividadePrimeiroContato` | INSERT | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action), webhook |
| lib/vendas/pre-vendas.ts:133 | `concluirAtividadePrimeiroContato` | UPDATE | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action), API (rota Hono) |
| lib/vendas/pre-vendas.ts:543 | `nutrir` | INSERT | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action) |
| worker/index.ts:1306 | `handleAiSdrResponse` | INSERT (`tarefasT`) | Não | Sim | worker |
| worker/index.ts:2925 | `slaWorker`, job `follow-up-proposta` (`index.ts:2881`) | INSERT | Não | Sim | worker |
| worker/index.ts:2971 | `slaWorker`, job `alerta-renovacao` (`index.ts:2954`) | INSERT | Não | Sim | worker |
| worker/index.ts:3084 | `slaWorker`, job `reativar-lead-perdido` (`index.ts:3058`) | INSERT | Não | Sim | worker |

`concluirAtividadePrimeiroContato` é chamada também pela API Hono
(`api-server/routes/leads.ts:73` importa de `@/lib/vendas/pre-vendas`).

### 8.1 Escritor dentro do banco

`_raw/triggers.txt` lista, para `tarefas`, o trigger
`trg_tarefas_sincronizar_status` em `BEFORE INSERT` e `BEFORE UPDATE`. A função
foi lida com:

```
psql -U callface -d callface_crm -t -A -c "SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='tarefas_sincronizar_status' AND n.nspname='public';"
```

Ela reescreve `NEW.status`, `NEW.concluida` e `NEW.concluida_em` antes da
gravação, em ambos os sentidos: quem muda `status` tem `concluida` ajustado, e
quem muda só `concluida` tem `status` ajustado. Isto é, qualquer um dos 26
escritores acima pode gravar um valor e ver outro persistido. O comentário em
`app/(onface-preview)/onface-preview/atividades/actions.ts:93-95` documenta essa
dependência.

`tarefas` é a única das entidades deste documento com trigger. Os outros dois
triggers do banco estão em `service_ledger_entries`.

---

## 9. ATIVIDADES

41 escritores em runtime. 1 dentro de `src/lib/vendas`.

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| api-server/routes/apollo.ts:211 | `POST /import` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/cadencia.ts:294 | `POST /cadencia/:leadId/enviar` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/cadencia.ts:359 | `POST /cadencia/:leadId/ligacao` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/contatos-unified.ts:257 | `POST /contatos-unified/:id/converter` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/fulfillments.ts:748 | `PATCH /fulfillments/:id/concluir` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:606 | `POST /leads` (`leads.ts:457`) | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1024 | `PATCH /leads/:id` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1056 | `PATCH /leads/:id` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1200 | `POST /leads/:id` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1267 | `DELETE /leads/:id` | DELETE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1286 | `DELETE /leads/:id` | DELETE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1673 | `POST /leads/:id/labels` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1717 | `DELETE /leads/:id/labels` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:2008 | `POST /leads/:id/enviar-discagem` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/negocios.ts:908 | `POST /negocios/:id/cobranca-avulsa` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/propostas.ts:1192 | `POST /propostas/:id/gerar-parcelamento` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/propostas.ts:1238 | `POST /propostas/:id/recusar` | INSERT | Não | Sim | API (rota Hono) |
| app/api/onboarding/[id]/route.ts:44 | `PATCH` | INSERT | Não | Sim | API (rota Next) |
| lib/ai-platform/tools/registry.ts:198 | ferramenta `activity.note` (`registry.ts:193`) | INSERT | Parcial (domínio + outbox) | Não (via registry) | worker / API (runtime do agente IA) |
| lib/cadencia/cadence-engine.ts:387 | `mutateTag` | INSERT | Parcial (domínio + outbox) | Não (via cadence-engine) | worker, API (rota Hono) |
| lib/cadencia/cadence-engine.ts:472 | `iniciarCadencia` | INSERT | Parcial (domínio + outbox) | Não (via cadence-engine) | worker, API (rota Hono) |
| lib/crm/contrato-email-final.ts:88 | `enviarEmailFinalContrato` | INSERT | Parcial (domínio, sem evento) | Não (via contrato-email-final) | API (rota Hono), webhook |
| lib/crm/converter-oportunidade.ts:268 | `converterLeadEmOportunidade` | INSERT | Parcial (domínio, sem evento) | Não (via converter-oportunidade) | API (rota Hono), worker |
| lib/crm/converter-oportunidade.ts:281 | `converterLeadEmOportunidade` | INSERT | Parcial (domínio, sem evento) | Não (via converter-oportunidade) | API (rota Hono), worker |
| lib/crm/delete-negocio.ts:67 | `limparVinculosNegocio` | DELETE | Parcial (domínio, sem evento) | Não (via delete-negocio) | API (rota Hono) |
| lib/crm/enviar-proposta.ts:161 | `enviarPropostaComCheckout` | INSERT | Parcial (domínio + outbox) | Não (via enviar-proposta) | API (rota Hono) |
| lib/crm/notificar.ts:123 | `notificarFormularioImplantacaoRecebido` | INSERT | Parcial (domínio, sem evento) | Não (via notificar) | API (rota Hono), webhook |
| lib/crm/notificar.ts:199 | `notificarFulfillmentOnboardingCriado` | INSERT | Parcial (domínio, sem evento) | Não (via notificar) | API (rota Hono), webhook |
| lib/crm/pos-assinatura.ts:139 | `processarContratoAssinado` | INSERT | Parcial (domínio + outbox) | Não (via pos-assinatura) | webhook, API (rota Hono) |
| lib/crm/proposta-aceite.ts:204 | `processarAceiteDaProposta` | INSERT | Parcial (domínio + outbox) | Não (via proposta-aceite) | API (rota Hono), UI (server action) |
| lib/crm/proposta-publica.ts:77 | `recusarPropostaPublica` | INSERT | Parcial (domínio + outbox) | Não (via proposta-publica) | API (rota Hono) |
| lib/crm/proposta-publica.ts:119 | `solicitarAjustePropostaPublica` | INSERT | Parcial (domínio + outbox) | Não (via proposta-publica) | API (rota Hono) |
| lib/crm/sdr-escalation.ts:73 | `runSdrFollowupEscalation` | INSERT | Parcial (domínio, sem evento) | Não (via sdr-escalation) | worker, API (rota Hono) |
| lib/crm/won-evidence.ts:338 | `aplicarEfeitosPosGanho` | INSERT | Parcial (domínio + outbox) | Não (via won-evidence) | API (rota Hono), webhook, UI |
| lib/cs/tarefas.ts:122 | `registrarInteracao` | INSERT | Parcial (domínio, sem evento) | Não (via cs/tarefas) | API (rota Hono) |
| lib/integrations/callface.ts:418 | `processCallfaceCallEvent` | INSERT | Parcial (domínio, sem evento) | Não (via callface) | worker, API (rota Hono) |
| lib/vendas/eventos.ts:108 | `registrarEvento` | INSERT (SQL cru) | Sim (lib/vendas) | Não (via lib/vendas) | UI (server action), webhook |
| worker/index.ts:1655 | `runAiSdrFirstContactSweep` | INSERT | Não | Sim | worker |
| worker/index.ts:1979 | `runAiSdrMeetingConfirmationSweep` (`index.ts:1925`) | INSERT (`ativT`) | Não | Sim | worker |
| worker/index.ts:2049 | `whatsappIncomingWorker`, job `call-event` (`index.ts:2011`) | INSERT (`ativT`) | Não | Sim | worker |
| worker/index.ts:2404 | `whatsappIncomingWorker`, handler de mensagem recebida | INSERT | Não | Sim | worker |

`atividades` é a tabela com maior dispersão de escritores em relação ao volume
de código de domínio: 41 escritores, 1 deles em `lib/vendas`. O único caminho
que grava `atividades` junto com um evento é
`lib/vendas/eventos.ts:108`, dentro de `registrarEvento`, e só quando o chamador
preencheu o campo `timeline` (`eventos.ts:106`).

---

## 10. CONTRATOS

28 escritores em runtime. Nenhum dentro de `src/lib/vendas`.

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| api-server/routes/contratos.ts:111 | `POST /contratos` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/contratos.ts:312 | `PATCH /contratos/:id` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/contratos.ts:373 | `POST /contratos/:id/finalizar` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:967 | `PATCH /leads/:id` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1265 | `DELETE /leads/:id` | DELETE | Não | Sim | API (rota Hono) |
| api-server/routes/leads.ts:1290 | `DELETE /leads/:id` | DELETE | Não | Sim | API (rota Hono) |
| api-server/routes/negocios.ts:670 | `PATCH /negocios/:id` | INSERT | Não | Sim | API (rota Hono) |
| app/api/webhooks/documenso/route.ts:87 | `POST` | UPDATE | Não | Sim | webhook |
| app/api/webhooks/documenso/route.ts:93 | `POST` | UPDATE | Não | Sim | webhook |
| app/api/webhooks/documenso/route.ts:98 | `POST` | UPDATE | Não | Sim | webhook |
| app/api/webhooks/documenso/route.ts:131 | `POST` | UPDATE | Não | Sim | webhook |
| app/api/webhooks/documenso/route.ts:135 | `POST` | UPDATE | Não | Sim | webhook |
| lib/crm/contrato-duplicidade.ts:244 | `marcarContratoComoRenovado` | UPDATE | Parcial (domínio, sem evento) | Não (via contrato-duplicidade) | sem chamador (ver nota) |
| lib/crm/contrato-email-final.ts:78 | `enviarEmailFinalContrato` | UPDATE | Parcial (domínio, sem evento) | Não (via contrato-email-final) | API (rota Hono), webhook |
| lib/crm/contrato-template.ts:195 | `gerarContratoDeTemplate` | INSERT | Parcial (domínio, sem evento) | Não (via contrato-template) | API (rota Hono) |
| lib/crm/contrato-template.ts:249 | `enviarContratoParaAssinatura` | UPDATE | Parcial (domínio, sem evento) | Não (via contrato-template) | API (rota Hono) |
| lib/crm/delete-negocio.ts:70 | `limparVinculosNegocio` | DELETE | Parcial (domínio, sem evento) | Não (via delete-negocio) | API (rota Hono) |
| lib/crm/signature/documenso-provider.ts:110 | `DocumensoSignatureProvider.enviarParaAssinatura` | UPDATE | Parcial (domínio, sem evento) | Não (via provider) | API (rota Hono), webhook |
| lib/crm/signature/documenso-provider.ts:122 | `DocumensoSignatureProvider.registrarAbertura` | UPDATE | Parcial (domínio, sem evento) | Não (via provider) | API (rota Hono), webhook |
| lib/crm/signature/simple-provider.ts:23 | `SimpleElectronicSignatureProvider.enviarParaAssinatura` | UPDATE | Parcial (domínio, sem evento) | Não (via provider) | API (rota Hono) |
| lib/crm/signature/simple-provider.ts:31 | `SimpleElectronicSignatureProvider.registrarAbertura` | UPDATE | Parcial (domínio, sem evento) | Não (via provider) | API (rota Hono) |
| lib/crm/signature/simple-provider.ts:45 | `SimpleElectronicSignatureProvider.confirmarAssinatura` | UPDATE | Parcial (domínio, sem evento) | Não (via provider) | API (rota Hono) |
| lib/cs/cancelamento.ts:165 | `atualizarCancelamento` | UPDATE | Parcial (domínio, sem evento) | Não (via cs/cancelamento) | API (rota Hono) |
| lib/cs/renovacao.ts:158 | `decidirRenovacao` | UPDATE | Parcial (domínio, sem evento) | Não (via cs/renovacao) | API (rota Hono) |
| lib/integrations/stripe-sync.ts:409 | `syncStripe` | UPDATE | Parcial (domínio, sem evento) | Não (via stripe-sync) | worker, webhook, API (rota Hono) |
| lib/integrations/stripe-sync.ts:420 | `syncStripe` | UPDATE | Parcial (domínio, sem evento) | Não (via stripe-sync) | worker, webhook, API (rota Hono) |
| lib/integrations/stripe-sync.ts:445 | `syncStripe` | UPDATE | Parcial (domínio, sem evento) | Não (via stripe-sync) | worker, webhook, API (rota Hono) |
| lib/integrations/stripe-sync.ts:454 | `syncStripe` | INSERT | Parcial (domínio, sem evento) | Não (via stripe-sync) | worker, webhook, API (rota Hono) |

Notas factuais:

- `marcarContratoComoRenovado` (`lib/crm/contrato-duplicidade.ts:240`) não tem
  nenhum chamador no repositório. `grep -rn 'marcarContratoComoRenovado' .`
  retorna apenas a própria declaração.
- Quatro funções diferentes criam contrato: `api-server/routes/contratos.ts:111`,
  `api-server/routes/leads.ts:967`, `api-server/routes/negocios.ts:670`,
  `lib/crm/contrato-template.ts:195` e `lib/integrations/stripe-sync.ts:454`.
- `contrato_itens` (487 linhas em produção) **não tem nenhum escritor** em
  `app/src`. `grep -rn 'insert(contratoItens\|update(contratoItens\|delete(contratoItens' .`
  não retorna nada, e `INSERT INTO contrato_itens` também não. As únicas
  ocorrências da tabela em código são leituras
  (`api-server/routes/clientes-crm2.ts:1323-1325`) e `DELETE` em scripts de
  limpeza (`scripts/_limpeza-aceite.ts:91`, `scripts/aceite-vendas.ts:658`).
  De onde vieram as 487 linhas: **NÃO CONFIRMADO**.
- `contrato_templates` (3 linhas) tem 3 escritores, todos em
  `api-server/routes/contrato-templates.ts:34` (INSERT), `:51` (UPDATE) e
  `:62` (UPDATE, soft delete).

---

## 11. CLIENTES

9 escritores em runtime. Nenhum dentro de `src/lib/vendas`.

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| api-server/routes/clientes-crm2.ts:524 | `PATCH /clientes-crm2/:empresaId` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/clientes-crm2.ts:526 | `PATCH /clientes-crm2/:empresaId` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/cs.ts:102 | `POST /cs/carteira/atribuir` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/cs.ts:759 | `PATCH /cs/clientes/:empresaId/conta` | UPDATE | Não | Sim | API (rota Hono) |
| lib/cadencia/cadence-engine.ts:378 | `mutateTag` | UPDATE | Parcial (domínio + outbox) | Não (via cadence-engine) | worker, API (rota Hono) |
| lib/crm/sync-domain-model.ts:164 | `syncPessoaFromLead` | INSERT | Parcial (domínio, sem evento) | Não (via sync-domain-model) | API (rota Hono), webhook |
| lib/crm/won-evidence.ts:382 | `aplicarEfeitosPosGanho` | UPDATE | Parcial (domínio + outbox) | Não (via won-evidence) | API (rota Hono), webhook, UI |
| lib/cs/handoff.ts:92 | `garantirContaCsPorEmpresa` | INSERT | Parcial (domínio, sem evento) | Não (via cs/handoff) | API (rota Hono), webhook, worker (consumer de outbox) |
| lib/cs/jornada.ts:105 | `iniciarJornadaCs` | UPDATE | Parcial (domínio, sem evento) | Não (via cs/jornada) | API (rota Hono) |

Três funções distintas criam cliente: `api-server/routes/clientes-crm2.ts:526`,
`lib/crm/sync-domain-model.ts:164` e `lib/cs/handoff.ts:92`. Além delas, as
migrations `0039_cs_workspace.sql:81` e `0041_cs_universo_carteira.sql:15`
fazem `INSERT INTO clientes` e `0039_cs_workspace.sql:60` faz `DELETE FROM
clientes` (seção 15.3).

---

## 12. FULFILLMENTS

5 escritores em runtime na tabela raiz. Nenhum dentro de `src/lib/vendas`.

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| api-server/routes/fulfillments.ts:76 | `recalcularStatusMacro` (helper local, `fulfillments.ts:57`) | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/fulfillments.ts:538 | `PATCH /fulfillments/:id` | UPDATE | Não | Sim | API (rota Hono) |
| api-server/routes/fulfillments.ts:731 | `PATCH /fulfillments/:id/concluir` | UPDATE | Não | Sim | API (rota Hono) |
| lib/crm/fulfillment.ts:217 | `criarFulfillmentsParaServicos` | INSERT | Parcial (domínio, sem evento) | Não (via fulfillment) | API (rota Hono) |
| lib/crm/pos-venda.ts:366 | `criarPosVendaDoNegocio` | INSERT | Parcial (domínio, sem evento) | Não (via pos-venda) | API (rota Hono) |

### 12.1 Tabelas filhas

| Tabela | Linhas | Escritores em runtime |
|---|---|---|
| fulfillment_itens | 1659 | `api-server/routes/fulfillment-formulario-publico.ts:250` (UPDATE), `api-server/routes/fulfillments.ts:643` (UPDATE), `api-server/routes/fulfillments.ts:691` (INSERT), `lib/crm/fulfillment.ts:227` (INSERT), `lib/crm/pos-venda.ts:395` (INSERT) |
| fulfillment_formularios | 3 | `api-server/routes/fulfillment-formulario-publico.ts:48` (INSERT, em `buscarOuCriarFormulario`), `:69` (UPDATE), `:235` (UPDATE) |
| fulfillment_ramais | 6 | `api-server/routes/fulfillment-formulario-publico.ts:170` (DELETE), `:192` (INSERT), ambos em `materializarLinhasERamais` (`:159`) |
| fulfillment_linhas_portabilidade | 3 | `api-server/routes/fulfillment-formulario-publico.ts:169` (DELETE), `:173` (INSERT), ambos em `materializarLinhasERamais` |

As rotas de `fulfillment-formulario-publico.ts` são públicas por token
(`publicToken`), sem sessão.

---

## 13. BILLING_*

O banco tem cinco tabelas com prefixo `billing_`:

| Tabela | Linhas | No schema Drizzle? | Escritores em runtime | Escritores em qualquer lugar do repo |
|---|---|---|---|---|
| billing_identities | 224 | Sim (`lib/db/schema.ts:3192`) | 0 | 1 DELETE em `scripts/_limpeza-aceite.ts:120` |
| billing_customer_aliases | 2 | Sim (`lib/db/schema.ts:3216`) | 0 | 0 |
| billing_audit_runs | 0 | Não | 0 | 0 (criada em `lib/db/migrations/0055_stripe_billing_foundation.sql:70`) |
| billing_resolution_cases | 0 | Não | 0 | 0 (criada em `0055_stripe_billing_foundation.sql:82`) |
| billing_correction_ledger | 0 | Não | 0 | 0 (criada em `0055_stripe_billing_foundation.sql:104`) |

Nenhum `INSERT`, `UPDATE` ou `UPSERT` sobre qualquer tabela `billing_*` existe
no repositório. Verificação:

```
grep -rn 'billing_identities|billing_customer_aliases|billing_audit_runs|billing_correction_ledger|billing_resolution_cases|billingIdentities|billingCustomerAliases' app/src
grep -rn -i 'INSERT INTO billing' app/src/lib/db/migrations
```

O único módulo que toca `billing_identities` e `billing_customer_aliases` em
runtime é `lib/integrations/billing-identity.ts`, e ele apenas lê
(`SELECT ... FROM billing_customer_aliases INNER JOIN billing_identities`,
`billing-identity.ts:59-61` e `:136-138`).

O comentário no topo desse arquivo (`billing-identity.ts:6`) afirma que toda
mudança é escrita em `billing_correction_ledger`. Não há código no repositório
que faça essa escrita.

De onde vieram as 224 linhas de `billing_identities` e as 2 de
`billing_customer_aliases`: **NÃO CONFIRMADO**. Não há script de carga, seed ou
migration no repositório que as popule.

---

## 14. COMMUNICATIONS

4 escritores em runtime. Nenhum dentro de `src/lib/vendas`. Tabela com 0 linhas
em produção.

| Arquivo:linha | Função | Operação | Passa por service/regra? | Escreve direto? | Origem |
|---|---|---|---|---|---|
| api-server/routes/whatsapp.ts:379 | `POST /whatsapp/send` | INSERT | Não | Sim | API (rota Hono) |
| api-server/routes/whatsapp.ts:453 | `POST /whatsapp/send` | INSERT | Não | Sim | API (rota Hono) |
| lib/integrations/callface.ts:381 | `processCallfaceCallEvent` | INSERT | Parcial (domínio, sem evento) | Não (via callface) | worker, API (rota Hono) |
| worker/index.ts:2341 | `whatsappIncomingWorker`, handler de mensagem recebida | INSERT (`commsT`) | Não | Sim | worker |

Os quatro escritores gravam em modo "dual-write" best-effort: o do worker está
dentro de `try/catch` cujo `catch` só loga
(`worker/index.ts:2354-2356`, mensagem `[F2/dual-write] falha ao sincronizar
communications ... (best-effort)`), e usa
`.onConflictDoNothing({ target: [commsT.canal, commsT.externalId] })`
(`worker/index.ts:2353`).

`communications` tem 4 escritores em código e 0 linhas no banco, enquanto
`whatsapp_mensagens` tem 25363 e `ligacoes` 4938. Por que o dual-write não
produziu linha nesta carga: **NÃO CONFIRMADO**.

---

## 15. Escritores fora de runtime

Estes arquivos escrevem nas mesmas tabelas, mas não fazem parte do caminho de
execução do produto. Estão fora da contagem das seções 2 a 14.

### 15.1 Scripts em `app/src/scripts`

Contagem de escritas (`file:line` distintos) sobre as entidades deste documento:

| Arquivo | Escritas |
|---|---|
| scripts/simular-fechamento-2c1.ts | 22 |
| scripts/_limpeza-aceite.ts | 18 |
| scripts/validar-catalogo-oficial.ts | 17 |
| scripts/aceite-vendas.ts | 11 |
| scripts/teste-posvenda.ts | 10 |
| scripts/preparar-teste-jornadas.ts | 10 |
| scripts/teste-ciclos-cs.ts | 7 |
| scripts/seed-onboarding-teste.ts | 6 |
| scripts/teste-automacao-runtime.ts | 5 |
| scripts/testar-documenso-local.ts | 3 |
| scripts/criar-teste-implantacao-white-label.ts | 3 |
| scripts/backfill-onboarding-checklist-v2.ts | 3 |
| scripts/aceite-won-cs.ts | 3 |
| scripts/aceite-cs.ts | 3 |
| scripts/aceite-contrato-assinado.ts | 3 |
| scripts/novo-card-teste.ts | 2 |
| scripts/conciliar-pagamento-plataforma.ts | 2 |
| scripts/backfill-fulfillments-dev.ts | 2 |
| scripts/backfill-valor-negocios.ts | 1 |
| scripts/auditar-assinaturas-stripe.ts | 1 |

Dois deles apagam em cascata manual, em ordem fixa de FK, e são os únicos
lugares do repositório que fazem `DELETE FROM billing_identities`,
`DELETE FROM communications`, `DELETE FROM pessoas`, `DELETE FROM oportunidades`
e `DELETE FROM contrato_itens`:

- `scripts/_limpeza-aceite.ts:58-135` (43 statements `DELETE`/`UPDATE` em sequência)
- `scripts/aceite-vendas.ts:636-692` (30 statements)

### 15.2 Seeds e backfills em `app/src/lib/db`

| Arquivo | Escritas | Entidades tocadas |
|---|---|---|
| lib/db/seed.ts | 8 | contratos, atividades, negocios, leads (DELETE em `:86-89`, INSERT em `:152, 187, 212, 278`) |
| lib/db/cleanup-seed.ts | 8 | tarefas, atividades, contratos, negocios, leads (`:65, 66, 91, 115, 118, 131, 132, 142`) |
| lib/db/backfill-domain-model.ts | 7 | clientes, oportunidades, pessoas (DELETE em `:54, 55, 57`; INSERT em `:84, 142, 183`; UPDATE SQL cru em `:235`) |

### 15.3 Migrations com DML sobre as entidades

| Migration | Entidade | Operação |
|---|---|---|
| 0039_cs_workspace.sql:25, 53, 88 | clientes | UPDATE |
| 0039_cs_workspace.sql:60 | clientes | DELETE |
| 0039_cs_workspace.sql:81 | clientes | INSERT |
| 0040_cs_entrada_carteira_real.sql:31, 45 | clientes | UPDATE |
| 0041_cs_universo_carteira.sql:15 | clientes | INSERT |
| 0041_cs_universo_carteira.sql:37 | clientes | UPDATE |
| 0045_white_label_jornada_operacional.sql:19, 27 | fulfillment_itens | UPDATE, INSERT |
| 0046_tarefas_status_operacional.sql:17 | tarefas | UPDATE |
| 0047_vendas_dominio_onface.sql:30, 40, 41 | empresas | UPDATE |
| 0047_vendas_dominio_onface.sql:88, 104, 122 | leads | UPDATE |
| 0047_vendas_dominio_onface.sql:170, 187, 191, 196, 200, 208 | negocios | UPDATE |
| 0048_vendas_estagnacao_e_etapa.sql:22, 29, 50, 54, 56 | negocios | UPDATE |
| 0048_vendas_estagnacao_e_etapa.sql:66, 90, 95 | leads | UPDATE |
| 0050_tarefas_organizacao_obrigatoria.sql:30 | tarefas | UPDATE |
| 0052_white_label_implantacao.sql:26, 28 | fulfillment_itens | DELETE, INSERT |
| 0054_white_label_jornada_operacional.sql:18, 23 | fulfillment_itens | UPDATE, INSERT |

### 15.4 Grupo de rotas `app/onface-desenho`

`app/onface-desenho/atividades/actions.ts` tem 3 escritas em `tarefas`
(`:67` INSERT, `:91` UPDATE, `:102` UPDATE). É uma cópia sem sessão das actions
de `/onface-preview`: resolve o tenant pegando a primeira organização do banco
(`actions.ts:22-26`) e aborta em produção via `proibirEmProducao()`
(`actions.ts:18-20`, `if (process.env.NODE_ENV === "production") throw`).
Escreve de verdade em desenvolvimento.

### 15.5 Testes

Nenhum arquivo `*.test.ts` sob `app/src` escreve nas entidades deste documento.
Os testes que tocam em escrita fazem análise estática do código-fonte, não
execução: `lib/db/on-conflict.test.ts:36-90` lê `schema.ts` e varre os
`onConflictDo*` do repositório por regex.

---

## 16. Tabela-resumo

Escritores em runtime, por entidade. "Passam pela regra" = escrita que acontece
dentro de `src/lib/vendas` (valida e grava evento em `vendas_eventos` na mesma
transação).

| Entidade | Escritores em runtime | Quantos passam pela regra | Percentual | Linhas em produção |
|---|---:|---:|---:|---:|
| leads | 102 | 19 | 18,6% | 3989 |
| empresas | 22 | 3 | 13,6% | 2199 |
| pessoas | 5 | 3 | 60,0% | 0 |
| contatos | 34 | 0 | 0,0% | 1663 |
| negocios | 42 | 11 | 26,2% | 1562 |
| oportunidades | 5 | 1 | 20,0% | 0 |
| tarefas | 26 | 3 | 11,5% | 462 |
| atividades | 41 | 1 | 2,4% | 13044 |
| contratos | 28 | 0 | 0,0% | 742 |
| clientes | 9 | 0 | 0,0% | 275 |
| fulfillments | 5 | 0 | 0,0% | 25 |
| communications | 4 | 0 | 0,0% | 0 |
| **Total** | **323** | **41** | **12,7%** | |

Tabelas relacionadas, fora do total acima:

| Entidade | Escritores em runtime | Quantos passam pela regra | Percentual | Linhas em produção |
|---|---:|---:|---:|---:|
| contrato_itens | 0 | 0 | n/a | 487 |
| contrato_templates | 3 | 0 | 0,0% | 3 |
| oportunidade_itens | 9 | 0 | 0,0% | 0 |
| oportunidade_bundle | 2 | 1 | 50,0% | 0 |
| fulfillment_itens | 5 | 0 | 0,0% | 1659 |
| fulfillment_formularios | 3 | 0 | 0,0% | 3 |
| fulfillment_ramais | 2 | 0 | 0,0% | 6 |
| fulfillment_linhas_portabilidade | 2 | 0 | 0,0% | 3 |
| billing_identities | 0 | 0 | n/a | 224 |
| billing_customer_aliases | 0 | 0 | n/a | 2 |
| billing_audit_runs | 0 | 0 | n/a | 0 |
| billing_resolution_cases | 0 | 0 | n/a | 0 |
| billing_correction_ledger | 0 | 0 | n/a | 0 |

Método de contagem (reprodutível): para cada entidade, união dos dois greps da
seção 1.1, deduplicada por `arquivo:linha`, menos as exclusões da seção 1.2.
Exemplo verificado em `leads`: 129 escritas no total do repositório, 27 fora de
runtime, 102 em runtime.

Nenhuma das 323 escritas em runtime passa por uma camada de repositório ou DAO:
em todas, o comando `INSERT`/`UPDATE`/`DELETE` é emitido no próprio arquivo
listado. A coluna "Escreve direto?" distingue apenas se existe um módulo de
domínio entre o ponto de entrada e a tabela, não se existe uma camada de acesso
a dados (não existe).

---

## 17. Observações factuais sobre os dois sistemas de evento

Há dois registros de evento no código, e as duas tabelas estão vazias.

| Tabela | Função que grava | Chamadores | Linhas em produção |
|---|---|---|---:|
| vendas_eventos | `registrarEvento` (`lib/vendas/eventos.ts:86`) | 47 call sites: 46 em `src/lib/vendas/*` e 1 em `app/(crm2)/propostas/actions.ts:292` | 0 |
| event_outbox | `publicarEvento` (`lib/events/outbox.ts:96`) | 57 call sites: `api-server/routes/*` (17), `app/api/webhooks/*` (11), `src/lib/crm/*` (23), `lib/cadencia/cadence-engine.ts` (3), `lib/ai-platform/tools/registry.ts` (2), `worker/index.ts:2319` (1) | 0 |

`status_changes`, alimentada por `registrarMudancaDeEtapa`
(`lib/vendas/eventos.ts:144`) e por 26 escritas via query builder, tem 5923
linhas.

`eventos_comerciais` tem 247 linhas e **nenhum escritor** no repositório:
`grep -rnoE '\.(insert|update)\(eventosComerciais\)|INSERT INTO eventos_comerciais' app/src` não retorna
nada. A única menção em código é `UPDATE eventos_comerciais SET`
em `lib/crm/delete-negocio.ts:62-63` (desvinculação) e `DELETE` em
`scripts/_limpeza-aceite.ts:75`. De onde vieram as 247 linhas: **NÃO CONFIRMADO**.

---

## 18. O que ficou NÃO CONFIRMADO

1. **Origem das 224 linhas de `billing_identities` e das 2 de
   `billing_customer_aliases`.** Não existe `INSERT` para essas tabelas em
   nenhum lugar do repositório (código, scripts ou migrations).
2. **Origem das 487 linhas de `contrato_itens`.** Nenhum escritor em código.
3. **Origem das 247 linhas de `eventos_comerciais`.** Nenhum escritor em código.
4. **Por que `pessoas` (5 escritores), `oportunidades` (5 escritores),
   `communications` (4 escritores), `vendas_eventos` e `event_outbox` estão com
   0 linhas** nesta carga de produção. O código que as escreve existe e está
   ligado a rotas montadas (`api-server/server.ts:85-...`). Se nunca executou,
   se executou e foi limpo, ou se a carga não trouxe essas tabelas, não está
   determinado pelas evidências deste levantamento.
5. **Se os módulos de `src/lib/crm`, `src/lib/cs`, `src/lib/cadencia` e
   `src/lib/integrations` validam estado antes de gravar.** Foi verificado
   apenas se emitem evento (`publicarEvento`), não a profundidade da validação
   de cada função. A classificação `Parcial` reflete a emissão de evento, não
   uma auditoria de invariantes.
6. **Ordem real de execução entre escritores concorrentes** (por exemplo,
   `lib/crm/resolver-empresa.ts:59` versus `lib/vendas/identidade.ts:164` para
   criar empresa). O levantamento é estático; não houve instrumentação em
   runtime.
7. **Se `app/onface-desenho` já rodou contra este banco.** As actions escrevem
   de verdade em desenvolvimento e resolvem o tenant pela primeira organização
   do banco; não há marcador de origem em `tarefas` que permita distinguir.
