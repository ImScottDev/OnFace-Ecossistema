/** Cria UM negócio de teste em Proposta Enviada, pra validar o Won pela tela. */
import { db } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";
import { organizacoes, leads, negocios, propostas, propostaItens, pipelines } from "@/lib/db/schema";

const familia = process.argv[2] || "PABX";
const ITENS: Record<string, { nome: string; v: string }[]> = {
  PABX: [{ nome: "Ramal Yeastar", v: "90.00" }, { nome: "Linha SIP", v: "160.00" }],
  AI: [{ nome: "Callface AI - Plano Full", v: "1400.00" }],
  WL: [{ nome: "White Label - Callface AI (Licença)", v: "3200.00" }],
};

async function main() {
  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  const itens = ITENS[familia] || ITENS.PABX;
  const total = itens.reduce((s, i) => s + parseFloat(i.v), 0);
  const nomePipeline = familia === "PABX" ? "PABX" : "Callface AI";
  const [pipe] = await db.select({ id: pipelines.id }).from(pipelines).where(eq(pipelines.nome, nomePipeline)).limit(1);

  const [lead] = await db.insert(leads).values({
    organizacaoId: org.id, nome: `[TESTE2] Lead ${familia}`, empresa: `[TESTE2] Empresa ${familia}`,
    telefone: "11977770000", status: "novo",
  }).returning({ id: leads.id });

  const [neg] = await db.insert(negocios).values({
    organizacaoId: org.id, leadId: lead.id, pipelineId: pipe?.id,
    titulo: `[TESTE2] ${familia} — arraste pra Ganho`,
    status: "proposta_apresentada", valorTotal: total.toFixed(2), mrrFechado: total.toFixed(2),
  }).returning({ id: negocios.id });

  const [{ n }] = await db.select({ n: sql<number>`coalesce(max(${propostas.numero}), 900000) + 1` })
    .from(propostas).where(and(eq(propostas.organizacaoId, org.id), sql`${propostas.numero} >= 900000`));
  const [prop] = await db.insert(propostas).values({
    organizacaoId: org.id, leadId: lead.id, negocioId: neg.id, numero: n, status: "aceita", totalGeral: total.toFixed(2),
  }).returning({ id: propostas.id });
  await db.insert(propostaItens).values(itens.map((i, ordem) => ({
    propostaId: prop.id, nome: i.nome, tipo: "recorrente", subtotal: i.v, valorUnitario: i.v, ordem,
  })));

  console.log(`criado: [TESTE2] ${familia} — pipeline ${nomePipeline}, coluna Proposta Enviada`);
  console.log(`negocioId: ${neg.id}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
