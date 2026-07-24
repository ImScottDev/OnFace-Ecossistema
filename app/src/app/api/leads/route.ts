import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, negocios, negocioLeads, statusChanges, organizacoes, leadLabels, contatos, empresas } from "@/lib/db/schema";
import { desc, asc, eq, ilike, and, or, SQL, count, gte, isNotNull, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { leadScoringQueue, notificationQueue } from "@/lib/queue";

const createLeadSchema = z.object({
  nome: z.string().min(1),
  sobrenome: z.string().optional().nullable(),
  telefone: z.string().min(8),
  email: z.string().email().optional().nullable(),
  empresa: z.string().optional().nullable(),
  cargo: z.string().optional().nullable(),
  empresaCnpj: z.string().optional().nullable(),
  empresaSetor: z.string().optional().nullable(),
  empresaPorte: z.enum(["pequena", "media", "grande"]).optional().nullable(),
  empresaCidade: z.string().optional().nullable(),
  empresaEstado: z.string().optional().nullable(),
  numUsuariosTi: z.number().int().optional().nullable(),
  numFiliais: z.number().int().optional().nullable(),
  servicosInteresse: z.array(z.string()).optional().nullable(),
  modeloPreferido: z.enum(["compra", "locacao", "assinatura", "indefinido"]).optional().nullable(),
  origem: z.string().optional().nullable(),
  utmSource: z.string().optional().nullable(),
  utmMedium: z.string().optional().nullable(),
  utmCampaign: z.string().optional().nullable(),
  utmTerm: z.string().optional().nullable(),
  utmContent: z.string().optional().nullable(),
  gclid: z.string().optional().nullable(),
  gbraid: z.string().optional().nullable(),
  wbraid: z.string().optional().nullable(),
  fbclid: z.string().optional().nullable(),
  fbc: z.string().optional().nullable(),
  fbp: z.string().optional().nullable(),
  eventId: z.string().optional().nullable(),
  landingPage: z.string().optional().nullable(),
  comoConheceu: z.string().optional().nullable(),
  indicadoPor: z.string().optional().nullable(),
  concorrenteAtual: z.string().optional().nullable(),
  contratoVenceEm: z.string().optional().nullable(),
  responsavelId: z.string().uuid().optional().nullable(),
  tipoReceita: z.enum(["recorrente", "projeto", "hibrido"]).optional().nullable(),
  valorProjeto: z.string().optional().nullable(),
  empresaId: z.string().uuid().optional().nullable(),
  lpUrl: z.string().url().optional().nullable(),
  organizacaoId: z.string().uuid().optional(),
  org: z.string().optional(),
});

// GET /api/leads — list with filters
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const status = searchParams.get("status");
  const tipo = searchParams.get("tipo");
  const origem = searchParams.get("origem");
  const setor = searchParams.get("setor");
  const search = searchParams.get("search");
  const unread = searchParams.get("unread");
  const hasWhatsapp = searchParams.get("hasWhatsapp");
  const labelIds = searchParams.get("labelIds");
  const estagio = searchParams.get("estagio");
  const sort = searchParams.get("sort") || "createdAt";
  const order = searchParams.get("order") || "desc";

  const conditions: SQL[] = [eq(leads.organizacaoId, ctx.organizacaoId)];
  if (tipo && tipo !== "todos") {
    if (tipo.includes(",")) {
      const tipos = tipo.split(",").map(t => t.trim());
      conditions.push(or(...tipos.map(t => eq(leads.tipo, t)))!);
    } else {
      conditions.push(eq(leads.tipo, tipo));
    }
  }
  if (status) conditions.push(eq(leads.status, status));
  if (origem) conditions.push(eq(leads.origem, origem));
  if (setor) conditions.push(eq(leads.empresaSetor, setor));
  if (unread === "1") conditions.push(gte(leads.whatsappNaoLidas, 1));
  if (hasWhatsapp === "1") conditions.push(isNotNull(leads.whatsappUltimaMsgAt));

  // Label filter: find leads that have ALL specified labels
  let labelLeadIds: string[] | null = null;
  if (labelIds) {
    const ids = labelIds.split(",").map(id => id.trim()).filter(Boolean);
    if (ids.length > 0) {
      const labelMatches = await db
        .select({ leadId: leadLabels.leadId })
        .from(leadLabels)
        .where(inArray(leadLabels.labelId, ids))
        .groupBy(leadLabels.leadId);
      // For AND logic: only include leads that have ALL labels
      labelLeadIds = labelMatches
        .filter(m => m.leadId !== null)
        .map(m => m.leadId!);
      if (labelLeadIds.length === 0) {
        // No leads match — return empty
        return NextResponse.json({ leads: [], total: 0, page, totalPages: 0 });
      }
      conditions.push(inArray(leads.id, labelLeadIds));
    }
  }
  // Filter by negocio stage: find leads with an active negocio in given status
  if (estagio) {
    const matchingLeadIds = await db
      .select({ leadId: negocioLeads.leadId })
      .from(negocioLeads)
      .innerJoin(negocios, eq(negocios.id, negocioLeads.negocioId))
      .where(eq(negocios.status, estagio));
    const ids = matchingLeadIds.map(m => m.leadId).filter(Boolean) as string[];
    if (ids.length === 0) {
      return NextResponse.json({ leads: [], total: 0, page, totalPages: 0 });
    }
    conditions.push(inArray(leads.id, ids));
  }

  if (search) {
    // Search across multiple fields + empresa vinculada
    const searchPattern = `%${search}%`;
    conditions.push(
      or(
        ilike(leads.nome, searchPattern),
        ilike(leads.email, searchPattern),
        ilike(leads.empresa, searchPattern),
        ilike(leads.telefone, searchPattern),
        sql`EXISTS (SELECT 1 FROM ${empresas} WHERE ${empresas.id} = ${leads.empresaId} AND ${empresas.nome} ILIKE ${searchPattern})`,
      )!
    );
  }

  const where = and(...conditions);

  // Dynamic sort
  const sortColumn = (() => {
    switch (sort) {
      case "nome": return leads.nome;
      case "leadScore": return leads.leadScore;
      case "mrrEstimado": return leads.mrrEstimado;
      case "updatedAt": return leads.updatedAt;
      case "whatsappUltimaMsgAt": return leads.whatsappUltimaMsgAt;
      case "whatsappNaoLidas": return leads.whatsappNaoLidas;
      default: return leads.createdAt;
    }
  })();

  const orderExpr = order === "asc"
    ? sql`${sortColumn} ASC NULLS LAST`
    : sql`${sortColumn} DESC NULLS LAST`;

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(where)
      .orderBy(orderExpr)
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: count() }).from(leads).where(where),
  ]);

  // Enrich: negócios (with title+status), contatoId, avatarUrl, empresa from empresas table
  const leadIds = data.map(l => l.id);
  let negocioMap: Record<string, { id: string; titulo: string; status: string }[]> = {};
  let contatoMap: Record<string, { id: string; avatarUrl: string | null }> = {};
  let empresaNomes: Record<string, string> = {};
  if (leadIds.length > 0) {
    // Collect empresaIds for leads that have empresaId but no empresa text
    const empresaIds = data
      .filter(l => l.empresaId && !l.empresa)
      .map(l => l.empresaId!)
      .filter(Boolean);

    const queries: Promise<unknown>[] = [
      db.select({
        leadId: negocioLeads.leadId,
        negocioId: negocios.id,
        titulo: negocios.titulo,
        status: negocios.status,
      })
        .from(negocioLeads)
        .innerJoin(negocios, eq(negocios.id, negocioLeads.negocioId))
        .where(inArray(negocioLeads.leadId, leadIds)),
      db.select({ leadId: contatos.leadId, id: contatos.id, avatarUrl: contatos.avatarUrl })
        .from(contatos)
        .where(inArray(contatos.leadId, leadIds)),
    ];
    if (empresaIds.length > 0) {
      queries.push(
        db.select({ id: empresas.id, nome: empresas.nome })
          .from(empresas)
          .where(inArray(empresas.id, empresaIds))
      );
    }

    const results = await Promise.all(queries);
    const allNegocios = results[0] as { leadId: string | null; negocioId: string; titulo: string; status: string }[];
    const contatoLinks = results[1] as { leadId: string | null; id: string; avatarUrl: string | null }[];
    const empresaList = (results[2] || []) as { id: string; nome: string }[];

    for (const n of allNegocios) {
      if (!n.leadId) continue;
      if (!negocioMap[n.leadId]) negocioMap[n.leadId] = [];
      negocioMap[n.leadId].push({ id: n.negocioId, titulo: n.titulo, status: n.status });
    }
    for (const c of contatoLinks) {
      if (c.leadId) contatoMap[c.leadId] = { id: c.id, avatarUrl: c.avatarUrl };
    }
    for (const e of empresaList) {
      empresaNomes[e.id] = e.nome;
    }
  }

  const enrichedLeads = data.map(l => {
    const negs = negocioMap[l.id] || [];
    // Prioritize active deals (not perdido/churned)
    const activeNegs = negs.filter(n => !["perdido", "churned"].includes(n.status));
    const primaryNeg = activeNegs[0] || negs[0] || null;
    const contato = contatoMap[l.id];
    // Resolve empresa name: use text field, fallback to empresas table
    const empresaNome = l.empresa || (l.empresaId ? empresaNomes[l.empresaId] : null) || null;
    return {
      ...l,
      empresa: empresaNome,
      negocioCount: negs.length,
      negocioPrincipal: primaryNeg,
      negocioAtivoStatus: primaryNeg?.status || null,
      contatoId: contato?.id || null,
      avatarUrl: contato?.avatarUrl || null,
    };
  });

  return NextResponse.json({
    leads: enrichedLeads,
    total: Number(totalResult[0].count),
    page,
    totalPages: Math.ceil(Number(totalResult[0].count) / limit),
  });
}

// POST /api/leads — create new lead (public for LP forms)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createLeadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Determine organizacaoId: explicit in body, or lookup by slug
  let orgId = parsed.data.organizacaoId;
  if (!orgId && parsed.data.org) {
    const [org] = await db
      .select({ id: organizacoes.id })
      .from(organizacoes)
      .where(eq(organizacoes.slug, parsed.data.org))
      .limit(1);
    if (org) orgId = org.id;
  }

  // If still no org, try authenticated user context
  if (!orgId) {
    const ctx = await getTenantContext();
    if (ctx) {
      orgId = ctx.organizacaoId;
    }
  }

  if (!orgId) {
    return NextResponse.json(
      { error: "organizacaoId ou org (slug) e obrigatorio" },
      { status: 400 }
    );
  }

  // Capture IP and user agent from headers
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgent = request.headers.get("user-agent") || null;

  const { organizacaoId: _orgId, org: _orgSlug, ...insertData } = parsed.data;

  // Auto-create empresa if name provided and doesn't exist yet
  let empresaId = insertData.empresaId || null;
  if (!empresaId && insertData.empresa?.trim()) {
    const empresaNome = insertData.empresa.trim();
    // Check if empresa already exists in this org
    const [existing] = await db
      .select({ id: empresas.id })
      .from(empresas)
      .where(and(eq(empresas.organizacaoId, orgId), ilike(empresas.nome, empresaNome)))
      .limit(1);
    if (existing) {
      empresaId = existing.id;
    } else {
      const [nova] = await db
        .insert(empresas)
        .values({
          organizacaoId: orgId,
          nome: empresaNome,
          setor: insertData.empresaSetor || null,
          porte: insertData.empresaPorte || null,
          cidade: insertData.empresaCidade || null,
          estado: insertData.empresaEstado || null,
          cnpj: insertData.empresaCnpj || null,
        })
        .returning();
      empresaId = nova.id;
    }
  }

  // LP form submissions create lead + negócio automatically
  const [newLead] = await db
    .insert(leads)
    .values({
      ...insertData,
      empresaId,
      organizacaoId: orgId,
      tipo: "lead",
      ipAddress,
      userAgent,
    })
    .returning();

  // Auto-create negócio for LP leads
  const titulo = insertData.empresa
    ? `${insertData.empresa} - Novo negócio`
    : `${insertData.nome} - Novo negócio`;

  const [negocio] = await db
    .insert(negocios)
    .values({
      organizacaoId: orgId,
      leadId: newLead.id,
      empresaId,
      titulo,
      descricao: newLead.comoConheceu || undefined,
      tipoReceita: insertData.tipoReceita || undefined,
      valorProjeto: insertData.valorProjeto || undefined,
      servicosInteresse: insertData.servicosInteresse || undefined,
      concorrenteAtual: insertData.concorrenteAtual || undefined,
      contratoVenceEm: insertData.contratoVenceEm || undefined,
      origemNegocio: "novo",
      origemQualificacao: "direta", // negócio criado junto do lead, sem fluxo de reunião
      lpUrl: insertData.lpUrl || null,
    })
    .returning();

  // Update descricao via raw SQL
  try {
    const desc = String(parsed.data.comoConheceu || "");
    if (desc.length > 0) {
      console.log("[POST /api/leads] Updating descricao for negocio", negocio.id, "desc:", desc.slice(0, 50));
      await db.execute(sql`UPDATE negocios SET descricao = ${desc} WHERE id = ${negocio.id}`);
    }
  } catch (err) {
    console.error("[POST /api/leads] Failed to update descricao:", err);
  }

  // Link lead to negocio in the N:N relation table
  await db.insert(negocioLeads).values({
    negocioId: negocio.id,
    leadId: newLead.id,
    papel: "contato",
  });

  // Record initial status change
  await db.insert(statusChanges).values({
    leadId: newLead.id,
    negocioId: negocio.id,
    deStatus: null,
    paraStatus: "novo",
  });

  // Auto-trigger analysis
  if (insertData.lpUrl) {
    // Has LP → CIPA analysis (screenshot + PageSpeed + Groq)
    try {
      const { cipaAnalysisQueue } = await import("@/lib/queue");
      await cipaAnalysisQueue.add("analyze", {
        negocioId: negocio.id,
        lpUrl: insertData.lpUrl,
        organizacaoId: orgId,
      });
    } catch { /* queue not available */ }
  } else {
    // No LP → qualify from observations/data available
    try {
      const { siteLeadQualifyQueue } = await import("@/lib/queue");
      await siteLeadQualifyQueue.add("qualify", {
        negocioId: negocio.id,
        leadId: newLead.id,
        organizacaoId: orgId,
        descricao: insertData.comoConheceu || insertData.observacoes || "",
        servicosInteresse: insertData.servicosInteresse || [],
        leadNome: insertData.nome,
        telefone: insertData.telefone,
      }, { delay: 3000 });
    } catch { /* queue not available */ }
  }

  // Queue lead scoring
  await leadScoringQueue.add("score", { leadId: newLead.id });

  // Queue notification
  await notificationQueue.add("new-lead", {
    type: "new_lead",
    organizacaoId: orgId,
    data: {
      leadId: newLead.id,
      nome: newLead.nome,
      telefone: newLead.telefone,
      origem: newLead.origem,
    },
  });

  return NextResponse.json({ ...newLead, negocioId: negocio.id }, { status: 201 });
}
