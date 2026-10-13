/**
 * Reprocessa eventos do inbox de webhooks do Stripe. Reprocessar é idempotente.
 *
 *   # lista o que seria reprocessado (PADRÃO, não altera nada)
 *   npx tsx --env-file=.env src/scripts/reprocessar-eventos-stripe.ts --evento evt_1UFeRNEd4dqxpSBfIFt2GQ03
 *   npx tsx --env-file=.env src/scripts/reprocessar-eventos-stripe.ts --status failed,pending --tipo invoice.paid
 *
 *   # processa de verdade, aqui mesmo (sem Redis)
 *   npx tsx --env-file=.env src/scripts/reprocessar-eventos-stripe.ts --evento evt_... --aplicar
 *
 *   # em vez de processar aqui, enfileira para o worker
 *   npx tsx --env-file=.env src/scripts/reprocessar-eventos-stripe.ts --status failed --aplicar --fila
 *
 * Opções: --limite N (padrão 50). O processamento chama o Stripe em leitura (sync) e escreve no banco do .env.
 */
import { reprocessarSelecionados, selecionarEventos } from "@/lib/integrations/stripe-webhook-inbox-db";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const tem = (n: string) => process.argv.includes(`--${n}`);

async function main() {
  const eventId = arg("evento") ?? null;
  const status = arg("status")?.split(",").map((s) => s.trim()).filter(Boolean) ?? (eventId ? undefined : ["failed", "pending"]);
  const tipos = arg("tipo")?.split(",").map((s) => s.trim()).filter(Boolean);
  const rows = await selecionarEventos({ eventId, status, tipos, limite: Number(arg("limite")) || 50 });
  console.log(`${rows.length} evento(s) selecionado(s):`);
  for (const r of rows) console.log(`  ${r.eventId}  ${r.eventType.padEnd(36)} ${String(r.status).padEnd(10)} tentativas=${r.attempts} recebido=${r.receivedAt.toISOString()}${r.lastError ? `  erro="${r.lastError.slice(0, 80)}"` : ""}`);
  if (!tem("aplicar")) { console.log("\n(simulação: nada foi alterado. Acrescente --aplicar para reprocessar.)"); return; }
  const out = await reprocessarSelecionados(rows, { modo: tem("fila") ? "fila" : "inline" });
  for (const o of out) console.log(`  -> ${o.eventId} ${o.tipo}: ${o.resultado}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => {
  try { const { fecharFilas } = await import("@/lib/queue"); await fecharFilas(); } catch { /* sem fila aberta */ }
  process.exit(process.exitCode ?? 0);
});
