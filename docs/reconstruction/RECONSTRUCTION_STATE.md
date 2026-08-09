# Callface CRM 2.0 — Estado da Reconstrução

> Arquivo de retomada. Se o contexto acabar, leia este arquivo primeiro — ele
> deve permitir continuar exatamente de onde parou, sem reconstruir raciocínio.
> Atualizado continuamente durante a execução, não só ao fim de fase.

**Branch de trabalho**: `feature/crm2-fase0-foundation` (a partir de `main`, que espelha produção). **Produção e homolog não são tocados nesta fase** — tudo roda local (Postgres/Redis via Homebrew, `./scripts/dev.sh`) até haver critério explícito de promoção.

**Fonte do plano**: `/Users/Scott/Documents/Brain - Scott Studio/projetos/callface/produto/plano-reconstrucao-crm-2.0.md` (vault) — 10 fases (F0-F9), regra INCREMENTAL ≠ PROVISÓRIO, Done em 5-6 dimensões (Technical/Data/Product/UX/Observability/Operational).

---

## Nota importante (09/08) — branch `homolog` é backup do Kauã, não é target

A branch git `homolog` (origin/homolog) captura o estado real do servidor
de homolog em 07/08 — é backup intencional do Kauã pra ele revisar depois
(módulo CS/Onboarding, callpilot-trigger, fix de MRR completo em
`lib/crm/contratos.ts`, todos ainda sem decisão dele). **NUNCA fazer merge
nela, nunca tratar como target de deploy.** Ver ADR-EXEC-008. O CRM 2.0
precisa de um ambiente de homolog PRÓPRIO — decisão de infra (mesma EC2 com
stack isolado vs. servidor novo) ainda não tomada, não é urgente até o
primeiro checkpoint real de promoção (provável fim de F1).

**Cadência de promoção decidida**: por checkpoint de fase/sub-fase coerente,
não por micro-commit. Trabalho local/dev contínuo; sync pra homolog (quando
o ambiente novo existir) nos pontos em que a fase atinge Technical+Data
Done, pra ter algo estável de verdade pra validar — não um alvo em fluxo
constante.

## Fase atual: F0 — Foundation

**Subfase atual**: verificação de achados técnicos concluída → iniciando schema hardening.

### Concluído
- [x] Ambiente local confirmado operacional (Postgres 5432 + Redis 6379 via Homebrew, `app/.env` com `DATABASE_URL` real).
- [x] Banco local confirmado com dado espelhado de produção (3.164 leads, 1.092 negócios, 312 contratos, 262 assinaturas, 159 reuniões, 4.707 status_changes).
- [x] Branch `feature/crm2-fase0-foundation` criada a partir de `main`.
- [x] **Verificação dos 2 achados técnicos pendentes (via query direta no banco local)**:
  - **MRR duplicado — CONFIRMADO, quantificado com precisão**: 36 pares de `contratos` com o mesmo `stripe_subscription_id`, todos `status='ativo'`, criados segundos/minutos um do outro (padrão: um com `negocio_id` preenchido — via `marcarPropostaAceita` — outro sem — via `syncStripe()`). **Excesso real: R$17.449,30/mês** (36 linhas duplicadas). Cresceu de R$12.092,70 (30/07, 16 pares) — confirma que o bug segue ativo a cada venda por checkout Stripe. Causa raiz já documentada em `blueprint-crm2-vs-current-state.md` (vault): `lib/integrations/stripe-sync.ts` (`syncStripe()`) nunca checa a tabela `contratos` por `stripeSubscriptionId` antes de inserir.
  - **Reuniões travadas em "agendada" — CONFIRMADO**: 53 reuniões (de 128 reuniões de julho, todas ainda `status='agendada'`) estão vinculadas a negócios que tiveram evento real `reuniao_realizada` em `status_changes` no mesmo mês. `reunioes.status` nunca é atualizado quando o negócio avança de estágio — bug de escrita real, explica a divergência de contagem de reunião entre relatórios (SDR/Growth/Marketing usam fontes diferentes, achado já registrado no `AUDITORIA.md` do repo).
  - **Assinaturas fora do espelho (~47, ~R$15,9k/mês, claim do ChatGPT) — NÃO REPRODUZIDO hoje**: 0 contratos ativos sem assinatura espelhada. Descartado como achado atual (provavelmente já corrigido antes, ou impreciso na origem).
  - **`organizacao_id` nullable em tabela financeira — confirmado no schema, mas 0 violação real hoje** (`contratos`/`assinaturas`/`faturas`/`mrr_movimentos` todos com 0 linha nula). Constraint `NOT NULL` pode ser adicionada sem backfill.

### Concluído (continuação)
- [x] **Schema hardening**: `organizacao_id NOT NULL` aplicado em `contratos`/`assinaturas`/`faturas`/`mrr_movimentos` (0 backfill necessário, confirmado 0 violação real). Aplicado via `drizzle-kit push --force` local (generate/migrate tradicional travou em prompt interativo — confirma na prática o achado de drift de migration já documentado; ver ADR-EXEC-004).
- [x] Tabelas novas criadas em `schema.ts` + aplicadas no banco local: `teams`, `audit_log`, `event_outbox` (todas com índices, `audit_log`/`event_outbox` cobrem os achados de segurança/observabilidade já confirmados).
- [x] **Achado arquitetural real, corrigido**: rotas Next.js "mortas em produção" (Traefik) na verdade respondiam de verdade em `next dev` local (sem Traefik, frontend chama `fetch("/api/...")` relativo, cai no Next). Corrigido com rewrite condicional (`NODE_ENV=development`) em `next.config.ts` espelhando exatamente a regra do Traefik — testado e confirmado (`/api/tarefas` via :3000 agora responde igual ao Hono direto; `/api/auth/session` continua no Next). Documentado como decisão em `ARCHITECTURE_DECISIONS.md`.
- [x] **101 arquivos de rotas Next.js duplicadas/mortas removidos** (`git rm`) — admin, apollo, automacoes, carteira, configuracoes, contatos, contatos-unified, contratos, custom-fields, email, empresas, enrichment, health, labels, leads, negocios, notas, notificacoes, nps, perfil, pipelines, propostas, reunioes, servicos-catalogo, usuarios, whatsapp. Mantidos (exceção real, confirmada no Traefik): auth, webhooks, financeiro, onboarding, campanhas, meta.
- [x] **IDOR corrigido**: `POST /leads/enrich-bulk` (`leads.ts`) — `ids` do client agora re-resolvidos contra `ctx.organizacaoId` antes de enfileirar.
- [x] **Bug de `reunioes.status` corrigido** (código + dado): `negocios.ts`, transição pra `reuniao_realizada` agora atualiza a reunião vinculada ainda `agendada` pra `realizada`. Backfill controlado rodado no banco LOCAL (mirror): 58 reuniões corrigidas, 0 travada restante confirmado por query.
- [x] `npx tsc --noEmit` limpo — só os 6 erros de baseline pré-existentes (não relacionados, 2 inclusive desapareceram junto com a remoção das rotas mortas que os continham).
- [x] Servidor de dev (app :3000 + api :3001, processo persistente da equipe desde 07/08) validado saudável depois de todas as mudanças — reiniciado só o `next dev` (necessário pra pegar o `next.config.ts` novo), api/worker não tocados.

### Em andamento
- [ ] RBAC v2 (helper reusável de org/team/ownership, papéis novos Director/Coordinator/Operations) — Task #5.
- [ ] Data Governance como contrato documentado — Task #6.

### Decisões arquiteturais tomadas nesta sessão
Ver `ARCHITECTURE_DECISIONS.md` (ADR-EXEC-001 a 005 + nova decisão de dev/prod routing parity, a documentar como ADR-EXEC-006).

### Riscos abertos
- Fix de MRR duplicado (F4) depende do commit `2111650` (branch `wip/local-pre-sync`, existe em `origin/wip/local-pre-sync`) — ainda não revisado linha a linha nesta sessão, só referenciado por achado anterior. Revisar antes de reaplicar.
- Terceira via de evidência de "Won" pra PBX (não passa por Stripe) — decisão ainda pendente, bloqueia fechamento pleno de F4.
- **Backfill de `reunioes.status` rodado só no banco LOCAL (mirror)** — não propaga pra homolog/produção automaticamente. Precisa ser reaplicado (mesma query, documentada acima) quando/se for promovido, com o mesmo cuidado de validação antes/depois.
- IDOR/rotas mortas/reunioes fix: implementados e validados localmente, **nada promovido pra homolog ou produção ainda** — aguardando ciclo de validação antes de merge pra `homolog`.

### Próximo passo exato
Task #5 (RBAC v2) e #6 (Data Governance doc) — últimos itens de F0 antes de fechar a fase e considerar promoção pra `homolog` pra validação real.
