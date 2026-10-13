/** Cria uma única implantação White Label fictícia para revisão visual local. */
import { db } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";
import { empresas, leads, negocios, organizacoes, propostas, usuarios } from "@/lib/db/schema";
import { gravarLinhasOficiais } from "./_preco-oficial";
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
  // As linhas entram pela porta do produto, cada uma com o Price oficial da família (P1-6).
  await gravarLinhasOficiais({
    organizacaoId: org.id, negocioId: negocio.id, propostaId: proposta.id, familia: "WHITE_LABEL",
    linhas: [
      { nome: "White Label - Callface AI (Licença)", valor: 3000, tipos: ["recorrente"] },
      { nome: "Setup White Label", valor: 2000, tipos: ["setup", "avulso"] },
    ],
  });
  const resultado = await criarPosVendaDoNegocio(negocio.id, { ignorarFlag: true });
  if (!resultado.criado || !resultado.fulfillmentId) throw new Error(resultado.motivo || "A implantação de teste não foi criada");
  console.log(JSON.stringify({ fulfillmentId: resultado.fulfillmentId, empresa: `${TAG} Agência Aurora`, rota: `/pos-venda/entrega/${resultado.fulfillmentId}` }));
}

main().catch((erro) => { console.error(erro); process.exit(1); });
