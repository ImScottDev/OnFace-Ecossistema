# ONFACE — estado da execução do refactor

> Documento de continuidade. Sempre reflete o estado **atual**, não o histórico.
> O histórico fica em `refactor-execution-log.md`.
> Fonte normativa do TO-BE: **o arquivo `ONFACE-ARCHITECTURE-SPEC.md` não existe**
> neste repositório nem no vault (conferido em 21/09). A ordem vigente é a do
> HUB do ONFACE no vault (`02_PROJETOS/Callface/ONFACE/HUB.md`), que define as
> frentes e a dívida arquitetural central.
> Fonte factual do AS-IS: `docs/architecture/database-as-is/`.

## Fase atual

**Refactor arquitetural: fases 01 a 26 concluídas.** 27 e 28 aguardam aprovação
do Kauã (são destrutivas).

**Conclusão do produto (Documento Mestre v0.13): CP1 a CP13 concluídos.** Essa é
a etapa em que o ONFACE parou de ser fundação e virou produto utilizável: as
jornadas operacionais estão fechadas e os números das telas foram acertados
contra o dado real.

A próxima etapa NÃO é mais código: é **QA do Kauã na tela**, e depois a virada
(fases 27 e 28), que é destrutiva e depende de autorização explícita.

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

`d3ca6c2` — CP13, autoverificação: a fila de loops estava sem tela

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

**Achado aberto, não tocado:** Meta Conversions API está configurada e com zero
entregas. Token existe, smoke passa, nenhuma conversão entregue de verdade.
Visível no hub de integrações desde o CP12.

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
