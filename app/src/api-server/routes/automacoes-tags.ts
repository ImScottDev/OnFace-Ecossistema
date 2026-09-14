import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientes, contatos, contatoLabels, empresas, entityLabels, labels, leadLabels, leads, negocios, oportunidades, servicosCanonicos } from "@/lib/db/schema";
import { publicarEvento } from "@/lib/events/outbox";
import { getCtx } from "../compat.js";

const app = new Hono();
const entityTypeSchema = z.enum(["lead", "negocio", "oportunidade", "cliente", "empresa", "contato", "servico"]);

async function entityExists(type: z.infer<typeof entityTypeSchema>, id: string, organizacaoId: string) {
  switch (type) {
    case "lead": return Boolean((await db.select({ id: leads.id }).from(leads).where(and(eq(leads.id, id), eq(leads.organizacaoId, organizacaoId))).limit(1))[0]);
    case "negocio": return Boolean((await db.select({ id: negocios.id }).from(negocios).where(and(eq(negocios.id, id), eq(negocios.organizacaoId, organizacaoId))).limit(1))[0]);
    case "oportunidade": return Boolean((await db.select({ id: oportunidades.id }).from(oportunidades).where(and(eq(oportunidades.id, id), eq(oportunidades.organizacaoId, organizacaoId))).limit(1))[0]);
    case "cliente": return Boolean((await db.select({ id: clientes.id }).from(clientes).where(and(eq(clientes.id, id), eq(clientes.organizacaoId, organizacaoId))).limit(1))[0]);
    case "empresa": return Boolean((await db.select({ id: empresas.id }).from(empresas).where(and(eq(empresas.id, id), eq(empresas.organizacaoId, organizacaoId))).limit(1))[0]);
    case "contato": return Boolean((await db.select({ id: contatos.id }).from(contatos).where(and(eq(contatos.id, id), eq(contatos.organizacaoId, organizacaoId))).limit(1))[0]);
    case "servico": return Boolean((await db.select({ id: servicosCanonicos.id }).from(servicosCanonicos).where(and(eq(servicosCanonicos.id, id), eq(servicosCanonicos.organizacaoId, organizacaoId))).limit(1))[0]);
  }
}

app.get("/automacoes/tags/:entityType/:entityId", async (c) => {
  const ctx = await getCtx(c);
  const parsed = entityTypeSchema.safeParse(c.req.param("entityType"));
  if (!parsed.success) return c.json({ error: "Tipo de entidade inválido" }, 400);
  const rows = await db.select({ id: labels.id, nome: labels.nome, cor: labels.cor, assignedAt: entityLabels.createdAt })
    .from(entityLabels).innerJoin(labels, eq(labels.id, entityLabels.labelId)).where(and(
      eq(entityLabels.organizacaoId, ctx.organizacaoId), eq(entityLabels.entityType, parsed.data), eq(entityLabels.entityId, c.req.param("entityId")),
    ));
  return c.json({ tags: rows });
});

app.post("/automacoes/tags/:entityType/:entityId", async (c) => {
  const ctx = await getCtx(c);
  const parsedType = entityTypeSchema.safeParse(c.req.param("entityType"));
  const parsedBody = z.object({ labelId: z.string().uuid() }).safeParse(await c.req.json());
  if (!parsedType.success || !parsedBody.success) return c.json({ error: "Dados inválidos" }, 400);
  const entityId = c.req.param("entityId");
  if (!await entityExists(parsedType.data, entityId, ctx.organizacaoId)) return c.json({ error: "Entidade não encontrada" }, 404);
  const [label] = await db.select().from(labels).where(and(eq(labels.id, parsedBody.data.labelId), eq(labels.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!label) return c.json({ error: "Tag não encontrada" }, 404);
  const [assignment] = await db.insert(entityLabels).values({ organizacaoId: ctx.organizacaoId, entityType: parsedType.data, entityId, labelId: label.id, createdById: ctx.userId }).onConflictDoNothing().returning();
  if (parsedType.data === "lead") await db.insert(leadLabels).values({ leadId: entityId, labelId: label.id }).onConflictDoNothing();
  if (parsedType.data === "contato") await db.insert(contatoLabels).values({ contatoId: entityId, labelId: label.id }).onConflictDoNothing();
  if (assignment) await publicarEvento({ organizacaoId: ctx.organizacaoId, eventType: "TagAdded", aggregateType: parsedType.data, aggregateId: entityId, payload: { entityType: parsedType.data, entityId, labelId: label.id, tag: label.nome }, idempotencyKey: `tag:add:${assignment.id}` });
  return c.json({ assignment: assignment ?? null, tag: label, deduplicated: !assignment }, assignment ? 201 : 200);
});

app.delete("/automacoes/tags/:entityType/:entityId/:labelId", async (c) => {
  const ctx = await getCtx(c);
  const parsedType = entityTypeSchema.safeParse(c.req.param("entityType"));
  if (!parsedType.success) return c.json({ error: "Tipo de entidade inválido" }, 400);
  const entityId = c.req.param("entityId"); const labelId = c.req.param("labelId");
  const [label] = await db.select({ nome: labels.nome }).from(labels).where(and(eq(labels.id, labelId), eq(labels.organizacaoId, ctx.organizacaoId))).limit(1);
  const removed = await db.delete(entityLabels).where(and(eq(entityLabels.organizacaoId, ctx.organizacaoId), eq(entityLabels.entityType, parsedType.data), eq(entityLabels.entityId, entityId), eq(entityLabels.labelId, labelId))).returning({ id: entityLabels.id });
  if (parsedType.data === "lead") await db.delete(leadLabels).where(and(eq(leadLabels.leadId, entityId), eq(leadLabels.labelId, labelId)));
  if (parsedType.data === "contato") await db.delete(contatoLabels).where(and(eq(contatoLabels.contatoId, entityId), eq(contatoLabels.labelId, labelId)));
  if (removed.length) await publicarEvento({ organizacaoId: ctx.organizacaoId, eventType: "TagRemoved", aggregateType: parsedType.data, aggregateId: entityId, payload: { entityType: parsedType.data, entityId, labelId, tag: label?.nome ?? null }, idempotencyKey: `tag:remove:${removed[0].id}` });
  return c.json({ ok: true, removed: removed.length });
});

export { app as automacoesTagsRoutes };
