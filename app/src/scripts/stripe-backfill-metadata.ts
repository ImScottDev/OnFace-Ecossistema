/**
 * Backfill de metadata de identidade nos Customers e assinaturas VIVAS do Stripe
 * ligados a empresas do ONFACE (stripe-onface-definicao §13).
 *
 * Só ADICIONA chave que falta (organizacaoId, empresaId, negocioId e os crm_*);
 * nunca sobrescreve valor existente e nunca remove chave. Pula tudo do SaaS
 * Callface (conta Stripe compartilhada) e objeto que declara outra empresa.
 * Idempotente: rodar de novo, depois de aplicado, dá 0 a atualizar.
 *
 * Uso (da pasta app/):
 *   npx tsx --env-file=.env src/scripts/stripe-backfill-metadata.ts            # simula (padrão)
 *   npx tsx --env-file=.env src/scripts/stripe-backfill-metadata.ts --simular
 *   npx tsx --env-file=.env src/scripts/stripe-backfill-metadata.ts --aplicar  # ESCREVE no Stripe
 *   ... --json=/caminho/relatorio.json
 *
 * Leitura: só GET no Stripe e SELECT no banco. Só `--aplicar` faz POST.
 */
import { writeFileSync } from "node:fs";
import { stripe } from "@/lib/integrations/stripe-assinatura";
import type { CustomerStripe } from "@/lib/integrations/stripe-customer";
import { carregarBaseOnface, listarTudo, planejarBackfill, type AssinaturaDoStripe } from "@/lib/integrations/stripe-saneamento";

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
if (aplicar && args.includes("--simular")) {
  console.error("Use --simular OU --aplicar, não os dois.");
  process.exit(2);
}
const caminhoJson = args.find((a) => a.startsWith("--json="))?.slice("--json=".length);

async function main() {
  console.log(aplicar ? "MODO: APLICAR (escreve no Stripe)" : "MODO: SIMULAR (nada é escrito)");
  const [customers, assinaturas, base] = await Promise.all([
    listarTudo<CustomerStripe>("customers"),
    listarTudo<AssinaturaDoStripe>("subscriptions", "&status=all"),
    carregarBaseOnface(),
  ]);
  console.log(`Stripe: ${customers.length} customers, ${assinaturas.length} assinaturas. ONFACE: ${base.empresas.length} empresas, ${base.vinculos.length} vínculos, ${base.espelho.length} assinaturas no espelho.`);

  const plano = planejarBackfill({ customers, assinaturas, base });
  const porTipo = (t: string) => plano.acoes.filter((a) => a.tipo === t);
  const chaves: Record<string, number> = {};
  for (const a of plano.acoes) for (const k of Object.keys(a.adicionar)) chaves[k] = (chaves[k] ?? 0) + 1;

  console.log(`\nSeriam atualizados: ${porTipo("customer").length} customers e ${porTipo("assinatura").length} assinaturas.`);
  console.log("Chaves a adicionar (quantos objetos):", chaves);
  console.log("Pulados:", plano.pulados);
  console.log("Exemplos:", plano.acoes.slice(0, 3).map((a) => `${a.tipo} ${a.id} +${Object.keys(a.adicionar).join(",")}`));
  if (caminhoJson) { writeFileSync(caminhoJson, JSON.stringify(plano, null, 2)); console.log("Relatório:", caminhoJson); }

  if (!aplicar) { console.log("\nSIMULAÇÃO: nada foi escrito. Use --aplicar para gravar."); return; }

  let ok = 0, erro = 0;
  for (const a of plano.acoes) {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(a.adicionar)) form.append(`metadata[${k}]`, v.slice(0, 500));
    const chave = Object.keys(a.adicionar).sort().join(",");
    try {
      await stripe(`${a.tipo === "customer" ? "customers" : "subscriptions"}/${encodeURIComponent(a.id)}`, form, `onface-backfill-${a.id}-${chave}`);
      ok++;
    } catch (e) {
      erro++;
      console.error(`falhou ${a.tipo} ${a.id}:`, String(e).slice(0, 200));
    }
  }
  console.log(`\nAplicado: ${ok} ok, ${erro} com erro.`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
