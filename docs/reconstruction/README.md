# CRM 2.0 — Reconstrução — Índice pra Revisão Externa

Snapshot inicial congelado em **09/08/2026**, branch `feature/crm2-fase7-frontend`, pra revisão arquitetural externa contra o blueprint completo. Nada foi promovido pra homolog ou produção — todo este trabalho existe só nesta branch e no banco de dev local.

**Atualização (mesmo dia, pós-revisão)**: revisão concluída, sem gaps que exijam parar — plano confirmado: fechar o que resta de backend/domínio/arquitetura (incl. o Event Outbox real, ver ADR-EXEC-016), depois materializar uma V1 completa de frontend organizada por domínio (não por tela), sem inventar funcionalidade fora do que já existe no domínio construído. Este documento continua sendo atualizado — não é mais um ponto de pausa.

## Por onde começar

1. **[`vault-referencia/PLANO-RECONSTRUCAO-CRM2.md`](vault-referencia/PLANO-RECONSTRUCAO-CRM2.md)** — o plano completo de 10 fases (F0-F9), mapa de dependências, critério de "Done" em 5-6 dimensões por fase. É o documento que define O QUE deveria ser construído e em que ordem.
2. **[`vault-referencia/BLUEPRINT-VS-ESTADO-ATUAL.md`](vault-referencia/BLUEPRINT-VS-ESTADO-ATUAL.md)** — cruzamento do blueprint original (107 pontos) contra o estado do código antes desta reconstrução começar. É a referência-base pra comparar contra o que existe agora.
3. **[`RECONSTRUCTION_STATE.md`](RECONSTRUCTION_STATE.md)** — o log operacional completo, fase por fase, com todo achado real, todo teste, todo bug encontrado e corrigido. É o documento mais detalhado — leitura longa, mas é onde está o "o que realmente aconteceu".
4. **[`IMPLEMENTATION_PROGRESS.md`](IMPLEMENTATION_PROGRESS.md)** — visão de alto nível, uma linha por fase, com % e status. Comece aqui se quiser o resumo antes do detalhe.
5. **[`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md)** — 15 ADRs (decisões arquiteturais numeradas), cada uma com contexto → decisão → consequência. Inclui 2 bugs críticos reais encontrados e corrigidos nesta sessão (ADR-EXEC-015 e o fix seguinte de org-switch/view-as).
6. **[`vault-referencia/DECISOES-PENDENTES.md`](vault-referencia/DECISOES-PENDENTES.md)** — as únicas decisões que faltam e são de NEGÓCIO (não técnicas) — nenhuma bloqueia revisão de arquitetura.

## Reproduzir o ambiente

**[`AMBIENTE-DEV-REAL.md`](AMBIENTE-DEV-REAL.md)** — como rodar este código de verdade (diverge do `README.md` da raiz do repo, que descreve um setup Docker nunca usado nesta sessão). Inclui:
- Setup Postgres/Redis via Homebrew
- `schema-snapshot-2026-08-09.sql` — dump `pg_dump --schema-only` do banco real no fim desta sessão (as migrations incrementais em `app/src/lib/db/migrations/` estão defasadas — `drizzle-kit push --force` foi usado a sessão inteira, não `generate`)
- Credenciais de login local
- O que NÃO pôde ser validado localmente e por quê (Groq expirada, Stripe deliberadamente vazia)

## Relatórios de diagnóstico (só leitura, nenhuma correção aplicada)

- **[`relatorios/2026-08-09-data-quality.md`](relatorios/2026-08-09-data-quality.md)** — saída real do Data Quality Layer (15 checks).
- **[`relatorios/2026-08-09-duplicidade-contratos.md`](relatorios/2026-08-09-duplicidade-contratos.md)** — saída real da classificação de contratos duplicados por evidência.

## Resumo do que existe (ver `IMPLEMENTATION_PROGRESS.md` pra detalhe)

| Bloco do plano | Status |
|---|---|
| Fundação/Arquitetura (F0) | ✅ completo localmente |
| Domain Model / CRM Core (F1) | ✅ dual-write 100%, validado continuamente |
| Communication Intelligence (F2) | ✅ dado completo, 🟡 UI (timeline) não construída |
| Operação Comercial / Won Evidence (F4) | ✅ arquitetura completa, 🟡 calibração de política pendente |
| AI SDR (F3) | 🟡 arquitetura pronta, validação real bloqueada (credencial) |
| Automação / Cadence Engine (F5) | ✅ motor construído e testado, 🟡 cadência real não migrada (decisão consciente) |
| Analytics / Data Quality (F6) | ✅ Data Quality real, 🟡 Command Center não existe |
| Eventos / Event-Driven | 🟢 barramento real (publish+consume+retry/dead-letter, ver ADR-EXEC-016, 09/08) nos eventos de núcleo (Lead/Deal/Won/Customer); 🟡 sem consumidor de negócio real ainda (só jornal de auditoria) |
| Segurança / RBAC | ✅ + 2 bugs críticos reais corrigidos (sessão e org-switch/view-as em dev local) |
| Migração Legacy → New | 🟡 coexistência ativa (strangler pattern), cutover não iniciado (correto, depende de burn-in em produção) |

## O que este snapshot NÃO é
- Não foi promovido pra `homolog` nem `main`.
- Não inclui segredos/`.env` (gitignored, nunca commitado).
- `Command Center`, `Cadence Builder` (UI visual), timeline unificada de comunicação e a maior parte de F7 (frontend) **não existem** — dependem de uma trilha de design que nunca foi formalmente iniciada, decisão consciente de não inventar UI sem isso.
