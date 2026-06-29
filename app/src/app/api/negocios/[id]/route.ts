import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { negocios, leads, propostas, propostaItens, contratos, atividades, statusChanges, empresas, negocioLeads, notas, usuarios, reunioes } from "@/lib/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const updateNegocioSchema = z.object({
  titulo: z.string().min(1).optional(),
  status: z.string().optional(),
  empresaId: z.string().uuid().optional().nullable(),
  tipoReceita: z.enum(["recorrente", "projeto", "hibrido"]).optional().nullable(),
  mrrFechado: z.string().optional().nullable(),
  valorSetup: z.string().optional().nullable(),
  motivoPerda: z.string().optional().nullable(),
  motivoPerdaDetalhe: z.string().optional().nullable(),
  servicosInteresse: z.array(z.string()).optional().nullable(),
  concorrenteAtual: z.string().optional().nullable(),
  contratoVenceEm: z.string().optional().nullable(),
  contratoTipo: z.string().optional().nullable(),
  temperatura: z.enum(["quente", "morno", "frio", "indefinido"]).optional().nullable(),
  moeda: z.enum(["BRL", "USD", "EUR", "CAD"]).optional(),
  previsaoFechamento: z.string().optional().nullable(),
  pipelineOrigem: z.string().optional().nullable(),
  responsavelId: z.string().uuid().optional().nullable(),
  pipelineId: z.string().uuid().optional().nullable(),
  camposCustom: z.record(z.string(), z.unknown()).optional(),
});

// GET /api/negocios/:id — full deal detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [negocio] = await db
    .select()
    .from(negocios)
    .where(and(eq(negocios.id, id), eq(negocios.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!negocio) {
    return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });
  }

  // Fetch all related data in parallel
  const [primaryLead, empresa, allLeadsJoin, negocioPropostas, negocioContratos, negocioAtividades, negocioStatusChanges, negocioNotas, negocioReunioes] =
    await Promise.all([
      negocio.leadId ? db.select().from(leads).where(eq(leads.id, negocio.leadId)).limit(1).then((r) => r[0]) : Promise.resolve(null),
      negocio.empresaId ? db.select().from(empresas).where(eq(empresas.id, negocio.empresaId)).limit(1).then((r) => r[0]) : Promise.resolve(null),
      db.select({
        id: leads.id,
        nome: leads.nome,
        email: leads.email,
        telefone: leads.telefone,
        empresa: leads.empresa,
        cargo: leads.cargo,
        leadScore: leads.leadScore,
        tipo: leads.tipo,
        papel: negocioLeads.papel,
      })
        .from(negocioLeads)
        .innerJoin(leads, eq(negocioLeads.leadId, leads.id))
        .where(eq(negocioLeads.negocioId, id)),
      db.select().from(propostas).where(eq(propostas.negocioId, id)).orderBy(desc(propostas.createdAt)),
      db.select().from(contratos).where(eq(contratos.negocioId, id)).orderBy(desc(contratos.createdAt)),
      db.select().from(atividades).where(eq(atividades.negocioId, id)).orderBy(desc(atividades.createdAt)),
      db.select().from(statusChanges).where(eq(statusChanges.negocioId, id)).orderBy(desc(statusChanges.createdAt)),
      db.select({
        id: notas.id,
        conteudo: notas.conteudo,
        autorNome: usuarios.nome,
        createdAt: notas.createdAt,
      }).from(notas)
        .leftJoin(usuarios, eq(notas.autorId, usuarios.id))
        .where(eq(notas.negocioId, id))
        .orderBy(desc(notas.createdAt)),
      db.select({
        id: reunioes.id,
        titulo: reunioes.titulo,
        data: reunioes.data,
        duracao: reunioes.duracao,
        tipo: reunioes.tipo,
        status: reunioes.status,
        participantes: reunioes.participantes,
        notas: reunioes.notas,
        transcript: reunioes.transcript,
        resumoTranscript: reunioes.resumoTranscript,
        responsavelNome: usuarios.nome,
        createdAt: reunioes.createdAt,
      }).from(reunioes)
        .leftJoin(usuarios, eq(reunioes.responsavelId, usuarios.id))
        .where(eq(reunioes.negocioId, id))
        .orderBy(desc(reunioes.data)),
    ]);

  // Fetch proposta itens for all propostas
  const propostasWithItens = negocioPropostas.length > 0
    ? await (async () => {
        const propostaIds = negocioPropostas.map((p) => p.id);
        const allItens = await db
          .select()
          .from(propostaItens)
          .where(inArray(propostaItens.propostaId, propostaIds))
          .orderBy(propostaItens.ordem);
        const itensByProposta = new Map<string, typeof allItens>();
        for (const item of allItens) {
          const list = itensByProposta.get(item.propostaId) || [];
          list.push(item);
          itensByProposta.set(item.propostaId, list);
        }
        return negocioPropostas.map((p) => ({ ...p, itens: itensByProposta.get(p.id) || [] }));
      })()
    : [];

  return NextResponse.json({
    negocio,
    lead: primaryLead, // backward compat
    empresa,
    leads: allLeadsJoin, // all leads with their papel
    propostas: propostasWithItens,
    contratos: negocioContratos,
    atividades: negocioAtividades,
    statusChanges: negocioStatusChanges,
    notas: negocioNotas,
    reunioes: negocioReunioes,
  });
}

// PATCH /api/negocios/:id — update deal
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const parsed = updateNegocioSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  // Validate perdido requires motivo
  if (parsed.data.status === "perdido" && !parsed.data.motivoPerda) {
    return NextResponse.json({ error: "motivoPerda é obrigatório ao marcar como perdido" }, { status: 400 });
  }

  const [currentNegocio] = await db
    .select()
    .from(negocios)
    .where(and(eq(negocios.id, id), eq(negocios.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!currentNegocio) {
    return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };

  // Handle status transitions
  if (parsed.data.status && parsed.data.status !== currentNegocio.status) {
    // Record status change
    await db.insert(statusChanges).values({
      leadId: currentNegocio.leadId,
      negocioId: id,
      deStatus: currentNegocio.status,
      paraStatus: parsed.data.status,
      usuarioId: ctx.userId,
      motivo: parsed.data.motivoPerda || undefined,
    });

    // → ganho: create contract, promote lead to cliente, clone to carteira as "ativo"
    if (parsed.data.status === "ganho") {
      updateData.ganhoAt = new Date();

      // Card de ONBOARDING nasce automático no ganho (fluxo Scott 12/jun):
      // produto vem da qualificação SDR do lead (a proposta aceita pode sobrescrever).
      // AI → Aguardando Pagamento (Stripe move sozinho) | PABX → Faturamento (Wevy).
      {
        const cc = ((currentNegocio.camposCustom || {}) as Record<string, unknown>);
        if (!cc.onboardingStage) {
          let produto = (cc.produto as string) || "";
          if (!produto && currentNegocio.leadId) {
            const [l] = await db.select({ camposCustom: leads.camposCustom }).from(leads).where(eq(leads.id, currentNegocio.leadId)).limit(1);
            const quali = ((l?.camposCustom || {}) as Record<string, Record<string, string>>).qualificacaoSdr;
            produto = quali?.produto || "ai";
          }
          cc.produto = produto || "ai";
          cc.onboardingStage = produto === "pabx" ? "faturamento" : "aguardando_pagamento";
          updateData.camposCustom = cc;
        }
      }

      // Check if an accepted proposal already created a contract
      const [existingContract] = await db
        .select({ id: contratos.id })
        .from(contratos)
        .where(eq(contratos.negocioId, id))
        .limit(1);

      if (!existingContract && currentNegocio.leadId) {
        await db.insert(contratos).values({
          organizacaoId: ctx.organizacaoId,
          leadId: currentNegocio.leadId,
          negocioId: id,
          tipo: parsed.data.contratoTipo || currentNegocio.contratoTipo || "servico",
          mrr: parsed.data.mrrFechado || currentNegocio.mrrEstimado,
          valorSetup: parsed.data.valorSetup || currentNegocio.valorSetup,
          status: "ativo",
          inicio: new Date().toISOString().split("T")[0],
        });
      }

      // Promote lead to cliente
      if (currentNegocio.leadId) {
        await db.update(leads).set({
          tipo: "cliente",
          clienteDesde: new Date(),
          updatedAt: new Date(),
        }).where(eq(leads.id, currentNegocio.leadId));
      }

      // Clone deal to carteira as "ativo"
      await db.insert(negocios).values({
        organizacaoId: ctx.organizacaoId,
        leadId: currentNegocio.leadId,
        empresaId: parsed.data.empresaId !== undefined ? parsed.data.empresaId : currentNegocio.empresaId,
        titulo: currentNegocio.titulo,
        status: "ativo",
        temperatura: currentNegocio.temperatura,
        valorTotal: currentNegocio.valorTotal,
        tipoReceita: parsed.data.tipoReceita || currentNegocio.tipoReceita,
        mrrEstimado: currentNegocio.mrrEstimado,
        valorProjeto: currentNegocio.valorProjeto,
        mrrFechado: parsed.data.mrrFechado || currentNegocio.mrrFechado,
        valorSetup: parsed.data.valorSetup || currentNegocio.valorSetup,
        moeda: currentNegocio.moeda,
        servicosInteresse: currentNegocio.servicosInteresse,
        responsavelId: currentNegocio.responsavelId,
        pipelineId: currentNegocio.pipelineId,
        contratoTipo: currentNegocio.contratoTipo,
        origemNegocio: "carteira",
        negocioOrigemId: id,
      });
    }
  }

  const [updated] = await db
    .update(negocios)
    .set(updateData)
    .where(and(eq(negocios.id, id), eq(negocios.organizacaoId, ctx.organizacaoId)))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/negocios/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [negocio] = await db
    .select()
    .from(negocios)
    .where(and(eq(negocios.id, id), eq(negocios.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!negocio) {
    return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });
  }

  // Clear negocioAtivoId reference on leads
  await db.update(leads).set({ negocioAtivoId: null, updatedAt: new Date() }).where(eq(leads.negocioAtivoId, id));
  // Clean up related records that don't cascade
  await db.delete(statusChanges).where(eq(statusChanges.negocioId, id));
  await db.delete(atividades).where(eq(atividades.negocioId, id));
  await db.delete(propostas).where(eq(propostas.negocioId, id));
  await db.delete(contratos).where(eq(contratos.negocioId, id));
  await db.delete(reunioes).where(eq(reunioes.negocioId, id));
  // negocioLeads, negocioLabels, notas cascade automatically
  await db.delete(negocios).where(eq(negocios.id, id));

  return NextResponse.json({ ok: true });
}
