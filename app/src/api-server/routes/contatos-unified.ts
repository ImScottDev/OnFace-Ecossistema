import { Hono } from "hono";
import { db } from "@/lib/db";
import { leads, contatos, contatoListas, leadListas, empresas, atividades } from "@/lib/db/schema";
import { eq, and, or, ilike, desc, sql, inArray } from "drizzle-orm";
import { getCtx, parseBody } from "../compat.js";
import { syncPessoaFromLead } from "@/lib/crm/sync-domain-model";

const app = new Hono();

// ── GET /contatos-unified ────────────────────────────────────────────

app.get("/contatos-unified", async (c) => {
  const ctx = await getCtx(c);

  const search = c.req.query("search") ?? "";
  const canal = c.req.query("canal") ?? ""; // whatsapp | email | apollo | all
  const listaId = c.req.query("lista") ?? "";
  const origem = c.req.query("origem") ?? "";
  // Página unificada Leads+Contatos (13/jul): tipo filtra contato|lead|cliente.
  // Sem o param, mostra os 3 juntos — não filtra por tipo.
  const tipo = c.req.query("tipo") ?? "";
  const page = parseInt(c.req.query("page") ?? "1");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "25"), 100);
  const offset = (page - 1) * limit;

  const conditions = [eq(leads.organizacaoId, ctx.organizacaoId)];
  if (tipo === "contato" || tipo === "lead" || tipo === "cliente") {
    conditions.push(eq(leads.tipo, tipo));
  }

  if (search) {
    // Busca em nome/email/telefone/empresa (texto solto) + empresa vinculada por empresaId.
    const searchPattern = `%${search}%`;
    conditions.push(
      or(
        ilike(leads.nome, searchPattern),
        ilike(leads.email, searchPattern),
        ilike(leads.telefone, searchPattern),
        ilike(leads.empresa, searchPattern),
        sql`EXISTS (SELECT 1 FROM ${empresas} WHERE ${empresas.id} = ${leads.empresaId} AND ${empresas.nome} ILIKE ${searchPattern})`,
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
      return c.json({ contatos: [], total: 0, page, totalPages: 0 });
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

  return c.json({
    contatos: filtered,
    total: canal && canal !== "all" && canal !== "apollo" ? filtered.length : total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// ── POST /contatos-unified ───────────────────────────────────────────

app.post("/contatos-unified", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const { nome, email, telefone, empresa, cargo, origem } = body;

  if (!nome) return c.json({ error: "Nome obrigatório" }, 400);

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

  // F1/dual-write: contato manual novo — best-effort.
  await syncPessoaFromLead(newLead.id);

  return c.json(newLead);
});

// ── PATCH /contatos-unified/:id ──────────────────────────────────────

app.patch("/contatos-unified/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json();

  // Only allow updating safe fields
  const allowed = ["nome", "email", "telefone", "empresa", "cargo", "linkedin", "origem", "status"] as const;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const [updated] = await db
    .update(leads)
    .set(updates)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) return c.json({ error: "Contato não encontrado" }, 404);

  return c.json(updated);
});

// ── DELETE /contatos-unified/:id ─────────────────────────────────────

app.delete("/contatos-unified/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  await db
    .delete(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)));

  return c.json({ ok: true });
});

// ── POST /contatos-unified/:id/converter ─────────────────────────────

app.post("/contatos-unified/:id/converter", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  // Find the contato
  const [contato] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId), eq(leads.tipo, "contato")))
    .limit(1);

  if (!contato) {
    return c.json({ error: "Contato não encontrado" }, 404);
  }

  // Convert: change tipo from 'contato' to 'lead'
  const [updated] = await db
    .update(leads)
    .set({
      tipo: "lead",
      status: "novo",
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id))
    .returning();

  // Log activity
  await db.insert(atividades).values({
    organizacaoId: ctx.organizacaoId,
    leadId: id,
    usuarioId: ctx.userId,
    tipo: "nota",
    descricao: `Contato convertido em lead`,
  });

  return c.json(updated);
});

// ── GET /contatos-unified/listas ─────────────────────────────────────

app.get("/contatos-unified/listas", async (c) => {
  const ctx = await getCtx(c);

  const listas = await db
    .select({
      id: contatoListas.id,
      nome: contatoListas.nome,
      cor: contatoListas.cor,
      descricao: contatoListas.descricao,
      createdAt: contatoListas.createdAt,
      count: sql<number>`(SELECT count(*) FROM lead_listas WHERE lista_id = ${contatoListas.id})`,
    })
    .from(contatoListas)
    .where(eq(contatoListas.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(contatoListas.createdAt));

  return c.json(listas);
});

// ── POST /contatos-unified/listas ────────────────────────────────────

app.post("/contatos-unified/listas", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();

  // If action is provided, it's an add/remove operation
  if (body.action === "add" && body.listaId && body.leadIds?.length) {
    for (const leadId of body.leadIds) {
      await db.insert(leadListas).values({ leadId, listaId: body.listaId }).onConflictDoNothing();
    }
    return c.json({ ok: true, added: body.leadIds.length });
  }

  if (body.action === "remove" && body.listaId && body.leadIds?.length) {
    for (const leadId of body.leadIds) {
      await db.delete(leadListas).where(and(eq(leadListas.leadId, leadId), eq(leadListas.listaId, body.listaId)));
    }
    return c.json({ ok: true, removed: body.leadIds.length });
  }

  // Create new lista
  const { nome, cor, descricao } = body;
  if (!nome) return c.json({ error: "Nome obrigatório" }, 400);

  const [lista] = await db
    .insert(contatoListas)
    .values({
      organizacaoId: ctx.organizacaoId,
      nome,
      cor: cor || "#e23752",
      descricao: descricao || null,
    })
    .returning();

  return c.json(lista);
});

// ── DELETE /contatos-unified/listas ──────────────────────────────────

app.delete("/contatos-unified/listas", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.query("id") ?? null;
  if (!id) return c.json({ error: "ID obrigatório" }, 400);

  await db.delete(contatoListas).where(and(eq(contatoListas.id, id), eq(contatoListas.organizacaoId, ctx.organizacaoId)));

  return c.json({ ok: true });
});

export const contatosUnifiedRoutes = app;
