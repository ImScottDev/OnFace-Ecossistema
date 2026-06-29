import { Hono } from "hono";
import { db } from "@/lib/db";
import { notificacoes } from "@/lib/db/schema";
import { desc, eq, and, SQL } from "drizzle-orm";
import { getCtx } from "../compat.js";

const app = new Hono();

// GET /api/notificacoes
app.get("/notificacoes", async (c) => {
  const ctx = await getCtx(c);

  const lida = c.req.query("lida") ?? null;

  const conditions: SQL[] = [eq(notificacoes.usuarioId, ctx.userId)];

  if (lida !== null && lida !== "") {
    conditions.push(eq(notificacoes.lida, lida === "true"));
  }

  const where = and(...conditions);

  const result = await db
    .select()
    .from(notificacoes)
    .where(where)
    .orderBy(desc(notificacoes.createdAt))
    .limit(100);

  return c.json({ notificacoes: result });
});

// PATCH /api/notificacoes/:id — mark as read
app.patch("/notificacoes/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");

  // Only allow marking own notifications as read
  const [updated] = await db
    .update(notificacoes)
    .set({ lida: true })
    .where(and(eq(notificacoes.id, id), eq(notificacoes.usuarioId, ctx.userId)))
    .returning();

  if (!updated) {
    return c.json({ error: "Notificacao nao encontrada" }, 404);
  }

  return c.json(updated);
});

export const notificacoesRoutes = app;
