/**
 * Diagnóstico das empresas com MAIS DE UM Customer no Stripe.
 *
 * Por empresa: lista os Customers (de onde veio a ligação, assinaturas vivas), e
 * o canônico proposto (assinatura viva → o que a empresa já aponta → o mais
 * antigo). NÃO mescla nada no Stripe: merge de Customer é decisão humana.
 *
 * Com `--aplicar`, e SÓ quando a escolha é inequívoca (um único Customer com
 * assinatura viva; ou nenhum vivo e a empresa já aponta para um só), grava no
 * ONFACE: `empresas.stripe_customer_id` = canônico e os outros em
 * `billing_customer_aliases`. Nunca escreve no Stripe, nem com --aplicar.
 *
 * Uso (da pasta app/):
 *   npx tsx --env-file=.env src/scripts/stripe-diagnostico-customers.ts [--simular] [--max=50] [--json=/caminho.json]
 */
import { writeFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingCustomerAliases, billingIdentities } from "@/lib/db/schema";
import { registrarVinculoCustomer, type CustomerStripe } from "@/lib/integrations/stripe-customer";
import { carregarBaseOnface, diagnosticarCustomers, listarTudo, type AssinaturaDoStripe } from "@/lib/integrations/stripe-saneamento";

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
if (aplicar && args.includes("--simular")) { console.error("Use --simular OU --aplicar, não os dois."); process.exit(2); }
const max = Number(args.find((a) => a.startsWith("--max="))?.slice(6) ?? 60);
const caminhoJson = args.find((a) => a.startsWith("--json="))?.slice(7);

async function main() {
  console.log(aplicar ? "MODO: APLICAR (grava só no ONFACE)" : "MODO: SIMULAR (nada é escrito)");
  const [customers, assinaturas, base] = await Promise.all([
    listarTudo<CustomerStripe>("customers"),
    listarTudo<AssinaturaDoStripe>("subscriptions", "&status=all"),
    carregarBaseOnface(),
  ]);
  const diag = diagnosticarCustomers({ customers, assinaturas, base });
  const comVivas = diag.filter((d) => d.candidatos.some((c) => (c.assinaturasVivas ?? 0) > 0));
  const muitasVivas = diag.filter((d) => d.candidatos.filter((c) => (c.assinaturasVivas ?? 0) > 0).length > 1);
  const inequivocos = diag.filter((d) => d.inequivoco);

  console.log(`Stripe: ${customers.length} customers, ${assinaturas.length} assinaturas.`);
  console.log(`\nEmpresas com mais de um Customer: ${diag.length}`);
  console.log(`  com assinatura viva em algum deles: ${comVivas.length}`);
  console.log(`  com assinatura viva em MAIS DE UM (decisão humana): ${muitasVivas.length}`);
  console.log(`  canônico inequívoco (gravável com --aplicar): ${inequivocos.length}`);
  console.log(`  decisão humana: ${diag.length - inequivocos.length}`);
  console.log(`  em que a empresa hoje aponta para um Customer que NÃO é o proposto: ${diag.filter((d) => d.canonicoProposto && d.apontaHoje !== d.canonicoProposto).length}`);

  for (const d of diag.slice(0, max)) {
    console.log(`\n- ${d.nome} [${d.empresaId}] aponta hoje: ${d.apontaHoje ?? "(nada)"}`);
    for (const c of d.candidatos) {
      const marca = c.id === d.canonicoProposto ? "*" : " ";
      console.log(`   ${marca} ${c.id} vivas=${c.assinaturasVivas} total=${c.assinaturasTotal} ${c.vinculadoNaEmpresa ? "[vinculado] " : ""}${c.ausenteNoStripe ? "[ausente no Stripe] " : ""}${c.contaminadoPeloSaas ? "[assinatura do SaaS] " : ""}fontes=${c.fontes.join("|")}`);
    }
    console.log(`   => ${d.inequivoco ? "INEQUÍVOCO" : "HUMANO"}: ${d.motivo}`);
  }
  if (diag.length > max) console.log(`\n... mais ${diag.length - max} (use --max=N ou --json=)`);
  if (caminhoJson) { writeFileSync(caminhoJson, JSON.stringify(diag, null, 2)); console.log("Relatório:", caminhoJson); }

  if (!aplicar) { console.log("\nSIMULAÇÃO: nada foi escrito."); return; }

  let gravados = 0, aliases = 0;
  for (const d of inequivocos) {
    if (!d.canonicoProposto) continue;
    await registrarVinculoCustomer({ organizacaoId: d.organizacaoId, empresaId: d.empresaId, customerId: d.canonicoProposto, metodo: "empresa" });
    gravados++;
    const [identidade] = await db.select({ id: billingIdentities.id }).from(billingIdentities)
      .where(and(eq(billingIdentities.organizacaoId, d.organizacaoId), sql`upper(${billingIdentities.provider}) = 'STRIPE'`, eq(billingIdentities.externalCustomerId, d.canonicoProposto)))
      .limit(1);
    if (!identidade) continue;
    for (const c of d.candidatos) {
      if (c.id === d.canonicoProposto) continue;
      const r = await db.insert(billingCustomerAliases).values({
        billingIdentityId: identidade.id, stripeCustomerId: c.id, isCanonical: false,
        resolutionSource: "diagnostico-customers-duplicados",
        evidence: { canonico: d.canonicoProposto, motivo: d.motivo, fontes: c.fontes, em: new Date().toISOString() },
      }).onConflictDoNothing().returning({ id: billingCustomerAliases.id });
      aliases += r.length;
    }
  }
  console.log(`\nAplicado no ONFACE: ${gravados} empresas apontadas ao canônico, ${aliases} aliases novos. Nada foi escrito no Stripe.`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
