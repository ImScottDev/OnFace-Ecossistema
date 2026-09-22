# ONFACE — estado da execução do refactor

> Documento de continuidade. Sempre reflete o estado **atual**, não o histórico.
> O histórico fica em `refactor-execution-log.md`.
> Fonte normativa do TO-BE: **nem `ONFACE-ARCHITECTURE-SPEC.md` nem `SPEC-IA-01` existem**
> neste repositório nem no vault (conferido em 21/09). A ordem vigente é a do
> HUB do ONFACE no vault (`02_PROJETOS/Callface/ONFACE/HUB.md`), que define as
> frentes e a dívida arquitetural central.
> Fonte factual do AS-IS: `docs/architecture/database-as-is/`.

## Fase atual

**Refactor arquitetural: fases 01 a 26 concluídas.** 27 e 28 aguardam aprovação
do Kauã (são destrutivas).

**Conclusão do produto (Documento Mestre v0.13): CP1 a CP41 concluídos.**

Três blocos, em ordem:

- **CP1 a CP13** — o ONFACE deixou de ser fundação e virou produto utilizável:
  jornadas operacionais fechadas e números das telas acertados contra o dado
  real.
- **CP14 a CP29** — as portas de escrita, o isolamento entre organizações, a
  idempotência dos webhooks, e a segunda prova independente de que produção roda
  código anterior a 16/08.
- **CP30 a CP41** — o procedimento de virada deixou de envelhecer em silêncio.
  Os passos 9 e 10 pediam aceites, validadores, smokes e "provar no navegador", e
  **nada disso era executado por nada**: 4 aceites (um quebrado), 2 validadores
  (um morrendo com TypeError), 32 smokes e 3 checagens de tela, todos sem
  chamador. Hoje há dois runners e um verificador de rotas, e o passo 10 tem
  roteiro. No caminho: a home parou de pintar de verde uma queda de 78%, o
  gráfico central deixou de ser imagem, e o sync do catálogo ganhou piso — ele
  podia desativar os 55 preços de uma vez.

A próxima etapa NÃO é mais código: é **QA do Kauã na tela**, e depois a virada
(fases 27 e 28), que é destrutiva e depende de autorização explícita.

### Como verificar o estado, em quatro comandos

```bash
cd app && npx tsc --noEmit && npm test   # 341 testes, 0 falhas
./scripts/rodar-aceites.sh               # 4 aceites (208 asserções) + 2 validadores
./scripts/rodar-smokes.sh                # 33 smokes + 3 checagens de tela
cd app && npx tsx --env-file=.env src/scripts/checar-rotas-onface.ts   # 14 rotas
```

O único vermelho esperado hoje é `validar-catalogo-oficial`, pelo **bloqueio 7**
(catálogo PABX incompleto). É o comportamento correto: a virada não deve seguir
com o PABX invendável.

| Fase | Estado |
|---|---|
| 17 leitores | **concluída** — telas de vendas no canônico com a propagação fechada; a leitura de detalhe/edição migrou na fase 25, junto com a escrita |
| 18 motor único | **concluída** — os dois motores não têm mais nenhuma implementação própria de ação |
| 19 IA | NEXO e Hermes em `draft`, a IA não escreve direto no banco, busca de conhecimento no banco com índice, e **permissão delegada com teto por interseção**. Publicar os agentes é decisão de quem opera |
| 22 RBAC | papéis, mapa, vínculos e **paridade provada**. Rotas financeiras, de automação, de agente, de plataforma de IA e de token já exigem permissão. Das 165 restantes, **154 são operação** (a autenticação é o gate) e **11 são públicas por desenho, agora nomeadas uma a uma com o gate de cada** |
| 20 Meta | **concluída** — CAPI validada contra a Meta real (8 eventos aceitos) e inbound direto provado com `leadgen_id` real pela rota de verdade. Zero credencial Meta pendente |
| 21 storage | **pontos de upload migrados** (anexo, avatar, formulário público): checksum, deduplicação, organização na chave, entrega independente de provedor. O adapter S3/R2 espera credencial, e só isso. A justificativa anterior para adiar ("só troca um disco local por outro") estava errada: o que mudou não foi o disco, foi metadado, dedup, isolamento e endereçamento |
| 23 API pública | **concluída** — `/api/v1` com 9 recursos, token com escopo e uso registrado; criar, listar e revogar por rota e por tela (`/ajustes/api-tokens`), com teto de escopo testado e gerador de credencial corrigido |
| 24 paridade | **13 dos 14 cenários passam, 0 falham**. O único não verificável é o NEXO, por falta de credencial de provedor de modelo |
| 25 detalhe/escrita | **concluída** — a etapa da aquisição saiu da dedução para `pipeline_etapas`; cadência e atribuição chegam ao canônico; detalhe do lead lê `pontos_contato` e `aquisicoes` |
| 26 semânticas | **concluída** — próxima ação é Task, no-show é estado de Meeting, trial depende da capacidade da oferta, estagnação e trial ganharam casa canônica, proposta conta pelo vínculo canônico, cliente é derivado |
| 27 e 28 | **não executadas, por instrução**. São destrutivas (desligar escrita legada, remover fallback, CONTRACT, virada) e dependem de aprovação do Kauã |

## Último commit

`(CP52)` — três varreduras limpas, e a trava do botão morto

**Estado medido em 22/09/2026:** tsc limpo · **351 testes / 0 falhas** · build de
produção limpo · **36 verificações** na bateria de smokes · **4 aceites com 208
asserções** · **paridade 13/14** (o não verificável é o NEXO, por credencial) ·
**14/14 rotas do ONFACE** renderizando. Nada de produção foi tocado.

Branch de trabalho: `refactor/arquitetura-canonica`, criada a partir de `98940fe`.

## Concluído

- [x] 01.1 repositório limpo confirmado
- [x] 01.2 baseline SHA registrado: `98940fe`
- [x] 01.3 backups confirmados
- [x] 01.4 backup fresco pré-refactor: `_prod-snapshot-20260920/pre-refactor-20260920.dump` (17 MB)
- [x] 01.5 branch dedicada criada
- [x] 01.6 reconciliação de drift Drizzle ↔ banco — CONCLUÍDA

### Resultado da fase 01

| Medida | Antes | Depois |
|---|---|---|
| Tabelas no Drizzle / no banco | 145 / 151 | 149 / 151 |
| Tabelas só no banco | 6 | 2 (só controle interno) |
| Tabelas só no Drizzle | 0 | 0 |
| Colunas do banco ausentes no Drizzle | 7 | 0 |
| Colunas do Drizzle ausentes no banco | 1 | 0 |
| Divergências de nullability em `organizacao_id` | 26 | 0 |
| FKs do Drizzle sem par no banco | 3 | 0 |

As duas tabelas fora do Drizzle são `_migracoes_aplicadas` e `_carga_contagem_antes`,
ambas de controle interno e deliberadamente não declaradas.

### Resultado das fases 02 e 03

- 38 pacotes criados com `package.json` e `index.ts` como única porta de entrada:
  14 de domínio (cada um com `commands`, `queries`, `policies`, `repositories`,
  `events`, `types`, `errors`), 10 de integração, 9 de platform, 5 de shared;
- `apps/{web,api,worker}` preparados;
- workspace pnpm movido para a raiz, listando `app`, `apps/*` e os quatro grupos de
  `packages/`. O pacote `app` continua sendo a aplicação que roda;
- **7 testes de arquitetura** (SPEC §35 e §50.1) barrando: domínio importando SDK de
  provedor, framework de entrega, implementação de integração ou cliente de banco;
  integração importando aplicação; ferramenta de IA tocando banco; pacote sem porta
  de entrada. A barreira entra antes do código.

Pacote vazio não afeta o build: `tsc` limpo e 111 testes passando com o workspace novo.

## Prontidão para virada (SPEC §24)

`pnpm tsx src/scripts/validacao-paridade.ts` percorre os 14 cenários e responde, um
por um, se dá para virar. **13 passam, 0 falham, 1 não verificável** — medido em
21/09/2026 tanto no banco de dev quanto no banco reconstruído do dump fresco de
produção, com o mesmo resultado.

O único não verificável está nomeado, e "não verificável" **não é OK**:

| # | Cenário | O que falta |
|---|---|---|
| 12 | NEXO consulta e age | os dois agentes existem em `draft` com teto de permissão, e o gate está provado em smoke. Falta **credencial de provedor de modelo** para rodar de verdade: zero ativas |

Dois cenários saíram de "não verificável" desde a primeira medição. O 13 saiu
quando as credenciais da Meta chegaram: a cadeia fato → outbox → worker → Meta
está provada ponta a ponta, com dois fatos idênticos dos quais só o que veio da
Meta é devolvido. O 8 (carteira de CS) saiu quando a atribuição passou a ser
exercitada em `smoke-cs-responsavel` — a capacidade está provada; distribuir os
275 clientes continua sendo decisão de operação, e isso é item aberto, não
lacuna de código.

## Migrations aplicadas neste refactor

| # | Nome | O que faz | Reversível |
|---|---|---|---|
| 0056 | `reconciliacao_baseline_refactor` | `organizacao_id` NOT NULL em 4 tabelas financeiras; 3 FKs que faltavam | sim, inverso documentado no arquivo |
| 0057 | `expansao_dominio_canonico` | cria `pipeline_etapas`, `aquisicoes`, `ofertas_comerciais`, `pagamentos`, `conversas`, `domain_events`, `timeline_events`, `cs_health_snapshots` | sim, EXPAND puro (DROP TABLE reverte) |
| 0058 | `expansao_plataforma` | cria automação versionada, RBAC normalizado e arquivos; adiciona colunas nuláveis em `automacoes` e `automacao_execucoes` | sim, EXPAND puro |
| 0059 | `corrige_unicidade_inscricao` | troca constraint composta por índice parcial em `automacao_inscricoes` | sim |
| 0060 | `reconciliacao_casos` | cria `reconciliacao_casos` e `backfill_provenance` | sim |
| 0061 | `vinculo_pessoa_empresa_campos` | `cargo` e `updated_at` em `pessoa_empresa_vinculos` + índice único | sim |
| 0062 | `pontos_contato_atribuicao` | 10 colunas de atribuição e `aquisicao_id` em `pontos_contato` | sim |
| 0063 | `ofertas_comerciais_seed` | as 4 ofertas do SPEC §12.3 + `oferta_comercial_id` em oportunidade, proposta, contrato e preço | sim |
| 0064 | `proposta_contrato_canonico` | vínculo canônico de proposta e contrato à oportunidade/oferta | sim |
| 0065 | `cliente_servico_canonico` | vínculo de cliente e serviço canônico à oportunidade | sim |
| 0066 | `fulfillment_ciclos` | `tipo` e `cycle_number` em `fulfillments` + `uq_fulfillment_ciclo` — habilita onboarding E implantação no mesmo serviço | sim |
| 0067 | `comunicacoes_canonicas` | `communications` e `conversas` canônicas | sim, EXPAND puro |
| 0068 | `fulfillment_indice_antigo` | remove a exclusividade de `idx_fulfillments_servico`, que anulava a 0066 | sim, recriar como UNIQUE |
| 0069 | `aquisicao_lead_legado` | `aquisicoes.lead_legado_id` + índice único parcial; 3.989 de 3.989 ligadas | sim, DROP COLUMN |
| 0070 | `rbac_papeis_e_vinculos` | 8 papéis, o mapa papel→permissão e os 16 vínculos de usuário | sim, DELETE documentado |
| 0071 | `nexo_e_hermes` | os dois agentes do SPEC §19, em `draft`, com versão 1 | sim, DELETE documentado |
| 0072 | `api_tokens` | token da API pública (hash, escopos, expiração) e registro de uso | sim, DROP TABLE |
| 0073 | `oportunidade_campos_spec` | `setup_estimado`, `servico_catalogo_id`, `etapa_id` — campos do SPEC §11.1 que faltavam | sim, DROP COLUMN |
| 0074 | `pipeline_etapas_em_uso` | semeia as 6 etapas que o produto usa e liga as 1.561 oportunidades | sim, documentado |
| 0075 | `busca_conhecimento` | full-text em português com `unaccent` e índice GIN | sim, DROP COLUMN |
| 0076 | `meta_capi_entregas` | auditoria da entrega de conversão à Meta | sim, DROP TABLE |
| 0077 | `permissao_delegada_agentes` | teto de permissão do NEXO (7) e do Hermes (5) | sim, remove a chave do jsonb |
| 0081 | `etapa_da_aquisicao_tem_casa_canonica` | cria o pipeline de AQUISIÇÃO com 7 etapas e materializa `aquisicoes.etapa_id` com o que o board já mostrava (2.919 novo, 531 em contato, 539 oportunidade) | sim, inverso no arquivo |
| 0082 | `no_show_e_estado_da_reuniao` | move 34 dos 38 no-shows históricos para `reunioes.status`; 4 ficam como reconciliação nomeada | sim, inverso no arquivo |
| 0083 | `trial_e_capacidade_da_oferta` | `ofertas_comerciais.permite_trial`, semeado a partir do pipeline que já tem a etapa `trial` (Callface AI sim, PABX não) | sim, DROP COLUMN |
| 0084 | `estagnacao_no_modelo_canonico` | `oportunidades.motivo_estagnacao` e `estagnado_em`, com os 227 casos abertos copiados | sim, DROP COLUMN |
| 0085 | `trial_no_modelo_canonico` | `oportunidades.trial_iniciado_em` e `trial_encerrado_em`, com os 17 históricos copiados | sim, DROP COLUMN |

## Credenciais: o que está configurado e o que falta

Configurado em 21/09/2026 (valores no `.env` local, fora do Git):

| Variável | Para quê | Validado |
|---|---|---|
| `META_CAPI_ACCESS_TOKEN` + `META_PIXEL_ID` | devolver conversão | **sim** — 8 eventos aceitos |
| `META_APP_ID` / `META_APP_SECRET` | assinatura do webhook | sim, pelo próprio fluxo |
| `META_WEBHOOK_VERIFY_TOKEN` | handshake do webhook | gerado com 384 bits |
| `META_PAGE_ID` | página dona do formulário | sim, id recebido |
| `META_AD_ACCOUNT_ID` | Ads Insights | **sim** — Insights lidos com o System User token |
| `META_LEADS_ACCESS_TOKEN` | ler o lead do formulário | **sim** — lead real lido, 21/09/2026 |
| `META_ADS_ACCESS_TOKEN` | Ads Insights | **sim** — mesmo System User token (`ads_read`) |

### Meta Lead Ads: bloqueio externo RESOLVIDO em 21/09/2026

O System User token chegou e foi validado contra a Graph API v26.0. O bloqueio
externo da fase Meta **acabou**: não sobrou nenhuma credencial Meta pendente.

| O que foi medido | Resultado |
|---|---|
| Tipo do token | `SYSTEM_USER` "WB Callface auth" (122135313609010870), app MerencIA, **sem expiração** |
| Escopos | 44, incluindo `leads_retrieval`, `ads_read`, `pages_show_list`, `pages_manage_ads`, `business_management` |
| Alcance da Página | chega na Página "Callface" (170052822855677) |
| Formulários | 9 formulários, **865 leads** (747 / 100 / 13 / 5 nos quatro ativos) |
| Retrieval real | `leadgen_id 1079510644459965` lido com os 7 campos do formulário, `ad_id`, `campaign_id`, `platform` |
| Ads Insights | o MESMO token lê `act_1979606826185515` — `META_ADS_ACCESS_TOKEN` passou a ser ele |

Detalhe que custou tempo e fica registrado: **listar** formulários exige Page Access
Token (`(#190) This method must be called with a Page Access Token`), mas **ler** o
lead não. O System User troca por um Page token na hora
(`/{page-id}?fields=access_token`), então a integração não precisa guardar nenhum
token de página. Diagnóstico reprodutível em `src/scripts/checar-token-meta.ts`,
que nunca imprime o valor do token.

O token vive **somente** em `app/.env` (que é gitignored e não rastreado). Não foi
para produção, para o Business Manager nem para documentação.

#### O que o token destravou, e os dois defeitos que ele revelou

Com a credencial real deu para rodar a cadeia inteira pela rota de verdade —
`src/scripts/smoke-meta-lead-ads.ts`, 14 verificações — entregando o envelope que a
Meta realmente posta: `leadgen_id`, `page_id`, `form_id` e **nada mais**. Foi o que
expôs dois defeitos que nenhum teste pegava, porque nenhum teste chegava até o banco
com dado real:

1. **A entrada direta de Lead Ads falhava 100% das vezes.** `normalizarLeadAds`
   devolve `ocorridoEm` como `Date`, e `Date` entregue cru a um parâmetro do
   postgres.js estoura no Bind (`Buffer.byteLength` recebendo um Date). O INSERT de
   `pontos_contato` morria e levava a transação inteira junto. Corrigido na fronteira
   do SQL (`repositorio-aquisicao.ts`), onde os três bindings passam.
2. **A idempotência por `leadgen_id` só valia quando a aquisição nascia.** A chave era
   gravada dentro de `criarAquisicao`; quando a entrada caía numa aquisição **já
   aberta** — o caso comum, porque essas pessoas já existem na base vindas do RD —
   nada registrava a chave, e cada reentrega da Meta somava um ponto de contato novo.
   A gravação subiu para o comando de domínio (`registrarEntrada`), que agora a chama
   nos dois caminhos.

Medido depois da correção: reentrega do mesmo `leadgen_id` mantém 1 aquisição e **1**
ponto de contato (antes: 2), com a chave registrada. `leadgen_id` que a Graph não
conhece continua recusado por falta de identificador, sem inventar e-mail nem
telefone.

### Ainda ausentes

| O quê | Para quê |
|---|---|
| `META_CAPI_TEST_EVENT_CODE` | opcional, manda para a aba Test Events |
| `STORAGE_ENDPOINT` + bucket + chaves | tirar os arquivos do disco da máquina |
| credencial de provedor de IA | única lacuna de paridade restante (NEXO) |

O código está pronto e falha com mensagem de **configuração ausente**, não de
integração quebrada — tratar as duas como a mesma faz o alerta disparar em ambiente
que nunca foi configurado.

### Tabelas canônicas criadas (vazias até o backfill)

`pipeline_etapas` · `aquisicoes` · `ofertas_comerciais` · `pagamentos` · `conversas` ·
`domain_events` · `timeline_events` · `cs_health_snapshots` · `automacao_versoes` ·
`automacao_passos_execucao` · `automacao_inscricoes` · `roles` · `permissions` ·
`role_permissions` · `user_roles` · `file_objects` · `file_links`

`permissions` já nasce com as 16 permissões do SPEC §31 semeadas.

## Backfills executados

| Fase | Script | Origem | Resultado | Casos abertos |
|---|---|---|---|---|
| 05 identidade | `src/scripts/backfill/05-identidade.ts` | 3.989 leads | **3.950 pessoas**, 2.324 vínculos | 8 |
| 06 aquisição | `src/scripts/backfill/06-aquisicao.ts` | 3.989 leads | **3.989 aquisições**, 1.583 touchpoints | 0 |
| 07 oportunidade | `src/scripts/backfill/07-pipeline-oportunidade.ts` | 1.562 negócios | **1.561 oportunidades**, 10 etapas | **1.085** |
| 08 oferta | `src/scripts/backfill/08-oferta-comercial.ts` | 477 c/ família | **477 vinculadas** a 4 ofertas | 0 |
| 09 proposta/contrato | `09-proposta-contrato.ts` | 1.095 + 336 | **1.094 + 336** vinculados | 0 |
| 10 cliente/serviço | `10-cliente-servico.ts` | 438 serviços | 29 ligados à oportunidade | 0 |
| 11 fulfillment | migration 0066 | 25 jornadas | ciclos habilitados | 1 |
| 12 financeiro | `12-financeiro.ts` | 951 faturas | **579 pagamentos**, soma confere | 146 |
| 13 comunicações | `13-comunicacoes.ts` | 34.761 linhas | **33.005 comms**, 5.249 conversas | 2 |
| 14-15 eventos | `14-15-eventos-timeline.ts` | 13.044 atividades | **14.078 timeline**, 2.016 eventos | 0 |

### Panorama do modelo canônico

```text
pessoas            3.950      conversas         5.249
aquisicoes         3.989      communications   33.005
oportunidades      1.561      pagamentos          536
pontos_contato     1.583      ofertas               4
pipeline_etapas       10      casos abertos     1.097
```

Os dois são idempotentes por `backfill_provenance` e só inserem.

### Dado ausente na origem, declarado e não mascarado

`qualificado`, `qualificado_em` e `desqualificado_em` estão vazios em **3.989 de
3.989** leads no banco de produção. `estagio_pre_vendas` só tem `novo` (1.597) ou
NULL (2.392), sem progressão. Por isso toda aquisição nasce `aberta`, exceto as 287
de quem virou cliente, que nascem `encerrada`. Isso é o que o dado diz; o backfill
não inventou estado.

### Casos de reconciliação abertos

**1.084 oportunidades sem família de produto.** O SPEC §42 proíbe preencher
`service_family` por palpite. A família foi buscada numa cadeia de cinco evidências
(o próprio negócio, item de proposta, catálogo do item, item de contrato, serviço
canônico do lead) e resolveu **477 de 1.561**. As outras 1.084 ficaram com família
**NULA** e um caso cada em `reconciliacao_casos`. `NULL` não virou `'UNKNOWN'`
disfarçado: são coisas diferentes e o teste garante isso.

Essas 1.084 precisam de decisão humana sobre o que foi de fato vendido. Nenhuma
evidência no banco permite deduzir.

8 identidades aparecem ligadas a mais de uma empresa. Ganharam vínculo para cada
empresa, **nenhum marcado principal**, e um caso em `reconciliacao_casos`. A decisão
é humana e posterior.

Abertos nas fases 25 e 26, todos **nomeados e não resolvidos por palpite**:

| Caso | Quantos | Por que não foi resolvido |
|---|---|---|
| No-show sem reunião para marcar | 1 negócio | não há reunião nenhuma ligada a ele |
| No-show com duas reuniões | 1 negócio | não há como saber a qual o cliente faltou |
| No-show cuja reunião já estava `cancelada` | 2 negócios | cancelar antes e não aparecer são fatos diferentes |
| Propostas ligadas só a um lead | **455**, das quais **81 aceitas** | atribuí-las a uma oportunidade específica seria inventar |
| Marcados `cliente` sem contrato ativo | 111 | a marca pode estar certa por um fato que o contrato não registra |
| Trials históricos sem família comercial | 16 de 17 | não servem de evidência para a política de trial |

## Readers migrados

`src/lib/vendas/consultas.ts` é a porta de leitura das telas de vendas — 20 arquivos
consomem dela (pré-vendas, pipeline, contatos, prospecção, Empresa 360, detalhe de
lead e de oportunidade). Migrá-la migrou as telas de uma vez.

| Leitura | Fonte agora | O que mudou de fato |
|---|---|---|
| `boardPreVendas` | `aquisicoes` | **1.597 → 3.702 registros visíveis** |
| `boardPipeline` | `oportunidades` | paridade exata; a única divergência virou caso |
| `empresa360` — aquisições | `aquisicoes` | some o filtro que escondia lead sem estágio |
| `empresa360` — oportunidades | `oportunidades` | — |
| `empresa360` — propostas | `oportunidades` + identidade | **+446 propostas** antes invisíveis |
| `detalheLead` — oportunidades | `oportunidades` | — |
| `detalheOportunidade` — irmãs | `oportunidades` | — |
| `lerLinhaDoTempo` | `timeline_events` + `communications` | **0 → 40 eventos** por pessoa |
| `relatorios` — por pessoa | `oportunidades` | paridade exata: R$ 497.904,42 MRR, R$ 76.628,87 setup |
| `relatorios` — mídia paga | cadeia de atribuição | **+R$ 21.537,90** de MRR ativo visível |
| fila de cobrança e renovação | LEFT + empresa | deixa de depender de lead legado |
| responsável do onboarding | cadeia canônica → legado | **0 → 305** contratos órfãos com dono |

**O sumiço, medido.** A consulta anterior filtrava `estagio_pre_vendas = ANY(...)` e
2.392 dos 3.989 leads têm esse campo nulo. No canônico não existe registro sem
estado: aquisição aberta e não qualificada é "novo", que é um estado, não um vazio.
O board saiu de 1.597 para 3.702, distribuídos em colunas reais (novo 2.756, em
contato 531, oportunidade 415).

**A linha do tempo lia uma tabela vazia.** `lerLinhaDoTempo` consultava só
`vendas_eventos`, que tem zero linhas, enquanto `timeline_events` tinha 14.078 e
`communications` 33.005 — o dado dos backfills 13, 14 e 15 sem nenhum leitor. Agora
lê as três em UNION, com dedup por correspondência (pessoa + tipo + dois minutos),
porque a mesma ligação chega pelos dois caminhos. Filtrar por canal seria mais
simples e perderia 983 ligações que nunca viraram atividade.

**406 contratos eram invisíveis.** Não têm negócio nem oportunidade, e 271 estão
ATIVOS. A cadeia de responsável do onboarding ia contrato → negócio → responsável e
resolvia zero deles; agora vai do canônico ao legado e resolve 305. Os 406 viraram
caso `CONTRATO_SEM_PROCESSO_COMERCIAL`.

**Duas correções de leitura que não eram de fonte:**

- o limite passou a ser **por coluna**. Com limite global, as 400 vagas iam todas
  para a coluna mais cheia e o board anunciava "Em contato 531" com zero cards;
- o legado só refina onde sabe algo que o canônico não deriva (`qualificacao`).
  Deixá-lo sobrescrever punha o card em "Novo" enquanto o contador do canônico dizia
  outra coisa — total e cards discordando na mesma tela.

### Toda leitura canônica, executada contra produção

`smoke-leituras-canonicas` chama as nove leituras exportadas de `consultas.ts` mais a
linha do tempo, com ids reais, e confere **conteúdo**, não ausência de exceção. Board
vazio é o defeito que este refactor mais encontrou, e "não explodiu" teria passado em
todos eles.

| Leitura | Tempo | Conteúdo |
|---|---|---|
| `boardPreVendas` | 75ms | 201 cards, 3.702 ativos |
| `boardPipeline` | 21ms | 290 cards, 603 ganhas |
| `diretorioEmpresas` | **461ms** | 200 linhas (a mais lenta) |
| `empresa360` | 38ms | monta com oportunidades |
| `detalheLead` / `detalheOportunidade` | 3ms | montam |
| `lerLinhaDoTempo` | 3ms | 50 eventos |

O smoke falha acima de um segundo: consulta de board lenta é problema de produto, não
de teste.

### Lead criado pela tela não aparecia no board da tela

O achado mais grave da rodada, e o que mais ensina sobre como escolher o que testar.

`preVendas.criarLead` **não criava a aquisição canônica**. Só a rota HTTP `POST /leads` e
o webhook do site chamavam a porta; as duas server actions do CRM2 (criar lead na tela de
pré-vendas, criar lead a partir da empresa) não chamavam. O board lê `aquisicoes`.

**O registro existia, a tela estava certa, e os dois não se encontravam.** Quem cria não
consegue nem reportar um bug desses.

Dois defeitos estruturais vieram em cadeia:

| O quê | Consequência |
|---|---|
| a porta canônica não gravava `lead_legado_id` na aquisição, só na proveniência | aquisição de runtime nasce órfã: card não abre, nada do lead propaga de volta |
| `criarOportunidadeDoLead` vinculava empresa com SQL direto, fora de `registrarEvento` | lead ganhava empresa e não aparecia na conta dele |

**Por que medir o banco não acusava:** 3.989 leads e 3.989 aquisições vieram do backfill,
já pareados, divergência zero. Só criando um lead do zero o buraco aparece.

**E por que nenhum smoke pegou:** `smoke-prevendas-leitura` cria o lead chamando
`garantirEntradaCanonica` **direto**. Testava a porta, não o caminho que a tela percorre.
Testar o caminho feliz pelo atalho é como isso sobreviveu a uma fase inteira de cutover.

`smoke-lead-nasce-no-board` fecha isso pelo caminho da tela, e foi verificado com a
correção removida: 6 verificações falham, entre elas o board não contando o lead novo
(3.702 → 3.702).

### A família do produto: de campo vazio na tela a operação travada

`negocios.service_family` é NULL em 475 das 1.561 oportunidades, e nessas o canônico
**sabe** a família, deduzida no backfill por cadeia de cinco evidências. Cada leitor que
olhava só o legado escondia isso, e os últimos dois não escondiam: bloqueavam.

| Onde | O que acontecia | Medida |
|---|---|---|
| `/pipeline-crm2/board` | card sem família | **1 → 126** cards com família |
| `detalheOportunidade` | "sem família" no detalhe | negócio com família só no canônico passa a mostrar |
| telas de proposta (3 consultas) | proposta sem família | **2 → 469** propostas com família resolvível |
| **`enviarProposta`** | **"Defina a família comercial antes de enviar"** | **43 propostas em rascunho paradas** |
| **`moverEtapa`** | **não avança para Proposta nem Negociação** | **125 negócios abertos presos** |

A cadeia é sempre do mais específico para o mais geral: proposta, negócio, oportunidade
canônica. Onde o legado tem valor, foi alguém que editou, e editar ganha de deduzir.

`carregarOportunidade` devolve os DOIS valores, o resolvido e o próprio do legado.
`alterarFamilia` compara com o próprio: se comparasse com o resolvido, escolher a
família que o canônico já deduziu viraria no-op silencioso e o legado ficaria nulo para
sempre.

O Ganho **não** mudou: a decisão vem da oferta comercial, não da família, e as jornadas
de pós-venda também. Conferido antes de commitar.

### Propagação: o que a tela não via depois de escrito

Três defeitos da mesma família, todos encontrados provocando a ação pela rota em vez de
medir o banco. A divergência medida era ZERO nos três, porque o backfill sincronizou os
dois lados, e era isso que os escondia: só apareceriam no primeiro uso depois da carga.

| O que quebrava | Medida | Onde foi corrigido |
|---|---|---|
| trocar dono de lead não chegava em `aquisicoes` | board conta "sem responsável" do canônico | `registrarMudancaResponsavel`, a porta que os 7 caminhos já usavam |
| automação movia etapa de lead para `crm2_pre_vendas_stage` | **0 linhas preenchidas** nessa coluna em todo o banco | porta de pré-vendas |
| projeção da linha do tempo descartava todo evento | **2.016 de 2.016** eventos sem id canônico no payload | a projeção resolve o vínculo pelo agregado |
| nota escrita por automação não aparecia na conta | só existia em `atividades` | publica `NoteAdded`, e a projeção a exibe |
| cartão "Sem 1º contato" mostrava zero para sempre | **0 de 3.989** aquisições com `last_touch_at` nulo; o número real é **3.060** | a condição virou "sem toque depois da chegada" |

O terceiro é o mais instrutivo: a projeção tinha teste verde e caller ligado desde a
rodada anterior, e mesmo assim **nunca criou uma linha**, porque descartar evento sem
vínculo é o comportamento correto para evento que não tem onde aparecer. Peça ligada
também pode não fazer nada.

### Peça pronta, teste verde, produção sem caller

Três apareceram indo olhar. Depois de a terceira aparecer, o padrão virou varredura:
cruzar tudo que os pacotes canônicos exportam contra quem chama em runtime.

| Peça | Sintoma |
|---|---|
| adapter da CAPI | escrito e testado; **nada em runtime chamava**, nenhum evento saía |
| `projetarTimeline` | 14.078 linhas, todas do backfill; a timeline parava no dia da carga |
| `publicarEvento` canônico | 4 chamadores contra 20 do legado, que só escrevia na fila |
| acervo de arquivos (§32) | serviço, adaptadores, repositório e tabelas prontos; **três rotas gravando `fs.writeFileSync` em disco** |

**A varredura, em números.** 39 funções exportadas pelos pacotes, 13 sem caller
aparente. Seis eram falso positivo do próprio método — chamadas dentro do pacote,
que o grep sobre `app/src` não vê. Das sete restantes:

| Situação | Quais | O que se fez |
|---|---|---|
| gap real | acervo de arquivos: `guardarArquivo`, `entregarArquivo`, `escolherAdaptador`, `adaptadorLocal`, `configS3DoAmbiente` | ligado (SPEC §32) |
| andaime da fase 25 | `verificarPodeCriarProposta`, `marcarPerdida` | mantido; o caminho legado já cumpre a regra hoje |
| ferramenta de diagnóstico | `diagnosticoMeta` | mantido, só em script mesmo |

Os dois andaimes foram medidos antes de virarem "sem caller é dívida": a regra da
proposta roda por `verificarPropostaExigeEmpresa`, que chama a mesma política do
domínio e ainda resolve empresa em cadeia (oportunidade → negócio → pessoa), coisa
que o comando canônico não faz; e a perda está íntegra dos dois lados — 431
oportunidades perdidas, 431 com motivo, contra 432 negócios perdidos no legado.
**Função sem caller nem sempre é buraco; às vezes é duplicata pior do que o que já
roda.** A diferença só aparece medindo.

Um landmine saiu junto: `RepositorioVendas.moverEtapa` era `SET updated_at = now()`
e nada mais. Não movia etapa e marcava a oportunidade como recém-alterada — o mesmo
efeito que já encheu o board de "17min" uma vez. Agora falha alto até a fase 25
decidir onde a etapa canônica mora (`oportunidades.etapa_id`: 0 de 1.561 linhas).

É o padrão a vigiar no resto do refactor: peça pronta, teste verde, produção sem
caller. A trava contra a quinta é `lib/arquitetura/gravacao-de-arquivo.test.ts`, que
pegou a terceira rota de upload já na primeira execução.

### Arquivos: o que mudou ao ligar o acervo

| Antes | Depois |
|---|---|
| `fs.writeFileSync` em `UPLOADS_DIR` | binário pelo adaptador, metadado em `file_objects` |
| nome aleatório, sem checksum | chave `<organizacao>/<ab>/<sha256>.<ext>` |
| mesmo arquivo duas vezes = duas cópias | deduplicação por conteúdo, um binário e dois vínculos |
| `/api/uploads/<caminho>`, qualquer sessão servia | `/api/arquivos/<id>`, organização é parâmetro da busca |
| anexo do formulário público aberto por prefixo | aberto por vínculo em `file_links` |

Dois defeitos apareceram só ao ligar, nenhum visível em teste de unidade: a união
`EntidadeVinculada` declarava `cliente` e `comunicacao`, que o CHECK do banco recusa,
e omitia `servico_canonico` e `aquisicao`, que ele aceita; e `application/zip` era
aceito pela rota e recusado pelo pacote.

**Object storage não é dependência para o deploy subir.** Sem `STORAGE_*`, o serviço
usa disco local exatamente como o produto já fazia: upload, avatar, anexo e formulário
público continuam funcionando sem infraestrutura nova. Uma versão intermediária deste
trabalho exigia uma variável (`STORAGE_ALLOW_LOCAL`) para não explodir em produção, o
que teria derrubado upload no próximo deploy; corrigido antes do commit.

**A virada para object storage, em três passos**, nenhum mexendo em tela ou em URL já
gravada:

| Passo | O quê | Estado |
|---|---|---|
| 1 | implementar o adaptador S3/R2 e passá-lo em `criarS3` | **única peça de código que falta** |
| 2 | configurar `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | bloqueado por credencial externa |
| 3 | ligar `STORAGE_REQUIRE_OBJECT_STORAGE=true`, que faz a falta de configuração virar erro em vez de voltar ao disco em silêncio | depende do 1 e do 2 |

Arquivo já gravado continua válido: a `storage_key` é a mesma nos dois provedores e
`file_objects.storage_provider` registra onde cada binário está, então migrar os antigos
é cópia, não reescrita de endereço. Enquanto o passo 1 não acontecer, configurar só as
variáveis não liga nada, e o serviço avisa alto nesse caso em vez de deixar quem
configurou achando que ligou.

**A autorização do anexo público é o `publicToken`, não um par de ids.** A primeira
versão da rota recebia `fulfillmentId` + `fileObjectId` e conferia só que os dois
estavam vinculados. Vínculo prova parentesco, não permissão: os dois identificadores
circulam por caminhos diferentes do produto, e quem juntasse um par válido abriria o
documento sem nunca ter tido o link do formulário. Agora o token resolve o fulfillment,
e o vínculo fica com o papel certo, impedir que um token legítimo vire chave para
arquivo de outro fulfillment. Provado por chamada real à rota nos quatro casos: token
certo abre, token errado não, id do fulfillment no lugar do token não, e token válido
não alcança arquivo de outro fulfillment.

### Dois modelos de evento, convergidos

`vendas_eventos` é rico e alimenta só a linha do tempo; `domain_events` alimenta o
outbox, a automação e a Meta. Qualificar um lead escrevia só no primeiro, então
**`AcquisitionQualified` nunca era publicado** — o evento que mais importa para
otimização de campanha. A ponte entra em `registrarEvento`, na mesma transação.

Os vocabulários também divergiam (`LeadQualified` contra `AcquisitionQualified`), e a
tradução ficou num lugar só.

### A regra que faltava, e que custou duas regressões

**Leitura canônica exige que a sincronização cubra TUDO que a leitura usa.**

Migrar a fonte sem conferir a propagação é trocar a leitura e torcer. Aconteceu duas
vezes nesta fase, e as duas foram encontradas auditando a própria mudança:

| Onde | O que quebrava | Correção |
|---|---|---|
| Pipeline | `syncOportunidadeFromNegocio` propagava `stage` e não `etapa`, `titulo`, `service_family` | os quatro campos entraram na sincronização |
| Pré-vendas | **nada** propagava lead → aquisição; as 8 ações do módulo eram invisíveis na tela | ponte em `registrarEvento`, por onde todas passam |

O sintoma é o mesmo nos dois: o usuário age, salva, e o card volta para onde estava.
Sem erro. O produto parece ter engolido a ação, que é o pior tipo de bug porque
ninguém consegue reportar.

Os dois têm smoke que consulta **o board de verdade**, e os dois foram verificados
falhando de propósito antes de entrar.

### Fase 25: a tela lia canônico e escrevia legado

A pergunta que nenhum teste fazia: **depois de a tela executar a ação, a mesma tela
mostra o resultado?** Teste de escrita confere a escrita; teste de leitura confere a
leitura; ninguém fechava o ciclo. `smoke-tela-escreve-tela-le` fecha — chama a mesma
função que a server action chama e relê pela mesma consulta que a página usa.

Na primeira execução, o board dizia "novo" enquanto o detalhe dizia "em_contato".

| Buraco | Medida | Correção |
|---|---|---|
| Mover card para Em contato escrevia `leads.estagio_pre_vendas`; o board lia `aquisicoes`, onde a etapa era **derivada** de fatos | `aquisicoes.etapa_id` em 0 de 3.989 | migration 0081 cria o pipeline de aquisição e materializa a etapa; `registrarMudancaDeEtapa` vira a porta única |
| Card e total da coluna liam **duas cópias** do mesmo CASE | 2 definições | uma só, `expressaoDeEtapa` |
| Cadência escrevia `last_contact_at` e nada mais | **zero** chamadas à porta canônica em `cadencia.ts` | os dois toques passam por `registrarPrimeiroContato` |
| `registrarTouchpoint` gravava o ponto de contato sem `aquisicao_id` | 1.583 de 1.583 tinham o vínculo **pelo backfill**; medir dava 100% | resolvido dentro da função, a partir do lead legado |
| Detalhe do lead lia UTMs de `leads` | paridade exata com `pontos_contato`: campaign 1.428, medium 1.490, content 1.278, term 1.251, **zero só de um lado** | lê `pontos_contato` (SPEC §8.3), legado como fallback |

### Fase 26: as semânticas que não tinham dono

| Semântica | O que estava errado | Onde mora agora |
|---|---|---|
| Próxima ação | `negocios.proxima_acao` vazia em **1.562 de 1.562**; o selo "Sem próxima ação" aparecia em todo card aberto | `tarefas` (SPEC §23), uma por oportunidade via `chave_idempotencia`. O selo caiu de 527 para 523 dos 527 abertos |
| No-show | `no_show_em` preenchido nos mesmos 38 em que `status = 'no_show'` — cópia do status, escrita por nenhum código de runtime. `reunioes.status` só tinha `agendada` e `cancelada` | `reunioes.status = 'no_show'`, marcado pela rota. O negócio **não** vira perdido |
| Trial | `iniciarTrial` sem gate: PABX e White Label podiam entrar em trial. `trial_encerrado_em` em 0 de 1.562 | capacidade em `ofertas_comerciais.permite_trial`, regra em `@onface/catalog::podeIniciarTrial`, datas em `oportunidades` |
| Estagnação | `motivo_estagnacao` idêntico a `status` nos 227 casos; existia só no legado | `oportunidades.motivo_estagnacao` + `estagnado_em`, levados pelo espelho |
| Contagem de propostas | casava só por `negocio_id` | casa por `oportunidade_id` com o legado como fallback |
| Cliente | `leads.tipo` só atualizado ao mexer num contrato: **111 marcados sem contrato ativo, 124 com contrato ativo e não marcados** | derivado (contrato ativo OU marca). O filtro "Clientes" foi de 287 para 411 |

### Ainda no legado, e dito no código

Sobrou o texto livre que o modelo canônico não modela: observação de nutrição,
detalhe de desqualificação, etapa de origem da desqualificação, qualificação em JSON
e interesse declarado (`servicos_interesse`). São campos de texto sem semântica de
domínio; a SPEC não define casa para eles, e inventar uma seria decidir produto.

Contadores de não lidas (`email_nao_lidos`, `whatsapp_nao_lidas`) continuam no lead
de propósito: são estado de interface, não fato de negócio.

## Código de domínio migrado para `packages/`

| Pacote | O que tem | Testes |
|---|---|---|
| `@onface/catalog` | `avaliarGanho`, `podeCriarProposta`, `jornadasPosVenda` — a política comercial da oferta | 8 de domínio |
| `@onface/identity` | resolução determinística de pessoa e empresa | 10 de domínio |
| `@onface/acquisition` | `registrarEntrada` — porta única de dado externo | 9 de domínio |
| `@onface/platform-events` | evento + outbox transacionais | 4, inclui rollback |
| `@onface/platform-database` | repositórios Postgres dos contratos acima | — |

Os demais 37 pacotes seguem vazios, recebendo código conforme as fases avançam.

## Writers migrados

| Escritor | Estado | Porta canônica |
|---|---|---|
| `app/api/webhooks/rd-lead` | **migrado** | `garantirEntradaCanonica` |
| `app/api/webhooks/site-lead` | **migrado** | `garantirEntradaCanonica` |
| `api-server/routes/leads.ts` (POST /leads) | **migrado** | idem |
| `api-server/routes/contatos.ts` | **migrado** | idem |
| `api-server/routes/prospeccao.ts` | **migrado** | idem |
| `api-server/routes/apollo.ts` | **migrado** | idem |
| `api-server/routes/contatos-unified.ts` | **migrado** | idem |
| `worker/index.ts` (3 criadores de contato) | **migrado** | `garantirPessoaDeContato` |
| escrita de `negocios` — **todo caminho de Ganho** (30) | **migrado** | `decidirGanhoPelaOferta` + `propagarGanhoCanonico` |
| `api-server/routes/cadencia.ts` (2 toques) | **migrado** | `registrarPrimeiroContato` |
| `lib/vendas/pipeline.ts::definirProximaAcao` | **migrado** | cria a tarefa canônica (SPEC §23) |
| `lib/vendas/pipeline.ts::iniciarTrial` | **migrado** | `podeIniciarTrial` + espelho canônico |
| `lib/vendas/pipeline.ts::marcarEstagnacao` | **migrado** | espelho canônico |
| `api-server/routes/negocios.ts` (no-show) | **migrado** | marca `reunioes.status` |
| `api-server/routes/{email,whatsapp}.ts` | contadores de não lidas: **estado de interface**, ficam no lead de propósito | — |
| `api-server/routes/contratos.ts` (`leads.tipo`) | escrita mantida como ponte; a LEITURA passou a derivar | — |
| troca de responsável (7 caminhos) | **migrada** | `registrarMudancaResponsavel`, que propaga e audita |
| `crm_update_stage` / `crm_assign_owner` / `crm_add_note` do motor | **migrados** | portas de pré-vendas e de dono; nota publica evento |
| `lib/crm/pos-venda.ts` (adaptador legado) | ainda em uso por `negocios.ts:804`, morre na fase 17 | — |

**Como os 30 caminhos de `negocios` foram fechados de uma vez.** Todos passam por
`avaliarEvidenciaWon` e `aplicarEfeitosPosGanho` em `lib/crm/won-evidence.ts` — rota,
webhook do Stripe, webhook do Documenso, worker e scripts. A ponte entrou nesses dois
pontos. Guarda na função compartilhada, não em cada chamador.

`lib/vendas/ponte-ganho.ts` **não reimplementa a regra**: a decisão vem de
`avaliarGanho`, a mesma função do caminho canônico. Um teste garante que ninguém
reescreva a decisão lá dentro — dois modelos com a mesma regra escrita duas vezes
divergem em silêncio, que é o bug que este refactor existe para acabar.

Um teste de inventário (`arquitetura/escritores-migrados.test.ts`) trava isso: porta
nova sem ligação à canônica falha a suíte. Ele também verifica que a ponte declara ser
temporária e que ninguém removeu a escrita legada antes da migração de leitura.

Inventário completo em `database-as-is/04-escritores.md`. Medição atual:
`leads` 45 escritores, `negocios` 30, `atividades` 23, `tarefas` 14.

**O dual-write é temporário e datado.** `src/lib/vendas/ponte-canonica.ts` diz no
topo que existe para morrer na fase 25. As telas ainda leem `leads`; escrever só no
canônico hoje faria o lead sumir da tela de pré-vendas no mesmo instante.

## Estruturas legadas ainda em uso (todas, neste ponto)

`leads` (3.989), `negocios` (1.562), `contatos` (1.663), `whatsapp_mensagens` (25.363),
`ligacoes` (4.938), `emails` (4.460), `atividades` (13.044), `cadencia_execucoes` (1.273).

## Testes executados

Estado atual: `tsc --noEmit` limpo, **build de produção passando**, **276 testes, 0
falhas**, e **25 de 25 smokes** verdes, mais o aceite de vendas em **97 passaram, 0 falharam** contra o banco real (conferidos por código de
saída, não por texto: procurar "FALHA" na saída dava falso positivo em `falhados=0`):

- `smoke-ponte-canonica` — entrada externa chega inteira ao canônico e não duplica;
- `smoke-ganho-oportunidade` 5/5 — a política da oferta decide, PABX gera as duas
  jornadas, retry não duplica;
- `smoke-ponte-ganho` 5/5 — o caminho **legado** obedece à oferta, e a mesma prova
  (contrato assinado, sem pagamento) produz decisões **opostas** para PABX e para
  Callface AI direto. É a demonstração do risco financeiro fechado;
- `smoke-outbox` 5/5 — evento e outbox na mesma transação, nascem pendentes, não
  duplicam na reentrega, **somem juntos quando a transação falha**, e o consumidor
  tira da fila;
- `smoke-motor-unico` 4/4 — a regra de automação que tenta mover para Ganho **não
  move**, a etapa legítima passa, o disparo repetido não duplica a tarefa e a tarefa
  diz que veio de automação.

### Travas permanentes contra regressão

| Teste | Impede |
|---|---|
| `db/drift-schema.test.ts` | coluna no banco e não no Drizzle (ou o contrário) |
| `db/on-conflict.test.ts` | ON CONFLICT apontando para índice que não existe |
| `db/sql-template.test.ts` | crase em comentário de SQL, que fecha o template |
| `arquitetura/fronteiras.test.ts` | domínio importando ORM, SDK ou framework |
| `arquitetura/escritores-migrados.test.ts` | porta de escrita nova sem ligação canônica |
| `vendas/leitura-canonica.test.ts` | registro sumindo da leitura; divergência sem caso |
| `arquitetura/escritores-migrados.test.ts` | motor de regras com implementação própria de ação |
| `db/array-postgres.test.ts` | array do Postgres projetado cru (o driver devolve string) |
| `v1/api-publica.test.ts` | rota pública sem escopo; nome de tabela na URL; token em claro |
| `api-server/rotas-configuracao-protegidas.test.ts` | rota de configuração sem autorização; crescimento silencioso de rota aberta |
| `ai-platform/agentes.test.ts` | ferramenta de IA escrevendo direto; agente citando ferramenta inexistente; ferramenta de escrita sem permissão exigida |
| `auth/permissoes.test.ts` | cutover de autorização mudando o acesso de alguém |

Cada uma foi verificada **falhando de propósito** antes de entrar. Teste que não pega
nada é teatro.

Contagens conferidas depois dos smokes: oportunidades 1.561, negócios 1.562, serviços
438, aquisições 3.989 — idênticas ao registrado. Os smokes passaram a limpar em
`finally` depois que 5 oportunidades de teste sobreviveram a uma quebra no meio da
depuração da migration 0068.

Após a fase 04: `tsc --noEmit` limpo (0 erros), **111 testes passando**, 0 falhas.

Revisão interna da fase 04 (protocolo abaixo):
- 10 constraints exercitadas uma a uma em transação revertida, nos dois sentidos
  (o que deve bloquear bloqueia, o que deve passar passa);
- as 17 tabelas conferidas **coluna a coluna** contra o banco: 17/17 idênticas;
- drift de tabela: 0 (as duas fora do Drizzle são de controle interno);
- um erro próprio encontrado e corrigido: a trava de inscrição em automação
  impedia histórico legítimo. Ver migration 0059.

## Protocolo de revisão de checkpoint

**Decisão do Kauã em 21/09: revisão externa (Codex) está desligada.** Não usar
`/codex:review`, `/codex:adversarial-review` nem qualquer revisor externo sem pedido
explícito dele.

A revisão de cada checkpoint é feita internamente, e um checkpoint só fecha com:

1. `git diff` lido criticamente, linha a linha, do que mudou;
2. `tsc --noEmit` sem erro;
3. suíte de testes unitários passando;
4. testes de arquitetura passando;
5. verificação de migration (`db:migrar --check` e conferência contra o banco);
6. contagens de reconciliação, quando a fase migra dado;
7. build, quando a fase toca empacotamento;
8. smoke test, quando a fase toca caminho executável.

A auditoria Codex da fase 01 (`task-muao0p8s-9qo76s`) concluiu sozinha antes do
cancelamento. O resultado não foi incorporado; a fase 01 foi revisada pelo processo
interno acima.

## Bugs reais corrigidos durante a fase 01

Três `INSERT` em `tarefas` no `worker/index.ts` omitiam `organizacao_id`. Como a coluna
é NOT NULL no banco desde a migration 0050, esses caminhos falhavam em runtime:
follow-up de proposta parada, renovação de contrato e recontato de negócio perdido.
A organização já estava disponível e validada no escopo dos três. Foram expostos pelo
`.notNull()` adicionado ao Drizzle, não por teste.

## Catálogo: o CRM sincroniza com o Stripe, não copia uma vez

**RESOLVIDO em 21/09.** O que estava registrado aqui como decisão pendente virou
outra coisa quando fui ao Stripe em vez de confiar na planilha.

**A medição que mudou o desenho.** O snapshot commitado veio de uma planilha de 02/09.
Comparado com a conta live 19 dias depois:

| | |
|---|---|
| preços no snapshot | 213 |
| preços vivos no Stripe | **55** |
| coincidem | 42 |
| **no snapshot e já não existem no Stripe** | **171** |
| no Stripe e não estão no snapshot | 13 |

Rodar aquele importador teria criado **171 preços fantasmas** no catálogo comercial e
escondido 13 reais. Ele foi desarmado: recusa rodar e aponta para o comando novo.

**O desenho certo é sincronizar.** O Stripe é onde o preço é decidido e cobrado; o CRM
lê de lá. A divisão de responsabilidade é o coração disso:

| Quem manda | Em quê | Por quê |
|---|---|---|
| **Stripe** | nome, descrição, valor, moeda, recorrência, situação | divergir dele é cobrar diferente do que a tela promete |
| **CRM** | ordem de exibição, comportamento de quantidade, observação operacional | são escolhas de COMO VENDER, que o Stripe não conhece |

A sincronização nunca sobrescreve a coluna do CRM: senão o ajuste de quem organizou a
tela sumiria no ciclo seguinte.

**O recorte** é o prefixo do nome, regra do Kauã: `Callface AI - `,
`Callface AI White Label - `, `PABX - `. Os outros 41 produtos ativos do Stripe são
históricos (cobrança pontual, contrato antigo, negociação específica): faturam e não são
catálogo vendável. White Label é testado ANTES de Callface AI, porque o nome dele começa
igual.

**Resultado, medido:** 15 produtos e 55 preços no catálogo oficial. O construtor de
proposta saiu de **0 para 55 itens**, e o aceite do Módulo 01 saiu de **72 passaram com
3 não verificados** para **97 passaram, 0 falharam, 0 não verificados**.

Dois produtos já existiam no catálogo legado com o MESMO `stripe_product_id`
(`Callface AI - Full` e `Starter`): foram reclassificados, não duplicados. Nenhuma das
220 linhas legadas foi perdida.

**Roda sozinho**, de hora em hora, no worker (`catalogo-stripe-sync`). Sem chave
configurada o job sai em silêncio: ambiente sem Stripe não é integração quebrada.

```bash
pnpm --filter app catalogo:sync:dry   # lê o Stripe e mostra o que mudaria
pnpm --filter app catalogo:sync       # aplica
```

### As duas pendências de metadata foram corrigidas no Stripe

A sincronização não inventa classificação, e por isso dois produtos entraram como
pendência nomeada. **Os dois foram corrigidos na conta live em 21/09, a pedido do Kauã**,
escrevendo só metadata — nada de preço, nome ou cobrança:

| Produto | Estava | Ficou |
|---|---|---|
| `Callface AI - Starter` | só `SKU_INTERNO` (maiúsculo), sem família nem categoria | os 7 campos do padrão, e a chave maiúscula removida |
| `Callface AI - Business` | `categoria_crm="Mensal"`, `exige_contrato="plano"`, `sku_interno="nao"` — valores deslocados uma posição | `categoria_crm="plano"`, `exige_contrato="nao"`, `sku_interno="callface_ai_business_mensal"`, e `tipo_receita` que faltava |

Os valores vieram do padrão dos produtos irmãos (`Full` e `Pro`, que são planos Callface
AI iguais), não de palpite. Depois da correção: **zero produtos sem categoria** no
catálogo oficial.

A detecção de metadata quebrada continua testada com dado inline em
`sincronizar-stripe.test.ts`, para não depender de o Stripe seguir errado para o teste
ter assunto.

### O que ainda depende de decisão do Kauã no catálogo

Quatro preços cujo significado não é derivável, e por isso não foram nomeados:

| Produto | Preços | A pergunta |
|---|---|---|
| `Callface AI - Starter` | dois avulsos de R$ 89,90, um deles com `transform_quantity` dividindo por **5** | o que distingue os dois, e o que "a cada 5" significa comercialmente |
| `Callface AI - Pacote 500 Minutos` | um avulso de R$ 105,00 e outro de R$ 99,90, este dividindo por **15** | idem |

Sem apelido, os dois pares aparecem na tela com o mesmo rótulo e preços diferentes, e o
vendedor não tem como escolher. Escrever um nome ali seria inventar regra comercial.

Também medido: **27 dos 55 preços não têm metadata nenhuma** e **8 não têm apelido nem
`lookup_key`**. Nenhum dos dois impede a sincronização (o preço herda do produto, e a
variação cai para o período), mas preencher no Stripe melhora o que o vendedor lê.

## Antes do deploy: a verificação que substitui o palpite

As 23 migrations do refactor (0056 a 0080) nunca rodaram em produção, e a 0056 aperta
`organizacao_id` para NOT NULL em quatro tabelas financeiras e cria três chaves
estrangeiras. Uma linha nula ou uma referência órfã faz a migration falhar no meio do
deploy.

O clone local é de 20/09 e **não é prova sobre produção**: um dia de operação cria linha
nova. Por isso existe um verificador que roda apontando para o banco de produção, com a
aplicação no ar, e é somente leitura:

```bash
DATABASE_URL="postgres://...prod..." pnpm --filter app check:pre-deploy
```

Ele conta as linhas que impediriam cada `ALTER TABLE`, mostra a consulta para encontrar
cada uma, e lista quais migrations aquele banco já tem. Sai com código 1 quando não está
pronto. No clone local: **nenhum impedimento, 8 de 8 marcos aplicados**.

### Achado operacional: o worker mantém dois pools de conexão

Medido ao revisar uma mudança minha. `sdr-escalation` declara no topo que recebe `db`
por parâmetro porque o worker cria a própria instância, e eu tinha introduzido um import
que furava isso. Corrigido naquele módulo.

Ao varrer o resto: **10 dos 31 módulos que o worker importa também importam
`@/lib/db`**, então o padrão é anterior a este refactor e vale hoje em produção.

| Processo | Pool próprio | Pool da aplicação | Total |
|---|---|---|---|
| worker | 5 | 15 | **20** |
| web | — | 15 | 15 |
| api | — | 15 | 15 |

`max_connections` do Postgres é 100. Com um container de cada, são 50. Não é bloqueio, e
não mexi: consolidar os 10 módulos é refatoração própria, e trocar o pool do worker pela
instância da aplicação muda o comportamento de conexão de um processo que roda sozinho a
noite inteira. Fica medido e nomeado para decisão.

## Ensaio da virada com dump fresco — 21/09/2026

Um dump de produção das 12:31 foi restaurado num banco rascunho e a receita
inteira aplicada, para responder uma pergunta só: **uma produção virgem chega ao
mesmo estado do banco de dev?** Chega — depois de duas correções que o ensaio
expôs e que o banco de dev nunca teria acusado.

**1. Quatro migrations materializavam contra tabela vazia.** 0069, 0081, 0084 e
0085 carregam um UPDATE junto da mudança de schema. Em dev funcionou porque o
canônico já estava populado; numa produção virgem elas rodam antes dos backfills
e tocam zero linhas.

| Medido antes da correção | |
|---|---|
| aquisições sem vínculo com o lead | 3.991 de 3.991 |
| aquisições sem etapa canônica | 3.991 |
| estagnações canônicas | 0, contra 229 no legado |
| trials canônicos | 0, contra 17 no legado |

A correção não apaga o fallback de leitura: entra como
`backfill/16-materializacao-canonica.ts`, que roda **depois** dos backfills, é
idempotente (só toca linha cujo destino ainda está NULL) e independe da ordem em
que o banco foi construído. Segunda execução encontra zero.

**2. O backfill de comunicações descartava 790 mensagens de WhatsApp.** Um
`JOIN contatos` interno: as 790 têm `contato_id` nulo e **todas as 790 têm
`lead_id`**, então a organização era resolvível. O banco de dev não acusava
porque a escrita de runtime as inseria por outro caminho — duas regras para o
mesmo fato, que é o defeito que este refactor existe para acabar. Virou LEFT
JOIN com a organização vindo do contato ou do lead. Depois: 25.696 de 25.696.

Os 1.807 e-mails que ficam de fora **não** são o mesmo caso: são
`message_id` repetidos (1.185 duplicados em 2.941 linhas), e `communications`
tem UNIQUE por canal e id externo justamente para isso.

### Resultado do ensaio

`tsc` limpo · **25 de 25 smokes** · aceite **97/0** · paridade **13/14** —
os mesmos números do banco de dev. As contagens ficam levemente acima (leads
3.991 contra 3.989) porque o dump é de hoje: é produção andando.

O procedimento de virada unificado está em `entrega-final.md`, seção 8.
`scripts/ensaio-carga.sh` faz a carga e `scripts/rodar-backfills.sh` os backfills.

## Conclusão do ONFACE (Documento Mestre v0.13) — checkpoints

Plano por dependência, não pela ordem dos módulos. O que já entrou:

### CP1 — a implantação nasce no handoff, não no Won

Auditado antes de construir, como pedido. "0 fulfillments IMPLEMENTATION" não
era ausência de código: o runtime cria a jornada e o smoke prova. Os 200
serviços PABX/White Label sem implantação são históricos do backfill e nunca
passaram pelo Won canônico.

A auditoria achou outra coisa: o comando canônico criava ONBOARDING E
IMPLEMENTATION no mesmo instante do ganho, e o v0.13 §06.1 é literal —
"Implantação não nasce automaticamente no Won". Criada ali, a jornada técnica
nascia sem kickoff, sem material e sem implantador, que são justamente o gate
do Módulo 05.

`jornadasNoGanho` separa o que o fechamento cria do que a oferta exige;
`lib/pos-venda/handoff-implantacao.ts` é o comando do handoff, com o gate
lendo fatos (reunião realizada ou item de kickoff concluído, arquivo vinculado
ou material concluído, responsável definido). Rotas GET/POST — o GET devolve o
que falta, para a tela explicar o botão em vez de escondê-lo.

### CP2 — Metric Catalog mínimo

O Módulo 12 exige "uma métrica = uma definição oficial". Medido: a palavra MRR
saía de **oito** expressões no repositório, com números que variavam oito vezes.

| fonte | valor |
|---|---|
| `negocios.mrr_fechado` (ganhos) | R$ 497.904,42 |
| `servicos_canonicos.current_recurring_value` | R$ 426.619,39 |
| `assinaturas.mrr` | R$ 61.769,55 |
| `mrr_movimentos` (deltas) | R$ 81.308,35 |

Não eram erros de soma: são conceitos diferentes com o mesmo nome. O primeiro é
booking acumulado desde sempre, o segundo o recorrente atual, o terceiro só o
que está no Stripe (o PABX legado não está), o quarto o livro de movimentos.

Seis métricas, mínimo de propósito: as quatro que o Módulo 11 manda separar
(`mrr_atual`, `booking_ganho`, `faturado`, `recebido`) mais `clientes_ativos` e
`oportunidades_abertas`. Cada uma declara tipo (EVENT/SNAPSHOT/COHORT), fonte em
português, **o que não inclui** e drill-down até os registros reais.

A definição mora em código versionado; `metric_catalog` é o espelho para
descoberta e para o NEXO consultar em vez de inventar.

**Convergência feita, não declarada.** O KPI global de MRR do Command Center e
o de `lib/cs/metricas.ts` passaram a chamar `medir(org, "mrr_atual")`. As
agregações por empresa de `lib/cs/agenda.ts` e `painel.ts` são outra
granularidade e continuam, mas ganharam o filtro de ciclo de vida que faltava —
sem ele, serviço CHURNED somava no MRR da conta.

A definição canônica adotou `portfolio_included`, que a tela operacional já
usava: a diferença de R$ 1.000 entre as duas era **um** serviço de família
UNKNOWN marcado fora do portfólio. Adotar a decisão registrada no dado é
diferente de inventar uma terceira.

Trava: `arquitetura/metrica-definicao-unica.test.ts` proíbe soma global de
recorrente fora do catálogo, exige `naoInclui` e drill-down em toda métrica, e
exige que os quatro conceitos financeiros existam com o tipo certo.

### CP3 — CS Health calculado, explicável e materializado

A auditoria tinha mostrado que o motor estava vivo e faltava só o score:

| Perna | Estado antes |
|---|---|
| cálculo de risco | **existia** — `reavaliarRiscos`, 514 riscos reais |
| scheduler | **existia** — job `cs-sweep` no worker |
| painel/UI | **existia** — `painelCs`, `lib/cs` com 3.353 linhas |
| score de health | não existia |
| materialização | não existia — `cs_health_snapshots` com zero escritores |

`lib/cs/health.ts` entra com sete fatores observáveis: riscos abertos por
severidade, faturas vencidas, dias sem interação, jornada de entrega parada há
mais de 45 dias e uso real do Callface AI. Cada fator devolve estado, a
**evidência numérica** que o produziu e quanto tirou de 100 — o `factors` do
snapshot é o que a tela mostra, então "por que esta conta está em risco?" tem
resposta sem abrir código.

**Dado ausente não vira nota.** Fator sem dado fica `desconhecido` e NÃO tira
ponto; a cobertura do score fica visível. Contar ausência como problema faria
toda conta sem integração parecer doente, e contar como saúde faria o oposto.

Ligado no sweep que já rodava, depois dos riscos — ele lê os riscos abertos
como fator, e rodar antes daria a foto de ontem.

Medido contra o banco real: **275 contas — 254 saudáveis, 14 em atenção, 7 em
risco**, cobertura média 76%. Idempotente por (empresa, dia, versão): reexecutar
atualiza, não empilha. O Cliente 360 passou a expor o health com os fatores.

Efeito de integração entre módulos: a conta de pior score tem entre os fatores
"Uso do Callface AI: 35 dias sem atividade" — o Product Data alimentando CS,
que é o que o Módulo 13 pede.

**Resíduo corrigido junto:** `smoke-meta-lead-ads` aninhava a limpeza da pessoa
dentro do if da aquisição, e o caso comum é o outro — o lead da Meta cai numa
aquisição existente E cria pessoa nova. Uma pessoa ficou para trás e o teste de
reconciliação a pegou como "apareceu do nada". A limpeza passou a decidir a
pessoa por contagem própria, com rede de segurança para pessoa sem proveniência.

### CP4 — CalendarProvider: reagendar chega na agenda

O gap era conhecido e foi confirmado no código antes de escrever: existia criar
(`criarEventoOutlookParaReuniao`) e existia ler de volta (`syncOutlookReunioes`).
**Não existia atualizar** — o cliente Graph tinha create, get e delete e mais
nada. `PATCH /reunioes/:id` mudava a data no ONFACE e só avisava o provedor
quando o status virava "cancelada": reagendar deixava o convite antigo de pé na
agenda do cliente, sem ninguém ser avisado.

| Peça | Estado |
|---|---|
| `CalendarProvider` | criado — create, update e cancel, com falha classificada |
| Adapter Microsoft | **reusa** o cliente Graph existente; ganhou o `updateOutlookEvent` que faltava |
| Adapter Google | implementado (REST puro, sem SDK). **Sem credencial neste ambiente** |
| Rota | `PATCH /reunioes/:id` chama o provider ao mudar data, título ou duração |
| Falha | vira `calendar_sync_status` com o erro, e a tela recebe frase em português |
| Reprocessamento | job `calendar-sync-retry` a cada 10 min |

**Cinco caminhos chamavam o Graph direto, não dois.** A trava encontrou
`reunioes.ts`, `leads.ts`, `agenda.ts`, `callface.ts` e o helper
`outlook-evento.ts` — este último **sem nenhum chamador**, o defeito recorrente
de peça pronta sem caller. O helper passou a delegar ao provider; os quatro
restantes continuam e são cobertos pela ponte.

**A ponte que impede convite duplicado.** As rotas antigas gravam só
`outlook_event_id`. O provider lê
`COALESCE(calendar_event_id, outlook_event_id)`: sem isso, reagendar uma reunião
criada por elas acharia que nunca houve evento externo e criaria um SEGUNDO
convite na agenda do cliente.

Bloqueio real registrado: **Google Calendar não tem credencial de aplicação**
(`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`). O adapter existe inteiro e
responde `nao_configurado`; o CRM segue funcionando.

### CP5 — Pré-vendas: kanban único, tag com porta e ação em massa que não mente

**CP5.1 — o board deixou de ter abas.** As abas Ativos/Nutrição/Desqualificados
escondiam três terços da operação um do outro. As sete situações passaram a
viver no mesmo kanban, e o que era navegação virou informação: o resumo continua
dizendo quantos há em cada situação, sem esconder nenhuma.

**CP5.2 — a porta de tag e as ações em massa.** `adicionar/removerTag` estava
escrito DUAS vezes (`cadence-engine` e `ai-platform/tools/registry`), e as duas
cópias mexiam em três tabelas e publicavam o evento. Escrever a ação em massa
por fora faria a terceira. Consolidado em `lib/crm/tags.ts`.

As cinco ações em massa (`lib/vendas/acoes-em-massa.ts`) devolvem desfecho **por
registro**, não por lote: 40 enviados com 10 ignorados por telefone inválido é
um resultado útil; "falhou" não é. Teto de 500 por lote, isolamento por
organização dentro do `carregarAlvos`, e cada ação entra pela porta que já
existe em vez de reimplementar regra.

### CP6 — Pipeline: board único e o checklist que explica o fechamento

**O board.** Mesma doença das abas de Pré-vendas, do outro lado do funil:
Abertas/Ganhas/Perdidas eram três telas. Ganho e Perdido não são outra tela —
são o fim da mesma esteira. As seis colunas passaram a viver na mesma linha,
com as duas fechadas **colapsadas** (`<details>` nativo, sem estado novo) e
marcadas `aceitaDrop: false`: Ganho nunca é alcançado arrastando (§04) e perda
exige motivo.

A `expressaoDeEtapa` já era compartilhada entre cards e totais; agora a lista de
colunas também nasce de um lugar só — `aba === null` devolve as seis, e a aba
sobrevive apenas para link antigo salvo.

**O checklist de fechamento** (`lib/vendas/checklist-fechamento.ts`) responde a
pergunta que sobra no drawer — *o que ainda falta para esta venda fechar?* —
sem virar um botão de "tentar fechar como ganho": Won acontece sozinho quando a
evidência exigida pela oferta chega.

NADA nele decide ganho. Estado dos itens e lista do que falta vêm de
`avaliarGanho`, no domínio. Reimplementar o critério ali criaria a segunda regra
de Won, que é exatamente o que o Módulo 04 proíbe.

Três detalhes que o dado real cobrou:

- Oferta que não exige contrato mostra `—`, não "pendente": pendente sugere que
  falta algo, e não falta.
- Ganho na assinatura com pagamento em aberto é estado **normal** — o checklist
  diz "esta oferta fecha na assinatura, e a cobrança segue no Financeiro" em vez
  de parecer um erro.
- As 1.085 oportunidades sem oferta vinculada **não ganham uma regra suposta**:
  o checklist diz que a regra de fechamento delas não está definida.

O componente do checklist vive em `vendas/ui.tsx` e serve o drawer e a página de
detalhe. Duas cópias divergiriam, e uma delas acabaria decidindo ganho sozinha.

**Validação:** tsc limpo, **291 testes 0 falhas**, build exit 0, **29/29
smokes**. `/pipeline` devolve as seis colunas com duas colapsadas e
`/pipeline/<id>` mostra o checklist com a regra da oferta em português —
conferido contra build de produção, porque o servidor em pé estava servindo
chunk antigo e a primeira medição deu falso negativo.

### CP7 — Financeiro: Booking, Billing, Cash e MRR deixaram de ser um número só

O módulo Financeiro já era grande — camada de métricas, seis abas, rotas de API,
importador PABX. O gap não era ausência: era **conflação**, e ela estava
medida errada em três lugares.

**1. A aba PABX mostrava zero e a aba Callface AI mostrava a empresa inteira.**
O filtro de produto era `COALESCE(c.produto,'ai')` e **nenhum** dos 598
contratos ativos tem `produto = 'pabx'` (263 têm produto NULL). Resultado: PABX
com R$ 0,00 em tudo, e os **R$ 368.049,69** de MRR de PABX reportados como
receita de Callface AI. O cabeçalho do arquivo prometia "receita SEMPRE
segmentável por produto" e entregava o oposto.

A quebra real está em `servicos_canonicos.service_family` — PABX 182 serviços /
R$ 368.049,69, CALLFACE_AI 142 / R$ 53.505,10, WHITE_LABEL 4 / R$ 4.064,60.
A segmentação passou a sair daí.

**2. "Recebido" somava valor de face de fatura, não pagamento.** Dez faturas do
Stripe estavam marcadas `paga` sem **nenhum** pagamento registrado (nem
`amount_paid` nem `charge` no `raw`), e os **R$ 2.308,80** delas entravam como
caixa. Agora saem para `reconciliar`, visível na tela: fatura marcada paga sem
pagamento é caso de reconciliação, não dinheiro que entrou.

**3. `receitaPrevista` somava `contratos.mrr`**, a base que o próprio arquivo
declarava não canônica desde 14/09 — R$ 428.122,03 contra os R$ 425.619,39
canônicos.

Além disso a contagem que acompanha o MRR contava contrato: a aba dizia
"R$ 57.569,70 de **598** assinaturas ativas". Passou a contar o que o número
soma (146), e a taxa de inadimplência de Callface AI passou de 7,3% (dividida
pelos 598 da empresa) para os **16,4%** reais do segmento.

Uma quarta cópia das mesmas duas definições vivia em
`api/financeiro/inadimplencia/route.ts`. Foi removida: a rota passou a chamar
`getFluxoMes`.

| | MRR | Faturado | Recebido | Reconciliar |
|---|---|---|---|---|
| Callface AI | 57.569,70 | 41.394,71 | 26.282,21 | 10 / 2.308,80 |
| PABX | 368.049,69 | 0 | 0 | 0 |
| **total** | **425.619,39** | 41.394,71 | 26.282,21 | 10 / 2.308,80 |

PABX zerado em faturado e caixa é **honesto**: a planilha mensal da Holding
ainda não foi importada. Antes o zero vinha de filtro quebrado; agora vem de
dado ausente, e é possível distinguir os dois.

Dois testes travam o que foi consertado: os segmentos precisam somar o MRR
canônico (com PABX > 0, que é o sintoma), e `recebidoMes`/`faturadoMes` precisam
ser o mesmo número das métricas `recebido`/`faturado` do catálogo.

**Validação:** tsc limpo, **293 testes 0 falhas**, build exit 0, **29/29
smokes**, `/api/financeiro/metricas` e `/api/financeiro/inadimplencia` (nos três
produtos) conferidas contra build de produção com dado real.

### CP8 — Onboarding e Implantação: o board universal já existia e ninguém o abria

Auditoria antes de construir. O módulo tem 5 tabelas, 25 fulfillments reais,
1.659 itens de checklist, telas de board e de detalhe, checklists por família
derivados de processos reais. Não faltava jornada. Faltavam três ligações.

**1. White Label era invisível no próprio board.** A rota devolvia
`fase: null` **e** `etapa_atual: null` para ele, com um comentário dizendo
"zero registro real hoje" — e havia registro, com checklist preenchido. Pior:
os itens do White Label nem eram carregados (`todosIds` filtrava só
CALLFACE_AI e PABX). Quem abria a tela via a entrega existir e não via onde ela
estava. Agora tem `FASE_WHITE_LABEL_POR_WORKSTREAM`, derivada da ordem do
próprio `WHITE_LABEL_CHECKLIST`, e a entrega real saiu de `null` para
`fase = validacao`.

**2. O board que cobre as três famílias não tinha um único link.** O
comentário no componente dizia o quanto: *"sem `familiaFixa`, mostra o seletor
e cobre as 3 famílias juntas (uso interno, não mais linkado nos tabs do
módulo)"*. É o defeito recorrente deste repo — peça pronta, sem chamador — e
aqui custava ver a entrega do produto errado. Entrou como aba "Todas", e é o
padrão da página.

**3. O mapa de marcos estava escrito duas vezes.** `OnboardingDetail.tsx`
mantinha uma cópia de `MARCO_AI_POR_WORKSTREAM` — idêntica hoje, o que é pior
que divergente: parece segura até alguém editar um lado só. A causa era
mecânica: o mapa morava em `lib/crm/fulfillment.ts`, que importa `db`, e Client
Component que o importasse quebraria o build. O vocabulário mudou para
`pos-venda-checklists.ts`, que é puro, e `fulfillment.ts` reexporta.

**O que NÃO foi feito, de propósito.** O plano falava em "6 fases universais".
O código registra que a primeira versão do board comprimiu a jornada de
Callface AI em 4 fases genéricas e o Kauã reprovou — *"muito simplório"* — e o
guia real tem 10 marcos. Forçar um enum de seis fases repetiria o erro. O que
virou universal foi o **board**; o vocabulário de cada família continua sendo o
do processo real dela, e o card responde na língua do seu produto.

**O teste achou um defeito na hora de rodar.** A cobertura mapa × checklist
acusou `conclusao` (o handoff para o CS, último passo do White Label) sem fase:
enquanto esse item estivesse pendente o fulfillment não é COMPLETED, então
cairia no fallback e uma entrega quase pronta apareceria em "Planejamento".

**Validação:** tsc limpo, **297 testes 0 falhas**, build exit 0, **29/29
smokes**, `/api/fulfillments` conferida com dado real (25 entregas, todas com
fase ou marco) e `/clientes/implantacao` renderizando a aba Todas.

### CP9 — Loops abertos: o Next Step Invariant virou fila

O contador já existia. `boardPipeline` devolvia `semProximaAcao` e a tela
mostrava "527 sem próxima ação" no topo. **Não havia filtro, rota nem lista**,
então o operador via o problema e não tinha para onde ir.

Medição em dado real: **527 de 527** oportunidades abertas sem próximo passo.
Não é atraso do time, é mecanismo que nunca disparou (`definirProximaAcao` é
recente e só roda quando alguém abre o modal).

`lib/vendas/loops-abertos.ts` monta a fila derivada de sinal real, mesma
decisão de `lib/cs/fila` (uma "tabela de loops" estaria dessincronizada no
minuto seguinte). Quatro motivos, todos medidos:

| motivo | quantos |
|---|---|
| sem próxima ação | 527 |
| parada há +14 dias | 324 |
| proposta enviada há +7 dias sem desfecho | 74 |
| sem responsável | 3 |

**928 loops em 527 oportunidades, R$ 477.191,68 parados.** O item no topo é uma
proposta de R$ 33.930,00 enviada há 11 dias sem resposta; outra de R$ 9.251,80
está esperando há 61.

**NADA cria próxima ação.** As 527 ficam como estão: inventar um follow-up para
cada uma seria fabricar combinado que ninguém fez. A fila mostra, e quem resolve
é o dono por `definirProximaAcao`, que continua sendo a porta única.

Duas correções de caminho vieram junto:

- `boardDeOportunidades` escrevia as condições de filtro **duas vezes** (cards e
  totais). Filtro aplicado num lado só faz a coluna mostrar N cards enquanto o
  cabeçalho dela anuncia outro número. Unificadas antes de acrescentar a nova.
- 284 das 527 oportunidades abertas não têm empresa canônica. Sem cair no lead,
  a fila entregaria linha sem nome, e linha sem nome não é acionável.

### CP10 — Intelligence Runtime: publicar sem credencial calava o atendimento

Auditoria primeiro, e ela corrigiu uma conclusão minha. O runtime **tem**
chamador: `worker/index.ts` chama `executeAgent` por import dinâmico relativo
dentro de `handleAiSdrResponse`. Uma varredura textual não acha, porque o
caminho do import é o mesmo texto que se costuma filtrar.

O estado real medido: 28 tabelas `ai_*`, 2 agentes (NEXO e Hermes), 2 versões,
**0 execuções**, **0 credenciais de provider**. Os dois apontam para
`anthropic` / `claude-sonnet-4-6`, e o ambiente só tem `GROQ_API_KEY`.

**O defeito.** O gate de publicação conferia provider, modelo, instruções e
gatilho. Não conferia credencial. Publicar o NEXO hoje passaria nas quatro
checagens; na primeira mensagem do cliente, `resolveApiKey` levanta
"Credencial anthropic não configurada", e o worker **não cai no SDR legado** —
por decisão explícita e correta, porque cair geraria resposta duplicada. O
resultado seria o contato escrevendo e ninguém respondendo, com um
`console.error` no servidor como único sinal.

`lib/ai-platform/prontidao.ts` responde "este agente consegue rodar?" e devolve
o que falta em português, com a consequência junto: *"cadastre uma chave de
Anthropic em Integrações. Sem ela o agente é acionado, falha na chamada e o
contato fica sem resposta."* As quatro checagens antigas foram absorvidas — uma
lista só, usada pelo publish e pelo endpoint que a tela consulta antes de
tentar, porque duas listas de requisito divergem e a que diverge é sempre a que
o usuário lê.

A prontidão pergunta se a credencial **existe**; nunca lê, decifra ou loga o
valor. Um teste trava isso, e outro trava a divergência entre as variáveis de
ambiente que o gate consulta e as que o runtime realmente usa.

**BLOQUEIO REAL que permanece:** sem credencial Anthropic (ou sem repontar os
agentes para Groq, que é decisão de produto), NEXO e Hermes não executam. O
que dependia de credencial parou aqui; o que não dependia está feito.

### CP11 — Relatórios: a liderança via 22% do pipeline

Mesma medição do CP7, aplicada aos relatórios: o número que o relatório mostra
bate com o que a tela mostra?

Não batia. `getPipelineAtual` dizia **116 negócios abertos e R$ 160.789,35**; o
board dizia **527 e R$ 477.191,68**.

A causa: o relatório contava `negocios.status` filtrando pelos 5 estágios de
`DEFAULT_STAGES`, e negócio aberto tem **11** status distintos no banco. Os 6
de fora:

| status | negócios | valor |
|---|---|---|
| `outra_data` | 153 | 67.726,11 |
| `ativo` | 146 | 188.527,84 |
| `sem_retorno` | 54 | 9.275,10 |
| `no_show` | 38 | (sem valor) |
| `trava_negociacao` | 17 | 50.693,38 |
| `trava_assinatura` | 3 | 179,90 |
| **total** | **411** | **316.402,33** |

R$ 316.402,33 de pipeline aberto fora do relatório que a liderança usa para
decidir, sem nada na tela indicando o recorte. O bloco maior é `ativo`
(R$ 188.527,84) e o mais sensível é `trava_negociacao` (R$ 50.693,38), que é
literalmente negócio travado na etapa final.

Duas correções, nenhuma delas um número novo inventado:

1. `getPipelineAtual` passou a ler `oportunidades`, a MESMA fonte do board, e
   agrupar pelas 4 etapas canônicas. Os dois lados batem por construção, não
   por coincidência. O forecast ponderado subiu de R$ 102.620,88 para
   R$ 185.296,90. As probabilidades vieram das etapas legadas equivalentes;
   `trial` saiu porque no canônico trial é estado, não etapa.
2. `PIPELINE_ATIVO_STATUSES` passou a cobrir todo negócio aberto. Ela tinha
   mais **dois** consumidores com o mesmo defeito (`pipeline-crm2.ts` e
   `analytics/vendas.ts`), então o conserto na constante arruma os três. Por
   exclusão e não por enumeração: status novo entra como aberto, porque
   enumerar foi o que fez os 6 sumirem em silêncio.

`no_show` conta como aberto, coerente com a Fase 26 (no-show é estado da
reunião, não perda). É o que faz os dois lados fecharem em 527 exato.

**O que NÃO foi feito.** O filtro por produto dos relatórios está pela metade
em três camadas: `produtoCondNegocios`/`produtoCondContratos` sem chamador (e o
segundo aponta para uma coluna onde `pabx` nunca aparece), `KpiBar.tsx` sem
chamador, e a rota `/relatorios/resumo` aceita `?produto=` e ignora. **Não
existe seletor de produto na interface**, então nada mente hoje para o usuário;
é funcionalidade ausente, não defeito. Construir só o backend seria backend sem
jornada. Fica registrado, e a fonte certa quando for feito é
`oportunidades.service_family` (PABX 139, CALLFACE_AI 327, WHITE_LABEL 11,
**1.084 sem família** — o bloqueio que já depende do Kauã).

**Validação:** tsc limpo, **303 testes 0 falhas**, build exit 0, **29/29
smokes**, e `/relatorios/comercial` conferida na rota real devolvendo 527 e
R$ 477.191,68, iguais ao board.

### CP12 — Integration Hub: a tela mostrava uma integração e escondia cinco

A tela de Integrações listava TRÊS cartões: Apollo, e dois com a palavra
`(placeholder)` escrita no próprio código (Meta Conversions API e Google Ads).
Enquanto isso, rodando em produção e invisíveis na tela:

| integração | sinal real | último |
|---|---|---|
| Callface (discador) | 4.918 ligações | 18/09 |
| Stripe | 828 faturas | 20/09 |
| Meta Lead Ads | 797 leads | 18/09 |
| Callface AI (dados do produto) | 208 snapshots | 20/09 |
| Microsoft 365 (agenda) | 58 reuniões | 18/09 |

Quem abria a tela concluía que o produto tinha **uma** integração configurada.

`lib/integrations/inventario.ts` deriva o estado de cada uma de sinal no banco,
nunca de lista declarada: "em uso" exige volume e data; "configurada" é a
credencial existir; "não configurada" vem com o que falta, em português. É a
mesma pergunta do CP10 (`ai-platform/prontidao`) e a mesma disciplina: pergunta
se a credencial existe, nunca lê o valor.

**Um defeito meu, que a conferência pegou.** A primeira versão tinha
`.catch(() => [{ n: 0 }])` em volta da consulta. Duas consultas estavam erradas
(`event_outbox.destino` e `cliente_receita_mensal.calculated_at`, colunas que
não existem) e o catch as transformou em "integração sem uso". Zero por falha e
zero por ausência de dado são coisas diferentes, e confundir as duas é
exatamente o defeito que este refactor inteiro existe para acabar. O catch
saiu: agora a falha aparece na linha da integração, com a mensagem.

Três travas: consulta quebrada não pode devolver estado falso; "em uso" sem
volume ou sem data é erro; e a tela não pode voltar a ter cartão de placeholder.

**Achado que ficou visível:** Meta Conversions API está **configurada e com
zero entregas**. O token existe, o smoke passa, e nenhuma conversão foi
entregue de verdade. Não mexi: agora está na tela para quem decide olhar.

**Validação:** tsc limpo, **306 testes 0 falhas**, build exit 0, **29/29
smokes**, `/ajustes/integracoes` respondendo 200 contra build de produção.

### CP13 — Autoverificação: eu tinha produzido o defeito que estava caçando

Ao fechar os checkpoints, varri o que criei nesta rodada perguntando o que o
repo me ensinou a perguntar: **isso tem chamador de verdade?**

Dez dos onze módulos tinham. `lib/vendas/loops-abertos` não: eu havia ligado na
tela apenas o FILTRO do board, e a fila em si só era chamada pelo smoke. Ou
seja, produzi "peça pronta sem caller" exatamente no checkpoint em que estava
caçando esse defeito.

A fila é mais rica que o filtro. O filtro recorta "sem próxima ação"; a fila
mostra também proposta sem resposta há 61 dias, oportunidade parada há mais de
14 dias e oportunidade sem dono, ordenadas por valor.

O recorte passou a mostrar a fila junto: *"527 oportunidades com loop aberto ·
R$ 477.192 parados · 527 sem próxima ação · 74 proposta sem resposta · 324
paradas há mais de 14 dias · 3 sem responsável"*, conferido na rota real. O
resumo só é consultado quando o recorte está ativo, porque é uma pergunta a
mais no banco.

**Nota sobre o método.** A varredura por texto errou duas vezes nesta sessão,
nas duas por import relativo: primeiro me fez concluir que `executeAgent` não
tinha chamador (tinha, no worker), depois que `checklist-fechamento` não tinha
(tem, em `consultas.ts`). Grep de caller precisa casar o **nome do módulo**, não
o caminho completo, senão o import relativo escapa.

**Validação:** tsc limpo, **308 testes 0 falhas**, build exit 0, **29/29
smokes**, `/pipeline?loop=sem-proxima-acao` conferida contra build de produção.

### CP14 — Auditoria das portas de escrita, e um bump que envenenava o board

A dívida central registrada no HUB é a porta de escrita: em 20/09 eram **39
lugares escrevendo em `leads` com 3 passando pela regra**, 26 em `negocios` com
1, e 13 em `tarefas` com 1.

Medição de 21/09, pelo mesmo critério de arquivo:

| entidade | arquivos que escrevem | em `lib/vendas` ou `lib/crm` |
|---|---|---|
| `leads` | 26 | 8 |
| `negocios` | 12 | 4 |
| `tarefas` | 11 | 4 |

Os 18 arquivos que escrevem em `leads` por fora foram abertos um a um, e a
maioria **não fura regra nenhuma**: `email.ts` e `whatsapp.ts` mexem em
contadores de não lidas, `notas.ts` toca a data, `cleanup-seed` é limpeza de
seed. Contador de leitura não é fato comercial.

**O defeito real estava em outro lugar.** `lib/integrations/rd-criativo.ts`
preenchia `utm_content`/`utm_term` a partir do RD Station e bumpava
`updatedAt` junto. Só que `leads.updated_at` não é "quando a linha mudou": o
board de Pré-vendas ordena por ele e o badge "Xd na etapa" sai dele. Na
prática é **quando alguém trabalhou este lead**.

Medido: a rotina alcança **2.253 leads**, e **2.006 deles estão parados há mais
de 14 dias**. Rodar o enriquecimento jogaria os 2.006 para o topo do board de
uma vez, como se tivessem acabado de ser trabalhados. O mesmo defeito já tinha
acontecido com 216 leads, quando o board passou a mostrar "17min" em tudo.

Os outros dois pontos que bumpam foram conferidos e estão **certos**:
`callface.ts` bumpa depois de ligação atendida (atividade real, e o comentário
já dizia isso) e `stripe-sync.ts` bumpa junto com mudança de status.

A trava não proíbe bumpar: exige justificativa registrada. Integração nova que
bumpe sem entrar na lista quebra o teste, e a lista obriga a escrever qual fato
justifica.

**Validação:** tsc limpo, **310 testes 0 falhas**, **29/29 smokes**.

### CP15 — O backfill da virada apagava o histórico de trabalho do board

Continuação do CP14, com a mesma lente sobre `oportunidades`. A porta está
fechada: só `lib/vendas/pipeline.ts` e o repositório escrevem lá fora de
scripts. O problema estava nos **backfills, que rodam na virada**.

Quatro bumpam `updated_at`. Três deles tocam `contratos`, `propostas`,
`clientes`, `servicos_canonicos` e `faturas` — nenhuma governa board, então são
inofensivos. O **08-oferta-comercial** toca `oportunidades`, e essa governa.

**A prova, medida neste banco:**

| oportunidades abertas | quantas | `updated_at` |
|---|---|---|
| **sem** família | 401 | espalhado de 09/02 a 21/09 |
| **com** família | 126 | **todas em 21/09** |

As 126 com família são exatamente as que o backfill vinculou hoje. Perderam a
data de quando alguém as trabalhou. Em produção, na virada, isso atingiria
**477 de uma vez**, e a operação abriria o board no primeiro dia com tudo
parecendo recém-tocado.

**O dano já estava feito neste banco, e foi revertido.** A oportunidade nasce do
negócio legado, e `negocios.updated_at` não foi contaminado: 125 das 126
divergiam. Restaurada a data de origem, sem inventar nada. O efeito na fila de
loops abertos do CP9:

**paradas há mais de 14 dias: 324 → 392.** Havia 68 oportunidades paradas
escondidas pelo bump, e a fila as mostrava como recém-trabalhadas.

A trava do CP14 ganhou um terceiro teste, para as tabelas cujo `updated_at`
significa "quando alguém trabalhou isto": `oportunidades`, `leads`, `negocios`,
`aquisicoes`. Verificada por reintrodução do defeito: falha com ele, passa sem.

**Validação:** tsc limpo, **311 testes 0 falhas**, **29/29 smokes**. A trava de
crase em comentário SQL que já existia no repo pegou o meu comentário novo na
primeira rodada, e funcionou como devia.

### CP16 — Varredura fechada: quem pode bumpar o relógio, e por quê

Varredura de todo o `src` atrás de escrita em `updated_at` nas quatro tabelas
cujo relógio significa trabalho feito (`leads`, `negocios`, `oportunidades`,
`aquisicoes`): **25 arquivos**. A maioria é fato real e deve bumpar mesmo —
mover etapa, processar mensagem, registrar toque de cadência, ligação atendida.

Dois candidatos foram abertos e **não eram defeito**, o que só se descobre
olhando:

- `lead-scoring.ts` bumpa ao recalcular o score, mas o score só é enfileirado
  **depois** de criação ou edição real do lead. O `updated_at` já foi bumpado
  pelo fato que veio antes; o do scoring é redundante, não danoso.
- `oportunidade-bundle.ts` muda `bundle_id` e título juntos, o que é ação de
  alguém agrupando negócios.

Um era, com impacto baixo: `backfill-valor-negocios.ts` preenchia
`mrr_fechado` e bumpava junto. Ele não roda na virada, é manual, e só toca
`status = 'ganho'`, que não aparece no board de trabalho. Corrigido pela regra,
não pelo risco.

Esse último expôs um buraco na trava do CP15: ela olhava só
`src/scripts/backfill/`, e esse arquivo mora solto em `src/scripts/`. A trava
passou a cobrir os dois, e foi verificada por reintrodução nos dois lugares.

**Validação:** tsc limpo, **311 testes 0 falhas**, **29/29 smokes**.

### CP17 — O lead do site andava no legado e parava na tela

Última lente da dívida central: quem move **fato comercial** do negócio
(`status`, ganho, perda) sem passar pela porta.

Seis arquivos. Três são a porta (`lib/vendas/pipeline`, `lib/crm/won-evidence`,
`lib/crm/converter-oportunidade`). Dos três de fora, dois **já propagavam** e
diziam isso no código: `api-server/routes/leads.ts` e
`lib/cadencia/cadence-engine.ts` chamam `syncOportunidadeFromNegocio`.

O terceiro não. `worker/index.ts`, no caminho do formulário do site: a IA gera
o insumo comercial, o worker move o negócio para `reuniao_agendada` e registra
em `status_changes` — e a oportunidade canônica ficava para trás. Como o board
lê `oportunidades.etapa` desde a fase 17, quem abrisse a tela veria a etapa
antiga. O lead entra, a IA trabalha, e o board não mexe.

**A divergência medida era zero**, e isso não absolve: os 24 negócios em
`reuniao_agendada` vieram do backfill, não desse caminho. Defeito latente
aparece em produção, no primeiro formulário preenchido.

A trava exige o par: arquivo que escreve `negocios.status` fora de
`lib/vendas`/`lib/crm` precisa chamar a propagação. Verificada por remoção da
chamada — os dois testes falham sem ela.

**Validação:** tsc limpo, **313 testes 0 falhas**, **29/29 smokes**.

### CP18 — `tarefas` auditada: saudável, sem pendência

Última das três entidades da dívida central. Onze arquivos escrevem em
`tarefas`, e o que importa mede bem:

- **Isolamento por organização: 11 de 11.** Nenhuma escrita sem tenant.
- **Idempotência onde importa:** das tarefas criadas por código, 36 de origem
  `BILLING` e 1 de `AUTOMACAO` têm todas chave de idempotência. As 426 sem
  chave são `MANUAL`, onde exigir chave impediria alguém de criar duas tarefas
  parecidas de propósito.
- **Duplicatas reais: 5 grupos, 5 linhas a mais**, e as cinco são `MANUAL`.
  Pessoa criando duas vezes não é defeito de sistema.

Dois dos onze escritores moram em `app/onface-desenho/`, que é referência
congelada e não roda no produto.

Nenhuma correção necessária. Registrado porque "auditado e está certo" é
resultado, e sem registro alguém audita de novo daqui a um mês.

### Fechamento da auditoria da dívida central

O HUB registra a medição de 20/09: 39 lugares escrevendo em `leads` com 3
passando pela regra, 26 em `negocios` com 1, 13 em `tarefas` com 1.

Resultado de 21/09, entidade por entidade:

| entidade | veredito | o que foi achado |
|---|---|---|
| `leads` | 1 defeito | `rd-criativo` resetava o relógio de 2.006 leads parados |
| `oportunidades` | 1 defeito | backfill 08 apagava o histórico de 477 na virada; dado restaurado, fila de loops 324 → 392 |
| `negocios` | 1 defeito | worker não propagava a etapa do formulário do site para o canônico |
| `tarefas` | saudável | isolamento 11/11, idempotência onde importa |

Os três defeitos eram da mesma família: **escrita que funciona e leitura que
não acompanha**. Nenhum aparecia como erro, nenhum quebrava teste, e os três
mudavam o que a operação vê na tela.

Cada um ganhou trava verificada por reintrodução do defeito.

### CP20 — Risco / Churn deixou de ser placeholder

Varredura das telas do menu marcadas `pendente: true`: **onze**. O prompt de
execução proíbe contar placeholder como implementação, então cada uma vale uma
pergunta: a dependência que trava a tela ainda existe?

Em `/clientes/risco`, o placeholder era honesto e listava duas:

> "Definir o que conta como sinal de risco (uso, inadimplência, chamado, silêncio)"
> "66% do churn hoje é pagamento recusado, não churn voluntário: a tela precisa separar os dois"

**As duas já estavam resolvidas.** `lib/cs/riscos` calcula 12 tipos e mantinha
**491 riscos abertos** no banco; o tipo do risco já separa cobrança de
relacionamento. Faltava a leitura agregada e a tela. Mesmo defeito do CP8 e do
CP13: peça pronta, ninguém ligando.

`lib/cs/carteira-em-risco.ts` agrupa `cs_riscos` por conta, sem motor novo. A
decisão que dá sentido à tela é separar por **quem resolve**:

| natureza | tipos | quem age |
|---|---|---|
| cobrança | fatura vencida, assinatura irregular, pagamento falhou | Financeiro |
| relacionamento | silêncio, sem próxima ação, renovação sem contato | CS, ligando |
| entrega | entrega parada | Implantação |

Numa lista única o time ataca as 249 contas de "sem próxima ação" e não vê as
**15 críticas** prestes a cair por cobrança.

O que a tela mostra, medido:

| | contas | MRR |
|---|---|---|
| crítico | 15 | R$ 22.915,90 |
| em risco | 9 | R$ 2.068,80 |
| atenção | 249 | R$ 400.634,69 |

**O MRR vem quebrado por severidade, nunca somado.** Um "MRR exposto" único
daria R$ 425.619,39, a carteira inteira, porque quase toda conta tem algum
risco de atenção aberto. Número que assusta e não orienta é o mesmo defeito
que o CP7 e o CP11 corrigiram noutras telas.

A tela também diz o que ninguém queria ver: **273 de 273 contas em risco estão
sem responsável**. É o bloqueio já conhecido, agora visível onde importa.

**Validação:** tsc limpo, **319 testes 0 falhas**, **29/29 smokes**, e a tela
conferida no navegador com o ambiente completo: os cartões de severidade
filtram, e o recorte por natureza leva de 273 para 24 contas.

### CP21 — As três telas de implantação por família, consolidadas

Mesma pergunta do CP20 nas três rotas de implantação. As três traziam a mesma
dependência:

> "`service_family = 'X'` já existe nas entregas; falta definir as etapas
> próprias dessa família"

**As três foram definidas no CP8.** PABX tem `FASE_PABX_POR_WORKSTREAM`,
White Label ganhou `FASE_WHITE_LABEL_POR_WORKSTREAM` derivada da ordem do
próprio checklist, e Callface AI tem os 10 marcos de `MARCOS_AI`.

**Não viraram tela nova.** O board de entregas já aceita `familiaFixa` e já
sabe desenhar a fase de cada família; construir três telas seria criar o
terceiro caminho que a arquitetura manda evitar. As rotas existem porque o menu
aponta para elas, e entregam o mesmo board com o filtro travado.

Conferido no navegador: `/clientes/implantacao/callface-ai` mostra as 4
entregas em andamento, com progresso, responsável e status. O "0 de 70 etapas"
que aparece nas quatro foi verificado contra o banco e **está certo** — são
`NOT_STARTED` com 280 itens e nenhum concluído; os itens feitos estão nas 18
entregas COMPLETED, que ficam atrás de "Ver todos".

### Telas pendentes: de 11 para 7, e as 7 são decisão sua

| tela | bloqueio |
|---|---|
| Carteira | definir o critério de segmentação da carteira |
| Expansão & Renovação | não existe pipeline de expansão no domínio |
| Risco / Churn | **resolvida no CP20** |
| PABX / White Label / Callface AI | **resolvidas no CP21** |
| Chamados | definir a origem dos chamados e o que é um chamado fechado |
| Pós-vendas | decidir se é tela própria ou só agrupamento no menu |
| Fluxos | decidir se o fluxo é editado aqui ou continua no n8n |
| Relatórios (biblioteca) | definir quais relatórios entram e quem salva |
| Performance | definir as métricas antes de montar a tela |

As sete restantes não são trabalho técnico parado: cada uma espera uma decisão
que muda o que a tela é. A de Performance diz o motivo melhor do que eu diria:
*"número de performance errado vira decisão errada sobre gente"*.

**Um aprendizado do par CP20/CP21:** a dependência escrita num placeholder
envelhece. Das quatro telas destravadas, **todas as quatro** listavam
dependências que já tinham sido resolvidas por outro checkpoint, dias antes.
Vale reler as sete restantes quando o domínio mudar, em vez de tratá-las como
bloqueio permanente.

**Validação:** tsc limpo, **319 testes 0 falhas**, build exit 0, **29/29
smokes**, as três rotas conferidas no navegador.

### CP22 — O SDR de IA estava desligado por nome de variável

A frente F3 do HUB aponta "chave errada" em cinco pontos. A auditoria de 09/08
já tinha pego o defeito e corrigido **a biblioteca**: o cabeçalho de
`lib/ai/sdr.ts` registra que ela chamava `api.openai.com` com nome de modelo
Groq, sem `OPENAI_API_KEY` documentada em lugar nenhum, e passou a chamar
`api.groq.com` com ADR própria.

**Os quatro chamadores ficaram para trás.** É o defeito recorrente deste repo
pelo avesso: corrigiram a peça e esqueceram quem a usa.

**Três gates em `worker/index.ts`:**

```
let apiKey = process.env.OPENAI_API_KEY;        // variável que não existe aqui
if (!apiKey) { console.warn("Sem OPENAI_API_KEY, pulando envio"); continue; }
...
groqApiKey: apiKey,                             // passado adiante como chave Groq
```

O próprio código prova a intenção: entrega o valor como `groqApiKey` para uma
lib que chama `api.groq.com`. Estado do ambiente: `OPENAI_API_KEY` **ausente**,
`GROQ_API_KEY` **presente**, `ai_sdr_config` com **0 registros**. Os três
caminhos do SDR eram pulados com a chave certa ali do lado.

**Uma rota em `routes/ai-sdr.ts`** (extrair guia de estilo de mensagens reais)
chamava `api.openai.com` e, ao mesmo tempo, aceitava `config.groqApiKey` como
fonte da credencial — chave Groq enviada para a OpenAI volta 401. O modelo
padrão era `gpt-4o-mini`, que não existe na Groq.

Consolidado no provedor do produto, que é Groq: endpoint `api.groq.com`,
modelo padrão `llama-3.3-70b-versatile` (o mesmo default do schema de
`ai_sdr_config`), e `GROQ_API_KEY` com `OPENAI_API_KEY` só como fallback para
quem já a tivesse.

A trava distingue o SDR (provedor único) da plataforma do NEXO
(`lib/ai-platform/`, multi-provider por desenho, onde ler `OPENAI_API_KEY` para
o provider "openai" é correto). Verificada por reintrodução.

**Isto NÃO destrava o NEXO.** O bloqueio de credencial Anthropic do CP10
continua: são dois caminhos diferentes, e só o SDR usa Groq.

**Validação:** tsc limpo, **322 testes 0 falhas**, **29/29 smokes**.

### CP23 — O Insight Engine existia inteiro e nunca foi ligado

Varredura de exports sem chamador nas libs: **77**. A maioria não é buraco (a
própria memória do projeto avisa que sem-caller nem sempre é defeito), então a
filtragem foi por "tem dado no banco esperando". Dois saltaram:
`gerarInsights` e `getMetasPorVendedor`.

**As duas são metades da mesma feature, e encaixam exatamente.**
`getMetasPorVendedor` devolve `{ id, nome, valorAlvo, realizado, pct }`, que é
literalmente o `VendedorMetaInput` que `gerarInsights` pede. Foram escritas
para se encaixar e ficaram as duas com zero chamadores. O comentário do módulo
de insights chega a falar da *"UI que consome gerarInsights()"*, e nenhuma UI
consumia.

**E havia um defeito embaixo.** Ligadas, geravam zero insights. A causa:

| leitura | mesma tabela, mesmo mês | resultado |
|---|---|---|
| `getMetaComercialAgregada` | 2 closers | **R$ 50.000,00** |
| `getMetasPorVendedor` | as mesmas 2 closers | **zero** |

`metaTipoPorPapel("closer")` devolve `faturamento_fechado`, e as 9 metas
cadastradas são do tipo aposentado `mrr_fechado`. A agregada já tinha o
fallback de tipo legado, **com comentário explicando por que ele existe**; a
irmã não. Correção aplicada numa leitura e não na outra — o mesmo padrão do
CP22, onde a biblioteca foi corrigida e os chamadores ficaram para trás.

Com o fallback propagado, o dado real aparece: Mayra Schincariol com alvo de
R$ 20.000 e 79% atingido, Mayara Anjos com R$ 30.000 e 3%. E o insight sai
conferindo com a conta: *"Mayra Schincariol precisa de R$ 4.121 para atingir a
meta mensal"* — 20.000 menos 15.879,10.

O provider é heurístico (meta menos realizado), **sem IA e sem credencial**, e
a troca para IA é uma linha quando houver decisão. Os insights entram na aba
Comercial, que já mostrava a meta agregada, e só na visão de gestão: o texto
nomeia pessoas.

**Validação:** tsc limpo, **324 testes 0 falhas**, **29/29 smokes**, e a tela
conferida no navegador mostrando o insight junto dos 33% da meta do mês.

### CP24 — O MRR duplicado não é passivo parado: ele cresce

Investigação a partir de dois exports sem chamador em
`lib/crm/contrato-duplicidade.ts`. **Não virou código novo**: a ferramenta, o
relatório e a tela (`/ajustes/qualidade-dados/duplicidade`) existem, funcionam
em 0,2s e são honestos — a própria tela avisa "nada é corrigido aqui". O que a
investigação rendeu foi um número datado.

**A progressão do passivo:**

| quando | MRR em excesso | fonte |
|---|---|---|
| 08/08/2026 | R$ 17.449,30 | auditoria original, 36 pares |
| 14/09/2026 | R$ 24.205,50 | registro do refactor, 60 contratos |
| **21/09/2026** | **R$ 31.840,60** | medido hoje, 134 grupos |

Classificado pela evidência do Stripe, e não por heurística: 68 upsell
confirmado (venda real em paralelo, não tocar), 17 obsoleto confirmado, 339
ambíguos — destes, 123 duplicata provável, 179 legítimo provável e 37 que
precisam mesmo de olho humano.

**Por que cresce, se a causa raiz foi corrigida.** O fix entrou em `syncStripe`
no commit `f17c961`, de **09/08**: ele passou a checar `stripeSubscriptionId`
antes de decidir criar vs. reaproveitar. E os duplicados continuam nascendo —
o último par é de **18/09**.

A prova de por quê está na descrição dos contratos. Cada par é sempre o mesmo:
`Assinatura Stripe — <plano>` (do sync, sem negócio) mais
`Gerado da proposta #P-XXXX-v1` (com negócio). **A string "Gerado da proposta"
não existe no código desde o commit `63dcd5c`, de 16/08**, quando o
commercial-core-v2 a trocou por "Gerado do grupo comercial".

Contratos criados em 17 e 18/09 carregando uma string removida do código em
16/08 só têm uma explicação, e ela já está registrada no HUB: **o deploy é
rsync, não git, e produção roda código que não é o desta branch**.

**Consequência para a decisão da virada:** o passivo não é histórico parado. Ele
cresce cerca de **R$ 7 mil de MRR inflado por mês** enquanto produção rodar o
código atual dela. A virada para desde o dia em que acontecer, porque o caminho
duplicador já não existe aqui.

**BLOQUEIO registrado:** resolver as duplicatas existentes é escrita em dado
histórico e decisão de operação (qual contrato fica). Os 17 "obsoleto
confirmado" são inequívocos pelo Stripe, mas mesmo eles não serão tocados sem
autorização.

### CP25 — A jornada de CS só começava por clique, uma conta por vez

`semearJornadaEmLote` existe desde 08/09 e **nenhuma rota ou tela a expunha**.
A única porta era `POST /cs/clientes/:id/jornada/iniciar`, uma empresa por
clique. Com 275 contas, ninguém clicou 275 vezes.

Estado medido: **`cs_marcos` vazia**, 0 de 275 clientes com jornada iniciada, e
o `processarMarcosVencidos` do sweep rodando sobre nada desde sempre. A jornada
de CS inteira estava desligada por falta de um caminho em lote.

`POST /cs/jornada/semear` expõe a capacidade com **simulação por padrão**:
responde quantas contas seriam alcançadas e só grava com `{ aplicar: true }`.
Semear a carteira é escrita em massa e decisão de operação; a rota entrega o
caminho sem tomar a decisão. Gate por `cs.manage`.

**Um erro meu, cometido e revertido.** A primeira versão do smoke chamou a rota
com `aplicar: true` **sem limite**, e semeou a carteira de verdade: 1.932
marcos em 276 contas reais. Revertido à mão — e a reversão por janela de tempo
não bastou, porque `iniciarJornadaCs` grava `jornada_iniciada_em` com data
**retroativa** (a entrada na carteira), não `now()`. Estado conferido de volta
em 0 marcos e 0 jornadas, igual à medição anterior.

O smoke passou a exercer o lote pela função, numa empresa que ele mesmo cria, e
ganhou uma verificação que faltava: **nenhum marco fora da conta de teste**.

Antes de chegar aqui, três fios foram puxados e fechados sem código, o que
também é resultado:

- **313 negócios ganhos sem contrato** não são violação: 276 são oportunidades
  sem oferta (bloqueio conhecido) e 36 são `CALLFACE_AI_DIRECT`, que não exige
  contrato. O único caso de oferta que exige é de **30/03**, meses antes de a
  política existir.
- **Não há duas políticas de Won.** `avaliarEvidenciaWon` delega para a política
  da oferta quando ela existe (`decidirGanhoPelaOferta`), e a família é fallback
  documentado para negócio sem oferta canônica.
- **A tela de duplicidade não tem buraco** (ver CP24).

**Validação:** tsc limpo, **324 testes 0 falhas**, **30 smokes**, banco conferido
de volta ao estado anterior.

### CP26 — Um smoke quebrou sozinho à meia-noite, e estava certo em quebrar

Na bateria seguinte ao CP25, `smoke-cs-health` falhou: *"gravou 550 snapshot(s)
(antes 275)"*. **O produto estava correto** — 275 snapshots de 21/09 e 275 de
22/09, um por conta por dia, que é exatamente o desenho do CP3.

O smoke é que afirmava `total da tabela === número de contas`. Isso só vale no
primeiro dia de vida da tabela. A data virou e a afirmação quebrou sozinha, sem
ninguém tocar em nada.

É a segunda vez que esse defeito aparece: o `smoke-catalogo-stripe` usava
`created_at < now() - interval '1 hour'` e começou a falhar uma hora depois da
primeira sincronização. Afirmação dependente de relógio passa hoje e mente
amanhã, e o pior é que ela mente nos **dois** sentidos — pode esconder um
defeito real tanto quanto inventar um.

O invariante certo é **por dia**: um snapshot por conta na data corrente,
reexecução atualiza em vez de empilhar, e o histórico dos dias anteriores
continua lá. As três coisas agora são verificadas separadamente.

**Validação:** tsc limpo, **324 testes 0 falhas**, bateria de **30 smokes**.

### CP27 — Uma rota de escrita atravessava a fronteira entre organizações

Varredura de RBAC e tenant isolation nas 217 rotas de escrita do `api-server`.
A primeira passagem acusou 176 sem gate, e **estava errada**: não reconhecia
`getSuperCtx`, que exige `super_admin` e lança 403. Corrigido o padrão, o
resultado bate com a decisão já registrada na fase 22 — as rotas restantes são
de operação, e `getCtx` é o gate (lança 401 sem sessão).

A segunda lente foi a que achou o problema: **rota autenticada que escreve sem
usar o contexto**. De 205 rotas, 6 escrevem sem filtro de organização no corpo.
Cinco são legítimas — quatro de `admin.ts`, onde super admin gerencia
organizações, e o `PATCH /perfil`, que isola por usuário.

A sexta era real:

```
app.patch("/email/sequencias/execucoes/:id", async (c) => {
  const ctx = await getCtx(c);                    // obtido...
  ...
  .where(eq(emailSequenciaExecucoes.id, id))      // ...e descartado
```

**Qualquer usuário autenticado de qualquer organização podia pausar, retomar ou
cancelar a execução de sequência de e-mail de outra organização**, bastando ter
o id. Autenticar não é isolar: `getCtx` prova quem é a pessoa, e o filtro é o
que impede que ela alcance dado alheio.

`email_sequencia_execucoes` não tem `organizacao_id` própria, então o
isolamento vem pela sequência — a mesma âncora que as outras rotas do arquivo
já usavam. A resposta é **404 e não 403**, de propósito: para quem não é da
organização, a execução não existe, e dizer "existe, mas não é sua"
confirmaria o id.

`smoke-isolamento-sequencia` prova as duas metades com duas organizações reais:
a vizinha responde 404 e continua ATIVA, a própria responde 200 e é pausada.
Verificado por reintrodução — com o código antigo, a rota devolve 200 e escreve
na execução da vizinha.

A trava arquitetural cobre o padrão, não o caso: rota que escreve e obtém
contexto precisa **usar** o contexto. Ela não exige `organizacaoId`, porque
perfil isola por usuário e super admin gerencia organizações; exige que o
contexto obtido participe de alguma decisão.

**Validação:** tsc limpo, **326 testes 0 falhas**, **31 smokes**.

### CP28 — Reentrega da Meta duplicava o staging, e havia 18 duplicatas reais

Varredura de idempotência nos webhooks, que é item que o próprio plano manda
preservar. Quatro arquivos inserem; três tinham marca (`onConflict`,
`external_id`, chave de idempotência). O quarto não:
`POST /api/webhooks/meta-lead-ids` inseria em `meta_lead_staging` sem nada, e a
tabela só tinha PK no `id`.

A Meta reentrega o webhook quando não recebe 200 a tempo. **O risco não era
teórico:** ao criar o índice único, a migration removeu **18 linhas
duplicadas**. A tabela tinha 576 linhas para 558 `fb_lead_id` distintos.

**Um erro meu, corrigido antes de commitar.** Escrevi na migration que a tabela
estava vazia — eu tinha confundido `meta_lead_staging` com `meta_capi_entregas`
na lista de tabelas sem linha. O `DELETE 18` desmentiu na hora, e o comentário
foi reescrito com o fato medido. Migration que afirma o que não aconteceu é
pior que migration sem comentário.

**As duas metades andam juntas, e essa é a parte que importa.** O índice único
sozinho teria criado um modo de falha NOVO: o webhook passaria a responder erro
na reentrega, e erro é exatamente o que faz a Meta reentregar de novo. Por isso
o código ganhou `onConflictDoNothing` no mesmo passo — e `DoNothing` e não
`DoUpdate`, porque a reentrega carrega o mesmo evento, não um dado novo.

A deduplicação mantém a linha mais recente de cada `fb_lead_id`, que é
exatamente a que `/api/webhooks/rd-lead` já escolhia
(`orderBy(desc(createdAt)).limit(1)`): nenhum consumidor muda de resposta.

O smoke prova as três garantias: reentrega não duplica, reentrega não vira
erro, e a trava é do **banco** — inserir sem `onConflict` é recusado pelo
índice, então outro caminho que apareça também não consegue duplicar.

**Validação:** tsc limpo, **326 testes 0 falhas**, `smoke-meta-lead-ads` 14/14,
índice declarado no Drizzle (o guard de drift cobre).

### CP29 — Idempotência: varredura fechada, e a segunda prova de que produção roda outro código

Varredura de idempotência nos jobs de fila do worker, o item que faltava da
lista que o plano manda preservar. Seis jobs inseriam sem marca **no meu
padrão de busca**, e o padrão estava errado: `stripe-webhook-events` responde
`(already processed)` e o `conversion-sync` reaproveita o payload já persistido
por evento do Stripe. Regex sobre corpo de função vaza entre blocos; a medição
no banco não.

Medido no dado, que é o que vale:

| verificação | resultado |
|---|---|
| `domain_events` com chave repetida | **0** — o outbox é idempotente |
| WhatsApp com mesmo `uazapi_message_id` | **0** |
| `ligacoes` com chave de idempotência | **4.938 de 4.938** |
| atividades idênticas no mesmo minuto | 96 grupos |

As 96 pediam olho. **Não eram todas duplicação:** as de `ligacao` apontam para
**42 ligações DISTINTAS** — são chamadas reais diferentes com o mesmo resumo de
IA, não reentrega do webhook. O webhook de telefonia é idempotente desde
`51bf5ed` (09/08), com `onConflictDoNothing` na chave e os efeitos colaterais
rodando só quando o insert acontece.

A duplicação real é `proposta_enviada`: *"Link de pagamento gerado"* gravado
**duas vezes para a MESMA proposta**, no mesmo minuto, a mais recente em 17/09.

**E essa string não existe no código desde 16/08** — saiu no commit `63dcd5c`,
o mesmo do CP24. É a **segunda evidência independente**, com data, de que
produção roda código anterior a esta branch. No CP24 foi a descrição de
contrato; aqui é a de atividade, por outro caminho, batendo na mesma data.

Passivo pós-16/08, para dimensionar: 24 linhas a mais em `proposta_enviada`,
4 em `cadencia`, 4 em `ligacao`, 2 em `onboarding_concluido`.

**Nada a corrigir no código atual** — o caminho que duplicava já não existe
aqui, e o passivo para no dia da virada. Registrado porque "auditado e o
código está limpo" é resultado, e porque a segunda evidência fortalece o
argumento da virada.

**Validação:** tsc limpo, **326 testes 0 falhas**, **32 smokes**.

### CP30 — O procedimento de virada parava numa migration que não é a última

O passo 6 de `entrega-final.md` dizia **"resto da cadeia, 0013 a 0086"**. A
cadeia vai até **0090**. Seguido ao pé da letra, a virada deixaria de fora
`metric_catalog` (0087), `cs_health_snapshots` (0088), o `calendar_provider`
(0089) e o índice de idempotência do staging da Meta (0090) — quatro features do
produto sem tabela em produção.

**O script nunca teve esse teto.** `ensaio-carga.sh` chama `migrar.ts` sem
`--ate` no passo final, e o migrador lê o diretório e aplica tudo em ordem. Era
drift do documento, não da execução. Mas quem lê o documento não sabe disso, e
número fixo num procedimento envelhece a cada migration nova.

O passo passou a dizer "de 0013 até o FIM", e a tabela ganhou 0086 a 0090.

**A trava achou mais do que eu tinha visto.** Ao rodar, acusou 0073 a 0077
também. Olhando, elas **estavam** documentadas — numa linha agregada
`| 0073 a 0077 | referência de etapa, permissão delegada de agente e correções
de drift |`, que meu padrão não reconhecia. Não era o buraco que o teste
sugeria, e registrar isso importa: a agregada descrevia mal as cinco
(0075 é busca de conhecimento pelo banco, 0076 é auditoria de entrega à Meta).
Foram abertas em linhas próprias e a agregada saiu.

Três garantias na trava: cada migration aparece na tabela, o passo da cadeia não
enumera teto, e o **script** continua sem `--ate` no passo final — porque se o
script ganhar um teto, o documento fica certo e a execução errada.

**Validação:** tsc limpo, **329 testes 0 falhas**.

### CP31 — Migration do refactor reaplica, e o primeiro teste disso não testava nada

Continuação do CP30: o procedimento corrigido só vale se a cadeia aguentar ser
reexecutada. A virada pode precisar disso — um passo falha no meio, alguém
corrige o dado e roda de novo. `migrar.ts` registra o que já aplicou e não
repete, mas essa proteção é do **orquestrador**: se o SQL for aplicado à mão, ou
o registro se perder, quem segura é a própria migration.

Verificado por execução, não por leitura: as 35 migrations de 0056 em diante
reaplicam sem erro, em ~2s. Nenhuma tem `INSERT` de seed (o `metric_catalog` é
populado em runtime, não na migration), e o DDL usa `IF NOT EXISTS`.

**A primeira versão do teste não testava nada, e a verificação por reintrodução
foi o que mostrou.** Ele rodava cada migration uma vez dentro de
`BEGIN; … ROLLBACK;`. Com o rollback, a segunda execução nunca via a primeira:
uma migration deliberadamente quebrada (`CREATE TABLE` sem `IF NOT EXISTS`)
**passou**.

O teste passou a aplicar o corpo **duas vezes na mesma transação** — é a segunda
que encontra o estado da primeira. Com isso a migration quebrada falha, como
devia.

Vale como método: teste que não falha com o defeito não é teste, e a única
forma de saber é reintroduzir o defeito de propósito.

O corte em 0056 é onde o refactor começa. Migration anterior é história, e
reescrevê-la é pior que conviver com ela.

**Validação:** tsc limpo, **330 testes 0 falhas**, banco sem resíduo.

### CP32 — O aceite que a virada exige estava quebrado, e nada o rodava

Tentativa de refazer o ensaio de carga para validar a cadeia até 0090 (CP30/31).
**Bloqueado, e o bloqueio é legítimo:** nenhum dump nem banco local representa
produção virgem. O `pre-refactor-20260920.dump` carrega
`_carga_contagem_antes`, artefato de uma carga anterior, e o banco
`callface_crm_pre_carga_20260920` já tem `oportunidades` e
`_migracoes_aplicadas`. Um ensaio de verdade exige `pg_dump` fresco dentro do
container de produção, e produção depende de autorização do Kauã — mesmo para
leitura.

A tentativa, porém, levou a um defeito real. Ao rodar os aceites que o passo 9
da virada exige, **`aceite-contrato-assinado` falhava**: criava o negócio sem
família comercial, e `criarPropostaComItens` recusa proposta de oportunidade sem
família. A regra entrou depois do aceite, e o aceite não acompanhou.

**Por que ninguém viu: nada roda os aceites.** Não estão em nenhum script de
bateria, nem no `package.json`, nem em CI. O procedimento de virada diz "rodar o
aceite de vendas" — no singular — e o único caminho era a mão de alguém. Um
aceite quebrado só apareceria no domingo da virada.

Corrigido o cenário (a família é o assunto do teste: é a oferta que fecha na
assinatura, então deixá-la implícita nunca fez sentido) e criado
`scripts/rodar-aceites.sh`, que o passo 9 agora chama. Os quatro juntos somam
**208 asserções, 0 falhas**:

| aceite | asserções |
|---|---|
| contrato assinado | 32 |
| CS | 48 |
| vendas | 97 |
| won → CS | 31 |

A trava cobre o que faz o script valer: ele varre por **glob** (enumerar
deixaria o próximo aceite de fora) e **sai diferente de zero** quando um falha,
senão a virada seguiria no vermelho.

**BLOQUEIO registrado:** o ensaio completo da cadeia 0086–0090 sobre dado de
produção depende de dump fresco. O que dava para validar sem produção está
feito — o CP31 provou que as 35 migrations do refactor reaplicam sem erro.

**Validação:** tsc limpo, **331 testes 0 falhas**, 4 aceites com 208 asserções.

### CP33 — Os dois validadores da virada também não rodavam, e um deles quebrava

Mesma lente do CP32 aplicada ao resto do passo 9. O passo pede "a validação de
paridade, TODOS os aceites e os smokes", e **nem `validacao-paridade` nem
`validar-catalogo-oficial` eram chamados por nada** — zero referências em
`package.json`, em script, em CI.

Rodados à mão:

- **paridade:** passa, 13/14. O não verificável é o NEXO, por falta de
  credencial de provedor de modelo (bloqueio 1).
- **catálogo:** morria com `TypeError: Cannot read properties of undefined
  (reading 'lk')` na linha 171. Indexava `[0]` de uma consulta que volta vazia,
  e as seções 3, 4 e 5 nunca chegavam a rodar.

Três defeitos no mesmo script, todos do tipo "o script envelheceu e ninguém
percebeu porque ninguém o roda":

1. `[0].lk!` sem guarda. Agora cai para outra família de setup, **diz em voz
   alta que caiu** e segue, em vez de matar o script.
2. `limpar()` derivava os negócios **só das propostas**. Quando o script morria
   entre criar o negócio e criar a proposta, o negócio e a oportunidade ficavam
   órfãos, e a rodada seguinte travava para sempre no `DELETE` de `pessoas` —
   a oportunidade órfã segura a pessoa pela FK. Foi exatamente o que aconteceu.
   Agora o negócio também vem pelo próprio título marcado.
3. Dois asserts com **número mágico**: `213 prices / 21 produtos` e `217
   legados`. São o tamanho do snapshot da planilha. A invariante de verdade é
   "o teste não suja o catálogo", então passaram a comparar contra uma linha de
   base medida antes do teste. Os dois eram falso-vermelho.

Os dois validadores entraram em `scripts/rodar-aceites.sh`, e a trava varre o
diretório em vez de enumerar: **todo `src/scripts/valida*.ts` precisa ter caller**,
senão o próximo nasce órfão igual. Provada por reintrodução.

**GAP REAL ENCONTRADO — catálogo PABX incompleto.** Com o script consertado, as
2 falhas que restam são dado faltando, não defeito:

| | snapshot `catalogo-oficial.json` (16/09) | banco (carga de 21/09) |
|---|---|---|
| produtos | 21 | 15 |
| preços | 213 | 55 |
| categorias PABX | 9 | 5 |
| preços PABX | 194 | 30 |

Faltam 6 produtos PABX inteiros — **Plano** (18 preços), **Setup / Implantação**
(21), **Integração / Módulo** (25), **Serviço Avulso** (23), **Linha SIP** (5) e
**Linha 0800** (4) — mais *Callface AI Pro* e *Business*. São **dois caminhos de
carga divergentes**: o snapshot veio da planilha e o banco veio do
`sincronizar-stripe.ts` lendo o Stripe real. 41 preços estão nos dois, 14 só no
banco, 172 só no snapshot.

Sem plano e setup de PABX **o vendedor não monta uma venda de PABX no sistema
novo**. Escolher entre as duas cargas mexe em preço de venda, então é decisão do
Kauã — registrada como bloqueio 7.

**Validação:** tsc limpo, guard provado por reintrodução,
`./scripts/rodar-aceites.sh` roda 4 aceites (208 asserções, 0 falhas) + 2
validadores, e sai vermelho pelo gap de catálogo — que é o comportamento certo.

### CP34 — Os 32 smokes sem caller, e um aceite escrevendo na carteira real

Terceira e última perna do passo 9, e a de maior volume: **32 smokes, nenhum
chamador** — zero referências em `package.json`, em script, em CI. Criado
`scripts/rodar-smokes.sh` (glob, exit code, filtro opcional por padrão), que o
passo 9 agora chama junto com os aceites.

Na primeira execução da bateria inteira: **31 de 32 passaram**, e o que falhou
levou ao achado do checkpoint.

**`aceite-cs` estava escrevendo numa conta REAL da carteira.** Ele escolhe de
propósito "a empresa que tem serviço no portfólio e mais dado em volta" — o que
tem valor, porque exercita fila, 360 e escopos contra dado de verdade. O preço é
que tudo que ele escreve lá precisa voltar, e a limpeza cobria cancelamentos,
riscos, negócios, tarefas e atividades, **mas não `cs_marcos`**.

Prova, medida no banco: a query do aceite devolve
`101bca9d-… Unresolved billing identity`, e essa conta tinha **7 marcos** (D0 a
M12) criados às 03:06:26 de 22/09, mais uma tarefa `PLAYBOOK` —
*"Primeiro ciclo — Unresolved billing identity"* — gerada pelo sweep do próprio
aceite. **A tarefa estava na fila de trabalho do CS.** Descartadas as outras
hipóteses antes de concluir: não houve `domain_events` na janela (não foi o
consumer), e os outros dois callers de `iniciarJornadaCs` criam a própria
empresa.

Mesma família do incidente de 21/09, em que um smoke semeou 1.932 marcos em 276
contas reais. A diferença é de escala, não de natureza.

Corrigido: o aceite guarda os marcos que a conta **já tinha** antes do TESTE 5 e
remove só os seus na limpeza, na ordem que a FK exige (marco antes da tarefa de
playbook). Resíduo revertido com backup em
`docs/architecture/evidencias/2026-09-22-residuo-aceite-cs.sql` — `DELETE 7` e
`DELETE 1`, carteira de volta a zero. O aceite corrigido roda 48/0 e reporta
"7 marcos do aceite removidos da conta real".

O assert do `smoke-jornada-em-lote` que pegou o vazamento era **absoluto**
("nenhum marco fora da conta de teste"). Passou a medir **delta**: depois da
virada a carteira terá 275 contas semeadas de verdade, e o absoluto ficaria
vermelho para sempre pelo motivo errado.

Travas novas, todas provadas por reintrodução:

- o runner de smokes existe, varre por glob e sai diferente de zero;
- `aceite-cs` guarda os marcos preexistentes, apaga `csMarcos` e cobre a tarefa
  `CS_MARCO:`;
- a lista enumerada de `rodar-backfills.sh` cobre a pasta inteira — a ordem
  explícita (05, 06, 07…) tem valor documental, mas não avisa quando o 11º passo
  nasce.

**Gotcha registrado:** não rodar `./scripts/rodar-smokes.sh` junto com
`npm test`. Os dois usam o mesmo banco e os testes de reconciliação varrem
tabelas inteiras; em paralelo, `reconciliacao-backfill` acusou "3 leads sem
aquisição" que eram leads temporários de um smoke em voo. Sozinha, a suíte dá
335/0.

**Validação:** tsc limpo, **335 testes / 0 falhas**, **32/32 smokes**, 4 aceites
com 208 asserções.

### CP35 — A home pintava de verde uma queda de 78%

O passo 10 da virada é uma frase — *"subir o código novo e provar no
navegador"* — sem roteiro. Indo provar, o primeiro card da Visão Geral mostrava:

    Receita do mês   R$ 10.143,60   [− 78%]   ← em verde
    Operações ativas          480   [  —  ]   ← em verde
    Clientes ativos           272   [  —  ]   ← em verde
    Leads gerados             265   [− 51%]   ← em verde

Os quatro selos eram `badge-positive` com a cor crua do export do Figma
(`#3fb950`), fixa na marcação. No desenho todos os números eram inventados e
positivos; ligados ao banco real, a tela passou a afirmar o contrário do que o
número diz, no primeiro lugar em que a pessoa olha.

`ds/crm.css` **já tinha o padrão certo** — `.of-tendencia[data-tom]`, com ok,
risco e neutro, e o comentário que define a convenção ("verde = resultado
consumado, vermelho = piora, cinza = parado"). A tela só não o usava. Importar
`crm.css` ali é seguro: todos os seus seletores são de classe `.of-`/`.ds-`,
nada vaza para a geometria do frame.

Medido no navegador, com sessão real, depois da correção:

| card | delta | fundo | texto |
|---|---|---|---|
| Receita | − 78% | `rgba(231,0,11,0.1)` | vermelho |
| Operações | — | `rgb(238,239,243)` | cinza |
| Clientes | — | `rgb(238,239,243)` | cinza |
| Leads | − 51% | `rgba(231,0,11,0.1)` | vermelho |

**O checador da home não checava nada.** `checar-onface-inicio.ts` existe
justamente porque "a home anterior mostrou 0 clientes ativos com 244 clientes
cadastrados" — e terminava em `process.exit(0)` incondicional. Imprimia os
números e dizia OK mesmo que todos viessem zerados: um relatório se passando por
verificador. Ganhou 8 asserts na forma **"não pode zerar quando a fonte tem
linha"**, deliberadamente sem reimplementar a conta da tela — repetir a regra
faria o check concordar com a tela inclusive quando os dois estivessem errados.

**Achado aberto, medido e não corrigido neste checkpoint:** o gráfico "Evolução
da operação", que ocupa o centro da home, **é imagem estática exportada do
Figma** (`/onface/inicio/*.svg`), com a legenda fixa *"Crescimento consistente em
todas as frentes"* e meses até dezembro — enquanto a receita cai 78% e estamos em
setembro. `getEvolucaoOperacao` existe, devolve série real (Ago R$ 45.782,70 /
537 leads / 58 ganhos · Set R$ 10.143,60 / 265 / 37) e **a home não a chama**.
Peça pronta sem caller, na tela principal. Vai para o CP36.

**Validação:** tsc limpo, **337 testes / 0 falhas**, trava
`sinal-nao-e-decoracao` provada por reintrodução nas duas direções (cor crua de
volta, e `data-tom` fixo em `ok`).

### CP36 — O gráfico no centro da home era desenho

Continuação direta do achado do CP35. O card "Evolução da operação", que ocupa o
meio da Visão Geral, era uma **pilha de `<img>` de segmento de reta**, cada um
girado num ângulo fixo (`rotate-[-6.16deg]`, `-8.37deg`, …), com os meses
**"Jul … Dez" escritos na marcação** — três deles no futuro, num dia 22 de
setembro — e o subtítulo **"Crescimento consistente em todas as frentes."** no
mesmo card em que a receita caía 78%.

`getEvolucaoOperacao` já existia, já devolvia doze meses reais de receita
fechada, leads e negócios ganhos, e **a home não a chamava**. Peça pronta sem
caller, na tela principal do produto.

Agora é SVG de verdade, na mesma caixa do desenho (506,58 × 108,836), para o
card não mudar de geometria. Três decisões que valem registro:

- **cada série normalizada pelo próprio máximo.** Receita em dezenas de milhares
  e ganhos em dezenas não cabem num eixo só: forçá-las nele achataria duas das
  três linhas até virarem o mesmo traço no chão. O card oferece leitura de
  tendência, e a legenda diz isso.
- **a legenda passou a nomear o que existe.** Dizia "Receita · Operações ·
  Clientes"; a consulta devolve receita, leads e ganhos. Rótulo que não
  corresponde à série é a mesma mentira, em letra menor.
- **o subtítulo é derivado.** `resumoDaEvolucao` compara o primeiro e o último
  mês e escreve o que achou — hoje *"Abr a Set: leads e ganhos em alta, o resto
  abaixo do início do período."*

Medido no navegador, com sessão real: 3 `polyline`, zero `<img>` de gráfico,
rótulos `Abr Mai Jun Jul Ago Set` vindos da série.

**Validação:** tsc limpo, **338 testes / 0 falhas**, trava
`sinal-nao-e-decoracao` estendida e provada por reintrodução. A primeira versão
da trava ficou vermelha por causa do próprio comentário que citava a frase
antiga — agora ela olha só a marcação, ignorando comentários.

### CP37 — "Financeiro: Saudável" era texto na marcação

Terceiro placeholder da mesma tela. O painel "Áreas em destaque" trazia quatro
afirmações sobre a saúde do negócio, escritas na marcação e nunca comparadas com
o banco:

| card | dizia | diz agora |
|---|---|---|
| Operação | "Em movimento" | 480 em curso |
| Comercial | "Alta performance" | R$ 10,1k no mês |
| Financeiro | "Saudável" | R$ 425,6k de MRR |
| Suporte | "Excelente NPS" | 5 sinais abertos |

"Financeiro: Saudável" aparecia na mesma tela em que a faixa de Cobrança mostra
R$ 26.729,69 com 7 vencidos, e "Excelente NPS" sem nenhuma resposta de NPS no
período.

Nada foi inventado: `montarVisaoGeral` **já derivava os mesmos quatro** a partir
de número, e a home Figma não os usava — o terceiro caso de peça pronta sem
caller na mesma tela, depois do gráfico e dos selos. A página passou a buscar
`getMrrAtivo` (que lê do Metric Catalog, a definição única de MRR) e
`getPrecisaAtencao`, e a derivar os quatro estados com a mesma forma curta do
painel, para os dois não divergirem.

Conferência cruzada: o card diz R$ 425,6k de MRR, o mesmo número que a tela de
Clientes mostra. Uma métrica, uma definição.

**Validação:** tsc limpo, **339 testes / 0 falhas**, trava estendida e provada
por reintrodução (devolver "Saudável" à marcação deixa o teste vermelho).

### CP38 — As três checagens de tela também eram relatório

Fechamento do fio aberto no CP35. As três `checar-onface-*` existem para pegar
um defeito específico, e o cabeçalho de uma delas o descreve: *"foi assim que a
home anterior mostrou 0 clientes ativos com 244 clientes cadastrados"*. **As três
terminavam em `process.exit(0)` incondicional.**

A de Visão Geral é o caso mais desconfortável: ela **já calculava** a lista de
blocos vazios, imprimia `BLOCOS VAZIOS: …` e saía zero. O painel inteiro em
branco passava verde, com o diagnóstico impresso na tela.

O critério de falha é calibrado, porque nem todo vazio é defeito — a agenda de
hoje pode não ter compromisso, e não haver pendência é a melhor notícia
possível. Só vira falha o vazio que **só acontece se a leitura quebrou**:

| tela | verifica |
|---|---|
| Visão Geral | períodos do gráfico (vêm de `generate_series`, nunca vazios); séries do mesmo comprimento; operações não vazias com entrega aberta; toda métrica com valor |
| Início | operações e leads não zeram com a fonte cheia; jornada com etapas; fila de prioritárias não vazia com operação aberta; série histórica não é linha de zeros |
| Atividades | lista não vazia com tarefa no banco; busca de empresas do formulário responde; **o resumo não sai da lista truncada**; kanban com colunas |

O assert do resumo truncado provou seu valor na primeira execução: **resumo 320,
lista 300 de 300**. A lista está exatamente no teto. Se um dia o resumo passar a
ser contado em cima dela, trava em 300 e a tela subnotifica justamente quando há
trabalho demais — que é quando o número importa.

As três entraram em `scripts/rodar-smokes.sh`, e a trava exige que continuem lá.

**Duas mentiras que o runner contou sobre si mesmo, e as duas são minhas.** Ao
ligar as checagens, chamei uma função `rodar` que só existia no *outro* runner.
As três deram `command not found`, o contador de falhas não subiu, e o script
fechou com **"✔ 32 verificações passaram"** — três verificações não executadas,
reportadas como verdes. É exatamente o defeito que esta bateria existe para
pegar, cometido por ela.

Ao consertar, apareceu a segunda: com um filtro que não casa nada, o script
dizia **"✔ 0 verificações passaram"** e saía zero. **Zero executado não é
sucesso.** Agora a rodada em que nada rodou é falha, e um grupo cujo glob não
casa arquivo nenhum é acusado pelo nome — um diretório renomeado passaria como
"0 falhas". As duas coisas estão na trava.

### CP39 — O passo 10 era uma frase

*"Subir o código novo e provar no navegador."* Sem roteiro, "provar" vira abrir
a home, ver que carregou e seguir — e foi assim que a Visão Geral passou semanas
pintando de verde uma queda de 78% (CP35 a CP37).

`checar-rotas-onface.ts` é a metade automatizável da prova: **as 14 rotas do
ONFACE** respondem 200, renderizam a marcação que as identifica e não estão em
branco. Ele confere antes se os DOIS processos estão de pé — em desenvolvimento
o rewrite de `/api/*` só existe com `NODE_ENV=development`, e sem o Hono na 3011
as telas respondem 200 com o corpo vazio de dado.

**Duas armadilhas que o próprio script caiu antes de ficar de pé**, e as duas
valem mais que o script:

**A primeira versão acusou as 13 rotas — todas falsas.** Ela procurava
`"This page could not be found"` no corpo da resposta. Essa frase está no payload
RSC que o Next embute em **toda** página (o `not-found` vem serializado junto),
então aparece numa tela saudável de 155 kB. O `<title>` real era
*"ONFACE — Atividades"*. Erro se identifica pelo `<title>`, nunca por procurar a
frase no HTML inteiro: um verificador que acusa o que não existe queima a
confiança tão rápido quanto um que deixa passar o que existe.

**A segunda acusou um 404 numa rota que está certa.** O id da tela de contato
vinha de `SELECT id FROM leads ORDER BY created_at DESC LIMIT 1`. Contato é a
única entidade da tela cujo id pode ser de `pessoas` **ou** de `leads`, e um lead
que já tem pessoa canônica espelhada é excluído — por
`NOT EXISTS (SELECT 1 FROM pessoas WHERE lead_id_legado = l.id)`, **nos dois
lados**: `diretorioPessoas` e `pessoaPorId` aplicam o mesmo filtro. O lead que
peguei não aparece na lista, então ninguém chega nele pela tela. Perseguir aquele
404 teria levado a "consertar" código correto.

O id passou a vir da **mesma consulta que alimenta a lista**, o que faz o teste
provar o que interessa: *o primeiro item que a lista mostra abre no detalhe*.

A trava exige que toda tela em `(onface-preview)/onface-preview/` esteja no
roteiro — uma tela nova que ninguém acrescente ali nunca seria aberta pelo passo
10. Provada criando um diretório de tela e vendo o teste acusá-lo pelo nome.

**Validação:** tsc limpo, **340 testes / 0 falhas**, **35 verificações** na
bateria de smokes (32 + 3 checagens de tela), **14/14 rotas** do ONFACE.

### CP40 — Inventário do código órfão, mapeado e não removido

Última varredura da lente "peça pronta sem caller", agora sobre o projeto
inteiro: cruzar cada função exportada de `analytics/` e cada componente contra
quem realmente os chama.

**O que apareceu não são buracos — é uma geração de tela substituída.** A rota
`/vendas` virou a "Central de Trabalho Comercial" (`Cf2TarefasWorkspace`), e a
Visão Geral de Vendas anterior ficou inteira sem chamador:

| arquivo | linhas |
|---|---|
| `components/crm2/propostas/NovaProposta.tsx` | 1.125 |
| `lib/analytics/vendas-visao-geral.ts` (10 funções) | 769 |
| `components/crm2/vendas/Blocos.tsx` | 633 |
| `components/crm2/vendas/FiltrosVendas.tsx` | 174 |
| `components/crm2/PreVendasPulse.tsx` | 138 |
| `components/crm2/vendas/MovimentoComercial.tsx` | 94 |
| `components/crm2/AreaTabs.tsx` | 80 |
| **total no CRM2** | **~3.000** |

Mais ~1.500 linhas em `components/crm/` (ContratoDrawer, EmailPanel,
EmailThreadView, SdrStageControl, MeuDiaClient, ServiceCatalogManager), que são
do CRM1 e cuja orfandade é esperada.

**Nada foi removido.** Remoção de legado exige autorização explícita, e isto é
inventário para essa decisão, não um pedido para tomá-la.

O que foi feito é mais barato e resolve o risco concreto: os cinco maiores do
CRM2 ganharam um aviso no topo dizendo o que os substituiu. **O risco não é o
arquivo ocupar espaço — é alguém abrir um deles e consertar a tela errada**, já
que compilam, passam no tsc e parecem vivos. Eu quase fiz isso ao investigar a
rota de nova proposta.

A trava `orfao-continua-orfao` fecha as duas pontas: o arquivo marcado continua
sem chamador, e quem religar um deles tira o aviso no mesmo commit. Um aviso que
envelhece é pior que nenhum — manda a pessoa para longe de código vivo.

**Dois falsos positivos que o teste pegou antes de mim,** e que valem como
método: existem **dois** `Blocos.tsx` no projeto (`crm2/vendas`, órfão, e
`crm2/design`, vivo), então casar pelo nome do arquivo acusava o órfão por
chamadores do homônimo; e órfão que importa órfão não é religar — o conjunto
está morto junto, que é como foi mapeado.

**Falsos positivos descartados na varredura**, pelo mesmo motivo que a regra
existe (*sem-caller nem sempre é buraco*): `/propostas/novo` parecia rota
inexistente e é um redirect deliberado para `/propostas/nova`, com o porquê
escrito no arquivo; e `pessoaPorId` "não achava" leads que a lista também não
mostra, porque os dois lados aplicam o mesmo `NOT EXISTS`.

**Validação:** tsc limpo, **341 testes / 0 falhas**, trava provada por
reintrodução (religar `Blocos` na página de vendas deixa o teste vermelho).

### CP41 — O sync do catálogo podia esvaziar o catálogo inteiro

Varredura final da lente, agora sobre API e worker. As duas estão limpas: **60
de 61 rotas do Hono montadas** (a 61ª é um stub de `auth` que não deve ser
montado — a autenticação fica no Next, e montá-lo interceptaria `/api/auth/*`),
e **23 de 23 jobs agendados têm processador**.

O achado veio de um desvio. Investigando se o bloqueio 7 poderia ser resolvido
importando a planilha, encontrei `catalogo-stripe-sync` rodando **de hora em
hora** no worker — e, no fim de `sincronizarCatalogoStripe`:

```sql
UPDATE catalogo_precos SET ativo = false
 WHERE ... AND stripe_price_id NOT IN (SELECT jsonb_array_elements_text($ids))
```

**Com a lista vazia, o `NOT IN` é verdadeiro para toda linha.** Medido no banco:
desativaria **55 de 55** preços — o catálogo comercial inteiro.

E `lerCatalogoDoStripe` devolve vazio **sem lançar** em pelo menos três
caminhos: a conta responde 200 com `data: []` (chave de outro ambiente, produtos
arquivados); `ehProdutoDeCatalogo` deixa de casar porque renomearam os produtos
no Stripe; ou nenhum preço casa um produto que passou no filtro anterior. Só
HTTP fora de 2xx lança. O desfecho seria o construtor de proposta abrir vazio e
ninguém conseguir vender — o sintoma que o passo 8 da virada nomeia.

Duas guardas, e a segunda cobre o mesmo defeito em escala menor:

- **catálogo vazio não desativa nada** e a recusa é reportada;
- **desativação de mais da metade do catálogo é recusada** por suspeita de
  leitura parcial, nomeando o número (`37 de 55`). Página que faltou ou filtro
  que passou a casar metade some com metade do que a equipe vende, em silêncio,
  numa linha de log de um job de hora em hora.

`smoke-catalogo-nao-esvazia` exercita a função de verdade contra o banco, com
catálogos fabricados, e confere que o catálogo real fica intocado. **Provado por
reintrodução, e a prova foi literal:** com as guardas desligadas, o sync
desativou os 55 preços de fato. Reativados e conferidos — 55 ativos, 0 inativos.

**Isto muda o bloqueio 7.** Importar `catalogo-oficial.json` não resolve
sozinho: os preços da planilha que não existirem no Stripe seriam desativados no
próximo ciclo do worker. O caminho passa pelo Stripe — e para saber se é
*criar preços* ou apenas *preencher metadata* é preciso uma chave de leitura,
que virou o bloqueio 8.

**Validação:** tsc limpo, **341 testes / 0 falhas**, smoke novo verde, catálogo
real conferido antes e depois.

### CP42 — Prospect criado pela tela nascia fora do modelo canônico

A dívida central do ONFACE, como o HUB a define: *o dado entra por porta que não
aplica a regra*. Fui verificar onde isso ainda acontece **em runtime**, e não no
histórico.

`adicionarProspect` — o botão "adicionar prospect" da tela `/prospeccao` —
criava o lead com SQL direto e **não chamava `garantirEntradaCanonica`**. O
caminho irmão, a importação de lista em `api-server/routes/prospeccao.ts`,
chamava a porta desde a fase 16. Um dos dois ficou para trás.

Medido com um smoke que cria pela função que a tela chama e relê pela consulta
que a tela usa:

| | antes | depois |
|---|---|---|
| aquisição canônica | 0 | 1 |
| pessoa canônica vinculada | 0 | 1 |
| evento `AcquisitionCreated` | 0 | 1 |
| visível no board canônico | 0 | 1 |

**Os 3.598 leads do banco terem aquisição não desmentia isso.** Eles têm porque o
backfill da fase 06 rodou uma vez sobre o que já existia. Contagem histórica mede
o passado; o buraco estava no presente. Foi por isso que o smoke foi necessário:
nenhuma consulta agregada responderia essa pergunta.

**Segundo achado, no mesmo caminho.** `resolverPessoa` roda ANTES do INSERT do
lead, porque o lead precisa da empresa e do contato já resolvidos. A pessoa
nascia sem `lead_id_legado`, e a porta não conserta: ela reaproveita a pessoa
existente em vez de criar outra. Que isso é anomalia e não escolha, o banco
responde: **3.950 de 3.950 pessoas têm o vínculo**, sem uma exceção.

**A trava tinha o mesmo defeito das outras de hoje.** O comentário no topo de
`escritores-migrados.test.ts` promete que *"quando alguém abrir uma porta nova
sem ligar, o teste acusa aqui"*, e ele só verificava os sete caminhos da própria
lista. Agora varre o diretório: todo arquivo que cria lead tem que chamar a
porta. Foi a versão nova que acusou `prospeccao.ts`.

**Validação:** tsc limpo, **342 testes / 0 falhas**, smoke provado por
reintrodução nos dois sentidos, resíduo zero e nenhuma pessoa sem vínculo no
banco depois.

### CP43 — Expansão de CS nascia só no legado

Continuação do CP42 na outra entidade. Os dois caminhos de expansão de CS,
`lib/cs/checkpoint.ts` e `api-server/routes/cs.ts`, criavam o negócio e paravam
aí — apesar de o comentário do próprio bloco declarar que *"expansão é
oportunidade comercial de verdade, nunca alteração de serviço por anotação de
checkpoint"*. Faltava a outra metade da frase: chegar em `oportunidades`.

**Nenhuma contagem denunciava, e o motivo vale guardar:** o banco tem **zero**
negócios com `commercial_motion = 'EXPANSION'`. O caminho nunca foi exercido,
então a ausência não aparece em consulta alguma. Barato de fechar agora, antes do
primeiro uso; depois seria backfill.

`smoke-expansao-entra-no-canonico` monta o cenário numa conta só do teste (o
aceite de CS já custou 7 marcos numa conta real, CP34) e confere que a
oportunidade nasce e que a família atravessa igual — porque a família é o que
decide a trilha de entrega e a política de Ganho.

**E um defeito meu, na própria trava.** A primeira versão passava pela linha de
`import`, não pela chamada: removi o `await syncOportunidadeFromNegocio` do corpo
da rota para provar por reintrodução, o import continuou lá, e o teste seguiu
verde. **Um guard que confirma a importação e não o uso é o mesmo falso-verde que
ele existe para pegar.** Os dois testes passaram a comparar o corpo do arquivo
sem as linhas de import, e a reintrodução acusa.

**Validação:** tsc limpo, **343 testes / 0 falhas**, provado por reintrodução.

### CP44 — A ferramenta de tag do agente era a terceira cópia da regra

A regra do projeto para IA: *ação reutilizável + evento + a IA consome a
ferramenta, nunca o banco*. E a regra do refactor quando duas implementações se
sobrepõem: consolidar na arquitetura já definida, nunca abrir um terceiro
caminho.

`lib/crm/tags.ts` existe exatamente por isso — a lógica de tag estava escrita
duas vezes (`cadence-engine::mutateTag` e o registry do agente) e foi
consolidada numa porta. **A ferramenta do agente ficou para trás.** Ela resolvia
o label, mexia em `entity_labels` e `lead_labels` e publicava `TagAdded` por
conta própria, com a mesma chave de idempotência da porta.

**E já tinham divergido.** A porta escreve também em `contatoLabels`, o espelho
legado que as telas de contato leem; a cópia do agente não escrevia. É uma
diferença que **não aparece em contagem nenhuma** de `entity_labels` — só
olhando a tabela que ficou de fora.

O que a ferramenta mantém de próprio é criar a tag ausente: o agente pode
etiquetar com nome novo, e a porta, de propósito, recusa tag inexistente. Criar
antes e então chamar a porta preserva o comportamento sem duplicar a regra.

`smoke-agente-tag-pela-porta` exercita a ferramenta como o runtime do agente a
chama — `mode: live` e `autonomy: autonomous`, o único par que escreve — e
confere as três coisas: as duas tabelas, o evento, e que **reaplicar não
republica** (senão a automação dispara a cada reexecução).

A trava não proíbe o registry de tocar o banco: ele lê muito, e leitura não
coordena efeito. Proíbe reimplementar a regra que já tem porta.

**Observação registrada, não corrigida:** `SPEC-IA-01`, citado na ordem de
execução, **não existe** no repositório nem no vault — mesmo caso do
`ONFACE-ARCHITECTURE-SPEC.md`, que esta página já nomeia no topo. A ordem
vigente continua sendo o HUB do ONFACE mais este documento.

**Validação:** tsc limpo, **345 testes / 0 falhas**, smoke novo verde, trava
provada por reintrodução.

### CP45 — O registro não sabia diferenciar a IA da automação

`ATORES` inclui `AI_AGENT` desde sempre, com o comentário que explica por quê:
*"Humano e IA usam o MESMO motor. A diferença é só quem executou, e é isso que
este tipo carrega por todo comando de negócio."*

**O tipo existia e nada o usava.** O adapter `crm_update_stage` fixava
`{ tipo: "SYSTEM", ref: "automacao:<entidade>" }`, e o `CadenceActionContext` não
tinha campo de ator — então quem chamasse não tinha como dizer quem era. Medido:
`vendas_eventos` com 41 linhas, **todas SYSTEM**, inclusive as do agente.
Perguntar *"o que a IA fez com meus leads"* não tinha resposta pelo registro
canônico.

O motor é compartilhado de propósito: a cadência roda sozinha e o agente usa a
mesma porta via `executarAcaoAvulsa`. O que faltava era o ator atravessar.

- `CadenceActionContext` ganhou `ator?: Ator`; ausente continua sendo `SYSTEM`,
  porque cadência de verdade não tem pessoa atrás.
- As três ferramentas do agente que movem etapa ou criam tarefa passam
  `{ tipo: "AI_AGENT", ref: agentId }`.

**E o defeito clássico apareceu no meio do conserto.** Com o campo na interface e
as ferramentas preenchendo, o smoke ainda dava `SYSTEM`: `executarAcaoAvulsa`
**remonta o contexto campo a campo**, e o `ator` morria nessa linha. É a forma
exata de "correção aplicada sem atualizar quem repassa" — só um smoke que
exercita a cadeia inteira encontra isso.

`smoke-ator-atravessa` move um lead pelos dois caminhos e confere que os dois
conjuntos de evento **não se confundem**: se o ator não atravessasse, seriam
idênticos, que era o estado anterior.

**Validação:** tsc limpo, **345 testes / 0 falhas**, smoke novo verde.

### CP46 — O relógio de trabalho andava sem trabalho, em dois lugares

`leads.updated_at` e `negocios.updated_at` não são "quando a linha mudou": o
board ordena por eles e o badge "Xd na etapa" sai deles. São **quando alguém
trabalhou isto**. Já custou duas vezes — um backfill bumpou 216 leads e o board
passou a mostrar "17min" em tudo; `rd-criativo` alcançaria 2.253.

A trava que nasceu daquilo só varria `lib/integrations`, e por isso não alcançava
os dois casos medidos hoje:

**`lead-scoring` gravava um número derivado e bumpava.** Os dois chamadores — a
criação do lead e o PATCH, que faz `set({ ...updateData, updatedAt: new Date() })`
antes de enfileirar — já bumpam por conta própria. Era redundante ali, e
perigoso no recálculo em lote que ainda não existe: mudar as regras de pontuação
jogaria a base inteira para o topo do board.

**`sync-negocio-valores` bumpava sempre, inclusive em lote.** Ele é chamado por
ações reais (mudar status, criar ou excluir proposta) e também por
`repair-negocios-valor-expirada`. Medido: o reparo alcança **372 negócios, 107
deles abertos**, com `updated_at` espalhado entre 20/07 e 22/09 — os 107 iriam
para o topo do Pipeline de uma vez.

O segundo **não virou proibição**, porque chamado por uma ação bumpar está
certo. Virou parâmetro `tocarRelogio`, com o default de sempre; o reparo o
desliga. Corrigir um valor calculado errado não é trabalho feito no negócio.

`smoke-relogio-de-trabalho` prova os três comportamentos contra o banco: o score
grava sem mover o relógio, a chamada por ação move, e a chamada em lote não.
Trava estendida e provada por reintrodução nos dois casos.

**Validação:** tsc limpo, **347 testes / 0 falhas**, smoke novo verde.

### CP47 — Chave de idempotência que carrega o relógio não dedupica nada

Uma chave de idempotência existe para responder *"este fato já foi
registrado?"*. Se ela inclui o instante da execução, a resposta é sempre **não**:
cada chamada gera chave nova. É pior que não ter, porque o código afirma que
protege.

Duas estavam assim, nas rotas que mexem no dono de uma conversa:

```
contato:${id}:${acao}:${agora.getTime()}              // agora = new Date()
contato:${id}:assignment:${updated.updatedAt.getTime()}
```

**E a segunda escondia um defeito maior.** A condição do tipo de evento estava
invertida: `contato.responsavelId === targetUserId` significa que a conversa **já
era daquela pessoa** — nada mudou — e mesmo assim publicava
`ConversationClaimed`; assumir uma conversa **sem dono**, que é o significado de
*claim*, caía em `ConversationTransferred`.

O padrão certo já existe no projeto, em `lib/crm/tags.ts`: **publicar só quando
MUDOU**, com a chave descrevendo o **estado alcançado**. `snooze` mostra a
fronteira: adiar de novo, com outro prazo, É outro fato, então a chave dele
carrega o prazo — que é estado, não relógio.

`domain_events` não tinha nenhum `Conversation*`: o caminho nunca foi exercido, e
por isso nenhuma contagem denunciava.

**A trava achou dois casos que eu não tinha visto**, e o segundo mudou o desenho
dela:

- `cadence-engine` usava `input.recebidaEm ?? new Date()`. O `recebidaEm` é fato
  externo e estável; o fallback trocava o fato pelo relógio. Corrigido.
- `lib/cs/handoff.ts` usa `new Date().toISOString().slice(0, 10)` — o **dia**, não
  o instante. Sem id de fatura, duas falhas da mesma empresa no mesmo dia são
  deliberadamente o mesmo fato. **Está certo**, e a primeira versão da trava o
  acusava. Virou exceção nomeada com o porquê, no mesmo desenho de
  `BUMP_JUSTIFICADO`. Uma trava dogmática a ponto de recusar a decisão certa é
  tão ruim quanto nenhuma.

**Validação:** tsc limpo, **349 testes / 0 falhas**, `smoke-evento-de-conversa`
prova os três casos (claim sem dono, reatribuir ao mesmo, transferir), trava
provada por reintrodução nos dois sentidos.

### CP48 — Varredura de isolamento, e um enriquecimento escondido numa rota

Varredura de **tenant isolation** sobre as 61 rotas do Hono, procurando o que o
CP27 achou: escrita por id sem escopo de organização.

O grep ingênuo dá **110 ocorrências**, e quase todas são o padrão seguro —
carregar o registro filtrando por organização, devolver 404 se não vier, e então
atualizar por id. Filtrando por **handler inteiro que nunca menciona
`organizacaoId`**, sobram 7:

| rota | veredito |
|---|---|
| 4 de `admin.ts` (organizações e usuários) | **legítimo**: são rotas de super-admin, que operam acima da organização por definição |
| `auth-flow POST /definir-senha` | **legítimo**: o token identifica o usuário |
| `perfil PATCH /` | **legítimo**: o usuário edita o próprio registro, por `ctx.userId` |
| `apollo POST /webhook` | **legítimo**: autentica com `timingSafeEqual`, e a organização vem do lead encontrado pelo `apollo_id` |

**Nenhum furo de isolamento.** Mas o webhook do Apollo entregou outra coisa: ele
preenche telefone e e-mail que **faltavam** e **bumpava `updated_at`**.

Isso é enriquecimento pela definição do CP46 — descobrir o contato de alguém é
dado que chegou, não trabalho feito no lead — e ficava **fora da varredura da
trava por causa da pasta**: é integração com nome de rota. É a mesma correção
que já tinha sido feita em `rd-criativo` (2.006 leads parados) e no lead scoring.

Hoje o banco tem **zero leads com `apollo_id`**: o caminho nunca foi exercido, e
por isso nenhuma contagem denunciava. A trava passou a cobrir integrações que
moram fora de `lib/integrations`, nomeando-as.

**Validação:** tsc limpo, **349 testes / 0 falhas**, trava provada por
reintrodução.

### CP49 — A data do aceite não era gravada, e três leituras dependiam dela

`propostas.aceita_em` é o campo que responde *"esta proposta foi aceita?"* para
três leituras: o checklist de fechamento, a fila de loops abertos e a tela de
proposta.

**Ele não estava sendo gravado.** `processarAceiteDaProposta` calculava
`aceitoEm` e mandava a data só para `clienteRespondeuEm`, que ninguém consulta
com esse significado. Medido: **427 propostas com `status = 'aceita'` e
`aceita_em` NULL em todas**, e **345 negócios** cujo checklist dizia *"sem aceite
registrado"* para uma proposta que já tinha gerado contrato.

**As históricas não têm conserto de dado, e não se inventa.** Elas vieram da
migração do CRM legado, onde o campo não existia. Procurei fonte: `updated_at` é
o relógio de trabalho; contrato (191) e ganho (355) vêm *depois* do aceite;
`cliente_respondeu_em` é NULL nas 427. Nenhuma é a data do aceite.

Por isso o conserto é dos dois lados:

- **escrita**: o aceite passa a gravar `aceitaEm`, para as próximas terem a data;
- **leitura**: checklist e fila reconhecem `status = 'aceita'` além da data, que
  é o dado que existe para as históricas.

Medido antes e depois no checklist: **0 de 5 reconhecidas → 5 de 5**.

**Honestidade sobre o alcance:** na fila de loops o efeito hoje é **zero**. A
consulta tratava 122 oportunidades como "proposta esperando resposta" por causa
disso, e **nenhuma delas está aberta** — proposta aceita vira negócio ganho, e a
oportunidade fecha. A correção vale para o caso que ainda não aconteceu, e o
efeito visível hoje é no checklist dos 345 negócios.

**Um erro meu, no caminho.** O smoke deixou 3 leads para trás: a limpeza pulava
`pontos_contato`, que segura `pessoas`, que segura `leads` — os três DELETEs
falhavam em cadeia, em silêncio, porque cada um tem `.catch()`. E o assert de
resíduo media **`negocios`**, tabela que a limpeza conseguia apagar, então dizia
"resíduo 0". Os 3 leads quebraram três testes de reconciliação na rodada
seguinte. Agora a limpeza segue a ordem das FKs e o assert conta as quatro
tabelas que o smoke cria.

**Validação:** tsc limpo, **349 testes / 0 falhas**, smoke provado por
reintrodução nos dois consertos.

### CP50 — 70% das empresas mostravam "sem atividade" tendo atividade

Varredura sistemática do padrão que o CP49 revelou: **coluna que alguém lê e
está 100% NULL no banco**. Das 779 colunas anuláveis em tabelas com dado, 317
estão inteiramente vazias — a maioria legitimamente (integração não usada, campo
de outro CRM na migração). Cruzando com quem as lê, sobrou **uma**.

`atividades.empresa_id`: **13.044 atividades, zero com empresa**. O campo existe
no schema, mas as atividades vieram da migração do CRM legado, onde ele não
existia, e quem escreve hoje só o preenche quando o chamador passa a empresa. Na
prática, **a atividade chega à empresa pelo lead**.

Medido: das **2.250 empresas**, zero têm atividade por `a.empresa_id` e **1.575
têm pelo lead**. Na listagem, a coluna "última atividade" ia de **0 de 200 para
109 de 200**.

**Dois dos três leitores já estavam certos**, e é isso que torna o achado
convincente: o Cliente 360 (`clientes-crm2`) faz `or(empresaId, inArray(leadId))`,
e `fulfillments.ts` tem o comentário que registra o problema — *"ligada via
leads.empresaId (atividades não tem empresaId direto)"*. A listagem de empresas
era o lugar que não tinha acompanhado.

A união preserva os dois caminhos: o campo direto continua valendo para as
escritas novas, e o lead cobre a base histórica.

**Validação:** tsc limpo, **349 testes / 0 falhas**, smoke prova os dois caminhos
e a reintrodução devolve o vazio.

### CP51 — "Clientes ativos" tinha duas contas: 361 e 272

O Módulo 12 é explícito: *"mesma métrica não possui cálculos diferentes em telas
distintas"*. A trava que nasceu disso só olhava **MRR**, porque foi o MRR que
custou cinco expressões e números de R$ 61 mil a R$ 497 mil. A segunda métrica
repetida passou despercebida.

`analytics/inicio.ts::getClientesAtivos` tinha a própria conta, com um filtro a
mais que o catálogo: `portfolio_included = true`. Medido na mesma base:

| | empresas |
|---|---|
| catálogo (`clientes_ativos`) | **361** |
| a função das telas | **272** |

**89 a menos, 33% de diferença**, e três telas liam a versão curta: a home do
CRM2, a Visão Geral e a home do ONFACE.

O Documento Mestre define cliente ativo como **Company + Service ACTIVE**, sem
menção a portfólio — então a definição catalogada é a correta, e a função passou
a chamá-la. `portfolio_included` continua sendo um recorte legítimo (a carteira
comercial, que a fila de CS usa); o que não pode é dois recortes com o mesmo
nome.

**A trava nova acusou três lugares certos antes de ficar boa**, e os três
ensinam a fronteira: `novos_30d` conta entradas do período (outra métrica), o
painel de CS conta empresas com risco aberto (outra coisa), e a fila de CS conta
a carteira — marcada por `portfolio_included`. A trava passou a olhar a
**consulta**, não o arquivo, e a reconhecer esses três recortes.

**Validação:** tsc limpo, **350 testes / 0 falhas**, a tela e o catálogo agora
respondem o mesmo número, e a reintrodução da conta própria deixa a trava
vermelha.

### CP52 — Três varreduras limpas, e a trava do botão morto

Rodada de auditoria em que **o resultado principal foi não achar nada** em duas
lentes, e isso vale registrar com a mesma clareza de um achado.

**Métricas restantes do catálogo.** Depois do CP51, varri as outras cinco.
`oportunidades_abertas` aparece em `relatorios/comercial.ts` com agregação
própria, mas agrupada por etapa e tipo de receita — é drill-down, outra
granularidade, a mesma distinção que a trava do MRR já faz. Conferido no banco:
**527 no catálogo, 527 somando o relatório**. Coerente.

**Erro engolido em silêncio.** O CP12 pagou por um `catch` cego que mostrou duas
consultas quebradas como "0". Varri o `src` inteiro: 4 `catch` vazios e 31 que
devolvem valor neutro. **Nenhum sobre consulta ao banco** — os 31 são parsing de
JSON de requisição, e os 4 vazios são `fs.unlinkSync` em `finally`, limpeza de
temporário onde falhar não importa.

**Chamada do front para rota inexistente.** Esta rendeu a trava. O defeito já
passou por uma revisão inteira — em 16/09 um botão foi aprovado sem fazer nada —
e nenhum teste de tipo pega, porque a URL é string.

Cruzadas as **336 rotas** do Hono e do Next contra todo `fetch("/api/…")` do
front: **zero órfãs**. Mas o caminho até esse zero é o que a trava registra,
porque me deu dois falsos positivos:

- **o prefixo vem da montagem**, não da declaração: `admin.ts` declara
  `/org-switch` e o servidor monta `app.route("/api/admin", …)`. Assumir `/api`
  fixo acusou **44** rotas que existem;
- **a URL do front é template**: `fetch(\`/api/metas/usuario/${id}\`)` lido até o
  `${` vira três segmentos contra quatro da rota. Comparar por igualdade acusou
  mais **13**. A chamada vale como prefixo da rota.

**Validação:** tsc limpo, **351 testes / 0 falhas**, trava provada por
reintrodução (um `fetch` para rota inventada é acusado pelo nome do arquivo).

### Auditoria de CS Health (histórico da decisão)

Menor do que o gap analysis inicial dizia:

| Perna | Estado |
|---|---|
| cálculo de risco | **existe** — `reavaliarRiscos`, 514 riscos reais |
| scheduler | **existe** — job `cs-sweep` no worker |
| painel/UI | **existe** — `painelCs`, `lib/cs` com 3.353 linhas |
| score de health | **não existe** |
| materialização | **não existe** — `cs_health_snapshots` com zero escritores |

`health-check.ts` é a pesquisa de NPS, conceito diferente. Falta o score e a
materialização, ligados no sweep que já roda.

## Bloqueios reais

Nenhum deles impede outro trabalho: são itens que dependem de credencial, dado
externo ou decisão do Kauã.

| # | bloqueio | efeito enquanto durar |
|---|---|---|
| 1 | Credencial de IA. NEXO e Hermes apontam para `anthropic`, e o ambiente só tem `GROQ_API_KEY` | os dois agentes não executam. O gate de publicação agora recusa e explica, em vez de deixar o contato sem resposta |
| 2 | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Agenda fica "não configurada" no hub; Microsoft 365 cobre a operação atual |
| 3 | Planilha mensal da Holding (PABX) | faturado e recebido de PABX seguem zerados. Agora é zero por dado ausente, e não por filtro quebrado |
| 4 | 1.084 oportunidades sem `service_family` | trava o filtro por produto nos relatórios, que por isso não foi construído |
| 5 | 4 prices do Stripe sem nome | catálogo sincroniza, esses quatro ficam sem rótulo legível |
| 6 | 275 contas de CS sem responsável | a fila de CS não consegue atribuir dono a elas |
| 7 | Catálogo PABX incompleto: faltam Plano, Setup, Integração, Serviço e 2 linhas (172 preços do snapshot ausentes no banco) | o vendedor não monta venda de PABX no sistema novo; `validar-catalogo-oficial` deixa o passo 9 da virada vermelho. **Importar a planilha NÃO resolve sozinho:** o worker roda `catalogo-stripe-sync` de hora em hora e desativa todo preço que não estiver no Stripe (CP33, CP41) |
| 8 | `STRIPE_API_KEY` vazia no ambiente de dev | impede medir por que o Stripe devolveu 55 preços e a planilha tem 213. Uma chave **de leitura** roda `catalogo:sync:dry` e distingue as duas causas possíveis, que têm custos muito diferentes: metadata faltando nos produtos (barato) ou os preços não existirem no Stripe (caro) |

**Achado do CP12 ENCERRADO no CP57, com a causa medida.** "Meta CAPI
configurada e com zero entregas" era verdade e era enganoso. A causa é que **não
existe evento de negócio para lead da Meta desde que o outbox existe**: o outbox
começou em 21/09, o lead mais recente do banco é de 18/09, e os 33 eventos que
há são de smoke e teste. A integração entrega quando há o que entregar, e isso
agora está provado no formato que a base de verdade tem, não só no do smoke.

## Nota de auditoria — inconsistência levantada pelo Kauã em 21/09

Foi apontada contradição entre "corrigi quatro colunas de `billing_customer_aliases`" e
"nenhum arquivo foi alterado nesta branch". Verificado:

- a correção **existe** e está aplicada: `isCanonical`, `resolutionSource`, `evidence`,
  `updatedAt` presentes, e a coluna inexistente `origem` removida;
- ela entrou no commit `98940fe`, feito na branch `consolidado-20260920`;
- `git branch --contains 98940fe` lista as duas branches, ou seja
  `refactor/arquitetura-canonica` nasceu desse commit e herda a correção;
- por isso `git status` na branch de refactor mostra **0 arquivos alterados**.

As duas afirmações eram verdadeiras. A comunicação foi ambígua por não dizer que a
correção estava em commit anterior herdado, e não em alteração pendente.

### CP53 — O guarda do CP42 recusava o prospect mais comum do outbound

**O verificador não enxergava build quebrado.** Uma crase dentro de comentário
SQL, dentro de template literal, derrubava sete telas, e `checar-rotas-onface`
dizia "HTTP 500" sem nomear o arquivo. A leitura do corpo passou para ANTES da
checagem de status: a mesma falha volta ora como 200 com o overlay do dev, ora
como 500 limpo, e o que separa as duas é o instante da recompilação, não a
gravidade. Medido na reintrodução: 7 rotas acusadas com o arquivo no relato,
contra 3 sem nome na versão anterior, e 14/14 depois de restaurar.

**A regressão que eu mesmo plantei no CP42.** A trava passou a lançar em toda
falha da ponte canônica. Só que o domínio recusa de propósito quando não há
e-mail nem telefone, porque sem identificador não há como saber se a pessoa já
existe, e criar às cegas é como a base ganhou duplicata durante anos. O prospect
de outbound nasce exatamente assim, com empresa e nome do decisor, e o contato
vem depois. O aceite de vendas parava inteiro em "informe e-mail ou telefone".

`ResultadoPonte` ganhou `codigo`, que a ponte descartava, e só
`SEM_IDENTIFICADOR` passa. É o terceiro guarda desta leva a recusar a decisão
certa: CP47 com granularidade de dia no handoff de CS, CP51 com três recortes
legítimos, agora este. A conclusão já não é hipótese: guarda que impede o certo
custa tanto quanto guarda nenhum, e a diferença entre os dois é medida em quanto
tempo se perde acreditando no vermelho.

**A metade sem a qual a correção seria pior.** Relaxar a trava sozinha trocaria
um erro por um órfão permanente, que é o buraco que o CP42 existe para tapar.
`preQualificar` virou a segunda chance de entrada canônica: é a saída do
outbound para Pré-vendas, o momento em que o contato já foi descoberto. Chamada
com a MESMA `idempotencyKey`, e a repetição é coberta por dois caminhos
independentes de deduplicação que o domínio já tinha.

**A duplicata silenciosa que isso revelou.** `adicionarProspect` resolve a
pessoa pelo caminho de vendas, que cria com nome; a porta resolve pelo caminho
do domínio, que só acha por e-mail ou telefone. Sem contato, a segunda não
reconhece a primeira e cria outra, e `idx_pessoas_lead_legado`, que é ÚNICO,
estoura ao ligar as duas ao mesmo lead. A correção é na raiz: o contato
descoberto chega na pessoa já ligada antes de a porta ser chamada.

Vale registrar o formato do assert, porque o óbvio não pegaria: contar por
`lead_id_legado` dá 1 nos dois casos, porque a segunda pessoa fica SOLTA, sem
vínculo, enquanto a aquisição aponta para ela. Quem enxerga é a contagem por
nome. Reintrodução mede 2.

**A limpeza que matava o aceite depois de ele passar.** `aceite-cs` apagava
`negocios` sem soltar a oportunidade espelho (`oportunidades.negocio_id_legado`,
FK sem cascade). Morria no final, com os 12 testes verdes, o que faz a falha
parecer de outro lugar. Deixou 3 oportunidades sem etapa no banco, e elas
derrubaram `relatorios/cobertura.test.ts` duas fases adiante. Resíduo removido.

**Aceite que segue vermelho, e está certo:** `validar-catalogo-oficial` acusa
PABX sem plano, setup, serviço e integração. Bloqueio de dado à espera do Kauã,
não defeito de código.

Validação: tsc limpo, 351 testes / 0 falhas, 44 smokes, 14/14 rotas do ONFACE.

### CP54 — "zero leads sem aquisição" não provava nada

As cinco rotas de cutover chamam `garantirEntradaCanonica` com `void`, de
propósito ("falha aqui não derruba a criação"). O preço é que ninguém fica
sabendo quando falha: a recusa do domínio volta como RETORNO, não como exceção,
e por isso não passava nem pelo `catch` da ponte.

**A medição que parecia responder, e não respondia.** Zero dos 3.989 leads está
sem aquisição. Dos 400 criados nos últimos 30 dias, os 400 têm a aquisição
criada em menos de 60s do lead. Os dois números são verdadeiros e não querem
dizer o que parecem: o lead mais recente do banco é de **18/09**, o backfill da
fase 06 rodou em **21/09** gravando a aquisição com `created_at` COPIADO do
lead, e `AcquisitionCreated` saiu em **0 de 400**.

Fica a regra, que vale para qualquer medição futura nesta base: **presença de
aquisição não distingue runtime de backfill.** O sinal que só o runtime produz
é o evento. É a mesma armadilha do CP42, agora com o mecanismo nomeado.

**A prova que faltava.** `smoke-portas-de-entrada` exercita `POST /api/leads` e
`POST /api/contatos-unified` pela API HTTP real, com sessão de verdade, e cobra
as três coisas juntas: o lead nasce, a aquisição aparece e o evento entra no
outbox. As duas passam. A aquisição chega **1ms** e **102ms** depois da
resposta, e essa é a janela em que o registro existe no legado e ainda não
existe no canônico. Reintroduzindo a falha na ponte, as duas ficam vermelhas, e
sem o smoke seria invisível: lead criado, resposta 201, log limpo.

`smoke-ponte-canonica` continua provando que a ponte funciona quando chamada.
Este prova que as rotas a chamam e que a chamada chega ao fim, que é outra
pergunta.

**A parte que faltava fechar, sem contrariar a decisão.** A ponte passou a
registrar a recusa do domínio, menos `SEM_IDENTIFICADOR`, que é caso legítimo e
viraria ruído até ninguém mais ler o log. O `void` segue best-effort; o que
muda é deixar de ser mudo.

**Dois achados de caminho.** `POST /api/leads` não cria só o lead: sai com
oportunidade e negócio junto, o que só apareceu pelo resíduo que a limpeza não
conseguia apagar. E a limpeza do smoke engolia o erro com `catch` mudo, o mesmo
defeito que custou três testes de reconciliação no CP49; o `catch` agora fala.

Observado uma vez e não reproduzido: a bateria acusou 1 de 45 logo depois de eu
deixar resíduo no banco com a reintrodução, e passou nas três execuções
seguintes. A hipótese é o resíduo, não medida.

Validação: tsc limpo, 351 testes / 0 falhas, 45 smokes, 14/14 rotas.

### CP55 — a varredura que deu zero, e era falsa

O próprio plano tinha registrado o aprendizado do par CP20/CP21: *"a dependência
escrita num placeholder envelhece… vale reler as sete restantes quando o domínio
mudar"*. Entre o CP22 e o CP54 o domínio mudou muito, e ninguém releu. **Três das
sete descreviam o mundo de semanas atrás:**

| tela | o que dizia | o que é hoje |
|---|---|---|
| Expansão & Renovação | "não existe pipeline de expansão no domínio" | existe: `executarCheckpoint` cria oportunidade com `commercial_motion = EXPANSION`, e `smoke-expansao-entra-no-canonico` exercita o caminho. Falta **histórico**, zero registros |
| Carteira | "não existe responsável de carteira no banco" | `clientes.responsavel_cs_id` existe e está NULL nas **275** contas. É atribuição de gente, e já estava na lista de bloqueios do Kauã |
| Pós-vendas | "decidir se é tela própria ou só agrupamento no menu" | a árvore congelada em 16/09 respondeu metade: Pós-vendas **é** o pai de Onboarding e Implantação. Resta se o destino clicável mostra resumo próprio |

A diferença não é cosmética: cada uma dessas frases dizia que faltava
*construir*, quando o que falta é decidir, atribuir ou usar. É outra pessoa
destravando.

**A varredura que deu zero e era falsa.** Cruzei todo link de navegação com as
147 rotas de página: **0 órfãos**. O número era mentira. O padrão lia só `href=`
(a forma do JSX) e a árvore de navegação declara `href:` (a forma de objeto),
então o arquivo mais importante do cruzamento era justamente o que não era lido.
Só descobri porque a reintrodução NÃO acusou: um link quebrado de propósito no
menu passou verde.

Com o padrão certo a medição acusa, e o resultado real continua sendo zero — mas
agora é um zero que vale alguma coisa.

Fica a regra, e ela generaliza as varreduras limpas do CP52: **varredura que
devolve zero precisa ser provada ao contrário antes de virar boa notícia.**

**Duas travas.** `link-nao-leva-pro-vazio` é o irmão de
`botao-nao-aponta-pro-vazio` pelo lado de quem clica: cobre item de menu, botão
e `router.push` que levam a rota de página inexistente, com as mesmas duas
regras de lá (route group não entra na URL; a comparação vale como prefixo,
porque a URL costuma ser template). `pendente-diz-a-verdade` cobre a coerência
entre a marca do menu e a tela, **nas duas direções**: item marcado com tela
construída, e tela `ModuloPendente` sem marca no menu. As duas provadas por
reintrodução.

A segunda é também o primeiro consumidor de `destinosPendentes()`, que era
exportado e não tinha nenhum — "peça pronta sem caller" no arquivo que serve de
inventário justamente do que falta.

**Varredura limpa, registrada como tal:** nenhuma tela do ONFACE renderiza
fixture. `visao-geral/mock.ts` só é importado por `/onface-desenho`, que é a
referência congelada; as telas do preview leem dado real. O `"—"` das pendências
da Visão Geral não é placeholder: `getPrecisaAtencao` devolve contagens
agregadas ("6 negócios parados"), e agregado não tem responsável nem cliente
único. O que estava desatualizado ali era `PENDENCIAS_DE_DADO` — que também não
tem consumidor.

Validação: tsc limpo, 354 testes / 0 falhas, 45 smokes, 14/14 rotas.

### CP56 — a trava de tenant isolation passava verde varrendo zero rotas

Regra do CP55 aplicada às travas antigas. Das **23** travas arquiteturais, 17
varrem diretório e **11 não tinham nenhuma conta** do que alcançaram.

**A pior é a de isolamento de tenant**, que está na lista do que não pode
regredir. Ela filtra rotas procurando `const ctx = await getCtx`. Troquei o nome
por um que não existe, simulando o código renomear o helper: **os dois testes
ficaram verdes examinando zero rotas**. Com a conta, o mesmo experimento falha
dizendo quantas alcançou.

**E o padrão escondia pior que a falta da conta.** "Todo arquivo que CRIA lead
passa pela porta canônica" procurava `db.insert(leads)`, e o repositório tem
**zero** ocorrências dessa forma: o estilo é `await db` quebrado em linha antes
do `.insert`, e há `tx.insert(leads)` em transação.

| trava | alcançava | existem |
|---|---|---|
| criador de lead → porta canônica | **2** | 9 |
| criador de negócio → oportunidade | **3** | 9 |

Os 7 de fora do primeiro incluem `routes/leads.ts`, que o comentário da própria
trava chama de maior porta de escrita do sistema. Verde de 22% de cobertura é o
falso verde mais caro que existe, porque essa trava guarda a dívida central do
projeto: o dado que entra por porta que não aplica a regra.

Corrigidos os padrões, os 8 criadores de lead e os 9 de negócio passam todos
pelo canônico. Sobra `lib/db/seed.ts`, que popula a base do zero fora de
qualquer jornada: isenção **nomeada**, em vez de continuar escondida atrás de um
padrão frouxo.

**A trava do CP52 também estava estreita.** Lia só `fetch("/api/…")`, e os
helpers do front (`requestJson(url)`, `apiFetch`) recebem a URL pronta, com o
literal no chamador. Medido: **424 URLs `/api` literais no front, 356 lidas, 68
fora** — 16% da superfície. Nenhuma das 68 era órfã, mas ninguém sabia porque
nada olhava. Passou a ler qualquer literal `/api/…`, com duas exclusões que o
levantamento exigiu: linha de comentário e cliente de API externa (`lib/apollo/
client.ts`, onde `/api/v1/people/match` é caminho da Apollo).

O formato do defeito, que vale para a próxima trava: **o padrão não cobre a
forma que o código realmente usa.** `db.` colado contra quebra de linha,
`fetch(` contra helper, `href=` contra `href:`. Três ocorrências em dois dias.

Validação: tsc limpo, 354 testes / 0 falhas, 45 smokes, 14/14 rotas.

### CP57 — "zero entregas" era falta de tráfego, e o smoke não cobria a base real

O estado registrava, desde o CP12, um achado aberto: *"Meta Conversions API está
configurada e com zero entregas. Token existe, smoke passa, nenhuma conversão
entregue de verdade."* É o formato de defeito que esta leva vem encontrando, e
por isso valia medir em vez de acreditar nas duas pontas.

**A causa é falta de tráfego, e ela se prova por datas.** O outbox tem 33
eventos, 26 processados, **zero com erro ou tentativa**. O mais antigo é de
21/09; o lead mais recente do banco é de **18/09**. Não houve um único fato de
negócio para lead da Meta desde que a entrega existe. `meta_capi_entregas` está
vazia porque não teve o que registrar.

**O que a medição achou de verdade foi um buraco de cobertura.** Dos 3.989
leads, **797 têm `meta_ad_id`** e o ponto de contato deles traz `ad_id` e
`campaign_id`. E **zero** dos 1.583 pontos de contato têm `fbclid`, `fbc`, `fbp`
ou `meta_lead_id`: atribuição de campanha o histórico tem, identificador de
usuário não.

Os dois cenários de `smoke-capi-outbox` sempre criavam `meta_lead_id`. O caminho
que **797 registros percorreriam** nunca tinha sido exercido uma vez. Que ele
funcionaria dava para deduzir lendo o código — `veioDaMeta` aceita `campaignId`
sozinho e a identidade vem do e-mail —, mas dedução não é medição, e a diferença
entre as duas é o assunto desta fase inteira.

Cenário 3 acrescentado, com o formato da base. **Entrega.** Verificado por
reintrodução: tirando `campaignId` de `veioDaMeta`, as entregas caem de 2 para 1
e o smoke acusa.

**Um assert envelheceu no caminho.** `entregas.entregues === 1` ficou vermelho no
instante em que o terceiro cenário entrou: o smoke acusou a integração
funcionando melhor do que antes. Passou a contar contra a quantidade de cenários
com sinal da Meta, declarada ao lado deles. Mesmo formato do número mágico que o
CP33 tirou do validador do catálogo.

Validação: tsc limpo, 354 testes / 0 falhas, 45 smokes.

### CP58 — terceiro resíduo de teste em dois dias, e sempre longe da causa

| quando | o que ficou | onde apareceu |
|---|---|---|
| CP49 | 3 leads | 3 testes de reconciliação |
| CP56 | 3 oportunidades sem etapa | `relatorios/cobertura.test.ts`, **duas fases adiante** |
| CP58 | 6 empresas, 1 tarefa, 4 eventos de outbox órfãos | a checagem nova, na hora |

O padrão é sempre o mesmo, e não é desleixo: **a limpeza de cada script conhece
as tabelas que ELE escreve**, e envelhece quando a escrita cresce por baixo. A
ponte canônica passou a criar oportunidade; o evento passou a ir para o outbox.
Nenhum script incluiu o que ele não escreveu com as próprias mãos.

O que torna caro é que o resíduo nunca aparece onde nasceu. No CP56 ele apareceu
num teste de cobertura de outra fase, onde ninguém procuraria.

**`checar-residuo-de-teste`** olha o banco inteiro pelas marcas que os scripts
usam (`smoke-`, `[ACEITE`), roda **por último** nas duas baterias, e **não limpa
nada de propósito**: limpar esconderia o defeito e deixaria a próxima execução
sujar de novo. O que se quer é o script culpado aparecer.

**Achou dois defeitos meus, de hoje, na primeira execução.**
`smoke-prospeccao-entra-no-canonico` passou a publicar evento quando
`preQualificar` virou a segunda chance de entrada canônica (CP53), e
`smoke-portas-de-entrada` nasceu publicando (CP54). Nenhum dos dois limpava o
outbox, porque quem escreve nele é a ponte, não o script: **2 eventos pendentes
órfãos por execução, cada um**.

**Uma checagem foi estreitada antes de entrar.** A primeira versão contava todo
evento órfão e acusou 8, todos já processados. Evento processado cujo agregado
foi apagado depois é registro histórico legítimo, e é para isso que
`domain_events` existe. Só o PENDENTE atrapalha, porque o consumidor vai
pegá-lo, não vai achar contexto e vai gravar auditoria que não responde nada.
Acusar o histórico junto seria a trava dogmática que esta leva já pagou três
vezes (CP47, CP51, CP53).

Validação: tsc limpo, 354 testes / 0 falhas, 46 verificações na bateria, aceites
verdes menos o catálogo PABX.

### CP59 — o conferidor de ambiente mandava apagar a credencial que o CP57 provou funcionar

Três verificadores tinham chamador **só em npm script** (`check:env`,
`check:vendas`), que nenhuma bateria executa. É o buraco do CP32/CP33 de novo, e
`checar-env` estava **vermelho** sem ninguém saber.

Ele acusava 6 variáveis lidas pelo código e ausentes do `.env.example`, e
listava **23 como candidatas a remoção**. Entre as 23 estavam as sete da Meta,
inclusive `META_CAPI_ACCESS_TOKEN` — cuja entrega o CP57 tinha acabado de provar
que funciona. **Quem seguisse o conselho apagaria a credencial em uso.**

Duas causas, as duas do formato que esta leva vem encontrando:

| causa | efeito |
|---|---|
| varre só `app/src` | o repositório virou monorepo e `packages/` inteiro ficou fora |
| padrão exige `process.env.` colado | `packages/integrations/meta` lê `env.META_CAPI_ACCESS_TOKEN` de um objeto recebido |

Corrigidos os dois, as candidatas a remoção caíram de **23 para 7**, e nenhuma
das que sobraram é da Meta. Acrescentado também o que a INFRAESTRUTURA lê: sem
isso `DB_PASSWORD` e a chave do wuzapi apareciam como removíveis, e removê-las
quebraria o `docker-compose` sem que nada em TypeScript acusasse.

**Um falso positivo no caminho, e é o mesmo erro pela quarta vez em dois dias:**
o padrão novo capturou o `env.VAR` que eu tinha escrito no comentário explicando
o padrão novo. Comentário passou a não contar — a mesma correção do CP56.

As 19 ausentes foram documentadas (Callface AI, dataset da CAPI, Documenso, as
quatro chaves de virada, wuzapi e as duas do verificador de telas). O exemplo
cobre as **100** variáveis que o código lê, e os três verificadores entraram na
bateria: **46 → 49**.

Validação: tsc limpo, 354 testes / 0 falhas, 49 verificações, 14/14 rotas,
aceites verdes menos o catálogo PABX.

### CP60 — o verificador que autoriza a virada não conseguia conectar no banco

Varrendo os **32 npm scripts**, dez não são invocados por nenhum runner, CI ou
documento. Oito são operacionais e é assim que devem ser (`db:migrate`,
`catalogo:sync`, `posvenda:reprocessar`). Dois são verificadores.

**`check:pre-deploy` é o que responde "pode subir?"**: confere se alguma linha do
banco impede as migrations do refactor. Ele chamava `tsx` **sem `--env-file`**,
então morria em `DATABASE_URL não definida` antes da primeira consulta. O
verificador que autoriza a virada nunca tinha rodado com sucesso.

Vale registrar que ele **falha do jeito certo**: sem conseguir verificar, diz
"NÃO PRONTO" em vez de dizer "PRONTO". Foi por isso que o defeito apareceu como
erro e não como falso verde — o contrário do que aconteceu na trava de tenant do
CP56.

Com o `.env` carregado (`--env-file-if-exists`, como o `test` já fazia), ele
responde: **PRONTO, nenhuma linha impede as migrations**, e as oito do refactor
já estão aplicadas neste banco. Entrou na bateria: **49 → 50**.

O outro, `ds:strict`, acusa 4.264 violações herdadas com placar que zera módulo
a módulo. É dívida conhecida e gerenciada, não defeito novo, e fica como está.

Validação: tsc limpo, 354 testes / 0 falhas, 50 verificações.

### CP61 — a imagem era construída sem nenhuma verificação de tipo

`next.config.ts` tem `typescript.ignoreBuildErrors` desde o commit inicial, e
isso estava **documentado como armadilha conhecida** em dois lugares: o README
dizia "o build não é portão de tipo", e o TASK-001 avisava que *"npm run build
passar NÃO prova typecheck limpo; o gate é `tsc --noEmit`"*.

A compensação existia. O que ninguém tinha conferido é se ela estava no caminho
que importa:

```
Dockerfile:12   RUN NEXT_TYPESCRIPT_CHECK=false npm run build
```

Nenhum `tsc`. **A imagem que vai para produção era montada sem nenhuma
verificação de tipo**, e o gate morava só na disciplina de quem lembrava de
rodar o comando à mão.

É o formato desta fase inteira, aplicado a uma decisão documentada: a
documentação registrava a armadilha e a compensação, e ninguém checou se a
compensação alcançava o caminho de deploy.

`npm run build` passou a ser `npm run typecheck && next build`. O portão fica em
TODO caminho que constrói, incluindo o da imagem, **sem tocar no Dockerfile**.
Verificado por reintrodução: com um erro de tipo plantado, o build para em
`error TS2322` e não chega a compilar.

`ignoreBuildErrors` fica, agora com o motivo escrito no arquivo: o tsc já rodou
antes, e deixar o Next checar de novo só custaria tempo. O README deixou de
descrever o estado antigo.

Validação: tsc limpo, 354 testes / 0 falhas, 50 verificações, build completo com
o portão, 14/14 rotas reconferidas depois do build (ele sobrescreve `.next`).

### CP62 — portão automático entre escrever código e empurrar

O diagnóstico da fundação registrou em 19/09: *"Não existe nenhum portão
automático entre escrever código e subir em produção. Sem CI."* O CP61 cobriu
quem constrói. Este cobre quem empurra.

`.github/workflows/portao.yml` responde **uma** pergunta, e responde de verdade:
o que foi empurrado compila e não fura nenhuma regra de arquitetura. Typecheck
com o mesmo comando que o `build` usa, e as **91 travas de arquitetura**.

**Só isto, e por um motivo medido.** As 91 travas e o `tsc` rodam limpos com
`DATABASE_URL` ausente. Os outros 263 testes e os 50 smokes vão contra um banco
carregado com dado de produção, e não existe banco assim no CI. Rodá-los contra
um banco vazio não provaria nada e acabaria em vermelho permanente, que é como
um portão morre. Essa parte continua sendo a bateria local
(`scripts/rodar-smokes.sh`, `scripts/rodar-aceites.sh`).

Verificado com os comandos exatos do workflow: typecheck sai 0, as 91 travas
passam sem banco, e o dry-run confirma o lockfile sincronizado para o
`--frozen-lockfile`. A versão do pnpm declarada é a que gerou o lockfile.

**Achado anotado e não tocado:** o repositório é workspace **pnpm**
(`pnpm-workspace.yaml`, 42 projetos), e o `Dockerfile` instala com `npm ci`
sobre um `app/package-lock.json` legado. Os dois convivem hoje; vale decidir
qual é o gerenciador antes da virada.

### CP63 — nenhum dos três containers do CRM construía desde que o repo virou monorepo

Achado enquanto eu anotava uma inconsistência menor no CP62 ("workspace pnpm x
`npm ci` no Dockerfile"). **Provado com `docker build`, não por leitura:**

```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

Duas incompatibilidades no mesmo ponto. `app/package.json` declara os nove
`@onface/*` como `workspace:*`, protocolo do pnpm que o `npm ci` não entende. E
o contexto do build era `./app`, então `packages/` não entrava na imagem nem se
o instalador entendesse. Os três Dockerfiles — app, api e worker — morrem no
mesmo `npm ci`.

**Isso não é detalhe de build: a virada depende de construir estas imagens**, e
elas estavam impossíveis desde a primeira fase do refactor. Ninguém notou porque
ninguém constrói imagem desde então.

| container | estado |
|---|---|
| api | **constrói e sobe** — `[API] Process 1 listening on port 3001` |
| worker | **constrói e sobe** — `[Worker] All workers started successfully` |
| app (Next) | corrigido no mesmo padrão, **build não validado** (ver abaixo) |

**O defeito seguinte, que só o container revela.** Com `--packages=external` os
`@onface/*` ficavam externos, e o Node tentava carregar `index.ts` em runtime:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'/repo/packages/domain/acquisition/commands/registrar-entrada'
```

Os pacotes são TypeScript puro, sem build próprio (SPEC §34). O Next resolve com
`transpilePackages`; no esbuild, quem resolve é o alias, que tira o import de
"bare" e faz o pacote ser compilado para dentro do bundle. Medido: **0**
ocorrências de `@onface/` no bundle e o domínio presente.

`next.config` ganhou `outputFileTracingRoot` explícito. O Next acerta sozinho
hoje **e avisa que pode não acertar**, porque encontra dois lockfiles
(`app/package-lock.json` legado). A raiz decide o FORMATO da saída e o
`Dockerfile` copia dela: se a inferência mudar, o servidor sai noutro caminho e o
`CMD` aponta para um arquivo que não existe — falha no container, não no build.

**NÃO VALIDADO, e é o que falta:** o build da imagem do app (Next) não completa
nesta máquina. O Docker local tem **3,8 GB e 2 CPUs**, e o `next build` é morto
por SIGKILL com 1536 e também com 3072 de heap. O typecheck dentro do container
saiu pelo mesmo motivo, e o portão de tipo continua no CI (CP62) e no `npm run
build` local (CP61). **Falta construir a imagem do app numa máquina com mais
memória** — é o único passo desta correção que não pôde ser provado aqui.

Validação: tsc limpo, 354 testes / 0 falhas, 50 verificações, 14/14 rotas,
`docker compose config` válido resolvendo os três Dockerfiles novos.

## Camada de experiência (UX) — em andamento

Branch `redesign/onface-ux-spec-v1`. O `refactor-state` acima descreve o
backend; esta seção descreve a interface, que é o que o passo "QA do Kauã na
tela" depende.

**Nota de fonte:** o aviso no topo deste documento de que `ONFACE-ARCHITECTURE-SPEC.md`
e `SPEC-IA-01` não existem está desatualizado. Os três documentos normativos
estão em `~/Downloads/`: `ONFACE-DOCUMENTO-MESTRE-PRODUTO-JORNADAS-v13.md`,
`ONFACE-SPEC-IA-01-INTELLIGENCE-RUNTIME.md` e `ONFACE-ARCHITECTURE-SPEC.md`,
mais o `ONFACE-UX-EXECUTION-SPEC-v1.md`.

| Frente | Estado |
|---|---|
| Tipografia | **concluída** — Plus Jakarta única, medido 100% |
| App Shell | **concluída** — sidebar + topbar do §1.2/§1.3 |
| Estrutura de página | **concluída** — sem faixa hero, resumo hierárquico |
| Módulo Vendas | **concluído** — 5 telas no padrão novo |
| Início | **concluído** — rota canônica serve a Visão Geral |
| Atendimento | **parcial** — vazio, erro, validação e altura resolvidos; o layout de três painéis do §17.2 ainda não é o do spec |
| Clientes / Onboarding / Implantação / CS | **parcial** — CS reconstruído (faixa hero fora, filtro único, dois filtros mortos removidos); Carteira/Onboarding/Implantação só com o cabeçalho novo |
| Automações / Agentes / Execuções | **parcial** — título duplicado removido; sub-rotas pendentes |
| Financeiro | pendente |
| Insights / Relatórios | **parcial** — faixa hero fora, abas e período numa linha, esqueleto de carregamento, gráfico de faturamento por categoria voltou (500 no `GROUP BY`) |
| Tarefas | **concluída** — resumo com recorte "Atrasadas" ligado, ritmo de 20px corrigido |
| Calendário | pendente |
| Ajustes | pendente |
| loading/error/not-found por rota | **concluída** para `(crm2)` — `loading.tsx`, `error.tsx` e `not-found.tsx` |
| Cores hardcoded | 946 em 83 arquivos no código alcançável (a contagem anterior de 1.321/128 incluía 28% em arquivos sem importador) |
| Controle segmentado | **concluído** — `ToggleGroup` do shadcn recebe o desenho do DS em folha global; antes a seleção tinha 3% de diferença de luminância |
| `/estudio`, `/onface-desenho` | protótipos ainda no repositório |

**Decisões abertas para o Kauã (além dos bloqueios abaixo):**

4. `/inicio` é a única tela escura do produto inteiro. A spec não prescreve o
   tom ("dark/light behavior conforme sistema definido no projeto") e há
   evidência de preferência do Kauã pelo escuro da Início. Não invertido por
   conta própria.

**Bloqueios registrados:**

1. NEXO (§1.5, §19.16) — não há rota, painel, conversa nem runtime ligado.
2. `DESIGN.md` descreve o sistema Callface legado (verde seaweed, radius
   28–32px). Enquanto não for reescrito para o ONFACE, o detector de design
   mede contra a paleta errada.
3. Financeiro voltou ao menu por força do §1.3; a árvore congelada em 16/09 o
   escondia. Decisão de produto do Kauã se mantém ou não.
