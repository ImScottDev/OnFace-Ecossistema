import { Hono } from "hono";
import { db } from "@/lib/db";
import { reunioes, usuarios, emailContas, leads } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { deleteOutlookEvent, createOutlookEvent } from "@/lib/email/microsoft";
import { atualizarNaAgenda, cancelarNaAgenda } from "@/lib/calendario/sincronizar";
import { registrarEvento, type TipoEventoVendas } from "@/lib/vendas/eventos";

type OutlookResultado = { criado: boolean; motivo: string | null };

/**
 * Cria o evento de verdade no Outlook do responsável, mesmo padrão já usado
 * em `leads.ts` (fluxo de converter oportunidade) — resultado estruturado,
 * nunca falha silenciosa, nunca trava a criação da reunião no CRM (best-effort).
 */
async function criarEventoOutlookSeConectado(reuniaoId: string, responsavelId: string, attendeeEmailInformado: string | null): Promise<OutlookResultado> {
  const [conta] = await db
    .select({ id: emailContas.id })
    .from(emailContas)
    .where(and(eq(emailContas.usuarioId, responsavelId), eq(emailContas.tipo, "microsoft"), eq(emailContas.syncStatus, "active")))
    .limit(1);

  if (!conta) return { criado: false, motivo: "closer_sem_outlook" };

  try {
    const [reuniao] = await db
      .select({ titulo: reunioes.titulo, data: reunioes.data, duracao: reunioes.duracao, notas: reunioes.notas, leadId: reunioes.leadId })
      .from(reunioes)
      .where(eq(reunioes.id, reuniaoId))
      .limit(1);
    if (!reuniao) return { criado: false, motivo: "erro_graph" };

    let attendee = attendeeEmailInformado;
    if (!attendee && reuniao.leadId) {
      const [lead] = await db.select({ email: leads.email }).from(leads).where(eq(leads.id, reuniao.leadId)).limit(1);
      attendee = lead?.email || null;
    }

    const inicio = new Date(reuniao.data);
    const fim = new Date(inicio.getTime() + (reuniao.duracao || 30) * 60000);
    const evento = await createOutlookEvent({
      contaId: conta.id,
      titulo: reuniao.titulo,
      inicioISO: inicio.toISOString(),
      fimISO: fim.toISOString(),
      attendeeEmail: attendee,
      corpo: reuniao.notas || null,
    });

    await db
      .update(reunioes)
      .set({
        link: evento.joinUrl || evento.webLink,
        outlookEventId: evento.eventId,
        participantes: attendee ? [attendee] : undefined,
        updatedAt: new Date(),
      })
      .where(eq(reunioes.id, reuniaoId));

    return { criado: true, motivo: attendee ? null : "sem_email_destinatario" };
  } catch (e) {
    const msg = String(e);
    console.error(`[Reunioes] falha ao criar evento no Outlook (reunião ${reuniaoId}):`, e);
    return { criado: false, motivo: /401|invalid_grant|token|expirad/i.test(msg) ? "token_expirado" : "erro_graph" };
  }
}

/**
 * Evento de domínio da reunião (MeetingScheduled/Completed/Cancelled/Rescheduled).
 *
 * Criar, realizar, cancelar e reagendar pela API só mexia na linha de `reunioes`:
 * não saía evento nem linha na timeline, e os relatórios por evento (agenda,
 * comparecimento) não enxergavam a reunião. No-show fica de fora: a tela já
 * chama `registrarNoShow`, que grava o evento. Best-effort: nunca derruba o
 * salvar. Sem repetir o mesmo fato da mesma reunião (exceto reagendamento).
 */
async function eventoDaReuniao(
  ctx: { organizacaoId: string; userId: string },
  r: { id: string; negocioId: string | null; leadId: string | null; data: Date },
  tipo: Extract<TipoEventoVendas, "MeetingScheduled" | "MeetingCompleted" | "MeetingCancelled" | "MeetingRescheduled">,
  titulo: string,
) {
  if (!r.negocioId && !r.leadId) return;
  try {
    if (tipo !== "MeetingRescheduled") {
      const jaTem = await db.execute(sql`SELECT 1 FROM vendas_eventos WHERE reuniao_id = ${r.id}::uuid AND tipo = ${tipo} LIMIT 1`);
      if ((jaTem as unknown as unknown[]).length) return;
    }
    await registrarEvento({
      organizacaoId: ctx.organizacaoId, tipo, ator: { tipo: "HUMAN", usuarioId: ctx.userId },
      negocioId: r.negocioId, leadId: r.leadId, reuniaoId: r.id,
      contexto: { data: r.data.toISOString() },
      timeline: { tipo: "reuniao", titulo, descricao: r.data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) },
    });
  } catch (e) {
    console.error(`[Reunioes] evento ${tipo} não gravado (best-effort):`, e);
  }
}

const app = new Hono();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  data: z.string().min(1).refine((v) => !isNaN(new Date(v).getTime()), "Data invalida"), // ISO string (lixo virava 500 no insert)
  duracao: z.number().int().positive().optional().nullable(),
  tipo: z.enum(["call", "presencial", "video"]).optional(),
  status: z.enum(["agendada", "realizada", "cancelada", "no_show"]).optional(),
  participantes: z.array(z.string()).optional().nullable(),
  notas: z.string().optional().nullable(),
  transcript: z.string().optional().nullable(),
  resumoTranscript: z.string().optional().nullable(),
  // Novo Evento (calendário) — quem vai ser o responsável real do evento
  // (default é quem tá criando) e o e-mail de quem convidar, se não vier
  // de um lead vinculado.
  responsavelId: z.string().uuid().optional().nullable(),
  criarNoOutlook: z.boolean().optional(),
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
  data: z.string().refine((v) => !isNaN(new Date(v).getTime()), "Data invalida").optional(),
  duracao: z.number().int().positive().optional().nullable(),
  tipo: z.enum(["call", "presencial", "video"]).optional(),
  status: z.enum(["agendada", "realizada", "cancelada", "no_show"]).optional(),
  participantes: z.array(z.string()).optional().nullable(),
  notas: z.string().optional().nullable(),
  transcript: z.string().optional().nullable(),
  resumoTranscript: z.string().optional().nullable(),
}).strict();

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

    const responsavelId = data.responsavelId || ctx.userId;

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
        responsavelId,
      })
      .returning();

    await eventoDaReuniao(ctx, reuniao, "MeetingScheduled", "Reunião agendada");

    // Outlook é opt-in por evento (compromisso interno não precisa gerar
    // Teams nem convite) — default true pra reunião/ligação/follow-up fazer
    // sentido sem o usuário precisar lembrar de marcar.
    let outlook: OutlookResultado = { criado: false, motivo: null };
    let reuniaoFinal = reuniao;
    if (data.criarNoOutlook !== false) {
      // Fallback vindo de produção: quando o chamador não manda attendeeEmail,
      // procura um e-mail na lista de participantes antes de desistir.
      const attendee = data.attendeeEmail
        || (Array.isArray(data.participantes) ? data.participantes.find((p: string) => p.includes("@")) : null)
        || null;
      outlook = await criarEventoOutlookSeConectado(reuniao.id, responsavelId, attendee);
      if (outlook.criado) {
        const [atualizada] = await db.select().from(reunioes).where(eq(reunioes.id, reuniao.id)).limit(1);
        if (atualizada) reuniaoFinal = atualizada;
      }
    }

    return c.json({ ...reuniaoFinal, outlook }, 201);
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
  if (!UUID_RE.test(id)) return c.json({ error: "Reunião não encontrada" }, 404); // uuid inválido estourava 500 no Postgres

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
  if (!UUID_RE.test(id)) return c.json({ error: "Reunião não encontrada" }, 404); // uuid inválido estourava 500 no Postgres

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

    const [antes] = data.data !== undefined
      ? await db.select({ data: reunioes.data }).from(reunioes).where(and(eq(reunioes.id, id), eq(reunioes.organizacaoId, ctx.organizacaoId))).limit(1)
      : [];

    const [updated] = await db
      .update(reunioes)
      .set(updates)
      .where(and(eq(reunioes.id, id), eq(reunioes.organizacaoId, ctx.organizacaoId)))
      .returning();

    if (!updated) {
      return c.json({ error: "Reunião não encontrada" }, 404);
    }

    if (data.status === "realizada") await eventoDaReuniao(ctx, updated, "MeetingCompleted", "Reunião realizada");
    else if (data.status === "cancelada") await eventoDaReuniao(ctx, updated, "MeetingCancelled", "Reunião cancelada");
    else if (antes && new Date(antes.data).getTime() !== new Date(updated.data).getTime()) await eventoDaReuniao(ctx, updated, "MeetingRescheduled", "Reunião reagendada");

    // CalendarProvider (Módulo 09): create, update E cancel sincronizam.
    //
    // O update é o que faltava. Antes, mudar a data aqui alterava só a linha
    // do ONFACE e o cliente ficava com o convite antigo na agenda, sem
    // ninguém ser avisado. Agora reagendar, renomear e mudar duração chegam
    // no provedor — e quando não chegam, a tela recebe o motivo.
    let avisoAgenda: string | null = null;
    if (data.status === "cancelada") {
      const r = await cancelarNaAgenda(ctx.organizacaoId, id);
      avisoAgenda = r.aviso ?? null;
    } else if (data.data !== undefined || data.titulo !== undefined || data.duracao !== undefined) {
      const r = await atualizarNaAgenda(ctx.organizacaoId, id);
      avisoAgenda = r.aviso ?? null;
    }

    return c.json({ ...updated, avisoAgenda });
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
  if (!UUID_RE.test(id)) return c.json({ error: "Reunião não encontrada" }, 404); // uuid inválido estourava 500 no Postgres

  // Só cancela no Outlook se a reunião for desta organização: antes o evento era
  // apagado ANTES da checagem de org, então um id de outra org cancelava o convite dela.
  const [daOrg] = await db.select({ id: reunioes.id }).from(reunioes)
    .where(and(eq(reunioes.id, id), eq(reunioes.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!daOrg) return c.json({ error: "Reunião não encontrada" }, 404);
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
