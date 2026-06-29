import { Hono } from "hono";
import { db } from "@/lib/db";
import { pipelines, negocios } from "@/lib/db/schema";
import { eq, and, asc, count } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";

const app = new Hono();

const createPipelineSchema = z.object({
  nome: z.string().min(1),
  slug: z.string().min(1),
  ordem: z.number().int().optional(),
  stages: z.array(z.object({
    key: z.string(),
    label: z.string(),
    color: z.string(),
    slaHours: z.number().optional(),
  })).optional(),
  closedStages: z.array(z.object({
    key: z.string(),
    label: z.string(),
    color: z.string(),
  })).optional(),
  isDefault: z.boolean().optional(),
});

const updatePipelineSchema = z.object({
  nome: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  ordem: z.number().int().optional(),
  stages: z.array(z.object({
    key: z.string(),
    label: z.string(),
    color: z.string(),
    slaHours: z.number().optional(),
  })).optional(),
  closedStages: z.array(z.object({
    key: z.string(),
    label: z.string(),
    color: z.string(),
  })).optional(),
  isDefault: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

// GET /api/pipelines — list pipelines for org
app.get("/pipelines", async (c) => {
  const ctx = await getCtx(c);

  const data = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.organizacaoId, ctx.organizacaoId))
    .orderBy(asc(pipelines.ordem));

  return c.json({ pipelines: data });
});

// POST /api/pipelines — create pipeline
app.post("/pipelines", async (c) => {
  const ctx = await getCtx(c);
  if (!["admin", "super_admin"].includes(ctx.userRole)) {
    return c.json({ error: "Sem permissão" }, 403);
  }

  const body = await c.req.json();
  const parsed = createPipelineSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  const [pipeline] = await db
    .insert(pipelines)
    .values({
      organizacaoId: ctx.organizacaoId,
      nome: parsed.data.nome,
      slug: parsed.data.slug,
      ordem: parsed.data.ordem ?? 0,
      stages: parsed.data.stages ?? [],
      closedStages: parsed.data.closedStages ?? [],
      isDefault: parsed.data.isDefault ?? false,
    })
    .returning();

  return c.json(pipeline, 201);
});

// GET /api/pipelines/:id
app.get("/pipelines/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");
  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.organizacaoId, ctx.organizacaoId)));

  if (!pipeline) return c.json({ error: "Pipeline não encontrado" }, 404);
  return c.json(pipeline);
});

// PUT /api/pipelines/:id
app.put("/pipelines/:id", async (c) => {
  const ctx = await getCtx(c);
  if (!["admin", "super_admin"].includes(ctx.userRole)) {
    return c.json({ error: "Sem permissão" }, 403);
  }

  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updatePipelineSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.nome !== undefined) updateData.nome = parsed.data.nome;
  if (parsed.data.slug !== undefined) updateData.slug = parsed.data.slug;
  if (parsed.data.ordem !== undefined) updateData.ordem = parsed.data.ordem;
  if (parsed.data.stages !== undefined) updateData.stages = parsed.data.stages;
  if (parsed.data.closedStages !== undefined) updateData.closedStages = parsed.data.closedStages;
  if (parsed.data.isDefault !== undefined) updateData.isDefault = parsed.data.isDefault;
  if (parsed.data.ativo !== undefined) updateData.ativo = parsed.data.ativo;

  const [updated] = await db
    .update(pipelines)
    .set(updateData)
    .where(and(eq(pipelines.id, id), eq(pipelines.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) return c.json({ error: "Pipeline não encontrado" }, 404);
  return c.json(updated);
});

// DELETE /api/pipelines/:id
app.delete("/pipelines/:id", async (c) => {
  const ctx = await getCtx(c);
  if (!["admin", "super_admin"].includes(ctx.userRole)) {
    return c.json({ error: "Sem permissão" }, 403);
  }

  const id = c.req.param("id");

  // Check if pipeline has associated deals
  const [{ total }] = await db
    .select({ total: count() })
    .from(negocios)
    .where(eq(negocios.pipelineId, id));

  if (total > 0) {
    return c.json(
      { error: `Não é possível excluir: ${total} negócio(s) vinculado(s). Mova-os para outro pipeline primeiro.` },
      409
    );
  }

  const [deleted] = await db
    .delete(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!deleted) return c.json({ error: "Pipeline não encontrado" }, 404);
  return c.json({ success: true });
});

export const pipelinesRoutes = app;
