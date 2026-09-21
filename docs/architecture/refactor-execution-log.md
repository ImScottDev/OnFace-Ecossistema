# ONFACE — log de execução do refactor

Histórico append-only. O estado atual vive em `refactor-state.md`.

---

## 2026-09-21 — Fase 01 · Freeze, backup e baseline

**Mudanças:** nenhuma no código ou no banco.

**Ações:**
- repositório confirmado limpo (0 pendências) no commit `98940fe`;
- backup fresco do banco antes de qualquer migration:
  `_prod-snapshot-20260920/pre-refactor-20260920.dump`, 17 MB, `pg_dump -Fc -Z6`;
- backups anteriores preservados: dump de produção de 20/09 (17 MB) e backup do dev
  pré-carga (15 MB);
- branch `refactor/arquitetura-canonica` criada a partir de `98940fe`.

**Migrations:** nenhuma.

**Reconciliação:** nenhuma ainda.

**Testes:** baseline herdado, `tsc` limpo e 115 testes passando.

**Dados não resolvidos:** nenhum novo.

**Auditoria de inconsistência (a pedido do Kauã):** verificado que a correção de
`billing_customer_aliases` está aplicada no commit `98940fe` e é herdada por esta
branch; o diff da branch é zero porque nada novo foi escrito nela ainda. Detalhe em
`refactor-state.md`.

**Commit:** `98940fe` (baseline, sem commit novo nesta entrada).

---

## 2026-09-21 — Fase 01 · Reconciliação de drift — CONCLUÍDA

**Migration aplicada:** `0056_reconciliacao_baseline_refactor.sql`

Verificações feitas **antes** de aplicar, todas com resultado zero:
- nulos em `organizacao_id` nas 4 tabelas financeiras: `contratos` 0, `assinaturas` 0,
  `faturas` 0, `mrr_movimentos` 0;
- órfãos nas 3 relações a criar: `leads.canonical_lead_id` 0,
  `mrr_movimentos.evento_comercial_id` 0, `proposta_grupo_comercial.oportunidade_id` 0.

**Schema:** 4 tabelas declaradas, 3 colunas adicionadas, 26 `.notNull()` aplicados.

**Reconciliação de drift:**

```text
tabelas só no banco      6 → 2 (ambas de controle interno)
tabelas só no Drizzle    0 → 0
colunas divergentes      8 → 0
nullability divergente  26 → 0
FKs sem par              3 → 0
```

**Bugs encontrados e corrigidos:** 3 `INSERT` em `tarefas` no worker sem
`organizacao_id`, que falhavam em runtime desde a migration 0050. Corrigidos usando a
organização já resolvida e validada no escopo de cada um.

**Nota de método:** a primeira tentativa de aplicar `.notNull()` por script inseriu a
chamada dentro do `references()`, porque o parser contava chaves e não parênteses.
Quebrou 25 declarações, foi detectado pelo `tsc` e revertido antes de qualquer commit.

**Testes:** `tsc --noEmit` 0 erros; 104 testes, 0 falhas.

**Dados não resolvidos:** nenhum.

**Commit:** `3a47d94`

---

## 2026-09-21 — Fases 02 e 03 · Arquitetura física e fronteiras — CONCLUÍDAS

**Mudanças:** estrutura de `packages/` e `apps/` criada conforme SPEC §34; workspace
pnpm movido para a raiz; 7 testes de arquitetura adicionados.

**Pacotes:** 38 (14 domínio, 10 integrações, 9 platform, 5 shared), cada um com
`package.json` e `index.ts`. Os diretórios de domínio seguem a anatomia do SPEC §36.

**Decisão de método registrada:** os pacotes nascem vazios e o código migra domínio a
domínio, nas fases seguintes. O pacote `app` continua sendo a aplicação que roda. Isso
evita um big bang de 781 arquivos e mantém o sistema verificável a cada passo, que é o
que o SPEC pede ao exigir checkpoint por bloco.

**Testes de arquitetura (SPEC §35, §50.1):** domínio não importa SDK de provedor,
framework de entrega, implementação de integração nem cliente de banco; integração não
importa aplicação; ferramenta de IA não toca banco; todo pacote tem porta de entrada.
Passam trivialmente enquanto os pacotes estão vazios, e é de propósito: a regra precisa
valer antes do código chegar.

**Percalço registrado:** a primeira criação da árvore usou `for x in $VAR` em zsh, que
não faz word splitting como bash, e gerou um diretório único com o nome inteiro. Foi
detectado na conferência, removido e refeito em Python antes de qualquer commit.

**Migrations:** nenhuma nesta fase.

**Testes:** `tsc` 0 erros; 111 testes, 0 falhas.

**Commit:** `9c79729`
