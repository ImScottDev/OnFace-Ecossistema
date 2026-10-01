# 06 — INTEGRATION MATRIX (Fase 6)

Fontes: código (`app/src/lib/integrations`, `api-server/routes`, webhooks, worker) + status no dado (`callface_crm`, SELECT). Níveis: RUNTIME (dado recente prova uso) · HISTÓRICO · NÃO PROVADO. Ressalva geral: **`integracao_sync_estado` tem 0 linhas → não há observabilidade estruturada de nenhuma integração**; o status abaixo vem de tabelas de dado por integração.

| Integração | Entrada | Saída | Auth | Webhook | Idempotência | Retry | Tabelas | Status real | Nível |
|---|---|---|---|---|---|---|---|---|---|
| **Meta (Lead Ads + CAPI)** | webhook lead ads; import histórico | CAPI (conversões) | 3 credenciais distintas (CAPI/LeadAds/AdsInsights); webhook verify token | `/api/webhooks/meta-leads`, `/meta-lead-ids` (fail-closed 503) | `meta_lead_staging` idempotente (migração 0090); politica-eventos testada | fila site-lead-qualify (5 tent., backoff 60s) | meta_lead_staging (575), meta_capi_entregas (54, 100% entregue) | **A MAIS MADURA** — pacote (5 mód, 724 LOC, 11 imports) + adapter + consumidor outbox + dado real. 54 leads hoje 10:25 | **RUNTIME** |
| **Stripe** | webhook eventos + polling stripe-sync (30min) | checkout, catálogo, reconciliação | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET | `/api/webhooks/stripe` (fail-closed) | `stripe_webhook_events` (dedup por event id) | fila stripe-webhook-events (sem produtor — alcançado por polling); reconcile-pagamentos 24h | stripe_webhook_events (140), assinaturas (357), contratos c/ sub (418), faturas origem=stripe (855) | **RUNTIME** até 22/09 19:04. **1 invoice.paid pending há 9 dias, attempts=0.** 101 subs duplicadas em contratos = R$62.822 MRR em dobro | **RUNTIME** (com falha) |
| **WhatsApp (WuzAPI/UAZAPI)** | webhook mensagens | envio, templates, avatar | UAZAPI_API_KEY, webhook secret, WHATSAPP_ALLOWLIST (trava dev) | `/api/whatsapp/webhook` | idempotencia-sem-relogio (testada) | 3 filas (incoming/outgoing/status); check-whatsapp-connection 5min | whatsapp_mensagens (27.096; **12.739 perdidas vs 20/09**), whatsapp_sessao (8) | **RUNTIME** até 22/09 21:58. Re-sync parcial perdeu histórico | **RUNTIME** (com perda) |
| **Telefonia Callface** | webhook call events | POST create-contact | CALLFACE_INBOUND_TOKEN, webhook secret | `/api/webhooks/callface` (fail-closed) | — | fila callface-call-events (retry generoso) | ligacoes (5.221) | **RUNTIME** até 22/09 18:40 | **RUNTIME** |
| **Microsoft/Outlook + Google (calendário/email)** | OAuth; sync reuniões | criar/atualizar/cancelar evento; enviar email | MSAL / Graph / googleapis; OAuth por conta | — (OAuth callback) | calendar-sync-retry 10min | outlook-reuniao-sync 15min | reunioes (305), email_contas (8), emails (5.113) | **HISTÓRICO/PARCIAL** — email até 23/09 01:07; reuniões futuras agendadas. Trava calendario-provider testada | HISTÓRICO |
| **Callface AI (banco SaaS RO)** | leitura read-only do banco externo | — | CALLFACE_AI_DATABASE_URL | — | — | callface-ai-sync 6h (falha silenciosa se túnel down) | callface_ai_* (**TODAS 0 linhas**) | **NÃO PROVADO** — fundação (0086) nunca recebeu dado; job roda vazio | NÃO PROVADO |
| **Documenso (assinatura)** | — | criar documento p/ assinatura | DOCUMENSO_API_TOKEN, webhook secret; stack local em infra/ | `/api/webhooks/documenso` (fail-closed) | — | — | contratos.signature_* (**100% NULL em 745**) | **NÃO PROVADO** — nenhum contrato com signature_provider; ZohoSign histórico perdido (158) | NÃO PROVADO |
| **Apollo (prospecção)** | busca/import | enriquecimento | APOLLO_API_KEY, webhook secret | `/api/apollo/webhook` | — | fila enrichment | (buscas_salvas 0) | **NÃO PROVADO** localmente; código real; `/prospeccao/apollo` API morta no :3100 | NÃO PROVADO |
| **RD Station** | webhook lead + OAuth criativo | — | RD_CLIENT/SECRET/REFRESH, webhook secret | `/api/webhooks/rd-lead` (fail-closed) | — | rd-criativo-sync 6h | (via leads) | HISTÓRICO (leads com origem RD) | HISTÓRICO |
| **Storage (S3/R2/disco)** | upload | download por token | STORAGE_* (S3) OU disco local | — | checksum/dedupe no acervo | — | file_objects/file_links (0), anexos_legado (1.980) | **RUNTIME em disco local**; adaptador S3 NÃO EXISTE (código) | RUNTIME (disco) |

## Failure modes observados / registrados
- **Zero observabilidade** (`integracao_sync_estado` vazia): impossível saber pelo dado se uma integração está atrasada/quebrada sem inspecionar tabela por tabela.
- **Stripe**: 1 evento travado 9 dias sem retry; duplicação de contratos por subscription infla MRR.
- **WhatsApp**: re-sync com janela diferente destrói histórico (12.739 mensagens).
- **Callface AI e Documenso**: infra pronta, zero dado — integrações declaradas mas não comprovadas em uso.
- **Webhooks fail-closed** (503 sem segredo) — comportamento correto, com teste (`webhooks-fail-closed.test.ts`).

## Jornadas que dependem de cada integração
- Meta/RD/Apollo → Aquisição (jornada 1). Stripe → Aceite→Pagamento→Won (6,7) + Churn (15). WhatsApp/Callface/Microsoft/Google → Atendimento e Agenda. Documenso → Assinatura (elo perdido). Callface AI → carteira/uso (não comprovado).
