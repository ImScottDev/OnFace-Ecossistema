// Scripts de Atendimento (19/08, P0.6) — roteiro humano de ligação/conversa,
// diferente de whatsapp_templates (mensagem pronta). Ver schema.ts.
import { Hono } from "hono";
import { db } from "@/lib/db";
import { scriptsAtendimento } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";

const app = new Hono();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createSchema = z.object({
  titulo: z.string().min(1),
  categoria: z.enum(["pre_vendas", "comercial_b2b", "implantacao_entrega", "onboarding", "cs", "cobranca_financeiro", "geral"]),
  conteudo: z.string().min(1),
});
const updateSchema = createSchema.partial();

app.get("/scripts-atendimento", async (c) => {
  const ctx = await getCtx(c);
  const scripts = await db
    .select()
    .from(scriptsAtendimento)
    .where(and(eq(scriptsAtendimento.organizacaoId, ctx.organizacaoId), eq(scriptsAtendimento.ativo, true)))
    .orderBy(asc(scriptsAtendimento.categoria), asc(scriptsAtendimento.titulo));
  return c.json({ scripts });
});

app.post("/scripts-atendimento", async (c) => {
  const ctx = await getCtx(c);
  const parsed = createSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  const [script] = await db.insert(scriptsAtendimento).values({ ...parsed.data, organizacaoId: ctx.organizacaoId }).returning();
  return c.json(script, 201);
});

// PATCH incrementa versão sempre que o conteúdo muda — script pode evoluir,
// mas a versão usada numa ligação passada não deve ser reescrita
// silenciosamente (auditoria/performance futura, ver briefing #187).
app.patch("/scripts-atendimento/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const parsed = updateSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);

  const [existente] = await db.select({ versao: scriptsAtendimento.versao }).from(scriptsAtendimento).where(and(eq(scriptsAtendimento.id, id), eq(scriptsAtendimento.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!existente) return c.json({ error: "Script não encontrado" }, 404);

  const [updated] = await db.update(scriptsAtendimento)
    .set({ ...parsed.data, versao: parsed.data.conteudo ? existente.versao + 1 : existente.versao, updatedAt: new Date() })
    .where(eq(scriptsAtendimento.id, id))
    .returning();
  return c.json(updated);
});

app.delete("/scripts-atendimento/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);
  const [updated] = await db.update(scriptsAtendimento).set({ ativo: false, updatedAt: new Date() })
    .where(and(eq(scriptsAtendimento.id, id), eq(scriptsAtendimento.organizacaoId, ctx.organizacaoId))).returning();
  if (!updated) return c.json({ error: "Script não encontrado" }, 404);
  return c.json({ success: true });
});

export const scriptsAtendimentoRoutes = app;
