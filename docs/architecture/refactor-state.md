# ONFACE — estado da execução do refactor

> Documento de continuidade. Sempre reflete o estado **atual**, não o histórico.
> O histórico fica em `refactor-execution-log.md`.
> Fonte normativa do TO-BE: `ONFACE-ARCHITECTURE-SPEC.md`.
> Fonte factual do AS-IS: `docs/architecture/database-as-is/`.

## Fase atual

**04 — Migrations de expansão do modelo alvo** (próxima)

Fases 01, 02 e 03 concluídas.

## Último commit

`9c79729` — refactor(02,03): arquitetura fisica do repositorio e fronteiras de pacote

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

## Backfills executados

Nenhum.

## Readers migrados

Nenhum.

## Writers migrados

Nenhum. Inventário de partida em `database-as-is/04-escritores.md`.

## Estruturas legadas ainda em uso (todas, neste ponto)

`leads` (3.989), `negocios` (1.562), `contatos` (1.663), `whatsapp_mensagens` (25.363),
`ligacoes` (4.938), `emails` (4.460), `atividades` (13.044), `cadencia_execucoes` (1.273).

## Testes executados

Após a fase 03: `tsc --noEmit` limpo (0 erros), **111 testes passando**, 0 falhas
(104 herdados + 7 novos de arquitetura).

## Auditoria independente

Codex rodando sobre o checkpoint de banco/modelagem (fase 01):
`task-muao0p8s-9qo76s`. Findings serão verificados um a um, classificados como
válidos ou falso positivo, e registrados aqui antes de qualquer correção.

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
