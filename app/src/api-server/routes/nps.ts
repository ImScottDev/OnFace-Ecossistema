import { Hono } from "hono";
import { db } from "@/lib/db";
import { npsRespostas, leads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { dispararAutomacoes } from "@/lib/crm/automacao-engine";

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
  const [leadAtualizado] = await db
    .update(leads)
    .set({ npsScore: parsed.data.score })
    .where(eq(leads.id, nps.leadId))
    .returning({ id: leads.id, nome: leads.nome, email: leads.email, telefone: leads.telefone, organizacaoId: leads.organizacaoId });

  // F5/Automation: gatilho "nps_recebido" — best-effort, endpoint público
  // (sem sessão/ctx.organizacaoId), por isso resolve a org a partir do lead.
  if (leadAtualizado?.organizacaoId) {
    try {
      await dispararAutomacoes("nps_recebido", {
        entityType: "lead",
        entityId: leadAtualizado.id,
        organizacaoId: leadAtualizado.organizacaoId,
        campos: { score: parsed.data.score, tipo: nps.tipo },
        telefone: leadAtualizado.telefone,
        email: leadAtualizado.email,
        nome: leadAtualizado.nome,
      });
    } catch (err) {
      console.error("[F5/automacao-engine] falha ao disparar automações de nps_recebido (best-effort):", err);
    }
  }

  return c.json({ message: "Resposta registrada com sucesso" });
});

export const npsRoutes = app;
