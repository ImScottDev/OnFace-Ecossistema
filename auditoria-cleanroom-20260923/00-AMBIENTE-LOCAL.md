# 00 — Ambiente local existente (identificado em 23/09/2026, ~12h)

Nível de evidência: **PROVADO NO RUNTIME ATUAL**, salvo indicação.

## Processos em execução (lsof, PIDs verificados)
| PID | Porta | Diretório (cwd) | O que é | Evidência |
|---|---|---|---|---|
| 1165 | :5432 | — | PostgreSQL 16.14 (brew) | `lsof -iTCP:5432`; `psql select version()` |
| 1156 | :6379 | — | Redis (brew) | `lsof -iTCP:6379` |
| 26028 | :3100 | `onface-ux-rebuild/app` | **Next.js dev do branch redesign/onface-ux-spec-v1** | cwd via `lsof -p`; usuário valida por `http://localhost:3100/pre-vendas` |
| 11824 | :3001 | `callface-crm-dev/app` | **API Hono do branch refactor/arquitetura-canonica (CP63)** | cwd via `lsof -p`; `GET /api/health → 200`; `GET /api/leads → 401` |
| 84043 | :3002 | `callface-crm-dev/app` | **Worker BullMQ (CP63)** — 25 conexões Redis estabelecidas | `lsof -p 84043` (25× localhost:6379 ESTABLISHED) |
| 17467 | :3011 | `callface-crm-dev/app` | Processo Next/serviço do CP63 (404 em `/` e `/login`) — papel a confirmar | `lsof`, curls |

## FATO CRÍTICO — ambiente local é HÍBRIDO de duas gerações
O front que o usuário valida (:3100, código do redesign, 65 commits à frente) conversa com API e worker do **CP63** (callface-crm-dev). Não há API rodando do código do próprio worktree redesign.

## FATO — ponte de API do Next :3100 está QUEBRADA
- `onface-ux-rebuild/app/.env`: `API_PORT=3012`, `HONO_API_PORT=3012`, `NEXTAUTH_URL=http://localhost:3100`.
- **Nenhum processo escuta em :3012.**
- `GET http://localhost:3100/api/leads → 500` (o rewrite do next.config aponta para 3012).
- `GET http://localhost:3001/api/leads → 401` (API real exige auth, correto).
⇒ Qualquer dado de tela em :3100 que passe pelo rewrite `/api/*` falha hoje. Server components/actions que vão direto ao banco funcionam (a tela abre). REGISTRADO, não corrigido (regra da auditoria).

## FATO — guarda de autenticação ativa no runtime
`GET /pre-vendas → 307 Location: /login?callbackUrl=%2Fpre-vendas`.

## Bancos locais (Postgres 16, SELECTs)
| Banco | Tamanho | Última migração | Tabelas | leads | Último domain_event | Último audit |
|---|---|---|---|---|---|---|
| `callface_crm` (usado pela stack viva; `.env` dos dois worktrees) | 169 MB | `0090_meta_staging_idempotente.sql` | 176 | 4066 | **23/09 11:42** | 23/09 11:42 |
| `callface_crm_ensaio` | 180 MB | 0090 | 176 | 4012 | 23/09 01:52 | 21/09 15:11 |
| `callface_crm_pre_carga_20260920` | 119 MB | `0050_tarefas_organizacao_obrigatoria.sql` | 146 | 3670 | (tabela não existe) | 20/09 21:00 |

## Atividade das últimas 24h em `callface_crm` (worker CP63 vivo + ações manuais)
- 11:41–11:42 de hoje: `LeadCreated`(7), `DealCreated`(7), `StageChanged`(9), `HandoffToImplementation`(7), `TagAdded`(21) — consistente com validação manual/scripts de jornada desta manhã.
- 10:25: `AcquisitionCreated`(54) — consistente com importação Meta Lead Ads (commit e64e270).
- 01:52: `ProposalSent`(681), `CadenceStepExecuted`(1335), `DiagnosticCompleted`(59) — consistente com carga/sync noturno de 23/09.

## Acessos da sessão de auditoria
- Postgres local liberado via TCP 127.0.0.1 (sandbox ajustado em `.claude/settings.local.json` — intervenção de auditoria, não é mudança de produto).
- SSH à EC2 34.204.200.52 segue bloqueado pelo sandbox (porta 22 não proxeada); captura remota será executada pelo usuário com comandos fornecidos (`!`).
- Worker próprio: NÃO iniciado por esta auditoria (o que roda é o preexistente do usuário; emenda 8 respeitada).

## INFERÊNCIAS (não fatos)
- O processo :3011 é provavelmente o Next dev do CP63 (mesmo cwd), com 404 por rota raiz inexistente ou basePath diferente — confirmar.
- As 54 `AcquisitionCreated` de 10:25 vieram do importador Meta — confirmar pela origem (`source`) dos eventos.
