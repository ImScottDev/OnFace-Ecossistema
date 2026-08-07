import { Hono } from "hono";
import { db } from "@/lib/db";
import { notas, usuarios, leads, negocios } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";

const app = new Hono();

const createSchema = z.object({
  conteudo: z.string().min(1),
  leadId: z.string().uuid().optional().nullable(),
  negocioId: z.string().uuid().optional().nullable(),
  empresaId: z.string().uuid().optional().nullable(),
});

const updateSchema = z.object({
  conteudo: z.string().min(1),
});

// GET /api/notas — list notes for the org
app.get("/notas", async (c) => {
  const ctx = await getCtx(c);

  const leadId = c.req.query("leadId") ?? null;
  const negocioId = c.req.query("negocioId") ?? null;
  const empresaId = c.req.query("empresaId") ?? null;

  const conditions = [eq(notas.organizacaoId, ctx.organizacaoId)];

  if (leadId) conditions.push(eq(notas.leadId, leadId));
  if (negocioId) conditions.push(eq(notas.negocioId, negocioId));
  if (empresaId) conditions.push(eq(notas.empresaId, empresaId));

  const result = await db.select({
    id: notas.id,
    conteudo: notas.conteudo,
    leadId: notas.leadId,
    negocioId: notas.negocioId,
    empresaId: notas.empresaId,
    autorId: notas.autorId,
    autorNome: usuarios.nome,
    createdAt: notas.createdAt,
    updatedAt: notas.updatedAt,
  }).from(notas)
    .leftJoin(usuarios, eq(notas.autorId, usuarios.id))
    .where(and(...conditions))
    .orderBy(desc(notas.createdAt));

  return c.json(result);
});

// POST /api/notas — create note
app.post("/notas", async (c) => {
  const ctx = await getCtx(c);

  try {
    const body = await c.req.json();
    const data = createSchema.parse(body);

    const [nota] = await db.insert(notas).values({
      organizacaoId: ctx.organizacaoId,
      conteudo: data.conteudo,
      leadId: data.leadId || null,
      negocioId: data.negocioId || null,
      empresaId: data.empresaId || null,
      autorId: ctx.userId,
    }).returning();

    // Nota é atividade real: reseta o relógio do badge de tempo no board de pré-vendas
    // e, se o lead tiver negócio ativo (ou a nota já for direto no negócio), no Pipeline também.
    const now = new Date();
    if (data.leadId) {
      const [updatedLead] = await db.update(leads).set({ updatedAt: now })
        .where(and(eq(leads.id, data.leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
        .returning({ negocioAtivoId: leads.negocioAtivoId });
      if (updatedLead?.negocioAtivoId) {
        await db.update(negocios).set({ updatedAt: now })
          .where(and(eq(negocios.id, updatedLead.negocioAtivoId), eq(negocios.organizacaoId, ctx.organizacaoId)));
      }
    }
    if (data.negocioId) {
      await db.update(negocios).set({ updatedAt: now })
        .where(and(eq(negocios.id, data.negocioId), eq(negocios.organizacaoId, ctx.organizacaoId)));
    }

    return c.json(nota, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    return c.json({ error: "Erro interno" }, 500);
  }
});

// PATCH /api/notas/:id — update note content
app.patch("/notas/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");

  const [existing] = await db
    .select({ id: notas.id })
    .from(notas)
    .where(and(eq(notas.id, id), eq(notas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Nota não encontrada" }, 404);
  }

  try {
    const body = await c.req.json();
    const data = updateSchema.parse(body);

    const [updated] = await db
      .update(notas)
      .set({ conteudo: data.conteudo, updatedAt: new Date() })
      .where(eq(notas.id, id))
      .returning();

    return c.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    return c.json({ error: "Erro interno" }, 500);
  }
});

// DELETE /api/notas/:id — hard delete note
app.delete("/notas/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");

  const [existing] = await db
    .select({ id: notas.id })
    .from(notas)
    .where(and(eq(notas.id, id), eq(notas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Nota não encontrada" }, 404);
  }

  await db.delete(notas).where(eq(notas.id, id));

  return c.json({ success: true });
});

export const notasRoutes = app;
