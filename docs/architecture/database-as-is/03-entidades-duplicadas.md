# 03. Entidades duplicadas (AS-IS)

Levantamento somente leitura do banco `callface_crm` local, carregado com os dados
de producao de 20/09/2026. Este documento **descreve** conceitos de negocio que
existem em mais de uma tabela. Nao recomenda consolidacao, nao elege tabela
vencedora e nao propoe arquitetura.

## Metodo e fontes

| Fonte | Uso |
|---|---|
| `_raw/tabelas-contagem-exata.txt` | numero exato de linhas de cada tabela |
| `_raw/foreign-keys.txt` | FK declarada entre as tabelas |
| `_raw/primary-keys.txt`, `_raw/indices.txt`, `_raw/constraints.txt` | chaves e indices parciais/unicos |
| `app/src/lib/db/schema.ts` (4237 linhas) | comentarios de ADR, marcas de legado e de dual-write |
| `app/src/lib/db/migrations/*.sql` | migration que criou cada tabela |
| `app/src/` (grep) | quem escreve e quem le cada tabela |
| `psql -U callface -d callface_crm` (SELECT) | contagens derivadas citadas no texto |

Toda contagem citada vem de um dos dois primeiros itens ou de uma query `SELECT`
reproduzida no texto. Onde nao houve evidencia, esta escrito **NAO CONFIRMADO**.

Contexto estrutural que atravessa todas as secoes: existe **1 linha** em
`organizacoes` (`tabelas-contagem-exata.txt`), e `organizacoes` e o alvo de 120
das 423 foreign keys do banco (`_raw/mais-referenciadas.txt`, linha 1). O
comentario do schema a define como tenant: `schema.ts:18`, secao
`ORGANIZACOES (TENANTS)`. Portanto `organizacoes` **nao** e uma representacao
duplicada de "empresa/conta"; e a coluna de multi-tenancy. Ela aparece neste
documento apenas nesta nota.

Marcacao de fase presente no schema (usada como evidencia repetidamente):

- `schema.ts:3380-3388`: "CRM 2.0 - FASE 1 (Domain Model): pessoas, oportunidades,
  clientes, pontos_contato. Schema V2 em paralelo ao legado (ADR-EXEC-003) -
  `leads`/`negocios`/`contatos` continuam vivos e sao a fonte de verdade em
  producao durante a transicao (dual-write, cutover so na F8)."
- `schema.ts:2655-2660`: "CRM 2.0 - FASE 2 (Communication Intelligence):
  communications, ai_analysis. Schema V2 em paralelo (ADR-EXEC-003) -
  ligacoes/whatsapp_mensagens/emails continuam vivos, dual-write igual ao padrao
  de F1."

---

## 1. Pessoa

### Tabelas envolvidas

| Tabela | Linhas |
|---|---|
| `leads` | 3989 |
| `contatos` | 1663 |
| `pessoas` | 0 |
| `pontos_contato` | 0 |
| `pessoa_empresa_vinculos` | 0 |

Fonte: `_raw/tabelas-contagem-exata.txt`.

### Relacao entre elas

FK declarada (`_raw/foreign-keys.txt`):

| Origem | Coluna | Destino | Constraint | On delete |
|---|---|---|---|---|
| `contatos` | `lead_id` | `leads.id` | `contatos_lead_id_leads_id_fk` | NO ACTION |
| `pessoas` | `lead_id_legado` | `leads.id` | `pessoas_lead_id_legado_fkey` | NO ACTION |
| `pontos_contato` | `lead_id_legado` | `leads.id` | `pontos_contato_lead_id_legado_fkey` | NO ACTION |
| `pessoa_empresa_vinculos` | `pessoa_id` | `pessoas.id` | `pessoa_empresa_vinculos_pessoa_id_fkey` | CASCADE |

A direcao e sempre a mesma: o modelo novo aponta para `leads`, nunca o contrario.
`leads` nao tem nenhuma coluna apontando para `pessoas` ou `contatos`.

`pessoas.lead_id_legado` tem indice UNICO (`idx_pessoas_lead_legado`,
`schema.ts:3417`), e `pontos_contato.lead_id_legado` tem unico parcial
`WHERE lead_id_legado IS NOT NULL` (`schema.ts:3457`). Ou seja: a relacao
pretendida e 1:1 entre Lead legado e Pessoa nova.

Preenchimento real da ponte `contatos` -> `leads`:

```sql
SELECT count(*) FROM contatos WHERE lead_id IS NOT NULL;  -- 13
SELECT count(*) FROM contatos;                             -- 1663
```

13 de 1663 contatos tem vinculo com um lead. Os outros 1650 sao identidades de
canal sem ligacao declarada com o CRM.

### Ha dual-write?

Sim, em codigo, e documentado como tal.

- `app/src/lib/crm/sync-domain-model.ts:1-12` declara o proposito: "F1 (Domain
  Model) - sincronizacao incremental legado -> schema novo (...) usada pelas
  rotas reais (dual-write) (...) o legado continua sendo a fonte de verdade ate
  a F8."
- `sync-domain-model.ts:111` insere em `pessoas`; `:138` insere em
  `pontos_contato`; `:164` insere em `clientes`.
- A funcao e falha-silenciosa por design: `sync-domain-model.ts:30-45`
  (`logFalhaSync`) captura o erro, grava em `audit_log` com
  `action = "domain_model_sync.failed"` e segue.

Chamadores de `syncPessoaFromLead` (grep em `app/src`):

| Arquivo | Linha |
|---|---|
| `api-server/routes/leads.ts` | 658, 1151 |
| `api-server/routes/contatos-unified.ts` | 172 |
| `api-server/routes/contatos.ts` | 172, 247 |
| `api-server/routes/apollo.ts` | 220 |
| `app/api/webhooks/site-lead/route.ts` | 179 |
| `app/api/webhooks/rd-lead/route.ts` | 247, 324 |
| `lib/crm/converter-oportunidade.ts` | 295 |

Existe tambem um caminho de escrita direta em `pessoas` fora do sync:
`lib/vendas/identidade.ts:267` (`INSERT INTO pessoas`), `:337`
(`INSERT INTO pessoa_empresa_vinculos`), `:416` (`INSERT INTO pontos_contato`).

Fato do banco que contradiz o codigo: apesar de 8 pontos de chamada em rotas de
producao, `pessoas`, `pontos_contato` e `pessoa_empresa_vinculos` estao com **0
linhas**. Existe escritor, nao existe dado. Por que zero: **NAO CONFIRMADO**.

### Alguma parece legado?

`leads` e o legado declarado, nao por nome de tabela mas por como as outras se
referem a ela:

- coluna `pessoas.lead_id_legado`, `pontos_contato.lead_id_legado`,
  `clientes.lead_id_legado` (`_raw/colunas.txt`, e FK correspondentes em
  `_raw/foreign-keys.txt`);
- `schema.ts:3390-3395` (bloco acima de `pessoas`): "Resolve os 2 conceitos de
  'Contato' hoje desconectados (`leads.tipo` vs tabela `contatos` de canal).
  Pessoa e o registro permanente; Lead e so o estagio transitorio de
  qualificacao";
- `schema.ts:202`: `empresa: text("empresa"), // legacy text field, prefer empresaId`;
- `schema.ts:320-339`: bloco `crm2PreVendasStage` / `crm2MigradoEm`, descrito
  como "Taxonomia nova de Pre-vendas do CRM2 (17/08) - ADITIVO, nunca substitui"
  e "Populado 1x via backfill (scripts/migrate-pre-vendas-crm2.ts) a partir da
  coluna REAL do board legado (sdrBoardColumn)".

`pessoas` parece V2/canonica: criada em
`app/src/lib/db/migrations/0012_reconciliation_and_crm2_domain_model.sql:478`,
sob o comentario de ADR-EXEC-003 citado acima. `schema.ts:3385-3388` diz o nome
foi escolhido "deliberadamente diferentes do legado pra nunca precisar renomear
tabela depois: quando o legado for descomissionado (F8), estas ja tem o nome
final."

`contatos` nao e legado nem V2 do mesmo eixo: `schema.ts:1918-1919` a descreve
como "entidade canonica do canal" (inbox WhatsApp/e-mail). Ela dobra `leads` no
que diz respeito a nome/telefone/e-mail, mas o proposito declarado e outro.

### Qual a UI realmente usa

A tela `/contatos` do produto (grupo de rotas `(crm2)`) le as **duas**, com
anti-join, e mostra o lead quando nao existe pessoa correspondente:

`app/src/lib/vendas/consultas.ts:737-775`, funcao `diretorioPessoas`:

```
FROM pessoas p ...
UNION ALL
FROM leads l ...
 WHERE ... AND NOT EXISTS (SELECT 1 FROM pessoas p WHERE p.lead_id_legado = l.id)
```

O comentario acima da funcao (`consultas.ts:728-736`) chama isso de
"compatibilidade de leitura (...) enquanto entradas novas nascem nos dois lados".

A mesma logica em `pessoaPorId` (`consultas.ts:778-801`), e a pagina de detalhe
ramifica por `pessoa.fonte`:
`app/(crm2)/contatos/pessoas/[id]/page.tsx:15-16`.

Como `pessoas` tem 0 linhas, 100% do que a tela `/contatos` exibe hoje na aba
Pessoas vem de `leads`.

A tela de inbox `(crm2)/atendimento` usa `contatos`
(`api-server/routes/atendimento.ts`), e a lista unificada
`api-server/routes/contatos-unified.ts:29-31` filtra `leads.tipo` em
`contato | lead | cliente`, ou seja, le `leads`, nao `contatos`.

Distribuicao de `leads.tipo`:

```sql
SELECT tipo, count(*) FROM leads GROUP BY tipo;
```

| tipo | linhas |
|---|---|
| `contato` | 2098 |
| `lead` | 1597 |
| `cliente` | 287 |
| `ex-cliente` | 7 |

Isto e: "Contato", "Lead" e "Cliente" sao, em producao, **valores de coluna na
mesma tabela `leads`**, alem de existirem como tabelas proprias (`contatos`,
`leads`, `clientes`).

---

## 2. Empresa / Conta

### Tabelas envolvidas

| Tabela | Linhas |
|---|---|
| `empresas` | 2199 |
| `clientes` | 275 |
| `billing_identities` | 224 |
| `leads` (coluna `empresa` texto + `empresa_id`) | 3989 |

Fonte: `_raw/tabelas-contagem-exata.txt`.

### Relacao entre elas

| Origem | Coluna | Destino | Delete rule |
|---|---|---|---|
| `clientes` | `empresa_id` | `empresas.id` | NO ACTION |
| `clientes` | `pessoa_principal_id` | `pessoas.id` | NO ACTION |
| `clientes` | `lead_id_legado` | `leads.id` | NO ACTION |
| `clientes` | `oportunidade_origem_id` | `oportunidades.id` | NO ACTION |
| `empresas` | `canonical_empresa_id` | `empresas.id` (auto-referencia) | SET NULL |
| `leads` | `empresa_id` | `empresas.id` | NO ACTION |
| `billing_identities` | `canonical_empresa_id` | `empresas.id` | SET NULL |
| `billing_identities` | `empresa_id` | `empresas.id` | SET NULL |

Fonte: `_raw/foreign-keys.txt`.

`empresas` e a 4a tabela mais referenciada do banco, com 26 FKs entrando
(`_raw/mais-referenciadas.txt`, linha 4).

Estado de preenchimento:

```sql
SELECT count(*) FROM clientes WHERE empresa_id IS NOT NULL;          -- 275
SELECT count(*) FROM clientes WHERE pessoa_principal_id IS NOT NULL; -- 0
SELECT count(*) FROM clientes WHERE lead_id_legado IS NOT NULL;      -- 0
SELECT count(*) FROM empresas WHERE canonical_empresa_id IS NOT NULL; -- 4
SELECT count(*) FROM leads WHERE empresa_id IS NOT NULL;             -- 2348
SELECT count(*) FROM leads WHERE empresa IS NOT NULL AND empresa <> ''; -- 2760
```

Ou seja: `clientes` existe com 275 linhas, todas ligadas a `empresas`, e **nenhuma**
ligada a `pessoas` ou ao lead de origem. E o nome da empresa existe em duas formas
dentro de `leads`: FK (`empresa_id`, 2348) e texto livre (`empresa`, 2760).

### Ha dual-write?

Sim, para `clientes`, por tres caminhos distintos:

| Arquivo | Linha | Contexto |
|---|---|---|
| `lib/crm/sync-domain-model.ts` | 164 | dentro de `syncPessoaFromLead`, quando `lead.tipo === "cliente"` |
| `lib/cs/handoff.ts` | 92 | handoff comercial -> CS |
| `api-server/routes/clientes-crm2.ts` | 526 | troca de responsavel cria a linha se nao existir |
| `lib/db/backfill-domain-model.ts` | 142 | backfill em lote |

Existe conflito conhecido entre dois desses escritores, registrado no proprio
codigo: `lib/cs/handoff.ts:83` diz "Achado 14/09: `syncPessoaFromLead` tambem
cria linha em `clientes`". E `schema.ts:3606-3610` documenta que o indice unico
`idx_clientes_org_empresa` e parcial (`WHERE empresa_id IS NOT NULL`) e que isso
"escondia a razao de `onConflictDoNothing` falhar em lib/cs/handoff.ts".

Para `billing_identities` nao ha dual-write com `empresas`; ha **duas modelagens
convivendo na mesma tabela**. `schema.ts:3185-3190`:

> "CONVERGIDA no merge de 20/09. Os dois lados modelavam a mesma tabela de formas
> diferentes e o banco carregado de producao tem as colunas dos DOIS:
> dev -> canonical_empresa_id/canonical_lead_id + provider + external_customer_id;
> prod -> empresa_id/lead_id + canonical_stripe_customer_id + cnpj/email
> normalizados. (...) Unificar os dois modelos num so e decisao de produto, ainda
> em aberto."

Ambos os pares estao preenchidos com o mesmo numero de linhas:

```sql
SELECT count(*) FROM billing_identities WHERE canonical_empresa_id IS NOT NULL; -- 166
SELECT count(*) FROM billing_identities WHERE empresa_id IS NOT NULL;           -- 166
```

Se sao as mesmas 166 linhas ou dois conjuntos distintos: **NAO CONFIRMADO**
(nao foi rodada a query de interseccao).

### Alguma parece legado? Alguma parece V2/canonica?

- `clientes` e V2: criada em
  `migrations/0012_reconciliation_and_crm2_domain_model.sql:581`, sob o bloco
  ADR-EXEC-003. `schema.ts:3569-3573`: "Hoje 'cliente' e so `leads.tipo =
  'cliente'` no mesmo registro do Lead. Cliente passa a ser entidade propria".
- `empresas.canonical_empresa_id` e mecanismo de deduplicacao, nao de versao:
  `schema.ts:166-168` "Identidade canonica (reconciliacao v1.1) - resolve
  duplicidade de empresa (mesmo CNPJ importado 2x do Zoho) (...) nunca merge
  destrutivo."
- `leads.empresa` (texto) e marcado como legado no proprio schema
  (`schema.ts:202`).

### Qual a UI realmente usa

Duas telas diferentes, com fontes diferentes:

- `/contatos` (aba Empresas): `lib/vendas/consultas.ts:587-676`
  (`diretorioEmpresas`) le `FROM empresas e` e **deriva** o relacionamento
  (`cliente` / `em_oportunidade` / `em_pre_vendas`) por subqueries sobre
  `servicos_canonicos`, `negocios` e `leads`. `consultas.ts:610` faz um
  `LEFT JOIN`-equivalente em `clientes` apenas para pegar o nome do responsavel
  de CS.
- `/clientes` (grupo `(crm2)`): `app/(crm2)/clientes/page.tsx` renderiza
  `Cf2ClientesWorkspace`, servido por `api-server/routes/clientes-crm2.ts`, que
  le `clientes` em `:519`, `:1048`, `:1491`.

---

## 3. Venda / Oportunidade

### Tabelas envolvidas

| Tabela | Linhas |
|---|---|
| `negocios` | 1562 |
| `negocio_leads` | 1199 |
| `oportunidades` | 0 |
| `oportunidade_bundle` | 0 |
| `oportunidade_itens` | 0 |
| `propostas` | 1550 |
| `contratos` | 742 |

Fonte: `_raw/tabelas-contagem-exata.txt`.

### Relacao entre elas

| Origem | Coluna | Destino | Delete rule |
|---|---|---|---|
| `oportunidades` | `negocio_id_legado` | `negocios.id` | NO ACTION |
| `oportunidades` | `pessoa_id` | `pessoas.id` | NO ACTION |
| `oportunidades` | `lead_id` | `leads.id` | NO ACTION |
| `oportunidades` | `bundle_id` | `oportunidade_bundle.id` | NO ACTION |
| `negocios` | `bundle_id` | `oportunidade_bundle.id` | NO ACTION |
| `negocios` | `lead_id` | `leads.id` | NO ACTION |
| `negocio_leads` | `negocio_id` / `lead_id` | `negocios.id` / `leads.id` | CASCADE |
| `contratos` | `negocio_id` | `negocios.id` | NO ACTION |
| `propostas` | `negocio_id` | `negocios.id` | NO ACTION |

Fonte: `_raw/foreign-keys.txt`. `oportunidades.negocio_id_legado` tem indice
unico `idx_oportunidades_negocio_legado` (`schema.ts:3517`).

Repare que `negocios` e `oportunidades` apontam ambas para o **mesmo**
`oportunidade_bundle`. `schema.ts:3498-3499` explica: "Commercial Core v3
(ADR-EXEC-022) - espelha negocios.bundleId (dual-write)."

Preenchimento:

```sql
SELECT count(*) FROM negocios WHERE lead_id IS NOT NULL;     -- 1498
SELECT count(*) FROM negocios WHERE empresa_id IS NOT NULL;  -- 1080
SELECT count(*) FROM negocios WHERE bundle_id IS NOT NULL;   -- 0
SELECT count(*) FROM contratos WHERE negocio_id IS NOT NULL; -- 336 (de 742)
```

`negocio_leads` (1199 linhas) e a tabela de ligacao N:N entre negocio e lead,
convivendo com `negocios.lead_id` (1498 preenchidos). `schema.ts:497` marca a
coluna: `leadId: uuid("lead_id").references(() => leads.id), // primary lead
(legacy, nullable)`.

### Ha dual-write?

Sim, declarado:

- `lib/crm/sync-domain-model.ts:232` insere em `oportunidades` com
  `negocioIdLegado`; `:230` faz o `update` quando ja existe.
- `lib/crm/composicao-comercial.ts:151` e `:208` inserem em `oportunidade_itens`.
- `lib/crm/oportunidade-bundle.ts:78` insere em `oportunidade_bundle`.

Chamadores de `syncOportunidadeFromNegocio` em rotas de producao:

| Arquivo | Linha |
|---|---|
| `api-server/routes/negocios.ts` | 472, 774 |
| `api-server/routes/leads.ts` | 659, 1853 |
| `api-server/routes/propostas.ts` | 826 |
| `api-server/routes/contatos.ts` | 173 |
| `lib/crm/converter-oportunidade.ts` | 296 |

E `syncOportunidadeItensFromProposta` em `api-server/routes/propostas.ts:968` e
`:1137`, e `lib/crm/proposta-criacao.ts:194`.

Mesmo fato do grupo Pessoa: **escritor existe em rota de producao, tabela esta
zerada**. `oportunidades`, `oportunidade_itens` e `oportunidade_bundle` tem 0
linhas. Por que zero: **NAO CONFIRMADO**.

### Alguma parece legado? Alguma parece V2/canonica?

Legado:

- `negocios` e chamado de legado pelo proprio schema. `schema.ts:557-561`:
  "Classificacao de recuperacao legado (reconciliacao v1.1). Vive aqui (negocio
  LEGADO), nao em `oportunidades` - ver ADR-EXEC-019".
- `schema.ts:504-508`: `tipoReceita`, `mrrEstimado`, `valorProjeto`,
  `mrrFechado`, `valorSetup` todos com comentario `// legacy`.
- `schema.ts:576-578`: "Etapa canonica do Pipeline novo. `status` continua sendo
  o que o CRM legado, o financeiro e os relatorios leem; os dois sao mantidos".
  Isto e: `negocios` carrega **duas colunas de etapa ao mesmo tempo**, `status` e
  `etapa`.
- `schema.ts:1897-1899`: "NEGOCIO SERVICOS (LEGACY - migrado para
  propostas/proposta_itens). Tabela mantida no banco para historico, mas nao mais
  usada no codigo. Dados foram migrados para propostas + proposta_itens em
  2026-03-10." A tabela `negocio_servicos` **nao aparece** em
  `_raw/tabelas-contagem-exata.txt`, ou seja, nao existe mais no banco carregado;
  o comentario sobreviveu a tabela.

V2/canonica:

- `oportunidades` criada em `migrations/0012_...:533`;
  `oportunidade_itens` em `:559`; `oportunidade_bundle` em
  `migrations/0015_oportunidade_bundle.sql:10`.
- `schema.ts:3478-3481`: "OPORTUNIDADES (Deal v2 - referencia Pessoa+Empresa,
  NAO Lead). Decisao fechada: Deal nao depende de lead_id."
  Contradicao interna registrada no proprio arquivo: `schema.ts:3508` adiciona
  `leadId: uuid("lead_id").references(() => leads.id)` na mesma tabela, sob o
  comentario "Modulo Vendas: os mesmos fatos do negocio, para que a leitura nova
  nao precise atravessar para a tabela legada" (`schema.ts:3501-3503`).

### Qual a UI realmente usa

`negocios`. Evidencia:

- `lib/vendas/consultas.ts:306-308` (board do Pipeline):
  `FROM negocios n LEFT JOIN empresas e ... LEFT JOIN leads l ON l.id = n.lead_id`.
- `consultas.ts:359`, `:391`, `:399`: resumo, contagem e filtro de familia todos
  `FROM negocios`.
- `consultas.ts:603-604` (diretorio de empresas): "oportunidades_abertas" e
  contado `FROM negocios n WHERE n.etapa IN (...)`, nao de `oportunidades`.
- Contagem bruta de uso no codigo: `from(negocios)` aparece 111 vezes,
  `from(oportunidades)` 13 vezes, e **nenhuma** das 13 esta em um componente de
  UI: todas sao resolucao de id em `lib/` ou `scripts/` (grep em `app/src`).

---

## 4. Item de venda (linha de produto)

### Tabelas envolvidas

| Tabela | Linhas |
|---|---|
| `proposta_itens` | 2701 |
| `contrato_itens` | 487 |
| `fatura_itens` | 226 |
| `oportunidade_itens` | 0 |
| `assinatura_itens` | 0 |
| `proposta_grupo_comercial_itens` | 0 |

Fonte: `_raw/tabelas-contagem-exata.txt`.

### Relacao entre elas

`oportunidade_itens` e a unica que aponta para as outras duas, e explicitamente
como ponte de migracao (`_raw/foreign-keys.txt`):

| Origem | Coluna | Destino |
|---|---|---|
| `oportunidade_itens` | `contrato_item_id_legado` | `contrato_itens.id` |
| `oportunidade_itens` | `proposta_item_id_legado` | `proposta_itens.id` |
| `oportunidade_itens` | `servico_canonico_id` | `servicos_canonicos.id` |
| `oportunidade_itens` | `catalogo_preco_id` | `catalogo_precos.id` |

Ambas as FKs de legado tem unico parcial (`schema.ts:3565-3566`).
`proposta_itens` e `contrato_itens` nao se conhecem: nao ha FK entre elas.

As quatro tabelas repetem o mesmo par de colunas semanticas
(`_raw/colunas.txt`): `service_family` e `revenue_nature` existem em
`servicos_catalogo`, `catalogo_precos`, `proposta_itens`, `contrato_itens`,
`oportunidade_itens`, `servicos_canonicos`, `service_ledger_entries`,
`servico_billing_timeline` e `cliente_receita_mensal`.
`schema.ts:1397-1400` diz que e deliberado: "mesma semantica de
oportunidade_itens/contrato_itens/proposta_itens, agora tambem na origem
(catalogo), pra nao nascer UNKNOWN em item novo."

### Ha dual-write?

Sim: `lib/crm/composicao-comercial.ts:151` grava `oportunidade_itens` a partir de
`proposta_itens` (`origemLegado: "proposta_item"`), e `:208` grava o caso manual.
`schema.ts:3542-3547` descreve os tres valores de `origemLegado`:
`contrato_item | proposta_item | manual`.

Tabela vazia com escritor existente: `oportunidade_itens` = 0 linhas, escritor em
`composicao-comercial.ts` chamado por `api-server/routes/propostas.ts:968,1137`.

### Qual a UI realmente usa

`proposta_itens`: `from(propostaItens)` aparece 13 vezes no codigo,
`from(oportunidadeItens)` 11 vezes, nenhuma delas dentro de `components/`.
Nenhum dos dois simbolos aparece em `components/` ou `app/` (grep). A leitura
passa sempre pela camada `lib/` ou pelas rotas Hono. Qual arquivo de tela
consome o payload final: **NAO CONFIRMADO** (nao foi tracado o caminho
rota -> componente para itens).

---

## 5. Comunicacao

### Tabelas envolvidas

| Tabela | Linhas |
|---|---|
| `whatsapp_mensagens` | 25363 |
| `ligacoes` | 4938 |
| `emails` | 4460 |
| `atividades` (tipos de comunicacao) | ver abaixo |
| `notas` | 5002 |
| `communications` | 0 |
| `ai_analysis` | 0 |

Fonte: `_raw/tabelas-contagem-exata.txt`.

### Relacao entre elas

`communications` e a tabela unificadora declarada. `schema.ts:2661-2663`:
"COMMUNICATIONS (unifica Call/WhatsApp/Email - distinta de Activity). Hoje sao 3
tabelas paralelas sem abstracao comum."

| Origem | Coluna | Destino |
|---|---|---|
| `communications` | `pessoa_id` | `pessoas.id` |
| `communications` | `usuario_id` | `usuarios.id` |
| `ligacoes` | `lead_id` | `leads.id` |
| `whatsapp_mensagens` | `lead_id` | `leads.id` |
| `emails` | `lead_id` | `leads.id` |

`communications` **nao** tem FK para `ligacoes`, `whatsapp_mensagens` nem
`emails`. A ponte e uma coluna solta: `origem_legado_id uuid`, sem FK
(`schema.ts:2677`, e aparece em `_raw/ids-sem-fk.txt`). O comentario admite:
"Bridge de migracao - canal ja diz qual tabela legada, id aponta pra la."

A ancora de `communications` e `pessoa_id`, nao `lead_id`
(`schema.ts:2662-2663`). Como `pessoas` tem 0 linhas, toda tentativa de gravar
`communications` hoje resolve `pessoaId = null`.

### Ha dual-write?

Sim, tres caminhos, todos best-effort:

| Arquivo | Linha | O que grava |
|---|---|---|
| `lib/integrations/callface.ts` | 342 | `ligacoes` (escrita primaria, com `onConflictDoNothing` em `idempotencyKey`) |
| `lib/integrations/callface.ts` | 381 | `communications` canal `ligacao` (bloco comentado "F2/dual-write") |
| `lib/integrations/callface.ts` | 399 | `ai_analysis` do resumo da ligacao |
| `lib/integrations/callface.ts` | 418 | `atividades` tipo `ligacao` ("Espelho na timeline") |
| `api-server/routes/whatsapp.ts` | 312 | `whatsapp_mensagens` (envio manual) |
| `api-server/routes/whatsapp.ts` | 379 | `communications` canal `whatsapp` ("F2/dual-write") |
| `api-server/routes/whatsapp.ts` | 453 | `communications` no cross-save |
| `worker/index.ts` | 2294 | `whatsapp_mensagens` (mensagem recebida) |

O bloco de `callface.ts:371-374` diz textualmente: "F2/dual-write (Communication
Intelligence): mesma idempotencia real que ja existe pra `ligacoes`, aplicada em
`communications` - best-effort, nunca bloqueia o processamento real do evento de
ligacao."

`communications` = 0 linhas mesmo com tres escritores ativos em rota de producao.
Por que zero: **NAO CONFIRMADO**.

### Duplicacao adicional: `atividades` espelha comunicacao

```sql
SELECT tipo, count(*) FROM atividades GROUP BY tipo ORDER BY 2 DESC;
```

| tipo | linhas |
|---|---|
| `ligacao` | 4836 |
| `nota` | 4396 |
| `cadencia` | 1300 |
| `proposta_enviada` | 659 |
| `reuniao` | 587 |
| `tarefa_legado` | 346 |
| `reuniao_legado` | 283 |
| `tarefa` | 191 |
| `email_legado` | 118 |
| `whatsapp` | 113 |
| `ligacao_legado` | 82 |
| `diagnostico` | 57 |
| `email` | 49 |
| `onboarding_concluido` | 18 |
| `follow_up` | 9 |

Comparando com as tabelas dedicadas: `ligacoes` tem 4938 linhas e
`atividades` tipo `ligacao` tem 4836, com o id da ligacao guardado no jsonb:

```sql
SELECT count(*) FROM atividades WHERE tipo='ligacao' AND dados ? 'ligacaoId'; -- 4342
```

O mesmo padrao vale para `notas` (5002) e `atividades` tipo `nota` (4396). O
codigo distingue os dois conceitos explicitamente em
`api-server/routes/leads.ts:615-616`: "Observacao inicial -> primeira nota do
lead (nao e atividade: nota e conteudo escrito por pessoa, atividade e evento do
sistema)". Mas `leads.ts:606` grava `atividades` tipo `"nota"` logo acima, e
`api-server/routes/notas.ts:69` grava `notas` sem gravar `atividades`.

Sete sufixos `_legado` convivem com os tipos "novos" dentro da **mesma coluna**
`atividades.tipo`: `tarefa_legado`, `reuniao_legado`, `email_legado`,
`ligacao_legado`.

### Qual a UI realmente usa

As tabelas legadas. `from(communications)` aparece **0 vezes** no codigo inteiro;
`from(aiAnalysis)` tambem 0. Escrita existe (3 e 1 ocorrencias,
respectivamente), leitura nao existe.

A UI de conversa usa `whatsapp_mensagens` + `contatos`
(`api-server/routes/whatsapp.ts`, `app/(crm2)/atendimento`); a timeline de lead
usa `atividades` (`insert(atividades)` em 36 pontos, `from(atividades)` em 13).

---

## 6. Eventos e historico

### Tabelas envolvidas

| Tabela | Linhas |
|---|---|
| `correction_change_log` | 30876 |
| `atividades` | 13044 |
| `status_changes` | 5923 |
| `legacy_provenance` | 5064 |
| `reconciliation_changes` | 413 |
| `eventos_comerciais` | 247 |
| `audit_log` | 21 |
| `vendas_eventos` | 0 |
| `event_outbox` | 0 |
| `eventos` | 0 |
| `ai_case_events` | 0 |
| `cadence_enrollment_events` | 0 |
| `callface_ai_usage_events` | 0 |
| `automacao_execucoes` | 0 |

Fonte: `_raw/tabelas-contagem-exata.txt`.

### Relacao entre elas

`vendas_eventos` e a unica que amarra varias entidades de uma vez
(`_raw/foreign-keys.txt`): `lead_id`, `negocio_id`, `empresa_id`, `pessoa_id`,
`proposta_id`, `reuniao_id`, `usuario_id`, `organizacao_id`, quase todas com
`ON DELETE CASCADE`.

`status_changes` amarra `lead_id`, `negocio_id`, `usuario_id`.
`audit_log` amarra so `actor_id` e `organizacao_id`; a entidade alvo e
`entity_type` + `entity_id` sem FK (aparece em `_raw/ids-sem-fk.txt`).
`event_outbox` tambem usa `aggregate_type` + `aggregate_id` sem FK.
`eventos` (0 linhas) tem apenas `lead_id`.

Nao ha FK entre `vendas_eventos`, `status_changes`, `atividades`, `audit_log` e
`event_outbox`. Sao cinco registros paralelos do mesmo tipo de fato.

### Ha dual-write?

Sim, e neste caso e a arquitetura declarada, nao um acidente.
`lib/vendas/eventos.ts:1-16`:

> "`vendas_eventos` e a superficie de LEITURA da linha do tempo comercial;
> `status_changes` continua recebendo toda mudanca de etapa, porque e dela que
> saem as metricas de funil e os relatorios ja existentes; `atividades` continua
> recebendo o que a equipe precisa ver na timeline do lead/negocio (...) Quem
> chama um comando de negocio nao escolhe onde grava: chama `registrarEvento` e o
> roteamento acontece aqui."

Pontos de escrita dentro do arquivo:

| Linha | Tabela |
|---|---|
| `lib/vendas/eventos.ts:86` | `INSERT INTO vendas_eventos` |
| `lib/vendas/eventos.ts:108` | `INSERT INTO atividades` |
| `lib/vendas/eventos.ts:144` | `INSERT INTO status_changes` |
| `lib/vendas/eventos.ts:191` | leitura: `FROM vendas_eventos e` |

O mesmo comentario de espelhamento aparece no schema
(`schema.ts:4176-4186`): "manda reaproveitar `status_changes`, `atividades`,
`audit_log` e `event_outbox` em vez de criar cinco sistemas paralelos. Foi o que
se fez: essas tabelas continuam sendo escritas como sempre."

`registrarEvento` e chamado de `lib/vendas/propostas.ts` (linhas 277, 384, 472,
482, 508), `lib/vendas/prospeccao.ts` (123, 223, 244, 258, 272, 320, 409, 432) e
`app/(crm2)/propostas/actions.ts:292`. Ainda assim `vendas_eventos` tem 0 linhas.
Por que zero: **NAO CONFIRMADO**.

`status_changes` (5923) e `atividades` (13044) estao cheias: os dois destinos
"legados" do mesmo `registrarEvento` tem dado, o destino novo nao.

### Tabelas de proveniencia (grupo separado, nao duplicado entre si)

`correction_change_log` (30876), `legacy_provenance` (5064),
`reconciliation_changes` (413), `correction_runs` (6), `reconciliation_runs` (1).
Sao trilhas de auditoria de carga/correcao, com FK para `correction_runs` /
`reconciliation_runs` respectivamente. `schema.ts:3358-3377` as apresenta como
"Auditoria da correcao v1.0 (evidencia de proveniencia)". Elas registram
alteracao de campo, nao evento de negocio. Nao ha FK entre elas e `audit_log`.

### Qual a UI realmente usa

`vendas_eventos` para leitura de timeline, e `atividades` para o resto.

`lerLinhaDoTempo` (le `vendas_eventos`, `eventos.ts:191`) e chamada em:

| Arquivo | Linha |
|---|---|
| `app/(crm2)/pipeline/actions.ts` | 177 |
| `app/(crm2)/pre-vendas/actions.ts` | 196 |
| `app/(crm2)/contatos/actions.ts` | 164 |
| `app/(crm2)/contatos/pessoas/[id]/page.tsx` | 15, 16 |
| `app/(crm2)/propostas/actions.ts` | 192 |
| `app/onface-desenho/contatos/pessoas/[id]/page.tsx` | 15, 16 |

Como `vendas_eventos` tem 0 linhas, essas seis telas renderizam timeline vazia
hoje. `audit_log` tem 1 arquivo de leitura contra 16 de escrita
(`from(auditLog)` = 2, `insert(auditLog)` = 16).

---

## 7. Financeiro

### Tabelas envolvidas

| Tabela | Linhas |
|---|---|
| `faturas` | 951 |
| `mrr_movimentos` | 665 |
| `contratos` | 742 |
| `assinaturas` | 355 |
| `service_ledger_entries` | 302 |
| `fatura_itens` | 226 |
| `billing_identities` | 224 |
| `servico_billing_timeline` | 144 |
| `stripe_webhook_events` | 105 |
| `billing_customer_aliases` | 2 |
| `service_ledger_batches` | 1 |
| `cliente_receita_mensal` | 0 |
| `assinatura_itens` | 0 |
| `checkouts` | 0 |
| `catalogo_precos` | 0 |
| `billing_audit_runs` | 0 |
| `billing_correction_ledger` | 0 |
| `billing_resolution_cases` | 0 |

Fonte: `_raw/tabelas-contagem-exata.txt`.

### O conceito duplicado: "quanto este cliente paga por mes"

Pelo menos cinco tabelas respondem a essa pergunta, por caminhos diferentes:

| Tabela | Linhas | Como chega no cliente |
|---|---|---|
| `assinaturas` | 355 | FK `empresa_id`, `lead_id`, `contrato_id`, `servico_id` |
| `mrr_movimentos` | 665 | FK `lead_id`, `assinatura_id`, `contrato_id`, `evento_comercial_id` |
| `servico_billing_timeline` | 144 | FK `empresa_id`, `lead_id`, `contrato_id`, `servico_id`; `assinatura_id` **sem FK** |
| `service_ledger_entries` | 302 | FK `batch_id`, `service_id`; empresa so por `document`/`company_name` texto |
| `cliente_receita_mensal` | 0 | FK `empresa_id` |
| `faturas` | 951 | FK `empresa_id`, `lead_id`, `assinatura_id`, `contrato_id`, `negocio_id`, `grupo_comercial_id`, `servico_canonico_id` |

`faturas` tem **7 FKs de "dono"** simultaneas (`_raw/foreign-keys.txt`), todas
nullable. Preenchimento:

```sql
SELECT count(*) FROM faturas WHERE origem='stripe';               -- 828 (de 951)
SELECT count(*) FROM assinaturas WHERE contrato_id IS NOT NULL;   -- 258 (de 355)
SELECT count(*) FROM assinaturas WHERE servico_id IS NOT NULL;    -- 144 (de 355)
SELECT count(*) FROM contratos WHERE negocio_id IS NOT NULL;      -- 336 (de 742)
```

`servico_billing_timeline.assinatura_id` e `uuid` **sem foreign key**
(`schema.ts:3059`, confirmado por `_raw/ids-sem-fk.txt`), enquanto a coluna de
mesmo nome em `faturas` e `mrr_movimentos` tem FK. Duas colunas com o mesmo nome
e garantias diferentes.

### Ha dual-write?

Entre `eventos_comerciais` e `mrr_movimentos`, sim, com idempotencia declarada.
`schema.ts:3310-3317`:

> "Fluxo de normalizacao (decisao fechada 2026-08-16): eventos_comerciais e o
> fato bruto recuperado do Zoho; comercialEvidencia e a representacao normalizada
> dentro do dominio comercial CRM2; mrrMovimentos e a representacao financeira
> normalizada, so quando o evento altera MRR de forma deterministica (nunca copia
> cega - ver mrrMovimentos.eventoComercialId)."

E `schema.ts:992-994`: "Idempotency key do backfill de recuperacao legado
(evento_comercial -> mrr_movimento (...)). Sem isso, reexecutar o backfill
duplicava o movimento." O unico parcial
`idx_mrr_movimentos_evento_comercial` (`schema.ts:1000`) existe por causa disso.

`comercial_evidencia` citada no comentario tem **0 linhas**
(`tabelas-contagem-exata.txt`).

Nao foi encontrado dual-write entre `faturas` e `fatura_itens` versus
`service_ledger_entries`: **NAO CONFIRMADO** se sao alimentadas pela mesma
origem.

### Alguma parece legado?

- `stripe_webhook_events` carrega colunas de **duas versoes do mesmo schema**.
  `schema.ts:875-884`: "CONVERGIDA no merge de 20/09: os dois lados guardavam o
  ID do evento Stripe em colunas diferentes - `stripe_event_id` (producao) e
  `event_id` (dev)." O comentario marca cada coluna com `// so no dev`,
  `// comuns aos dois lados`, `// so em producao`.
- `contratos.assinatura_legado_zoho jsonb` e `contratos.codigo_legado text`
  (`schema.ts:733-734`), sob "Recuperacao legado Zoho (reconciliacao v1.1)".
- `faturas.receivable_state`, `semantic_confidence`, `semantic_evidence`
  (`schema.ts:959-962`), mesma marca.
- `cliente_receita_mensal` criada pela migration
  `0036_cliente_receita_mensal_historica.sql`, com 0 linhas. Le-se dela em
  `api-server/routes/clientes-crm2.ts:1133` e `:1160` (SQL cru). Escritor: nao
  encontrado em `app/src` alem do `DELETE` em `scripts/_limpeza-aceite.ts:121`.
  Se o preenchimento e feito por script fora de `app/src`: **NAO CONFIRMADO**.
- `catalogo_precos` (0 linhas) tem escritor referenciado por FK a partir de
  `proposta_itens.catalogo_preco_id` e `oportunidade_itens.catalogo_preco_id`,
  ambos vazios. Criada pela migration `0034_catalogo_oficial_stripe.sql`.

### Qual a UI realmente usa

`faturas` e `assinaturas`: rota `/financeiro` em `(crm)` e
`/clientes/financeiro` em `(crm2)`. `service_ledger_entries` tem trigger de
imutabilidade no banco (`_raw/triggers.txt`:
`trg_closed_service_ledger_entries_immutable`, BEFORE UPDATE e BEFORE DELETE,
funcao `prevent_closed_service_ledger_mutation`), o que indica uso de
importacao/auditoria, nao de tela. Qual tela le
`servico_billing_timeline` e `service_ledger_entries`: **NAO CONFIRMADO**.

A unica view do banco e `current_service_portfolio` (`_raw/views.txt`). Quais
tabelas ela agrega: **NAO CONFIRMADO** (nao foi extraida a definicao).

---

## 8. Catalogo de produto / servico

### Tabelas envolvidas

| Tabela | Linhas |
|---|---|
| `servicos_canonicos` | 438 |
| `servicos_catalogo` | 220 |
| `catalogo_mapeamentos_legacy` | 193 |
| `catalogo_precos` | 0 |

Fonte: `_raw/tabelas-contagem-exata.txt`.

### Relacao entre elas

| Origem | Coluna | Destino |
|---|---|---|
| `catalogo_precos` | `servico_catalogo_id` | `servicos_catalogo.id` (CASCADE) |
| `catalogo_mapeamentos_legacy` | `canonical_product_id` | `servicos_catalogo.id` (SET NULL) |
| `servicos_canonicos` | `empresa_id` / `lead_id` | `empresas.id` / `leads.id` (SET NULL) |

`servicos_canonicos` **nao** tem FK para `servicos_catalogo`. Sao dois eixos
diferentes com nomes parecidos: `servicos_catalogo` e o catalogo de oferta
(o que se pode vender), `servicos_canonicos` e a carteira (o que um cliente
especifico tem contratado). `servicos_canonicos` e a 6a tabela mais referenciada
do banco, com 15 FKs entrando (`_raw/mais-referenciadas.txt`, linha 6):
`assinaturas`, `assinatura_itens`, `faturas`, `fatura_itens`,
`eventos_comerciais`, `negocios`, `tarefas`, `fulfillments`,
`oportunidade_itens`, `service_ledger_entries`, `servico_billing_timeline`.

`schema.ts:2789-2792` confirma a origem: "`servicos_canonicos` JA EXISTIA no
banco de producao (413 linhas da reconciliacao)". Hoje tem 438.

### Alguma parece legado?

Sim, e esta medido no proprio dado:

```sql
SELECT origem_catalogo, count(*) FROM servicos_catalogo GROUP BY origem_catalogo;
```

| origem_catalogo | linhas |
|---|---|
| `legado` | 220 |
| `oficial_stripe` | 0 |

`schema.ts:1428-1431`: "Catalogo Oficial Stripe (02/09) - separa o catalogo
oficial das 218 linhas historicas do Zoho sem tocar em nenhuma delas: o default
'legado' ja descreve corretamente o que estava no banco." O comentario fala em
218 linhas; o banco carregado tem 220.

`catalogo_mapeamentos_legacy` e a camada de De/Para. `schema.ts:3236-3239`:
"a camada de mapeamento ja existia, so estava mal preenchida (53% das linhas
UNKNOWN, e 100% delas marcadas como CONFIRMED)." Tem coluna gerada no banco
(`nome_normalizado`, `schema.ts:3253-3257`) e funcao `normalizar_nome_produto`
(`_raw/functions.txt`).

`servicos_catalogo.requer_contrato` esta marcado como legado no schema
(`schema.ts:1404-1406`): "Legado - mantido por compat (dashboards/queries
antigas), mas nao e mais a fonte de verdade do fluxo pos-aceite. Ver
commercialModelPadrao."

### Qual a UI realmente usa

`/ajustes/catalogo` e `/ajustes/servicos` existem como rotas
(`app/(crm2)/ajustes/catalogo`, `app/(crm2)/ajustes/servicos`). Qual das duas
tabelas cada uma le: **NAO CONFIRMADO** (nao foi aberto o componente).
`from(servicosCatalogo)` e referenciada por 5 FKs entrantes; `servicos_canonicos`
por 15.

---

## 9. CS / Pos-venda

### Tabelas envolvidas

| Tabela | Linhas |
|---|---|
| `fulfillment_itens` | 1659 |
| `cs_riscos` | 514 |
| `clientes` | 275 |
| `fulfillments` | 25 |
| `fulfillment_ramais` | 6 |
| `fulfillment_formularios` | 3 |
| `fulfillment_linhas_portabilidade` | 3 |
| `cs_marcos` | 0 |
| `cs_renovacoes` | 0 |
| `cs_cancelamentos` | 0 |
| `nps_respostas` | 0 |

Fonte: `_raw/tabelas-contagem-exata.txt`.

### Relacao entre elas

Todas as tabelas `cs_*` ancoram em `empresas`, **nao** em `clientes`
(`_raw/foreign-keys.txt`):

| Origem | Coluna | Destino | Delete rule |
|---|---|---|---|
| `cs_riscos` | `empresa_id` | `empresas.id` | CASCADE |
| `cs_marcos` | `empresa_id` | `empresas.id` | CASCADE |
| `cs_renovacoes` | `empresa_id` | `empresas.id` | CASCADE |
| `cs_cancelamentos` | `empresa_id` | `empresas.id` | CASCADE |
| `nps_respostas` | `empresa_id` / `lead_id` | `empresas.id` / `leads.id` | CASCADE / NO ACTION |
| `fulfillments` | `servico_canonico_id` | `servicos_canonicos.id` | CASCADE |

Nenhuma FK aponta para `clientes`. A unica FK que sai de `clientes` para o
pos-venda e `clientes.oportunidade_origem_id -> oportunidades.id`, e essa coluna
esta vazia (`oportunidades` = 0 linhas).

Consequencia medivel: `cs_riscos` cobre 273 empresas distintas, enquanto
`clientes` tem 275 linhas:

```sql
SELECT count(DISTINCT empresa_id) FROM cs_riscos; -- 273
SELECT count(*) FROM clientes;                     -- 275
```

Sao dois conjuntos de "quem e cliente" mantidos por chaves diferentes.

`fulfillments` tem indice unico em `servico_canonico_id`
(`idx_fulfillments_servico`, `schema.ts:2863`), ou seja 1 fulfillment por
servico. 25 fulfillments para 438 servicos canonicos e 1659 itens de
fulfillment.

### Alguma parece legado? Alguma parece V2?

`schema.ts:2783-2787`: "POS-VENDA CANONICO (08/09) - Won -> Servico ->
Onboarding/Implantacao. (...) em vez de precisar migrar de novo. Ver
lib/crm/pos-venda.ts."

`schema.ts:2827-2829`: "nunca uma etapa do Pipeline (achado real do legado Zoho:
'Delivery PABX' (...)). servico (`servicosCanonicos`) pode ter um Fulfillment."

`clientes.cs_sem_evidencia` (`schema.ts:3590-3599`) documenta um gap de dado
conhecido: "Sem nenhuma evidencia real de quando virou cliente (nem Won, nem
inicio de contrato, nem primeira fatura) - 91 das 299 contas. A data de entrada
dessas e a da reconciliacao de agosto/2026". O comentario fala em 299 contas; a
tabela hoje tem 275 linhas.

### Qual a UI realmente usa

Duas arvores de rota paralelas para o mesmo pos-venda:

| Grupo `(crm)` | Grupo `(crm2)` |
|---|---|
| `app/(crm)/pos-venda/onboarding` | `app/(crm2)/clientes/onboarding` |
| `app/(crm)/pos-venda/implantacao` | `app/(crm2)/clientes/implantacao` |
| `app/(crm)/pos-venda/entrega/[fulfillmentId]` | `app/(crm2)/clientes/entrega/[fulfillmentId]` |
| `app/(crm)/pos-venda/white-label` | `app/(crm2)/clientes/implantacao/white-label` |
| `app/(crm)/carteira/[[...resto]]` | `app/(crm2)/clientes/carteira` |

Fonte: `find app -type d` e `find app -name page.tsx` em `app/src`.

As rotas de `(crm)` com sufixo `[[...resto]]` sao catch-all. Se sao redirects
para `(crm2)` ou telas independentes: **NAO CONFIRMADO**.

`api-server/routes/cs.ts:98` e `:163` leem `clientes`; `lib/cs/jornada.ts:70`,
`:210`, `lib/cs/tarefas.ts:41`, `:138` tambem. `lib/analytics/command-center.ts:446`
le `clientes`.

---

## 10. IA

### Tabelas envolvidas

Todas as tabelas `ai_*` estao com 0 linhas, com uma excecao
(`_raw/tabelas-contagem-exata.txt`):

| Tabela | Linhas |
|---|---|
| `ai_models` | 6 |
| `ai_agents`, `ai_agent_versions`, `ai_agent_runs`, `ai_agent_run_steps` | 0 |
| `ai_analysis` | 0 |
| `ai_memory_entries`, `ai_memory_versions`, `ai_memory_pointers` | 0 |
| `ai_knowledge_sources`, `ai_knowledge_chunks`, `ai_knowledge_versions`, `ai_knowledge_searches` | 0 |
| `ai_skill_activations`, `ai_skill_pointers`, `ai_skill_versions` | 0 |
| `ai_routers`, `ai_router_members`, `ai_router_decisions` | 0 |
| `ai_cases`, `ai_case_events`, `ai_alerts` | 0 |
| `ai_sdr_config`, `ai_sdr_logs`, `ai_sdr_contato_state` | 0 |
| `ai_send_ledger`, `ai_usage_budgets`, `ai_provider_credentials` | 0 |
| `ai_contact_field_proposals`, `ai_improvement_proposals`, `ai_purpose_bindings` | 0 |
| `sdr_memory` | 0 |
| `callface_ai_usage_events`, `callface_ai_external_identities`, `callface_ai_tenant_snapshots` | 0 |

`ai_models` e uma das 4 tabelas do banco sem FK nenhuma entrando ou saindo
(`_raw/sem-fk-nenhuma.txt`, junto com `_carga_contagem_antes`,
`_migracoes_aplicadas` e `meta_lead_staging`).

### Duplicidades declaradas no schema

1. **Config de agente**: `ai_sdr_config` versus `ai_agents` + `ai_agent_versions`.
   `schema.ts:2098-2100`: "Catalogo de agentes versionados. O AI SDR legado
   permanece em ai_sdr_config durante a migracao; estas tabelas sao o contrato
   novo para multiplos agentes." Ambas com 0 linhas.
   `ai_sdr_config` tem unico por org (`idx_ai_sdr_config_org`, `schema.ts:2095`),
   ou seja 1 agente por tenant; `ai_agents` tem unico
   `(organizacao_id, slug)` (`schema.ts:2116`), N agentes por tenant.

2. **Memoria**: `sdr_memory` versus `ai_memory_entries` / `ai_memory_versions` /
   `ai_memory_pointers`. `schema.ts:2051` rotula a primeira: "SDR MEMORY
   (replaces Supabase sdr_memory)". Ela indexa por `phone` + `created_at`
   (`schema.ts:2063`); `ai_memory_entries` indexa por
   `(organizacao_id, status, created_at)` (`schema.ts:2460`) e tem
   `source: manual | flywheel | agent`. Nao ha FK entre as duas. Ambas vazias.

3. **Analise de conversa**: `ai_analysis` (generica, `entity_type` +
   `entity_id` sem FK, `schema.ts:2695-2696`) versus os campos de resumo dentro
   de `ligacoes` (`resumo`, `transcricao`, `closure_percentage`,
   `schema.ts:436-459`). `schema.ts:2688-2691`: "Hoje extracao de IA e silo por
   feature (SDR extrai so pra si, ligacao tem resumo so pra si). Esta tabela e o
   destino comum."

### Ha dual-write?

Sim, um: `lib/integrations/callface.ts:399` insere em `ai_analysis` com
`entityType: "communication"`, logo depois de gravar `communications` na linha
381 e `ligacoes` na linha 342. Como `communications` esta vazia, `ai_analysis`
tambem esta.

`from(aiAnalysis)` = 0 ocorrencias no codigo. Escrita sem leitura.

### Qual a UI realmente usa

Existem rotas `app/(crm2)/automacoes/agentes`, `.../agentes/[id]`,
`.../agente-ia`, `.../ai/[module]` e `app/(crm2)/ajustes/ai-sdr`. Com todas as
tabelas `ai_*` vazias, o que essas telas exibem hoje: **NAO CONFIRMADO**.

---

## 11. Cadencia / campanha / automacao

### Tabelas envolvidas

| Tabela | Linhas |
|---|---|
| `cadencia_execucoes` | 1273 |
| `campanhas` | 18 |
| `cadence_definitions`, `cadence_versions`, `cadence_definition_pointers` | 0 |
| `cadence_enrollments`, `cadence_enrollment_events` | 0 |
| `outreach_campanhas` | 0 |
| `email_sequencias`, `email_sequencia_passos`, `email_sequencia_execucoes` | 0 |
| `automacoes`, `automacao_execucoes` | 0 |

Fonte: `_raw/tabelas-contagem-exata.txt`.

### Relacao entre elas

`cadencia_execucoes` tem FK direta para `leads` (NOT NULL) e unico
`(lead_id, ordem)` (`uq_cadencia_lead_ordem`, `schema.ts:1269`). Nao tem FK para
nenhuma definicao de cadencia: os toques sao numerados de 1 a 13 por comentario
(`schema.ts:1259`), sem tabela de template.

`cadence_enrollments` -> `cadence_definitions` (CASCADE), e
`cadence_enrollment_events` -> `cadence_enrollments` (CASCADE). Nenhuma FK liga
`cadence_*` a `cadencia_execucoes`.

`email_sequencia_execucoes.lead_id -> leads.id` (NOT NULL) e um terceiro motor
de sequencia, tambem sem FK para os outros dois.

### Alguma parece legado? Alguma parece V2?

`schema.ts:3617-3621`: "CRM 2.0 - FASE 5 (Automacao): Cadence Engine - generico,
desacoplado de canal/provider de IA. Ver ADR-EXEC-013 e
lib/cadencia/cadence-engine.ts."

`schema.ts:2714-2721` sobre `automacao_execucoes`: "A tabela `automacoes` ja
existe (gatilho/condicao/acao/acaoConfig) mas nunca teve executor (achado
confirmado: CRUD sem motor, UI ja admite 'em breve'). Esta tabela e o historico
de execucao (blueprint bloco 31) que o motor novo
(lib/crm/automacao-engine.ts) grava a cada disparo."

Ou seja: tres geracoes coexistindo, e a unica com dado e a mais antiga
(`cadencia_execucoes`, 1273 linhas).

### Ha dual-write?

O `cadence-engine` escreve nas tabelas de dominio, nao em `cadencia_execucoes`:
`lib/cadencia/cadence-engine.ts:210` (`whatsapp_mensagens`), `:336` (`tarefas`),
`:387` e `:472` (`atividades`). `insert(cadenciaExecucoes)` nao foi encontrado em
`app/src`; a origem das 1273 linhas: **NAO CONFIRMADO**.

### Qual a UI realmente usa

Rotas existentes: `app/(crm2)/automacoes/cadencias`,
`app/(crm2)/automacoes/campanhas`, `app/(crm2)/automacoes/fluxos`,
`app/(crm2)/automacoes/execucoes`, e a legada
`app/(crm)/automacoes-legado/[[...resto]]`. Qual tabela cada uma le:
**NAO CONFIRMADO**.

---

## 12. Tags / labels

### Tabelas envolvidas

| Tabela | Linhas |
|---|---|
| `entity_labels` | 161 |
| `lead_labels` | 161 |
| `labels` | 3 |
| `contato_labels` | 0 |
| `negocio_labels` | 0 |

Fonte: `_raw/tabelas-contagem-exata.txt`.

### Relacao entre elas

`lead_labels.lead_id -> leads.id` (CASCADE) e `lead_labels.label_id -> labels.id`.
`entity_labels.label_id -> labels.id` (CASCADE), mas o alvo e
`entity_type` + `entity_id`, **sem FK** (`_raw/ids-sem-fk.txt`).

`contato_labels.contato_id -> contatos.id` (CASCADE). `negocio_labels` nao tem
FK saindo listada em `_raw/foreign-keys.txt`.

### Ha dual-write?

Sim, comprovado no codigo e no dado.

| Arquivo | Linhas | O que faz |
|---|---|---|
| `api-server/routes/leads.ts` | 1647 e 1650 | insere em `lead_labels` e logo depois em `entity_labels` com `entityType: "lead"` |
| `api-server/routes/automacoes-tags.ts` | 44 e 45 | insere em `entity_labels` e, se `entity_type === "lead"`, tambem em `lead_labels` |
| `api-server/routes/atendimento.ts` | 362 e 363 | mesmo par, para o lead resolvido do contato |
| `api-server/routes/atendimento.ts` | 340 | insere em `entity_labels` com `entityType: "contato"` (sem espelho em `contato_labels`) |
| `api-server/routes/clientes-crm2.ts` | 569 | insere em `entity_labels` com `entityType: "empresa"` |

Resultado no banco: as duas tabelas tem exatamente as mesmas 161 associacoes.

```sql
SELECT entity_type, count(*) FROM entity_labels GROUP BY entity_type;
-- lead|161

SELECT count(*) FROM entity_labels el
  JOIN lead_labels ll ON ll.lead_id = el.entity_id AND ll.label_id = el.label_id
 WHERE el.entity_type='lead';
-- 161
```

Sobreposicao de 100%: toda linha de `entity_labels` tem par em `lead_labels`, e
vice-versa (161 = 161 = 161). `entity_labels` nao tem, hoje, nenhuma linha de
`empresa` ou `contato`, apesar dos escritores existirem.

### Alguma parece legado?

`schema.ts:1672-1673`: "Tags can also belong to the other CRM2 entities.
`lead_labels` and `contato_labels` stay as compatibility bridges while screens
migrate."

### Qual a UI realmente usa

`lead_labels` para leitura de lead: `api-server/routes/leads.ts:273-276`,
`:833-835`, `:1592`; `api-server/routes/prospeccao.ts:93-96`.
`entity_labels` para leitura de empresa: `api-server/routes/clientes-crm2.ts:569`
e `:575` (atribuir/remover). Leitura de `entity_labels` em lista:
**NAO CONFIRMADO**.

---

## 13. Anexos / documentos

### Tabelas envolvidas

| Tabela | Linhas |
|---|---|
| `anexos_legado` | 1980 |
| `documentos_atendimento` | 0 |
| `anexos` | 0 |
| `contrato_templates` | 3 |

Fonte: `_raw/tabelas-contagem-exata.txt`.

### Relacao entre elas

`anexos.negocio_id -> negocios.id` (CASCADE) e `anexos.nota_id -> notas.id`
(CASCADE) (`schema.ts:3154-3155`). `anexos_legado` ancora por
`entidade_tipo` + `entidade_id` **sem FK**, com indice
`idx_anexos_legado_entidade` (`schema.ts:3139`) e unico de dedup por
`zoho_id`. Nao ha FK entre `anexos` e `anexos_legado`.

### Alguma parece legado?

`anexos_legado` e legado por nome e por comentario.
`schema.ts:3119-3124`: "Recuperacao legado Zoho (historico, anexos,
provenance). Portados do CRM 2.0 junto com as telas de pos-venda.
`anexos_legado` JA EXISTIA (...) migration 0010."

`schema.ts:1204-1209` descreve `documentos_atendimento` como "diferente de
anexos_legado (historico Zoho, read-only) e de contratos/propostas (documento
transacional)". Tem 0 linhas.

`anexos` (0 linhas) tem escritor: `api-server/routes/anexos.ts:69`
(`insert(anexos)`), criada pela migration `0031_anexos_upload_real.sql`.

### Qual a UI realmente usa

`anexos_legado`, com rota e componente proprios:
`api-server/routes/anexos-legado.ts:49` e `:80` (leitura), montada duas vezes em
`api-server/server.ts:95` e `:126`. O componente e
`components/crm/EmpresaDrawer.tsx:152` (`useAnexosLegadoEmpresa`) e `:339`, com
o rotulo "Historico migrado (Zoho) - pode nao estar disponivel pra baixar
dependendo do ambiente".

---

## 14. Outras duplicidades menores encontradas

| Conceito | Tabelas | Linhas | Nota |
|---|---|---|---|
| Lead de anuncio Meta | `meta_lead_staging` / `leads` | 576 / 3989 | `meta_lead_staging` e uma das 4 tabelas sem FK nenhuma (`_raw/sem-fk-nenhuma.txt`); a ligacao com `leads` nao e declarada no banco |
| Tarefa | `tarefas` / `atividades` tipo `tarefa` e `tarefa_legado` / `cs_marcos` | 462 / 191+346 / 0 | `tarefas` tem trigger de banco `trg_tarefas_sincronizar_status` (BEFORE INSERT e BEFORE UPDATE, `_raw/triggers.txt`) que nao existe em `atividades` |
| Reuniao | `reunioes` / `atividades` tipo `reuniao` e `reuniao_legado` | 295 / 587+283 | `atividades` tem quase 3x mais registros de reuniao que a tabela `reunioes` |
| Grupo comercial | `proposta_grupo_comercial` / `oportunidade_bundle` | 0 / 0 | ambos agregam linhas de uma mesma negociacao; `contratos`, `faturas` e `oportunidade_itens` tem FK para o primeiro, `negocios` e `oportunidades` para o segundo |
| Evidencia comercial | `eventos_comerciais` / `comercial_evidencia` / `mrr_movimentos` | 247 / 0 / 665 | cadeia de normalizacao declarada em `schema.ts:3310-3317`; o elo do meio esta vazio |

---

## Tabela-resumo

| Conceito | Tabelas | Linhas | Qual a UI usa | Evidencia de legado |
|---|---|---|---|---|
| Pessoa | `leads`, `contatos`, `pessoas`, `pontos_contato`, `pessoa_empresa_vinculos` | 3989 / 1663 / 0 / 0 / 0 | `leads` (UNION com `pessoas` em `lib/vendas/consultas.ts:737-775`, mas `pessoas` vazia); `contatos` no inbox | `pessoas.lead_id_legado`; `schema.ts:3380-3388` (ADR-EXEC-003); `schema.ts:202` `// legacy text field` |
| Empresa / Conta | `empresas`, `clientes`, `billing_identities` | 2199 / 275 / 224 | `empresas` em `/contatos` (`consultas.ts:587-676`); `clientes` em `/clientes` (`routes/clientes-crm2.ts`) | `clientes` criada em `migrations/0012...:581`; `billing_identities` com duas modelagens na mesma tabela (`schema.ts:3185-3190`) |
| Venda | `negocios`, `oportunidades`, `oportunidade_bundle`, `negocio_leads` | 1562 / 0 / 0 / 1199 | `negocios` (`consultas.ts:306-308`, `:359`, `:603`) | `schema.ts:557-561` "negocio LEGADO"; `schema.ts:504-508` colunas `// legacy`; `oportunidades.negocio_id_legado` |
| Item de venda | `proposta_itens`, `contrato_itens`, `fatura_itens`, `oportunidade_itens`, `assinatura_itens` | 2701 / 487 / 226 / 0 / 0 | NAO CONFIRMADO (nenhum simbolo aparece em `components/`) | `oportunidade_itens.contrato_item_id_legado` e `.proposta_item_id_legado`; `schema.ts:3542-3547` |
| Comunicacao | `whatsapp_mensagens`, `ligacoes`, `emails`, `communications`, `atividades` | 25363 / 4938 / 4460 / 0 / 13044 | tabelas legadas; `from(communications)` = 0 ocorrencias no codigo | `schema.ts:2655-2660` (F2 dual-write); `communications.origem_legado_id` sem FK; tipos `_legado` dentro de `atividades.tipo` |
| Nota | `notas`, `atividades` tipo `nota` | 5002 / 4396 | `notas` (`routes/notas.ts:69`) e `atividades` (36 pontos de insert) | distincao declarada em `routes/leads.ts:615-616`, mas os dois sao gravados |
| Evento / historico | `vendas_eventos`, `status_changes`, `atividades`, `audit_log`, `event_outbox`, `eventos` | 0 / 5923 / 13044 / 21 / 0 / 0 | `vendas_eventos` para timeline (6 telas, todas vazias hoje); `atividades` para o resto | `lib/vendas/eventos.ts:1-16` declara o espelhamento triplo; `schema.ts:4176-4186` |
| Proveniencia | `correction_change_log`, `legacy_provenance`, `reconciliation_changes` | 30876 / 5064 / 413 | NAO CONFIRMADO | nome e comentario `schema.ts:3358-3377`, `schema.ts:3119-3124` |
| Financeiro (MRR) | `assinaturas`, `mrr_movimentos`, `servico_billing_timeline`, `service_ledger_entries`, `cliente_receita_mensal` | 355 / 665 / 144 / 302 / 0 | `faturas` e `assinaturas` (rotas `/financeiro`); demais NAO CONFIRMADO | `contratos.assinatura_legado_zoho`, `.codigo_legado`; `faturas.receivable_state`; `stripe_webhook_events` com colunas de dev e de prod (`schema.ts:875-884`) |
| Catalogo | `servicos_catalogo`, `servicos_canonicos`, `catalogo_mapeamentos_legacy`, `catalogo_precos` | 220 / 438 / 193 / 0 | NAO CONFIRMADO | 220 de 220 em `servicos_catalogo` com `origem_catalogo = 'legado'`; `requer_contrato` marcado legado (`schema.ts:1404-1406`) |
| CS / Pos-venda | `clientes`, `cs_riscos`, `cs_marcos`, `cs_renovacoes`, `cs_cancelamentos`, `fulfillments`, `nps_respostas` | 275 / 514 / 0 / 0 / 0 / 25 / 0 | duas arvores de rota paralelas: `(crm)/pos-venda/*` e `(crm2)/clientes/*` | `clientes.cs_sem_evidencia` (`schema.ts:3590-3599`); `cs_*` ancoram em `empresas`, nunca em `clientes` |
| IA | `ai_*` (31 tabelas), `sdr_memory`, `ai_analysis` | todas 0, exceto `ai_models` = 6 | NAO CONFIRMADO | `schema.ts:2098-2100` "O AI SDR legado permanece em ai_sdr_config durante a migracao"; `schema.ts:2051` "replaces Supabase sdr_memory" |
| Cadencia / automacao | `cadencia_execucoes`, `cadence_*`, `email_sequencias`, `automacoes` | 1273 / 0 / 0 / 0 | NAO CONFIRMADO | `schema.ts:3617-3621` (ADR-EXEC-013); `schema.ts:2714-2721` "CRUD sem motor" |
| Tags | `lead_labels`, `entity_labels`, `contato_labels`, `negocio_labels` | 161 / 161 / 0 / 0 | `lead_labels` na leitura de lead; `entity_labels` na escrita de empresa | `schema.ts:1672-1673` "compatibility bridges while screens migrate"; sobreposicao de 161/161 confirmada por query |
| Anexos | `anexos_legado`, `anexos`, `documentos_atendimento` | 1980 / 0 / 0 | `anexos_legado` (`components/crm/EmpresaDrawer.tsx:152`) | nome `_legado`; `schema.ts:3119-3124` |

---

## O que ficou sem evidencia (NAO CONFIRMADO)

1. **Por que as tabelas V2 estao vazias.** `pessoas`, `pontos_contato`,
   `pessoa_empresa_vinculos`, `oportunidades`, `oportunidade_itens`,
   `oportunidade_bundle`, `communications`, `ai_analysis`, `vendas_eventos` e
   `event_outbox` tem escritor chamado a partir de rota de producao, e 0 linhas.
   Nao foi possivel distinguir entre: a) o dual-write nunca rodou nesta carga;
   b) rodou e falhou em silencio (os tres caminhos sao best-effort com catch);
   c) o dump de producao carregado excluiu essas tabelas. `audit_log` tem 21
   linhas, mas nao foi inspecionado o conteudo em busca de
   `domain_model_sync.failed`.

2. **Sobreposicao real de `billing_identities`.** As colunas `canonical_empresa_id`
   e `empresa_id` tem 166 linhas preenchidas cada. Se sao as mesmas 166 linhas ou
   conjuntos distintos: nao foi rodada a query de interseccao.

3. **Origem das 1273 linhas de `cadencia_execucoes`.** Nao foi encontrado
   `insert(cadenciaExecucoes)` em `app/src`.

4. **Origem de `cliente_receita_mensal` (0 linhas).** Existe leitura
   (`routes/clientes-crm2.ts:1133`, `:1160`) e `DELETE` em script de limpeza,
   nao foi encontrado escritor.

5. **Definicao da view `current_service_portfolio`.** A unica view do banco
   (`_raw/views.txt`); quais tabelas ela agrega nao foi extraido.

6. **Qual tela consome `servico_billing_timeline`, `service_ledger_entries`,
   `servicos_catalogo` versus `servicos_canonicos`, `catalogo_precos`,
   e as tabelas `ai_*`.** Nao foi tracado o caminho rota -> componente para esses
   casos.

7. **Se as rotas `(crm)/*/[[...resto]]` sao redirects ou telas vivas.** Existem
   pares de rota `(crm)` e `(crm2)` para pipeline, pre-vendas, contatos,
   empresas, propostas, negocios, carteira e automacoes. O conteudo dos
   catch-all nao foi aberto.

8. **Duplicidade entre `leads` e `meta_lead_staging`.** Nao ha FK nem coluna de
   ligacao declarada; nao foi verificado se ha sobreposicao por e-mail/telefone.

9. **Divergencias entre numero citado em comentario e numero no banco.** Tres
   casos encontrados, sem explicacao apurada: `servicos_catalogo` (comentario diz
   218, banco tem 220), `servicos_canonicos` (comentario diz 413, banco tem 438),
   `clientes` (comentario diz 299 contas, tabela tem 275).
