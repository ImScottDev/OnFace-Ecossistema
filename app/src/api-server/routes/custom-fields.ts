import { Hono } from "hono";
import { db } from "@/lib/db";
import { customFields } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";

const app = new Hono();

const createSchema = z.object({
  entidade: z.enum(["lead", "empresa", "negocio"]),
  nome: z.string().min(1),
  label: z.string().min(1),
  tipo: z.enum(["text", "number", "date", "daterange", "enum", "boolean", "url"]),
  opcoes: z.array(z.string()).optional().nullable(),
  obrigatorio: z.boolean().optional(),
  ordem: z.number().int().optional(),
});

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  tipo: z.enum(["text", "number", "date", "daterange", "enum", "boolean", "url"]).optional(),
  opcoes: z.array(z.string()).optional().nullable(),
  obrigatorio: z.boolean().optional(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional(),
});

// GET /api/custom-fields — list definitions for org
app.get("/custom-fields", async (c) => {
  const ctx = await getCtx(c);

  const entidade = c.req.query("entidade") ?? null;

  const conditions = [eq(customFields.organizacaoId, ctx.organizacaoId), eq(customFields.ativo, true)];
  if (entidade) {
    conditions.push(eq(customFields.entidade, entidade));
  }

  const data = await db
    .select()
    .from(customFields)
    .where(and(...conditions))
    .orderBy(asc(customFields.ordem));

  return c.json(data);
});

// POST /api/custom-fields — create definition (admin only)
app.post("/custom-fields", async (c) => {
  const ctx = await getCtx(c);
  if (!["admin", "super_admin"].includes(ctx.userRole)) {
    return c.json({ error: "Sem permissão" }, 403);
  }

  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  const [field] = await db
    .insert(customFields)
    .values({
      organizacaoId: ctx.organizacaoId,
      entidade: parsed.data.entidade,
      nome: parsed.data.nome,
      label: parsed.data.label,
      tipo: parsed.data.tipo,
      opcoes: parsed.data.opcoes || null,
      obrigatorio: parsed.data.obrigatorio ?? false,
      ordem: parsed.data.ordem ?? 0,
    })
    .returning();

  return c.json(field, 201);
});

// PUT /api/custom-fields/:id
app.put("/custom-fields/:id", async (c) => {
  const ctx = await getCtx(c);
  if (!["admin", "super_admin"].includes(ctx.userRole)) {
    return c.json({ error: "Sem permissão" }, 403);
  }

  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.label !== undefined) updateData.label = parsed.data.label;
  if (parsed.data.tipo !== undefined) updateData.tipo = parsed.data.tipo;
  if (parsed.data.opcoes !== undefined) updateData.opcoes = parsed.data.opcoes;
  if (parsed.data.obrigatorio !== undefined) updateData.obrigatorio = parsed.data.obrigatorio;
  if (parsed.data.ordem !== undefined) updateData.ordem = parsed.data.ordem;
  if (parsed.data.ativo !== undefined) updateData.ativo = parsed.data.ativo;

  const [updated] = await db
    .update(customFields)
    .set(updateData)
    .where(and(eq(customFields.id, id), eq(customFields.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) return c.json({ error: "Campo não encontrado" }, 404);
  return c.json(updated);
});

// DELETE /api/custom-fields/:id
app.delete("/custom-fields/:id", async (c) => {
  const ctx = await getCtx(c);
  if (!["admin", "super_admin"].includes(ctx.userRole)) {
    return c.json({ error: "Sem permissão" }, 403);
  }

  const id = c.req.param("id");

  // Soft delete
  const [updated] = await db
    .update(customFields)
    .set({ ativo: false, updatedAt: new Date() })
    .where(and(eq(customFields.id, id), eq(customFields.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) return c.json({ error: "Campo não encontrado" }, 404);
  return c.json({ success: true });
});

export const customFieldsRoutes = app;
