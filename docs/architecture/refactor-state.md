# ONFACE — estado da execução do refactor

> Documento de continuidade. Sempre reflete o estado **atual**, não o histórico.
> O histórico fica em `refactor-execution-log.md`.
> Fonte normativa do TO-BE: `ONFACE-ARCHITECTURE-SPEC.md`.
> Fonte factual do AS-IS: `docs/architecture/database-as-is/`.

## Fase atual

**08 — Catálogo e política de oferta comercial** (próxima)

Fases 01 a 07 concluídas.

## Último commit

`f96c163` — refactor(07): pipeline normalizado e 1.561 oportunidades

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
| 07 oportunidade | `src/scripts/backfill/07-pipeline-oportunidade.ts` | 1.562 negócios | **1.561 oportunidades**, 10 etapas | **1.084** |

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

Nenhum.

## Writers migrados

Nenhum. Inventário de partida em `database-as-is/04-escritores.md`.

## Estruturas legadas ainda em uso (todas, neste ponto)

`leads` (3.989), `negocios` (1.562), `contatos` (1.663), `whatsapp_mensagens` (25.363),
`ligacoes` (4.938), `emails` (4.460), `atividades` (13.044), `cadencia_execucoes` (1.273).

## Testes executados

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
