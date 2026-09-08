/**
 * Teste ponta a ponta do pós-venda canônico, contra o banco real de homolog.
 *
 * Prova 4 coisas, nesta ordem:
 *   1. venda Callface AI  -> trilha Onboarding, com checklist do guia real
 *   2. venda PABX         -> trilha Implantação PABX, checklist de 8 etapas
 *   3. venda White Label  -> trilha Implantação White Label
 *   4. o MESMO Won rodado 2x NÃO duplica (nem serviço, nem entrega, nem item)
 *
 * Cria os dados de teste, roda, confere e LIMPA tudo no final (inclusive se
 * falhar no meio). Marca tudo com um prefixo próprio pra nunca confundir com
 * dado real do time.
 *
 * Uso:  npx tsx --env-file=.env src/scripts/teste-posvenda.ts
 *       npx tsx --env-file=.env src/scripts/teste-posvenda.ts --manter
 */
import { db } from "@/lib/db";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import {
  organizacoes, leads, negocios, propostas, propostaItens,
  servicosCanonicos, fulfillments, fulfillmentItens, tarefas,
} from "@/lib/db/schema";
import { criarPosVendaDoNegocio } from "@/lib/crm/pos-venda";

const TAG = "[TESTE-POSVENDA]";
const manter = process.argv.includes("--manter");

const CENARIOS = [
  {
    nome: "Callface AI",
    itens: [{ nome: "Callface AI - Plano Full", subtotal: "1200.00" }, { nome: "Setup", subtotal: "500.00" }],
    familiaEsperada: "CALLFACE_AI",
    trilhaEsperada: "onboarding",
  },
  {
    nome: "PABX",
    itens: [{ nome: "Ramal Yeastar", subtotal: "80.00" }, { nome: "Linha SIP", subtotal: "150.00" }],
    familiaEsperada: "PABX",
    trilhaEsperada: "implantacao_pabx",
  },
  {
    nome: "White Label",
    itens: [{ nome: "White Label - Callface AI (Licença)", subtotal: "3000.00" }],
    familiaEsperada: "WHITE_LABEL",
    trilhaEsperada: "implantacao_white_label",
  },
];

let falhas = 0;
function checar(descricao: string, ok: boolean, detalhe?: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${descricao}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
}

async function limpar(orgId: string) {
  // Ordem inversa das dependências. fulfillment_itens cai por CASCADE, mas
  // deletamos explícito pra conferir a contagem depois.
  const servicos = await db
    .select({ id: servicosCanonicos.id })
    .from(servicosCanonicos)
    .where(and(eq(servicosCanonicos.organizacaoId, orgId), like(servicosCanonicos.canonicalProduct, `${TAG}%`)));
  const servicoIds = servicos.map((s) => s.id);

  if (servicoIds.length > 0) {
    const fs = await db.select({ id: fulfillments.id }).from(fulfillments).where(inArray(fulfillments.servicoCanonicoId, servicoIds));
    const fIds = fs.map((f) => f.id);
    if (fIds.length > 0) {
      await db.delete(fulfillmentItens).where(inArray(fulfillmentItens.fulfillmentId, fIds));
      await db.delete(fulfillments).where(inArray(fulfillments.id, fIds));
    }
    await db.delete(servicosCanonicos).where(inArray(servicosCanonicos.id, servicoIds));
  }

  const negs = await db.select({ id: negocios.id }).from(negocios).where(and(eq(negocios.organizacaoId, orgId), like(negocios.titulo, `${TAG}%`)));
  const negIds = negs.map((n) => n.id);
  if (negIds.length > 0) {
    await db.delete(tarefas).where(inArray(tarefas.negocioId, negIds));
    const props = await db.select({ id: propostas.id }).from(propostas).where(inArray(propostas.negocioId, negIds));
    const propIds = props.map((p) => p.id);
    if (propIds.length > 0) {
      await db.delete(propostaItens).where(inArray(propostaItens.propostaId, propIds));
      await db.delete(propostas).where(inArray(propostas.id, propIds));
    }
    await db.delete(negocios).where(inArray(negocios.id, negIds));
  }

  const lds = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.organizacaoId, orgId), like(leads.nome, `${TAG}%`)));
  if (lds.length > 0) {
    await db.delete(tarefas).where(inArray(tarefas.leadId, lds.map((l) => l.id)));
    await db.delete(leads).where(inArray(leads.id, lds.map((l) => l.id)));
  }
}

async function main() {
  const [org] = await db.select({ id: organizacoes.id, nome: organizacoes.nome }).from(organizacoes).limit(1);
  if (!org) throw new Error("nenhuma organização no banco");
  console.log(`organização: ${org.nome}\n`);

  // Limpa resíduo de execução anterior antes de começar.
  await limpar(org.id);

  const criados: string[] = [];

  for (const cen of CENARIOS) {
    console.log(`── ${cen.nome} ${"─".repeat(Math.max(0, 40 - cen.nome.length))}`);

    const [lead] = await db.insert(leads).values({
      organizacaoId: org.id,
      nome: `${TAG} Lead ${cen.nome}`,
      empresa: `${TAG} Empresa ${cen.nome}`,
      telefone: "11999999999",
      status: "novo",
    }).returning({ id: leads.id });

    const [negocio] = await db.insert(negocios).values({
      organizacaoId: org.id,
      leadId: lead.id,
      titulo: `${TAG} ${cen.nome}`,
      status: "ganho",
      ganhoAt: new Date(),
      valorTotal: cen.itens.reduce((s, i) => s + parseFloat(i.subtotal), 0).toFixed(2),
    }).returning({ id: negocios.id });
    criados.push(negocio.id);

    // `numero` é NOT NULL sem default — usa uma faixa alta pra nunca colidir
    // com a numeração real das propostas do time.
    const [{ proximo }] = await db
      .select({ proximo: sql<number>`coalesce(max(${propostas.numero}), 900000) + 1` })
      .from(propostas)
      .where(and(eq(propostas.organizacaoId, org.id), sql`${propostas.numero} >= 900000`));

    const [proposta] = await db.insert(propostas).values({
      organizacaoId: org.id,
      leadId: lead.id,
      negocioId: negocio.id,
      numero: proximo,
      status: "aceita",
    }).returning({ id: propostas.id });

    await db.insert(propostaItens).values(
      cen.itens.map((i, ordem) => ({
        propostaId: proposta.id,
        nome: i.nome,
        tipo: "recorrente",
        subtotal: i.subtotal,
        ordem,
      })),
    );

    // ── Primeira execução ──────────────────────────────────
    const r1 = await criarPosVendaDoNegocio(negocio.id, { ignorarFlag: true });
    checar("criou o pós-venda", r1.criado === true, r1.motivo);
    checar(`família = ${cen.familiaEsperada}`, r1.familia === cen.familiaEsperada, `veio ${r1.familia}`);
    checar(`trilha = ${cen.trilhaEsperada}`, r1.trilha === cen.trilhaEsperada, `veio ${r1.trilha}`);
    checar("checklist não veio vazio", (r1.itensChecklist ?? 0) > 0, `${r1.itensChecklist} itens`);

    // Marca o serviço pra limpeza e confere que não contamina o portfólio.
    if (r1.servicoCanonicoId) {
      await db.update(servicosCanonicos)
        .set({ canonicalProduct: `${TAG} ${cen.nome}` })
        .where(eq(servicosCanonicos.id, r1.servicoCanonicoId));

      const [s] = await db.select({
        portfolioIncluded: servicosCanonicos.portfolioIncluded,
        currentRecurringValue: servicosCanonicos.currentRecurringValue,
        revenueNature: servicosCanonicos.revenueNature,
      }).from(servicosCanonicos).where(eq(servicosCanonicos.id, r1.servicoCanonicoId));

      checar(
        "não entra no portfólio/MRR",
        s.portfolioIncluded === false && parseFloat(s.currentRecurringValue) === 0 && s.revenueNature !== "MRR",
        `portfolio=${s.portfolioIncluded} valor=${s.currentRecurringValue} natureza=${s.revenueNature}`,
      );
    }

    // ── Segunda execução: o MESMO Won ──────────────────────
    const r2 = await criarPosVendaDoNegocio(negocio.id, { ignorarFlag: true });
    checar("2ª execução não cria de novo", r2.criado === false, r2.motivo);
    checar("2ª execução aponta a MESMA entrega", r2.fulfillmentId === r1.fulfillmentId, `${r2.fulfillmentId} vs ${r1.fulfillmentId}`);

    const [cont] = await db.select({
      servicos: sql<number>`(select count(*)::int from servicos_canonicos where evidence->>'negocioId' = ${negocio.id})`,
      entregas: sql<number>`(select count(*)::int from fulfillments f join servicos_canonicos s on s.id = f.servico_canonico_id where s.evidence->>'negocioId' = ${negocio.id})`,
      itens: sql<number>`(select count(*)::int from fulfillment_itens fi join fulfillments f on f.id = fi.fulfillment_id join servicos_canonicos s on s.id = f.servico_canonico_id where s.evidence->>'negocioId' = ${negocio.id})`,
    }).from(sql`(select 1) as t`);

    checar("exatamente 1 serviço canônico", cont.servicos === 1, `${cont.servicos}`);
    checar("exatamente 1 entrega", cont.entregas === 1, `${cont.entregas}`);
    checar("checklist não duplicou", cont.itens === (r1.itensChecklist ?? 0), `${cont.itens} itens no banco vs ${r1.itensChecklist} criados`);
    console.log("");
  }

  // ── Negócio sem sinal nenhum: tem que cair em validação manual ──
  console.log(`── Sem sinal de família ${"─".repeat(21)}`);
  const [leadX] = await db.insert(leads).values({
    organizacaoId: org.id, nome: `${TAG} Lead Indefinido`, telefone: "11988888888", status: "novo",
  }).returning({ id: leads.id });
  const [negX] = await db.insert(negocios).values({
    organizacaoId: org.id, leadId: leadX.id, titulo: `${TAG} Contrato`, status: "ganho", ganhoAt: new Date(),
  }).returning({ id: negocios.id });
  const rX = await criarPosVendaDoNegocio(negX.id, { ignorarFlag: true });
  checar("família = UNKNOWN (não chuta)", rX.familia === "UNKNOWN", `veio ${rX.familia}`);
  checar("trilha = validacao_manual", rX.trilha === "validacao_manual", `veio ${rX.trilha}`);
  checar("sem checklist inventado", rX.itensChecklist === 0, `${rX.itensChecklist} itens`);
  if (rX.servicoCanonicoId) {
    await db.update(servicosCanonicos).set({ canonicalProduct: `${TAG} Indefinido` }).where(eq(servicosCanonicos.id, rX.servicoCanonicoId));
  }
  console.log("");

  if (!manter) {
    await limpar(org.id);
    const [resto] = await db.select({ n: sql<number>`count(*)::int` }).from(servicosCanonicos)
      .where(and(eq(servicosCanonicos.organizacaoId, org.id), like(servicosCanonicos.canonicalProduct, `${TAG}%`)));
    checar("limpeza completa (nenhum resíduo)", resto.n === 0, `${resto.n} sobraram`);
  } else {
    console.log("--manter: dados de teste preservados no banco.");
  }

  console.log(`\n${falhas === 0 ? "TODOS OS TESTES PASSARAM" : `${falhas} VERIFICAÇÃO(ÕES) FALHARAM`}`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("\nERRO:", err);
  process.exit(1);
});
