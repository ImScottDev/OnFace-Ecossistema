# Callface CRM 2.0 — Progresso Geral da Reconstrução

Visão de alto nível, uma linha por fase. Detalhe operacional em `RECONSTRUCTION_STATE.md`, decisões em `ARCHITECTURE_DECISIONS.md`.

| Fase | Nome | Status | % | Notas |
|---|---|---|---|---|
| F0 | Foundation | 🟡 completo localmente, homolog pendente (não bloqueia) | ~90% | 6/6 tasks locais concluídas. Homolog é um ambiente ainda a provisionar (ver nota 09/08 em RECONSTRUCTION_STATE.md) — não urgente, decidir no 1º checkpoint real |
| F1 | Domain Model (Lead/Contact/Company/Deal/Attribution) | 🟡 suficiente pra seguir, UX pendente | ~75% | Schema+backfill+dual-write+observability locais e validados. Falta: UX (trilha de design, F7), pontos de menor tráfego não cobertos (não bloqueiam) |
| F2 | Communication Intelligence | 🟡 suficiente pra seguir, UX pendente | ~65% | Schema+dual-write nos 3 canais (ligação/WhatsApp/email) nos pontos de maior volume. Falta: UX (timeline unificada, trilha de design+F7), pontos de menor tráfego |
| F3 | AI SDR Agent | 🟡 bug corrigido, Handoff formalizado, validação E2E bloqueada | ~40% | Endpoint OpenAI→Groq corrigido + Human Handoff com 3 estados. BLOQUEADO: GROQ_API_KEY do .env inválida, precisa o Kauã renovar. Trigger por evento (vs cron) deferido pra F5 (decisão: não compensa construir consumidor de evento antes do motor de automação geral existir) |
| F4 | Commercial (Won gate, MRR fix) | 🟡 fix aplicado, PBX evidence pendente | ~70% | Causa raiz do MRR corrigida + gate de Won real, ambos construídos do zero (não copiados de homolog). Diagnóstico de 57 grupos duplicados salvo, nada corrigido em massa (checkpoint humano). Falta: 3ª via de evidência PBX (dado real já levantado), validar stripe-sync fix com Stripe real (bloqueado, sem key local) |
| F5 | Cadência & Automação | 🟡 motor de automação real, Cadence Builder pendente | ~55% | dispararAutomacoes() testado E2E, ligado em 7/7 gatilhos reais (novo_lead/novo_negocio/mudanca_status/whatsapp_recebido + contrato_vencendo/lead_inativo/nps_recebido migrados 09/08). Falta: Cadence Builder (2ª metade da fase, ainda array hardcoded) |
| F6 | Analytics/Data Quality/Command Center | 🟡 Data Quality + 1º snapshot de Analytics reais | ~45% | Data Quality Layer (10 checks) + snapshot diário de agregados de empresa (`metricas_diarias`, job 1h, validado com cross-check exato contra o dashboard ao vivo). Dashboard ainda lê da OLTP direto (não trocado ainda). Falta: Command Center (fica pra F7/design), trocar dashboard pra ler do snapshot |
| F7 | Frontend/UX (implementação) | 🟡 3 passos reais, greenfield confirmado | ~25% | `CrmTopbar` revivido + `/admin/qualidade-dados` (F6) + `/admin/duplicidade-contratos` (F4), todos verificados com dado real. Decisões humanas pendentes consolidadas em resumo único no vault (`crm2-decisoes-pendentes.md`). Trilha de design paralela nunca foi iniciada — resto de F7 é greenfield real |
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
