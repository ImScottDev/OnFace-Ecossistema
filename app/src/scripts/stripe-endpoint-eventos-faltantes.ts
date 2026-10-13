/**
 * LISTA os eventos que faltam no endpoint de webhook do Stripe (crm.callface.io). NÃO APLICA NADA.
 * Alterar o endpoint é configuração da conta LIVE (compartilhada com o SaaS Callface) e é do Scott.
 *
 *   npx tsx src/scripts/stripe-endpoint-eventos-faltantes.ts --simular            (padrão)
 *   npx tsx src/scripts/stripe-endpoint-eventos-faltantes.ts --atuais invoice.paid,invoice.updated,...
 *
 * Sem --atuais, assume os 31 eventos conferidos na conta live em 13/10/2026. Se STRIPE_API_KEY estiver
 * no ambiente e --consultar for passado, lê o endpoint (GET /v1/webhook_endpoints, só leitura).
 * `--aplicar` é recusado de propósito.
 */
import { EVENTOS_ESPERADOS, EVENTOS_NOVOS } from "@/lib/integrations/stripe-financeiro";

// O que o endpoint ouve de fato, conferido na conta live em 13/10/2026 11:35 (31 eventos).
// Começou o dia com 20; subiu para 28 às 07:58 e para 31 às 11:35, quando entraram os
// `customer.tax_id.*` (o documento fiscal não vem em `customer.updated`).
const ATUAIS_13_10 = [
  "invoice.paid", "invoice.payment_failed", "invoice.finalized", "invoice.updated", "invoice.voided", "invoice.marked_uncollectible",
  "invoice.created", "invoice.overdue", "invoice.payment_action_required",
  "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused",
  "customer.subscription.resumed", "customer.subscription.pending_update_applied", "customer.subscription.pending_update_expired",
  "customer.subscription.trial_will_end",
  "customer.updated", "customer.tax_id.created", "customer.tax_id.updated", "customer.tax_id.deleted",
  "payment_method.attached", "payment_method.updated", "payment_method.detached",
  "checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed",
  "checkout.session.expired", "charge.refunded", "charge.dispute.created", "charge.dispute.closed",
];

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };

async function main() {
  if (process.argv.includes("--aplicar")) {
    console.error("RECUSADO: este script não altera o endpoint. Aplique no painel do Stripe (Developers > Webhooks) ou peça ao Scott.");
    process.exitCode = 2; return;
  }
  let atuais = arg("atuais")?.split(",").map((s) => s.trim()).filter(Boolean) ?? ATUAIS_13_10;
  let origem = arg("atuais") ? "informados em --atuais" : `lista conferida na conta live em 13/10/2026 (${ATUAIS_13_10.length} eventos)`;
  if (process.argv.includes("--consultar") && process.env.STRIPE_API_KEY) {
    const res = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=100", { headers: { Authorization: `Bearer ${process.env.STRIPE_API_KEY}` } });
    if (!res.ok) throw new Error(`Stripe GET webhook_endpoints: HTTP ${res.status}`);
    const j = (await res.json()) as { data: Array<{ url: string; enabled_events: string[]; api_version: string | null }> };
    const ep = j.data.find((e) => e.url.includes("crm.callface.io/api/webhooks/stripe"));
    if (!ep) throw new Error("endpoint de crm.callface.io não encontrado na conta");
    atuais = ep.enabled_events; origem = `lido do Stripe (api_version do endpoint: ${ep.api_version ?? "da conta"})`;
  }
  const faltam = EVENTOS_ESPERADOS.filter((e) => !atuais.includes(e) && !atuais.includes("*"));
  console.log(`Endpoint https://crm.callface.io/api/webhooks/stripe — ouve ${atuais.length} evento(s) (${origem}).`);
  console.log(`O ONFACE espera ${EVENTOS_ESPERADOS.length}. FALTAM ${faltam.length} (nada foi aplicado):\n`);
  for (const e of faltam) console.log(`  + ${e}${(EVENTOS_NOVOS as readonly string[]).includes(e) ? "" : "   (esperado, mas fora da lista conhecida)"}`);
  console.log("\nPara adicionar: Stripe Dashboard > Developers > Webhooks > endpoint > Update details > Select events.");
  console.log("Atenção: a conta é compartilhada com o SaaS; o ONFACE descarta objetos com metadata organization_id/plan_id/user_id.");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
