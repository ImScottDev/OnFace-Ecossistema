import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { propostas, propostaItens, leads, negocios, contratos, atividades, statusChanges } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";

const bodySchema = z.object({
  avancarLeadStatus: z.boolean().default(false),
});

// POST /api/propostas/:id/aceitar — enviada → aceita + cria contrato
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  const avancarLead = parsed.success ? parsed.data.avancarLeadStatus : false;

  const [proposta] = await db
    .select()
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!proposta) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  if (proposta.status !== "enviada") {
    return NextResponse.json({ error: "Só é possível aceitar propostas enviadas" }, { status: 400 });
  }

  // Get items
  const itens = await db
    .select()
    .from(propostaItens)
    .where(eq(propostaItens.propostaId, id))
    .orderBy(asc(propostaItens.ordem));

  const totalRecorrente = parseFloat(proposta.totalRecorrente || "0");
  const totalAvulso = parseFloat(proposta.totalAvulso || "0");
  const setupTotal = itens
    .filter(i => i.tipo === "setup")
    .reduce((sum, i) => sum + parseFloat(i.subtotal || "0"), 0);

  // Detect revenue type
  let tipoReceita = "recorrente";
  if (totalRecorrente > 0 && totalAvulso > 0) tipoReceita = "hibrido";
  else if (totalAvulso > 0 && totalRecorrente === 0) tipoReceita = "projeto";

  // Create contract
  const servicoNomes = itens.map(i => i.nome);
  const today = new Date().toISOString().split("T")[0];

  const [contrato] = await db
    .insert(contratos)
    .values({
      organizacaoId: ctx.organizacaoId,
      leadId: proposta.leadId,
      negocioId: proposta.negocioId,
      tipo: itens.length > 0 ? itens[0].nome : "proposta",
      descricao: `Gerado da proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao}`,
      moeda: proposta.moeda || "BRL",
      mrr: totalRecorrente > 0 ? totalRecorrente.toFixed(2) : undefined,
      valorSetup: setupTotal > 0 ? setupTotal.toFixed(2) : undefined,
      servicos: servicoNomes,
      inicio: today,
      status: "ativo",
    })
    .returning();

  // Update proposal
  await db
    .update(propostas)
    .set({ status: "aceita", contratoId: contrato.id, updatedAt: new Date() })
    .where(eq(propostas.id, id));

  // If proposal has a negócio, mark it as ganho, promote lead, clone to carteira
  if (proposta.negocioId) {
    // Fetch current negocio for cloning
    const [currentNeg] = await db.select().from(negocios).where(eq(negocios.id, proposta.negocioId)).limit(1);

    await db.update(negocios).set({
      status: "ganho",
      ganhoAt: new Date(),
      mrrFechado: totalRecorrente > 0 ? totalRecorrente.toFixed(2) : undefined,
      valorSetup: setupTotal > 0 ? setupTotal.toFixed(2) : undefined,
      tipoReceita,
      updatedAt: new Date(),
    }).where(eq(negocios.id, proposta.negocioId));

    // Record negócio status change
    await db.insert(statusChanges).values({
      leadId: proposta.leadId,
      negocioId: proposta.negocioId,
      deStatus: currentNeg?.status || "proposta_apresentada",
      paraStatus: "ganho",
      usuarioId: ctx.userId,
      motivo: "Proposta aceita",
    });

    // Promote lead to cliente
    await db.update(leads).set({
      tipo: "cliente",
      clienteDesde: new Date(),
      updatedAt: new Date(),
    }).where(eq(leads.id, proposta.leadId));

    // Clone deal to carteira as "ativo"
    if (currentNeg) {
      await db.insert(negocios).values({
        organizacaoId: ctx.organizacaoId,
        leadId: currentNeg.leadId,
        empresaId: currentNeg.empresaId,
        titulo: currentNeg.titulo,
        status: "ativo",
        temperatura: currentNeg.temperatura,
        valorTotal: currentNeg.valorTotal,
        tipoReceita,
        mrrEstimado: currentNeg.mrrEstimado,
        valorProjeto: currentNeg.valorProjeto,
        mrrFechado: totalRecorrente > 0 ? totalRecorrente.toFixed(2) : undefined,
        valorSetup: setupTotal > 0 ? setupTotal.toFixed(2) : undefined,
        moeda: currentNeg.moeda,
        servicosInteresse: currentNeg.servicosInteresse,
        responsavelId: currentNeg.responsavelId,
        pipelineId: currentNeg.pipelineId,
        contratoTipo: currentNeg.contratoTipo,
        origemNegocio: "carteira",
        negocioOrigemId: proposta.negocioId,
      });
    }
  } else if (avancarLead) {
    // Legacy: no negócio linked, advance lead status directly
    const leadUpdates: Record<string, unknown> = {
      tipoReceita,
      tipo: "cliente",
      clienteDesde: new Date(),
      updatedAt: new Date(),
    };
    if (totalRecorrente > 0) leadUpdates.mrrFechado = totalRecorrente.toFixed(2);
    if (totalAvulso > 0) leadUpdates.valorProjeto = totalAvulso.toFixed(2);
    if (setupTotal > 0) leadUpdates.valorSetup = setupTotal.toFixed(2);

    await db.update(leads).set(leadUpdates).where(eq(leads.id, proposta.leadId));
  }

  // Log activity
  await db.insert(atividades).values({
    organizacaoId: ctx.organizacaoId,
    leadId: proposta.leadId,
    negocioId: proposta.negocioId,
    usuarioId: ctx.userId,
    tipo: "proposta_enviada",
    titulo: `Proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} aceita`,
    descricao: `Contrato gerado. Valor total: R$ ${parseFloat(proposta.totalGeral || "0").toLocaleString("pt-BR")}`,
    dados: { propostaId: proposta.id, contratoId: contrato.id, acao: "aceita" },
  });

  // Sync negocio values from propostas
  if (proposta.negocioId) {
    await syncNegocioValoresFromPropostas(proposta.negocioId);
  }

  return NextResponse.json({ proposta: { ...proposta, status: "aceita", contratoId: contrato.id }, contrato });
}
