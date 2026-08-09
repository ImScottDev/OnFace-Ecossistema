# Callface CRM 2.0 — Progresso Geral da Reconstrução

Visão de alto nível, uma linha por fase. Detalhe operacional em `RECONSTRUCTION_STATE.md`, decisões em `ARCHITECTURE_DECISIONS.md`.

| Fase | Nome | Status | % | Notas |
|---|---|---|---|---|
| F0 | Foundation | 🟡 implementado localmente, falta homolog | ~80% | 6/6 tasks locais concluídas (schema, dev/prod parity, IDOR, reunioes.status, RBAC v2, Data Governance). Falta: validar em homolog antes de considerar "Done" pelos critérios das 5 dimensões |
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
- 2 achados técnicos pendentes verificados e quantificados com precisão (ver `ARCHITECTURE_DECISIONS.md` ADR-EXEC-004): MRR duplicado confirmado e MAIOR que a última medição (36 pares, R$17.449,30/mês); reuniões travadas confirmado (60 no total, não só as 53 de julho); assinaturas fora do espelho NÃO reproduzido (descartado).
- Docs de reconstrução criados e mantidos (`RECONSTRUCTION_STATE.md`, `ARCHITECTURE_DECISIONS.md`, este arquivo).
- **6/6 tasks de F0 concluídas localmente**:
  1. Schema hardening (`organizacao_id NOT NULL` em 4 tabelas financeiras, 0 backfill necessário) + 3 tabelas novas (`teams`, `audit_log`, `event_outbox`).
  2. Fix IDOR em `POST /leads/enrich-bulk`.
  3. Fix `reunioes.status` nunca atualizado (código + backfill local de 58 linhas).
  4. **101 arquivos de rotas Next.js mortas removidos** — mas só depois de um achado real: essas rotas só são mortas em PRODUÇÃO (via Traefik); em `next dev` local elas respondiam de verdade (sem proxy equivalente). Corrigido com rewrite condicional em `next.config.ts` espelhando a regra do Traefik, testado e confirmado antes de deletar.
  5. RBAC v2: papéis novos (Director/Coordinator/Operations) em `roles.ts`, `teams` + `usuarios.teamId`, helpers reusáveis `orgScope`/`pushOwnershipScope` em `api-server/auth.ts`, e — mais concreto — audit log real ligado nos 2 pontos exatos do achado de segurança confirmado (`POST /admin/org-switch` e `POST /admin/view-as`).
  6. Data Governance documentado como tabela de autoridade de escrita por domínio (ADR-EXEC-007), com consequência prática imediata: campos legacy de valor manual congelados, sem nova escrita a partir de F1.
- `npx tsc --noEmit` limpo (só os 6 erros de baseline pré-existentes, 2 inclusive desapareceram com a remoção das rotas mortas).
- 1 commit de checkpoint na branch (`14ad2a3` + fixup do RBAC v2) — **nada promovido pra homolog ou produção ainda**, tudo validado só localmente.
- **Pendências reais de F0 antes de considerar "Done" pelos critérios de 5 dimensões**: promover pra homolog e validar lá; decidir e aplicar o backfill de `reunioes.status` em homolog/produção quando chegar a hora (hoje só local); revisar linha a linha o commit `2111650` (fix de MRR perdido) antes da F4.
