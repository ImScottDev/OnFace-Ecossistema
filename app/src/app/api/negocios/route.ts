import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { negocios, leads, empresas, negocioLeads, usuarios, pipelines } from "@/lib/db/schema";
import { desc, asc, eq, ilike, and, or, SQL, count } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const createNegocioSchema = z.object({
  leadId: z.string().uuid().optional(), // primary lead (backward compat)
  leadIds: z.array(z.object({ id: z.string().uuid(), papel: z.string().optional() })).optional(),
  empresaId: z.string().uuid().optional().nullable(),
  titulo: z.string().min(1),
  status: z.string().optional(), // initial stage (defaults to first stage of pipeline)
  tipoReceita: z.enum(["recorrente", "projeto", "hibrido"]).optional(),
  servicosInteresse: z.array(z.string()).optional().nullable(),
  concorrenteAtual: z.string().optional().nullable(),
  contratoVenceEm: z.string().optional().nullable(),
  origemNegocio: z.enum(["novo", "carteira"]).optional(),
  responsavelId: z.string().uuid().optional().nullable(),
  pipelineId: z.string().uuid().optional().nullable(),
  camposCustom: z.record(z.string(), z.unknown()).optional(),
  lpUrl: z.string().url().optional().nullable(),
});

// GET /api/negocios — list with filters
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "200");
  const status = searchParams.get("status");
  const leadId = searchParams.get("leadId");
  const origemNegocio = searchParams.get("origemNegocio");
  const pipelineId = searchParams.get("pipelineId");
  const search = searchParams.get("search") || searchParams.get("q");
  const sort = searchParams.get("sort") || "createdAt";
  const order = searchParams.get("order") || "desc";

  const conditions: SQL[] = [eq(negocios.organizacaoId, ctx.organizacaoId)];
  if (leadId) {
    conditions.push(eq(negocios.leadId, leadId));
  }
  if (status) {
    // Support comma-separated statuses
    const statuses = status.split(",");
    if (statuses.length === 1) {
      conditions.push(eq(negocios.status, statuses[0]));
    } else {
      conditions.push(or(...statuses.map((s) => eq(negocios.status, s)))!);
    }
  }
  if (pipelineId) {
    conditions.push(eq(negocios.pipelineId, pipelineId));
  }
  if (origemNegocio && origemNegocio !== "todos") {
    conditions.push(eq(negocios.origemNegocio, origemNegocio));
  }
  if (search) {
    const searchPattern = `%${search}%`;
    conditions.push(
      or(
        ilike(negocios.titulo, searchPattern),
        ilike(leads.nome, searchPattern),
        ilike(leads.empresa, searchPattern),
        ilike(leads.telefone, searchPattern),
      )!
    );
  }

  const where = and(...conditions);

  const sortColumn = (() => {
    switch (sort) {
      case "titulo": return negocios.titulo;
      case "mrrEstimado": return negocios.mrrEstimado;
      case "updatedAt": return negocios.updatedAt;
      default: return negocios.createdAt;
    }
  })();

  const orderFn = order === "asc" ? asc : desc;

  const [data, totalResult] = await Promise.all([
    db
      .select({
        id: negocios.id,
        organizacaoId: negocios.organizacaoId,
        leadId: negocios.leadId,
        titulo: negocios.titulo,
        status: negocios.status,
        tipoReceita: negocios.tipoReceita,
        mrrEstimado: negocios.mrrEstimado,
        valorProjeto: negocios.valorProjeto,
        mrrFechado: negocios.mrrFechado,
        valorSetup: negocios.valorSetup,
        motivoPerda: negocios.motivoPerda,
        origemNegocio: negocios.origemNegocio,
        servicosInteresse: negocios.servicosInteresse,
        responsavelId: negocios.responsavelId,
        createdAt: negocios.createdAt,
        updatedAt: negocios.updatedAt,
        ganhoAt: negocios.ganhoAt,
        // Lead join fields
        leadNome: leads.nome,
        leadEmpresa: leads.empresa,
        leadTelefone: leads.telefone,
        leadEmail: leads.email,
        leadScore: leads.leadScore,
        leadTipo: leads.tipo,
        empresaId: negocios.empresaId,
        empresaNome: empresas.nome,
        temperatura: negocios.temperatura,
        valorTotal: negocios.valorTotal,
        previsaoFechamento: negocios.previsaoFechamento,
        responsavelNome: usuarios.nome,
        responsavelAvatar: usuarios.avatarUrl,
        pipelineId: negocios.pipelineId,
        pipelineNome: pipelines.nome,
      })
      .from(negocios)
      .leftJoin(leads, eq(negocios.leadId, leads.id))
      .leftJoin(empresas, eq(negocios.empresaId, empresas.id))
      .leftJoin(usuarios, eq(negocios.responsavelId, usuarios.id))
      .leftJoin(pipelines, eq(negocios.pipelineId, pipelines.id))
      .where(where)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: count() })
      .from(negocios)
      .leftJoin(leads, eq(negocios.leadId, leads.id))
      .leftJoin(empresas, eq(negocios.empresaId, empresas.id))
      .where(where),
  ]);

  return NextResponse.json({
    negocios: data,
    total: Number(totalResult[0].count),
    page,
    totalPages: Math.ceil(Number(totalResult[0].count) / limit),
  });
}

// POST /api/negocios — create new deal
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const body = await request.json();
  const parsed = createNegocioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const primaryLeadId = parsed.data.leadId;
  const leadIdsList = parsed.data.leadIds || (primaryLeadId ? [{ id: primaryLeadId, papel: "contato" }] : []);

  // Negócio pode ser criado sem lead/empresa — associa depois

  // Verify primary lead belongs to org
  let resolvedLeadId = primaryLeadId;
  if (resolvedLeadId) {
    const [lead] = await db
      .select({ id: leads.id, tipo: leads.tipo })
      .from(leads)
      .where(and(eq(leads.id, resolvedLeadId), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

    // Promote contato → lead if needed
    if (lead.tipo === "contato") {
      await db.update(leads).set({ tipo: "lead", updatedAt: new Date() }).where(eq(leads.id, resolvedLeadId));
    }
  } else if (leadIdsList.length > 0) {
    resolvedLeadId = leadIdsList[0].id;
  }

  const [negocio] = await db
    .insert(negocios)
    .values({
      organizacaoId: ctx.organizacaoId,
      leadId: resolvedLeadId || null,
      empresaId: parsed.data.empresaId || null,
      titulo: parsed.data.titulo,
      status: parsed.data.status || "reuniao_agendada",
      tipoReceita: parsed.data.tipoReceita,
      servicosInteresse: parsed.data.servicosInteresse,
      concorrenteAtual: parsed.data.concorrenteAtual,
      contratoVenceEm: parsed.data.contratoVenceEm,
      origemNegocio: parsed.data.origemNegocio || "novo",
      // Espelho da rota Hono: criação manual = qualificação direta sem reunião.
      origemQualificacao: (parsed.data.origemNegocio || "novo") === "novo" ? "direta" : undefined,
      responsavelId: parsed.data.responsavelId || ctx.userId,
      pipelineId: parsed.data.pipelineId || null,
      camposCustom: parsed.data.camposCustom || {},
      lpUrl: parsed.data.lpUrl || null,
    })
    .returning();

  // Create N:N lead associations
  if (leadIdsList.length > 0) {
    await db.insert(negocioLeads).values(
      leadIdsList.map((l) => ({
        negocioId: negocio.id,
        leadId: l.id,
        papel: l.papel || "contato",
      }))
    );
  }

  // Auto-trigger CIPA analysis if LP URL provided
  if (parsed.data.lpUrl) {
    try {
      const { cipaAnalysisQueue } = await import("@/lib/queue");
      await cipaAnalysisQueue.add("analyze", {
        negocioId: negocio.id,
        lpUrl: parsed.data.lpUrl,
        organizacaoId: ctx.organizacaoId,
      });
    } catch { /* queue not available in dev */ }
  }

  return NextResponse.json(negocio, { status: 201 });
}
