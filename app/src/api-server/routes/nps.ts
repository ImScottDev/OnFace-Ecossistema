import { Hono } from "hono";
import { db } from "@/lib/db";
import { npsRespostas, leads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const submitNpsSchema = z.object({
  score: z.number().int().min(0).max(10),
  comentario: z.string().optional().nullable(),
});

const app = new Hono();

// GET /nps/:token — public, no auth
app.get("/:token", async (c) => {
  const token = c.req.param("token");

  const [nps] = await db
    .select({
      id: npsRespostas.id,
      tipo: npsRespostas.tipo,
      respondidoEm: npsRespostas.respondidoEm,
      leadNome: leads.nome,
      leadEmpresa: leads.empresa,
    })
    .from(npsRespostas)
    .leftJoin(leads, eq(npsRespostas.leadId, leads.id))
    .where(eq(npsRespostas.token, token))
    .limit(1);

  if (!nps) {
    return c.json({ error: "Pesquisa nao encontrada" }, 404);
  }

  if (nps.respondidoEm) {
    return c.json({ error: "Pesquisa ja respondida" }, 400);
  }

  return c.json({
    leadNome: nps.leadNome,
    tipo: nps.tipo,
  });
});

// POST /nps/:token — public, no auth
app.post("/:token", async (c) => {
  const token = c.req.param("token");

  const body = await c.req.json();
  const parsed = submitNpsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      400
    );
  }

  // Find the NPS record
  const [nps] = await db
    .select()
    .from(npsRespostas)
    .where(eq(npsRespostas.token, token))
    .limit(1);

  if (!nps) {
    return c.json({ error: "Pesquisa nao encontrada" }, 404);
  }

  if (nps.respondidoEm) {
    return c.json({ error: "Pesquisa ja respondida" }, 400);
  }

  const [updated] = await db
    .update(npsRespostas)
    .set({
      score: parsed.data.score,
      comentario: parsed.data.comentario,
      respondidoEm: new Date(),
    })
    .where(eq(npsRespostas.token, token))
    .returning();

  // Update lead npsScore
  await db
    .update(leads)
    .set({ npsScore: parsed.data.score })
    .where(eq(leads.id, nps.leadId));

  return c.json({ message: "Resposta registrada com sucesso" });
});

export const npsRoutes = app;
