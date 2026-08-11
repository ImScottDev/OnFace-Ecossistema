# Fase 2 — STATE vs EVENT: diagnóstico da modelagem temporal (Opportunity × Contract × Lifecycle × Event)

> Frente de investigação isolada, disparada pela hipótese do Kauã sobre separar **Opportunity** (o que foi vendido, imutável) de **Contract** (Ativo/Encerrado), **Customer Lifecycle** (Prospect→Cliente→Ativo→Churned) e **Event** (Won/Upgrade/Downgrade/Renewal/Churn/Reactivation, fato datado). **Zero escrita em qualquer lugar** — schema, código e banco só foram lidos (`grep`/`Read`/leitura de arquivo). Toda citação de arquivo:linha é do estado real do repo na branch `feature/crm2-fase7-frontend`, lido em 10/08/2026.
>
> Regra seguida: o que segue é diagnóstico ("hoje o schema faz X, o que sugere Y"), nunca veredito de que algo "está errado" — a decisão de schema definitivo é do Kauã.

---

## 0. Como isto se conecta com a Fase 1

A Fase 1 (`00-SINTESE-CONSOLIDADA.md`, `03-reconciliacao-oportunidades.md`) já tinha levantado o dado; esta frente responde "o que a estrutura atual do CRM 2.0 é capaz de fazer com esse dado, hoje":

- **121 negócios** com `status='ganho'` no CRM que têm evento pós-venda documentado no Zoho (churn/upgrade/downgrade/renovação/migração), 97,5% cronologicamente consistente (evento depois do `ganho_at`).
- **244 registros-evento** no Zoho (CHURN 88, UPGRADE 87, DOWNGRADE 27, RENOVAÇÃO 29, MIGRAÇÃO 13), tipados por parsing de nome (`Nome Oportunidade de Venda`), ligados ao negócio original via `Oportunidade Origem`.
- A síntese já propôs um rascunho de 4 conceitos (seção 16) alinhado com o que o Kauã trouxe — esta frente valida esse rascunho contra o schema real, não só contra a teoria.

---

## 1. Inventário do schema (Drizzle, `app/src/lib/db/schema.ts`)

### 1.1 `negocios` (linha 409-473) — Deal legado, fonte de verdade em produção hoje

| Coluna | Tipo | Valores/observação |
|---|---|---|
| `status` | text, default `"reuniao_agendada"` | reuniao_agendada, negociacao_iniciada, proposta_apresentada, trava_negociacao, outra_data, sem_retorno, no_show, reuniao_realizada, trava_assinatura, trial, **ganho**, **perdido**, **ativo** (valores observados na Fase 1, tabela de contingência §2.2 de `03-reconciliacao-oportunidades.md`) |
| `ganhoAt` | timestamp | preenchido só quando `status` vira `ganho` — 1 campo, 1 valor, sobrescrevível |
| `motivoPerda` / `motivoPerdaDetalhe` | text | só usado quando `status='perdido'` |
| `negocioOrigemId` | uuid, **sem FK real** (comentário explícito: "link to the original 'ganho' deal") | ver §3.3 — só escrito em 1 fluxo (clone pós-venda), nunca em churn/upgrade/downgrade posterior |
| `contratoTipo`, `zohoId`, `pipedriveId` | text | bridges de migração |
| `updatedAt` | timestamp | atualizado em toda mudança |

Não existe status como `churned`, `upgrade`, `downgrade`, `renovado` no vocabulário de `negocios.status` — o mais próximo é `ativo` (usado por 52 negócios Closed Won do Zoho, Fase 1 §2.2), que na prática funciona como um segundo pipeline sem definição formal no schema (é só mais um valor de texto livre na mesma coluna).

### 1.2 `contratos` (linha 551-594)

| Coluna | Tipo | Valores/observação |
|---|---|---|
| `status` | text, default `"ativo"` | `ativo \| pausado \| concluido \| churned \| cancelado \| renovado \| pendente_assinatura` (enum documentado em comentário, não em constraint de banco) |
| `motivoChurn` | text | só populado quando `status='churned'` |
| `finalizadoAt` | timestamp | 1 campo, para qualquer motivo de fim (churn, conclusão ou renovação) |
| `assinaturaStatus` | text, default `"nao_aplicavel"` | `nao_aplicavel \| pendente \| aceite_simples` — aceite eletrônico simples, não assinatura digital qualificada |
| `notas` | text livre | usado para registrar contexto de transição (ver §3.2) |
| `negocioId` | uuid (nullable) | 75,5% dos contratos no CRM hoje não têm `negocioId` (achado Fase 1, `02-inventario-crm-atual.md`) |

`contratos.status` é o único lugar do schema atual que tem `churned` e `renovado` como valores nomeados — é o candidato mais próximo a "Contract Status" da proposta do Kauã. Mas é um campo único, sobrescrito.

### 1.3 `status_changes` (linha 538-548) — tabela genérica de transição

```
id, lead_id, negocio_id, de_status, para_status, usuario_id, motivo, created_at
```

Sem `updatedAt`, sem índice de update visível no código (só INSERT e SELECT, ver §2) — estruturalmente é append-only para **transição de estágio de pipeline** (`negocios.status`/`leads.status`). Cobre: `reuniao_agendada→ganho`, `ganho→perdido` etc. Não tem coluna de tipo de evento (`Won`/`Churn`/`Upgrade`) — só o par de valores livres de status.

### 1.4 `event_outbox` (linha 1968-1987) — outbox genérico (ADR-EXEC-001)

```
id, organizacao_id, event_type, aggregate_type, aggregate_id, payload (jsonb),
correlation_id, idempotency_key, status (pending|processing|processed|failed),
attempts, last_error, processed_at, created_at
```

Sem `updatedAt` na tabela — o único mutável é `status`/`attempts`/`processedAt`, e nenhuma linha é deletada após processamento (confirmado por `grep` em `app/src/lib/events/consumer.ts` — só `SELECT` e `UPDATE(status)`, nenhum `DELETE`). Vocabulário de `eventType` realmente emitido hoje (grep completo, `eventType:` em todo `app/src`): `LeadCreated`, `DealCreated`, `StageChanged`, `DealLost`, `DealWon`, `CustomerCreated`, `ProposalViewed`, `ProposalAccepted`, `ProposalRejected`, `ProposalSent`. **Nenhum `Upgrade`/`Downgrade`/`Renewal`/`Churn`/`Reactivation` é emitido em lugar nenhum do código** — o comentário da coluna (`schema.ts:1971`) cita `"ContractSigned"` como exemplo, mas esse tipo também não é emitido por nenhuma rota real hoje (comentário aspiracional, não implementado).

### 1.5 `comercial_evidencia` (linha 1905-1920) — ADR-EXEC-012, Fase 4

```
id, organizacao_id, negocio_id, tipo (stripe_payment|stripe_subscription|signed_contract|
manual_contract|admin_approval), source_ref, metadata (jsonb), verificado_por,
verificado_em, created_at
```

`uniqueIndex` em `(negocioId, tipo, sourceRef)` com `onConflictDoNothing()` no insert (`won-evidence.ts:52-62`) — desenhada deliberadamente para ser append-only e idempotente: nunca é feito `UPDATE` numa evidência existente, só insert de novas linhas (confirmado, nenhum `db.update(comercialEvidencia...)` em todo o repo). Cada linha é datada (`verificadoEm`) e imutável.

### 1.6 `won_evidence_policies` (linha 1922-1932)

```
id, organizacao_id, produto (nullable = catch-all), tipos_aceitos (jsonb string[]),
ativo, created_at, updated_at
```

Isto é configuração/regra de negócio, não fato nem estado de entidade — está fora do binário STATE/EVENT propriamente dito (é "regra que decide como interpretar estado", não "estado" nem "evento").

### 1.7 `pessoas` (linha 1729-1751) — CRM 2.0, tabela vazia hoje

```
id, organizacao_id, empresa_id, nome, sobrenome, email, telefone, whatsapp, cargo,
lead_id_legado (bridge, sem FK operacional), metadata (jsonb), created_at, updated_at
```

Sem campo de status. É puramente uma entidade de identidade (Contact), sem STATE nem EVENT — o comentário do schema (linha 1723-1728) é explícito: "Pessoa é o registro permanente; Lead é só o estágio transitório de qualificação". Isso já separa "identidade" de "estado transitório de qualificação" — mas o próprio lifecycle de cliente (Prospect→Cliente→Ativo→Churned) não mora aqui, mora potencialmente em `clientes.statusFinanceiro` (ver §1.8).

### 1.8 `oportunidades` (linha 1793-1819) — CRM 2.0, tabela vazia hoje (Deal v2)

```
id, organizacao_id, pessoa_id, empresa_id, pipeline_id, stage, responsavel_id,
valor, mrr, probabilidade, previsao_fechamento, ganho_at, perdido_at, motivo_perda,
negocio_id_legado (bridge), created_at, updated_at
```

Estrutura **espelha exatamente** `negocios`: `stage` é STATE mutável (confirmado em código, ver §2), `ganhoAt`/`perdidoAt` são timestamps de campo único, não linhas de evento. Não introduz nenhum conceito novo de Won/Churn/Upgrade — é uma cópia renomeada do padrão legado, só desacoplada de `leadId` (decisão fechada 08/08: atribuição vive em `pontosContato`, não em FK direta).

### 1.9 Tabelas adjacentes relevantes, não pedidas explicitamente mas centrais ao diagnóstico

- **`clientes`** (linha 1826-1840, CRM 2.0, vazia hoje): `statusFinanceiro: text` — comentário no próprio schema diz "**ativo | inadimplente | churned** — cache de leitura, nunca fonte de escrita". Confirmado por `grep -rn "statusFinanceiro" app/src`: a única ocorrência é a declaração da coluna — **nenhum código no repo hoje escreve nesse campo**. É o candidato estrutural mais parecido com "Customer Lifecycle State" do vocabulário do Kauã, e está dormente (declarado, não implementado).
- **`mrr_movimentos`** (linha 677-700): `tipo` (`novo|expansao|contracao|churn|reativacao`), `delta`, `mrrAntes`, `mrrDepois`, `ocorridoEm`, `origem` (`stripe_sync|backfill|pabx_import`). Confirmado por grep: só `INSERT`, nunca `UPDATE`/`DELETE`, em todo o repo — genuinamente append-only, timestamped, e já tem o vocabulário `churn`/`reativacao` como valores de EVENTO (não de estado). Mas está desconectado de `negocios`/`oportunidades`: só referencia `leadId`/`assinaturaId`/`contratoId`, e só é alimentado por `stripe-sync.ts:250` — ou seja, cobre o lado financeiro (delta de MRR do Stripe), não o lado comercial (Opportunity/Deal) nem o vocabulário Zoho de UPGRADE/DOWNGRADE/RENOVAÇÃO/MIGRAÇÃO por si.
- **`audit_log`** (linha 1694-1711): genérico, `before`/`after` (jsonb), qualquer entidade — é log de auditoria de escrita técnica (quem mudou o quê), não um catálogo de eventos de domínio/negócio com vocabulário fixo.

---

## 2. Classificação explícita: STATE ou EVENT

Calibrando pelos próprios exemplos do Kauã (Opportunity Stage = STATE; Contract Status = STATE; Customer Lifecycle = STATE; Won/Upgrade/Downgrade/Renewal/Churn/Reactivation = EVENT):

| Campo/Tabela | Classificação | Justificativa |
|---|---|---|
| `negocios.status` | **STATE** | 1 valor atual, sobrescrito a cada `UPDATE negocios SET status=...` (`negocios.ts:469` em diante). Não guarda o histórico — quem guarda é `status_changes` (à parte). |
| `negocios.ganhoAt` | **STATE** (timestamp de campo único, não linha de evento) | Escrito 1x (`updateData.ganhoAt = new Date()`, `negocios.ts:570`), nunca reescrito para trás — mas também nunca *complementado* por um segundo evento de vida (upgrade, churn) depois. Funciona como "quando entrou no estado atual", não como catálogo de eventos. |
| `contratos.status` | **STATE** | Mesmo padrão — `UPDATE contratos SET status='churned'` (`stripe-sync.ts:300`) ou `status='renovado'` (`contrato-duplicidade.ts:246`) sobrescreve o valor anterior. |
| `contratos.finalizadoAt`/`motivoChurn` | **STATE** (metadado do estado atual) | 1 valor por contrato — se o contrato já foi `renovado` e depois `churned`, o campo só guarda o último motivo, não a sequência. |
| `oportunidades.stage` | **STATE** | Espelha `negocios.status` via `UPDATE oportunidades SET stage=...` (`sync-domain-model.ts:228`) — mesma limitação, cópia do padrão legado. |
| `clientes.statusFinanceiro` | **STATE, declarado mas não implementado** | Comentário no schema já classifica como "cache de leitura" (ou seja, STATE derivado) — mas hoje é campo morto (nenhuma escrita). É o único candidato estrutural pra "Customer Lifecycle" do vocabulário Kauã, e está vazio de lógica. |
| `status_changes` (linha inteira) | **EVENT genérico de transição de estágio** | Append-only por construção (só INSERT+SELECT), `createdAt` datado, guarda `deStatus→paraStatus`. É evento de "mudança de estágio de pipeline", não de "evento de lifecycle comercial" — não tem vocabulário Won/Upgrade/Downgrade/Renewal/Churn/Reactivation, só os valores livres da coluna `status`. |
| `event_outbox` (linhas com `eventType` real) | **EVENT de domínio, genérico** | Append-only (sem DELETE, `status` só avança pending→processed/failed), `payload` jsonb, datado. Cobre `DealWon`/`DealLost`/`StageChanged`/`CustomerCreated` — já tem o "formato certo" de Evento comercial, mas o vocabulário atual não inclui Upgrade/Downgrade/Renewal/Churn/Reactivation, e sua função primária é orquestração assíncrona (fan-out para consumidores), não histórico de negócio consultável — não há endpoint/rota que leia `event_outbox` como timeline de um negócio. |
| `comercial_evidencia` | **EVENT (evidência imutável de Won)** | Dedup por `(negocioId, tipo, sourceRef)`, `onConflictDoNothing`, nunca `UPDATE`. É o exemplo mais limpo de EVENT no schema atual — mas escopo estreito: só prova "isso foi ganho", não modela Upgrade/Downgrade/Renewal/Churn depois do Won. |
| `mrr_movimentos` | **EVENT (financeiro, MRR)** | Append-only confirmado, `tipo` já usa vocabulário de evento (`churn`/`reativacao`/`expansao`/`contracao`/`novo`), `ocorridoEm` datado. Mais próximo do vocabulário do Kauã do que qualquer outra tabela — mas vive desconectada de `negocios`/`oportunidades` (só liga a `assinaturaId`/`contratoId`) e só é alimentada pelo diff do Stripe, não pelo lado comercial/Zoho. |
| `won_evidence_policies` | **Nem STATE nem EVENT — regra de configuração** | Decide "que tipo de evidência conta", não registra fato nem estado de uma entidade específica. |
| `pessoas`/`oportunidades` (estrutura geral) | **Entidade + STATE**, sem EVENT embutido | Réplica do padrão legado (Contact/Deal), sem nenhum conceito de Event de primeira classe introduzido — o comentário do schema (linha 1789-1792) só resolve "de onde vem a atribuição" (Attribution ≠ Lead), não "o que aconteceu ao longo do tempo com este Deal". |

**Leitura de conjunto**: o schema atual tem *pedaços* funcionais de Event (`status_changes`, `event_outbox`, `comercial_evidencia`, `mrr_movimentos`) — mas cada um cobre uma fatia diferente e nenhum cobre o vocabulário de lifecycle pós-venda (Upgrade/Downgrade/Renewal/Churn/Reactivation) que é exatamente o que a Fase 1 encontrou faltando. Nenhuma dessas 4 tabelas hoje é lida como "a timeline de um cliente" — cada uma serve o propósito estreito para o qual foi construída (transição de pipeline, orquestração assíncrona, prova de Won, delta de MRR do Stripe).

---

## 3. Onde há conflação hoje (evento histórico modelado só como estado mutável)

### 3.1 `negocios.status='ganho'` nunca é revisitado depois do Won — não há STATUS nem EVENTO de pós-venda

`app/src/api-server/routes/negocios.ts:469-628` é o handler de `PATCH /negocios/:id`. A lógica de transição cobre `proposta_apresentada`, `ganho` (com gate de evidência, ADR-EXEC-012), `perdido`, `reuniao_realizada` — mas **não existe nenhum valor de `status` de destino que represente churn/upgrade/downgrade/renovação de um negócio já `ganho`**. Depois do Won, o único caminho estrutural que o código oferece é o clone descrito em §3.3 (feito 1x, no momento do Won, não depois). Se o Kauã quisesse hoje registrar "este negócio ganho em 2024 teve um churn em 2026", não há campo de destino no enum de `status` nem rota que aceite essa transição — teria que ser feito por fora (nota de texto, `camposCustom`, ou às cegas em `contratos.status`, que é uma tabela diferente e sem link automático de volta pro negócio original com contexto de "por quê").

### 3.2 Renovação/upgrade de contrato é registrado como texto livre, não como fato estruturado

`app/src/lib/crm/contrato-duplicidade.ts:240-252` (`marcarContratoComoRenovado`):

```ts
const notaNova = `[F4] Substituído pelo contrato ${contratoNovoId} — mesma assinatura Stripe, ...`;
await db.update(contratos).set({
  status: "renovado",
  finalizadoAt: new Date(),
  notas: existente?.notas ? sql`${existente.notas} || E'\n\n' || ${notaNova}` : notaNova,
  updatedAt: new Date(),
}).where(eq(contratos.id, contratoAntigoId));
```

O "evento de renovação" é representado por (a) sobrescrever `status` (STATE) e (b) concatenar uma string legível por humano no campo `notas` (texto livre, não estruturado, não pesquisável por query). Isto é estruturalmente o **mesmo padrão** que a Fase 1 identificou como problema herdado do Zoho (síntese, seção 10-11, item 1: "Nome do registro usado como lógica de negócio... funciona, mas é fragilíssimo... não é pesquisável/reportável sem parsing de texto") — só que agora o texto livre é `contratos.notas` em vez de `Nome Oportunidade de Venda`. O *mecanismo* (texto concatenado carregando o fato) se repete no CRM 2.0, mesmo o *fato em si* (renovação aconteceu) estando correto.

### 3.3 `negocioOrigemId` reproduz a estrutura do "Oportunidade Origem" do Zoho, mas só no momento do Won — não para eventos posteriores

`app/src/lib/db/schema.ts:443`: `negocioOrigemId: uuid("negocio_origem_id")` — comentário: *"link to the original 'ganho' deal"*, **sem FK real** no banco (confirmado em `data-quality.ts:99-101`, que existe justamente para detectar órfãos desse campo por falta de FK).

Único ponto de escrita no código inteiro (`app/src/lib/crm/aceitar-proposta.ts:158-179`): quando uma proposta é aceita, o negócio original vira `status='ganho'` e **um segundo negócio é clonado** com `origemNegocio: "carteira"`, `status: "ativo"`, `negocioOrigemId: negocioId` (apontando pro original). Isso é o momento exato em que o CRM 2.0 já separa, na prática, "a venda que foi ganha" (negócio A, congelado em `ganho`) de "o relacionamento contínuo com o cliente" (negócio B, em `ativo`) — **exatamente a distinção Opportunity vs Lifecycle que o Kauã propôs**, só que implementada de forma implícita (2 linhas na mesma tabela `negocios`, distinguidas por `origemNegocio`) e **só no instante do Won**.

Não existe nenhum código que, mais tarde, quando o negócio B (`ativo`) sofrer um upgrade/downgrade/churn/renovação, crie um terceiro registro apontando `negocioOrigemId` de volta pra B com um evento datado — o padrão para de se aplicar exatamente no ponto em que a Fase 1 encontrou o problema (121 negócios ganhos sem reflexo do que aconteceu depois). `grep` confirma: `negocioOrigemId` só é escrito nessa 1 linha do código inteiro.

### 3.4 `oportunidades.stage`/`ganhoAt`/`perdidoAt` (CRM 2.0, ainda vazia) replica o mesmo padrão STATE-only do legado

`app/src/lib/crm/sync-domain-model.ts:187-236` (`syncOportunidadeFromNegocio`): a função lê `negocios.status` e faz `db.update(oportunidades).set({ stage: negocio.status, ganhoAt: negocio.ganhoAt, perdidoAt, ... })` — é uma tradução 1:1 de STATE para STATE, sem introduzir nenhum registro de EVENT novo. Quando o CRM 2.0 assumir de fato (F8), a estrutura nova herdará a mesma limitação: se nada mudar até lá, `oportunidades` também não vai ter onde guardar Upgrade/Downgrade/Renewal/Churn/Reactivation como fatos separados — só vai renomear o mesmo formato.

### 3.5 `status_changes` é deletado em cascata quando a entidade é apagada — não é imutável de forma independente

`app/src/api-server/routes/negocios.ts:749`: `await db.delete(statusChanges).where(eq(statusChanges.negocioId, id));` (dentro do handler de `DELETE /negocios/:id`). Mesmo padrão em `app/src/api-server/routes/leads.ts:1103` e `:1124`. Isso é esperado do ponto de vista de integridade referencial (não dá pra manter uma FK pra um negócio que não existe mais), mas do ponto de vista de "fato histórico que já aconteceu, não deveria ser sobrescrito/apagado" (linguagem da própria síntese da Fase 1, seção 13), significa que **a história de transições de um negócio não sobrevive à exclusão do negócio** — não é uma trilha de auditoria independente da entidade viva, é um apêndice dela.

---

## 4. Validação da hipótese das 4 dimensões contra os dados reais da Fase 1

A pergunta: os 121 negócios "ganho com evento posterior" e os 244 registros de evento do Zoho **exigem** 4 conceitos distintos (Opportunity / Contract / Lifecycle / Event), ou menos dimensões bastariam?

**Evidência a favor de Opportunity ≠ Event (separação forte, confirmada pelos dados):**
Os 3 casos com "Evento < ganho_at" (Fase 1, §1.4, tabela de validação cronológica) são a prova direta de por que Opportunity precisa ficar congelada: em 118/121 casos (97,5%) o evento comercial (churn/upgrade/downgrade/renovação/migração) aconteceu **depois** do `ganho_at` do negócio original. Se o schema atual sobrescrevesse `negocios.status` do negócio original para refletir o evento (em vez de tratar como fato novo), a pergunta "quando esse negócio foi ganho" ficaria irrespondível de forma limpa — e é exatamente essa pergunta que a Fase 1 conseguiu responder porque `ganhoAt` nunca foi tocado depois. Os casos LOGITHINK e Vetlog (síntese, seção 12) mostram isso na prática: o negócio inicial "ganho" precisa continuar existindo como fato imutável mesmo depois do churn — Opportunity ≠ Event está confirmado pelos dados, não é só teoria.

**Evidência de que Contract e Lifecycle, hoje, colapsam praticamente na mesma coisa — o dado real não distingue as duas dimensões com força:**
- O clone feito em `aceitar-proposta.ts:158-179` (negócio B, `status='ativo'`, `origemNegocio='carteira'`) já é, na prática, "Lifecycle: Cliente Ativo" — mas ele **não referencia `contratoId`** diretamente, e não há um segundo objeto "Lifecycle" separado do "Contract" com estado próprio. O único lugar que hoje distingue estados pós-venda por nome (`ativo | pausado | concluido | churned | cancelado | renovado | pendente_assinatura`) é `contratos.status` — que é, ao mesmo tempo, "estado do contrato" (documento/termos) e "estado do relacionamento com o cliente" (o CRM usa esse mesmo campo pra saber se o cliente está ativo ou não, ver `carteira.ts:16-17,101` e `relatorios.ts` várias linhas usando `eq(contratos.status, "ativo")` como proxy de "cliente ativo").
- Os 52 negócios "Closed Won→status='ativo'" do Zoho (Fase 1, §2.2) e o campo dormente `clientes.statusFinanceiro` (`ativo | inadimplente | churned`) apontam pra 3 lugares diferentes tentando expressar a mesma ideia de "está o cliente ativo agora" — sem um deles ter se consolidado como autoridade única. Isso é sintoma de que a distinção Contract/Lifecycle ainda não tem um caso de uso onde os dois discordam de verdade nos dados levantados até agora (ex: um cliente com contrato `ativo` mas lifecycle `em risco/inadimplente sem estar formalmente churned` — esse cenário É plausível no negócio real da Callface, dado que existe `faturas` com aging e fila de cobrança, mas a Fase 1 não isolou nenhum caso concreto onde isso já aconteceu e o dado ficou ambíguo por causa da falta dessa separação).
- **Leitura honesta**: a separação Contract vs Lifecycle é defensável conceitualmente (um cliente pode ter múltiplos contratos ao longo do tempo — ex.: contrato PABX + contrato AI simultâneos, achado real do CRM ter `contratos.produto: "ai" | "pabx"` — e o Lifecycle é do cliente, não de um contrato específico), mas **os 121+244 casos da Fase 1 não são, por si só, prova de que seria insuficiente colapsar as duas**. O que os dados provam com força é a separação **Opportunity vs Event**; a separação **Contract vs Lifecycle** é mais uma antecipação de escala (múltiplos contratos por cliente, característica real do produto Callface com AI+PABX) do que algo os 365 casos analisados tenham exigido diretamente.

**Evidência de que Event como conceito de 1ª classe é o gap mais urgente e mais bem suportado pelos dados:**
Os 244 registros do Zoho e os 121 negócios "ganho" sem reflexo são, ambos, evidência direta de ausência de um catálogo de eventos — não de ausência de estados. O problema nunca foi "o negócio está no estado errado" (ele está congelado corretamente em `ganho`, o que é certo); o problema é que **não existe nenhuma linha em nenhuma tabela dizendo "em 15/03/2026 este cliente fez upgrade de R$400/mês"**. As 5 tabelas candidatas a Event no schema atual (`status_changes`, `event_outbox`, `comercial_evidencia`, `mrr_movimentos`, `audit_log`) cobrem tudo, exceto exatamente esse vocabulário — reforça que "Event" é a dimensão com maior retorno imediato de ser formalizada primeiro, e é a que tem evidência mais direta e quantificada (244 casos reais) apoiando a decisão.

**Conclusão da validação**: a hipótese das 4 dimensões não é refutada pelos dados — mas a evidência quantificada da Fase 1 sustenta com força *2 das 4* separações (Opportunity≠Event, e implicitamente Opportunity≠Contract, já que negócio "ganho" e contrato "renovado/churned" já são hoje tabelas diferentes por acidente de arquitetura, não por decisão consciente de Lifecycle). A separação Contract≠Lifecycle é coerente com a realidade do produto (multi-contrato por cliente), mas não tem, nos relatórios da Fase 1, um caso concreto onde colapsá-las teria produzido um erro observado — é um argumento de desenho para o futuro, não uma correção de um sintoma já medido.

---

## 5. Existe hoje lugar estrutural para um Evento de lifecycle, datado e append-only, separado do estado mutável?

**Resposta direta: não, para o vocabulário específico Won/Upgrade/Downgrade/Renewal/Churn/Reactivation ligado a uma Opportunity/Contract. Existem 4 peças append-only reais no schema, cada uma cobrindo uma fração adjacente do problema, nenhuma cobrindo o vocabulário completo:**

1. **`status_changes`** — é o candidato mais próximo em espírito (fato datado, `deStatus→paraStatus`, só INSERT+SELECT no código de rotina). **Por que não é suficiente hoje**: (a) só registra transições dentro do vocabulário de `negocios.status`/`leads.status`, que não tem valores para Upgrade/Downgrade/Renewal/Churn/Reactivation — logo estruturalmente não tem ONDE guardar esse fato mesmo que quisesse; (b) é apagado em cascata quando o negócio/lead é excluído (`negocios.ts:749`, `leads.ts:1103,1124`) — não é uma trilha independente da entidade viva; (c) não tem `entityType`/`eventType` — é rígido em `negocioId`/`leadId`, não generalizável para "isto foi um evento de Churn do CLIENTE X", que pode não ter um `negocioId` específico associado (o cliente pode ter churnado sem que nenhum negócio específico "perca" — o conceito certo seria vinculado a `clientes`/`contratos`, tabelas que `status_changes` não referencia).
2. **`event_outbox`** — tem a forma certa (payload jsonb livre, `eventType` livre, nunca deletado, datado) e já teria onde caber um `eventType: "Churn"` sem migração de schema. **Por que não é suficiente hoje**: nenhuma rota emite esse vocabulário (confirmado por grep — só `DealWon`/`DealLost`/`StageChanged`/etc.), e sua função é orquestração assíncrona (fan-out pra workers), não consulta — não há endpoint que leia "todos os eventos de um negócio" como timeline; seria preciso construir essa leitura, e ninguém verificou se linhas processadas ficam retidas indefinidamente ou se há política de retenção/purge fora do código da aplicação (ex: rotina de banco).
3. **`comercial_evidencia`** — tecnicamente o exemplo mais limpo de tabela EVENT no schema (dedup real, nunca UPDATE). **Por que não é suficiente**: escopo fechado em "isto prova que o negócio foi ganho" (`tipo` só tem os 5 valores de evidência de Won) — não tem `tipo` para Upgrade/Downgrade/Renewal/Churn, e o próprio nome/proposito (ADR-EXEC-012) é sobre o gate de Won, não sobre lifecycle pós-venda.
4. **`mrr_movimentos`** — já tem `churn`/`reativacao`/`expansao`/`contracao` como vocabulário de EVENTO, é append-only confirmado, e é datado (`ocorridoEm`). **Por que não é suficiente**: (a) só é alimentado pelo diff automático do `stripe-sync.ts` — não tem escrita para os casos PABX/manuais que a própria Fase 1 identificou como maioria dos 121 casos legado (a Fase 1 e o ADR-EXEC-002 já registraram que PBX fatura fora do Stripe); (b) não referencia `negocioId`/`oportunidadeId` — só `assinaturaId`/`contratoId`/`leadId` — logo não dá pra responder "qual Opportunity original gerou este evento de churn", que é exatamente a pergunta que os 244 registros do Zoho respondiam via `Oportunidade Origem`.

**Síntese da resposta**: o Kauã já tem, sem saber formalmente, os 4 blocos de construção certos espalhados pelo código (outbox genérico, evidência append-only, ledger de MRR append-only, transição de estágio append-only) — o gap real não é "não existe nenhuma peça técnica pra Event", é "nenhuma das peças que já existem tem o vocabulário de lifecycle comercial (Won/Upgrade/Downgrade/Renewal/Churn/Reactivation) nem está ligada de volta à Opportunity de origem da forma que os 244 registros do Zoho e os 121 negócios da Fase 1 exigiriam para reconstruir a jornada completa (o mesmo padrão manual que os casos LOGITHINK/Vetlog exigiram: juntar Oportunidade + Oportunidade Origem + Stage History + Notes + Contrato)". Formalizar isso teria menos "construir do zero" e mais "escolher qual das 4 peças existentes estende esse vocabulário, e como ela referencia Opportunity/Contract" do que o volume de tabelas no schema sugere à primeira vista.

---

## 6. Achados adicionais relevantes (fora do escopo direto das 5 perguntas, mas informam a decisão)

- **`clientes.statusFinanceiro`** está comentado no próprio schema como STATE ("cache de leitura, nunca fonte de escrita") mas não tem nenhum código que o escreva — é o candidato estrutural mais alinhado ao "Customer Lifecycle" do Kauã, e está pronto para receber essa responsabilidade sem migração de schema, só de código.
- **`negocioOrigemId`** já reproduz, sem FK real, a mesma topologia do `Oportunidade Origem` do Zoho que a Fase 1 encontrou (link entre negócio-evento e negócio-original) — mas hoje só é usado 1x, no clone automático de pós-venda no momento do Won. Estender esse mesmo padrão (negócio novo, `negocioOrigemId` apontando pro anterior, `origemNegocio` descrevendo o tipo) para os casos de upgrade/downgrade/churn/renovação seria continuar uma linha já existente no código, não introduzir um conceito novo.
- **ADR-EXEC-007** (Data Governance) já define formalmente que `negocios.status` (Won/Lost) só pode ser escrito por endpoint de ação validando evidência — mas a tabela de autoridade de escrita desse ADR não cobre lifecycle pós-venda (não há linha "Customer Lifecycle" nem "Post-sale Event" nessa tabela) — é um gap de governança consistente com o gap de schema encontrado aqui.
- Nenhum dos 2 documentos de decisão pendente revisados (`ARCHITECTURE_DECISIONS.md`, `crm2-decisoes-pendentes.md`) menciona explicitamente o vocabulário Opportunity/Contract/Lifecycle/Event do Kauã — esta é, ao que a pesquisa encontrou, a primeira vez que a proposta está sendo confrontada estruturalmente contra o código real.

---

## 7. Pontos que ficam para decisão do Kauã (evidência, não veredito)

- Se `status_changes` deveria ganhar um `entityType`/`eventType` genérico (deixando de ser rígido a `negocioId`/`leadId`) ou se o caminho é um catálogo novo dedicado a lifecycle comercial, possivelmente reaproveitando a forma já validada de `comercial_evidencia` (dedup, append-only) ou de `mrr_movimentos` (vocabulário de evento já certo, só desconectado de Opportunity).
- Se `clientes.statusFinanceiro` deveria ser a STATE machine formal de Lifecycle (ativando o código que hoje só declara a coluna) ou se Lifecycle deveria virar tabela própria separada de `clientes`.
- Se a separação Contract≠Lifecycle compensa o custo de mais uma tabela agora (sem caso concreto medido na Fase 1 que a exija hoje) ou se pode nascer junto quando o primeiro caso real de conflito aparecer (ex.: contrato ativo + cliente inadimplente sem estar formalmente churned).
- Se estender `negocioOrigemId` para os casos pós-venda (upgrade/downgrade/renovação/churn), continuando o padrão já existente no código de `aceitar-proposta.ts`, é a direção certa, ou se o Kauã prefere desacoplar esse link de `negocios` e colocá-lo direto em `oportunidades`/`clientes` (schema novo) para não herdar a limitação de FK inexistente que `negocioOrigemId` tem hoje.
