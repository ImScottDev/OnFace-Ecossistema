import { Hono } from "hono";
import { db } from "@/lib/db";
import { labels, entityLabels, leads, empresas } from "@/lib/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { adicionarTag, removerTag } from "@/lib/crm/tags";
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
}).strict();

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

// GET /api/labels/atribuicoes — quem tem qual tag (entity_labels, a canônica).
// Contatos & Empresas lê daqui: a tela usava um store local e não via nem
// gravava tag de verdade. Só lead e empresa: são as duas entidades que a tela
// de Contatos sabe endereçar.
app.get("/labels/atribuicoes", async (c) => {
  const ctx = await getCtx(c);
  const result = await db
    .select({ entityType: entityLabels.entityType, entityId: entityLabels.entityId, labelId: entityLabels.labelId })
    .from(entityLabels)
    .where(and(eq(entityLabels.organizacaoId, ctx.organizacaoId), inArray(entityLabels.entityType, ["lead", "empresa"])));
  return c.json(result);
});

const atribuirSchema = z.object({
  entityType: z.enum(["lead", "empresa"]),
  entityId: z.string().uuid(),
});

// POST|DELETE /api/labels/:id/atribuir — põe/tira a tag pela porta única
// (lib/crm/tags): ela escreve as três tabelas e publica TagAdded/TagRemoved.
for (const metodo of ["post", "delete"] as const) {
  app[metodo]("/labels/:id/atribuir", async (c) => {
    const ctx = await getCtx(c);
    const parsed = atribuirSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.issues }, 400);
    const { entityType, entityId } = parsed.data;

    // A porta não confere o dono da entidade: sem isto, um uuid de outra org gravaria tag aqui.
    const tabela = entityType === "lead" ? leads : empresas;
    const [dono] = await db.select({ id: tabela.id }).from(tabela)
      .where(and(eq(tabela.id, entityId), eq(tabela.organizacaoId, ctx.organizacaoId)));
    if (!dono) return c.json({ error: "Registro não encontrado" }, 404);

    const opts = { organizacaoId: ctx.organizacaoId, entityType, entityId, label: c.req.param("id") };
    const r = metodo === "post" ? await adicionarTag(opts) : await removerTag(opts);
    return r.ok ? c.json(r) : c.json({ error: r.erro }, 404);
  });
}

// POST /api/labels — create a new label
app.post("/labels", async (c) => {
  const ctx = await getCtx(c);

  try {
    const body = await c.req.json();
    const data = createLabelSchema.parse(body);

    // Tag com o mesmo nome (sem diferenciar caixa) na organização é a MESMA tag:
    // devolve a existente em vez de criar "QA-tag" e "qa-TAG" lado a lado. A tela
    // já checa no cliente, mas lista velha/duas abas furavam a checagem.
    const [existente] = await db
      .select()
      .from(labels)
      .where(and(eq(labels.organizacaoId, ctx.organizacaoId), sql`lower(${labels.nome}) = lower(${data.nome.trim()})`))
      .limit(1);
    if (existente) return c.json(existente, 200);

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
