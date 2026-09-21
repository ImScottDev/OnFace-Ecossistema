/** Cria uma única implantação White Label fictícia para revisão visual local. */
import { db } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";
import { empresas, leads, negocios, organizacoes, propostaItens, propostas, usuarios } from "@/lib/db/schema";
import { criarPosVendaDoNegocio } from "@/lib/crm/pos-venda";

const TAG = "[TESTE WL]";

async function main() {
  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  if (!org) throw new Error("Nenhuma organização local encontrada");
  const [responsavel] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.organizacaoId, org.id)).limit(1);
  const [empresa] = await db.insert(empresas).values({ organizacaoId: org.id, nome: `${TAG} Agência Aurora`, website: "https://aurora.exemplo.invalid" }).returning({ id: empresas.id });
  const [lead] = await db.insert(leads).values({ organizacaoId: org.id, empresaId: empresa.id, empresa: `${TAG} Agência Aurora`, nome: `${TAG} Marina Costa`, email: "marina@aurora.exemplo.invalid", telefone: "11999990000", cargo: "Diretora de Operações", status: "novo" }).returning({ id: leads.id });
  const [negocio] = await db.insert(negocios).values({ organizacaoId: org.id, empresaId: empresa.id, leadId: lead.id, responsavelId: responsavel?.id ?? null, titulo: `${TAG} Agência Aurora — White Label`, status: "ganho", ganhoAt: new Date(), valorTotal: "5000.00", tipoReceita: "recorrente" }).returning({ id: negocios.id });
  const [{ numero }] = await db.select({ numero: sql<number>`coalesce(max(${propostas.numero}), 900000) + 1` }).from(propostas).where(and(eq(propostas.organizacaoId, org.id), sql`${propostas.numero} >= 900000`));
  const [proposta] = await db.insert(propostas).values({ organizacaoId: org.id, leadId: lead.id, negocioId: negocio.id, numero, status: "aceita", totalGeral: "5000.00" }).returning({ id: propostas.id });
  await db.insert(propostaItens).values([
    { propostaId: proposta.id, nome: "White Label - Callface AI (Licença)", tipo: "recorrente", subtotal: "3000.00", valorUnitario: "3000.00", ordem: 0 },
    { propostaId: proposta.id, nome: "Setup White Label", tipo: "avulso", subtotal: "2000.00", valorUnitario: "2000.00", ordem: 1 },
  ]);
  const resultado = await criarPosVendaDoNegocio(negocio.id, { ignorarFlag: true });
  if (!resultado.criado || !resultado.fulfillmentId) throw new Error(resultado.motivo || "A implantação de teste não foi criada");
  console.log(JSON.stringify({ fulfillmentId: resultado.fulfillmentId, empresa: `${TAG} Agência Aurora`, rota: `/pos-venda/entrega/${resultado.fulfillmentId}` }));
}

main().catch((erro) => { console.error(erro); process.exit(1); });
