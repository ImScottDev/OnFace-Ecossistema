# Entrega — refactor de arquitetura canônica do ONFACE

> Estado em 21/09/2026. Este documento é o que o prompt de execução pede em
> "Final delivery", e serve para uma decisão: **virar ou não virar**, e com o
> que ainda aberto.
>
> Registro da execução: `docs/decisoes/2026-09-22-refactor-arquitetural.md`.
> Os passos da virada (seção de procedimento) continuam valendo e são conferidos
> por `app/src/lib/arquitetura/virada-cobre-cadeia.test.ts`.

## 1. Branch e commits

`refactor/arquitetura-canonica`, criada de `98940fe`. **128 commits** no refactor,
todos empurrados para `onface/refactor/arquitetura-canonica`.

## 2. Migrations

Trinta, todas EXPAND ou com inverso documentado no próprio arquivo. Nenhuma
apaga coluna ou tabela: a contração é a fase 27 e não foi executada.

| # | O que faz |
|---|---|
| 0056 | `organizacao_id` NOT NULL em 4 tabelas financeiras + 3 FKs que faltavam |
| 0057 | cria `pipeline_etapas`, `aquisicoes`, `ofertas_comerciais`, `pagamentos`, `conversas`, `domain_events`, `timeline_events`, `cs_health_snapshots` |
| 0058 | automação versionada, RBAC normalizado e arquivos |
| 0059 | corrige unicidade de inscrição em automação (bloqueava histórico legítimo) |
| 0060 | `reconciliacao_casos` e `backfill_provenance` |
| 0061 | `cargo` e `updated_at` em vínculo pessoa-empresa |
| 0062 | 10 colunas de atribuição em `pontos_contato` |
| 0063 | as 4 ofertas comerciais do SPEC §12.3 |
| 0064 | vínculo canônico de proposta e contrato |
| 0065 | vínculo de cliente e serviço canônico |
| 0066 | `tipo` e `cycle_number` em `fulfillments` (onboarding E implantação) |
| 0067 | `communications` e `conversas` canônicas |
| 0068 | remove a exclusividade que anulava a 0066 |
| 0069 | `aquisicoes.lead_legado_id` |
| 0070 | papéis, mapa papel→permissão e vínculos de usuário |
| 0071 | NEXO e Hermes, em `draft` |
| 0072 | tokens da API pública e registro de uso |
| 0073 | `oportunidades` ganha os campos que o SPEC 11.1 define |
| 0074 | `pipeline_etapas` semeada com as etapas que o produto DE FATO usa |
| 0075 | busca na base de conhecimento pelo BANCO, não pela aplicação (SPEC 19) |
| 0076 | `meta_capi_entregas` — auditoria da entrega de conversões à Meta (SPEC 20) |
| 0077 | teto de permissão das versões do NEXO e do Hermes (SPEC 31) |
| 0078 | anexos no acervo canônico de arquivos |
| 0079 | `source_process` deixa de guardar marcador de backfill |
| 0080 | identidade recupera o WhatsApp do lead |
| 0081 | pipeline de AQUISIÇÃO com 7 etapas; `aquisicoes.etapa_id` materializado |
| 0082 | no-show vira estado de `reunioes` (34 de 38; 4 como reconciliação) |
| 0083 | `ofertas_comerciais.permite_trial` |
| 0084 | estagnação em `oportunidades` |
| 0085 | período de trial em `oportunidades` |
| 0086 | fundação read-only da integração Callface AI (estado de sync e janela de snapshot) |
| 0087 | `metric_catalog` — a definição de cada métrica, materializada |
| 0088 | `cs_health_snapshots` — health diário por conta |
| 0089 | `calendar_provider` em `reunioes` — Microsoft e Google atrás da mesma porta |
| 0090 | índice único de `meta_lead_staging.fb_lead_id` — reentrega da Meta não duplica (removeu 18 linhas) |
| 0091 | envio de campanhas — `agendada_para`/`iniciada_em`/`concluida_em` e `outreach_campanha_destinatarios` (status por destinatário) |
| 0092 | construtor de Automações — rascunho, pasta, webhook e agenda em `automacoes`; cursor e carimbo de origem na execução |
| 0093 | `contrato_templates.tipo_documento` — contrato, aditivo e renovação deixam de colidir na mesma família |
| 0094 | `mrr_movimentos.negocio_id` e `detectado_fora_do_crm` — expansão feita no Stripe deixa de sumir da atribuição comercial |
| 0095 | `propostas.trial_dias` — o período de teste que a tela coletava passa a existir no banco e a chegar ao Stripe |
| 0096 | `visoes_salvas` — as visões de filtro da lista de Contatos passam a gravar por usuário e tela (tabela nova, aditiva e idempotente) |
| 0097 | `usuarios.tipo`/`agente_id`, `regras_distribuicao_leads` e `delegacoes_agente` — agentes de IA viram usuários, regra de distribuição de novos leads e delegação de follow-up (aditiva e idempotente) |
| 0098 | `contrato_templates.tipo_documento` aceita DOWNGRADE — o termo aditivo de downgrade PABX tem texto próprio (só amplia o CHECK; aditiva e idempotente) |
| 0099 | campos do editor de propostas — persistência do conteúdo editável |
| 0100 | índice único de confirmação NEXO — impede dupla execução da mesma ação aprovada |
| 0101 | IA opt-in por conversa (`ia_ligada_por/em`) — nenhum agente responde WhatsApp até uma pessoa ligar na conversa |
| 0102 | número de WhatsApp como entidade — `finalidade` em `whatsapp_sessao` e `whatsapp_sessao_acesso` (quem, além do dono, usa um número compartilhado; aditiva e idempotente) |
| 0103 | agentes de IA 2.0: `ai_agent_atribuicoes` (uma atribuição viva por contato), `ai_agent_compromissos` (retomadas que o próprio agente agenda), `ai_memoria_fatos`, `roteamento_comercial_regras` e governança de `ai_knowledge_sources` (aprovado, rascunho, histórico); aditiva e idempotente, não toca dado existente |
| 0104 | contato avulso ganha o registro que a ficha base exige (lead `tipo = 'contato'`, sem aquisição, sem estágio) — backfill idempotente das pessoas sem lead; a rota `/contatos/pessoas/:id` deixa de escrever no GET |
| 0105 | Callface AI: vínculo com evidência e estado (`evidencia`, `estado`, `org_nome`), pendências com razão (chave única empresa+organização), `callface_ai_tenant_detalhe` e `callface_ai_uso_diario` — aditiva e idempotente |
| 0106 | catálogo: desativa os 15 produtos de test mode (`prod_VM7m…`) e seus Prices no espelho, e reaponta os 3 itens de proposta BINA ao Price real de mesmo valor — idempotente, sem apagar |
| 0107 | proposta: numeração atômica por organização (contador) e unicidade (organizacao_id, numero) — idempotente |
| 0108 | aquisição convertida em oportunidade (handoff) passa a ter `closed_at` e etapa `oportunidade`: sai de Relações em andamento; backup em `_relacoes_conversao_20261013` — idempotente |
| 0109 | catálogo: coluna `servicos_catalogo.descricao_comercial` (texto de venda do ONFACE, ganha da description do Stripe; a sincronização não a toca) e os textos dos 15 produtos vendáveis, só onde ainda está vazia — idempotente |
| 0110 | calendário: `reunioes.calendar_conta_id` (conta que criou o evento), `reunioes.participantes_respostas` (aceite por convidado) e `calendario_assinaturas` (assinatura Graph + cursor de delta por conta) — aditiva e idempotente |
| 0111 | atividade: `tarefa_subtarefas` (checklist com responsável, prazo e ordem) e `tarefa_comentarios` (com `mencoes`); `file_links` aceita as entidades `tarefa` e `tarefa_comentario` (CHECK recriado com a lista anterior + as duas) — aditiva e idempotente |
| 0113 | e-mail: índice único parcial `uq_email_contas_caixa` em `email_contas (organizacao_id, usuario_id, tipo, lower(email))` para contas não mescladas (uma caixa, uma conta; o callback OAuth passou a fazer UPSERT). Tolerante: se ainda houver caixa duplicada, avisa e não cria; `consolidar-email-contas.ts --aplicar` (backup em `_consolidacao_email_contas_20261013`) funde as duplicatas e cria o índice — idempotente |
| 0114 | calendário: `reunioes.calendar_remocao_pendente` — o evento que ficou no calendário antigo quando o responsável da reunião muda (criado o novo, falta retirar o velho); o worker repete o cancelamento até dar certo — aditiva e idempotente |

## 3. AS-IS → TO-BE

| Antes | Agora | O que mudou de fato |
|---|---|---|
| `leads` fazia sete papéis | `pessoas` + `empresas` + `aquisicoes` | 3.950 pessoas, 3.989 aquisições |
| `negocios` como oportunidade | `oportunidades` | 1.561, paridade exata; a diferença de 1 é caso registrado |
| Ganho decidido por família | Ganho decidido pela **oferta** | mesma prova, decisões opostas para PABX e AI direto |
| Conversa em 3 tabelas | `communications` | 33.005 linhas, uma fonte |
| Sem timeline | `timeline_events` + `domain_events` + outbox | 14.078 eventos, lidos pela tela |
| Fatura sem pagamento | `pagamentos` | 579, R$ 211.045,66 conciliados |
| Autorização por string de papel | RBAC normalizado | 16 permissões, paridade provada usuário por usuário |
| Dois motores de automação | um, com adapters compartilhados | regra de automação não fecha venda por fora |
| IA escrevendo no banco | IA pelos adapters de domínio | o gate do Ganho vale para ela também |
| Arquivo no disco da máquina | serviço com object storage | produção sem storage falha, não cai no disco |
| Sem API pública | `/api/v1` com 9 recursos | token com escopo, uso registrado |
| Etapa de pré-vendas deduzida de fatos | `pipeline_etapas` + `aquisicoes.etapa_id` | mover o card move o card: 2.919 novo, 531 em contato, 539 oportunidade |
| Próxima ação em coluna do negócio | `tarefas` (SPEC §23) | a coluna estava vazia em 1.562 de 1.562 |
| No-show em coluna do negócio | `reunioes.status` | a reunião a que o cliente faltou parava de ficar "agendada" para sempre |
| Trial como botão livre | capacidade da oferta | PABX e White Label deixam de poder entrar em trial |
| Atribuição em `leads` | `pontos_contato` (SPEC §8.3) | paridade exata medida campo a campo antes de trocar |
| Cliente como marca gravada | derivado de contrato ativo | o filtro "Clientes" foi de 287 para 411 |
| Catálogo copiado de planilha | sincronizado com o Stripe | 15 produtos, 55 preços, idempotente |

## 4. Reconciliação

**1.529 casos abertos**, recontados em 21/09/2026 no banco reconstruído do dump
fresco — que é a contagem que produção terá. Cada um é uma linha que o dado não
permitiu decidir, e nenhum foi resolvido por palpite.

| Tipo | Quantidade | O que é |
|---|---|---|
| `FAMILIA_NAO_RESOLVIDA` | 1.085 | oportunidade sem família de produto dedutível |
| `CONTRATO_SEM_PROCESSO_COMERCIAL` | 406 | contrato sem negócio nem oportunidade; **271 ativos** |
| `FATURA_PAGA_SEM_EMPRESA` | 28 | fatura paga sem empresa alcançável |
| `IDENTIDADE_MULTIPLA_EMPRESA` | 8 | pessoa ligada a mais de uma empresa, nenhuma principal |
| `FATURA_PAGA_SEM_DATA` | 1 | pagamento sem data: sem fato datado, não entra em competência |
| `OPORTUNIDADE_SEM_IDENTIDADE` | 1 | negócio sem pessoa nem empresa alcançável |

Abertos nas fases 25 e 26, nomeados no `docs/decisoes/2026-09-22-refactor-arquitetural.md`: **455 propostas
ligadas só a um lead (81 aceitas)**, **111 leads marcados `cliente` sem contrato
ativo**, **4 no-shows históricos sem reunião inequívoca** e **16 trials sem
família comercial**.

## 5. Caminhos legados ainda em uso

Nenhum foi removido: a contração é a fase 27.

- `leads` e `negocios` continuam recebendo escrita, com propagação para o
  canônico;
- `vendas_eventos` continua no UNION da timeline;
- `lib/crm/pos-venda.ts` continua sendo chamado por `negocios.ts`;
- **detalhe e edição migraram** nas fases 25 e 26. O que continua vindo do
  legado é texto livre sem semântica de domínio (observação de nutrição, detalhe
  de desqualificação, etapa de origem, qualificação em JSON, interesse
  declarado) e contadores de não lidas, que são estado de interface;
- as colunas legadas de próxima ação, no-show, trial e estagnação continuam
  sendo escritas como **ponte**, e são lidas apenas como fallback. Removê-las é
  a fase 27.

## 6. Provenance preservada

`backfill_provenance` liga cada linha canônica à linha de origem, e um teste
exige que **toda pessoa tenha provenance** — "apareceram do nada e ninguém sabe
de onde" é uma falha de verdade, e pegou uma pessoa órfã deixada por um smoke.

Preservadas: `anexos`, `status_changes`, `vendas_eventos`, `cadencia_execucoes`,
`meta_lead_staging`.

## 7. Testes, build e validação

- `tsc --noEmit` limpo;
- **build de produção passando** (estava quebrado por quatro causas anteriores);
- **bundle do worker** (esbuild) passando;
- **276 testes, 0 falhas**;
- **25 smokes** contra o banco real com dado de produção, todos verdes e sem
  deixar resíduo;
- **aceite do Módulo 01: 97 passaram, 0 falharam, 0 não verificados** — os três
  que faltavam dependiam do catálogo oficial, resolvido pela sincronização com o
  Stripe;
- **validação de paridade: 13 dos 14 cenários passam, 0 falham, 1 não
  verificável** — o restante é o NEXO, bloqueado por credencial de provedor de
  modelo.

### Travas permanentes

Cada uma foi verificada **falhando de propósito** antes de entrar.

| Teste | Impede |
|---|---|
| `db/drift-schema.test.ts` | coluna no banco e não no Drizzle, ou o contrário |
| `db/on-conflict.test.ts` | ON CONFLICT apontando para índice inexistente |
| `db/sql-template.test.ts` | crase em comentário de SQL |
| `db/array-postgres.test.ts` | array do Postgres projetado cru |
| `db/reconciliacao-backfill.test.ts` | linha canônica sem origem rastreável |
| `arquitetura/fronteiras.test.ts` | domínio importando ORM, SDK ou framework |
| `arquitetura/escritores-migrados.test.ts` | porta de escrita sem ligação canônica |
| `vendas/leitura-canonica.test.ts` | registro sumindo da leitura |
| `relatorios/cobertura.test.ts` | relatório perdendo receita no caminho |
| `auth/permissoes.test.ts` | cutover de autorização mudando acesso |
| `v1/api-publica.test.ts` | rota pública sem escopo; token em claro |
| `ai-platform/agentes.test.ts` | ferramenta de IA escrevendo direto |
| `api-server/webhooks-fail-closed.test.ts` | webhook sem segredo configurado |
| `api-server/rotas-configuracao-protegidas.test.ts` | rota de configuração aberta; rota de escrita sem sessão e sem declaração de qual é o gate dela |
| `arquitetura/gravacao-de-arquivo.test.ts` | rota gravando binário no disco; object storage virando dependência de deploy |
| `auth/teto-de-token.test.ts` | token de API nascendo com escopo acima de quem o cria |
| `vendas/politica-oferta.test.ts` | trial iniciado sem capacidade da oferta |
| `scripts/smoke-tela-escreve-tela-le.ts` | tela que escreve e não mostra o que escreveu (30 verificações) |
| `scripts/smoke-meta-lead-ads.ts` | entrada direta de Lead Ads, contra a Graph API real (14 verificações) |

## 8. Procedimento de virada

**Nada disto foi executado. A virada é decisão do Kauã.**

> Esta seção e o `docs/operacao/virada/PLANO-DE-CARGA.md` diziam coisas diferentes, e a
> diferença não era estilo. Aqui dizia "aplicar as migrations 0056 a 0085 em
> produção". Produção **não tem** `oportunidades`, `aquisicoes`,
> `proposta_grupo_comercial`, `roles`, `api_tokens` nem `_migracoes_aplicadas`:
> ela é um banco anterior ao refactor, e a cadeia não começa em 0056.
>
> A receita abaixo é a única, e foi **executada ponta a ponta em 21/09/2026**
> contra um dump fresco de produção, chegando ao mesmo estado do banco de dev.
> `./scripts/ensaio-carga.sh` faz os passos 3 a 6 e `./scripts/rodar-backfills.sh`
> faz o 7.

1. **Backup.** `pg_dump` de produção, verificado com `pg_restore --list`.
2. **Conferir que produção aceita as migrations, ANTES de migrar:**

   ```bash
   DATABASE_URL="postgres://...prod..." pnpm --filter app check:pre-deploy
   ```

   Somente leitura, roda com a aplicação no ar. A 0056 aperta `organizacao_id`
   para NOT NULL em quatro tabelas financeiras e cria três chaves estrangeiras:
   uma linha nula ou uma referência órfã derruba o deploy no meio.

3. **Carga, fase 1** — `app/src/lib/db/carga/1-antes-da-cadeia/*.sql`. Reconcilia
   o que produção tem fora do padrão antes de qualquer migration.

4. **Baseline da 0000 e cadeia até 0012.** A 0000 é a única migration não
   idempotente e já está aplicada em qualquer banco vindo de produção: marcá-la
   como baseline evita reexecutá-la. A cadeia **para em 0012**.

5. **Carga, fase 2** — `app/src/lib/db/carga/2-depois-de-0012/*.sql`. O drift de
   dev não versionado entra aqui, antes de 0033/0039, que leem colunas que
   nenhuma migration cria.

6. **Resto da cadeia, de 0013 até o FIM.** Sem teto: `migrar.ts` sem `--ate`
   aplica tudo que estiver em `migrations/`, em ordem de nome, e é assim que
   `ensaio-carga.sh` roda. Este passo dizia "0013 a 0086" até 22/09, quando a
   cadeia já ia até 0090 — seguido ao pé da letra, deixaria de fora
   `metric_catalog`, `cs_health_snapshots`, o `calendar_provider` e o índice de
   idempotência do staging da Meta. Número fixo aqui envelhece a cada
   migration nova; o script nunca teve esse teto.

7. **Backfills, na ordem, com `./scripts/rodar-backfills.sh`:** 05 identidade,
   06 aquisição, 07 pipeline, 08 oferta, 09 proposta/contrato, 10 cliente/serviço,
   12 financeiro, 13 comunicações, 14-15 eventos/timeline, **16 materialização
   canônica**. Todos idempotentes por `backfill_provenance`.

   > **O passo 16 existe por causa de um erro de ordem que o ensaio expôs.**
   > As migrations 0069, 0081, 0084 e 0085 carregam um UPDATE de materialização
   > junto da mudança de schema. No banco de dev funcionou, porque lá o canônico
   > já estava populado. Numa produção virgem elas rodam com `aquisicoes` e
   > `oportunidades` VAZIAS e tocam zero linhas. Medido antes da correção:
   > 3.991 aquisições sem vínculo com o lead, 3.991 sem etapa, 0 estagnações
   > canônicas contra 229 no legado e 0 trials contra 17. O passo 16 roda depois
   > dos backfills e é independente da ordem de construção do banco.

8. **Sincronizar o catálogo com o Stripe** (`pnpm --filter app catalogo:sync`).
   Sem isso o construtor de proposta abre vazio e o aceite fica em 72/0/3 não
   verificados em vez de 97/0.

9. **Rodar a validação de paridade, TODOS os aceites e os smokes contra o
   banco carregado.** 0 falhas para seguir.

   ```bash
   ./scripts/rodar-aceites.sh      # 4 aceites (208 asserções) + 2 validadores
   ./scripts/rodar-smokes.sh       # 32 smokes + 3 checagens de tela
   ```

   > **Os smokes tinham o mesmo buraco, e era o maior dos três:** 32 scripts,
   > **nenhum chamador** — zero referências em `package.json`, em script ou em
   > CI. O passo pedia "os smokes" e o único caminho era rodar um a um, à mão.
   >
   > As três `checar-onface-*` entram no mesmo runner. Elas rodam as consultas de
   > uma tela e conferem que ela **não fica em branco com o banco cheio** — e as
   > três também terminavam em `process.exit(0)` incondicional: imprimiam os
   > números, listavam os blocos vazios que elas mesmas calculavam, e diziam OK.
   > Relatório, não verificador. O cabeçalho de uma delas descreve o defeito que
   > ela não pegava: *"foi assim que a home anterior mostrou 0 clientes ativos
   > com 244 clientes cadastrados"*.

   > Este script existe porque o passo dizia "o aceite de vendas" e **nenhuma
   > bateria rodava aceite nenhum** — só a mão. Em 22/09 o
   > `aceite-contrato-assinado` estava quebrado havia tempo indeterminado
   > (criava o negócio sem família comercial, e a regra que exige família antes
   > da proposta entrou depois dele). Ninguém viu, porque ninguém rodava. Com a
   > virada dependendo deste passo, um aceite quebrado só apareceria no domingo.
   >
   > **Os dois validadores tinham o mesmo buraco.** O passo pede "a validação de
   > paridade", e nem `validacao-paridade` nem `validar-catalogo-oficial` eram
   > chamados por nada. Rodados à mão em 22/09: a paridade passa (13/14, o não
   > verificável é o NEXO por falta de credencial de modelo) e o de catálogo
   > **morria com TypeError** — indexava `[0]` de uma consulta vazia e nunca
   > chegava às seções 3, 4 e 5. Consertado, ele agora acusa o gap real do
   > catálogo (abaixo) em vez de quebrar.

   **BLOQUEIO CONHECIDO neste passo: o catálogo PABX está incompleto.** O
   validador falha em 2 de 22 verificações, e as duas são o mesmo dado faltando:

   | | snapshot `catalogo-oficial.json` | banco (carga de 21/09) |
   |---|---|---|
   | produtos | 21 | 15 |
   | preços | 213 | 55 |
   | categorias PABX | 9 | 5 |
   | preços PABX | 194 | 30 |

   Faltam 6 produtos PABX inteiros — **PABX - Plano** (18 preços),
   **PABX - Setup / Implantação** (21), **Integração / Módulo** (25),
   **Serviço Avulso** (23), **Linha SIP** (5) e **Linha 0800** (4) — mais
   *Callface AI Pro* e *Business*. São dois caminhos de carga divergentes: o
   snapshot veio da planilha (16/09) e o banco veio do
   `sincronizar-stripe.ts` lendo o Stripe real (21/09). 41 preços estão nos
   dois, 14 só no banco, 172 só no snapshot.

   Sem o plano e o setup de PABX **o vendedor não consegue montar uma venda de
   PABX no sistema novo**. Escolher entre as duas cargas é decisão comercial
   (mexe em preço de venda) e depende do Kauã: ou o Stripe recebe os produtos
   que faltam, ou a planilha é o catálogo e `importar-catalogo-oficial.ts` roda
   antes da virada.

10. **Subir o código novo e provar no navegador.**

    ```bash
    npm run dev                                  # na pasta app
    npx tsx src/api-server/index.ts              # o Hono, na 3011
    npx tsx --env-file=.env src/scripts/checar-rotas-onface.ts
    ```

    > **Este passo era uma frase.** Sem roteiro, "provar" virava abrir a home,
    > ver que carregou e seguir — e foi assim que a Visão Geral passou semanas
    > pintando de verde uma queda de 78%, com um gráfico feito de imagens e
    > quatro elogios escritos na marcação (CP35 a CP37).
    >
    > `checar-rotas-onface` é a **metade automatizável** da prova: as 14 rotas do
    > ONFACE respondem 200, renderizam a marcação que as identifica e não estão
    > em branco. Ele não substitui o olho — cor, alinhamento e leitura continuam
    > sendo do navegador. Serve para o passo começar de um estado conhecido.
    >
    > **Os dois processos são obrigatórios.** Em desenvolvimento o rewrite de
    > `/api/*` só existe com `NODE_ENV=development`; sem o Hono na 3011, 140
    > telas respondem 200 com o corpo vazio de dado — o modo mais convincente de
    > uma tela mentir. O script confere os dois antes de começar.
    >
    > O que olhar depois, no navegador, e que o script não cobre: os selos de
    > variação têm a cor do sinal; o gráfico de evolução acompanha os meses
    > reais; nenhum card afirma saúde sem número ao lado.

11. **Observar por um ciclo comercial** antes das fases 27 e 28.

### O ensaio de 21/09/2026, com dump fresco

Dump de produção das 12:31, restaurado num banco rascunho, receita inteira
aplicada. O resultado é o critério de aceite da virada:

| Verificação | Resultado |
|---|---|
| Checks de sanidade da carga | 5 de 5, schema idêntico ao de dev, zero FK órfã |
| Perda de linha | nenhuma (só a de `lead_labels`, declarada) |
| Backfills 05 a 16 | todos, com reconciliação fechada |
| Vínculo lead↔aquisição | 3.991 de 3.991 |
| Etapa canônica | 3.991 (2.919 novo, 539 oportunidade, 533 em contato) |
| Estagnações / trials | 229 e 17, iguais ao legado |
| Comunicações de WhatsApp | 25.696 de 25.696 |
| Smokes | **25 de 25** |
| Aceite do Módulo 01 | **97 passaram, 0 falharam** |
| Paridade | **13 passam, 0 falham, 1 não verificável** (NEXO) |

As contagens do banco reconstruído ficam ligeiramente acima das do banco de dev
(leads 3.991 contra 3.989, negócios 1.563 contra 1.562) porque o dump é de hoje
e o de dev é de 20/09. É produção andando, não diferença de receita.

## 9. Rollback

- **Antes do passo 5:** as migrations são EXPAND e o código antigo ignora as
  tabelas novas. Rollback é não subir o código.
- **Depois do passo 5:** voltar o código para o commit anterior. O dado canônico
  fica no banco sem uso, o que é inofensivo: nenhuma migration apagou coluna ou
  tabela legada.
- **Rollback de dado:** cada migration tem o inverso documentado no arquivo, e o
  dump de 20/09 é o ponto de retorno completo.
- **O que NÃO tem rollback simples:** as fases 27 e 28, que desligam a escrita
  legada, removem os fallbacks e apagam estrutura. É por isso que não foram
  executadas. As fases 25 e 26 são reversíveis: cada migration tem o inverso, e
  toda coluna legada continua sendo escrita.

## 10. Aberto, e por quê

| O quê | Por quê |
|---|---|
| 1.084 oportunidades sem família | o dado não permite deduzir; preencher por palpite arma a regra de Ganho errada |
| 271 contratos ativos sem processo comercial | ligar por proximidade seria inventar de qual venda vieram |
| 28 faturas pagas sem empresa | receita reconhecida na fatura, invisível por cliente |
| 118 faturas pagas sem data | sem data não há fato datado; inventar corrompe receita por competência |
| Quem aprova desconto | alçada não existe hoje; ficou só com admin, que é o padrão restritivo |
| Credenciais de object storage | código pronto, falha dizendo que é configuração ausente. **Meta saiu desta lista em 21/09**: o System User token chegou, foi validado e a cadeia inteira foi provada com `leadgen_id` real |
| Credencial de provedor de IA | último bloqueio de paridade: o NEXO é o único cenário não verificável dos 14 |
| Dono das 275 contas de CS | a capacidade está **provada** em `smoke-cs-responsavel`; distribuir a carteira é decisão de operação |
| Catálogo oficial | **resolvido em 21/09**: o CRM passou a sincronizar com o Stripe em vez de copiar planilha. 15 produtos, 55 preços, idempotente por id do Stripe. Sobram **4 preços sem apelido** que precisam de decisão comercial — dois avulsos Starter de R$ 89,90 e dois Pacote 500 Minutos (R$ 105,00 e R$ 99,90); sem nome, cada par aparece na tela com o mesmo rótulo e preços diferentes |
| 455 propostas ligadas só a um lead | **81 aceitas**. Atribuí-las a uma oportunidade específica seria inventar de qual venda vieram |
| 111 leads marcados `cliente` sem contrato ativo | a marca pode estar certa por um fato que o contrato não registra; o filtro passou a derivar em UNIÃO com a marca, então ninguém some da tela |
| Dois pools de conexão no worker | **Risco menor do que estava escrito aqui.** Medido em 21/09 com app e api no ar: **3 conexões em uso** de um limite de 100. `postgres.js` abre sob demanda, e 15 e 5 são TETOS, não consumo. Continua valendo que dois pools no mesmo processo é um a mais do que precisa, e uma trava passou a impedir que um terceiro nasça sem registro. Quem for consolidar tem o caminho fácil: o worker não usa `db.query.<tabela>` em lugar nenhum, então é troca de import e não reescrita |

## 11. Documentação

`docs/decisoes/2026-09-22-refactor-arquitetural.md` registra a execução do
refactor até 22/09, com os números medidos e os erros cometidos. A estrutura
vigente está no README da raiz.
| 0115 | proposta: `proposta_grupo_comercial.caminho_fechamento` — o caminho de fechamento (contrato ou pagamento) decidido item a item quando a proposta é aceita; grupo antigo (NULL) segue a regra anterior — aditiva e idempotente |
| 0112 | Stripe: o inbox de webhooks fala um vocabulário só — derruba o CHECK de status, normaliza `stripe_webhook_events.status` para minúsculo (produção gravou MAIÚSCULAS) e muda o DEFAULT para `'pending'` — aditiva e idempotente |
| 0117 | Stripe financeiro: índice único `uq_vendas_eventos_stripe_chave` (idempotência da timeline financeira por fato) e backfill de `faturas.receivable_state` (`open`/`paid`/`overdue`/`uncollectible`/`void`) nas faturas do Stripe — aditiva e idempotente |
| 0116 | Callface AI: `callface_ai_saude_diaria` — uma linha por cliente por dia com a última atividade real SEM janela (chamada, copiloto, reunião), os sete sinais de saúde e o semáforo; base da tarefa de CS por silêncio, queda, licença ociosa, teto, vencimento e cancelamento — tabela nova, aditiva e idempotente |
| 0118 | NEXO: `nexo_memoria` — memória do usuário dentro da organização (um fato por registro: título, resumo curto para decidir a relevância, corpo, ligações entre registros), com busca em português pela mesma normalização do conhecimento. Substitui nada; `ai_memory_entries` segue como política da organização — tabela nova, aditiva e idempotente |
| 0119 | Stripe: `fora_do_espelho_em`/`fora_do_espelho_motivo` em `assinaturas` e `faturas` — marca os objetos do SaaS Callface que o sync espelhou por engano (conta Stripe compartilhada); `NULL` = é do CRM. Preenchida só pelo script `marcar-saas-fora-do-espelho.ts` — colunas novas, aditiva e idempotente |
| 0120 | Proposta e aceite: `propostas` ganha `dia_vencimento_mes`, `reajuste_indice`, `inicio_vigencia_tipo`, `data_inicio_vigencia`, `fidelidade_meses`, `desconto_temporario_alvo`/`_meses` (condições do editor que só viviam no jsonb); `proposta_grupo_comercial` ganha `fechamento_erro`/`fechamento_tentativas`/`fechamento_ultima_tentativa_em` (retomada do aceite); `emails` ganha `entrega_estado`/`entrega_detalhe`/`entrega_verificada_em`/`origem_tipo`/`origem_id` (entrega real do provedor) — colunas novas, aditiva e idempotente |
| 0121 | Catálogo: `proposta_itens` ganha `exige_contrato` e `periodo` (copiados do price na criação da linha; o aceite lê daqui, NULL = linha antiga cai no catálogo); `catalogo_precos` ganha `intervalo_contagem` (trimestral/semestral deixam de virar mensal) e `faixa_min`/`faixa_max` (faixa de licenças do White Label, da metadata do price) — colunas novas, aditiva e idempotente |
| 0122 | Callface AI, White Label: espelho de `partners`, licenças `PARTNER_WHITE_LABEL`, `partner_invoices` + itens (com proporcionalidade) e `callface_ai_parceiro_pendencias` (a conferência contra o CRM); `callface_ai_tenant_snapshots` e `callface_ai_uso_diario` ganham `minutos_duracao` e `chamadas_sem_tarifa` (minuto passa a ser o tarifado, `calls.billed_time`) — tabelas e colunas novas, aditiva e idempotente |
| 0123 | Callface AI, retrato do cliente na plataforma: `callface_ai_planos` (plano e preço de tabela), `callface_ai_org_stripe` (Stripe conectado por organização), `callface_ai_licencas` (motivo TRIAL/SUBSCRIPTION_PAID/INTERNAL/PARTNER_WHITE_LABEL + expiração, crus), `callface_ai_usuarios` (papel, aceite, convite, desativação e `crm_user_id`, sem nome nem e-mail), `callface_ai_equipes` (workspaces e equipes) e `callface_ai_receptivos` (DIDs com destino e disponibilidade) — tabelas novas, aditiva e idempotente |
| 0124 | Serviço canônico: `servicos_canonicos.quantidade` (numeric 14,3, default 1) — a quantidade vendida da linha, informativa (o valor segue sendo o total da linha; sem componentes, para o MRR não somar em dobro) — coluna nova, aditiva e idempotente |
| 0125 | Entrega: uma por VENDA, não por item — `fulfillments` ganha `oportunidade_id`, `fulfillment_anterior_id` (upgrade: não repete etapa já cumprida do mesmo produto) e `etapas_herdadas`; `fulfillment_servicos` liga a entrega a todos os serviços canônicos que ela cobre (`servico_canonico_id` segue sendo o principal). Nada existente é alterado ou apagado — colunas e tabela novas, aditiva e idempotente |
| 0126 | WhatsApp: conversa é dado pessoal — `whatsapp_sessao.privado` (número pessoal/privado; backfill: número PESSOAL de dono com papel de gestão nasce privado), `whatsapp_supervisao` (supervisão EXPLÍCITA: quem vê os números não privados de quem; nasce vazia — o cargo não concede), índice parcial `idx_wa_msg_media_url` (a mídia segue a conversa) e, por compatibilidade, linhas em `whatsapp_sessao_acesso` (`concedido_por` NULL) para admin/director/operations nos números SEM dono humano (compartilhados e de agente de IA), que eles já acompanhavam; número de pessoa não é tocado — colunas e tabela novas, aditiva e idempotente |
