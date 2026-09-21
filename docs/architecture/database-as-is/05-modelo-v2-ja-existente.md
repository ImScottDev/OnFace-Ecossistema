# 05, Modelo V2 já existente

Levantamento AS-IS, somente leitura. Banco `callface_crm` local, carregado com dados de
produção de 20/09/2026. Nenhuma alteração foi feita no banco.

Este documento descreve o que já existe no schema como parte de um modelo novo construído
em paralelo ao legado. Ele não propõe arquitetura, não diz qual tabela deve vencer e não
recomenda solução. Onde não há evidência, está escrito NÃO CONFIRMADO.

Fontes de evidência usadas, em ordem de força:

1. comentários em `app/src/lib/db/schema.ts` (4237 linhas, comentado, cita ADRs);
2. as 56 migrations em `app/src/lib/db/migrations/`;
3. nomes de tabela e coluna (`canonical_*`, `crm2_*`, `*_legado`, `legacy_*`);
4. contagem exata de linhas em `_raw/tabelas-contagem-exata.txt`;
5. grep de escritores e leitores no repositório.

Convenção de veredito usada aqui:

- **ATIVO**: tem linha no banco e existe leitor no código.
- **PREPARADO**: a estrutura existe, há escritor ou backfill no código, e o banco tem 0 linhas.
- **ABANDONADO**: tem dado parado e nenhum escritor recente identificado.

---

## 1. Não existe um modelo novo, existem três

O schema carrega três iniciativas distintas de "modelo novo", com vocabulários diferentes,
datas diferentes e, em dois casos, decisões opostas sobre onde mora a verdade.

| Iniciativa | Marcador no código | Migrations | Onde a verdade fica declarada |
|---|---|---|---|
| CRM 2.0, fases F0 a F8 | `CRM 2.0 — FASE n`, `ADR-EXEC-001..022`, `dual-write`, `F8` | 0012 a 0016, 0033, 0034 | Tabelas NOVAS (`pessoas`, `oportunidades`, `communications`), legado vivo até a F8 |
| Reconciliação v1.1 + Pós-venda canônico | `RECONCILIAÇÃO v1.1`, `canonical`, `PÓS-VENDA CANÔNICO` | 0012 (parte), 0039 a 0042, 0051 | Tabelas canônicas próprias (`servicos_canonicos`, `fulfillments`, `billing_identities`) |
| Módulo 01 Vendas, ONFACE / SpecDrive | `Módulo Vendas`, `SpecDrive Bloco n §m` | 0047, 0048, 0050 | Tabelas LEGADAS (`leads`, `negocios`) recebem as colunas canônicas |

A tensão é declarada no próprio código. `schema.ts:3381-3387` diz que `leads`/`negocios`
são fonte de verdade "durante a transição (dual-write, cutover só na F8)" e que os nomes
novos foram escolhidos "pra nunca precisar renomear tabela depois". Já a migration 0047
(`0047_vendas_dominio_onface.sql:134`) intitula sua seção
`3. OPORTUNIDADE (tabela física 'negocios')`, ou seja, adota a tabela legada como casa
definitiva da oportunidade. As duas coisas estão no mesmo banco.

---

## 2. CRM 2.0 Fase 1, Domain Model

Cabeçalho declarado em `app/src/lib/db/schema.ts:3381-3390`:

> CRM 2.0 — FASE 1 (Domain Model): pessoas, oportunidades, clientes, pontos_contato.
> Schema V2 em paralelo ao legado (ADR-EXEC-003) [...] `leads`/`negocios`/`contatos`
> continuam vivos e são a fonte de verdade em produção durante a transição (dual-write,
> cutover só na F8).

Criadas pela migration `0012_reconciliation_and_crm2_domain_model.sql`, cujo cabeçalho
(linhas 1-6) declara "Domain Model CRM2 (pessoas/oportunidades/clientes/pontos_contato/etc)
validado via backfill dry-run + write real no banco local de dev em 2026-08-16".

### 2.1 `pessoas`

| Campo | Valor |
|---|---|
| Objetivo declarado | `schema.ts:3392-3397`: "identidade persistente (Contact do blueprint). Resolve os 2 conceitos de Contato hoje desconectados (`leads.tipo` vs tabela `contatos` de canal)" |
| Legado correspondente | `leads` (3989 linhas, `_raw/tabelas-contagem-exata.txt:105`) e `contatos` (1663, linha 71) |
| Linhas | **0** (`_raw/tabelas-contagem-exata.txt:124`; confirmado por `SELECT count(*) FROM pessoas` = 0) |
| Ponte de migração | `pessoas.lead_id_legado` com índice único `idx_pessoas_lead_legado` (`schema.ts:3409`, `3417`). O comentário diz explicitamente: "NÃO é FK operacional [...] Só ajuda o backfill/reconciliação a rastrear de qual Lead legado esta Pessoa veio" |
| Dual-write | Sim. `app/src/lib/crm/sync-domain-model.ts:111` (`db.insert(pessoas)`). Função `syncPessoaFromLead` importada em 8 pontos de produção: `api-server/routes/leads.ts:57`, `contatos-unified.ts:6`, `apollo.ts:9`, `contatos.ts:9`, `app/api/webhooks/site-lead/route.ts:5`, `app/api/webhooks/rd-lead/route.ts:10`, `lib/crm/won-evidence.ts:351`, `lib/crm/converter-oportunidade.ts:15` |
| Natureza do dual-write | Best-effort por design. `sync-domain-model.ts:10-11`: "Nunca lança erro que quebre o fluxo legado, dual-write é best-effort (loga e segue); o legado continua sendo a fonte de verdade até a F8" |
| Backfill | Sim, `app/src/lib/db/backfill-domain-model.ts`, comando `npm run db:backfill-domain-model` (`app/package.json:17`). O script começa com `db.delete()` das 4 tabelas (`backfill-domain-model.ts:53-57`), justificado em `:8-10`: "TRUNCATE das 4 tabelas novas antes de reconstruir. Seguro porque nada ainda lê/escreve nelas" |
| Backfill rodou neste banco? | **Não.** 0 linhas |
| Quem consome | `lib/vendas/consultas.ts:747, 784, 852, 1145` lê `pessoas`, sempre com fallback `UNION` para `leads` via `NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)` (`consultas.ts:764, 797, 860`). `api-server/routes/whatsapp.ts:375, 449` busca `pessoas` por `leadIdLegado` para popular `communications`. `clientes-crm2.ts:11` importa a tabela |
| **Veredito** | **PREPARADO.** Estrutura existe, 8 escritores de dual-write existem, backfill existe, e o banco tem 0 linhas. Todo leitor real cai no fallback de `leads` |

### 2.2 `pontos_contato`

| Campo | Valor |
|---|---|
| Objetivo declarado | `schema.ts:3420-3425`: "Attribution/Touchpoints, camada própria. Decisão fechada com o Kauã (08/08): atribuição de origem/campanha NUNCA depende de lead_id no Deal" |
| Legado correspondente | Colunas UTM dentro de `leads` (`utm_source` etc.), mais `campanhas` (18 linhas, linha 59) |
| Linhas | **0** (`_raw/tabelas-contagem-exata.txt:126`) |
| Ponte de migração | `pontos_contato.lead_id_legado`, índice único parcial (`schema.ts:3450`, `3457`) |
| Dual-write | Sim, `lib/crm/sync-domain-model.ts:138` |
| Backfill | Sim, `lib/db/backfill-domain-model.ts:107-133` |
| Quem consome | `api-server/routes/clientes-crm2.ts:945-947` e `:1645-1647`, para reconstruir o histórico de leads de uma pessoa |
| **Veredito** | **PREPARADO.** 0 linhas |

### 2.3 `oportunidades`

| Campo | Valor |
|---|---|
| Objetivo declarado | `schema.ts:3478-3481`: "Deal v2, referencia Pessoa+Empresa, NÃO Lead. Decisão fechada: Deal não depende de lead_id" |
| Legado correspondente | `negocios` (1562 linhas, `_raw/tabelas-contagem-exata.txt:114`) |
| Linhas | **0** (`_raw/tabelas-contagem-exata.txt:120`) |
| Ponte de migração | `oportunidades.negocio_id_legado`, índice único `idx_oportunidades_negocio_legado` (`schema.ts:3498`, `3517`) |
| Dual-write | Sim, `lib/crm/sync-domain-model.ts:232`. `syncOportunidadeFromNegocio` é importada em `api-server/routes/negocios.ts:8`, `contatos.ts:9`, `propostas.ts:13`, `leads.ts:57`, `lib/crm/converter-oportunidade.ts:15`, `lib/crm/composicao-comercial.ts:18`, `lib/crm/oportunidade-bundle.ts:18`, `lib/vendas/pipeline.ts:779` |
| Backfill | Sim, `lib/db/backfill-domain-model.ts:183` |
| Quem consome | `api-server/routes/negocios.ts:368-377` (busca a oportunidade espelho de um negócio e as irmãs do mesmo bundle), `clientes-crm2.ts:1490-1492`, `automacoes-tags.ts:16` |
| Contradição relevante | A mesma tabela recebeu, na 0047, colunas que duplicam o negócio legado: `titulo`, `service_family`, `etapa`, `commercial_motion`, `source_process` e um `lead_id` direto. O comentário em `schema.ts:3501-3502` diz "os mesmos fatos do negócio, para que a leitura nova não precise atravessar para a tabela legada". Isso convive com a decisão original de `:3479` de que o Deal "não depende de lead_id" |
| **Veredito** | **PREPARADO.** 8 escritores de dual-write, leitores reais, 0 linhas. Com 1562 negócios e 603 ganhos (`SELECT count(*) FROM negocios WHERE status='ganho'` = 603), o espelho está completamente vazio |

### 2.4 `clientes`

Único caso do F1 com dado, e o dado não veio do F1.

| Campo | Valor |
|---|---|
| Objetivo declarado | `schema.ts:3569-3573`: "Customer, entidade agregadora, não existe hoje. Hoje cliente é só `leads.tipo = 'cliente'` no mesmo registro do Lead" |
| Legado correspondente | `leads` com `tipo = 'cliente'` |
| Linhas | **275** (`_raw/tabelas-contagem-exata.txt:64`) |
| Origem real das linhas | `SELECT min(created_at), max(created_at) FROM clientes` devolve `2026-09-20 21:02:25.691612` a `2026-09-20 21:02:25.760058`. Esses dois timestamps são **exatamente** os de aplicação das migrations 0039 e 0041 em `_migracoes_aplicadas`. As linhas foram criadas pelo `INSERT INTO clientes ... SELECT ... FROM servicos_canonicos` de `0039_cs_workspace.sql:81-86` e `0041_cs_universo_carteira.sql:15-25`, não pelo backfill do Domain Model |
| Bridges do F1 preenchidas | Nenhuma. `lead_id_legado` = **0** de 275, `pessoa_principal_id` = **0**, `oportunidade_origem_id` = **0** (queries `SELECT count(*) FROM clientes WHERE ... IS NOT NULL`) |
| Qualidade do dado | `cs_sem_evidencia = true` em **90** de 275. O comentário em `schema.ts:3593-3597` já registra isso: "Sem nenhuma evidência real de quando virou cliente (nem Won, nem início de contrato, nem primeira fatura) [...] Sinalizado em vez de escondido: é um gap de dado, não um cliente novo" |
| Escritores em runtime | `lib/cs/handoff.ts:92`, `lib/crm/sync-domain-model.ts:164`, `api-server/routes/clientes-crm2.ts:526`, `lib/db/backfill-domain-model.ts:142`. Updates em `api-server/routes/cs.ts:102, 759`, `lib/cs/jornada.ts:105`, `lib/crm/won-evidence.ts:382`, `lib/cadencia/cadence-engine.ts:378` |
| Quem consome | `api-server/routes/cs.ts:98, 163`, `clientes-crm2.ts:144, 303, 519, 1048, 1491`, `automacoes-tags.ts:17` |
| **Veredito** | **ATIVO.** 275 linhas, escritores e leitores reais. Porém ativo como registro de conta do CS, ancorado em `empresa_id`, não como o agregador Pessoa+Oportunidade que o F1 descreve. As três FKs que o ligariam ao Domain Model estão 100% vazias |

---

## 3. CRM 2.0 Fase 4, Commercial Core

### 3.1 `oportunidade_itens`

| Campo | Valor |
|---|---|
| Objetivo declarado | `schema.ts:3520-3532` (ADR-EXEC-019/022): "service_family/revenue_nature NÃO são propriedade estrutural de Oportunidade, vivem no item, não no container" |
| Legado correspondente | `proposta_itens` (2701 linhas, linha 130 do arquivo de contagem) e `contrato_itens` (487) |
| Linhas | **0** (`_raw/tabelas-contagem-exata.txt:119`) |
| Pontes de migração | `contrato_item_id_legado` e `proposta_item_id_legado`, ambos com índice único parcial (`schema.ts:3548-3549`, `3565-3566`). `origem_legado` declara qual dos dois vale, ou `manual` |
| Dual-write | Sim, `lib/crm/composicao-comercial.ts:151` e `:208`. O cabeçalho (`composicao-comercial.ts:1-8`) diz: "mesmo padrão de dual-write já usado em sync-domain-model.ts (select-then-branch, idempotente por chave de bridge, nunca lança erro que quebre o fluxo legado)" |
| Gatilhos | `lib/crm/proposta-criacao.ts:11`, `lib/crm/enviar-proposta.ts:18`, `lib/crm/proposta-aceite.ts:18`, `api-server/routes/propostas.ts:21`, `api-server/routes/negocios.ts:12` |
| Backfill | Nenhum script dedicado encontrado |
| Quem consome | `api-server/routes/negocios.ts:371`, `lib/crm/politica-familia.ts:33` |
| **Veredito** | **PREPARADO.** Há 427 propostas com status contendo "aceit" (`SELECT count(*) FROM propostas WHERE status ILIKE '%aceit%'`) e 0 itens materializados. A cadeia depende de `oportunidades`, que também tem 0 linhas |

### 3.2 `oportunidade_bundle`

| Campo | Valor |
|---|---|
| Objetivo declarado | `0015_oportunidade_bundle.sql:1-8` (ADR-EXEC-022): "uma oportunidade/negócio não deve conter simultaneamente linhas comerciais INDEPENDENTES (Callface AI + PABX) [...] As oportunidades nascidas da mesma negociação ficam relacionadas via oportunidade_bundle (agregação, não status)" |
| Legado correspondente | Nenhum. É conceito novo. A 0015 optou por pendurar `bundle_id` na tabela legada: `0015:26-28` diz "negocios (legado/operacional) é a fonte de verdade do pipeline, bundle_id fica aqui (não só em oportunidades) porque é onde o vendedor realmente opera" |
| Linhas | **0** (`_raw/tabelas-contagem-exata.txt:118`) |
| Coluna espelho no legado | `negocios.bundle_id`: **0** de 1562 preenchidas (`SELECT count(*) FROM negocios WHERE bundle_id IS NOT NULL`) |
| Escritor | `lib/crm/oportunidade-bundle.ts:78`, acionado por `api-server/routes/propostas.ts:770` (`organizarVendaMultiLinha`) |
| Quem consome | `app/(crm2)/pipeline/actions.ts:165`, `pre-vendas/actions.ts:134`, `contatos/actions.ts:143`, `prospeccao/actions.ts:113`, `api-server/routes/negocios.ts:377` |
| **Veredito** | **PREPARADO.** Escritor e 5 leitores existem; tabela e coluna espelho vazias |

### 3.3 `proposta_grupo_comercial`, `comercial_evidencia`, `checkouts`, `won_evidence_policies`

| Tabela | Linhas | Escritor | Observação |
|---|---|---|---|
| `proposta_grupo_comercial` | **0** (linha 129) | `lib/crm/grupo-comercial.ts:91` | Recebeu 6 colunas novas na 0033 (`service_family`, `contrato_assinado_em`, `entrega_liberada_em`, `entrega_liberada_por`, `pagamento_status`, `pagamento_vence_em`) numa tabela com 0 linhas |
| `proposta_grupo_comercial_itens` | **0** (linha 128) | via `grupo-comercial.ts` | |
| `comercial_evidencia` | **0** (linha 67) | `lib/crm/won-evidence.ts:62` | |
| `checkouts` | **0** (linha 62) | `lib/crm/checkout.ts:194` | |
| `won_evidence_policies` | **3** | seed da `0033_motor_fechamento_familia.sql` | As 3 linhas nasceram em `2026-09-20 21:02:25.659295`, timestamp de aplicação da 0033. São políticas para `CALLFACE_AI`, `PABX` e `WHITE_LABEL` |

Sobre `won_evidence_policies`: a política é indexada por `service_family`, e
`negocios.service_family` está preenchida em **2** de 1562 linhas
(`SELECT count(*) FROM negocios WHERE service_family IS NOT NULL` = 2). O motor existe e
está semeado; o dado que o alimenta não existe.

**Veredito do bloco**: PREPARADO, com a exceção de `won_evidence_policies`, que tem dado
de configuração (3 linhas) mas cujo insumo de entrada está ausente.

---

## 4. CRM 2.0 Fase 2, Communication Intelligence

Cabeçalho em `schema.ts:2656-2659`:

> CRM 2.0 — FASE 2 (Communication Intelligence): communications, ai_analysis.
> Schema V2 em paralelo (ADR-EXEC-003), ligacoes/whatsapp_mensagens/emails continuam
> vivos, dual-write igual ao padrão de F1.

### 4.1 `communications`

| Campo | Valor |
|---|---|
| Objetivo declarado | `schema.ts:2661-2663`: "unifica Call/WhatsApp/Email, distinta de Activity. Hoje são 3 tabelas paralelas sem abstração comum. `pessoaId` é o anchor (F1), não `leadIdLegado` direto" |
| Legado correspondente | `ligacoes` 4938, `whatsapp_mensagens` 25363, `emails` 4460 (`_raw/tabelas-contagem-exata.txt`). Total legado: 34.761 linhas |
| Linhas | **0** (`_raw/tabelas-contagem-exata.txt:68`) |
| Ponte de migração | `origem_legado_id` (`schema.ts:2677`), sem FK declarada. O comentário diz "canal já diz qual tabela legada, id aponta pra lá" |
| Dual-write | Sim, em 5 pontos, todos marcados `[F2/dual-write]` e todos best-effort: `api-server/routes/whatsapp.ts:379` (envio manual) e `:453` (cross-save); `lib/integrations/callface.ts:381` (ligação); `worker/index.ts:2332-2355` (mensagem WhatsApp) e `:3428-3454` (email), mais `:3587-3606` (email de sequência) |
| Idempotência | `onConflictDoNothing` sobre `idx_communications_external_id` (`whatsapp.ts:392`, `callface.ts:395`) |
| Backfill | Nenhum script encontrado. Ausência declarada em `api-server/routes/atendimento.ts:21-26` |
| Quem consome | **Ninguém.** Nenhum `SELECT` de produção encontrado. A única referência a leitura é um `DELETE` de script de limpeza (`scripts/_limpeza-aceite.ts:131`) |
| Recusa explícita de consumo | `api-server/routes/atendimento.ts:17-26`: a Central de Atendimento "mescla 3 fontes reais que hoje são isoladas (WhatsApp=contatos, Email=threads sobre `emails`, Ligação=`ligacoes`) na leitura, em vez de depender de `communications`, essa tabela existe (dual-write desde F2) mas está com 0 linhas no ambiente local e o vínculo contato→lead cobre só ~1% dos contatos reais (ver ADR-EXEC-019). Ativar leitura de `communications` de verdade é um projeto de dados separado" |
| Causa mecânica do zero | O dual-write só insere quando encontra uma `pessoa` pelo `leadIdLegado` (`whatsapp.ts:375`, `:449`). Com `pessoas` em 0 linhas, o caminho nunca chega ao insert |
| **Veredito** | **PREPARADO.** 6 escritores, 0 leitores, 0 linhas. A tela que seria a consumidora natural documenta por escrito que não a usa |

### 4.2 `ai_analysis`

| Campo | Valor |
|---|---|
| Objetivo declarado | `schema.ts:2697-2700`: "genérico, atachável a qualquer entidade. Hoje extração de IA é silo por feature (SDR extrai só pra si, ligação tem resumo só pra si). Esta tabela é o destino comum" |
| Legado correspondente | `ai_sdr_logs` (0 linhas), resumo embutido em `ligacoes` |
| Linhas | **0** (`_raw/tabelas-contagem-exata.txt:8`) |
| Escritor | Um só: `lib/integrations/callface.ts:399`, dentro do mesmo bloco best-effort de `communications` |
| Quem consome | **Ninguém.** Nenhum `SELECT`/`from(aiAnalysis)` encontrado no repositório |
| **Veredito** | **PREPARADO.** 1 escritor, 0 leitores, 0 linhas. Depende de `communications`, que depende de `pessoas` |

---

## 5. Identidades canônicas

### 5.1 `empresas.canonical_empresa_id` e `leads.canonical_lead_id`

Auto-referência de deduplicação, não tabela nova.

| Coluna | Objetivo declarado | Preenchimento |
|---|---|---|
| `empresas.canonical_empresa_id` | `schema.ts:167-169`: "empresa (mesmo CNPJ importado 2x do Zoho). alias.canonicalEmpresaId" aponta o registro sobrevivente | **4** de 2199 (`SELECT count(*) FROM empresas WHERE canonical_empresa_id IS NOT NULL`) |
| `leads.canonical_lead_id` | `schema.ts:349-350`: "mesma lógica de empresas.canonicalEmpresaId, pro lead legado" | **0** de 3989 |

Índice `idx_empresas_canonical` declarado em `schema.ts:182`.

**Veredito**: PREPARADO em `leads` (0 linhas). Em `empresas`, 4 linhas de 2199 (0,18%). Se
essas 4 são o resultado completo de uma deduplicação executada ou um teste pontual:
**NÃO CONFIRMADO** (não foi encontrado script ou migration que as tenha produzido).

### 5.2 `billing_identities` e `billing_customer_aliases`

Este é o caso mais explícito de dois modelos convivendo dentro da mesma tabela.

| Campo | Valor |
|---|---|
| Objetivo declarado | `schema.ts:875-877`: "customer Stripe canônico + aliases históricos. Uma empresa pode ter Customers Stripe legados sem que isso autorize mesclar" |
| Convergência declarada | `schema.ts:3185-3191`: "CONVERGIDA no merge de 20/09. Os dois lados modelavam a mesma tabela de formas diferentes e o banco carregado de produção tem as colunas dos DOIS: dev -> canonical_empresa_id/canonical_lead_id + provider + external_customer_id; prod -> empresa_id/lead_id + canonical_stripe_customer_id + cnpj/email normalizados. [...] Unificar os dois modelos num só é decisão de produto, ainda em aberto" |
| Criada duas vezes | `0012_reconciliation_and_crm2_domain_model.sql:277` e `0055_stripe_billing_foundation.sql:4`, ambas `CREATE TABLE IF NOT EXISTS` |
| Linhas | **224** (`_raw/tabelas-contagem-exata.txt:46`) |
| Preenchimento dos DOIS modelos | lado dev: `canonical_lead_id` 224/224, `canonical_empresa_id` 166/224. Lado prod: `lead_id` 224/224, `empresa_id` 166/224, `canonical_stripe_customer_id` 224/224. `status` = `CONFIRMED` em 224/224 |
| Janela de criação | `2026-08-12 14:17:02` a `2026-09-14 19:37:13` |
| Escritor | **Nenhum INSERT encontrado no repositório.** Grep por `insert(billingIdentities)` e `INSERT INTO billing_identities` (inclusive nas 56 migrations) não retorna nada |
| Quem consome | `lib/integrations/billing-identity.ts:54-61` e `:131-138`, via `innerJoin` com `billing_customer_aliases`, filtrando `status = 'CONFIRMED'` |
| `billing_customer_aliases` | **2** linhas (`_raw/tabelas-contagem-exata.txt:45`). Nenhum `insert(billingCustomerAliases)` encontrado. Como o leitor faz `innerJoin` por alias, apenas 2 das 224 identidades são alcançáveis pelo código atual |
| **Veredito** | **ATIVO em leitura, ABANDONADO em escrita.** 224 linhas populadas fora do repositório, leitor real, nenhum escritor. Quem produziu as 224 linhas: **NÃO CONFIRMADO** |

---

## 6. `servicos_canonicos` e cadeia de fulfillment

### 6.1 `servicos_canonicos`

| Campo | Valor |
|---|---|
| Objetivo declarado | `schema.ts:2793`: "Fonte da verdade do current MRR, nunca recalcular por SUM(contratos.mrr)". `0051_posvenda_canonico.sql:10-12`: "já existe em produção desde a reconciliação de agosto/2026 (413 linhas)" |
| Anomalia de proveniência | `schema.ts:2789-2791`: "JÁ EXISTIA no banco de produção (413 linhas da reconciliação de agosto/2026) mas nunca esteve no schema.ts, a declaração abaixo apenas expõe ao Drizzle o que já está lá, sem alterar a tabela" |
| Legado correspondente | `contratos` (742), `assinaturas` (355), `servicos_catalogo` (220). O serviço canônico é o registro que reconcilia os três |
| Linhas | **438** (`_raw/tabelas-contagem-exata.txt:140`), contra as 413 citadas na 0051 |
| Distribuição | `ACTIVE` 432, `CHURNED` 4, `SUPERSEDED` 2. `portfolio_included = true` em 328 |
| Janela de criação | `2026-08-16 00:25:39` a `2026-09-18 17:44:01`, ou seja, ainda recebia linha dois dias antes do dump |
| Escritores | `lib/crm/servico-canonico.ts:79`, `lib/crm/pos-venda.ts:318`, `scripts/seed-onboarding-teste.ts:57` |
| Quem consome | 30 arquivos. Rotas: `clientes-crm2.ts`, `cs.ts`, `fulfillments.ts`, `automacoes-tags.ts`, `app/api/financeiro/metricas/route.ts`, `app/api/financeiro/pabx-import/route.ts`. Componentes: `components/crm2/clientes/Workspace.tsx`, `Cliente360.tsx`. Libs: todo `lib/cs/*` (8 arquivos), `lib/financeiro/metricas.ts`, `lib/vendas/consultas.ts` |
| **Veredito** | **ATIVO.** 438 linhas, escrita recente, consumo amplo. É a tabela canônica mais consolidada do banco |

### 6.2 `fulfillments`, `fulfillment_itens` e satélites

| Campo | Valor |
|---|---|
| Objetivo declarado | `schema.ts:2827-2830`: "Won termina o comercial; Fulfillment é outro processo, com vida própria, nunca uma etapa do Pipeline (achado real do legado Zoho: 'Delivery PABX' como Stage de Deal, exatamente o erro que este modelo corrige)" |
| Legado correspondente | Stage do board de `negocios`, mais o board `/onboarding` legado que `lib/crm/pos-venda.ts:20` declara não tocar |
| Linhas | `fulfillments` **25** (linha 100), `fulfillment_itens` **1659** (linha 97), `fulfillment_formularios` **3**, `fulfillment_ramais` **6**, `fulfillment_linhas_portabilidade` **3** |
| Janela | `2026-09-08 19:20:41` a `2026-09-18 17:44:01`, iniciada no dia da migration 0051 |
| Escritores | `lib/crm/fulfillment.ts:217`, `lib/crm/pos-venda.ts:366`, `scripts/backfill-fulfillments-dev.ts:65` |
| Backfill | `app/scripts/backfill-fulfillments.ts` existe. Se rodou em produção: **NÃO CONFIRMADO** |
| Quem consome | `api-server/routes/fulfillments.ts:24, 344, 568`, `fulfillment-formulario-publico.ts:33`, `uploads.ts:61`, `clientes-crm2.ts:831`, e as telas `app/impl-pabx`, `app/impl-white-label` |
| Cobertura | 25 fulfillments para 438 serviços canônicos e 603 negócios ganhos |
| **Veredito** | **ATIVO.** Dado real, escrita recente, leitores e telas dedicadas. Cobertura parcial da base |

---

## 7. Camada de classificação do catálogo

| Item | Linhas | Estado |
|---|---|---|
| `catalogo_mapeamentos_legacy` | **193** (linha 60) | Preexistente. `0035_classificacao_legado.sql:3-5`: "A camada JÁ EXISTIA: 193 linhas [...] Nada de novo foi criado no lugar dela, só faltavam 4 campos do briefing". A mesma migration (`:8-17`) registra que 103 das 193 (53%) estão `service_family='UNKNOWN'` com `confidence='CONFIRMED'`, e chama isso de "um dado que mente" |
| `servicos_catalogo.origem_catalogo` | 220 linhas, **todas** `legado` (`SELECT origem_catalogo, count(*) FROM servicos_catalogo GROUP BY 1`) | A 0034 criou a coluna para separar `oficial_stripe` de `legado`. Nenhuma linha `oficial_stripe` existe |
| `catalogo_precos` | **0** (linha 61) | Criada pela `0034_catalogo_oficial_stripe.sql` para receber os "21 Products, 213 Prices" do Stripe live mode citados em `0034:3-5`. Escritor: `scripts/importar-catalogo-oficial.ts:183`. Leitores: `api-server/routes/servicos-catalogo.ts`, `propostas.ts`, `lib/crm/checkout.ts`, `proposta-criacao.ts`, `politica-familia.ts` |

**Veredito**: `catalogo_mapeamentos_legacy` ATIVO com qualidade declaradamente ruim.
`catalogo_precos` PREPARADO, 0 linhas e 5 leitores esperando por ele. A importação do
catálogo oficial não rodou neste banco.

---

## 8. Módulo 01 Vendas, ONFACE (migration 0047)

Esta é a iniciativa mais recente e a que inverte a direção das anteriores. O cabeçalho
(`0047_vendas_dominio_onface.sql:1-7`) declara:

> Módulo 01 — Vendas: o domínio que a SpecDrive exige. Nada aqui apaga ou reescreve dado.
> São colunas aditivas, com backfill só onde existe evidência real na base; onde não
> existe, fica NULL e a tela diz que não sabe, em vez de inventar.

### 8.1 Colunas canônicas nas tabelas LEGADAS

| Coluna | Tabela | Substitui | Preenchimento |
|---|---|---|---|
| `estagio_pre_vendas` | `leads` | `crm2_pre_vendas_stage` (0016) | **1597** de 3989 |
| `qualificado` / `qualificado_em` | `leads` | tag/etapa | (não medido, coluna `NOT NULL DEFAULT false`) |
| `etapa` | `negocios` | `status` misturado com motivo | **1562** de 1562 |
| `motivo_estagnacao` / `estagnado_em` | `negocios` | `status` (`sem_retorno`, `trava_negociacao` etc.) | (backfill em `0048:23-27`) |
| `service_family` | `negocios` | nada, projeção semântica da 0012 | **2** de 1562 |
| `razao_social`, `logradouro`, `dominio`, etc. | `empresas` | `endereco` texto livre | backfill de `dominio` a partir de `website` em `0047:30-41` |

A 0047 declara em `0047:49-51` que `estagio_pre_vendas` é a etapa canônica e
`crm2_pre_vendas_stage` "continua intacto: é o rastro do De/Para do board legado e serve
de auditoria". Neste banco, `crm2_pre_vendas_stage` está preenchida em **0** de 3989 leads,
assim como `crm2_migrado_em` (**0**). Ou seja, o rastro que a 0047 preserva não existe:
as 1597 linhas de `estagio_pre_vendas` vieram do fallback de `0047:103-107`
("Lead que não passou pelo De/Para mas tem tipo 'lead': entra como novo"), não do De/Para
da 0016. O script `app/scripts/migrate-pre-vendas-crm2.ts` existe e não rodou neste banco.

### 8.2 `vendas_eventos`

| Campo | Valor |
|---|---|
| Objetivo declarado | `0047:303-313`: "O repositório já tem `status_changes`, `atividades`, `audit_log` e `event_outbox`, e a spec manda reaproveitar em vez de criar cinco sistemas paralelos. O que faltava era um lugar único para LER a linha do tempo comercial sem juntar quatro tabelas em toda consulta. Esta tabela é de leitura" |
| Legado correspondente | `status_changes` (5923), `atividades` (13044), `audit_log` (21), `event_outbox` (0) |
| Linhas | **0** (`_raw/tabelas-contagem-exata.txt:147`) |
| Escritor | `lib/vendas/eventos.ts:86` (`INSERT INTO vendas_eventos`), via `registrarEvento`. Chamado em produção a partir de `app/(crm2)/propostas/actions.ts:13` |
| Quem consome | `lerLinhaDoTempo` (`lib/vendas/eventos.ts:191`), importado em `app/(crm2)/pipeline/actions.ts:14`, `contatos/actions.ts:14`, `pre-vendas/actions.ts:12`, `propostas/actions.ts:13`, `contatos/pessoas/[id]/page.tsx:4`, `app/onface-desenho/contatos/pessoas/[id]/page.tsx:4`, e tipado em `components/onface/vendas/{pagina,Contatos,PreVendas,Pipeline}.tsx` |
| Dependência estrutural | Tem FK `pessoa_id -> pessoas(id)` (`0047:323`), tabela com 0 linhas |
| **Veredito** | **PREPARADO.** Escritor, 6 leitores e 4 componentes de tela, 0 linhas |

### 8.3 `pessoa_empresa_vinculos`

| Campo | Valor |
|---|---|
| Objetivo declarado | `0047:348-353` / `schema.ts:4216-4222`: "o vínculo tem papel, principal e histórico, e a Pessoa pode mudar de Empresa sem que o passado seja apagado. `pessoas.empresa_id` continua sendo o vínculo atual (é o que as consultas existentes leem); esta tabela é o que permite papel e histórico" |
| Legado correspondente | `pessoas.empresa_id`, que por sua vez tem 0 linhas |
| Linhas | **0** (`_raw/tabelas-contagem-exata.txt:123`) |
| Backfill | Sim, embutido na própria migration (`0047:375-379`): `INSERT INTO pessoa_empresa_vinculos ... SELECT ... FROM pessoas p WHERE p.empresa_id IS NOT NULL`. Rodou e inseriu 0 linhas, porque `pessoas` está vazia |
| Escritor em runtime | `lib/vendas/identidade.ts:337` (INSERT) e `:329` (encerramento do vínculo anterior) |
| Quem consome | `lib/vendas/consultas.ts:853`, com `LEFT JOIN` |
| **Veredito** | **PREPARADO.** Backfill executado sobre fonte vazia |

### 8.4 `lib/vendas` como camada de leitura com fallback

`lib/vendas/consultas.ts` é o que as telas ONFACE (`app/(crm2)/*`, `app/onface-desenho/*`,
`components/onface/vendas/*`) consomem. O padrão dele é ler o modelo novo com queda para o
legado na mesma query:

- `consultas.ts:747` e `:764`: `FROM pessoas p` UNION com leads onde
  `NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)`;
- `consultas.ts:600-602`: conta pessoas de uma empresa somando `pessoas` e leads sem pessoa.

Com `pessoas` em 0 linhas, 100% do resultado dessas telas vem do ramo legado. O modelo novo
está no caminho de leitura, mas não contribui com nenhuma linha.

---

## 9. Pontes de migração e trilhas de legado

Tabelas e colunas cuja função declarada é rastrear a origem legada.

| Objeto | Linhas | Função declarada |
|---|---|---|
| `anexos_legado` | **1980** (linha 34) | `schema.ts:3119-3125`: "Recuperação legado Zoho (histórico, anexos, provenance) [...] JÁ EXISTIA" |
| `legacy_provenance` | **5064** (linha 106) | `schema.ts:3170`: proveniência por entidade e `zoho_id` |
| `correction_change_log` | **30876** | Auditoria da correção v1.0 (`schema.ts:3370`) |
| `correction_runs` | **6** | idem |
| `reconciliation_changes` | **413** | Reconciliação v1.1. O número bate com as "413 linhas" de `servicos_canonicos` citadas em `0051:10` |
| `reconciliation_runs` | **1** | idem |
| `portfolio_snapshots` | **3** | `schema.ts:3343` |
| `pessoas.lead_id_legado` | 0 linhas na tabela | bridge F1 |
| `pontos_contato.lead_id_legado` | 0 | bridge F1 |
| `clientes.lead_id_legado` | 0 de 275 preenchidas | bridge F1 não usada |
| `oportunidades.negocio_id_legado` | 0 linhas na tabela | bridge F1 |
| `oportunidade_itens.contrato_item_id_legado` / `proposta_item_id_legado` | 0 | bridge F4 |
| `communications.origem_legado_id` | 0 | bridge F2, sem FK |
| `leads.crm2_*` (6 colunas, 0016) | 0 de 3989 | rastro do De/Para de pré-vendas |

**Veredito**: as trilhas de recuperação do Zoho (`anexos_legado`, `legacy_provenance`,
`correction_*`, `reconciliation_*`) estão **ATIVAS** com volume real. Todas as bridges do
modelo novo (`*_id_legado`, `crm2_*`) estão em **0**.

---

## 10. Infraestrutura de eventos

| Tabela | Linhas | Escritor | Leitor |
|---|---|---|---|
| `event_outbox` | **0** (linha 91) | `lib/events/outbox.ts:98` | `lib/events/consumer.ts`, `lib/automations/event-dispatcher.ts`, `worker/index.ts` |
| `vendas_eventos` | **0** (linha 147) | `lib/vendas/eventos.ts:86` | `lib/vendas/eventos.ts:191` e 6 telas |
| `audit_log` | **21** | `lib/crm/sync-domain-model.ts:35` e outros | |
| `status_changes` | **5923** | legado | relatórios |
| `atividades` | **13044** | legado | timeline |
| `automacao_execucoes` | **0** (linha 38) | `lib/crm/automacao-engine.ts` (citado em `schema.ts:2718`) | |

`lib/crm/pos-venda.ts:20` registra por escrito que o pós-venda canônico "não usa
event_outbox". O outbox declarado como "espinha dorsal de eventos" em `schema.ts:3610`
(ADR-EXEC-001) tem 0 linhas.

Nota: `audit_log` tem 21 linhas e uma delas seria o registro de falha de dual-write
(`domain_model_sync.failed`, `sync-domain-model.ts:37`). Quantas das 21 são desse tipo:
**NÃO CONFIRMADO** (não consultado).

---

## 11. Tabela-resumo

| Item | Legado correspondente | Linhas | Estado |
|---|---|---|---|
| `pessoas` | `leads` (3989), `contatos` (1663) | 0 | PREPARADO |
| `pontos_contato` | UTMs em `leads`, `campanhas` (18) | 0 | PREPARADO |
| `oportunidades` | `negocios` (1562) | 0 | PREPARADO |
| `oportunidade_itens` | `proposta_itens` (2701), `contrato_itens` (487) | 0 | PREPARADO |
| `oportunidade_bundle` | nenhum (conceito novo) | 0 | PREPARADO |
| `negocios.bundle_id` | nenhum | 0 de 1562 | PREPARADO |
| `clientes` | `leads.tipo='cliente'` | 275 | ATIVO (como conta de CS; bridges F1 todas em 0) |
| `communications` | `ligacoes` (4938), `whatsapp_mensagens` (25363), `emails` (4460) | 0 | PREPARADO |
| `ai_analysis` | `ai_sdr_logs` (0), resumo em `ligacoes` | 0 | PREPARADO |
| `empresas.canonical_empresa_id` | nenhum | 4 de 2199 | NÃO CONFIRMADO (origem das 4 linhas) |
| `leads.canonical_lead_id` | nenhum | 0 de 3989 | PREPARADO |
| `billing_identities` | `assinaturas` (355), `faturas` (951) | 224 | ATIVO em leitura, sem escritor no repositório |
| `billing_customer_aliases` | nenhum | 2 | ATIVO em leitura, sem escritor no repositório |
| `servicos_canonicos` | `contratos` (742), `assinaturas` (355) | 438 | ATIVO |
| `fulfillments` | stage do board `negocios` | 25 | ATIVO |
| `fulfillment_itens` | nenhum | 1659 | ATIVO |
| `fulfillment_formularios` / `ramais` / `linhas_portabilidade` | nenhum | 3 / 6 / 3 | ATIVO (volume baixo) |
| `servico_billing_timeline` | `assinaturas` | 144 | ATIVO |
| `catalogo_mapeamentos_legacy` | `servicos_catalogo` (220) | 193 | ATIVO (53% `UNKNOWN` por declaração da 0035) |
| `catalogo_precos` | `servicos_catalogo.valor_sugerido` | 0 | PREPARADO |
| `servicos_catalogo.origem_catalogo` | nenhum | 220 `legado`, 0 `oficial_stripe` | PREPARADO |
| `proposta_grupo_comercial` | `propostas` (1550) | 0 | PREPARADO |
| `proposta_grupo_comercial_itens` | `proposta_itens` (2701) | 0 | PREPARADO |
| `comercial_evidencia` | nenhum | 0 | PREPARADO |
| `checkouts` | nenhum | 0 | PREPARADO |
| `won_evidence_policies` | regra implícita no código | 3 (seed da 0033) | PREPARADO (insumo `negocios.service_family` em 2 de 1562) |
| `eventos_comerciais` | histórico Zoho | 247 | ATIVO (escrita única em 2026-08-11) |
| `mrr_movimentos` | `negocios.mrr_fechado` | 665 | ATIVO (escrita até 2026-09-19) |
| `fatura_itens` | `faturas` (951) | 226 | ATIVO |
| `vendas_eventos` | `status_changes` (5923), `atividades` (13044) | 0 | PREPARADO |
| `pessoa_empresa_vinculos` | `pessoas.empresa_id` | 0 | PREPARADO |
| `leads.estagio_pre_vendas` | `leads.sdr_status` / `sdr_board_column` | 1597 de 3989 | ATIVO |
| `leads.crm2_*` (6 colunas) | `leads.sdr_status` | 0 de 3989 | PREPARADO |
| `negocios.etapa` | `negocios.status` | 1562 de 1562 | ATIVO |
| `negocios.service_family` | nenhum | 2 de 1562 | PREPARADO |
| `event_outbox` | nenhum | 0 | PREPARADO |
| `automacao_execucoes` | nenhum | 0 | PREPARADO |
| `teams` | nenhum | 0 | PREPARADO |
| `anexos_legado` | anexos do Zoho | 1980 | ATIVO |
| `legacy_provenance` | nenhum | 5064 | ATIVO |
| `reconciliation_changes` / `runs` | nenhum | 413 / 1 | ATIVO (execução única) |
| `correction_change_log` / `runs` | nenhum | 30876 / 6 | ATIVO (execução única) |

---

## 12. NÃO CONFIRMADO

Itens levantados que não têm evidência suficiente neste levantamento:

1. **Quem escreveu as 224 linhas de `billing_identities` e as 2 de
   `billing_customer_aliases`.** Nenhum INSERT existe no repositório, nem em código nem nas
   56 migrations.
2. **Origem das 4 linhas de `empresas.canonical_empresa_id`.** Nenhum script ou migration
   identificado que as produza.
3. **Se o dual-write de F1/F2 está deployado em produção.** O código existe e é chamado por
   rotas de produção, mas 0 linhas nas tabelas de destino. Este levantamento não distingue
   entre "código não deployado", "deployado e nunca acionado" e "acionado e sempre abortado
   no guard de `pessoa` inexistente". A terceira hipótese é consistente com
   `whatsapp.ts:375` e `:449`, mas não foi verificada em log.
4. **Se `app/scripts/backfill-fulfillments.ts` rodou em produção.** O script existe e há 25
   fulfillments; não há registro de execução.
5. **Por que `servicos_canonicos` tem 438 linhas e a 0051 cita 413.** A diferença de 25
   pode ou não corresponder aos 25 `fulfillments`; não foi verificada.
6. **Quantos dos 21 registros de `audit_log` são `domain_model_sync.failed`.** Não
   consultado.
7. **Se `_carga_contagem_antes` (82 linhas) representa o estado do dump antes da carga** e
   qual processo a criou. A tabela tem apenas `tabela|linhas` e não está declarada em
   `schema.ts`.
8. **Se as 3 iniciativas paralelas (F1-F8, reconciliação canônica, Módulo Vendas ONFACE)
   foram decididas como convergentes ou concorrentes.** O código registra a tensão
   (`schema.ts:3384` diz cutover na F8 para tabelas novas; `0047:134` adota a tabela
   legada como casa da oportunidade) mas não registra uma decisão que resolva.
