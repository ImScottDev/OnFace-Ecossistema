# Auditoria Stripe x CRM (read-only) — Etapa D reconciliação semântica

Data da auditoria: 2026-08-12. Fonte: API Stripe produção (somente GET) + banco `callface_crm` produção (transações READ ONLY).

## 1. Totais gerais (Stripe)

- Customers: **311**
- Subscriptions: **286**, por status:
  - active: 133
  - past_due: 13
  - canceled: 99
  - incomplete: 2
  - incomplete_expired: 29
  - unpaid: 10
  - trialing: 0
- Products: **52**
- Prices ativos: **51**

MRR ativo total (soma dos itens das subscriptions `active`, calculado a partir de `unit_amount * quantity`, sem normalizar por intervalo): **R$ 52.845,95** em 133 subscriptions.

## 2. Subscriptions Stripe SEM vínculo no CRM

20 subscriptions cujo ID não aparece em `assinaturas.stripe_subscription_id` nem `contratos.stripe_subscription_id`:

| status | qtde |
|---|---|
| active | 15 |
| incomplete | 1 |
| incomplete_expired | 1 |
| canceled | 1 |
| unpaid | 1 |
| past_due | 1 |

**Ponto de atenção real:** 15 subscriptions **ativas** (cobrando de verdade) somam **R$ 7.854,85/mês** em MRR sem nenhum registro correspondente em `assinaturas` ou `contratos` no CRM. Produtos envolvidos: "Callface Copilot", "Callface AI - Starter", "SETUP BROKER IA". Lista completa com customer_id no CSV (`tipo_de_gap = sub_stripe_sem_vinculo_crm`).

## 3. Contratos/Assinaturas do CRM com stripe_subscription_id que NÃO existe mais no Stripe

**0 casos.** Todo `stripe_subscription_id` gravado em `assinaturas` ou `contratos` foi encontrado na listagem `status=all` do Stripe. Não há subscription "fantasma" no CRM.

## 4. Metadata `crm_*` nas subscriptions ativas

- Subscriptions ativas com metadata contendo algum campo `crm_*` (ex: `crm_lead_id`): **0**
- Subscriptions ativas sem nenhum vínculo por metadata: **133 (100%)**

Confirma o gap esperado: a integração hoje não grava metadata Stripe apontando de volta pro CRM. O vínculo Stripe↔CRM depende inteiramente de `stripe_subscription_id` guardado nas tabelas locais, não de metadata no lado Stripe. Não é erro de sync, é ausência de prática (nenhuma subscription, nova ou antiga, tem isso).

## 5. Gap de identidade (email do Customer/payer vs leads do CRM) — reportado, não é conclusão de identidade

- Customers Stripe sem email cadastrado: **0**
- Customers Stripe cujo email **não bate com nenhum email de lead no CRM**: **28** de 311 (~9%)
- Subscriptions (qualquer status) cujo customer tem esse gap de email: **20**

Isso é reportado como gap de dado, não como churn nem como "cliente não existe" — quem pagou pode legitimamente ser diferente de quem negociou (financeiro da empresa, sócio, etc.). Não tirar conclusão de identidade automaticamente daqui.

## 6. Status financeiro vs churn comercial

- **past_due**: 13 subscriptions, R$ 4.033,60/mês em risco. Isso é problema de cobrança (cartão recusado, boleto vencido etc.), **não é churn comercial** — o cliente pode estar ativo e só com falha de pagamento. IDs completos no CSV.
- **canceled**: 99 subscriptions — esse sim é o status que representa saída efetiva (ainda assim, motivo real está em `cancellation_details`/`motivo_cancelamento`, não auditado aqui em detalhe pois é fora do escopo desta etapa).
- **incomplete_expired** (29) e **unpaid** (10): também não tratados como churn aqui — são estados técnicos de billing, merecem checagem separada antes de qualquer decisão comercial.

## Arquivos gerados

- `stripe-reconciliation.csv` — uma linha por subscription (as 286 do Stripe + as, se houvesse, dangling do CRM — nenhuma dangling encontrada), com `vinculo_crm_encontrado`, `contrato_ou_assinatura_id` e `tipo_de_gap`.
- Dados brutos ficam em `raw/` (customers.json, subscriptions.json, products.json, prices_active.json, exports do banco) — apenas para conferência desta sessão, sem a chave Stripe em nenhum arquivo.

## Nenhuma escrita foi feita

Somente GET na API Stripe e transações `BEGIN READ ONLY ... COMMIT` no Postgres de produção. Nenhum objeto Stripe foi criado, alterado, cancelado ou deletado. Nenhuma correção foi implementada.
