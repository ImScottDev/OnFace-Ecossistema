/**
 * Prepara 3 negócios em homolog, um por família, parados ANTES do ganho.
 * O time arrasta pra "Ganho" no pipeline e confere se a entrega nasce na
 * trilha certa. Cada um tem proposta com itens reais, que é o que a
 * classificação de família lê.
 *
 * Uso:   npx tsx src/scripts/preparar-teste-jornadas.ts
 * Limpa: npx tsx src/scripts/preparar-teste-jornadas.ts --limpar
 */
import { db } from "@/lib/db";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { gravarLinhasOficiais } from "./_preco-oficial";
import { organizacoes, leads, negocios, propostas, propostaItens, servicosCanonicos, fulfillments, fulfillmentItens, tarefas, contratos, statusChanges, atividades } from "@/lib/db/schema";

const TAG = "[TESTE]";

const CENARIOS: Array<{ nome: string; familia: string; empresa: string; itens: Array<{ nome: string; v: string; setup?: boolean }>; espera: string }> = [
  { nome: "Callface AI", familia: "CALLFACE_AI", empresa: "Acme AI Ltda", itens: [{ nome: "Callface AI - Plano Full", v: "1200.00" }, { nome: "Setup", v: "500.00", setup: true }], espera: "Onboarding" },
  { nome: "PABX", familia: "PABX", empresa: "Beta Telecom Ltda", itens: [{ nome: "Ramal Yeastar", v: "80.00" }, { nome: "Linha SIP", v: "150.00" }, { nome: "Portabilidade", v: "300.00", setup: true }], espera: "Implantação PABX" },
  { nome: "White Label", familia: "WHITE_LABEL", empresa: "Gama Partners Ltda", itens: [{ nome: "White Label - Callface AI (Licença)", v: "3000.00" }, { nome: "Setup White Label", v: "2000.00", setup: true }], espera: "Implantação White Label" },
];

async function limpar(orgId: string) {
  const servs = await db.select({ id: servicosCanonicos.id }).from(servicosCanonicos)
    .where(and(eq(servicosCanonicos.organizacaoId, orgId), like(servicosCanonicos.canonicalProduct, `${TAG}%`)));
  const sIds = servs.map((s) => s.id);
  if (sIds.length) {
    const fs = await db.select({ id: fulfillments.id }).from(fulfillments).where(inArray(fulfillments.servicoCanonicoId, sIds));
    const fIds = fs.map((f) => f.id);
    if (fIds.length) {
      await db.delete(fulfillmentItens).where(inArray(fulfillmentItens.fulfillmentId, fIds));
      await db.delete(fulfillments).where(inArray(fulfillments.id, fIds));
    }
    await db.delete(servicosCanonicos).where(inArray(servicosCanonicos.id, sIds));
  }
  const negs = await db.select({ id: negocios.id }).from(negocios).where(and(eq(negocios.organizacaoId, orgId), like(negocios.titulo, `${TAG}%`)));
  const nIds = negs.map((n) => n.id);
  if (nIds.length) {
    await db.delete(tarefas).where(inArray(tarefas.negocioId, nIds));
    // O Won cria contrato e registra histórico — sem apagar isso, o delete do
    // negócio bate em FK (achado real na 2ª rodada de teste).
    await db.delete(contratos).where(inArray(contratos.negocioId, nIds));
    await db.delete(statusChanges).where(inArray(statusChanges.negocioId, nIds));
    await db.delete(atividades).where(inArray(atividades.negocioId, nIds));
    const props = await db.select({ id: propostas.id }).from(propostas).where(inArray(propostas.negocioId, nIds));
    if (props.length) {
      await db.delete(propostaItens).where(inArray(propostaItens.propostaId, props.map((p) => p.id)));
      await db.delete(propostas).where(inArray(propostas.id, props.map((p) => p.id)));
    }
    await db.delete(negocios).where(inArray(negocios.id, nIds));
  }
  const lds = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.organizacaoId, orgId), like(leads.nome, `${TAG}%`)));
  if (lds.length) {
    await db.delete(tarefas).where(inArray(tarefas.leadId, lds.map((l) => l.id)));
    await db.delete(leads).where(inArray(leads.id, lds.map((l) => l.id)));
  }
  console.log("limpo.");
}

async function main() {
  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  if (!org) throw new Error("sem organização");

  await limpar(org.id);
  if (process.argv.includes("--limpar")) process.exit(0);

  for (const c of CENARIOS) {
    const total = c.itens.reduce((s, i) => s + parseFloat(i.v), 0);

    const [lead] = await db.insert(leads).values({
      organizacaoId: org.id, nome: `${TAG} ${c.nome}`, empresa: `${TAG} ${c.empresa}`,
      telefone: "11999990000", email: `teste-${c.nome.toLowerCase().replace(/ /g, "")}@exemplo.invalid`, status: "novo",
    }).returning({ id: leads.id });

    // Parado ANTES do ganho — é o arrasto do time que dispara o pós-venda.
    const [neg] = await db.insert(negocios).values({
      organizacaoId: org.id, leadId: lead.id,
      titulo: `${TAG} ${c.nome} — arraste pra Ganho`,
      status: "proposta_apresentada",
      valorTotal: total.toFixed(2), mrrFechado: total.toFixed(2), tipoReceita: "recorrente",
    }).returning({ id: negocios.id });

    const [{ n }] = await db.select({ n: sql<number>`coalesce(max(${propostas.numero}), 900000) + 1` })
      .from(propostas).where(and(eq(propostas.organizacaoId, org.id), sql`${propostas.numero} >= 900000`));

    const [prop] = await db.insert(propostas).values({
      organizacaoId: org.id, leadId: lead.id, negocioId: neg.id, numero: n, status: "aceita",
      totalGeral: total.toFixed(2),
    }).returning({ id: propostas.id });

    // As linhas entram pela porta do produto, cada uma com o Price oficial da família (P1-6).
    await gravarLinhasOficiais({
      organizacaoId: org.id, negocioId: neg.id, propostaId: prop.id, familia: c.familia,
      linhas: c.itens.map((i) => ({ nome: i.nome, valor: parseFloat(i.v), tipos: i.setup ? ["setup", "avulso"] : ["recorrente"] })),
    });

    console.log(`✓ ${c.nome.padEnd(12)} → esperado: ${c.espera}`);
    console.log(`  ${TAG} ${c.empresa} · R$ ${total.toFixed(2)} · ${c.itens.map((i) => i.nome).join(", ")}`);
  }

  console.log("\nOs 3 estão no Pipeline, coluna 'Proposta Apresentada'.");
  console.log("Arraste cada um pra 'Ganho' e confira a fila correspondente em Pós-venda.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
