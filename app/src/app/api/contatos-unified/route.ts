import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, contatos, contatoListas, leadListas, empresas } from "@/lib/db/schema";
import { eq, and, or, ilike, desc, sql, inArray } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// GET /api/contatos-unified — list all contacts (leads with tipo='contato' + channel info)
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") || "";
  const canal = searchParams.get("canal") || ""; // whatsapp | email | apollo | all
  const listaId = searchParams.get("lista") || "";
  const origem = searchParams.get("origem") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 100);
  const offset = (page - 1) * limit;

  // Base query: leads with tipo='contato'
  const conditions = [
    eq(leads.organizacaoId, ctx.organizacaoId),
    eq(leads.tipo, "contato"),
  ];

  if (search) {
    conditions.push(
      or(
        ilike(leads.nome, `%${search}%`),
        ilike(leads.email, `%${search}%`),
        ilike(leads.telefone, `%${search}%`),
        ilike(leads.empresa, `%${search}%`),
      )!
    );
  }

  if (origem) conditions.push(eq(leads.origem, origem));

  if (canal === "apollo") conditions.push(eq(leads.origem, "apollo"));

  // If filtering by lista, join with lead_listas
  if (listaId) {
    const memberIds = await db
      .select({ leadId: leadListas.leadId })
      .from(leadListas)
      .where(eq(leadListas.listaId, listaId));
    const ids = memberIds.map((m) => m.leadId).filter(Boolean) as string[];
    if (ids.length === 0) {
      return NextResponse.json({ contatos: [], total: 0, page, totalPages: 0 });
    }
    conditions.push(inArray(leads.id, ids));
  }

  const where = and(...conditions);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(where);
  const total = Number(countResult?.count || 0);

  const rows = await db
    .select()
    .from(leads)
    .where(where)
    .orderBy(desc(leads.createdAt))
    .limit(limit)
    .offset(offset);

  // Fetch channel contatos for each lead to show badges
  const leadIds = rows.map((r) => r.id);
  let channelMap: Record<string, string[]> = {};
  if (leadIds.length) {
    const channels = await db
      .select({ leadId: contatos.leadId, canal: contatos.canal })
      .from(contatos)
      .where(and(inArray(contatos.leadId, leadIds)));
    for (const ch of channels) {
      if (!ch.leadId) continue;
      if (!channelMap[ch.leadId]) channelMap[ch.leadId] = [];
      if (!channelMap[ch.leadId].includes(ch.canal)) {
        channelMap[ch.leadId].push(ch.canal);
      }
    }
  }

  // Fetch listas for each lead
  let listasMap: Record<string, Array<{ id: string; nome: string; cor: string }>> = {};
  if (leadIds.length) {
    const memberships = await db
      .select({ leadId: leadListas.leadId, listaId: contatoListas.id, nome: contatoListas.nome, cor: contatoListas.cor })
      .from(leadListas)
      .innerJoin(contatoListas, eq(contatoListas.id, leadListas.listaId))
      .where(inArray(leadListas.leadId, leadIds));
    for (const m of memberships) {
      if (!m.leadId) continue;
      if (!listasMap[m.leadId]) listasMap[m.leadId] = [];
      listasMap[m.leadId].push({ id: m.listaId, nome: m.nome, cor: m.cor });
    }
  }

  // Enrich with channels and listas
  const enriched = rows.map((r) => ({
    ...r,
    canais: [
      ...(channelMap[r.id] || []),
      ...(r.apolloId ? ["apollo"] : []),
    ],
    listas: listasMap[r.id] || [],
  }));

  // If filtering by canal (whatsapp/email), filter post-query
  let filtered = enriched;
  if (canal === "whatsapp") filtered = enriched.filter((c) => c.canais.includes("whatsapp"));
  if (canal === "email") filtered = enriched.filter((c) => c.canais.includes("email"));

  return NextResponse.json({
    contatos: filtered,
    total: canal && canal !== "all" && canal !== "apollo" ? filtered.length : total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

// POST /api/contatos-unified — create a contact manually
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const body = await request.json();
  const { nome, email, telefone, empresa, cargo, origem } = body;

  if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const [newLead] = await db
    .insert(leads)
    .values({
      organizacaoId: ctx.organizacaoId,
      nome,
      email: email || null,
      telefone: telefone || "",
      empresa: empresa || null,
      cargo: cargo || null,
      origem: origem || "manual",
      status: "novo",
      tipo: "contato",
      leadScore: 0,
      responsavelId: ctx.userId,
    })
    .returning();

  return NextResponse.json(newLead);
}
