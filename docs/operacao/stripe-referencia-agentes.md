# Stripe — referência pra agentes (Claude Code)

> Colado pelo Kauã em 02/09/2026 (índice de documentação da Stripe voltado
> pra agentes de IA — não é credencial de acesso, é referência de boas
> práticas). Truncado pelo client em ~50.000 caracteres na cola original;
> se precisar de uma seção que não está aqui, buscar direto em
> `https://docs.stripe.com/<caminho>.md` (todo link do índice abaixo aceita
> `.md` no fim pra vir em Markdown puro).
>
> **Isto NÃO dá acesso à API/conta Stripe real** — é só documentação. Pra
> operações reais (criar produto, ler catálogo ao vivo) ainda precisa de
> credencial/MCP configurado na sessão (ver
> [[crm2-decisoes-pendentes]] item A12 no vault).

Quando instalar pacotes Stripe, sempre checar a versão mais recente no
registro (`npm view stripe version` ou https://www.npmjs.com/package/stripe
pra Node; https://pypi.org/project/stripe/ pra Python) em vez de confiar em
número de versão memorizado. Nunca hardcodar uma versão antiga vinda de
treino — instalar com `@latest` ou verificar a versão atual primeiro.

## Docs

- [Testing](https://docs.stripe.com/testing.md): Simulate payments to test your integration.
- [API Reference](https://docs.stripe.com/api.md)
- [Receive payouts](https://docs.stripe.com/payouts.md): Set up your bank account to receive payouts.
- [Platforms and marketplaces with Stripe Connect](https://docs.stripe.com/connect.md): Build a SaaS platform or marketplace with Connect.
- [Supported currencies](https://docs.stripe.com/currencies.md): Learn which currencies Stripe supports for payments and bank payouts.
- [API upgrades](https://docs.stripe.com/upgrades.md): Learn how to manage API versions and handle breaking changes in major releases.
- [Stripe Directory](https://docs.stripe.com/directory.md): Stripe Directory helps agents find the best external providers for a task and follow the best supported path to provision or use them.
- [Stripe Projects CLI](https://docs.stripe.com/projects.md): Stripe Projects is a CLI for provisioning software stacks.
- [Stripe SDKs](https://docs.stripe.com/sdks.md): Libraries and tools for interacting with your Stripe integration.
- [Receive Stripe events in your webhook endpoint](https://docs.stripe.com/webhooks.md): Listen for events from Stripe on your webhook endpoint so your integration can automatically trigger reactions.
- [Declines](https://docs.stripe.com/declines.md): Learn about payment declines and how to lower your decline rate.
- [Refund and cancel payments](https://docs.stripe.com/refunds.md): Learn how to cancel or refund a payment.
- [Security at Stripe](https://docs.stripe.com/security.md): Learn how Stripe handles security.
- [Build a Stripe-hosted checkout page](https://docs.stripe.com/checkout/quickstart.md)
- [Build a custom checkout page](https://docs.stripe.com/payments/quickstart.md)
- [Build a pre-built subscription page with Stripe Checkout](https://docs.stripe.com/billing/quickstart.md)
- [Set up and deploy a webhook](https://docs.stripe.com/webhooks/quickstart.md): Learn how to set up and deploy a webhook to listen to events from Stripe.
- [Types of events](https://docs.stripe.com/api/events/types.md)
- [Integration security guide](https://docs.stripe.com/security/guide.md): Ensure PCI compliance and secure customer-server communications.
- [Payments analytics](https://docs.stripe.com/payments/analytics.md): Learn about the performance of your payments using key metrics and reports.
- [Integrate with events](https://docs.stripe.com/event-destinations.md): Send events from Stripe to webhook endpoints and cloud services.
- [Resolve webhook signature verification errors](https://docs.stripe.com/webhooks/signature.md): Learn how to fix a common error when listening to webhook events.
- [Start a team](https://docs.stripe.com/get-started/account/teams.md): Learn how to invite and interact with team members.
- [Errors](https://docs.stripe.com/api/errors.md)
- [Versioning](https://docs.stripe.com/api/versioning.md)

## Payment Methods

- [Payment Methods API](https://docs.stripe.com/payments/payment-methods.md)
- [Linked external accounts](https://docs.stripe.com/get-started/account/linked-external-accounts.md)
- [Bank Debits](https://docs.stripe.com/payments/bank-debits.md)
- [How cards work](https://docs.stripe.com/payments/cards/overview.md)
- [Cartes Bancaires (CB)](https://docs.stripe.com/payments/cartes-bancaires.md)
- [eftpos Australia](https://docs.stripe.com/payments/eftpos-australia.md)
- [Stablecoin payments](https://docs.stripe.com/payments/stablecoin-payments.md)
- [Buy now, pay later](https://docs.stripe.com/payments/buy-now-pay-later.md)
- [Afterpay and Clearpay payments](https://docs.stripe.com/payments/afterpay-clearpay.md)
- [Affirm payments](https://docs.stripe.com/payments/affirm.md)
- [Klarna payments](https://docs.stripe.com/payments/klarna.md)
- [Bank redirects](https://docs.stripe.com/payments/bank-redirects.md)
- [Bank transfer payments](https://docs.stripe.com/payments/bank-transfers.md)
- [Real-time payments](https://docs.stripe.com/payments/real-time.md)
- [Vouchers](https://docs.stripe.com/payments/vouchers.md)
- [Wallets](https://docs.stripe.com/payments/wallets.md)
- [Regions with special payment method requirements](https://docs.stripe.com/payments/local-markets.md)
- [Custom payment methods](https://docs.stripe.com/payments/payment-methods/custom-payment-methods.md)
- [Orchestration](https://docs.stripe.com/payments/orchestration.md)

## Checkout

- [Build a payments page](https://docs.stripe.com/payments/checkout.md)
- [Build a Stripe-hosted checkout page](https://docs.stripe.com/checkout/quickstart.md)
- [Embed a checkout page in your site](https://docs.stripe.com/checkout/embedded/quickstart.md)
- [How Checkout works](https://docs.stripe.com/payments/checkout/how-checkout-works.md)
- [Customize Checkout](https://docs.stripe.com/payments/checkout/customization.md)
- [The Setup Intents API](https://docs.stripe.com/payments/setup-intents.md)
- [Fulfill orders](https://docs.stripe.com/checkout/fulfillment.md)
- [Customize redirect behavior](https://docs.stripe.com/payments/checkout/custom-success-page.md)
- [Add discounts](https://docs.stripe.com/payments/checkout/discounts.md)
- [Use your custom domain](https://docs.stripe.com/payments/checkout/custom-domains.md)
- [Limit customers to one subscription](https://docs.stripe.com/payments/checkout/limit-subscriptions.md)
- [Cross-sells](https://docs.stripe.com/payments/checkout/cross-sells.md)
- [Overview — Products and Prices](https://docs.stripe.com/products-prices/overview.md): Model your business on Stripe with products and prices.
- [Subscriptions with Checkout Sessions](https://docs.stripe.com/payments/subscriptions.md)
- [Charge for shipping](https://docs.stripe.com/payments/during-payment/charge-shipping.md)
- [Collect taxes](https://docs.stripe.com/payments/checkout/taxes.md)
- [Manage payment methods](https://docs.stripe.com/payments/checkout/payment-methods.md)
- [Extend checkout with custom components](https://docs.stripe.com/payments/checkout/custom-components.md)
- [Collect physical addresses](https://docs.stripe.com/payments/collect-addresses.md)
- [Customize card brands](https://docs.stripe.com/payments/checkout/customization/card-brands.md)
- [Save payment details during payment](https://docs.stripe.com/payments/checkout/save-during-payment.md)
- [After the payment](https://docs.stripe.com/payments/checkout/after-the-payment.md)
- [Set the billing cycle date](https://docs.stripe.com/payments/checkout/billing-cycle.md)
- [Let customers decide what to pay](https://docs.stripe.com/payments/checkout/pay-what-you-want.md)
- [Subscription upsells](https://docs.stripe.com/payments/checkout/upsells.md)
- [No-cost orders](https://docs.stripe.com/payments/checkout/no-cost-orders.md)
- [Analyze your conversion funnel](https://docs.stripe.com/payments/checkout/analyze-conversion-funnel.md)
- [Add discounts, upsells, and optional items](https://docs.stripe.com/payments/checkout/promotions.md)
- [Manual currency prices](https://docs.stripe.com/payments/checkout/localize-prices/manual-currency-prices.md)
- [Collect customer phone numbers](https://docs.stripe.com/payments/checkout/phone-numbers.md)
- [Dynamically customize shipping options](https://docs.stripe.com/payments/checkout/custom-shipping-options.md)
- [One-time payments with Checkout](https://docs.stripe.com/payments/checkout/client.md)
- [Set up future payments](https://docs.stripe.com/payments/checkout/save-and-reuse.md)
- [Make line item quantities adjustable](https://docs.stripe.com/payments/checkout/adjustable-quantity.md)
- [Checkout prices migration guide](https://docs.stripe.com/payments/checkout/migrating-prices.md)
- [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions.md)
- [The Checkout Session object](https://docs.stripe.com/api/checkout/sessions/object.md)
- [Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create.md)

## Payments

- [Accept a payment](https://docs.stripe.com/payments/accept-a-payment.md)
- [The Payment Intents API](https://docs.stripe.com/payments/payment-intents.md)
- [Multi-currency settlement](https://docs.stripe.com/payouts/multi-currency-settlement.md)
- [Stripe decline codes](https://docs.stripe.com/declines/codes.md)
- [Place a hold on a payment method](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method.md)
- [Save a customer's payment method when they use it for a payment](https://docs.stripe.com/payments/save-during-payment.md)
- [Save a customer's payment method without making a payment](https://docs.stripe.com/payments/save-and-reuse.md)
- [Payment status updates](https://docs.stripe.com/payments/payment-intents/verifying-status.md)
- [Payment method integration options](https://docs.stripe.com/payments/payment-methods/integration-options.md)
- [Create an embeddable buy button](https://docs.stripe.com/payment-links/buy-button.md)
- [After a payment link payment](https://docs.stripe.com/payment-links/post-payment.md)
- [Share a payment link](https://docs.stripe.com/payment-links/share.md)
- [Payment Intents](https://docs.stripe.com/api/payment_intents.md)
- [The PaymentIntent object](https://docs.stripe.com/api/payment_intents/object.md)
- [Create a PaymentIntent](https://docs.stripe.com/api/payment_intents/create.md)
- [Payment Methods](https://docs.stripe.com/api/payment_methods.md)
- [The PaymentMethod object](https://docs.stripe.com/api/payment_methods/object.md)
- [Create a PaymentMethod](https://docs.stripe.com/api/payment_methods/create.md)

## Billing (o que mais importa pro CRM Callface)

- [Recurring pricing models](https://docs.stripe.com/products-prices/pricing-models.md)
- [Build a pre-built subscription page with Stripe Checkout](https://docs.stripe.com/billing/quickstart.md)
- [Coupons and promotion codes](https://docs.stripe.com/billing/subscriptions/coupons.md)
- [Cancel subscriptions](https://docs.stripe.com/billing/subscriptions/cancel.md)
- [Set the subscription billing renewal date](https://docs.stripe.com/billing/subscriptions/billing-cycle.md)
- [Embeddable pricing table for subscriptions](https://docs.stripe.com/payments/checkout/pricing-table.md)
- [Change the price of existing subscriptions](https://docs.stripe.com/billing/subscriptions/change-price.md)
- [Create subscriptions](https://docs.stripe.com/no-code/subscriptions.md)
- [Modify subscriptions](https://docs.stripe.com/billing/subscriptions/change.md)
- [Customer Tax IDs](https://docs.stripe.com/billing/customer/tax-ids.md)
- [Set up a pay-as-you-go pricing model](https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide.md)
- [Entitlements](https://docs.stripe.com/billing/entitlements.md)
- [Set payment methods per-subscription](https://docs.stripe.com/billing/subscriptions/payment-methods-setting.md)
- [Customers](https://docs.stripe.com/billing/customer.md)
- [Subscription use cases](https://docs.stripe.com/billing/subscriptions/use-cases.md)
- [Integrate a SaaS business on Stripe](https://docs.stripe.com/saas.md)
- [Record usage for billing](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage.md)
- [Design a subscriptions integration](https://docs.stripe.com/billing/subscriptions/design-an-integration.md)
- [Pause payment collection](https://docs.stripe.com/billing/subscriptions/pause-payment.md)
- [Tax rates](https://docs.stripe.com/tax/tax-rates.md)
- [Migrate subscriptions to Stripe Billing](https://docs.stripe.com/billing/subscriptions/migrate-subscriptions.md)
- [Set product or subscription quantities](https://docs.stripe.com/billing/subscriptions/quantities.md) — relevante pro caso de licença White Label (quantidade = assentos)
- [Migrate subscriptions to Stripe Billing using toolkit](https://docs.stripe.com/billing/subscriptions/import-subscriptions-toolkit.md)
- [About the Billing APIs](https://docs.stripe.com/billing/billing-apis.md)
- [Subscriptions](https://docs.stripe.com/api/subscriptions.md)
- [The Subscription object](https://docs.stripe.com/api/subscriptions/object.md)
- [Create a subscription](https://docs.stripe.com/api/subscriptions/create.md)
- [Customers](https://docs.stripe.com/api/customers.md)

## Architecture and Dashboard

- [Set up your development environment](https://docs.stripe.com/get-started/development-environment.md)
- [Web Dashboard](https://docs.stripe.com/dashboard/basics.md)
- [Tour of the API](https://docs.stripe.com/payments-api/tour.md)
- [Go-live checklist](https://docs.stripe.com/get-started/checklist/go-live.md)
- [Build and test new features](https://docs.stripe.com/get-started/test-developer-integration.md)
- [Perform searches in the Dashboard](https://docs.stripe.com/dashboard/search.md)

## Elements

- [Address Element](https://docs.stripe.com/elements/address-element.md)
- [Contact Details Element](https://docs.stripe.com/payments/elements/contact-details-element.md)
- [Migrate to Confirmation Tokens](https://docs.stripe.com/payments/payment-element/migration-ct.md)
- [Control billing details collection](https://docs.stripe.com/payments/payment-element/control-billing-details-collection.md)

## Connect / Issuing / Capital

Não relevantes hoje pro Callface CRM (não é plataforma multi-merchant nem
emite cartão) — índice completo em https://docs.stripe.com/connect.md,
https://docs.stripe.com/issuing.md, https://docs.stripe.com/capital.md se
algum dia entrar em escopo.

## Instruções pra agentes de IA — resumo prático pro Callface

Direto da Stripe, já filtrado pro que se aplica a este projeto (SaaS B2B
com assinatura recorrente + cobrança avulsa, sem Connect/Issuing):

- **Sempre a versão mais recente da API/SDK**, salvo o usuário pedir outra.
- **Backend de pagamento**: priorizar **Checkout Sessions API** — nunca
  recomendar a Charges API (deprecada). Se algo no código ainda usa
  Payment Intents/Charges direto, é candidato a migração, não referência a
  copiar.
- **Frontend**: Payment Element ou Checkout — nunca o legado Card Element.
- **Salvar cartão pra uso futuro**: usar Setup Intent API — nunca a
  Sources API (deprecada).
- **Modelo de negócio recorrente/assinatura** (é o caso do Callface):
  seguir os *Subscription Use Cases*/SaaS guide e desenhar em cima das
  **Billing APIs** (Product/Price/Subscription) combinadas com Checkout —
  não montar cobrança recorrente na mão via Payment Intent solto.
- **Nunca chamar endpoints deprecados**: Sources API, Tokens, Charges —
  só em último caso, sem alternativa nenhuma.
- **Métodos de pagamento**: preferir habilitar métodos dinâmicos no
  Dashboard em vez de fixar `payment_method_types` no código (a Stripe
  escolhe o melhor conjunto por localização/carteira) — **atenção**: o
  código atual (`stripe-checkout.ts`) fixa `payment_method_types`
  explicitamente pra controlar vencimento de boleto customizado (trabalho
  desta mesma sessão, 25/08) — é uma exceção justificada (boleto com prazo
  customizável não é possível via método dinâmico hoje), não um desvio de
  boas práticas por descuido.
- **Quantidade/assentos por subscription**: existe suporte nativo a
  `quantity` em Subscription Items — relevante diretamente pro gap já
  registrado de "White Label licença ativa por assento" (ver
  [[catalogo-produtos-auditoria-2026-08-26]], seção 8) — a tabela
  `assinatura_itens` já existe no schema pra isso, só não está sendo
  lida/escrita pelo `stripe-sync.ts` ainda.
