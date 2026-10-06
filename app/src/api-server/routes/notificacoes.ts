import { Hono } from "hono";
import { db } from "@/lib/db";
import { notificacoes } from "@/lib/db/schema";
import { desc, eq, and, sql, SQL } from "drizzle-orm";
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

  /* A contagem de não lidas acompanha a lista: é ela que acende (ou apaga) o
     ponto do sino. Antes o ponto era um <span> sem condição, sempre aceso. */
  const [{ naoLidas }] = await db
    .select({ naoLidas: sql<number>`count(*)::int` })
    .from(notificacoes)
    .where(and(eq(notificacoes.usuarioId, ctx.userId), eq(notificacoes.lida, false)));

  return c.json({ notificacoes: result, naoLidas });
});

/* PATCH /api/notificacoes — marca TODAS as minhas como lidas.
   Marcar como lida não conclui tarefa nenhuma: a obrigação continua na tarefa,
   a notificação só chamava atenção para ela. */
app.patch("/notificacoes", async (c) => {
  const ctx = await getCtx(c);
  const marcadas = await db
    .update(notificacoes)
    .set({ lida: true })
    .where(and(eq(notificacoes.usuarioId, ctx.userId), eq(notificacoes.lida, false)))
    .returning({ id: notificacoes.id });
  return c.json({ ok: true, marcadas: marcadas.length });
});

// PATCH /api/notificacoes/:id — mark as read
app.patch("/notificacoes/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");

  // Id fora do formato uuid faz o Postgres estourar (500) em vez de 404. Como a
  // coluna é uuid, uma validação barata aqui transforma lixo em "não encontrada".
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return c.json({ error: "Notificacao nao encontrada" }, 404);
  }

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
