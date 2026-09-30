/**
 * Prova controlada de uma sandbox Stripe para o ONFACE.
 *
 * Cria somente objetos identificados pelo prefixo ONFACE-SANDBOX-SMOKE e
 * exercita produto/preco, cliente, Checkout, subscription e ajuste de
 * quantidade. Nao roda sem confirmacao explicita e recusa qualquer chave live.
 * O webhook deve estar apontado para DEV antes da execucao para que os eventos
 * customer.subscription.* sejam recebidos pelo CRM.
 *
 * Uso (em runner DEV efemero):
 *   STRIPE_SANDBOX_SMOKE_CONFIRM=YES pnpm --filter ./app exec tsx \
 *     --env-file=.env src/scripts/smoke-stripe-sandbox.ts
 */

const API = "https://api.stripe.com/v1";
const PREFIX = "ONFACE-SANDBOX-SMOKE";

function requireSandboxKey(): string {
  if (process.env.STRIPE_SANDBOX_SMOKE_CONFIRM !== "YES") {
    throw new Error("Recusado: defina STRIPE_SANDBOX_SMOKE_CONFIRM=YES para criar objetos na sandbox.");
  }
  const key = process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET_KEY;
  if (!key || !key.includes("_test_")) {
    throw new Error("Recusado: este ensaio exige uma chave Stripe test (rk_test_ ou sk_test_).");
  }
  return key;
}

async function request<T>(key: string, path: string, form?: URLSearchParams, method: "GET" | "POST" | "DELETE" = form ? "POST" : "GET"): Promise<T> {
  const response = await fetch(`${API}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form?.toString(),
  });
  if (!response.ok) throw new Error(`Stripe ${path}: HTTP ${response.status} ${(await response.text()).slice(0, 500)}`);
  return response.json() as Promise<T>;
}

function form(values: Record<string, string | number | undefined>): URLSearchParams {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined) result.append(key, String(value));
  return result;
}

async function main(): Promise<void> {
  const key = requireSandboxKey();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const label = `${PREFIX}-${suffix}`;

  const product = await request<{ id: string }>(key, "products", form({ name: label, "metadata[onface_smoke]": "true" }));
  const price = await request<{ id: string }>(key, "prices", form({
    product: product.id,
    currency: "brl",
    unit_amount: 1000,
    "recurring[interval]": "month",
    "metadata[onface_smoke]": "true",
  }));
  const customer = await request<{ id: string }>(key, "customers", form({
    name: label,
    email: `onface-sandbox-${suffix}@example.test`,
    "metadata[onface_smoke]": "true",
  }));

  const checkout = await request<{ id: string; url: string | null }>(key, "checkout/sessions", form({
    mode: "subscription",
    customer: customer.id,
    "line_items[0][price]": price.id,
    "line_items[0][quantity]": 1,
    success_url: "https://dev.crm.callface.io/financeiro?stripe_sandbox=success",
    cancel_url: "https://dev.crm.callface.io/financeiro?stripe_sandbox=cancelled",
    "metadata[onface_smoke]": "true",
  }));

  const subscription = await request<{
    id: string;
    items: { data: Array<{ id: string; quantity: number | null }> };
  }>(key, "subscriptions", form({
    customer: customer.id,
    "items[0][price]": price.id,
    payment_behavior: "default_incomplete",
    proration_behavior: "none",
    "metadata[onface_smoke]": "true",
  }));
  const subscriptionItem = subscription.items.data[0];
  if (!subscriptionItem?.id) throw new Error("Stripe criou subscription sem subscription item.");

  const updated = await request<{ items: { data: Array<{ id: string; quantity: number | null }> } }>(key, `subscriptions/${subscription.id}`, form({
    "items[0][id]": subscriptionItem.id,
    "items[0][quantity]": 2,
    proration_behavior: "none",
    "metadata[onface_smoke]": "true",
  }));
  if (updated.items.data.find((item) => item.id === subscriptionItem.id)?.quantity !== 2) {
    throw new Error("A atualizacao de quantidade da assinatura nao foi confirmada pela Stripe.");
  }

  await request(key, `subscriptions/${subscription.id}`, undefined, "DELETE");
  await request(key, `checkout/sessions/${checkout.id}/expire`, new URLSearchParams());
  await request(key, `products/${product.id}`, form({ active: "false" }));

  console.log(JSON.stringify({
    ok: true,
    productId: product.id,
    priceId: price.id,
    customerId: customer.id,
    checkoutSessionId: checkout.id,
    checkoutUrl: checkout.url,
    subscriptionId: subscription.id,
    subscriptionItemId: subscriptionItem.id,
    checked: ["catalog", "customer", "checkout", "subscription_quantity_update", "cleanup"],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
