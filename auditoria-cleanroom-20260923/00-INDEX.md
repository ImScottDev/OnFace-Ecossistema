# AUDITORIA CLEAN-ROOM ONFACE — 23/09/2026

> **RETOMANDO O TRABALHO? Leia primeiro `HANDOFF-CONTINUIDADE.md`** — tem o rumo, as decisões tomadas e o próximo passo. Este índice é o mapa dos entregáveis.


Reconstrução do CURRENT STATE real por evidência (código, git, banco RO, runtime). Documentação lida só na Fase 7, contra baseline congelado. Níveis de evidência: RUNTIME (provado agora) / HISTÓRICO (dado prova execução passada) / NÃO PROVADO. Nenhuma alteração de código, banco, commit ou deploy foi feita.

## Entregáveis (22 + baseline + ambiente)
- `00-AMBIENTE-LOCAL.md` — o que o ambiente local realmente é
- `01-SYSTEM-REALITY-MAP.md` — visão de uma página
- `02-ARCHITECTURE-AS-IS.md` — arquitetura derivada do código
- `03-ROUTE-SCREEN-INVENTORY.md` — matriz de rotas/telas + runtime
- `04-DOMAIN-DATA-MODEL-AS-IS.md` — dados reais (+ integrações/operação)
- `05-JOURNEY-MATRIX.md` — 15 jornadas ponta a ponta
- `06-INTEGRATION-MATRIX.md` — 10 integrações
- `07-LEGACY-VS-CANONICAL-MAP.md`
- `08-REGRESSION-LOST-FEATURES-MAP.md`
- `09-CAPTURA-REMOTA-PENDENTE.md` — **ação do usuário** (SSH read-only)
- `10-CONTRADICTIONS-REGISTER.md` — docs × realidade (Fase 7)
- `11-14-DONE-PARTIAL-MISSING-REMOVE.md`
- `12-GAP-REGISTER-P0-P3.md`
- `15-17-DECISOES-TARGET-EXECUCAO.md` — PO decisions, target state, ordem de execução
- `18-DATA-LINEAGE-MIGRATION-FORENSICS.md` — Zoho→banco
- `19-FUNCTIONAL-PARITY-MATRIX.md` — PROD × CRM2.0 × ONFACE
- `20-OPERATIONAL-REALITY.md` — uso real
- `21-ARCHITECTURE-FITNESS-REVIEW.md`
- `22-SOURCE-OF-TRUTH-CONTRACT.md`
- `BASELINE-FASES-1-6.md` — fatos congelados antes da Fase 7

## Veredito em 5 linhas
1. O ONFACE é um CRM de 3 gerações coexistindo; **produção roda a geração anterior, não o redesign**.
2. O núcleo comercial funciona; o **pós-venda, a assinatura e a virada canônica estão inacabados**.
3. **P0**: assinatura sem prova (745 contratos), possível perda de dado (a confirmar na captura remota), `empresas` corrompida.
4. Arquitetura **overengineered e inacabada** — recomendação: **podar e concluir, não reconstruir**; o CRM 2.0 é a melhor base.
5. Docs são honestos mas usam "vocabulário de prontidão" — "pronto" ≠ produto em produção.

## Pendências que dependem do usuário
- **Captura remota** (09) — decide o P0-2 (perda de dado em produção).
- **Sessão autenticada** local — eleva jornadas de código-verificado a RUNTIME.
