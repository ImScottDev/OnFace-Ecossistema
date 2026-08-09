# Callface CRM 2.0 — Progresso Geral da Reconstrução

Visão de alto nível, uma linha por fase. Detalhe operacional em `RECONSTRUCTION_STATE.md`, decisões em `ARCHITECTURE_DECISIONS.md`.

| Fase | Nome | Status | % | Notas |
|---|---|---|---|---|
| F0 | Foundation | 🟡 em andamento | ~15% | Ambiente verificado, achados técnicos confirmados/quantificados, migrations em progresso |
| F1 | Domain Model (Lead/Contact/Company/Deal/Attribution) | ⚪ não iniciado | 0% | |
| F2 | Communication Intelligence | ⚪ não iniciado | 0% | |
| F3 | AI SDR Agent | ⚪ não iniciado | 0% | |
| F4 | Commercial (Won gate, MRR fix) | ⚪ não iniciado | 0% | Depende de ADR-EXEC-002 (evidência PBX) |
| F5 | Cadência & Automação | ⚪ não iniciado | 0% | |
| F6 | Analytics/Data Quality/Command Center | ⚪ não iniciado | 0% | |
| F7 | Frontend/UX (implementação) | ⚪ não iniciado | 0% | Trilha de design paralela ainda não formalmente iniciada |
| F8 | Migração completa/decomissão | ⚪ não iniciado | 0% | |
| F9 | Ecosystem Readiness | ⚪ não iniciado | 0% | |

**Legenda**: ⚪ não iniciado · 🟡 em andamento · 🟢 concluído (5 dimensões de Done fechadas) · 🔴 bloqueado

## Log de sessões de execução

### Sessão 1 — 08/08/2026
- Ambiente local confirmado (Postgres/Redis Homebrew, dado real via `refresh-dev-db.sh`).
- Branch `feature/crm2-fase0-foundation` criada.
- 2 achados técnicos pendentes verificados e quantificados com precisão (ver `ARCHITECTURE_DECISIONS.md` ADR-EXEC-004).
- Docs de reconstrução criados (`RECONSTRUCTION_STATE.md`, `ARCHITECTURE_DECISIONS.md`, este arquivo).
- Task list criada (6 itens de F0).
- Em andamento: migrations de fundação (audit_log, event_outbox, teams, org_id NOT NULL).
