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
