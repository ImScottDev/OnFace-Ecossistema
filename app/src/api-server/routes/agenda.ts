import { Hono } from "hono";
import { db } from "@/lib/db";
import { closerDisponibilidade, closerBloqueios, reunioes, emailContas, usuarios } from "@/lib/db/schema";
import { and, eq, gte, asc } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { getFullAvailability, formatSlotLabel, getFilaClosers } from "@/lib/crm/agenda-closers";
import { getBusyTimes } from "@/lib/email/microsoft";

// Agenda nativa das closers (self-service). Alimenta o mesmo horário/pausa/bloqueio
// que o Agente SDR lê em getAvailableSlots (lib/crm/agenda-closers.ts) — sem isso
// a configuração só existia via SQL manual.

const app = new Hono();

const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const horarioSchema = z
  .object({
    inicio: z.string().regex(horaRegex, "Hora inválida (HH:MM)"),
    fim: z.string().regex(horaRegex, "Hora inválida (HH:MM)"),
    diasSemana: z.array(z.number().int().min(0).max(6)).min(1, "Selecione ao menos um dia"),
  })
  .refine((h) => h.inicio < h.fim, { message: "Horário de início deve ser antes do fim" });

const pausaSchema = z
  .object({
    inicio: z.string().regex(horaRegex, "Hora inválida (HH:MM)"),
    fim: z.string().regex(horaRegex, "Hora inválida (HH:MM)"),
  })
  .refine((p) => p.inicio < p.fim, { message: "Pausa de almoço inválida" });

const disponibilidadeSchema = z.object({
  horarioTrabalho: horarioSchema,
  pausaAlmoco: pausaSchema.nullable().optional(),
  ativo: z.boolean().optional(),
});

// GET /agenda/disponibilidade
// Também devolve o status da conta Outlook do usuário (P6 da auditoria 23/07):
// antes disso, "nunca conectou" e "conectou mas o token expirou" eram
// indistinguíveis pra quem olha a tela — os dois só faziam a IA parar de
// cruzar com a agenda real, em silêncio.
app.get("/disponibilidade", async (c) => {
  const ctx = await getCtx(c);
  const [disp] = await db
    .select()
    .from(closerDisponibilidade)
    .where(eq(closerDisponibilidade.usuarioId, ctx.userId))
    .limit(1);

  const [conta] = await db
    .select({ syncStatus: emailContas.syncStatus, lastError: emailContas.lastError, email: emailContas.email })
    .from(emailContas)
    .where(and(eq(emailContas.usuarioId, ctx.userId), eq(emailContas.tipo, "microsoft")))
    .limit(1);

  const outlookStatus = !conta
    ? { estado: "nunca_conectado" as const, email: null, ultimoErro: null }
    : conta.syncStatus === "active" && !conta.lastError
      ? { estado: "conectado" as const, email: conta.email, ultimoErro: null }
      : { estado: "erro" as const, email: conta.email, ultimoErro: conta.lastError };

  return c.json({ disponibilidade: disp || null, outlookStatus });
});

// PUT /agenda/disponibilidade
app.put("/disponibilidade", async (c) => {
  const ctx = await getCtx(c);
  const body = await c.req.json();
  const parsed = disponibilidadeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || "Dados inválidos" }, 400);
  }

  const values = {
    organizacaoId: ctx.organizacaoId,
    usuarioId: ctx.userId,
    horarioTrabalho: parsed.data.horarioTrabalho,
    pausaAlmoco: parsed.data.pausaAlmoco ?? null,
    ativo: parsed.data.ativo ?? true,
    updatedAt: new Date(),
  };

  const [disp] = await db
    .insert(closerDisponibilidade)
    .values(values)
    .onConflictDoUpdate({ target: closerDisponibilidade.usuarioId, set: values })
    .returning();

  return c.json({ disponibilidade: disp });
});

// ─── Bloqueios pontuais (folga, férias, compromisso externo) ───────

const bloqueioSchema = z.object({
  inicio: z.string().min(1),
  fim: z.string().min(1),
  motivo: z.string().trim().max(200).optional().nullable(),
});

// GET /agenda/bloqueios — futuros, mais próximo primeiro
app.get("/bloqueios", async (c) => {
  const ctx = await getCtx(c);
  const result = await db
    .select()
    .from(closerBloqueios)
    .where(and(eq(closerBloqueios.usuarioId, ctx.userId), gte(closerBloqueios.fim, new Date())))
    .orderBy(asc(closerBloqueios.inicio));
  return c.json({ bloqueios: result });
});

// POST /agenda/bloqueios
app.post("/bloqueios", async (c) => {
  const ctx = await getCtx(c);
  const body = await c.req.json();
  const parsed = bloqueioSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || "Dados inválidos" }, 400);
  }

  const inicio = new Date(parsed.data.inicio);
  const fim = new Date(parsed.data.fim);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || inicio >= fim) {
    return c.json({ error: "Período inválido" }, 400);
  }

  const [bloqueio] = await db
    .insert(closerBloqueios)
    .values({
      organizacaoId: ctx.organizacaoId,
      usuarioId: ctx.userId,
      inicio,
      fim,
      motivo: parsed.data.motivo || null,
    })
    .returning();

  return c.json({ bloqueio });
});

// DELETE /agenda/bloqueios/:id
app.delete("/bloqueios/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  await db
    .delete(closerBloqueios)
    .where(and(eq(closerBloqueios.id, id), eq(closerBloqueios.usuarioId, ctx.userId)));
  return c.json({ ok: true });
});

// ─── Próximas reuniões (somente leitura, contexto pra closer) ──────

// GET /agenda/reunioes
app.get("/reunioes", async (c) => {
  const ctx = await getCtx(c);
  const result = await db
    .select({
      id: reunioes.id,
      titulo: reunioes.titulo,
      data: reunioes.data,
      duracao: reunioes.duracao,
      tipo: reunioes.tipo,
      status: reunioes.status,
    })
    .from(reunioes)
    .where(and(
      eq(reunioes.responsavelId, ctx.userId),
      eq(reunioes.status, "agendada"),
      gte(reunioes.data, new Date()),
    ))
    .orderBy(asc(reunioes.data))
    .limit(10);
  return c.json({ reunioes: result });
});

// ─── Fila de rodízio entre closers (transparência da distribuição) ─────────

// GET /agenda/fila-closers — ordem em que as closers vão receber os próximos
// leads (posicao 1 = próxima da vez). Pausadas aparecem no fim, sem posição.
app.get("/fila-closers", async (c) => {
  const ctx = await getCtx(c);
  const fila = await getFilaClosers(db, ctx.organizacaoId);
  return c.json({ fila });
});

// PUT /agenda/closers/:id/pausa-rodizio { pausado: boolean }
// Pausa temporária (férias/folga) sem tirar a closer da rotação permanente.
// Admin/gerente pausam qualquer uma; a própria closer pausa a si mesma.
// ":id" aceita "me" como atalho pro próprio usuário logado (usado pela tela
// "Minha Agenda", que não tem motivo pra saber o próprio UUID de antemão).
app.put("/closers/:id/pausa-rodizio", async (c) => {
  const ctx = await getCtx(c);
  const closerIdParam = c.req.param("id");
  const closerId = closerIdParam === "me" ? ctx.userId : closerIdParam;
  const body = await c.req.json().catch(() => ({}));
  const pausado = !!body.pausado;

  const podeGerenciar = ["admin", "gerente", "super_admin"].includes(ctx.userRole) || ctx.userId === closerId;
  if (!podeGerenciar) return c.json({ error: "Sem permissão pra alterar o rodízio de outra closer" }, 403);

  const [alvo] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.id, closerId), eq(usuarios.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!alvo) return c.json({ error: "Closer não encontrada" }, 404);

  // Upsert: closer pode ainda não ter configurado a agenda — cria a linha com
  // defaults de horário pra pausa valer mesmo assim.
  const [disp] = await db
    .insert(closerDisponibilidade)
    .values({
      organizacaoId: ctx.organizacaoId,
      usuarioId: closerId,
      horarioTrabalho: { inicio: "09:00", fim: "18:00", diasSemana: [1, 2, 3, 4, 5] },
      pausaAlmoco: { inicio: "12:00", fim: "13:00" },
      pausadoRodizio: pausado,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: closerDisponibilidade.usuarioId,
      set: { pausadoRodizio: pausado, updatedAt: new Date() },
    })
    .returning();

  return c.json({ ok: true, pausado: disp.pausadoRodizio });
});

// ─── Disponibilidade real de um closer (Pré-vendas) ─────────────────────────
// Cruza a agenda nativa do CRM (horário/pausa/bloqueios/reuniões já marcadas)
// com os horários ocupados de verdade no Outlook, se o closer tiver conectado
// (Configurações/Perfil > Email). Sem conta conectada, cai pra só CRM (mesmo
// comportamento de antes) — nunca trava o fluxo por falta de integração.
app.get("/closers/:id/slots-reais", async (c) => {
  const ctx = await getCtx(c);
  const closerId = c.req.param("id");
  const duracao = parseInt(c.req.query("duracao") || "30");
  const dias = Math.min(parseInt(c.req.query("dias") || "7"), 14);

  const [closer] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.id, closerId), eq(usuarios.organizacaoId, ctx.organizacaoId), eq(usuarios.ativo, true)))
    .limit(1);
  if (!closer) return c.json({ error: "Closer não encontrado" }, 404);

  const [conta] = await db
    .select({ id: emailContas.id, email: emailContas.email })
    .from(emailContas)
    .where(and(eq(emailContas.usuarioId, closerId), eq(emailContas.tipo, "microsoft"), eq(emailContas.syncStatus, "active")))
    .limit(1);

  let busyExtra: { inicio: Date; fim: Date }[] = [];
  let outlookOk = false;
  if (conta) {
    try {
      const now = new Date();
      const rangeEnd = new Date(now.getTime() + dias * 24 * 60 * 60 * 1000);
      busyExtra = await getBusyTimes(conta.id, now.toISOString(), rangeEnd.toISOString());
      outlookOk = true;
    } catch (e) {
      console.error(`[Agenda] falha ao buscar busy times do Outlook (closer ${closerId}):`, e);
    }
  }

  const diasDisp = await getFullAvailability(db, closerId, { durationMin: duracao, lookaheadDays: dias, busyExtra });

  return c.json({
    conectadoOutlook: outlookOk,
    contaEmail: conta?.email || null,
    dias: diasDisp.map((d) => ({
      data: d.data.toISOString(),
      slots: d.slots.map((s) => ({ inicio: s.inicio.toISOString(), fim: s.fim.toISOString(), label: formatSlotLabel(s) })),
    })),
  });
});

export const agendaRoutes = app;
