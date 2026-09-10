import { Hono } from "hono";
import { db } from "@/lib/db";
import { reunioes, usuarios, emailContas } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { deleteOutlookEvent } from "@/lib/email/microsoft";
import { criarEventoOutlookParaReuniao } from "@/lib/crm/outlook-evento";

const app = new Hono();

/** Cancela o evento no Outlook do responsável pela reunião, se existir. Best-effort. */
async function cancelarEventoOutlookSeExistir(reuniaoId: string) {
  const [reuniao] = await db
    .select({ outlookEventId: reunioes.outlookEventId, responsavelId: reunioes.responsavelId })
    .from(reunioes)
    .where(eq(reunioes.id, reuniaoId))
    .limit(1);
  if (!reuniao?.outlookEventId || !reuniao.responsavelId) return;

  const [conta] = await db
    .select({ id: emailContas.id })
    .from(emailContas)
    .where(and(eq(emailContas.usuarioId, reuniao.responsavelId), eq(emailContas.tipo, "microsoft"), eq(emailContas.syncStatus, "active")))
    .limit(1);
  if (!conta) return;

  await deleteOutlookEvent(conta.id, reuniao.outlookEventId).catch((e) => {
    console.error(`[Reunioes] falha ao cancelar evento Outlook da reunião ${reuniaoId}:`, e);
  });
}

const createSchema = z.object({
  negocioId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  titulo: z.string().min(1),
  data: z.string().min(1), // ISO string
  duracao: z.number().int().positive().optional().nullable(),
  tipo: z.enum(["call", "presencial", "video"]).optional(),
  status: z.enum(["agendada", "realizada", "cancelada", "no_show"]).optional(),
  participantes: z.array(z.string()).optional().nullable(),
  notas: z.string().optional().nullable(),
  transcript: z.string().optional().nullable(),
  resumoTranscript: z.string().optional().nullable(),
  /**
   * E-mail do cliente a convidar. O Onboarding já mandava este campo desde
   * sempre, mas ele não existia aqui — e como o Zod não é `.strict()`, era
   * descartado em silêncio: a reunião nascia só na tabela, sem evento no
   * Outlook e sem convite pro cliente, com a UI dizendo "agendada".
   */
  attendeeEmail: z.string().email().optional().nullable(),
});

const updateSchema = z.object({
  titulo: z.string().min(1).optional(),
  data: z.string().optional(),
  duracao: z.number().int().positive().optional().nullable(),
  tipo: z.enum(["call", "presencial", "video"]).optional(),
  status: z.enum(["agendada", "realizada", "cancelada", "no_show"]).optional(),
  participantes: z.array(z.string()).optional().nullable(),
  notas: z.string().optional().nullable(),
  transcript: z.string().optional().nullable(),
  resumoTranscript: z.string().optional().nullable(),
});

// GET /api/reunioes
app.get("/reunioes", async (c) => {
  const ctx = await getCtx(c);

  const negocioId = c.req.query("negocioId") ?? null;
  const leadId = c.req.query("leadId") ?? null;
  const status = c.req.query("status") ?? null;

  const conditions = [eq(reunioes.organizacaoId, ctx.organizacaoId)];
  if (negocioId) conditions.push(eq(reunioes.negocioId, negocioId));
  if (leadId) conditions.push(eq(reunioes.leadId, leadId));
  if (status) conditions.push(eq(reunioes.status, status));

  const result = await db
    .select({
      id: reunioes.id,
      negocioId: reunioes.negocioId,
      leadId: reunioes.leadId,
      titulo: reunioes.titulo,
      data: reunioes.data,
      duracao: reunioes.duracao,
      tipo: reunioes.tipo,
      status: reunioes.status,
      participantes: reunioes.participantes,
      notas: reunioes.notas,
      transcript: reunioes.transcript,
      resumoTranscript: reunioes.resumoTranscript,
      responsavelNome: usuarios.nome,
      createdAt: reunioes.createdAt,
    })
    .from(reunioes)
    .leftJoin(usuarios, eq(reunioes.responsavelId, usuarios.id))
    .where(and(...conditions))
    .orderBy(desc(reunioes.data));

  return c.json(result);
});

// POST /api/reunioes
app.post("/reunioes", async (c) => {
  const ctx = await getCtx(c);

  try {
    const body = await c.req.json();
    const data = createSchema.parse(body);

    const [reuniao] = await db
      .insert(reunioes)
      .values({
        organizacaoId: ctx.organizacaoId,
        negocioId: data.negocioId || null,
        leadId: data.leadId || null,
        titulo: data.titulo,
        data: new Date(data.data),
        duracao: data.duracao || null,
        tipo: data.tipo || "call",
        status: data.status || "agendada",
        participantes: data.participantes || null,
        notas: data.notas || null,
        transcript: data.transcript || null,
        resumoTranscript: data.resumoTranscript || null,
        responsavelId: ctx.userId,
      })
      .returning();

    // A reunião só existe de verdade quando está na agenda de quem vai
    // conduzi-la e o cliente recebeu convite. `outlook` volta pra UI poder
    // dizer a verdade quando isso não acontecer.
    const attendee = data.attendeeEmail
      || (Array.isArray(data.participantes) ? data.participantes.find((p) => p.includes("@")) : null)
      || null;

    const outlook = await criarEventoOutlookParaReuniao({
      reuniaoId: reuniao.id,
      usuarioId: ctx.userId,
      attendeeEmail: attendee,
      origem: "Reunioes",
    });

    const [atualizada] = await db
      .select()
      .from(reunioes)
      .where(eq(reunioes.id, reuniao.id))
      .limit(1);

    return c.json({ ...(atualizada || reuniao), outlook }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: err.issues[0].message }, 400);
    }
    throw err;
  }
});

// GET /api/reunioes/:id
app.get("/reunioes/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");

  const [reuniao] = await db
    .select()
    .from(reunioes)
    .where(and(eq(reunioes.id, id), eq(reunioes.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!reuniao) {
    return c.json({ error: "Reunião não encontrada" }, 404);
  }

  return c.json(reuniao);
});

// PATCH /api/reunioes/:id
app.patch("/reunioes/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");

  try {
    const body = await c.req.json();
    const data = updateSchema.parse(body);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.titulo !== undefined) updates.titulo = data.titulo;
    if (data.data !== undefined) updates.data = new Date(data.data);
    if (data.duracao !== undefined) updates.duracao = data.duracao;
    if (data.tipo !== undefined) updates.tipo = data.tipo;
    if (data.status !== undefined) updates.status = data.status;
    if (data.participantes !== undefined) updates.participantes = data.participantes;
    if (data.notas !== undefined) updates.notas = data.notas;
    if (data.transcript !== undefined) updates.transcript = data.transcript;
    if (data.resumoTranscript !== undefined) updates.resumoTranscript = data.resumoTranscript;

    const [updated] = await db
      .update(reunioes)
      .set(updates)
      .where(and(eq(reunioes.id, id), eq(reunioes.organizacaoId, ctx.organizacaoId)))
      .returning();

    if (!updated) {
      return c.json({ error: "Reunião não encontrada" }, 404);
    }

    if (data.status === "cancelada") {
      await cancelarEventoOutlookSeExistir(id);
    }

    return c.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: err.issues[0].message }, 400);
    }
    throw err;
  }
});

// DELETE /api/reunioes/:id
app.delete("/reunioes/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");

  await cancelarEventoOutlookSeExistir(id);

  const [deleted] = await db
    .delete(reunioes)
    .where(and(eq(reunioes.id, id), eq(reunioes.organizacaoId, ctx.organizacaoId)))
    .returning({ id: reunioes.id });

  if (!deleted) {
    return c.json({ error: "Reunião não encontrada" }, 404);
  }

  return c.json({ ok: true });
});

export const reunioesRoutes = app;
