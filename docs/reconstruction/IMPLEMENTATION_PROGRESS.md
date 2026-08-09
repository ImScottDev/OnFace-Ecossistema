# Callface CRM 2.0 — Progresso Geral da Reconstrução

Visão de alto nível, uma linha por fase. Detalhe operacional em `RECONSTRUCTION_STATE.md`, decisões em `ARCHITECTURE_DECISIONS.md`.

| Fase | Nome | Status | % | Notas |
|---|---|---|---|---|
| F0 | Foundation | 🟡 completo localmente, homolog pendente (não bloqueia) | ~90% | 6/6 tasks locais concluídas. Homolog é um ambiente ainda a provisionar (ver nota 09/08 em RECONSTRUCTION_STATE.md) — não urgente, decidir no 1º checkpoint real |
| F1 | Domain Model (Lead/Contact/Company/Deal/Attribution) | 🟡 dual-write completo, só falta UX | ~85% | Schema+backfill+dual-write (TODOS os pontos de escrita mapeados agora cobertos, incl. os 4 de menor tráfego fechados 09/08)+observability locais e validados. Falta: UX (trilha de design, F7) |
| F2 | Communication Intelligence | 🟢 dual-write completo, só falta UX | ~85% | Schema+dual-write nos 3 canais, TODOS os pontos mapeados cobertos (incl. os 3 de menor tráfego fechados 09/08: envio manual WhatsApp, cross-save, email de sequência). Falta: UX (timeline unificada, trilha de design+F7) |
| F3 | AI SDR Agent | 🟡 bug corrigido, Handoff formalizado, validação E2E bloqueada | ~40% | Endpoint OpenAI→Groq corrigido + Human Handoff com 3 estados. BLOQUEADO: GROQ_API_KEY do .env inválida, precisa o Kauã renovar. Trigger por evento (vs cron) deferido pra F5 (decisão: não compensa construir consumidor de evento antes do motor de automação geral existir) |
| F4 | Commercial (Won gate, MRR fix) | 🟢 arquitetura completa, só calibração pendente | ~92% | Causa raiz do MRR corrigida + Commercial Evidence Policy (Won desacoplado de Stripe, 3ª via PBX). Dos 58 contratos ambíguos, classificação por evidência resolveu 56/58 automaticamente (33 duplicata provável, 23 legítimo provável, só 2 revisão necessária). Falta: calibrar política pro produto PBX (regra de negócio) + validar stripe-sync fix com Stripe real (bloqueado, sem key local) |
| F5 | Cadência & Automação | 🟢 motor de automação + Cadence Engine construídos | ~80% | dispararAutomacoes() ligado em 7/7 gatilhos reais. Cadence Engine genérico construído e validado (state machine/steps/condições/retry/branching/cancelamento/audit), sweep rodando — decisão consciente de NÃO migrar a cadência real do AI SDR/SDR inbound pra cima dele ainda (mudaria fluxo de receita, precisa validação). Falta: essa migração (quando decidido) |
| F6 | Analytics/Data Quality/Command Center | 🟡 Data Quality + 1º snapshot de Analytics reais | ~45% | Data Quality Layer (10 checks) + snapshot diário de agregados de empresa (`metricas_diarias`, job 1h, validado com cross-check exato contra o dashboard ao vivo). Dashboard ainda lê da OLTP direto (não trocado ainda). Falta: Command Center (fica pra F7/design), trocar dashboard pra ler do snapshot |
| F7 | Frontend/UX (implementação) | 🟡 4 passos reais + 2 bugs críticos corrigidos | ~32% | `CrmTopbar` revivido + `/admin/qualidade-dados` + `/admin/duplicidade-contratos` + aba "Pós-venda" em Relatórios, todos verificados com dado real via Playwright. 2 bugs críticos de sessão/cookie (HTTPS fixo em dev local) achados e corrigidos, confirmados pelo Kauã. Trilha de design paralela nunca foi iniciada — resto de F7 (Command Center, telas de Lead/Deal) é greenfield real |
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
  1. Schema hardening (`organizacao_id NOT NULL` em 4 tabelas financeiras, 0 backfill necessário) + 3 tabelas novas (`teams`, `audit_log`, `event_outbox` — este último virou barramento real em 09/08, ver ADR-EXEC-016).
  2. Fix IDOR em `POST /leads/enrich-bulk`.
  3. Fix `reunioes.status` nunca atualizado (código + backfill local de 58 linhas).
  4. **101 arquivos de rotas Next.js mortas removidos** — mas só depois de um achado real: essas rotas só são mortas em PRODUÇÃO (via Traefik); em `next dev` local elas respondiam de verdade (sem proxy equivalente). Corrigido com rewrite condicional em `next.config.ts` espelhando a regra do Traefik, testado e confirmado antes de deletar.
  5. RBAC v2: papéis novos (Director/Coordinator/Operations) em `roles.ts`, `teams` + `usuarios.teamId`, helpers reusáveis `orgScope`/`pushOwnershipScope` em `api-server/auth.ts`, e — mais concreto — audit log real ligado nos 2 pontos exatos do achado de segurança confirmado (`POST /admin/org-switch` e `POST /admin/view-as`).
  6. Data Governance documentado como tabela de autoridade de escrita por domínio (ADR-EXEC-007), com consequência prática imediata: campos legacy de valor manual congelados, sem nova escrita a partir de F1.
- `npx tsc --noEmit` limpo (só os 6 erros de baseline pré-existentes, 2 inclusive desapareceram com a remoção das rotas mortas).
- 1 commit de checkpoint na branch (`14ad2a3` + fixup do RBAC v2) — **nada promovido pra homolog ou produção ainda**, tudo validado só localmente.
- **Pendências reais de F0 antes de considerar "Done" pelos critérios de 5 dimensões**: promover pra homolog e validar lá; decidir e aplicar o backfill de `reunioes.status` em homolog/produção quando chegar a hora (hoje só local); revisar linha a linha o commit `2111650` (fix de MRR perdido) antes da F4.
