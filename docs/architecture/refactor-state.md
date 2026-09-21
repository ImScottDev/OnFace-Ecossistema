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
| 17 leitores | telas de vendas no canônico; faltam as rotas de API (`leads.ts` 26 leituras, `relatorios.ts` 15, `negocios.ts` 15) e as libs de analytics e CS |
| 18 motor único | os dois motores usam os mesmos adapters; falta a tag de empresa, que usa outro modelo |
| 19 IA | NEXO e Hermes criados em `draft`; a IA não escreve mais direto no banco. Falta RAG e o runtime passar permissão delegada |
| 22 RBAC | papéis, mapa e vínculos semeados, com paridade provada. Falta as rotas usarem `exigirPermissao` |
| 20 Meta | entrada direta e CAPI **construídos e testados**; falta credencial para enviar de verdade |
| 21, 23, 24 | não iniciadas |
| 25 a 28 | dependem de 17 completa; 28 precisa de aprovação do Kauã |

## Último commit

`f066ea3` — refactor(20): Meta entra direto, e o sinal de qualidade volta pra ela

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

## Credenciais que faltam para rodar, não para construir

| O quê | Para quê | Estado |
|---|---|---|
| `META_APP_SECRET` | validar a assinatura do webhook de Lead Ads | ausente |
| `META_WEBHOOK_VERIFY_TOKEN` | handshake de assinatura do webhook | ausente |
| Token do CAPI + pixel | devolver qualificação, ganho e pagamento para a Meta | ausente |

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
| 12 financeiro | `12-financeiro.ts` | 951 faturas | **536 pagamentos**, soma confere | 2 |
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

Estado atual: `tsc --noEmit` limpo, **build de produção passando**, **196 testes, 0
falhas**, mais cinco smokes contra o banco real:

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
| `ai-platform/agentes.test.ts` | ferramenta de IA escrevendo direto; agente citando ferramenta inexistente |
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
