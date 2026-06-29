import { Hono } from "hono";
import { db } from "@/lib/db";
import { servicosCatalogo } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";

const app = new Hono();

const createSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  tipo: z.enum(["recorrente", "avulso", "setup"]),
  valorSugerido: z.string().optional(),
  unidade: z.enum(["mensal", "hora", "unidade", "projeto"]).default("mensal"),
  ordem: z.number().int().optional(),
});

const updateSchema = z.object({
  nome: z.string().min(1).optional(),
  descricao: z.string().optional().nullable(),
  tipo: z.enum(["recorrente", "avulso", "setup"]).optional(),
  valorSugerido: z.string().optional().nullable(),
  unidade: z.enum(["mensal", "hora", "unidade", "projeto"]).optional(),
  ativo: z.boolean().optional(),
  ordem: z.number().int().optional(),
});

// GET /api/servicos-catalogo
app.get("/servicos-catalogo", async (c) => {
  const ctx = await getCtx(c);

  const showAll = c.req.query("all") === "true";

  const conditions = [eq(servicosCatalogo.organizacaoId, ctx.organizacaoId)];
  if (!showAll) {
    conditions.push(eq(servicosCatalogo.ativo, true));
  }

  const items = await db
    .select()
    .from(servicosCatalogo)
    .where(and(...conditions))
    .orderBy(asc(servicosCatalogo.ordem), asc(servicosCatalogo.nome));

  return c.json(items);
});

// POST /api/servicos-catalogo
app.post("/servicos-catalogo", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  const [item] = await db
    .insert(servicosCatalogo)
    .values({
      organizacaoId: ctx.organizacaoId,
      nome: parsed.data.nome,
      descricao: parsed.data.descricao,
      tipo: parsed.data.tipo,
      valorSugerido: parsed.data.valorSugerido,
      unidade: parsed.data.unidade,
      ordem: parsed.data.ordem ?? 0,
    })
    .returning();

  return c.json(item, 201);
});

// PATCH /api/servicos-catalogo/:id
app.patch("/servicos-catalogo/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos" }, 400);
  }

  const [updated] = await db
    .update(servicosCatalogo)
    .set(parsed.data)
    .where(and(eq(servicosCatalogo.id, id), eq(servicosCatalogo.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) return c.json({ error: "Serviço não encontrado" }, 404);
  return c.json(updated);
});

// DELETE /api/servicos-catalogo/:id
app.delete("/servicos-catalogo/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  // Soft delete
  const [updated] = await db
    .update(servicosCatalogo)
    .set({ ativo: false })
    .where(and(eq(servicosCatalogo.id, id), eq(servicosCatalogo.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) return c.json({ error: "Serviço não encontrado" }, 404);
  return c.json({ ok: true });
});

export const servicosCatalogoRoutes = app;
