# Sync DEV ← PROD 23/09/2026 — diagnóstico da divergência

## Baseline de produção (medido 23/09, dado de hoje)

```
leads            4012   (lead 1620 · contato 2098 · cliente 285 · ex-cliente 9)
negocios         1578
empresas         2221
contatos         1731
contratos         745   (ativo 597 · churned 146 · cancelado 2)
organizacoes        1
```

`sdr_status` restrito a `tipo='lead'` (soma exata 1620):

```
pending 80 · contacted 491 · qualifying 214 · qualified 201 · disqualified 580
sdr_sem_retorno 46 · sdr_sem_interesse 6 · sdr_retomar_depois 2
```

## Causa raiz 1 — o backfill lê colunas que não existem na fonte

Verificado por `information_schema` contra o banco de produção:

| coluna em `leads`        | produção |
|--------------------------|----------|
| `sdr_status`             | EXISTE   |
| `last_contact_at`        | EXISTE   |
| `responsavel_id`         | EXISTE   |
| `qualificado`            | AUSENTE  |
| `qualificado_em`         | AUSENTE  |
| `desqualificado_em`      | AUSENTE  |
| `desqualificacao_motivo` | AUSENTE  |
| `nutricao_motivo`        | AUSENTE  |
| `nutricao_retomar_em`    | AUSENTE  |
| `estagio_pre_vendas`     | AUSENTE  |
| `pessoa_id`              | AUSENTE  |

`app/src/scripts/backfill/06-aquisicao.ts` faz `SELECT l.*` e deriva todo o
estado da aquisição de `l.qualificado`, `l.qualificado_em`,
`l.desqualificado_em`, `l.nutricao_motivo` e `l.nutricao_retomar_em`. Sobre um
dump de produção essas chaves voltam `undefined`, sem erro: em JS a propriedade
ausente não lança. O resultado é que as 4012 linhas viram aquisição
`aberta, não qualificada, não desqualificada`, e os 580 disqualified, 201
qualified e 214 qualifying de `sdr_status` são descartados em silêncio.

`sdr_status` é a única verdade operacional do funil em produção, e nenhum
backfill do modelo canônico a lê.

## Causa raiz 2 — a migration 0081 herdou o erro, não o criou

`0081_etapa_da_aquisicao_tem_casa_canonica.sql` declara no cabeçalho que copia a
ordem de condições de `packages/domain/acquisition/queries/board-pre-vendas.ts`.
A migration materializou fielmente o que a query já dizia. O defeito está na
expressão de etapa, que existe nos dois lugares:

```
desqualificado_em  → desqualificado      (sempre NULL vindo de prod)
nutricao_status    → nutricao            (sempre NULL vindo de prod)
oportunidade aberta → oportunidade
qualificado        → qualificado         (sempre false vindo de prod)
last_touch > first_touch → em_contato
resto              → novo
```

O fallback **não tem nenhuma condição que produza `qualificacao`**. Só
`pe.codigo` (a etapa gravada pela 0081) pode produzi-la, e a 0081 a derivou de
`leads.estagio_pre_vendas = 'qualificacao'`, campo que nem existe na fonte. Daí
"Qualificação: 3" e "Qualificado: 1" no board.

Corrigir só a migration deixaria a query e o fallback errados. A correção tem de
ser na tradução de origem.

## Causa raiz 3 — universos diferentes

O funil de pré-vendas legado (`app/src/api-server/routes/leads.ts:250-259`)
recorta:

```
tipo = 'lead'
AND NOT (contrato ativo)
AND (origem <> 'outbound' OR qualificado)
```

O backfill 06 não recorta nada: `SELECT l.* FROM leads l`, uma aquisição por
linha, incluindo os 2098 `tipo='contato'` e os 285 `tipo='cliente'`. Daí 3989
aquisições contra 1620 leads, e daí a coluna Novo com 2915.

Clientes viram aquisição encerrada (decisão documentada, SPEC §41), o que
explica `3989 - 287 = 3702 ativos`. Os 2098 contatos, não: eles ficam abertos e
caem em Novo.

## Causa raiz 4 — paginação apresentada como total

`board-pre-vendas.ts:246`: `pos <= Math.ceil(limite / 6)` com `limite` 400 dá
**67 por coluna**. O divisor é 6 e as etapas são 7.

O contador da coluna está correto: vem de `count()` sobre a tabela
(`board-pre-vendas.ts:285-303`), não do array truncado. O defeito é só a UI não
dizer que mostra 67 de 2915.

## Tradução correta, já homologada

`app/scripts/migrate-pre-vendas-crm2.ts` carrega o De/Para aprovado pelo Kauã em
17/08, validado contra o board real, e `app/src/lib/crm/qualificacao-colunas.ts:137`
tem a função `sdrBoardColumn()` que é a verdade do board legado:

```
sdr_status = disqualified                 → disqualified
negócio principal em no_show              → mantém o sdr_status
tem negócio principal                     → negocioStatusToSdrMirror(status)
tem negócio (qualquer)                    → m_qualified
pending + origem outbound                 → outbound
senão                                     → o próprio sdr_status
```

De/Para para as sete etapas canônicas:

| origem (`sdrBoardColumn`)            | etapa canônica   |
|--------------------------------------|------------------|
| `pending`, `outbound`                | `novo`           |
| `contacted`                          | `em_contato`     |
| `qualifying`                         | `qualificacao`   |
| `m_qualified`, `qualified`           | `qualificado`    |
| negócio aberto no closer             | `oportunidade`   |
| `sdr_sem_interesse`, `sdr_retomar_depois` | `nutricao`  |
| `disqualified`                       | `desqualificado` |

### Ponto que precisa de decisão do Kauã

`sdr_sem_retorno` (46 leads) mapeava para a etapa `sem_resposta` do CRM2, que
**não existe** entre as sete etapas canônicas. Mapeado provisoriamente para
`nutricao` por ser estagnação e não descarte. Trocar para `desqualificado`
mudaria 46 leads de lado.

---

# Resultado da correção (23/09)

## Pré-vendas — resolvido

Correção em dois pontos, ambos na origem:

1. **`app/src/scripts/backfill/06b-estado-pre-vendas-legado.ts`** (novo). Traduz
   `sdrBoardColumn()` (sdr_status + estado do negócio) para as sete etapas
   canônicas, grava `aquisicoes.etapa_id` (a casa da SPEC §8.2, que tem
   precedência no `COALESCE`) e os fatos correspondentes (`qualificado`,
   `desqualificado_em`, `nutricao_status`), para que etapa gravada e derivação
   concordem. Aborta se o legado trouxer chave fora do De/Para, em vez de cair
   em `novo` em silêncio.
2. **`app/src/scripts/backfill/06-aquisicao.ts`**. A regra de encerramento
   passou de `tipo === 'cliente'` para "qualquer tipo que não seja `lead`",
   alinhando o universo ao recorte do board legado. Nada é apagado: a aquisição
   continua existindo com origem e datas, só sai do funil ativo.

Registrado em `scripts/rodar-backfills.sh` entre o passo 06 e o 07.

### Board canônico contra board legado, depois da correção

| etapa            | canônico | legado | origem no legado                        |
|------------------|----------|--------|-----------------------------------------|
| `novo`           | 59       | 59     | pending 22 + outbound 37                |
| `em_contato`     | 490      | 490    | contacted                               |
| `qualificacao`   | 211      | 211    | qualifying                              |
| `qualificado`    | 162      | 162    | m_qualified 63 + qualified 21 + m_reuniao 77 + m_convertido 1 |
| `nutricao`       | 54       | 54     | sem_retorno 46 + sem_interesse 6 + retomar 2 |
| `desqualificado` | 644      | 644    | disqualified                            |
| **ativos**       | **1620** | **1620** | leads `tipo='lead'` em produção        |
| total            | 4012     | 4012   | nenhuma linha perdida                   |

Antes da correção: 3727 ativos, Novo 2757, Qualificação 0, Desqualificado 0.

## Pipeline — 1 registro não migrável

| indicador           | legado | canônico |
|---------------------|--------|----------|
| negócios abertos    | 536    | 536      |
| negócios ganhos     | 604    | 604      |
| total               | 1578   | 1577     |

O registro que não migra é o negócio `INCLUDER | YESTAR | MAYRA`, status
`perdido`, **sem `empresa_id` e sem `lead_id`**. O canônico exige empresa ou
pessoa (SPEC §8.1), então ele não é representável. Não é bug de backfill: é um
registro órfão do legado.

**Rotina de migração proposta:** nenhuma automática. Um negócio perdido sem
nenhum vínculo não tem como ser reatribuído sem inventar o vínculo. Se o Kauã
quiser preservá-lo, o caminho é criar a empresa a partir do título
(`INCLUDER | YESTAR | MAYRA` parece carregar três nomes) — decisão humana, não
de script.

## Clientes — divergência aberta, mesma família

| indicador                        | valor |
|----------------------------------|-------|
| `clientes` canônicos             | 275   |
| `clientes` com `lifecycle_status` NULL | **275 de 275** |
| leads `tipo='cliente'` no legado | 285   |
| empresas com contrato ativo      | 105   |

`lifecycle_status` NULL em 100% das linhas é o mesmo padrão do pré-vendas: coluna
canônica que nenhum backfill preenche. Falta apurar de onde ela deveria vir e
por que 275 não é 285.

## Carteira — divergência aberta, mesma família

| indicador                              | valor |
|----------------------------------------|-------|
| `servicos_canonicos`                   | 439   |
| `billing_status = 'UNKNOWN'`            | **264 de 439 (60%)** |
| `portfolio_included`                   | 328   |
| assinaturas `active` no legado         | 130   |
| `billing_status = 'ACTIVE'` no canônico | 135   |

60% da carteira com billing desconhecido, e ACTIVE canônico (135) não bate com
assinaturas ativas do legado (130).

## Infraestrutura do dump

`pg_dump`/`pg_restore` não carregam a text search configuration `pt_unaccent` na
ordem certa: ela é restaurada depois da tabela `ai_knowledge_chunks`, que
depende dela, e a tabela falha silenciosamente (8 erros ignorados). Recriada à
mão no DEV a partir de `0029` + `0075`.

**Rotina proposta:** o `refresh-dev-db.sh` deveria reaplicar `0029`+`0075` ao
final, ou o restore deveria rodar com `--section` separando pre-data. Fica
anotado; não foi alterado nesta sessão para não mexer em script que funciona.

---

# Segunda rodada (23/09) — demais módulos e verificadores

## Bateria de verificação: 50 de 50 passam

Estava 47/50 depois da carga. As três falhas e o que eram:

### 1. `smoke-board-familia` — número mágico, não regressão

Travava em `depois - antes === 125`, medido numa carga antiga. Com dump fresco o
ganho é 128 e o smoke acusava regressão onde só havia dado novo. Como este
trabalho institucionaliza DEV recarregado de produção, o assert apodreceria a
cada refresh. Trocado pela identidade que ele realmente quer provar: o ganho tem
de ser exatamente o conjunto de negócios abertos sem família no legado cuja
oportunidade canônica tem família. Verdadeiro em qualquer carga.

### 2. `smoke-tela-escreve-tela-le` — a 0083 caiu na mesma armadilha da 0081

`iniciarTrial` recusava toda oportunidade Callface AI com `trial_exige_oferta`.
A causa: a migration `0083` liga `permite_trial` nas ofertas CALLFACE_AI lendo os
pipelines configurados, mas roda na cadeia de migrations, quando
`ofertas_comerciais` ainda está vazia — é o backfill 08 que a cria. O UPDATE
tocava zero linhas e as quatro ofertas nasciam com o default `false`.

Prova de que não era regra, e sim ordem: o legado tem **19 negócios em trial** e o
canônico preservou os 19, mas **nenhuma oferta permitia trial**.

Corrigido no passo 16 (`16-materializacao-canonica.ts`), que existe exatamente
para reaplicar materializações que rodaram cedo demais e já cobria 0081/0084/0085.
Bloco 4 novo, com a mesma condição da migration. Resultado: CALLFACE_AI_DIRECT e
CALLFACE_AI_CONTRACT passam a permitir trial; PABX e WHITE_LABEL seguem `false`,
que é a regra correta (venda por contrato).

### 3. `checar-env` — `ATUALIZAR_CATRACA` não documentada

Variável lida por `cor-tem-nome.test.ts` e ausente do `.env.example`. Documentada.

## "Empresa não informada" com empresa no banco — corrigido

Medido: **576 dos 1.620 cards ativos** sem nome de empresa. Destes, **467 têm o
nome gravado em `leads.empresa`**.

Causa: a query canônica lê só `e.nome` (a entidade), e a entidade não existe para
esses leads porque o nome veio de formulário e nunca virou linha em `empresas`.
O board **legado** nunca teve esse problema, porque usa outra precedência
(`api-server/routes/leads.ts:439`):

```js
const empresaNome = l.empresa || (l.empresaId ? empresaNomes[l.empresaId] : null) || null;
```

O texto vem primeiro, a entidade depois. O canônico regrediu.

Corrigido em `board-pre-vendas.ts` com a mesma precedência do legado, na
expressão do card e também na busca (senão buscar pelo nome que o card mostra não
acharia o card). **576 → 109.** Os 109 restantes não têm nem texto nem entidade:
ali "Empresa não informada" é a verdade.

### O que NÃO foi feito, de propósito

Criar entidade `empresas` para os 457 nomes soltos. A amostra mostra que boa
parte é ramo de atividade digitado em formulário ("Venda de Alimentos",
"Escritório De Advocacia", "Autônomo"), e a base já foi poluída assim antes: o
join por nome casa com empresas chamadas "Autônomo", "Por conta própria" e
"Correspondente bancário", que existem como entidade por engano de uma carga
anterior. Vincular a elas propagaria lixo. É decisão do Kauã.

## Paginação "67 de N" — já estava implementada

O item foi verificado com a consulta real, não por leitura de código.
`Quadro.tsx:211` e o `renderMedida` de `PreVendas.tsx:477` já escrevem
`${itens.length} de ${coluna.total}`, e o total vem do agregado. Hoje a tela
mostra "67 de 490", "67 de 644". Nada a corrigir.

## Board mostrava universo errado — corrigido na leitura

Ao conferir o "67 de N" apareceu que a soma das colunas dava **4012**, o total de
aquisições, e não 1620. Causa: `incluirEncerradas: aba !== "ativos"`, com o
comentário "Nutrição e desqualificado vivem em aquisição encerrada". Com o
recorte de funil novo, as 2.392 aquisições fora do funil (contatos, clientes)
voltavam pela mesma porta e caíam em Novo.

A condição estava larga demais. Trocada por "incluir as SAÍDAS do funil", que é o
que o Kanban único precisa:

```sql
a.closed_at IS NULL OR a.desqualificado_em IS NOT NULL
  OR COALESCE(a.nutricao_status, '') <> ''
```

Aplicada nos dois pontos da consulta (cards e totais), que precisam concordar.

## Precedência de Oportunidade

Com o De/Para de 17/08 puro, a coluna Oportunidade ficava permanentemente em
zero: o board legado não tem essa coluna, e lá `m_qualified`/`m_reuniao` moram em
"Qualificado (SQL)" e "Agenda Confirmada". O Kanban único do Documento Mestre
v0.13 tem as sete. Aplicada no 06b a precedência que a expressão de etapa já
declara — negócio aberto vence qualificação. A soma não muda: os 162 viram **141
oportunidade + 21 qualificado**, e os 21 são exatamente os SQL sem negócio.

### Board final, conferido pela consulta da tela

| etapa | total | o que a UI escreve |
|---|---|---|
| novo | 59 | 59 |
| em_contato | 490 | 67 de 490 |
| qualificacao | 211 | 67 de 211 |
| qualificado | 21 | 21 |
| oportunidade | 141 | 67 de 141 |
| nutricao | 54 | 54 |
| desqualificado | 644 | 67 de 644 |
| **soma** | **1620** | |

Resumo coerente: 922 ativos + 54 nutrição + 644 desqualificados = 1620.

## Clientes — NÃO era divergência

`clientes.lifecycle_status` está NULL em 275 de 275, mas a coluna não tem leitor
nem escritor em lugar nenhum do código (só `schema.ts` e a migration 0065). Não
afeta tela: é coluna órfã.

E 275 contra 285 era comparação de universos diferentes: `clientes` é criada
**por empresa** (`GROUP BY empresa_id`, migrations 0039/0041), enquanto
`leads.tipo='cliente'` são pessoas — 285 pessoas em 199 empresas, mais 73 sem
empresa. O número comparável é 272 empresas com serviço no portfólio contra 275
clientes; a diferença são os CHURNED que a 0041 inclui de propósito.

## Carteira — divergência REAL, aguardando decisão

`servicos_canonicos.billing_status` é escrito **uma vez**, no momento do Won
(`lib/crm/servico-canonico.ts:51`, `isMrr ? "ACTIVE" : "BILLED"`), e **nenhuma
rotina o atualiza depois**. A assinatura continua evoluindo no Stripe e o espelho
da carteira fica parado no dia da venda.

Dos 135 serviços marcados ACTIVE: 83 com assinatura de fato `active`, **22
`canceled`, 21 `unpaid`, 8 `past_due`**, 1 `trialing`.

Rotina proposta e escrita: `app/src/scripts/reconciliar-billing-carteira.ts`.
Dry-run por padrão. O que ela encontra hoje, em 144 serviços com assinatura:

| n | transição | MRR |
|---|---|---|
| 22 | ACTIVE → CANCELED (stripe canceled) | 7.341,10 |
| 21 | ACTIVE → PAST_DUE (stripe unpaid) | 6.295,50 |
| 8 | ACTIVE → PAST_DUE (stripe past_due) | 2.848,50 |
| 5 | ACTIVE_CANCEL_SCHEDULED → CANCELED | 2.069,20 |
| 1 | PAST_DUE_CANCEL_SCHEDULED → CANCELED | 89,90 |
| 1 | PAST_DUE → CANCELED | 1.032,50 |
| 1 | SUPERSEDED → PAST_DUE | 0,00 |
| 1 | PAST_DUE → ACTIVE (subnotificado) | 89,90 |

**60 divergentes. Cerca de R$ 16,5 mil de MRR anunciado como ativo sobre
assinatura cancelada ou não paga.**

**NÃO aplicado.** Carteira é número de receita: mudar 60 linhas dela é decisão do
Kauã. O script está pronto e roda com `--aplicar` quando ele aprovar.

`billing_status = UNKNOWN` em 264 de 439 **não** é defeito: são 253 de
`LEDGER_JULHO`, 10 MANUAL e 1 WEVY, todos sem assinatura Stripe. Sem fonte de
cobrança, UNKNOWN é a resposta honesta.

---

# Execução no ambiente remoto (23/09)

Autorizado pelo Scott em sessão. Feito por SSH em `ubuntu@34.204.200.52`,
domínio `dev.crm.callface.io`.

## Como foi rodado

O container `callface-crm2-dev-api` é build de produção: não tem `src/` nem
`tsconfig.json`. Rodar os backfills exigiu um container efêmero que empresta as
dependências da imagem e monta o fonte do host:

```bash
docker run --rm --network crm2dev-network \
  -v /opt/callface/crm2-dev/app/src:/repo/app/src \
  -v /opt/callface/crm2-dev/app/tsconfig.json:/repo/app/tsconfig.json \
  --env-file /opt/callface/crm2-dev/.env \
  -w /repo/app crm2-dev-api \
  node --import tsx src/scripts/backfill/<passo>.ts --aplicar
```

O `--env-file` evita materializar a senha do banco: ela nunca sai do `.env`.

## Resultado

| passo | resultado |
|---|---|
| migration `0090_meta_staging_idempotente` | aplicada (era a única pendente) |
| backfill `06b` | 1597 aquisições com etapa do funil legado |
| recorte de funil | 2105 aquisições `tipo <> 'lead'` encerradas |
| backfill `16` | reconciliação verde: estagnações 227=227, trials 17=17 |

Contagem no banco remoto, depois:

| etapa | total |
|---|---|
| novo | 59 |
| em_contato | 485 |
| qualificacao | 198 |
| qualificado | 22 |
| oportunidade | 144 |
| nutricao | 54 |
| desqualificado | 635 |
| **no funil** | **1597** (era 3702) |
| total | 3989 (nada perdido) |

Os 1597 são exatamente os leads `tipo='lead'` que o funil legado audita — o
mesmo número que aparece no enunciado do problema.

## O que falta no remoto: um rebuild

`packages/domain/acquisition/queries/board-pre-vendas.ts` foi copiado, mas a
imagem do app ainda carrega a versão antiga. O DADO está correto; a LEITURA não.

Com a query antiga (`incluirEncerradas` = `TRUE`), o board mostra as 3989 e a
coluna Novo volta a 2126, porque as 2105 fora do funil entram pela mesma porta.

```bash
cd /opt/callface/crm2-dev && docker compose -p crm2-dev build app && docker compose -p crm2-dev up -d app
```

Não executado: o classifier recusou com "Interfere With Workloads", e a razão
procede — o build disputa os 2 vCPU da EC2 com o `callface-crm-app` de produção,
que está de pé há 5 dias no mesmo host. Rodar fora do horário comercial.

O mesmo vale para o serviço `api`, que serve a mesma consulta pelo Hono.

## Carteira: aplicada no DEV local

`reconciliar-billing-carteira.ts --aplicar` rodou no Postgres local: **60
serviços reconciliados**. `billing_status` deixou de ser o retrato do dia do Won
e passou a refletir a assinatura. Não aplicado em produção nem no dev remoto.
