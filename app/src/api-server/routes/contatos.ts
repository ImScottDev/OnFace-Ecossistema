import { Hono } from "hono";
import { garantirEntradaCanonica } from "../../lib/vendas/ponte-canonica.js";
import { db } from "@/lib/db";
import { contatos, usuarios, leads, negocios, whatsappSessao } from "@/lib/db/schema";
import { eq, and, isNull, ne, like } from "drizzle-orm";
import { z } from "zod";
import { getCtx, parseBody } from "../compat.js";
import { phoneLikePattern } from "@/lib/whatsapp/phone-utils";
import { downloadAndSaveAvatar, sessionToConfig } from "@/lib/whatsapp/client";
import { syncPessoaFromLead, syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";
import { publicarEvento } from "@/lib/events/outbox";

const app = new Hono();

// ── Schemas ──────────────────────────────────────────────────────────

const atribuirSchema = z.object({
  usuarioId: z.string().uuid().optional(),
  naoLidas: z.number().int().min(0).optional(),
});

const converterSchema = z.object({
  titulo: z.string().min(1),
  mrrEstimado: z.string().optional().nullable(),
  valorProjeto: z.string().optional().nullable(),
  tipoReceita: z.enum(["recorrente", "projeto", "hibrido"]).optional(),
  servicosInteresse: z.array(z.string()).optional().nullable(),
  origemNegocio: z.enum(["novo", "carteira"]).optional(),
});

const vincularSchema = z.object({
  leadId: z.string().uuid(),
});

// ── POST /contatos/:id/atribuir ──────────────────────────────────────

app.post("/contatos/:id/atribuir", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json();
  const parsed = atribuirSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  // Fetch contato
  const [contato] = await db
    .select()
    .from(contatos)
    .where(and(eq(contatos.id, id), eq(contatos.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!contato) {
    return c.json({ error: "Contato não encontrado" }, 404);
  }

  // If only updating unread count (no user assignment)
  if (parsed.data.naoLidas !== undefined && !parsed.data.usuarioId) {
    const [updated] = await db
      .update(contatos)
      .set({ naoLidas: parsed.data.naoLidas, updatedAt: new Date() })
      .where(eq(contatos.id, id))
      .returning();

    // Also update lead unread count if linked
    if (contato.leadId) {
      await db
        .update(leads)
        .set({ whatsappNaoLidas: parsed.data.naoLidas, updatedAt: new Date() })
        .where(eq(leads.id, contato.leadId));
    }

    return c.json({ contato: updated });
  }

  // User assignment flow
  const targetUserId = parsed.data.usuarioId || ctx.userId;

  // Non-admin can only self-assign
  const isAdmin = ctx.userRole === "admin" || ctx.userRole === "super_admin" || ctx.userRole === "gerente";
  if (!isAdmin && targetUserId !== ctx.userId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Validate target user exists and belongs to org
  const [targetUser] = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.id, targetUserId), eq(usuarios.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!targetUser) {
    return c.json({ error: "Usuário não encontrado" }, 404);
  }

  // Update responsavelId (and naoLidas if provided)
  const [updated] = await db
    .update(contatos)
    .set({
      responsavelId: targetUserId,
      ...(parsed.data.naoLidas !== undefined && { naoLidas: parsed.data.naoLidas }),
      updatedAt: new Date(),
    })
    .where(eq(contatos.id, id))
    .returning();

  // Dois defeitos moravam aqui, e o segundo escondia o primeiro.
  //
  // 1. A CHAVE saía do relógio: `assignment:${updated.updatedAt.getTime()}`
  //    muda a cada chamada, então nada dedupicava. Idempotência decorativa.
  //
  // 2. A CONDIÇÃO estava invertida. `contato.responsavelId === targetUserId`
  //    significa que a conversa JÁ era dessa pessoa — não mudou nada — e ainda
  //    assim publicava `ConversationClaimed`. E assumir uma conversa SEM dono,
  //    que é o significado de "claim", caía em `ConversationTransferred`.
  //
  // O padrão do projeto (`lib/crm/tags.ts`) é publicar só quando MUDOU, e a
  // chave descrever o estado alcançado.
  if (contato.responsavelId !== targetUserId) {
    await publicarEvento({
      organizacaoId: ctx.organizacaoId,
      // Sem dono antes é reivindicação; com outro dono antes é transferência.
      eventType: contato.responsavelId === null ? "ConversationClaimed" : "ConversationTransferred",
      aggregateType: "contato",
      aggregateId: id,
      payload: { actorId: ctx.userId, usuarioAnteriorId: contato.responsavelId, usuarioId: targetUserId },
      idempotencyKey: `contato:${id}:assignment:${targetUserId}`,
    });
  }

  return c.json({ contato: updated });
});

// ── POST /contatos/:id/converter ─────────────────────────────────────

app.post("/contatos/:id/converter", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json();
  const parsed = converterSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  // Verify contato belongs to org and is tipo=contato
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return c.json({ error: "Contato não encontrado" }, 404);
  }

  if (lead.tipo !== "contato") {
    return c.json({ error: "Este contato já é um lead ou cliente" }, 400);
  }

  // Promote to lead
  await db.update(leads).set({
    tipo: "lead",
    updatedAt: new Date(),
  }).where(eq(leads.id, id));

  // Create negócio
  const [negocio] = await db
    .insert(negocios)
    .values({
      organizacaoId: ctx.organizacaoId,
      leadId: id,
      titulo: parsed.data.titulo,
      tipoReceita: parsed.data.tipoReceita,
      mrrEstimado: parsed.data.mrrEstimado,
      valorProjeto: parsed.data.valorProjeto,
      servicosInteresse: parsed.data.servicosInteresse,
      origemNegocio: parsed.data.origemNegocio || "novo",
      origemQualificacao: "direta", // conversão de contato: negócio nasce sem fluxo de reunião
      responsavelId: ctx.userId,
    })
    .returning();

  // F1/dual-write: contato promovido a lead + negócio novo — best-effort.
  await syncPessoaFromLead(id);
  await syncOportunidadeFromNegocio(negocio.id);

  return c.json({ lead: { ...lead, tipo: "lead" }, negocio }, 201);
});

// ── POST /contatos/:id/criar-lead ────────────────────────────────────

app.post("/contatos/:id/criar-lead", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  // Fetch contato
  const [contato] = await db
    .select()
    .from(contatos)
    .where(and(eq(contatos.id, id), eq(contatos.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!contato) {
    return c.json({ error: "Contato não encontrado" }, 404);
  }

  if (contato.leadId) {
    return c.json({ error: "Contato já possui lead vinculado" }, 400);
  }

  // Fetch and persist WhatsApp avatar if available
  let avatarUrl: string | null = null;
  if (contato.canal === "whatsapp" && contato.telefone) {
    try {
      const sessions = await db
        .select()
        .from(whatsappSessao)
        .where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId));
      const session =
        sessions.find((s) => s.isDefault && s.status === "connected") ||
        sessions.find((s) => s.status === "connected");
      if (session) {
        const url = await downloadAndSaveAvatar(contato.telefone, sessionToConfig(session));
        if (url) avatarUrl = url;
      }
    } catch {
      // Avatar fetch is best-effort, don't block lead creation
    }
  }

  // Create lead from contato data
  const [newLead] = await db
    .insert(leads)
    .values({
      organizacaoId: ctx.organizacaoId,
      nome: contato.nome,
      telefone: contato.telefone,
      email: contato.email,
      origem: contato.canal === "whatsapp" ? "whatsapp" : "email",
      responsavelId: contato.responsavelId || ctx.userId,
      avatarUrl,
    })
    .returning();

  // CUTOVER (fase 16): mesmo fato no modelo canônico. Sai na fase 25.
  void garantirEntradaCanonica({
    organizacaoId: ctx.organizacaoId,
    tipo: "INBOUND",
    origem: contato.canal === "whatsapp" ? "whatsapp" : "email",
    provider: contato.canal ?? "contato",
    pessoa: { nome: contato.nome, email: contato.email, telefone: contato.telefone },
  }, newLead.id);

  // Link this contato to the new lead (and save avatar if fetched)
  await db
    .update(contatos)
    .set({
      leadId: newLead.id,
      ...(avatarUrl && !contato.avatarUrl ? { avatarUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(contatos.id, id));

  // Propagation: find other contatos in same org with same phone or email
  await propagateLeadId(ctx.organizacaoId, id, newLead.id, contato.telefone, contato.email);

  // F1/dual-write: novo lead criado a partir de contato — best-effort.
  await syncPessoaFromLead(newLead.id);

  return c.json({ lead: newLead, contatoId: id }, 201);
});

// ── POST /contatos/:id/desvincular ───────────────────────────────────

app.post("/contatos/:id/desvincular", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  // Fetch contato
  const [contato] = await db
    .select()
    .from(contatos)
    .where(and(eq(contatos.id, id), eq(contatos.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!contato) {
    return c.json({ error: "Contato não encontrado" }, 404);
  }

  // Unlink — set leadId to null
  const [updated] = await db
    .update(contatos)
    .set({ leadId: null, updatedAt: new Date() })
    .where(eq(contatos.id, id))
    .returning();

  return c.json({ contato: updated });
});

// ── POST /contatos/:id/vincular-lead ─────────────────────────────────

app.post("/contatos/:id/vincular-lead", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json();
  const parsed = vincularSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  // Fetch contato
  const [contato] = await db
    .select()
    .from(contatos)
    .where(and(eq(contatos.id, id), eq(contatos.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!contato) {
    return c.json({ error: "Contato não encontrado" }, 404);
  }

  // Validate lead exists and belongs to org
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, parsed.data.leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return c.json({ error: "Lead não encontrado" }, 404);
  }

  // Link contato to lead
  const [updated] = await db
    .update(contatos)
    .set({ leadId: lead.id, updatedAt: new Date() })
    .where(eq(contatos.id, id))
    .returning();

  // Propagation: find other contatos in same org with same phone or email
  if (contato.telefone) {
    const pattern = phoneLikePattern(contato.telefone);
    await db
      .update(contatos)
      .set({ leadId: lead.id, updatedAt: new Date() })
      .where(
        and(
          eq(contatos.organizacaoId, ctx.organizacaoId),
          ne(contatos.id, id),
          isNull(contatos.leadId),
          like(contatos.telefone, pattern),
        )
      );
  }

  if (contato.email) {
    await db
      .update(contatos)
      .set({ leadId: lead.id, updatedAt: new Date() })
      .where(
        and(
          eq(contatos.organizacaoId, ctx.organizacaoId),
          ne(contatos.id, id),
          isNull(contatos.leadId),
          eq(contatos.email, contato.email),
        )
      );
  }

  return c.json({ contato: updated });
});

// ── Helper: propagateLeadId ──────────────────────────────────────────

async function propagateLeadId(
  organizacaoId: string,
  excludeContatoId: string,
  leadId: string,
  telefone: string | null,
  email: string | null,
) {
  // Propagate by phone (WhatsApp contatos with matching phone)
  if (telefone) {
    const pattern = phoneLikePattern(telefone);
    await db
      .update(contatos)
      .set({ leadId, updatedAt: new Date() })
      .where(
        and(
          eq(contatos.organizacaoId, organizacaoId),
          ne(contatos.id, excludeContatoId),
          isNull(contatos.leadId),
          like(contatos.telefone, pattern),
        )
      );
  }

  // Propagate by email (email contatos with matching email)
  if (email) {
    await db
      .update(contatos)
      .set({ leadId, updatedAt: new Date() })
      .where(
        and(
          eq(contatos.organizacaoId, organizacaoId),
          ne(contatos.id, excludeContatoId),
          isNull(contatos.leadId),
          eq(contatos.email, email),
        )
      );
  }
}

export const contatosRoutes = app;
