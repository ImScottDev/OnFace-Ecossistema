// Documentos de Atendimento (18/08) — biblioteca de materiais (apresentações/
// decks/PDFs) que o time consulta e envia durante uma conversa no Atendimento.
// Catálogo de METADADOS (sem upload real de arquivo) — arquivoUrl aponta pro
// material já hospedado em algum lugar (Drive, etc). Ver schema.ts.
import { Hono } from "hono";
import { db } from "@/lib/db";
import { documentosAtendimento } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";

const app = new Hono();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createSchema = z.object({
  titulo: z.string().min(1),
  categoria: z.enum(["apresentacao", "tecnico", "comercial", "manual", "outro"]),
  familia: z.enum(["CALLFACE_AI", "PABX", "WHITE_LABEL"]).nullable().optional(),
  arquivoUrl: z.string().url(),
  descricao: z.string().optional(),
});
const updateSchema = createSchema.partial();

app.get("/documentos-atendimento", async (c) => {
  const ctx = await getCtx(c);
  const documentos = await db
    .select()
    .from(documentosAtendimento)
    .where(and(eq(documentosAtendimento.organizacaoId, ctx.organizacaoId), eq(documentosAtendimento.ativo, true)))
    .orderBy(asc(documentosAtendimento.categoria), asc(documentosAtendimento.titulo));
  return c.json({ documentos });
});

app.post("/documentos-atendimento", async (c) => {
  const ctx = await getCtx(c);
  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  const [documento] = await db.insert(documentosAtendimento).values({ ...parsed.data, organizacaoId: ctx.organizacaoId }).returning();
  return c.json(documento, 201);
});

app.patch("/documentos-atendimento/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const parsed = updateSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);

  const [existente] = await db.select({ id: documentosAtendimento.id }).from(documentosAtendimento).where(and(eq(documentosAtendimento.id, id), eq(documentosAtendimento.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!existente) return c.json({ error: "Documento não encontrado" }, 404);

  const [updated] = await db.update(documentosAtendimento)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(documentosAtendimento.id, id))
    .returning();
  return c.json(updated);
});

app.delete("/documentos-atendimento/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const [updated] = await db.update(documentosAtendimento).set({ ativo: false, updatedAt: new Date() })
    .where(and(eq(documentosAtendimento.id, id), eq(documentosAtendimento.organizacaoId, ctx.organizacaoId))).returning();
  if (!updated) return c.json({ error: "Documento não encontrado" }, 404);
  return c.json({ success: true });
});

export const documentosAtendimentoRoutes = app;
