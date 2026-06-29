import { Hono } from "hono";
import { db } from "@/lib/db";
import { labels } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";

const app = new Hono();

const createLabelSchema = z.object({
  nome: z.string().min(1).max(50),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve ser hex válido (#RRGGBB)"),
});

const updateLabelSchema = z.object({
  nome: z.string().min(1).max(50).optional(),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve ser hex válido (#RRGGBB)").optional(),
});

// GET /api/labels — list all labels for current org
app.get("/labels", async (c) => {
  const ctx = await getCtx(c);

  const result = await db
    .select()
    .from(labels)
    .where(eq(labels.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(labels.createdAt));

  return c.json(result);
});

// POST /api/labels — create a new label
app.post("/labels", async (c) => {
  const ctx = await getCtx(c);

  try {
    const body = await c.req.json();
    const data = createLabelSchema.parse(body);

    const [newLabel] = await db
      .insert(labels)
      .values({
        nome: data.nome,
        cor: data.cor,
        organizacaoId: ctx.organizacaoId,
      })
      .returning();

    return c.json(newLabel, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    console.error("Error creating label:", error);
    return c.json({ error: "Erro interno" }, 500);
  }
});

// PATCH /api/labels/:id — update a label
app.patch("/labels/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");

  try {
    const body = await c.req.json();
    const data = updateLabelSchema.parse(body);

    if (!data.nome && !data.cor) {
      return c.json({ error: "Nenhum campo para atualizar" }, 400);
    }

    const [updated] = await db
      .update(labels)
      .set(data)
      .where(and(eq(labels.id, id), eq(labels.organizacaoId, ctx.organizacaoId)))
      .returning();

    if (!updated) {
      return c.json({ error: "Label não encontrada" }, 404);
    }

    return c.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    console.error("Error updating label:", error);
    return c.json({ error: "Erro interno" }, 500);
  }
});

// DELETE /api/labels/:id — delete a label (cascade removes assignments)
app.delete("/labels/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");

  const [deleted] = await db
    .delete(labels)
    .where(and(eq(labels.id, id), eq(labels.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!deleted) {
    return c.json({ error: "Label não encontrada" }, 404);
  }

  return c.json({ success: true });
});

export const labelsRoutes = app;
