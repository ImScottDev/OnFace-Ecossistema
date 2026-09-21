# ONFACE — estado da execução do refactor

> Documento de continuidade. Sempre reflete o estado **atual**, não o histórico.
> O histórico fica em `refactor-execution-log.md`.
> Fonte normativa do TO-BE: `ONFACE-ARCHITECTURE-SPEC.md`.
> Fonte factual do AS-IS: `docs/architecture/database-as-is/`.

## Fase atual

**01 — Freeze baseline + backup + reconciliar drift Drizzle ↔ PostgreSQL**

## Último commit

`98940fe` (baseline do refactor)

Branch de trabalho: `refactor/arquitetura-canonica`, criada a partir de `98940fe`.

## Concluído

- [x] 01.1 repositório limpo confirmado
- [x] 01.2 baseline SHA registrado: `98940fe`
- [x] 01.3 backups confirmados
- [x] 01.4 backup fresco pré-refactor: `_prod-snapshot-20260920/pre-refactor-20260920.dump` (17 MB)
- [x] 01.5 branch dedicada criada
- [ ] 01.6 reconciliação de drift Drizzle ↔ banco — EM ANDAMENTO

## Migrations aplicadas neste refactor

Nenhuma.

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

Baseline herdado de `98940fe`: `tsc --noEmit` limpo, 104 + 11 testes passando.

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
