import { Hono } from "hono";
import { db } from "@/lib/db";
import { reunioes, usuarios } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { criarNaAgenda, atualizarNaAgenda, cancelarNaAgenda, FRASE_SEM_CONVIDADO, type ResultadoSync } from "@/lib/calendario/sincronizar";
import { registrarEvento, type TipoEventoVendas } from "@/lib/vendas/eventos";
import { trocarResponsavelDaReuniao, validarResponsavel, ResponsavelInvalidoError, ReuniaoNaoEncontradaError } from "@/lib/calendario/trocar-responsavel";

type OutlookResultado = { criado: boolean; motivo: string | null };

/**
 * Resultado do evento na agenda no formato que as telas já leem (`outlook`),
 * mais a frase pronta (`aviso`). Quem cria passa pela porta única de calendário
 * (`criarNaAgenda`): ela escolhe Microsoft ou Google, grava o vínculo e o estado
 * da sincronização, e nunca falha em silêncio.
 */
function resultadoOutlook(r: ResultadoSync): OutlookResultado & { aviso: string | null } {
  if (r.sincronizado) {
    return { criado: true, motivo: r.semConvidado ? "sem_email_destinatario" : null, aviso: r.semConvidado ? FRASE_SEM_CONVIDADO : null };
  }
  const aviso = r.aviso ?? null;
  const motivo = /não tem calendário conectado/i.test(aviso ?? "") ? "closer_sem_outlook" : /expirou/i.test(aviso ?? "") ? "token_expirado" : "erro_graph";
  return { criado: false, motivo, aviso };
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
  /** Troca o responsável: o evento acompanha, saindo do calendário antigo e entrando no do novo (lib/calendario/trocar-responsavel). */
  responsavelId: z.string().uuid().optional(),
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
    // Quem recebe o convite fica gravado na reunião: o e-mail do cliente entra nos participantes.
    const participantesIniciais = [...new Set([data.attendeeEmail, ...(data.participantes ?? [])].filter((e): e is string => !!e))];

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
        participantes: participantesIniciais.length ? participantesIniciais : null,
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
    let outlook: OutlookResultado & { aviso: string | null } = { criado: false, motivo: null, aviso: null };
    let reuniaoFinal = reuniao;
    if (data.criarNoOutlook !== false && reuniao.status === "agendada") {
      outlook = resultadoOutlook(await criarNaAgenda(ctx.organizacaoId, reuniao.id).catch((e) => {
        console.error(`[Reunioes] sincronização da reunião ${reuniao.id} falhou:`, e);
        return { sincronizado: false, provider: null, aviso: "Reunião salva no CRM, mas não consegui criar o evento na agenda. Abra a reunião e tente de novo." } as ResultadoSync;
      }));
      const [atualizada] = await db.select().from(reunioes).where(eq(reunioes.id, reuniao.id)).limit(1);
      if (atualizada) reuniaoFinal = atualizada;
    }

    return c.json({ ...reuniaoFinal, outlook, avisoAgenda: outlook.aviso }, 201);
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

    // Valida antes de gravar qualquer campo: responsável inválido não pode deixar a edição pela metade.
    if (data.responsavelId !== undefined) await validarResponsavel(ctx.organizacaoId, data.responsavelId);

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
    const porta = async (f: () => Promise<ResultadoSync>) => {
      try { const r = await f(); return r.aviso ?? (r.sincronizado && r.semConvidado && data.participantes !== undefined ? FRASE_SEM_CONVIDADO : null); }
      catch (e) { console.error(`[Reunioes] sincronização da reunião ${id} falhou:`, e); return "Alteração salva no CRM, mas não consegui atualizar a agenda. Tente de novo."; }
    };
    // Troca de responsável: grava, move o evento de calendário e registra na timeline. Como o evento novo
    // nasce com os dados já salvos acima, esta chamada também cobre as outras edições do mesmo PATCH.
    let trocaFeita = false;
    if (data.responsavelId !== undefined) {
      try {
        const t = await trocarResponsavelDaReuniao({
          organizacaoId: ctx.organizacaoId, reuniaoId: id, novoResponsavelId: data.responsavelId,
          ator: { tipo: "HUMAN", usuarioId: ctx.userId }, convidados: data.participantes !== undefined,
        });
        trocaFeita = t.sincronizou;
        avisoAgenda = t.aviso;
      } catch (e) {
        if (e instanceof ReuniaoNaoEncontradaError) return c.json({ error: e.message }, 404);
        console.error(`[Reunioes] troca de responsável da reunião ${id} falhou:`, e);
        avisoAgenda = "Alteração salva no CRM, mas não consegui trocar o responsável. Tente de novo.";
      }
    }

    if (data.status === "cancelada") {
      avisoAgenda = await porta(() => cancelarNaAgenda(ctx.organizacaoId, id));
    } else if (trocaFeita) {
      // já sincronizado pela troca de responsável
    } else if (updated.status === "agendada" && (data.data !== undefined || data.titulo !== undefined || data.duracao !== undefined || data.notas !== undefined || data.participantes !== undefined)) {
      // Participantes mudaram: a lista de convidados do evento passa a ser a da reunião (entra e sai gente).
      avisoAgenda = await porta(() => atualizarNaAgenda(ctx.organizacaoId, id, { convidados: data.participantes !== undefined }));
    } else if (data.status === "agendada") {
      // Reaberta (ex.: no-show corrigido): garante o evento.
      avisoAgenda = await porta(() => atualizarNaAgenda(ctx.organizacaoId, id));
    }

    return c.json({ ...updated, avisoAgenda });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: err.issues[0].message }, 400);
    }
    if (err instanceof ResponsavelInvalidoError) return c.json({ error: err.message }, 400);
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
  // Cancela o evento (e o convite) na agenda do responsável antes de apagar a linha.
  await cancelarNaAgenda(ctx.organizacaoId, id).catch((e) => console.error(`[Reunioes] falha ao cancelar evento da reunião ${id}:`, e));

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
