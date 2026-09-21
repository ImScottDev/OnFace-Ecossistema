# ONFACE — estado da execução do refactor

> Documento de continuidade. Sempre reflete o estado **atual**, não o histórico.
> O histórico fica em `refactor-execution-log.md`.
> Fonte normativa do TO-BE: `ONFACE-ARCHITECTURE-SPEC.md`.
> Fonte factual do AS-IS: `docs/architecture/database-as-is/`.

## Fase atual

**17 a 22** (em andamento)

Fases 01 a 16 concluídas.

| Fase | Estado |
|---|---|
| 17 leitores | telas de vendas no canônico **com a propagação fechada**; leituras que descartavam dinheiro corrigidas. Falta a leitura de detalhe/edição, que migra junto com a escrita na fase 25 |
| 18 motor único | **concluída** — os dois motores não têm mais nenhuma implementação própria de ação |
| 19 IA | NEXO e Hermes em `draft`, a IA não escreve direto no banco, busca de conhecimento no banco com índice, e **permissão delegada com teto por interseção**. Publicar os agentes é decisão de quem opera |
| 22 RBAC | papéis, mapa, vínculos e **paridade provada**. Rotas financeiras, de automação, de agente, de plataforma de IA e de token já exigem permissão. Das 165 restantes, **154 são operação** (a autenticação é o gate) e **11 são públicas por desenho, agora nomeadas uma a uma com o gate de cada** |
| 20 Meta | **CAPI validada contra a Meta real** (8 eventos aceitos em Test Events). Inbound implementado e testável; ativação real bloqueada só pela permissão da Página |
| 21 storage | **pontos de upload migrados** (anexo, avatar, formulário público): checksum, deduplicação, organização na chave, entrega independente de provedor. O adapter S3/R2 espera credencial, e só isso. A justificativa anterior para adiar ("só troca um disco local por outro") estava errada: o que mudou não foi o disco, foi metadado, dedup, isolamento e endereçamento |
| 23 API pública | **concluída** — `/api/v1` com 9 recursos, token com escopo e uso registrado; criar, listar e revogar por rota e por tela (`/ajustes/api-tokens`), com teto de escopo testado e gerador de credencial corrigido |
| 24 paridade | **13 dos 14 cenários passam, 0 falham**. O único não verificável é o NEXO, por falta de credencial de provedor de modelo |
| 25 a 28 | dependem de 17 completa; 28 precisa de aprovação do Kauã |

## Último commit

`ebae527` — feat(23): o catálogo sincroniza com o Stripe em vez de copiar planilha

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
por um, se dá para virar. **12 passam, 0 falham, 2 não verificáveis.**

Os dois não verificáveis estão nomeados, e "não verificável" **não é OK**:

| # | Cenário | O que falta |
|---|---|---|
| 8 | Carteira de CS tem dono | a capacidade existe na rota; nenhum dos 275 clientes tem responsável. Atribuir é decisão de operação |
| 12 | NEXO consulta e age | os dois agentes existem em `draft` com teto de permissão, e o gate está provado em smoke. Falta **credencial de provedor de modelo** para rodar de verdade: zero ativas |

O cenário 13 saiu de "não verificável" quando as credenciais chegaram: a cadeia
fato → outbox → worker → Meta está provada ponta a ponta, com dois fatos idênticos
dos quais só o que veio da Meta é devolvido.

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

### Por que a leitura de detalhe/edição não migrou

Ler o canônico e escrever no legado cria janela de inconsistência visível numa tela
de edição: o usuário salva e não vê a mudança. Para board e relatório, que são
agregados e tolerantes, a propagação resolve. Para detalhe e edição, a leitura migra
**junto com a escrita**, na fase 25. Não é escopo reduzido: é a ordem que não quebra
a tela no meio do caminho.

### Ainda no legado, e dito no código

Cabeçalho do lead (nutrição, desqualificação, interesse declarado), condução da venda
(próxima ação, no-show, trial, estagnação) e contagem de propostas. Não têm dono no
modelo canônico até a fase 26.

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
| `api-server/routes/{email,whatsapp,contratos,cadencia}.ts` | pendente (atualizam, não criam) | — |
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

Estado atual: `tsc --noEmit` limpo, **build de produção passando**, **275 testes, 0
falhas**, e **24 de 24 smokes** verdes, mais o aceite de vendas em **97 passaram, 0 falharam** contra o banco real (conferidos por código de
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

## Bloqueios reais

Nenhum.

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
