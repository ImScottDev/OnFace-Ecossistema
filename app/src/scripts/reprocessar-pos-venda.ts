/**
 * Reprocessa o pós-venda de UM negócio específico, por ID.
 *
 * Rede de segurança do fluxo inline: se a chamada dentro do Won falhar
 * (banco fora, bug, deploy no meio), o negócio continua ganho e este comando
 * refaz. Ignora a feature flag de propósito — é operação manual, consciente.
 *
 * Uso:
 *   npm run posvenda:reprocessar -- <negocioId>
 *   npm run posvenda:reprocessar -- <negocioId> --dry
 *
 * Não duplica nunca: a função é idempotente. Rodar 10x dá o mesmo resultado.
 */
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { negocios } from "@/lib/db/schema";
import { criarPosVendaDoNegocio, resolverFamiliaDoNegocio, regraDaFamilia } from "@/lib/crm/pos-venda";

async function main() {
  const negocioId = process.argv[2];
  const dry = process.argv.includes("--dry");

  if (!negocioId) {
    console.error("uso: npm run posvenda:reprocessar -- <negocioId> [--dry]");
    process.exit(1);
  }

  const [negocio] = await db
    .select({ id: negocios.id, titulo: negocios.titulo, status: negocios.status, ganhoAt: negocios.ganhoAt })
    .from(negocios)
    .where(eq(negocios.id, negocioId))
    .limit(1);

  if (!negocio) {
    console.error(`negócio ${negocioId} não encontrado`);
    process.exit(1);
  }

  console.log(`negócio : ${negocio.titulo}`);
  console.log(`status  : ${negocio.status}${negocio.ganhoAt ? ` (ganho em ${negocio.ganhoAt.toISOString().slice(0, 10)})` : ""}`);

  const familia = await resolverFamiliaDoNegocio(negocioId);
  const regra = regraDaFamilia(familia);
  console.log(`família : ${familia}`);
  console.log(`trilha  : ${regra.trilhaLabel} (${regra.trilha})`);
  console.log(`checklist: ${regra.checklist.length} itens`);

  if (dry) {
    console.log("\n--dry: nada foi escrito.");
    process.exit(0);
  }

  const r = await criarPosVendaDoNegocio(negocioId, { ignorarFlag: true });

  if (r.criado) {
    console.log(`\n✓ criado`);
    console.log(`  serviço canônico : ${r.servicoCanonicoId}`);
    console.log(`  fulfillment      : ${r.fulfillmentId}`);
    console.log(`  itens            : ${r.itensChecklist}`);
  } else {
    console.log(`\n· nada criado: ${r.motivo}`);
    if (r.fulfillmentId) console.log(`  fulfillment existente: ${r.fulfillmentId}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
