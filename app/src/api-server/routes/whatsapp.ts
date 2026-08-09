import { Hono } from "hono";
import crypto from "crypto";
import { db } from "@/lib/db";
import {
  leads, contatos, whatsappMensagens, whatsappTemplates, whatsappSessao,
  usuarios, empresas, negocios, leadLabels, leadUserUnread, aiSdrContatoState,
} from "@/lib/db/schema";
import { eq, desc, count, and, sql, ilike, or, isNull, inArray, asc, gte, like, SQL } from "drizzle-orm";
import { z } from "zod";
import { getCtx, parseBody } from "../compat.js";
import { whatsappIncomingQueue, whatsappOutgoingQueue } from "@/lib/queue";
import { normalizePhone } from "@/lib/whatsapp/phone-utils";
import {
  reactToMessage, markRead, setPresence, deleteMessage, sessionToConfig,
  getStatus, createSession, disconnectSession, downloadAndSaveAvatar,
  wuzapiCreateUser, wuzapiDeleteUser, wuzapiFindUser,
} from "@/lib/whatsapp/client";
import { randomBytes } from "crypto";

const app = new Hono();

// ─── Webhook (public, no auth) ─────────────────────────────────────────────

const WEBHOOK_SECRET = process.env.UAZAPI_WEBHOOK_SECRET || "";

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return true;
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

app.post("/whatsapp/webhook", async (c) => {
  try {
    const rawBody = await c.req.text();

    const signature = c.req.header("x-hmac-signature") || "";
    if (WEBHOOK_SECRET && signature && !verifySignature(rawBody, signature)) {
      return c.json({ error: "Invalid signature" }, 401);
    }

    let payload: Record<string, unknown>;
    let instanceName = "";

    const contentType = c.req.header("content-type") || "";
    if (contentType.includes("application/json")) {
      const topLevel = JSON.parse(rawBody);
      instanceName = (topLevel.instanceName as string) || "";
      if (typeof topLevel.jsonData === "string") {
        payload = JSON.parse(topLevel.jsonData);
      } else if (topLevel.jsonData && typeof topLevel.jsonData === "object") {
        payload = topLevel.jsonData;
      } else {
        payload = topLevel;
      }
    } else {
      const params = new URLSearchParams(rawBody);
      instanceName = params.get("instanceName") || "";
      const jsonData = params.get("jsonData");
      if (!jsonData) {
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return c.json({ ok: true });
        }
      } else {
        payload = JSON.parse(jsonData);
      }
    }

    if (!instanceName) {
      instanceName = process.env.UAZAPI_SESSION_NAME || "mcrm-main";
    }

    const eventType = (payload.type as string) || "";

    if (eventType === "ChatPresence" || eventType === "PairSuccess") {
      return c.json({ ok: true });
    }

    await whatsappIncomingQueue.add("webhook-event", {
      instanceName,
      eventType,
      payload,
      receivedAt: Date.now(),
    }, {
      removeOnComplete: 200,
      removeOnFail: 500,
    });

    return c.json({ ok: true });
  } catch (error) {
    console.error("[Webhook] Parse error:", error);
    return c.json({ ok: true });
  }
});

// ─── Send ───────────────────────────────────────────────────────────────────

const sendMessageSchema = z.object({
  contatoId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  conteudo: z.string().optional().default(""),
  tipo: z.enum(["text", "image", "document", "audio", "video", "location", "contact", "sticker"]).default("text"),
  templateId: z.string().uuid().optional(),
  mediaData: z.string().optional(),
  mediaUrl: z.string().optional(),
  fileName: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  sessaoId: z.string().uuid().optional(),
  replyToId: z.string().uuid().optional(),
}).refine(data => data.contatoId || data.leadId, {
  message: "contatoId ou leadId obrigatorio",
});

app.post("/whatsapp/send", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const parsed = sendMessageSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Dados invalidos", details: parsed.error.flatten() }, 400);
  }

  const { contatoId, leadId, conteudo, tipo, templateId, mediaData, mediaUrl, fileName, latitude, longitude, sessaoId, replyToId } = parsed.data;

  if (tipo === "text" && !conteudo && !templateId) {
    return c.json({ error: "Conteudo obrigatorio para mensagens de texto" }, 400);
  }
  if (["image", "document", "audio", "video", "sticker"].includes(tipo) && !mediaData && !mediaUrl) {
    return c.json({ error: "Midia obrigatoria" }, 400);
  }

  let resolvedContatoId: string | null = contatoId || null;
  let resolvedLeadId: string | null = leadId || null;
  let resolvedPhone: string | null = null;
  let leadNome: string | null = null;
  let leadEmpresa: string | null = null;
  let resolvedNegocioAtivoId: string | null = null;

  if (contatoId) {
    const [contato] = await db
      .select({ id: contatos.id, telefone: contatos.telefone, leadId: contatos.leadId, organizacaoId: contatos.organizacaoId })
      .from(contatos)
      .where(and(eq(contatos.id, contatoId), eq(contatos.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!contato) return c.json({ error: "Contato nao encontrado" }, 404);
    if (!contato.telefone) return c.json({ error: "Contato nao possui telefone cadastrado" }, 400);

    resolvedPhone = contato.telefone;
    resolvedLeadId = contato.leadId || resolvedLeadId;

    if (resolvedLeadId) {
      const [lead] = await db.select({ nome: leads.nome, empresa: leads.empresa, negocioAtivoId: leads.negocioAtivoId })
        .from(leads).where(eq(leads.id, resolvedLeadId)).limit(1);
      leadNome = lead?.nome || null;
      leadEmpresa = lead?.empresa || null;
      resolvedNegocioAtivoId = lead?.negocioAtivoId || null;
    }
  } else if (leadId) {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!lead) return c.json({ error: "Lead nao encontrado" }, 404);
    if (!lead.telefone) return c.json({ error: "Lead nao possui telefone cadastrado" }, 400);

    resolvedPhone = lead.telefone;
    leadNome = lead.nome;
    leadEmpresa = lead.empresa;
    resolvedNegocioAtivoId = lead.negocioAtivoId;

    const [linkedContato] = await db
      .select({ id: contatos.id })
      .from(contatos)
      .where(and(eq(contatos.leadId, leadId), eq(contatos.canal, "whatsapp")))
      .limit(1);
    if (linkedContato) resolvedContatoId = linkedContato.id;
  }

  let resolvedSessaoId = sessaoId;

  if (!resolvedSessaoId) {
    const [userDefault] = await db.select({ id: whatsappSessao.id })
      .from(whatsappSessao)
      .where(and(
        eq(whatsappSessao.organizacaoId, ctx.organizacaoId),
        eq(whatsappSessao.usuarioId, ctx.userId),
        eq(whatsappSessao.isDefault, true),
      ))
      .limit(1);
    resolvedSessaoId = userDefault?.id;
  }

  if (!resolvedSessaoId) {
    const [userAny] = await db.select({ id: whatsappSessao.id })
      .from(whatsappSessao)
      .where(and(
        eq(whatsappSessao.organizacaoId, ctx.organizacaoId),
        eq(whatsappSessao.usuarioId, ctx.userId),
      ))
      .limit(1);
    resolvedSessaoId = userAny?.id;
  }

  if (!resolvedSessaoId) {
    const [sharedDefault] = await db.select({ id: whatsappSessao.id })
      .from(whatsappSessao)
      .where(and(
        eq(whatsappSessao.organizacaoId, ctx.organizacaoId),
        isNull(whatsappSessao.usuarioId),
        eq(whatsappSessao.isDefault, true),
      ))
      .limit(1);
    resolvedSessaoId = sharedDefault?.id;
  }

  if (!resolvedSessaoId) {
    const [sharedAny] = await db.select({ id: whatsappSessao.id })
      .from(whatsappSessao)
      .where(and(
        eq(whatsappSessao.organizacaoId, ctx.organizacaoId),
        isNull(whatsappSessao.usuarioId),
      ))
      .limit(1);
    resolvedSessaoId = sharedAny?.id;
  }

  let finalText = conteudo || "";
  let templateNome: string | null = null;

  if (templateId) {
    const [template] = await db
      .select()
      .from(whatsappTemplates)
      .where(and(eq(whatsappTemplates.id, templateId), eq(whatsappTemplates.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!template) return c.json({ error: "Template nao encontrado" }, 404);

    finalText = template.conteudo
      .replace(/\{\{nome\}\}/g, leadNome || "")
      .replace(/\{\{empresa\}\}/g, leadEmpresa || "");
    templateNome = template.nome;
  }

  const phone = normalizePhone(resolvedPhone!);

  let replyStanzaId: string | undefined;
  if (replyToId) {
    const [replyMsg] = await db.select({ uazapiMessageId: whatsappMensagens.uazapiMessageId })
      .from(whatsappMensagens).where(eq(whatsappMensagens.id, replyToId)).limit(1);
    replyStanzaId = replyMsg?.uazapiMessageId || undefined;
  }

  const [message] = await db
    .insert(whatsappMensagens)
    .values({
      contatoId: resolvedContatoId,
      leadId: resolvedLeadId,
      sessaoId: resolvedSessaoId || null,
      telefone: phone,
      direcao: "out",
      tipo,
      conteudo: tipo === "location" ? `${latitude},${longitude}` : (finalText || null),
      enviadoPorId: ctx.userId,
      status: "pending",
      mediaUrl: null,
      mediaFilename: fileName || null,
      templateNome,
      replyToId: replyToId || null,
    })
    .returning();

  // Mensagem enviada é atividade real: reseta o relógio do badge de tempo no board de pré-vendas
  // e, se o lead tiver negócio ativo, no Pipeline também.
  if (resolvedLeadId) {
    await db.update(leads).set({ updatedAt: new Date() })
      .where(and(eq(leads.id, resolvedLeadId), eq(leads.organizacaoId, ctx.organizacaoId)));
  }
  if (resolvedNegocioAtivoId) {
    await db.update(negocios).set({ updatedAt: new Date() })
      .where(and(eq(negocios.id, resolvedNegocioAtivoId), eq(negocios.organizacaoId, ctx.organizacaoId)));
  }

  // F3/Human Handoff: humano enviando mensagem manual pra um contato em
  // "human_required" é exatamente o momento de "assumiu de verdade" —
  // fecha a máquina de estados (AI_HANDLING -> HUMAN_REQUIRED -> HUMAN_ASSIGNED).
  // Best-effort, nunca bloqueia o envio real da mensagem.
  if (resolvedContatoId) {
    try {
      await db
        .update(aiSdrContatoState)
        .set({ handoffStatus: "human_assigned", handoffUsuarioId: ctx.userId, updatedAt: new Date() })
        .where(and(eq(aiSdrContatoState.contatoId, resolvedContatoId), eq(aiSdrContatoState.handoffStatus, "human_required")));
    } catch (err) {
      console.error("[F3/handoff] falha ao marcar human_assigned (best-effort):", err);
    }
  }

  await whatsappOutgoingQueue.add("send", {
    messageId: message.id,
    phone,
    conteudo: finalText,
    tipo,
    mediaData,
    mediaUrl,
    fileName,
    latitude,
    longitude,
    sessaoId: resolvedSessaoId,
    replyStanzaId,
  });

  // Cross-save
  if (resolvedSessaoId) {
    try {
      const { phoneLastDigits } = await import("@/lib/whatsapp/phone-utils");
      const recipientLast8 = phoneLastDigits(phone);

      const allSessions = await db.select({
        id: whatsappSessao.id,
        phoneNumber: whatsappSessao.phoneNumber,
      })
        .from(whatsappSessao)
        .where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId));

      const recipientSession = allSessions.find(s => {
        if (s.id === resolvedSessaoId) return false;
        const cleanPhone = (s.phoneNumber || "").replace(/:.*$/, "");
        return cleanPhone.length >= 8 && phone.endsWith(cleanPhone.slice(-8));
      });

      if (recipientSession) {
        const senderSession = allSessions.find(s => s.id === resolvedSessaoId);
        const senderPhone = normalizePhone((senderSession?.phoneNumber || "").replace(/:.*$/, ""));
        const senderLast8 = phoneLastDigits(senderPhone);

        const { like: likeFn } = await import("drizzle-orm");
        const [existingContato] = await db.select({ id: contatos.id, leadId: contatos.leadId })
          .from(contatos)
          .where(and(
            eq(contatos.sessaoId, recipientSession.id),
            likeFn(contatos.telefone, `%${senderLast8}`),
          ))
          .limit(1);

        const targetContato = existingContato || null;
        if (targetContato) {
          await db.insert(whatsappMensagens).values({
            contatoId: targetContato.id,
            leadId: targetContato.leadId || undefined,
            sessaoId: recipientSession.id,
            telefone: senderPhone,
            direcao: "in",
            tipo,
            conteudo: tipo === "location" ? `${latitude},${longitude}` : (finalText || null),
            uazapiMessageId: `xsave-crm-${message.id}`,
            status: "received",
            statusAt: new Date(),
          });
        }
      }
    } catch (err) {
      console.error("[WA-Send] Cross-save failed:", err);
    }
  }

  return c.json(message, 201);
});

// ─── Conversations ──────────────────────────────────────────────────────────

app.get("/whatsapp/conversations", async (c) => {
  const ctx = await getCtx(c);

  const cursor = c.req.query("cursor") ?? null;
  const limit = Math.min(parseInt(c.req.query("limit") || "30"), 100);
  const search = c.req.query("search") ?? null;
  const unread = c.req.query("unread") ?? null;
  const labelIds = c.req.query("labelIds") ?? null;
  const view = c.req.query("view") || "meus";
  const viewAs = c.req.query("viewAs") ?? null;

  const isAdmin = ctx.userRole === "admin" || ctx.userRole === "super_admin";
  const effectiveUserId = (isAdmin && viewAs) ? viewAs : ctx.userId;

  const conditions: SQL[] = [
    eq(contatos.organizacaoId, ctx.organizacaoId),
    eq(contatos.canal, "whatsapp"),
  ];

  if (view === "nao_atribuidos") {
    conditions.push(isNull(contatos.responsavelId));
  } else if (view === "todos") {
    if (!isAdmin) {
      conditions.push(
        or(
          eq(contatos.responsavelId, effectiveUserId),
          isNull(contatos.responsavelId),
        )!
      );
    }
  } else {
    conditions.push(
      or(
        eq(contatos.responsavelId, effectiveUserId),
        isNull(contatos.responsavelId),
      )!
    );
  }

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(contatos.nome, pattern),
        ilike(contatos.telefone, pattern),
      )!
    );
  }

  if (labelIds) {
    const ids = labelIds.split(",").map(id => id.trim()).filter(Boolean);
    if (ids.length > 0) {
      const labelMatches = await db
        .select({ leadId: leadLabels.leadId })
        .from(leadLabels)
        .where(inArray(leadLabels.labelId, ids))
        .groupBy(leadLabels.leadId);
      const matchedLeadIds = labelMatches.filter(m => m.leadId).map(m => m.leadId!);
      if (matchedLeadIds.length === 0) {
        return c.json({ conversations: [], nextCursor: null, totalUnread: 0 });
      }
      conditions.push(inArray(contatos.leadId, matchedLeadIds));
    }
  }

  if (cursor) {
    const [cursorTs, cursorId] = cursor.split("|");
    if (cursorTs && cursorId) {
      conditions.push(
        sql`(${contatos.ultimaMsgAt}, ${contatos.id}) < (${cursorTs}::timestamptz, ${cursorId}::uuid)`
      );
    }
  }

  const where = and(...conditions);

  const rows = await db
    .select({
      id: contatos.id,
      nome: contatos.nome,
      telefone: contatos.telefone,
      email: contatos.email,
      canal: contatos.canal,
      avatarUrl: contatos.avatarUrl,
      leadId: contatos.leadId,
      ultimaMsg: contatos.ultimaMsg,
      ultimaMsgAt: contatos.ultimaMsgAt,
      naoLidas: contatos.naoLidas,
      responsavelId: contatos.responsavelId,
      createdAt: contatos.createdAt,
      leadNome: leads.nome,
      leadStatus: leads.status,
      empresaId: leads.empresaId,
      negocioAtivoId: leads.negocioAtivoId,
      empresaNome: empresas.nome,
      negocioTitulo: negocios.titulo,
      negocioStatus: negocios.status,
    })
    .from(contatos)
    .leftJoin(leads, eq(contatos.leadId, leads.id))
    .leftJoin(empresas, eq(leads.empresaId, empresas.id))
    .leftJoin(negocios, eq(leads.negocioAtivoId, negocios.id))
    .where(where)
    .orderBy(sql`${contatos.ultimaMsgAt} DESC NULLS LAST, ${contatos.id} DESC`)
    .limit(limit + 1);

  let filtered = rows.map(r => ({
    id: r.id,
    nome: r.nome,
    telefone: r.telefone,
    email: r.email,
    canal: r.canal,
    avatarUrl: r.avatarUrl,
    leadId: r.leadId,
    leadNome: r.leadNome ?? null,
    leadStatus: r.leadStatus ?? null,
    empresaId: r.empresaId ?? null,
    empresaNome: r.empresaNome ?? null,
    negocioAtivoId: r.negocioAtivoId ?? null,
    negocioTitulo: r.negocioTitulo ?? null,
    negocioStatus: r.negocioStatus ?? null,
    ultimaMsg: r.ultimaMsg,
    ultimaMsgAt: r.ultimaMsgAt,
    naoLidas: r.naoLidas ?? 0,
    responsavelId: r.responsavelId,
    createdAt: r.createdAt,
  }));

  if (unread === "1") {
    filtered = filtered.filter(r => r.naoLidas > 0);
  }

  const hasMore = filtered.length > limit;
  const conversations = filtered.slice(0, limit);
  let nextCursor: string | null = null;
  if (hasMore && conversations.length > 0) {
    const last = conversations[conversations.length - 1];
    nextCursor = `${last.ultimaMsgAt}|${last.id}`;
  }

  const unreadConditions: SQL[] = [
    eq(contatos.organizacaoId, ctx.organizacaoId),
    eq(contatos.canal, "whatsapp"),
  ];

  if (view === "nao_atribuidos") {
    unreadConditions.push(isNull(contatos.responsavelId));
  } else if (view === "todos" && isAdmin) {
    // No extra filter
  } else {
    unreadConditions.push(
      or(
        eq(contatos.responsavelId, effectiveUserId),
        isNull(contatos.responsavelId),
      )!
    );
  }

  const [unreadResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${contatos.naoLidas}), 0)`,
    })
    .from(contatos)
    .where(and(...unreadConditions));

  return c.json({
    conversations,
    nextCursor,
    totalUnread: Number(unreadResult?.total ?? 0),
  });
});

// ─── Messages by leadId/contatoId ───────────────────────────────────────────

app.get("/whatsapp/messages/:leadId", async (c) => {
  const ctx = await getCtx(c);

  const idParam = c.req.param("leadId");

  let contatoId: string | null = null;
  let leadId: string | null = null;

  const [contatoRow] = await db
    .select({ id: contatos.id, leadId: contatos.leadId })
    .from(contatos)
    .where(and(eq(contatos.id, idParam), eq(contatos.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (contatoRow) {
    contatoId = contatoRow.id;
    leadId = contatoRow.leadId;
  } else {
    const [leadRow] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, idParam), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!leadRow) {
      return c.json({ error: "Contato ou lead nao encontrado" }, 404);
    }
    leadId = leadRow.id;
  }

  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "50");

  const whereCondition = contatoId
    ? eq(whatsappMensagens.contatoId, contatoId)
    : leadId
      ? or(
          eq(whatsappMensagens.leadId, leadId),
          sql`${whatsappMensagens.contatoId} IN (SELECT id FROM contatos WHERE lead_id = ${leadId})`
        )!
      : eq(whatsappMensagens.leadId, idParam);

  const [messages, totalResult] = await Promise.all([
    db
      .select()
      .from(whatsappMensagens)
      .where(whereCondition)
      .orderBy(desc(whatsappMensagens.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: count() })
      .from(whatsappMensagens)
      .where(whereCondition),
  ]);

  const sessaoIds = [...new Set(messages.map(m => m.sessaoId).filter(Boolean))] as string[];
  const senderIds = [...new Set(messages.map(m => m.enviadoPorId).filter(Boolean))] as string[];

  const sessaoMap = new Map<string, { usuarioId: string | null; usuarioNome: string | null }>();
  if (sessaoIds.length > 0) {
    const sessoes = await db
      .select({ id: whatsappSessao.id, usuarioId: whatsappSessao.usuarioId })
      .from(whatsappSessao)
      .where(inArray(whatsappSessao.id, sessaoIds));

    const sessaoUserIds = [...new Set(sessoes.map(s => s.usuarioId).filter(Boolean))] as string[];
    const userNameMap = new Map<string, string>();
    if (sessaoUserIds.length > 0) {
      const userRows = await db
        .select({ id: usuarios.id, nome: usuarios.nome })
        .from(usuarios)
        .where(inArray(usuarios.id, sessaoUserIds));
      for (const u of userRows) userNameMap.set(u.id, u.nome);
    }
    for (const s of sessoes) {
      sessaoMap.set(s.id, {
        usuarioId: s.usuarioId,
        usuarioNome: s.usuarioId ? (userNameMap.get(s.usuarioId) || null) : null,
      });
    }
  }

  const senderNameMap = new Map<string, string>();
  if (senderIds.length > 0) {
    const senderRows = await db
      .select({ id: usuarios.id, nome: usuarios.nome })
      .from(usuarios)
      .where(inArray(usuarios.id, senderIds));
    for (const u of senderRows) senderNameMap.set(u.id, u.nome);
  }

  const enrichedMessages = messages.map(m => {
    const sessaoInfo = m.sessaoId ? sessaoMap.get(m.sessaoId) : null;
    return {
      ...m,
      sessaoUsuarioId: sessaoInfo?.usuarioId || null,
      sessaoUsuarioNome: sessaoInfo?.usuarioNome || null,
      enviadoPorNome: m.enviadoPorId ? (senderNameMap.get(m.enviadoPorId) || null) : null,
    };
  });

  if (contatoId) {
    await db.update(contatos).set({ naoLidas: 0, updatedAt: new Date() }).where(eq(contatos.id, contatoId));
  }
  if (leadId) {
    await Promise.all([
      db.update(leads).set({ whatsappNaoLidas: 0, updatedAt: new Date() }).where(eq(leads.id, leadId)),
      db.execute(sql`
        INSERT INTO lead_user_unread (id, lead_id, usuario_id, whatsapp_nao_lidas, email_nao_lidos)
        VALUES (gen_random_uuid(), ${leadId}, ${ctx.userId}, 0, 0)
        ON CONFLICT (lead_id, usuario_id)
        DO UPDATE SET whatsapp_nao_lidas = 0
      `),
    ]);
  }

  return c.json({
    messages: enrichedMessages,
    total: Number(totalResult[0].count),
    page,
    limit,
  });
});

// ─── Actions ────────────────────────────────────────────────────────────────

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("react"),
    phone: z.string().min(1),
    messageId: z.string().min(1),
    emoji: z.string().min(1),
    sessaoId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("markread"),
    messageIds: z.array(z.string().min(1)),
    chatPhone: z.string().min(1),
    sessaoId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("presence"),
    phone: z.string().min(1),
    state: z.enum(["composing", "paused"]),
    media: z.enum(["audio"]).optional(),
    sessaoId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("delete"),
    phone: z.string().min(1),
    messageId: z.string().min(1),
    sessaoId: z.string().uuid().optional(),
  }),
]);

app.post("/whatsapp/actions", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados invalidos", details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;

  const sessaoId = "sessaoId" in data ? data.sessaoId : undefined;
  let config = undefined;
  if (sessaoId) {
    const [sessao] = await db.select({ apiToken: whatsappSessao.apiToken })
      .from(whatsappSessao)
      .where(and(eq(whatsappSessao.id, sessaoId), eq(whatsappSessao.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (sessao) config = sessionToConfig(sessao);
  } else {
    const [sessao] = await db.select({ apiToken: whatsappSessao.apiToken })
      .from(whatsappSessao)
      .where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId))
      .limit(1);
    if (sessao) config = sessionToConfig(sessao);
  }

  try {
    switch (data.action) {
      case "react":
        await reactToMessage(data.phone, data.messageId, data.emoji, config);
        await db.execute(sql`
          UPDATE whatsapp_mensagens
          SET reactions = (
            SELECT jsonb_agg(r)
            FROM (
              SELECT * FROM jsonb_array_elements(COALESCE(reactions, '[]'::jsonb)) r
              WHERE r->>'sender' != 'me'
              UNION ALL
              SELECT ${JSON.stringify({ emoji: data.emoji, sender: "me" })}::jsonb
            ) sub
          )
          WHERE uazapi_message_id = ${data.messageId}
        `);
        return c.json({ ok: true, emoji: data.emoji });
      case "markread":
        await markRead(data.messageIds, data.chatPhone, config);
        return c.json({ ok: true });
      case "presence":
        await setPresence(data.phone, data.state, data.media, config);
        return c.json({ ok: true });
      case "delete":
        await deleteMessage(data.phone, data.messageId, config);
        return c.json({ ok: true });
    }
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// ─── Avatar ─────────────────────────────────────────────────────────────────

const avatarCache = new Map<string, { url: string; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000;

app.get("/whatsapp/avatar", async (c) => {
  const ctx = await getCtx(c);

  const phone = c.req.query("phone") ?? null;
  if (!phone) {
    return c.json({ url: "" });
  }

  const cached = avatarCache.get(phone);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    c.header("Cache-Control", "public, max-age=300");
    return c.json({ url: cached.url });
  }

  const sessions = await db
    .select()
    .from(whatsappSessao)
    .where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId));

  const session =
    sessions.find((s) => s.isDefault && s.status === "connected") ||
    sessions.find((s) => s.status === "connected") ||
    sessions[0];

  if (!session) {
    return c.json({ url: "" });
  }

  const config = sessionToConfig(session);
  let url = await downloadAndSaveAvatar(phone, config);

  if (!url) {
    const cleanPhone = phone.replace(/\D/g, "");
    const last8 = cleanPhone.slice(-8);
    const [contato] = await db
      .select({ avatarUrl: contatos.avatarUrl })
      .from(contatos)
      .where(and(
        eq(contatos.organizacaoId, ctx.organizacaoId),
        like(contatos.telefone, `%${last8}`),
      ))
      .limit(1);
    if (contato?.avatarUrl) url = contato.avatarUrl;
  }

  avatarCache.set(phone, { url, ts: Date.now() });

  if (avatarCache.size > 500) {
    const now = Date.now();
    for (const [key, val] of avatarCache) {
      if (now - val.ts > CACHE_TTL) avatarCache.delete(key);
    }
  }

  c.header("Cache-Control", "public, max-age=300");
  return c.json({ url });
});

// ─── Mark All Read ──────────────────────────────────────────────────────────

app.post("/whatsapp/mark-all-read", async (c) => {
  const ctx = await getCtx(c);

  const [leadsResult, contatosResult] = await Promise.all([
    db
      .update(leads)
      .set({ whatsappNaoLidas: 0, updatedAt: new Date() })
      .where(and(eq(leads.organizacaoId, ctx.organizacaoId), gte(leads.whatsappNaoLidas, 1)))
      .returning({ id: leads.id }),
    db
      .update(contatos)
      .set({ naoLidas: 0, updatedAt: new Date() })
      .where(and(eq(contatos.organizacaoId, ctx.organizacaoId), gte(contatos.naoLidas, 1)))
      .returning({ id: contatos.id }),
  ]);

  return c.json({ updated: leadsResult.length + contatosResult.length });
});

// ─── Status ─────────────────────────────────────────────────────────────────

app.get("/whatsapp/status", async (c) => {
  const ctx = await getCtx(c);

  const sessionId = c.req.query("sessionId") ?? null;
  const viewAs = c.req.query("viewAs") ?? null;

  const isAdmin = ctx.userRole === "admin" || ctx.userRole === "super_admin";
  let effectiveUserId: string | null = null;

  if (viewAs && isAdmin) {
    effectiveUserId = viewAs;
  } else if (!isAdmin) {
    effectiveUserId = ctx.userId;
  }

  if (sessionId) {
    const [sessao] = await db.select()
      .from(whatsappSessao)
      .where(and(eq(whatsappSessao.id, sessionId), eq(whatsappSessao.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!sessao) return c.json({ error: "Sessão não encontrada" }, 404);

    if (effectiveUserId && sessao.usuarioId !== null && sessao.usuarioId !== effectiveUserId) {
      return c.json({ error: "Sessão não encontrada" }, 404);
    }

    const config = sessionToConfig(sessao);
    let live = { connected: false, phone: "", status: "disconnected", qrCode: "" };
    try {
      live = await getStatus(config);
    } catch { /* wuzapi unreachable */ }

    if (live.connected && sessao.status !== "connected") {
      await db.update(whatsappSessao).set({
        status: "connected", phoneNumber: live.phone || null,
        qrCode: null, lastConnectedAt: new Date(), updatedAt: new Date(),
      }).where(eq(whatsappSessao.id, sessao.id));
    } else if (!live.connected && sessao.status === "connected") {
      await db.update(whatsappSessao).set({
        status: live.status, qrCode: live.qrCode || null, updatedAt: new Date(),
      }).where(eq(whatsappSessao.id, sessao.id));
    }

    return c.json({
      id: sessao.id,
      sessionName: sessao.sessionName,
      label: sessao.label,
      isDefault: sessao.isDefault,
      usuarioId: sessao.usuarioId,
      status: live.connected ? "connected" : live.status,
      phoneNumber: live.connected ? live.phone : sessao.phoneNumber,
      qrCode: live.connected ? null : live.qrCode || sessao.qrCode,
    });
  }

  let sessions;
  if (effectiveUserId) {
    sessions = await db.select()
      .from(whatsappSessao)
      .where(and(
        eq(whatsappSessao.organizacaoId, ctx.organizacaoId),
        or(eq(whatsappSessao.usuarioId, effectiveUserId), isNull(whatsappSessao.usuarioId)),
      ));
  } else {
    sessions = await db.select()
      .from(whatsappSessao)
      .where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId));
  }

  const results = await Promise.all(sessions.map(async (sessao) => {
    const config = sessionToConfig(sessao);
    let live = { connected: false, phone: "", status: "disconnected", qrCode: "" };
    try {
      live = await getStatus(config);
    } catch { /* */ }

    if (live.connected && sessao.status !== "connected") {
      await db.update(whatsappSessao).set({
        status: "connected", phoneNumber: live.phone || null,
        qrCode: null, lastConnectedAt: new Date(), updatedAt: new Date(),
      }).where(eq(whatsappSessao.id, sessao.id));
    } else if (!live.connected && sessao.status === "connected") {
      await db.update(whatsappSessao).set({
        status: live.status, qrCode: live.qrCode || null, updatedAt: new Date(),
      }).where(eq(whatsappSessao.id, sessao.id));
    }

    return {
      id: sessao.id,
      sessionName: sessao.sessionName,
      label: sessao.label,
      isDefault: sessao.isDefault,
      usuarioId: sessao.usuarioId,
      status: live.connected ? "connected" : live.status,
      phoneNumber: live.connected ? live.phone : sessao.phoneNumber,
      qrCode: live.connected ? null : live.qrCode || sessao.qrCode,
    };
  }));

  return c.json({ sessions: results });
});

app.post("/whatsapp/status", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const { action, sessionId, sessionName, label } = body as {
    action: string;
    sessionId?: string;
    sessionName?: string;
    label?: string;
  };

  if (action === "create") {
    if (!sessionName) return c.json({ error: "sessionName required" }, 400);

    const token = randomBytes(24).toString("hex");
    const webhookUrl = `${process.env.NEXTAUTH_URL || "http://mcrm-production:3000"}/api/whatsapp/webhook`;

    try {
      await wuzapiCreateUser(sessionName, token, webhookUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create wuzapi session";
      return c.json({ error: msg }, 500);
    }

    const existing = await db.select({ id: whatsappSessao.id })
      .from(whatsappSessao)
      .where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId))
      .limit(1);

    const [created] = await db.insert(whatsappSessao).values({
      organizacaoId: ctx.organizacaoId,
      usuarioId: ctx.userId,
      sessionName,
      label: label || sessionName,
      apiToken: token,
      isDefault: existing.length === 0,
    }).returning();

    return c.json(created, 201);
  }

  if (!sessionId) return c.json({ error: "sessionId required" }, 400);

  const [sessao] = await db.select()
    .from(whatsappSessao)
    .where(and(eq(whatsappSessao.id, sessionId), eq(whatsappSessao.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!sessao) return c.json({ error: "Sessão não encontrada" }, 404);

  const config = sessionToConfig(sessao);

  if (action === "connect") {
    await createSession(config);
    return c.json({ status: "connecting" });
  }

  if (action === "disconnect") {
    await disconnectSession(config);
    await db.update(whatsappSessao).set({ status: "disconnected", updatedAt: new Date() }).where(eq(whatsappSessao.id, sessao.id));
    return c.json({ status: "disconnected" });
  }

  if (action === "set-default") {
    await db.update(whatsappSessao).set({ isDefault: false }).where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId));
    await db.update(whatsappSessao).set({ isDefault: true, updatedAt: new Date() }).where(eq(whatsappSessao.id, sessao.id));
    return c.json({ ok: true });
  }

  if (action === "update") {
    await db.update(whatsappSessao).set({
      ...(label !== undefined && { label }),
      updatedAt: new Date(),
    }).where(eq(whatsappSessao.id, sessao.id));
    return c.json({ ok: true });
  }

  if (action === "delete") {
    try { await disconnectSession(config); } catch { /* ok */ }
    try {
      const wuzUser = await wuzapiFindUser(sessao.sessionName);
      if (wuzUser) await wuzapiDeleteUser(wuzUser.id);
    } catch { /* ok */ }
    await db.delete(whatsappMensagens).where(eq(whatsappMensagens.sessaoId, sessao.id));
    await db.delete(whatsappSessao).where(eq(whatsappSessao.id, sessao.id));
    return c.json({ ok: true });
  }

  return c.json({ error: "Invalid action" }, 400);
});

// ─── Templates ──────────────────────────────────────────────────────────────

const createTemplateSchema = z.object({
  nome: z.string().min(1),
  categoria: z.enum(["primeiro_contato", "follow_up", "proposta", "pos_venda", "geral"]),
  conteudo: z.string().min(1),
  botoes: z.any().optional(),
});

const updateTemplateSchema = z.object({
  nome: z.string().min(1).optional(),
  categoria: z.enum(["primeiro_contato", "follow_up", "proposta", "pos_venda", "geral"]).optional(),
  conteudo: z.string().min(1).optional(),
  botoes: z.any().optional(),
});

app.get("/whatsapp/templates", async (c) => {
  const ctx = await getCtx(c);

  const templates = await db
    .select()
    .from(whatsappTemplates)
    .where(and(eq(whatsappTemplates.ativo, true), eq(whatsappTemplates.organizacaoId, ctx.organizacaoId)))
    .orderBy(asc(whatsappTemplates.categoria), asc(whatsappTemplates.nome));

  return c.json({ templates });
});

app.post("/whatsapp/templates", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const parsed = createTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Dados invalidos", details: parsed.error.flatten() }, 400);
  }

  const [template] = await db
    .insert(whatsappTemplates)
    .values({
      ...parsed.data,
      organizacaoId: ctx.organizacaoId,
    })
    .returning();

  return c.json(template, 201);
});

app.patch("/whatsapp/templates/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json();
  const parsed = updateTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Dados invalidos", details: parsed.error.flatten() }, 400);
  }

  const [updated] = await db
    .update(whatsappTemplates)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(whatsappTemplates.id, id), eq(whatsappTemplates.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) {
    return c.json({ error: "Template nao encontrado" }, 404);
  }

  return c.json(updated);
});

app.delete("/whatsapp/templates/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [updated] = await db
    .update(whatsappTemplates)
    .set({ ativo: false, updatedAt: new Date() })
    .where(and(eq(whatsappTemplates.id, id), eq(whatsappTemplates.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) {
    return c.json({ error: "Template nao encontrado" }, 404);
  }

  return c.json({ success: true });
});

// ─── Unread Count ───────────────────────────────────────────────────────────

app.get("/whatsapp/unread-count", async (c) => {
  const ctx = await getCtx(c);

  const viewAs = c.req.query("viewAs") ?? null;
  const isAdmin = ctx.userRole === "admin" || ctx.userRole === "super_admin";
  const targetUserId = (viewAs && isAdmin) ? viewAs : ctx.userId;

  const [result] = await db
    .select({
      count: sql<number>`COALESCE(SUM(${contatos.naoLidas}), 0)`,
    })
    .from(contatos)
    .where(and(
      eq(contatos.organizacaoId, ctx.organizacaoId),
      eq(contatos.responsavelId, targetUserId),
      eq(contatos.canal, "whatsapp"),
    ));

  return c.json({ count: Number(result.count) });
});

export const whatsappRoutes = app;
