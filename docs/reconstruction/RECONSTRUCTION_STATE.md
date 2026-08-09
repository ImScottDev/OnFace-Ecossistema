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

## Fase atual: F1 — Domain Model (F0 completo localmente)

**Branch atual**: `feature/crm2-fase1-domain-model` (a partir de `feature/crm2-fase0-foundation`, que já foi commitada e não precisa mais de trabalho — só falta promover pra homolog quando o ambiente novo existir).

**Subfase atual**: schema novo criado e validado (`pessoas`/`pontos_contato`/`oportunidades`/`clientes`, commit `40d0ddb`) → próximo passo é o script de backfill/reconciliação do legado.

### F0 — status final: completo localmente, 6/6 tasks
Todas as 6 tasks de F0 (schema hardening, dev/prod routing parity + remoção de rotas mortas, IDOR, reunioes.status, RBAC v2, Data Governance) foram concluídas e commitadas (`14ad2a3`, `cc68e19` na branch `feature/crm2-fase0-foundation`). Detalhe completo na seção "F0 — histórico" mais abaixo. RBAC v2 e Data Governance (que apareciam como "em andamento" numa versão anterior deste arquivo) **estão concluídos**: papéis novos (Director/Coordinator/Operations) em `roles.ts`, `teams`+`usuarios.teamId`, helpers `orgScope`/`pushOwnershipScope`, audit log real ligado em `org-switch`/`view-as`, e ADR-EXEC-007 (Data Governance) documentado.

### F1 — progresso
- [x] Branch `feature/crm2-fase1-domain-model` criada.
- [x] Schema novo desenhado e aplicado no banco local (`drizzle-kit push --force`), `tsc` limpo, commit `40d0ddb`:
  - `pessoas` (identidade persistente, Contact do blueprint) — `leadIdLegado` é só bridge de migração.
  - `pontos_contato` (Attribution/Touchpoints) — ancorado em Pessoa/Empresa, nunca em Lead. `isFirstTouch`/`isLastTouch` explícitos.
  - `oportunidades` (Deal v2) — referencia `pessoa_id`/`empresa_id`, sem `lead_id` obrigatório. `negocioIdLegado` é bridge de migração.
  - `clientes` (Customer, entidade nova) — `statusFinanceiro` é cache de leitura, nunca fonte de escrita (Data Governance).
- [x] **Script de backfill escrito e executado** (`app/src/lib/db/backfill-domain-model.ts`, `npm run db:backfill-domain-model`) — idempotente (TRUNCATE das 4 tabelas novas antes de reconstruir, seguro porque nada ainda lê/escreve nelas).
- [x] **Resultado no banco local, validado**: 3.164 leads → 3.132 pessoas (32 dedupados por e-mail = reengajamento real) + 3.164 pontos_contato (1:1 com leads) + 231 clientes (de 240 leads tipo='cliente', dedup por empresa). 1.092 negócios → 1.092 oportunidades (1:1), **zero sem pessoa resolvida**.
- [x] **Validação de integridade extra (não só contagem)**: zero pessoa com >1 `isLastTouch`, zero pessoa com >1 `isFirstTouch`, zero pessoa com touchpoint mas sem first touch, zero oportunidade órfã. Casos reais de reengajamento (32 pessoas, 2 touchpoints cada) confirmados por query.
- [x] **Dual-write real implementado**: `lib/crm/sync-domain-model.ts` (`syncPessoaFromLead`, `syncOportunidadeFromNegocio`) — mesma lógica do backfill, mas idempotente por registro único (upsert por `leadIdLegado`/`negocioIdLegado`), best-effort (nunca lança erro que quebre o fluxo legado). Ligado em: `POST /leads` (criação), `PATCH /leads/:id` (update), `POST /negocios` (criação), `PATCH /negocios/:id` (update), e `converterLeadEmOportunidade` (usado tanto pelo endpoint manual quanto pelo Agente SDR — cobre o caminho automático também).
- [x] **Testado de ponta a ponta** (script descartável, removido depois): criei lead+negócio reais via as mesmas funções que as rotas chamam, confirmei pessoa/touchpoint/oportunidade criados corretamente (isFirstTouch/isLastTouch certos, pessoaId linkado), limpei os dados de teste. `tsc` limpo, dev server (`:3000`/`:3001`) saudável depois do reload automático (`tsx watch`/Turbopack).
- [ ] Validar F1 pelas 5 dimensões de Done (ver plano) — Technical+Data+Operational OK agora; falta UX (nenhuma tela ainda expõe o novo Domain Model, fica pra trilha paralela de design + F7) e Observability mais formal (hoje só `console.error` no catch, não tem métrica/alerta de falha de sync).
- [x] **Mapeamento de todos os pontos de escrita** (`grep insert(leads)/insert(negocios)` no repo inteiro): achado real — criação de lead/negócio está espalhada em pelo menos 9 lugares, o mesmo padrão de "regra duplicada" que já tinha causado o bug de MRR. Cobertos com dual-write (por ordem de valor real: tráfego externo + receita primeiro):
  - `POST/PATCH /leads`, `POST/PATCH /negocios` (rotas principais).
  - `converterLeadEmOportunidade` (cobre tanto o endpoint manual quanto o Agente SDR).
  - `webhooks/site-lead/route.ts` e `webhooks/rd-lead/route.ts` (as 2 entradas reais de lead externo — site institucional e RD Station/Meta).
  - `lib/crm/aceitar-proposta.ts` (`marcarPropostaAceita`) — o caminho de receita real (Won), usado tanto pelo aceite manual quanto pelo webhook do Stripe.
- [ ] **Ainda não cobertos** (menor tráfego/prioridade, mapeados mas não implementados): `contatos-unified.ts`, `apollo.ts` (import de prospecção), `contatos.ts` (conversão contato→lead), `propostas.ts:299` (fallback de negócio sem proposta aceita ainda). E dentro do próprio `aceitar-proposta.ts`: a 2ª negócio criado no branch `if(currentNeg)` (clone "ativo" pra carteira) não tem `.returning()` hoje, não sincronizado — secundário, o evento principal de Won já está coberto via `pAtual.negocioId`.
- [x] Testado (`tsc` limpo, dev server saudável) depois de cada rodada de mudança.
- [x] **Observability**: falha de sync agora grava em `audit_log` (`action: "domain_model_sync.failed"`), não só `console.error` — consultável de verdade, não preso em log de container.
- [ ] Validar F1 pelas 5 dimensões de Done — Technical+Data+Operational+Observability OK pros pontos cobertos de dual-write; falta só UX (nenhuma tela ainda expõe o novo Domain Model, fica pra trilha de design + F7, não bloqueia seguir).

### F1 — considerado suficiente pra seguir pra F2
Backfill validado + dual-write nos pontos de maior valor real + observability de falha. Os pontos de menor tráfego não cobertos (contatos-unified, apollo, contatos.ts, fallback de propostas.ts) ficam registrados como pendência, não bloqueiam — mesmo critério de "incremental ≠ provisório mas não trava tudo antes de avançar" do plano.

### Riscos abertos (atualizados)
- Fix de MRR duplicado (F4): **achado novo relevante 09/08** — não está só no commit `2111650` (`wip/local-pre-sync`), está TAMBÉM completo e wired de verdade na branch `homolog` (backup do Kauã, ver ADR-EXEC-008) — `avaliarContratosAtivosDoLead`/`marcarContratoRenovado` chamados em `aceitar-proposta.ts` e `api-server/routes/contratos.ts`. **NÃO integrar essa branch agora** — Kauã vai revisar essa branch com calma depois, mas serve de referência pronta quando chegar F4.
- Terceira via de evidência de "Won" pra PBX (não passa por Stripe) — decisão ainda pendente, bloqueia fechamento pleno de F4.
- Backfill de `reunioes.status` (F0) rodado só no banco LOCAL — precisa reaplicar quando homolog/produção forem tocados.
- **Ambiente de homolog do CRM 2.0 ainda não provisionado** — decisão de infra (mesma EC2 com stack isolado vs. servidor novo) não urgente até 1º checkpoint real de promoção (provável fim de F1). NUNCA usar a branch git `homolog` existente como target (é backup do Kauã).
- Nada do trabalho de F0/F1 foi promovido pra homolog ou produção — tudo só local.

---

## F0 — histórico (detalhe completo, fase já encerrada localmente)

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

### RBAC v2 e Data Governance (Tasks #5/#6 — CONCLUÍDAS, commit `cc68e19`)
- [x] `roles.ts`: papéis novos (director/coordinator/operations) sem quebrar as regras de acúmulo SDR/closer já existentes (decisão Scott 01/jul, preservada).
- [x] `teams` + `usuarios.teamId` (referência circular resolvida via `AnyPgColumn`).
- [x] `api-server/auth.ts`: helpers `orgScope`/`pushOwnershipScope` — infraestrutura reusável, adoção incremental rota a rota em F1+.
- [x] `admin.ts`: audit log real ligado em `POST /admin/org-switch` e `POST /admin/view-as` — fecha o achado de segurança confirmado (zero log de impersonation/org-switch).
- [x] ADR-EXEC-007 (Data Governance — tabela de autoridade de escrita por domínio) documentado em `ARCHITECTURE_DECISIONS.md`.

### Decisões arquiteturais (ver `ARCHITECTURE_DECISIONS.md` pra detalhe completo)
ADR-EXEC-001 (outbox sem broker novo) · 002 (evidência Won×PBX, pendente) · 003 (Schema V2 em paralelo) · 004 (verificação de achados via query real) · 005 (docs no repo) · 006 (dev/prod routing parity) · 007 (Data Governance) · 008 (branch `homolog` é backup do Kauã, não integrar).

Fim do histórico F0 — ver seção "Fase atual: F1" no topo deste arquivo para o estado real e próximo passo.
