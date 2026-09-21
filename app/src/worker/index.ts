import { Worker, Queue } from "bullmq";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and, lte, lt, sql as rawSql, like, gte, isNull, isNotNull, count as drizzleCount, desc, inArray, gt } from "drizzle-orm";

import http from "node:http";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const url = new URL(redisUrl);

const connection = {
  host: url.hostname,
  port: parseInt(url.port || "6379"),
  ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
  db: parseInt(url.pathname?.slice(1) || "0"),
  maxRetriesPerRequest: null as null,
  retryStrategy: (times: number) => Math.min(times * 500, 10000),
  enableOfflineQueue: true,
};

const pgSql = postgres(process.env.DATABASE_URL!, { max: 5 });
const db = drizzle(pgSql);

/**
 * Identidade canônica de contato (CUTOVER, fase 16).
 *
 * Import dinâmico como o resto do worker faz, e best-effort de propósito:
 * falhar aqui não pode derrubar o recebimento da mensagem. Só resolve a
 * PESSOA — contato de WhatsApp não abre aquisição, senão o funil inflaria com
 * 25 mil processos que ninguém vendeu.
 */
function identidadeCanonicaDeContato(
  organizacaoId: string,
  dados: { nome?: string | null; email?: string | null; telefone?: string | null },
): void {
  void import("../lib/vendas/ponte-canonica")
    .then((m) => m.garantirPessoaDeContato(organizacaoId, dados))
    .catch((e) => console.error("[worker] identidade canonica de contato falhou:", e));
}


// Catch unhandled errors to prevent silent crashes
process.on("unhandledRejection", (err) => {
  console.error("[Worker] Unhandled rejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("[Worker] Uncaught exception:", err);
  // Give time to flush logs, then exit (Docker will restart)
  setTimeout(() => process.exit(1), 1000);
});

// Health check server for Docker healthcheck
let redisConnected = false;
const healthServer = http.createServer((req, res) => {
  if (req.url === "/health") {
    if (redisConnected) {
      res.writeHead(200).end("ok");
    } else {
      res.writeHead(503).end("redis disconnected");
    }
  } else {
    res.writeHead(404).end();
  }
});
// 3002 é a porta que os três docker-compose (local, dev, prod) já testam no
// healthcheck desde sempre. O default era 3001, então o container do worker
// nascia unhealthy em todo deploy e a queda do processo nunca era detectável
// (achado da auditoria de 14/09). Alinhado aqui e declarado explicitamente nos
// composes, pra não depender de default nenhum.
const healthPort = parseInt(process.env.WORKER_HEALTH_PORT || "3002");
healthServer.listen(healthPort, "0.0.0.0", () => {
  console.log(`[Worker] Health check listening on :${healthPort}`);
});

console.log("[Worker] Starting Scott Studio CRM background workers...");

// Track Redis connection state via first worker
function trackRedisConnection(worker: Worker) {
  worker.on("ready", () => { redisConnected = true; console.log("[Worker] Redis connected"); });
  worker.on("error", (err) => { console.error("[Worker] Redis error:", err.message); });
  worker.on("closed", () => { redisConnected = false; });
}

// Lead Scoring Worker
const scoringWorker = new Worker(
  "lead-scoring",
  async (job) => {
    const { leadId } = job.data;
    console.log(`[Scoring] Processing lead ${leadId}`);
    const { calculateLeadScore } = await import("../lib/crm/lead-scoring");
    const score = await calculateLeadScore(leadId);
    console.log(`[Scoring] Lead ${leadId} score: ${score}`);
    return { leadId, score };
  },
  { connection, concurrency: 1 }
);
trackRedisConnection(scoringWorker);

// Notification Worker
const notificationWorker = new Worker(
  "notifications",
  async (job) => {
    const { type, data, organizacaoId } = job.data;
    console.log(`[Notification] ${type}:`, JSON.stringify(data));

    const { notificacoes, usuarios } = await import("../lib/db/schema");

    const adminConditions = [eq(usuarios.role, "admin")];
    if (organizacaoId) adminConditions.push(eq(usuarios.organizacaoId, organizacaoId));

    const [admin] = await db.select({ id: usuarios.id })
      .from(usuarios)
      .where(and(...adminConditions))
      .limit(1);

    if (admin) {
      const isNewLead = type === "new_lead" || type === "new_contato";
      const label = type === "new_contato" ? "Novo contato" : "Novo lead";
      await db.insert(notificacoes).values({
        usuarioId: admin.id,
        titulo: isNewLead ? `${label}: ${data.nome}` : `Notificação: ${type}`,
        mensagem: isNewLead
          ? `${data.nome} (${data.origem || "direto"}) — ${data.telefone}`
          : JSON.stringify(data),
        tipo: isNewLead ? "novo_lead" : "sistema",
        link: isNewLead ? `/leads/${data.leadId}` : undefined,
      });
    }
  },
  { connection, concurrency: 1 }
);

// Conversion Sync Worker
const conversionSyncWorker = new Worker(
  "conversion-sync",
  async (job) => {
    const { platform, events } = job.data;
    console.log(`[ConversionSync] Syncing ${events?.length || 0} events to ${platform}`);
  },
  { connection, concurrency: 1 }
);

// Stripe webhook: the HTTP route already persisted the payload by Stripe event
// ID. The worker replays that record idempotently; 30-minute polling remains
// a safety reconciliation, never the primary path.
const stripeWebhookEventsWorker = new Worker(
  "stripe-webhook-events",
  async (job) => {
    const { stripeEventId } = job.data as { stripeEventId: string };
    const { processStoredStripeWebhookEvent } = await import("../lib/integrations/stripe-webhook-events");
    const result = await processStoredStripeWebhookEvent(stripeEventId);
    console.log(`[StripeWebhookWorker] ${stripeEventId}: ${result.type}${result.skipped ? " (already processed)" : ""}`);
    return result;
  },
  { connection, concurrency: 1 },
);
trackRedisConnection(stripeWebhookEventsWorker);

// Follow-up Worker
const followUpWorker = new Worker(
  "follow-up",
  async (job) => {
    const { leadId, action } = job.data;
    console.log(`[FollowUp] Lead ${leadId}: ${action}`);
  },
  { connection, concurrency: 1 }
);

// ─── Helper: Find or create contato for a WhatsApp session + phone ─────
async function findOrCreateContato(data: {
  phone: string;
  normalized: string;
  last8: string;
  organizacaoId: string;
  sessaoId: string | null;
  pushName?: string;
}) {
  const { normalized, last8, organizacaoId, sessaoId, pushName: pushNameRaw } = data;
  const { contatos, whatsappSessao: waSessaoT, usuarios } = await import("../lib/db/schema");
  const { sanitizePushName } = await import("../lib/whatsapp/phone-utils");
  const pushName = sanitizePushName(pushNameRaw);

  // Find existing contato by sessão + phone
  if (sessaoId) {
    const [existing] = await db.select({
      id: contatos.id, nome: contatos.nome, leadId: contatos.leadId, responsavelId: contatos.responsavelId,
    })
      .from(contatos)
      .where(and(
        eq(contatos.sessaoId, sessaoId),
        like(contatos.telefone, `%${last8}`),
      ))
      .limit(1);
    if (existing) {
      // Update name from pushName if contato name is still just a phone number
      if (pushName && /^[\d+\s()-]+$/.test(existing.nome) && pushName !== existing.nome) {
        await db.update(contatos).set({ nome: pushName, updatedAt: new Date() }).where(eq(contatos.id, existing.id));
        existing.nome = pushName;
      }
      return existing;
    }
  }

  // Resolve session info for assignment
  let responsavelId: string | null = null;
  let sessaoTipo = "pessoal";
  let assignStrategy = "manual";
  if (sessaoId) {
    const [sess] = await db.select({
      usuarioId: waSessaoT.usuarioId,
      tipo: waSessaoT.tipo,
      assignStrategy: waSessaoT.assignStrategy,
    }).from(waSessaoT).where(eq(waSessaoT.id, sessaoId)).limit(1);
    if (sess) {
      sessaoTipo = sess.tipo;
      assignStrategy = sess.assignStrategy || "manual";
      if (sessaoTipo === "pessoal" && sess.usuarioId) {
        responsavelId = sess.usuarioId;
      } else if (sessaoTipo === "compartilhada") {
        if (assignStrategy === "round_robin") {
          // Get all active users, find who has fewest recent assignments
          const activeUsers = await db.select({ id: usuarios.id })
            .from(usuarios)
            .where(and(eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.ativo, true)))
            .limit(50);
          if (activeUsers.length > 0) {
            // Simple round-robin: count contatos per user, pick lowest
            const counts = await db.select({
              responsavelId: contatos.responsavelId,
              cnt: drizzleCount(),
            })
              .from(contatos)
              .where(and(
                eq(contatos.organizacaoId, organizacaoId),
                eq(contatos.canal, "whatsapp"),
              ))
              .groupBy(contatos.responsavelId);
            const countMap = new Map(counts.map(c => [c.responsavelId, Number(c.cnt)]));
            let minCount = Infinity;
            let minUser = activeUsers[0].id;
            for (const u of activeUsers) {
              const c = countMap.get(u.id) || 0;
              if (c < minCount) { minCount = c; minUser = u.id; }
            }
            responsavelId = minUser;
          }
        } else if (assignStrategy === "carga") {
          // Same as round_robin for now (both use load-based)
          const activeUsers = await db.select({ id: usuarios.id })
            .from(usuarios)
            .where(and(eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.ativo, true)))
            .limit(50);
          if (activeUsers.length > 0) {
            const counts = await db.select({
              responsavelId: contatos.responsavelId,
              cnt: drizzleCount(),
            })
              .from(contatos)
              .where(and(
                eq(contatos.organizacaoId, organizacaoId),
                eq(contatos.canal, "whatsapp"),
                isNull(contatos.leadId), // carga: only unresolved contacts
              ))
              .groupBy(contatos.responsavelId);
            const countMap = new Map(counts.map(c => [c.responsavelId, Number(c.cnt)]));
            let minCount = Infinity;
            let minUser = activeUsers[0].id;
            for (const u of activeUsers) {
              const c = countMap.get(u.id) || 0;
              if (c < minCount) { minCount = c; minUser = u.id; }
            }
            responsavelId = minUser;
          }
        }
        // manual: responsavelId stays null
      }
    }
  }

  const contatoName = pushName || normalized;
  const [newContato] = await db.insert(contatos).values({
    organizacaoId,
    canal: "whatsapp",
    nome: contatoName,
    telefone: normalized,
    sessaoId: sessaoId || undefined,
    responsavelId,
  }).returning({
    id: contatos.id, nome: contatos.nome, leadId: contatos.leadId, responsavelId: contatos.responsavelId,
  });

  console.log(`[WA] Created contato ${newContato.id} (${contatoName}) responsavel=${responsavelId || 'unassigned'}`);

  identidadeCanonicaDeContato(organizacaoId, { nome: contatoName, telefone: normalized });

  // Fire-and-forget: download WhatsApp avatar for new contato
  if (sessaoId) {
    (async () => {
      try {
        const { downloadAndSaveAvatar, sessionToConfig: toConfigFn } = await import("../lib/whatsapp/client");
        const [sess] = await db.select().from(waSessaoT).where(eq(waSessaoT.id, sessaoId)).limit(1);
        if (sess) {
          const config = toConfigFn(sess);
          const avatarUrl = await downloadAndSaveAvatar(normalized, config);
          if (avatarUrl) {
            await db.update(contatos).set({ avatarUrl }).where(eq(contatos.id, newContato.id));
            console.log(`[WA] Avatar saved for contato ${newContato.id}`);
          }
        }
      } catch { /* best-effort */ }
    })();
  }

  return newContato;
}

// ─── Helper: Cross-save message to the other session when two connected numbers talk ─────
async function crossSaveInterSession(opts: {
  senderSessaoId: string;
  recipientPhone: string;  // the phone we sent TO
  organizacaoId: string;
  message: { id?: string; type: string; text: string; caption: string; mediaUrl?: string | null; mediaFilename?: string; pushName?: string };
  localMediaUrl: string | null;
  timestamp: number;
}) {
  const { senderSessaoId, recipientPhone, organizacaoId, message, localMediaUrl, timestamp } = opts;
  const { whatsappSessao, contatos, whatsappMensagens, leads } = await import("../lib/db/schema");
  const { normalizePhone, phoneLastDigits, sanitizePushName } = await import("../lib/whatsapp/phone-utils");

  const recipientLast8 = phoneLastDigits(recipientPhone);

  // Check if recipient phone matches another session in the same org
  const allSessions = await db.select({
    id: whatsappSessao.id,
    phoneNumber: whatsappSessao.phoneNumber,
  })
    .from(whatsappSessao)
    .where(eq(whatsappSessao.organizacaoId, organizacaoId));

  const recipientSession = allSessions.find(s => {
    if (s.id === senderSessaoId) return false;
    const cleanPhone = (s.phoneNumber || "").replace(/:.*$/, "");
    return cleanPhone.length >= 8 && recipientPhone.endsWith(cleanPhone.slice(-8));
  });

  if (!recipientSession) return; // Recipient is not a connected session

  // Get sender session's phone number (this will be the "sender" in the IN message)
  const senderSession = allSessions.find(s => s.id === senderSessaoId);
  if (!senderSession?.phoneNumber) return;

  const senderPhone = normalizePhone(senderSession.phoneNumber.replace(/:.*$/, ""));
  const senderLast8 = phoneLastDigits(senderPhone);

  // Find or create contato on the RECIPIENT session for the SENDER's phone
  const [existingContato] = await db.select({
    id: contatos.id, leadId: contatos.leadId,
  })
    .from(contatos)
    .where(and(
      eq(contatos.sessaoId, recipientSession.id),
      like(contatos.telefone, `%${senderLast8}`),
    ))
    .limit(1);

  let contatoId: string;
  let contatoLeadId: string | null = null;

  if (existingContato) {
    contatoId = existingContato.id;
    contatoLeadId = existingContato.leadId;
  } else {
    // Create contato on recipient session for sender's phone
    const [newContato] = await db.insert(contatos).values({
      organizacaoId,
      canal: "whatsapp",
      nome: sanitizePushName(message.pushName) || senderPhone,
      telefone: senderPhone,
      sessaoId: recipientSession.id,
    }).returning({ id: contatos.id, leadId: contatos.leadId });
    contatoId = newContato.id;
    contatoLeadId = newContato.leadId;
    console.log(`[WA-CrossSave] Created contato ${contatoId} on session ${recipientSession.id} for ${senderPhone}`);
    identidadeCanonicaDeContato(organizacaoId, {
      nome: sanitizePushName(message.pushName) || senderPhone, telefone: senderPhone,
    });
  }

  // Dedup: check if this message was already saved (by uazapiMessageId)
  if (message.id) {
    const [dup] = await db.select({ id: whatsappMensagens.id })
      .from(whatsappMensagens)
      .where(and(
        eq(whatsappMensagens.uazapiMessageId, message.id),
        eq(whatsappMensagens.sessaoId, recipientSession.id),
      ))
      .limit(1);
    if (dup) {
      console.log(`[WA-CrossSave] Dedup: message ${message.id} already exists on recipient session`);
      return;
    }
  }

  const content = message.text || message.caption || "";
  const msgType = message.type || "text";

  // Save as IN on the recipient session's contato
  await db.insert(whatsappMensagens).values({
    contatoId,
    leadId: contatoLeadId || undefined,
    sessaoId: recipientSession.id,
    telefone: senderPhone,
    direcao: "in",
    tipo: msgType,
    conteudo: content,
    mediaUrl: localMediaUrl,
    mediaFilename: message.mediaFilename || null,
    uazapiMessageId: message.id ? `xsave-${message.id}` : null, // prefix to avoid PK conflict
    status: "received",
    statusAt: new Date(timestamp * 1000),
  });

  // Update contato preview + unread
  const preview = content.length > 100 ? content.substring(0, 97) + "..." : content;
  await db.update(contatos).set({
    ultimaMsg: preview || `[${msgType}]`,
    ultimaMsgAt: new Date(),
    naoLidas: rawSql`nao_lidas + 1`,
    updatedAt: new Date(),
  }).where(eq(contatos.id, contatoId));

  if (contatoLeadId) {
    await db.update(leads).set({
      whatsappUltimaMsg: preview || `[${msgType}]`,
      whatsappNaoLidas: rawSql`COALESCE(whatsapp_nao_lidas, 0) + 1`,
      whatsappUltimaMsgAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(leads.id, contatoLeadId));
  }

  console.log(`[WA-CrossSave] Saved IN message on session ${recipientSession.id} contato ${contatoId}`);
}

// ─── Phone Outgoing Handler (messages sent from phone, not CRM) ─────
async function handlePhoneOutgoing(data: {
  phone: string;
  organizacaoId: string;
  sessaoId?: string;
  message: { id: string; type: string; text: string; caption: string; mediaUrl: string; mediaFilename: string; pushName?: string; raw: unknown; mediaDownloadInfo?: Record<string, unknown> | null; base64Media?: string | null; base64MimeType?: string | null; wuzapiMessageId?: string | null };
  timestamp: number;
}) {
  const { phone, organizacaoId, sessaoId, message, timestamp } = data;
  const { normalizePhone, phoneLastDigits } = await import("../lib/whatsapp/phone-utils");
  const { contatos, whatsappMensagens, whatsappSessao } = await import("../lib/db/schema");
  const { downloadMedia, downloadMediaByMessageId, saveBase64ToDisk, sessionToConfig } = await import("../lib/whatsapp/client");

  const normalized = normalizePhone(phone);
  const last8 = phoneLastDigits(phone);
  console.log(`[WA-PhoneOut] Message sent from phone to ${normalized}`);

  // Dedup: skip if this wuzapi message ID was already stored (sent via CRM)
  if (message.id) {
    const [existing] = await db.select({ id: whatsappMensagens.id })
      .from(whatsappMensagens)
      .where(eq(whatsappMensagens.uazapiMessageId, message.id))
      .limit(1);
    if (existing) {
      console.log(`[WA-PhoneOut] Dedup: message ${message.id} already exists, skipping`);
      return;
    }
  }

  // Find or create contato (not lead)
  const contato = await findOrCreateContato({
    phone, normalized, last8, organizacaoId, sessaoId: sessaoId || null,
  });

  const content = message.text || message.caption || "";
  const msgType = message.type || "text";

  // Download and save media locally for phone-sent messages
  let localMediaUrl = message.mediaUrl || null;
  if (["image", "audio", "video", "document", "sticker"].includes(msgType)) {
    const fileId = message.id || `phone-out-${Date.now()}`;
    let saved = false;

    // Resolve session config once (used by multiple download attempts)
    let config = undefined;
    if (sessaoId) {
      const [sessao] = await db.select({ apiToken: whatsappSessao.apiToken })
        .from(whatsappSessao).where(eq(whatsappSessao.id, sessaoId)).limit(1);
      if (sessao) config = sessionToConfig(sessao);
    }

    if (message.mediaDownloadInfo) {
      try {
        const dlInfo = message.mediaDownloadInfo as { url: string; mediaKey: string; mimetype: string; fileSHA256: string; fileLength: number | string; directPath: string };
        const downloaded = await downloadMedia(msgType, dlInfo, config);
        if (downloaded.base64) {
          localMediaUrl = saveBase64ToDisk(downloaded.base64, fileId, msgType, message.mediaFilename || undefined, downloaded.mimetype);
          saved = true;
        }
      } catch (dlErr) {
        console.error(`[WA-PhoneOut] Failed to download media via mediaDownloadInfo:`, dlErr);
      }
    }

    // Fallback: re-download via wuzapi MessageId (base64 was stripped from job payload)
    if (!saved && message.wuzapiMessageId) {
      try {
        const downloaded = await downloadMediaByMessageId(msgType, message.wuzapiMessageId, config);
        if (downloaded) {
          localMediaUrl = saveBase64ToDisk(downloaded.base64, fileId, msgType, message.mediaFilename || undefined, downloaded.mimetype);
          saved = true;
        }
      } catch (dlErr) {
        console.error(`[WA-PhoneOut] Failed to download media via wuzapi messageId:`, dlErr);
      }
    }

    if (!saved && message.base64Media) {
      try {
        localMediaUrl = saveBase64ToDisk(message.base64Media, fileId, msgType, message.mediaFilename || undefined, message.base64MimeType || undefined);
        saved = true;
      } catch (b64Err) {
        console.error(`[WA-PhoneOut] Failed to save base64 media:`, b64Err);
      }
    }
  }

  await db.insert(whatsappMensagens).values({
    contatoId: contato.id,
    leadId: contato.leadId || undefined,
    sessaoId: sessaoId || null,
    telefone: normalized,
    direcao: "out",
    tipo: msgType,
    conteudo: content,
    mediaUrl: localMediaUrl,
    mediaFilename: message.mediaFilename || null,
    uazapiMessageId: message.id || null,
    status: "sent",
    statusAt: new Date(timestamp * 1000),
  });

  // Update contato preview
  const preview = content.length > 100 ? content.substring(0, 97) + "..." : content;
  await db.update(contatos).set({
    ultimaMsg: preview || `[${msgType}]`,
    ultimaMsgAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(contatos.id, contato.id));

  // Also update lead preview if linked
  if (contato.leadId) {
    const { leads } = await import("../lib/db/schema");
    await db.update(leads).set({
      whatsappUltimaMsg: preview || `[${msgType}]`,
      whatsappUltimaMsgAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(leads.id, contato.leadId));
  }

  console.log(`[WA-PhoneOut] Stored outgoing message for contato ${contato.id} (${contato.nome})`);

  // Cross-save: if recipient is another connected session, save as IN on their side
  if (sessaoId) {
    try {
      await crossSaveInterSession({
        senderSessaoId: sessaoId,
        recipientPhone: normalized,
        organizacaoId,
        message,
        localMediaUrl,
        timestamp,
      });
    } catch (err) {
      console.error(`[WA-PhoneOut] Cross-save failed:`, err);
    }
  }
}

// ─── Webhook Event Dispatcher (moved from API route to worker) ──
async function handleWebhookEvent(data: {
  instanceName: string;
  eventType: string;
  payload: Record<string, unknown>;
  receivedAt: number;
}) {
  const { instanceName, eventType, payload } = data;
  const { whatsappSessao, whatsappMensagens } = await import("../lib/db/schema");

  // Resolve organization from session name
  const [sessao] = await db.select({
    id: whatsappSessao.id,
    organizacaoId: whatsappSessao.organizacaoId,
    phoneNumber: whatsappSessao.phoneNumber,
    usuarioId: whatsappSessao.usuarioId,
  })
    .from(whatsappSessao)
    .where(eq(whatsappSessao.sessionName, instanceName))
    .limit(1);

  if (!sessao?.organizacaoId) {
    console.warn(`[Webhook] Unknown session: ${instanceName}`);
    return;
  }

  const organizacaoId = sessao.organizacaoId;
  const sessaoId = sessao.id;
  const eventData = (payload.event as Record<string, unknown>) || {};

  switch (eventType) {
    case "Message": {
      const info = (eventData.Info || eventData.info || {}) as Record<string, unknown>;
      const message = (eventData.Message || eventData.message || {}) as Record<string, unknown>;
      const isFromMe = !!(info.IsFromMe || info.isFromMe);

      const chatJid = (info.Chat || info.chat || "") as string;
      // Skip groups, broadcasts and WhatsApp Channels (newsletters: 120363...@newsletter)
      if (chatJid.includes("@g.us") || chatJid.includes("@broadcast") || chatJid.includes("@newsletter")) break;

      // Extract phone — prefer @s.whatsapp.net over @lid
      const rawChat = (info.Chat || info.chat || "") as string;
      const rawSender = (info.Sender || info.sender || "") as string;
      const rawSenderAlt = (info.SenderAlt || info.senderAlt || "") as string;
      const rawRecipientAlt = (info.RecipientAlt || info.recipientAlt || "") as string;

      const extractPhone = (jid: string): string | null => {
        if (!jid) return null;
        const isLid = jid.includes("@lid");
        const digits = jid.replace(/@.*$/, "").replace(/:.*$/, "");
        return isLid ? null : digits || null;
      };

      let phone: string;
      if (isFromMe) {
        phone = extractPhone(rawChat) || extractPhone(rawRecipientAlt) || rawChat.replace(/@.*$/, "").replace(/:.*$/, "");
      } else {
        phone = extractPhone(rawChat) || extractPhone(rawSender) || extractPhone(rawSenderAlt) || rawChat.replace(/@.*$/, "").replace(/:.*$/, "");
      }
      if (!phone) break;
      // Defense-in-depth: real phone numbers never exceed 15 digits.
      // WhatsApp Channel/community JIDs are 18-digit ids (120363...) — drop them.
      if (phone.length < 8 || phone.length > 15) break;

      // Skip self-messages
      const ownPhone = (sessao.phoneNumber || "").replace(/:.*$/, "");
      if (ownPhone && phone.endsWith(ownPhone.slice(-8))) break;

      // Handle reaction messages embedded as "Message" type
      const reactionMsg = message.reactionMessage as Record<string, unknown> | undefined;
      if (reactionMsg) {
        const rKey = (reactionMsg.key || {}) as Record<string, unknown>;
        const rMsgId = (rKey.ID || rKey.Id || rKey.id || "") as string;
        const rEmoji = (reactionMsg.text || reactionMsg.Text || "") as string;
        const rFromMe = !!(rKey.fromMe || rKey.FromMe);
        if (rMsgId) {
          await handleReaction(rMsgId, rEmoji, rFromMe);
        }
        break;
      }

      let tipo = "text";
      let conteudo = "";
      let caption = "";
      let mediaUrl = "";
      let mediaFilename = "";

      const imageMsg = message.imageMessage as Record<string, string> | undefined;
      const docMsg = message.documentMessage as Record<string, string> | undefined;
      const audioMsg = message.audioMessage as Record<string, string> | undefined;
      const videoMsg = message.videoMessage as Record<string, string> | undefined;
      const stickerMsg = message.stickerMessage as Record<string, string> | undefined;
      const locMsg = message.locationMessage as Record<string, number> | undefined;
      const conversation = message.conversation as string | undefined;
      const extText = message.extendedTextMessage as Record<string, string> | undefined;

      if (conversation) conteudo = conversation;
      else if (extText) conteudo = extText.text || "";

      if (imageMsg) { tipo = "image"; caption = imageMsg.caption || ""; mediaUrl = imageMsg.URL || imageMsg.url || ""; }
      else if (docMsg) { tipo = "document"; caption = docMsg.caption || ""; mediaUrl = docMsg.URL || docMsg.url || ""; mediaFilename = docMsg.FileName || docMsg.fileName || ""; }
      else if (audioMsg) { tipo = "audio"; mediaUrl = audioMsg.URL || audioMsg.url || ""; }
      else if (videoMsg) { tipo = "video"; caption = videoMsg.caption || ""; mediaUrl = videoMsg.URL || videoMsg.url || ""; }
      else if (stickerMsg) { tipo = "sticker"; mediaUrl = stickerMsg.URL || stickerMsg.url || ""; }
      else if (locMsg) { tipo = "location"; conteudo = `${locMsg.degreesLatitude},${locMsg.degreesLongitude}`; }

      // Extract media download info
      let mediaDownloadInfo: Record<string, unknown> | null = null;
      const mediaMsg = imageMsg || docMsg || audioMsg || videoMsg || stickerMsg;
      if (mediaMsg) {
        const url = (mediaMsg as Record<string, unknown>).Url || (mediaMsg as Record<string, unknown>).URL || (mediaMsg as Record<string, unknown>).url || "";
        const mediaKey = (mediaMsg as Record<string, unknown>).MediaKey || (mediaMsg as Record<string, unknown>).mediaKey || "";
        const mimetype = (mediaMsg as Record<string, unknown>).Mimetype || (mediaMsg as Record<string, unknown>).mimetype || "";
        const fileSHA256 = (mediaMsg as Record<string, unknown>).FileSHA256 || (mediaMsg as Record<string, unknown>).fileSha256 || (mediaMsg as Record<string, unknown>).fileSHA256 || "";
        const fileLength = (mediaMsg as Record<string, unknown>).FileLength || (mediaMsg as Record<string, unknown>).fileLength || 0;
        const directPath = (mediaMsg as Record<string, unknown>).DirectPath || (mediaMsg as Record<string, unknown>).directPath || "";
        if (mediaKey || directPath) mediaDownloadInfo = { url, mediaKey, mimetype, fileSHA256, fileLength, directPath };
      }

      // Check for media already downloaded by the webhook handler (stored in _mediaBase64)
      // The webhook downloads media IMMEDIATELY because WuzAPI encryption keys expire fast
      const webhookBase64 = (eventData._mediaBase64 as string) || (payload.base64 as string) || null;
      const base64MimeType = (eventData._mediaMimeType as string) || (mediaMsg ? String((mediaMsg as Record<string, unknown>).Mimetype || (mediaMsg as Record<string, unknown>).mimetype || "") : "") || "";
      if (webhookBase64 && webhookBase64.length > 1000) {
        console.log(`[WA-In] Using pre-downloaded media: ${tipo} (${Math.round(webhookBase64.length / 1024)}KB)`);
      }
      if (webhookBase64 && !mediaUrl) mediaUrl = `wuzapi-deferred:${tipo}:${base64MimeType || "application/octet-stream"}`;

      // Skip empty messages
      if (!conteudo && !caption && !mediaUrl && tipo === "text") break;

      const pushName = (info.PushName || info.pushName || "") as string;
      const msgId = (info.ID || info.Id || info.id || "") as string;
      const timestamp = info.Timestamp
        ? Math.floor(new Date(info.Timestamp as string).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

      const msgPayload = {
        id: msgId, type: tipo, text: conteudo || caption, caption,
        mediaUrl: tipo !== "text" ? mediaUrl : "", mediaFilename,
        pushName, raw: eventData, mediaDownloadInfo,
        base64Media: webhookBase64, base64MimeType: base64MimeType || null,
        wuzapiMessageId: msgId, // fallback to re-download via wuzapi API
      };

      const { whatsappIncomingQueue: waInQueue } = await import("../lib/queue");

      if (isFromMe) {
        await waInQueue.add("phone-outgoing-message", {
          phone, organizacaoId, sessaoId,
          usuarioId: sessao.usuarioId || null,
          message: msgPayload, timestamp, isFromMe: true,
        }, { removeOnComplete: 100, removeOnFail: 500 });
        console.log(`[Webhook] Outgoing (from phone) queued to ${phone} via ${instanceName}`);
      } else {
        await waInQueue.add("incoming-message", {
          phone, organizacaoId, sessaoId,
          usuarioId: sessao.usuarioId || null,
          message: msgPayload, timestamp,
        }, { removeOnComplete: 100, removeOnFail: 500 });
        console.log(`[Webhook] Message queued from ${phone} (${pushName || "unknown"}) via ${instanceName}`);
      }
      break;
    }

    case "ReadReceipt": {
      const ids = (eventData.MessageIDs || eventData.messageIDs || []) as string[];
      const state = (payload.state as string) || "";
      if (state === "ReadSelf") break;
      const statusMap: Record<string, string> = { Delivered: "delivered", Read: "read", Played: "read" };
      const mappedStatus = statusMap[state] || state.toLowerCase();
      const ts = eventData.Timestamp
        ? Math.floor(new Date(eventData.Timestamp as string).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

      const { whatsappStatusQueue: waStatusQueue } = await import("../lib/queue");
      for (const messageId of ids) {
        await waStatusQueue.add("status-update", { messageId, status: mappedStatus, timestamp: ts }, { removeOnComplete: 100, removeOnFail: 200 });
      }
      if (ids.length > 0) console.log(`[Webhook] ReadReceipt (${state}) for ${ids.length} msgs`);
      break;
    }

    case "Reaction": {
      const rKey = (eventData.Key || eventData.key || {}) as Record<string, unknown>;
      const rMsgId = (rKey.Id || rKey.id || "") as string;
      const rEmoji = (eventData.Text || eventData.text || "") as string;
      const rFromMe = !!(rKey.FromMe || rKey.fromMe);
      if (rMsgId) await handleReaction(rMsgId, rEmoji, rFromMe);
      break;
    }

    case "CallOffer":
    case "CallAccept":
    case "CallTerminate": {
      const callInfo = (eventData.Info || eventData.info || eventData) as Record<string, unknown>;
      const callFrom = (callInfo.From || callInfo.from || callInfo.CallCreator || callInfo.callCreator || "") as string;
      const callPhone = callFrom.replace(/@.*$/, "").replace(/:.*$/, "");
      if (callPhone) {
        const { whatsappIncomingQueue: waInQueue } = await import("../lib/queue");
        await waInQueue.add("call-event", {
          type: eventType === "CallOffer" ? "offer" : eventType === "CallAccept" ? "accept" : "terminate",
          phone: callPhone, organizacaoId, sessaoId,
          timestamp: Math.floor(Date.now() / 1000),
        }, { removeOnComplete: 50, removeOnFail: 200 });
        console.log(`[Webhook] Call ${eventType} from ${callPhone} via ${instanceName}`);
      }
      break;
    }

    case "HistorySync": {
      const syncData = eventData as Record<string, unknown>;
      const conversations = (syncData.Conversations || syncData.conversations || []) as unknown[];
      if (conversations.length > 0) {
        const { whatsappIncomingQueue: waInQueue } = await import("../lib/queue");
        await waInQueue.add("history-sync", {
          organizacaoId, sessaoId, conversations,
          ownPhone: sessao.phoneNumber || "",
        }, { removeOnComplete: 10, removeOnFail: 50 });
        console.log(`[Webhook] HistorySync queued: ${conversations.length} conversations via ${instanceName}`);
      }
      break;
    }

    default:
      if (eventType) console.log(`[Webhook] Unhandled event: ${eventType}`);
  }
}

// ─── Reaction handler (fixed SQL) ──────────────────────────────
async function handleReaction(msgId: string, emoji: string, fromMe: boolean) {
  const { whatsappMensagens } = await import("../lib/db/schema");
  const sender = fromMe ? "me" : "them";

  try {
    if (emoji) {
      // Add/update reaction — fixed: use explicit column references instead of SELECT *
      await db.execute(rawSql`
        UPDATE whatsapp_mensagens
        SET reactions = (
          SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) || ${JSON.stringify([{ emoji, sender }])}::jsonb
          FROM jsonb_array_elements(COALESCE(reactions, '[]'::jsonb)) AS elem
          WHERE elem->>'sender' <> ${sender}
        )
        WHERE uazapi_message_id = ${msgId}
      `);
    } else {
      // Remove reaction
      await db.execute(rawSql`
        UPDATE whatsapp_mensagens
        SET reactions = (
          SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(reactions, '[]'::jsonb)) AS elem
          WHERE elem->>'sender' <> ${sender}
        )
        WHERE uazapi_message_id = ${msgId}
      `);
    }
    console.log(`[Webhook] Reaction ${emoji || "(removed)"} on ${msgId} from ${sender}`);
  } catch (err) {
    console.error(`[Webhook] Reaction update failed for ${msgId}:`, err);
  }
}

// ─── AI SDR Auto-Response Handler ────────────────────────────
async function handleAiSdrResponse(params: {
  contatoId: string;
  contatoNome: string;
  leadId: string | null;
  organizacaoId: string;
  sessaoId: string | null;
  currentMessage: string;
  phone: string;
  sourceMessageId?: string | null;
}) {
  const { contatoId, contatoNome, leadId, organizacaoId, sessaoId, currentMessage, phone, sourceMessageId } = params;

  // Callpilot nativo (port Deskcomm, P0 #1 — ver docs/reconstruction/DESKCOMM-AI-NATIVE-PORT-2026-08-24.md):
  // se a organização tem agente publicado elegível para este evento, o runtime novo assume a
  // conversa e o legado abaixo nem roda. Se o agente nativo existir mas falhar de verdade, NÃO
  // cai no legado por baixo — geraria resposta duplicada/incoerente; a falha fica registrada no
  // run (ai_agent_runs) pra aparecer em Execuções/Alertas.
  try {
    const { executeAgent, NoEligibleAgentError } = await import("../lib/ai-platform/runtime/execute-agent");
    try {
      await executeAgent({
        organizacaoId,
        eventType: "conversation.message_received",
        message: currentMessage,
        contatoId,
        leadId,
        sourceMessageId: sourceMessageId ?? null,
        mode: "live",
      });
      return;
    } catch (err) {
      if (!(err instanceof NoEligibleAgentError)) {
        console.error(`[Callpilot] Falha na execução do agente nativo para contato ${contatoId} (sem fallback pro legado, evita resposta duplicada):`, err);
        return;
      }
      // Sem agente nativo publicado elegível — segue fluxo legado abaixo, sem mudança de comportamento.
    }
  } catch (importErr) {
    console.error(`[Callpilot] Falha ao carregar runtime nativo, seguindo fluxo legado:`, importErr);
  }

  const {
    aiSdrConfig: aiSdrConfigT, aiSdrContatoState: stateT, aiSdrLogs: logsT,
    leads: leadsT, negocios: negociosT, contatos: contatosT,
    whatsappMensagens: waMsgs, servicosCatalogo: servicosT,
    notificacoes: notifT, usuarios: usuariosT, tarefas: tarefasT,
  } = await import("../lib/db/schema");

  // 1. Check if AI SDR is enabled for this org
  const [config] = await db.select().from(aiSdrConfigT)
    .where(eq(aiSdrConfigT.organizacaoId, organizacaoId)).limit(1);

  if (!config || !config.ativo) return;

  // 2. Check contato state — is AI active for this contact?
  let [state] = await db.select().from(stateT)
    .where(eq(stateT.contatoId, contatoId)).limit(1);

  // If no state exists, create one (AI active by default)
  if (!state) {
    [state] = await db.insert(stateT).values({
      contatoId,
      organizacaoId,
      aiAtivo: true,
    }).returning();
  }

  if (!state.aiAtivo) {
    // Handoffs "leves" (não achou horário de agenda que bateu, ou o próprio
    // lead pediu pra deixar registrado) não devem silenciar a IA pra sempre —
    // achado real (13/07): lead voltou dizendo "consigo sim" depois de um
    // handoff por horário e a Natália nunca mais respondeu, deixando ele sem
    // solução. Motivos que indicam necessidade real de humano (frustração,
    // pedido explícito reforçado, valor alto, keyword, fora de escopo) continuam
    // bloqueando a IA permanentemente pra este contato.
    const motivosLeves = ["criterio_concluido", "pedido_contato"];
    if (state.handoffMotivo && motivosLeves.includes(state.handoffMotivo)) {
      console.log(`[AI-SDR] Reativando IA pra contato ${contatoId} — handoff leve (${state.handoffMotivo}) e lead voltou a escrever`);
      await db.update(stateT).set({
        aiAtivo: true, handoffStatus: "ai_handling", handoffAt: null, handoffMotivo: null, updatedAt: new Date(),
      }).where(eq(stateT.id, state.id));
      state = { ...state, aiAtivo: true };
    } else {
      console.log(`[AI-SDR] AI disabled for contato ${contatoId}, skipping`);
      return;
    }
  }

  // 3. Decrypt API key
  let apiKey = process.env.OPENAI_API_KEY;
  if (config.groqApiKey) {
    try {
      const { decrypt } = await import("../lib/email/encryption");
      apiKey = decrypt(config.groqApiKey);
    } catch { /* use env fallback */ }
  }
  if (!apiKey) {
    console.log("[AI-SDR] No OpenAI API key, skipping");
    return;
  }

  // 4. Check business hours
  const { isWithinBusinessHours } = await import("../lib/ai/sdr");
  const horario = config.horarioComercial as { inicio: string; fim: string; diasSemana: number[]; timezone: string } | null;
  if (!isWithinBusinessHours(horario)) {
    // Send out-of-hours message if configured
    if (config.foraHorarioMsg && sessaoId) {
      const { whatsappOutgoingQueue } = await import("../lib/queue/index");
      const [outMsg] = await db.insert(waMsgs).values({
        contatoId,
        leadId: leadId || undefined,
        sessaoId,
        telefone: phone,
        direcao: "out",
        tipo: "text",
        conteudo: config.foraHorarioMsg,
        status: "pending",
        dados: { aiGenerated: true },
      }).returning({ id: waMsgs.id });

      await whatsappOutgoingQueue.add("send", {
        messageId: outMsg.id,
        phone,
        conteudo: config.foraHorarioMsg,
        tipo: "text",
        sessaoId,
      });
    }
    console.log("[AI-SDR] Outside business hours, skipping");
    return;
  }

  // 5. Rate limiting
  const now = new Date();
  const windowStart = state.janelaResetAt ? new Date(state.janelaResetAt) : new Date(0);
  const windowMs = (config.rateLimitWindowMin || 60) * 60 * 1000;
  let msgsInWindow = state.aiMsgsNaJanela || 0;

  if (now.getTime() - windowStart.getTime() > windowMs) {
    msgsInWindow = 0;
    await db.update(stateT).set({
      aiMsgsNaJanela: 0,
      janelaResetAt: now,
      updatedAt: now,
    }).where(eq(stateT.id, state.id));
  }

  if (msgsInWindow >= (config.rateLimitMsgs || 10)) {
    console.log(`[AI-SDR] Rate limit reached for contato ${contatoId} (${msgsInWindow}/${config.rateLimitMsgs})`);
    return;
  }

  // 6. Debounce — wait to let the lead finish typing
  const debounceMs = config.debounceMs || 5000;
  const debounceStart = new Date();
  await new Promise(resolve => setTimeout(resolve, debounceMs));

  // Check if newer messages arrived during debounce period
  const [newerMsg] = await db.select({ id: waMsgs.id })
    .from(waMsgs)
    .where(and(
      eq(waMsgs.contatoId, contatoId),
      eq(waMsgs.direcao, "in"),
      gt(waMsgs.createdAt, debounceStart),
    ))
    .limit(1);

  if (newerMsg) {
    console.log(`[AI-SDR] Newer message arrived during debounce, skipping (will process newer)`);
    return;
  }

  // 7. Gather context
  const startTime = Date.now();

  // Get conversation history (last 30 messages)
  const history = await db.select({
    direcao: waMsgs.direcao,
    tipo: waMsgs.tipo,
    conteudo: waMsgs.conteudo,
    dados: waMsgs.dados,
    createdAt: waMsgs.createdAt,
  })
    .from(waMsgs)
    .where(eq(waMsgs.contatoId, contatoId))
    .orderBy(desc(waMsgs.createdAt))
    .limit(30);

  // Reverse to chronological order, exclude the current message (already included as currentMessage)
  const historyMessages = history.reverse().slice(0, -1);

  // Get lead context
  let leadContext: import("../lib/ai/sdr").LeadContext | null = null;
  if (leadId) {
    const [lead] = await db.select({
      nome: leadsT.nome,
      sobrenome: leadsT.sobrenome,
      empresa: leadsT.empresa,
      cargo: leadsT.cargo,
      email: leadsT.email,
      servicosInteresse: leadsT.servicosInteresse,
      leadScore: leadsT.leadScore,
      status: leadsT.status,
      insumoComercial: leadsT.insumoComercial,
      cipaDiagnostico: leadsT.cipaDiagnostico,
      cipaScore: leadsT.cipaScore,
    }).from(leadsT).where(eq(leadsT.id, leadId)).limit(1);
    if (lead) {
      leadContext = {
        ...lead,
        insumoComercial: lead.insumoComercial as Record<string, unknown> | null,
        cipaDiagnostico: lead.cipaDiagnostico as Record<string, unknown> | null,
      };
    }
  }

  // If no lead linked, create minimal context from contato name
  if (!leadContext && contatoNome) {
    leadContext = {
      nome: contatoNome, sobrenome: null, empresa: null, cargo: null,
      email: null, servicosInteresse: null, leadScore: null, status: null,
      insumoComercial: null, cipaDiagnostico: null, cipaScore: null,
    };
  }

  // Get negocio context (active deal for this lead)
  let negocioContext = null;
  if (leadId) {
    const [neg] = await db.select({
      titulo: negociosT.titulo,
      status: negociosT.status,
      valorTotal: negociosT.valorTotal,
      tipoReceita: negociosT.tipoReceita,
      insumoComercial: negociosT.insumoComercial,
      cipaDiagnostico: negociosT.cipaDiagnostico,
      cipaScore: negociosT.cipaScore,
    }).from(negociosT)
      .where(and(
        eq(negociosT.leadId, leadId),
        inArray(negociosT.status, ["reuniao_agendada", "reuniao_realizada", "proposta_apresentada", "negociacao_iniciada", "em_fechamento"]),
      ))
      .limit(1);
    if (neg) negocioContext = neg;

    // Fallback: if lead has no insumo/cipa but negocio does, enrich lead context
    if (leadContext && neg) {
      if (!leadContext.insumoComercial && neg.insumoComercial) {
        leadContext.insumoComercial = neg.insumoComercial as Record<string, unknown>;
      }
      if (!leadContext.cipaDiagnostico && neg.cipaDiagnostico) {
        leadContext.cipaDiagnostico = neg.cipaDiagnostico as Record<string, unknown>;
      }
      if (!leadContext.cipaScore && neg.cipaScore) {
        leadContext.cipaScore = neg.cipaScore;
      }
    }
  }

  // Get services catalog
  const servicos = await db.select({
    nome: servicosT.nome,
    descricao: servicosT.descricao,
    tipo: servicosT.tipo,
    valorSugerido: servicosT.valorSugerido,
    unidade: servicosT.unidade,
  }).from(servicosT)
    .where(and(eq(servicosT.organizacaoId, organizacaoId), eq(servicosT.ativo, true)))
    .limit(20);

  // Get org name
  const { organizacoes: orgsT } = await import("../lib/db/schema");
  const [org] = await db.select({ nome: orgsT.nome }).from(orgsT).where(eq(orgsT.id, organizacaoId)).limit(1);

  // 7b. Check handoff triggers before calling AI
  const triggers = config.handoffTriggers as { keywords?: string[]; sentimentoNegativo?: boolean; valorAlto?: number } | null;
  if (triggers?.keywords?.length) {
    const msgLower = currentMessage.toLowerCase();
    const matched = triggers.keywords.some(kw => msgLower.includes(kw.toLowerCase()));
    if (matched) {
      console.log(`[AI-SDR] Handoff trigger keyword matched for contato ${contatoId}`);
      // Auto-handoff: disable AI, notify admin
      await db.update(stateT).set({
        aiAtivo: false, handoffStatus: "human_required", handoffAt: new Date(),
        handoffMotivo: "keyword_trigger", updatedAt: new Date(),
      }).where(eq(stateT.id, state.id));
      const [admin] = await db.select({ id: usuariosT.id }).from(usuariosT)
        .where(and(eq(usuariosT.organizacaoId, organizacaoId), eq(usuariosT.role, "admin"))).limit(1);
      if (admin) {
        await db.insert(notifT).values({
          usuarioId: admin.id,
          titulo: `Handoff SDR: ${contatoNome}`,
          mensagem: `Trigger por keyword na msg: "${currentMessage.substring(0, 100)}"`,
          tipo: "sdr_handoff",
          link: `/whatsapp?contato=${contatoId}`,
        });
      }
      await db.insert(logsT).values({
        organizacaoId, contatoId, leadId: leadId || undefined,
        tipo: "handoff", inputContent: currentMessage,
        decisao: "handoff", motivo: "keyword_trigger",
      });
      return;
    }
  }
  if (triggers?.valorAlto && negocioContext?.valorTotal) {
    const valor = parseFloat(String(negocioContext.valorTotal));
    if (!isNaN(valor) && valor >= triggers.valorAlto) {
      console.log(`[AI-SDR] Handoff trigger: high value deal (${valor}) for contato ${contatoId}`);
      await db.update(stateT).set({
        aiAtivo: false, handoffStatus: "human_required", handoffAt: new Date(),
        handoffMotivo: "valor_alto", updatedAt: new Date(),
      }).where(eq(stateT.id, state.id));
      const [admin] = await db.select({ id: usuariosT.id }).from(usuariosT)
        .where(and(eq(usuariosT.organizacaoId, organizacaoId), eq(usuariosT.role, "admin"))).limit(1);
      if (admin) {
        await db.insert(notifT).values({
          usuarioId: admin.id,
          titulo: `Handoff SDR: ${contatoNome} (valor alto)`,
          mensagem: `Deal R$${valor} excede limite de R$${triggers.valorAlto}`,
          tipo: "sdr_handoff",
          link: `/whatsapp?contato=${contatoId}`,
        });
      }
      await db.insert(logsT).values({
        organizacaoId, contatoId, leadId: leadId || undefined,
        tipo: "handoff", inputContent: currentMessage,
        decisao: "handoff", motivo: "valor_alto",
      });
      return;
    }
  }

  // 7c. Agenda disponível (calendário nativo, round-robin entre closers) — só
  // oferece slot se ainda não há negócio ativo pra este lead (já agendado = não
  // oferece de novo). Round-robin + slots calculados aqui e reaproveitados no
  // tool schedule_meeting (mesma closer/lista oferecida na conversa).
  let agendaContext: import("../lib/ai/sdr").AgendaContext | null = null;
  let pickedCloserId: string | null = null;
  // Oferece slot se não há negócio ainda, OU se já tem reunião marcada mas o lead
  // quer remarcar (negocio ainda em "reuniao_agendada" = nada avançou de verdade).
  if (leadId && (!negocioContext || negocioContext.status === "reuniao_agendada")) {
    const { pickNextCloser, getAvailableSlots, formatSlotLabel, getActiveClosers } = await import("../lib/crm/agenda-closers");

    // Reaproveita o closer já oferecido pra este lead (leads.agendaCloserId) em vez
    // de recalcular o round-robin a cada turno — sem isso, se outro lead fechasse
    // reunião no meio desta conversa, o closer oferecido na msg 1 podia virar
    // diferente do usado quando o lead confirma o horário na msg 3.
    const [leadRow] = await db.select({ agendaCloserId: leadsT.agendaCloserId })
      .from(leadsT).where(eq(leadsT.id, leadId)).limit(1);

    let closer: { id: string; nome: string } | null = null;
    if (leadRow?.agendaCloserId) {
      const ativos = await getActiveClosers(db, organizacaoId);
      closer = ativos.find((c: { id: string }) => c.id === leadRow.agendaCloserId) || null;
    }

    let slots = closer ? await getAvailableSlots(db, closer.id, { maxSlots: 8 }) : [];

    // Sem closer pinado ainda, ou o pinado ficou sem horário livre (agenda cheia) → repicka.
    if (!closer || slots.length === 0) {
      const picked = await pickNextCloser(db, organizacaoId);
      if (picked) {
        closer = picked;
        slots = await getAvailableSlots(db, closer.id, { maxSlots: 8 });
      }
    }

    if (closer) {
      pickedCloserId = closer.id;
      if (leadRow?.agendaCloserId !== closer.id) {
        await db.update(leadsT).set({ agendaCloserId: closer.id }).where(eq(leadsT.id, leadId));
      }
      agendaContext = {
        closerNome: closer.nome,
        slots: slots.map((s) => ({ iso: s.inicio.toISOString(), label: formatSlotLabel(s) })),
      };
    }
  }

  // 8. Call OpenAI
  const { callAiSdr } = await import("../lib/ai/sdr");

  const aiResponse = await callAiSdr({
    config: {
      groqApiKey: apiKey,
      modelo: config.modelo,
      systemPrompt: config.systemPrompt,
      nomeAssistente: config.nomeAssistente,
      idiomaResposta: config.idiomaResposta,
      maxTokensResposta: config.maxTokensResposta,
      temperaturaModelo: config.temperaturaModelo,
      stageConfig: config.stageConfig as Record<string, import("../lib/ai/sdr").StageConfig> | null,
      styleGuide: config.styleGuide,
      knowledgeBase: config.knowledgeBase,
      handoffTriggers: config.handoffTriggers as { keywords?: string[]; sentimentoNegativo?: boolean; valorAlto?: number } | null,
    },
    orgNome: org?.nome || "Scott Studio",
    messages: historyMessages.map(m => ({
      direcao: m.direcao as "in" | "out",
      tipo: m.tipo,
      conteudo: m.conteudo,
      dados: m.dados as { aiGenerated?: boolean } | null,
      createdAt: m.createdAt,
    })),
    currentMessage,
    lead: leadContext,
    negocio: negocioContext,
    servicos,
    contatoNome,
    conversationSummary: state.conversationSummary,
    qualificacaoExtraida: state.qualificacaoExtraida as Record<string, unknown> | null,
    agenda: agendaContext,
  });

  const latenciaMs = Date.now() - startTime;

  // 9. Process tool calls
  let handoffTriggered = false;
  let qualifyData: Record<string, unknown> | null = null;

  for (const tc of aiResponse.toolCalls) {
    if (tc.name === "qualify_lead" && leadId) {
      qualifyData = tc.input;
      // Update lead with extracted data
      const updateFields: Record<string, unknown> = { updatedAt: new Date() };
      if (tc.input.empresa) updateFields.empresa = tc.input.empresa;
      if (tc.input.cargo) updateFields.cargo = tc.input.cargo;
      if (tc.input.setor) updateFields.empresaSetor = tc.input.setor;
      if (tc.input.porte) updateFields.empresaPorte = tc.input.porte;
      if (tc.input.servicosInteresse) updateFields.servicosInteresse = tc.input.servicosInteresse;
      await db.update(leadsT).set(updateFields).where(eq(leadsT.id, leadId));

      // Mesmos campos do painel humano QualificacaoSdrSection (exceto CNPJ, que a
      // IA nunca pede pelo chat) — assim quando ela qualifica e converte o lead,
      // o closer já vê o painel preenchido em vez de vazio. Merge raso dentro de
      // campos_custom.qualificacaoSdr pra não apagar o que o closer já preencheu.
      const sdrPatch: Record<string, string> = {};
      if (tc.input.produtoInteresse) sdrPatch.produto = tc.input.produtoInteresse as string;
      if (tc.input.setoresTelefonia) sdrPatch.quemRealizaCall = tc.input.setoresTelefonia as string;
      if (tc.input.tomadorDecisao) sdrPatch.tomadorDecisao = tc.input.tomadorDecisao as string;
      if (tc.input.crmAtual) sdrPatch.crmAtual = tc.input.crmAtual as string;
      if (tc.input.numUsuarios !== undefined) sdrPatch.numUsuarios = String(tc.input.numUsuarios);
      if (Object.keys(sdrPatch).length > 0) {
        await db.execute(rawSql`
          UPDATE leads SET campos_custom = jsonb_set(
            COALESCE(campos_custom, '{}'::jsonb),
            '{qualificacaoSdr}',
            COALESCE(campos_custom->'qualificacaoSdr', '{}'::jsonb) || ${JSON.stringify(sdrPatch)}::jsonb
          ) WHERE id = ${leadId}
        `);
      }
    }

    if (tc.name === "handoff") {
      handoffTriggered = true;
      // Disable AI for this contact
      await db.update(stateT).set({
        aiAtivo: false,
        handoffStatus: "human_required",
        handoffAt: new Date(),
        handoffMotivo: (tc.input.motivo as string) || "ai_triggered",
        updatedAt: new Date(),
      }).where(eq(stateT.id, state.id));

      // Create notification for admin/responsible
      const [admin] = await db.select({ id: usuariosT.id })
        .from(usuariosT)
        .where(and(eq(usuariosT.organizacaoId, organizacaoId), eq(usuariosT.role, "admin")))
        .limit(1);
      if (admin) {
        await db.insert(notifT).values({
          usuarioId: admin.id,
          titulo: `Handoff SDR: ${contatoNome}`,
          mensagem: `AI SDR transferiu conversa: ${tc.input.motivo || "sem motivo"}. Prioridade: ${tc.input.prioridade || "normal"}`,
          tipo: "sdr_handoff",
          link: `/whatsapp?contato=${contatoId}`,
        });
      }

      // Create task
      if (admin && leadId) {
        await db.insert(tarefasT).values({
          organizacaoId,
          leadId,
          usuarioId: admin.id,
          titulo: `Handoff SDR: ${contatoNome}`,
          descricao: (tc.input.mensagemTransicao as string) || "AI SDR transferiu a conversa",
          tipo: "follow_up",
          prioridade: (tc.input.prioridade as string) === "urgente" ? "alta" : "media",
          dataVencimento: new Date().toISOString().split("T")[0],
        });
      }
    }

    if (tc.name === "advance_stage" && leadId) {
      const novoStatus = tc.input.novoStatus as string;
      if (novoStatus) {
        // Update negocio status if exists
        if (negocioContext) {
          await db.update(negociosT).set({
            status: novoStatus,
            updatedAt: new Date(),
          }).where(and(eq(negociosT.leadId, leadId), eq(negociosT.status, negocioContext.status)));
        }
        // Update lead sdrStatus.
        // IMPORTANTE: "qualifying" é o valor que o board mostra como coluna "Follow up"
        // (lead que a IA NÃO conseguiu qualificar em 48h, escalado pra Jenifer — ver
        // SDR_CONTATO_ESCALATION_HOURS em lib/crm/pipeline.ts). Um lead que só respondeu
        // e está sendo ativamente trabalhado pela IA NÃO pode cair em "qualifying" — ele
        // continua em "contacted" ("Em Contato") até qualificar de verdade ou estourar o
        // prazo (aí quem move é o job de escalação, não este tool call).
        const sdrStatusMap: Record<string, string> = {
          em_contato: "contacted",
          respondeu: "contacted",
          reuniao_agendada: "scheduled",
          sem_retorno: "disqualified",
        };
        await db.update(leadsT).set({
          sdrStatus: sdrStatusMap[novoStatus] || "contacted",
          updatedAt: new Date(),
        }).where(eq(leadsT.id, leadId));

        // If sem_retorno, also disable AI for this contact
        if (novoStatus === "sem_retorno") {
          await db.update(stateT).set({
            aiAtivo: false,
            handoffStatus: "human_required",
            handoffAt: new Date(),
            handoffMotivo: "sem_retorno",
            updatedAt: new Date(),
          }).where(eq(stateT.contatoId, contatoId));
        }
      }
    }

    if (tc.name === "schedule_meeting" && leadId) {
      const horarioIso = tc.input.horarioEscolhidoIso as string | undefined;

      if (!horarioIso || !pickedCloserId) {
        // Sem slot real oferecido (agenda vazia / closer indisponível) — cai pra
        // um humano resolver manualmente em vez de fingir que agendou algo.
        console.error(`[AI-SDR] schedule_meeting sem horarioEscolhidoIso/closer disponível pro lead ${leadId} — handoff manual necessário.`);
        const [admin] = await db.select({ id: usuariosT.id })
          .from(usuariosT)
          .where(and(eq(usuariosT.organizacaoId, organizacaoId), eq(usuariosT.role, "admin")))
          .limit(1);
        if (admin) {
          await db.insert(notifT).values({
            usuarioId: admin.id,
            titulo: `Agendar manualmente: ${contatoNome}`,
            mensagem: `Agente SDR não achou horário/closer disponível pra agendar. Assunto: ${tc.input.assunto || ""}`,
            tipo: "sdr_meeting",
            link: `/whatsapp?contato=${contatoId}`,
          });
        }
      } else {
        // Reaproveita a MESMA lógica do fluxo manual (SDR arrasta card / usa o
        // modal) — ver lib/crm/converter-oportunidade.ts e
        // callface/ai-sdr-agente-spec.md seção 6.
        const { converterLeadEmOportunidade } = await import("../lib/crm/converter-oportunidade");
        const { resolveAiSdrUserId } = await import("../lib/crm/ai-sdr-outreach");
        const aiUserId = await resolveAiSdrUserId(db, organizacaoId);

        const result = await converterLeadEmOportunidade(db, {
          organizacaoId,
          leadId,
          usuarioId: aiUserId,
          closerId: pickedCloserId,
          reuniao: {
            data: horarioIso,
            duracao: 30,
            tipo: "call",
            titulo: (tc.input.assunto as string) || undefined,
            notas: (tc.input.observacoes as string) || undefined,
          },
        });

        if ("error" in result) {
          console.error(`[AI-SDR] schedule_meeting falhou pro lead ${leadId}: ${result.error}`);
        } else {
          console.log(`[AI-SDR] Reunião criada via schedule_meeting: negocio=${result.negocioId} reuniao=${result.reuniaoId}`);
          // Lead qualificado e agendado: não precisa mais da cadência de retentativa automática.
          await db.update(leadsT).set({ nextFollowupAt: null }).where(eq(leadsT.id, leadId));
        }
      }
    }
  }

  // 10. Send response messages
  if (aiResponse.responseText && sessaoId && !handoffTriggered) {
    const { whatsappOutgoingQueue } = await import("../lib/queue/index");
    const messageParts = aiResponse.responseText.split("\n---SPLIT---\n").filter(Boolean);

    for (let i = 0; i < messageParts.length; i++) {
      const text = messageParts[i].trim();
      if (!text) continue;

      // Humanized delay between messages
      const delayMin = config.delayMinMs || 2000;
      const delayMax = config.delayMaxMs || 5000;
      const delay = delayMin + Math.random() * (delayMax - delayMin);

      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const [outMsg] = await db.insert(waMsgs).values({
        contatoId,
        leadId: leadId || undefined,
        sessaoId,
        telefone: phone,
        direcao: "out",
        tipo: "text",
        conteudo: text,
        status: "pending",
        dados: { aiGenerated: true },
      }).returning({ id: waMsgs.id });

      await whatsappOutgoingQueue.add("send", {
        messageId: outMsg.id,
        phone,
        conteudo: text,
        tipo: "text",
        sessaoId,
      });
    }

    // Update contato preview
    const lastMsg = messageParts[messageParts.length - 1]?.trim() || "";
    await db.update(contatosT).set({
      ultimaMsg: lastMsg.substring(0, 100),
      ultimaMsgAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(contatosT.id, contatoId));
  }

  // Also send handoff transition message if provided
  if (handoffTriggered) {
    const handoffTc = aiResponse.toolCalls.find(tc => tc.name === "handoff");
    const transitionMsg = handoffTc?.input?.mensagemTransicao as string;
    if (transitionMsg && sessaoId) {
      const { whatsappOutgoingQueue } = await import("../lib/queue/index");
      const [outMsg] = await db.insert(waMsgs).values({
        contatoId,
        leadId: leadId || undefined,
        sessaoId,
        telefone: phone,
        direcao: "out",
        tipo: "text",
        conteudo: transitionMsg,
        status: "pending",
        dados: { aiGenerated: true },
      }).returning({ id: waMsgs.id });

      await whatsappOutgoingQueue.add("send", {
        messageId: outMsg.id,
        phone,
        conteudo: transitionMsg,
        tipo: "text",
        sessaoId,
      });
    }
  }

  // 11. Update contato state
  const didSendMessage = !!(aiResponse.responseText && sessaoId && !handoffTriggered);

  // Lead está respondendo e sendo trabalhado ativamente: limpa a retentativa
  // automática de "sem resposta" (lib/crm/ai-sdr-outreach.ts). Evita o job de
  // retry mandar um follow-up de "você sumiu" no meio de uma conversa ativa.
  if (didSendMessage && leadId) {
    await db.update(leadsT).set({ nextFollowupAt: null, lastContactAt: new Date() }).where(eq(leadsT.id, leadId));
  }

  const stateUpdate: Record<string, unknown> = {
    totalTokensUsados: rawSql`total_tokens_usados + ${aiResponse.tokensInput + aiResponse.tokensOutput}`,
    updatedAt: new Date(),
  };
  // Only increment message counters if we actually sent a response
  if (didSendMessage) {
    stateUpdate.ultimaAiMsgAt = new Date();
    stateUpdate.aiMsgsNaJanela = rawSql`ai_msgs_na_janela + 1`;
    stateUpdate.totalMsgsAi = rawSql`total_msgs_ai + 1`;
  }
  if (aiResponse.conversationSummary) {
    stateUpdate.conversationSummary = aiResponse.conversationSummary;
  }
  if (aiResponse.intentDetectado) {
    stateUpdate.intentDetectado = aiResponse.intentDetectado;
  }
  if (aiResponse.confianca !== null) {
    stateUpdate.confianca = String(aiResponse.confianca);
  }
  if (qualifyData) {
    // Merge qualification data
    const existing = (state.qualificacaoExtraida || {}) as Record<string, unknown>;
    stateUpdate.qualificacaoExtraida = { ...existing, ...qualifyData };
  }
  await db.update(stateT).set(stateUpdate).where(eq(stateT.id, state.id));

  // 12. Log
  await db.insert(logsT).values({
    organizacaoId,
    contatoId,
    leadId: leadId || undefined,
    tipo: handoffTriggered ? "handoff" : "resposta",
    inputContent: currentMessage,
    outputContent: aiResponse.responseText,
    intentDetectado: aiResponse.intentDetectado,
    confianca: aiResponse.confianca !== null ? String(aiResponse.confianca) : null,
    dadosExtraidos: qualifyData,
    decisao: handoffTriggered ? "handoff" : "respond",
    tokensInput: aiResponse.tokensInput,
    tokensOutput: aiResponse.tokensOutput,
    latenciaMs,
    modeloUsado: config.modelo,
  });

  console.log(`[AI-SDR] Processed contato ${contatoId}: intent=${aiResponse.intentDetectado}, tokens=${aiResponse.tokensInput + aiResponse.tokensOutput}, latency=${latenciaMs}ms${handoffTriggered ? " [HANDOFF]" : ""}`);
}

// Monta a instrução de abertura pro 1º contato (Natália, 10/07: template treinado
// com o Kauã). Formato fixo: msg 1 = saudação + apresentação; msg 2 = contexto
// real do motivo do contato (nunca inventa origem que não tem).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildOpenerDirective(lead: any): string {
  const primeiroNome = (lead.nome || "").trim().split(/\s+/)[0] || lead.nome || "";
  const origem = (lead.origem || lead.comoConheceu || "").toString().trim();
  const contextoOrigem = origem
    ? `Ele veio até a Callface via ${origem}. Use isso pra dar contexto real (ex: "vi que você se interessou pela Callface através de ${origem}"), sem inventar detalhes que você não tem.`
    : `Não há informação da origem exata dele. Diga só algo como "vi que você deixou contato com a gente", sem inventar canal/campanha específica.`;

  return `Este é o primeiro contato com este lead. A abertura precisa seguir EXATAMENTE esta estrutura, em 2 mensagens separadas (uma por chamada de "respond", ou no array de mensagens em sequência):

1ª mensagem (saudação + apresentação, literal): "Oi ${primeiroNome}! Aqui é a Natália, da Callface."
2ª mensagem (contexto do motivo do contato): ${contextoOrigem}

NÃO faça nenhuma pergunta de qualificação ainda nessas 2 mensagens iniciais, NÃO ofereça reunião. Espere a resposta do lead antes de avançar pro fluxo (entender o contexto → descobrir a dor → explorar o impacto → confirmar aderência → marcar reunião).`;
}

// ─── Agente SDR: disparo automático do 1º contato ──────────────────────────
// Roda em sweep (job "ai-sdr-outreach"). Lead cai em Pré-vendas/Novo (sdrStatus
// pending) → o Agente SDR (usuário pseudo "Natália", ver lib/crm/ai-sdr-outreach.ts)
// manda a 1ª mensagem sozinho, move o lead pra "Em Contato" e assume como responsável.
// Ver callface/ai-sdr-agente-spec.md seção 5.
async function runAiSdrFirstContactSweep(): Promise<{ iniciados: number }> {
  const {
    leads: leadsT, aiSdrConfig: aiSdrConfigT, aiSdrContatoState: stateT,
    contatos: contatosT, whatsappSessao: waSessaoT, whatsappMensagens: waMsgs,
    statusChanges, atividades, aiSdrLogs: logsT, organizacoes: orgsT, servicosCatalogo: servicosT,
  } = await import("../lib/db/schema");
  const { resolveAiSdrUserId } = await import("../lib/crm/ai-sdr-outreach");
  const { callAiSdr } = await import("../lib/ai/sdr");

  const configs = await db.select().from(aiSdrConfigT).where(eq(aiSdrConfigT.ativo, true));
  let iniciados = 0;

  for (const config of configs) {
    const aiUserId = await resolveAiSdrUserId(db, config.organizacaoId);
    if (!aiUserId) continue; // usuário "Natália" não existe nessa org ainda

    const [sessao] = await db.select().from(waSessaoT)
      .where(and(eq(waSessaoT.usuarioId, aiUserId), eq(waSessaoT.status, "connected")))
      .limit(1);
    if (!sessao) continue; // sem número conectado (QR não escaneado ainda)

    // ⚠️ TRAVA DE SEGURANÇA (10/07, incidente real): sem o filtro de recência, o
    // primeiro sweep depois de ligar `ativo=true` varre TODO lead pending que já
    // existia no banco — incluindo leads antigos de meses atrás nunca trabalhados
    // (aconteceu em homolog: 20 leads reais de prospecção de 02/07 receberam
    // mensagem no minuto em que liguei o motor). O gate correto é: só lead que
    // caiu em "Novo" DEPOIS que o motor está ativo, não backlog histórico.
    const janelaMaxima = new Date(Date.now() - 2 * 60 * 60 * 1000); // últimas 2h

    const pendentes = await db.select().from(leadsT)
      .where(and(
        eq(leadsT.organizacaoId, config.organizacaoId),
        eq(leadsT.tipo, "lead"),
        eq(leadsT.sdrStatus, "pending"),
        isNotNull(leadsT.telefone),
        gte(leadsT.createdAt, janelaMaxima),
      ))
      .limit(20); // teto por rodada — evita rajada se represar muito lead de uma vez

    for (const lead of pendentes) {
      try {
        const normalized = lead.telefone as string;
        const last8 = normalized.replace(/\D/g, "").slice(-8);

        const [existingContato] = await db.select({ id: contatosT.id })
          .from(contatosT)
          .where(and(eq(contatosT.sessaoId, sessao.id), like(contatosT.telefone, `%${last8}`)))
          .limit(1);

        let contatoId: string;
        if (existingContato) {
          contatoId = existingContato.id;
          await db.update(contatosT).set({ leadId: lead.id, responsavelId: aiUserId, updatedAt: new Date() }).where(eq(contatosT.id, contatoId));
        } else {
          const [novo] = await db.insert(contatosT).values({
            organizacaoId: config.organizacaoId,
            canal: "whatsapp",
            nome: lead.nome,
            telefone: normalized,
            sessaoId: sessao.id,
            leadId: lead.id,
            responsavelId: aiUserId,
          }).returning({ id: contatosT.id });
          contatoId = novo.id;
          identidadeCanonicaDeContato(config.organizacaoId, {
            nome: lead.nome, email: lead.email, telefone: normalized,
          });
        }

        await db.insert(stateT).values({ contatoId, organizacaoId: config.organizacaoId, aiAtivo: true })
          .onConflictDoNothing({ target: stateT.contatoId });

        const now = new Date();
        await db.update(leadsT).set({
          sdrStatus: "contacted",
          responsavelId: aiUserId,
          contatoDesdeAt: now,
          primeiroContatoAt: lead.primeiroContatoAt || now,
          outreachStartedAt: now,
          lastContactAt: now,
          nextFollowupAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
          updatedAt: now,
        }).where(eq(leadsT.id, lead.id));

        await db.insert(statusChanges).values({
          leadId: lead.id, deStatus: "pending", paraStatus: "contacted",
          usuarioId: aiUserId, motivo: "Agente SDR iniciou contato automaticamente",
        });
        await db.insert(atividades).values({
          leadId: lead.id, organizacaoId: config.organizacaoId, usuarioId: aiUserId,
          tipo: "nota", titulo: "Etapa de pré-vendas",
          descricao: "Novo → Em Contato (Agente SDR, automático)",
        });

        let apiKey = process.env.OPENAI_API_KEY;
        if (config.groqApiKey) {
          try {
            const { decrypt } = await import("../lib/email/encryption");
            apiKey = decrypt(config.groqApiKey);
          } catch { /* env fallback */ }
        }
        if (!apiKey) { console.warn("[AI-SDR-Outreach] Sem OPENAI_API_KEY, pulando envio"); continue; }

        const [org] = await db.select({ nome: orgsT.nome }).from(orgsT).where(eq(orgsT.id, config.organizacaoId)).limit(1);
        const servicos = await db.select({
          nome: servicosT.nome, descricao: servicosT.descricao, tipo: servicosT.tipo,
          valorSugerido: servicosT.valorSugerido, unidade: servicosT.unidade,
        }).from(servicosT).where(and(eq(servicosT.organizacaoId, config.organizacaoId), eq(servicosT.ativo, true))).limit(20);

        const aiResponse = await callAiSdr({
          config: {
            groqApiKey: apiKey, modelo: config.modelo, systemPrompt: config.systemPrompt,
            nomeAssistente: config.nomeAssistente, idiomaResposta: config.idiomaResposta,
            maxTokensResposta: config.maxTokensResposta, temperaturaModelo: config.temperaturaModelo,
            stageConfig: config.stageConfig as Record<string, import("../lib/ai/sdr").StageConfig> | null,
            styleGuide: config.styleGuide, knowledgeBase: config.knowledgeBase,
            handoffTriggers: config.handoffTriggers as { keywords?: string[]; sentimentoNegativo?: boolean; valorAlto?: number } | null,
          },
          orgNome: org?.nome || "Callface",
          messages: [],
          currentMessage: "",
          lead: {
            nome: lead.nome, sobrenome: lead.sobrenome, empresa: lead.empresa, cargo: lead.cargo,
            email: lead.email, servicosInteresse: lead.servicosInteresse, leadScore: lead.leadScore,
            status: lead.status,
            insumoComercial: lead.insumoComercial as Record<string, unknown> | null,
            cipaDiagnostico: lead.cipaDiagnostico as Record<string, unknown> | null,
            cipaScore: lead.cipaScore,
          },
          negocio: null,
          servicos,
          contatoNome: lead.nome,
          conversationSummary: null,
          qualificacaoExtraida: null,
          openerDirective: buildOpenerDirective(lead),
        });

        if (aiResponse.responseText) {
          const { whatsappOutgoingQueue } = await import("../lib/queue/index");
          const parts = aiResponse.responseText.split("\n---SPLIT---\n").filter(Boolean);
          for (let i = 0; i < parts.length; i++) {
            const text = parts[i].trim();
            if (!text) continue;
            if (i > 0) await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
            const [outMsg] = await db.insert(waMsgs).values({
              contatoId, leadId: lead.id, sessaoId: sessao.id, telefone: normalized,
              direcao: "out", tipo: "text", conteudo: text, status: "pending",
              dados: { aiGenerated: true },
            }).returning({ id: waMsgs.id });
            await whatsappOutgoingQueue.add("send", { messageId: outMsg.id, phone: normalized, conteudo: text, tipo: "text", sessaoId: sessao.id });
          }
          await db.update(contatosT).set({
            ultimaMsg: parts[parts.length - 1]?.trim().substring(0, 100),
            ultimaMsgAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(contatosT.id, contatoId));
        }

        // Persiste o resumo da abertura — sem isso, a 1ª retentativa (se o lead
        // não responder) não sabia o que já tinha sido dito e repetia a mesma
        // mensagem literalmente (achado real na auditoria de 13/07).
        if (aiResponse.conversationSummary) {
          await db.update(stateT).set({
            conversationSummary: aiResponse.conversationSummary,
            updatedAt: new Date(),
          }).where(eq(stateT.contatoId, contatoId));
        }

        await db.insert(logsT).values({
          organizacaoId: config.organizacaoId, contatoId, leadId: lead.id,
          tipo: "resposta", inputContent: "[abertura automática]", outputContent: aiResponse.responseText,
          decisao: "respond", tokensInput: aiResponse.tokensInput, tokensOutput: aiResponse.tokensOutput,
          modeloUsado: config.modelo,
        });

        iniciados++;
      } catch (e) {
        console.error(`[AI-SDR-Outreach] erro no lead ${lead.id}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  return { iniciados };
}

// ─── Agente SDR: retentativa automática (~2h / 24h / 40h sem resposta) ─────
// Roda em sweep (job "ai-sdr-retry"). Rede de segurança: handleAiSdrResponse já
// limpa nextFollowupAt sempre que o lead responde e a IA processa reativamente
// (ver "11. Update contato state" acima) — isso aqui só dispara quando o lead
// ficou em silêncio. Ver callface/ai-sdr-agente-spec.md seção 5.
async function runAiSdrRetrySweep(): Promise<{ enviados: number }> {
  const {
    leads: leadsT, aiSdrConfig: aiSdrConfigT, contatos: contatosT,
    whatsappMensagens: waMsgs, aiSdrLogs: logsT, organizacoes: orgsT, servicosCatalogo: servicosT,
    aiSdrContatoState: stateT,
  } = await import("../lib/db/schema");
  const { callAiSdr } = await import("../lib/ai/sdr");

  const now = new Date();
  const due = await db.select().from(leadsT)
    .where(and(
      eq(leadsT.sdrStatus, "contacted"),
      eq(leadsT.tipo, "lead"),
      isNotNull(leadsT.nextFollowupAt),
      lte(leadsT.nextFollowupAt, now),
    ))
    .limit(50);

  let enviados = 0;

  for (const lead of due) {
    try {
      const [config] = await db.select().from(aiSdrConfigT).where(eq(aiSdrConfigT.organizacaoId, lead.organizacaoId)).limit(1);
      if (!config || !config.ativo) {
        await db.update(leadsT).set({ nextFollowupAt: null }).where(eq(leadsT.id, lead.id));
        continue;
      }

      const [contato] = await db.select({ id: contatosT.id, sessaoId: contatosT.sessaoId })
        .from(contatosT).where(eq(contatosT.leadId, lead.id)).limit(1);
      if (!contato?.sessaoId) continue;

      // Memória entre tentativas: sem isso, cada retentativa esquecia o que a
      // abertura (ou a retentativa anterior) já tinha dito, e a IA repetia a
      // mesma mensagem literalmente (achado real na auditoria de 13/07 — mesmo
      // texto de abertura mandado 2x pro mesmo lead). openerDirective descarta
      // o histórico bruto de mensagens de propósito (ver callAiSdr em sdr.ts),
      // mas o resumo/qualificação persistidos SEMPRE são injetados no prompt.
      const [contatoState] = await db.select({
        conversationSummary: stateT.conversationSummary,
        qualificacaoExtraida: stateT.qualificacaoExtraida,
      }).from(stateT).where(eq(stateT.contatoId, contato.id)).limit(1);

      // Se o lead já respondeu depois do último contato, não é retentativa —
      // handleAiSdrResponse já cuidou disso (limpou nextFollowupAt). Isso aqui é
      // só uma checagem de segurança extra.
      const [ultimaIn] = await db.select({ createdAt: waMsgs.createdAt }).from(waMsgs)
        .where(and(eq(waMsgs.contatoId, contato.id), eq(waMsgs.direcao, "in")))
        .orderBy(desc(waMsgs.createdAt)).limit(1);
      if (ultimaIn && lead.lastContactAt && ultimaIn.createdAt > new Date(lead.lastContactAt)) {
        await db.update(leadsT).set({ nextFollowupAt: null }).where(eq(leadsT.id, lead.id));
        continue;
      }

      const horasDesde = lead.outreachStartedAt
        ? (now.getTime() - new Date(lead.outreachStartedAt).getTime()) / 3_600_000
        : 999;

      let directiveMsg: string;
      let proximoTier: Date | null;
      if (horasDesde < 24) {
        directiveMsg = "O lead ainda não respondeu sua mensagem de abertura. Mande um follow-up curto e natural (reforce rapidamente o motivo do contato), sem parecer insistente.";
        proximoTier = new Date(now.getTime() + 16 * 60 * 60 * 1000); // próxima tentativa perto de 40h desde o início
      } else if (horasDesde < 40) {
        directiveMsg = "Este já é o segundo follow-up, o lead segue sem responder há mais de um dia. Mande uma última tentativa breve, sem pressão, deixando a porta aberta pra quando ele puder.";
        proximoTier = null; // depois desta, quem assume é a escalação de 48h (Jenifer)
      } else {
        await db.update(leadsT).set({ nextFollowupAt: null }).where(eq(leadsT.id, lead.id));
        continue;
      }

      let apiKey = process.env.OPENAI_API_KEY;
      if (config.groqApiKey) {
        try {
          const { decrypt } = await import("../lib/email/encryption");
          apiKey = decrypt(config.groqApiKey);
        } catch { /* env fallback */ }
      }
      if (!apiKey) continue;

      const [org] = await db.select({ nome: orgsT.nome }).from(orgsT).where(eq(orgsT.id, lead.organizacaoId)).limit(1);
      const servicos = await db.select({
        nome: servicosT.nome, descricao: servicosT.descricao, tipo: servicosT.tipo,
        valorSugerido: servicosT.valorSugerido, unidade: servicosT.unidade,
      }).from(servicosT).where(and(eq(servicosT.organizacaoId, lead.organizacaoId), eq(servicosT.ativo, true))).limit(20);

      const aiResponse = await callAiSdr({
        config: {
          groqApiKey: apiKey, modelo: config.modelo, systemPrompt: config.systemPrompt,
          nomeAssistente: config.nomeAssistente, idiomaResposta: config.idiomaResposta,
          maxTokensResposta: config.maxTokensResposta, temperaturaModelo: config.temperaturaModelo,
          stageConfig: config.stageConfig as Record<string, import("../lib/ai/sdr").StageConfig> | null,
          styleGuide: config.styleGuide, knowledgeBase: config.knowledgeBase,
          handoffTriggers: config.handoffTriggers as { keywords?: string[]; sentimentoNegativo?: boolean; valorAlto?: number } | null,
        },
        orgNome: org?.nome || "Callface",
        messages: [],
        currentMessage: "",
        lead: {
          nome: lead.nome, sobrenome: lead.sobrenome, empresa: lead.empresa, cargo: lead.cargo,
          email: lead.email, servicosInteresse: lead.servicosInteresse, leadScore: lead.leadScore,
          status: lead.status,
          insumoComercial: lead.insumoComercial as Record<string, unknown> | null,
          cipaDiagnostico: lead.cipaDiagnostico as Record<string, unknown> | null,
          cipaScore: lead.cipaScore,
        },
        negocio: null,
        servicos,
        contatoNome: lead.nome,
        conversationSummary: contatoState?.conversationSummary ?? null,
        qualificacaoExtraida: contatoState?.qualificacaoExtraida as Record<string, unknown> | null ?? null,
        openerDirective: directiveMsg,
      });

      if (aiResponse.responseText) {
        const { whatsappOutgoingQueue } = await import("../lib/queue/index");
        const parts = aiResponse.responseText.split("\n---SPLIT---\n").filter(Boolean);
        for (let i = 0; i < parts.length; i++) {
          const text = parts[i].trim();
          if (!text) continue;
          if (i > 0) await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
          const [outMsg] = await db.insert(waMsgs).values({
            contatoId: contato.id, leadId: lead.id, sessaoId: contato.sessaoId, telefone: lead.telefone as string,
            direcao: "out", tipo: "text", conteudo: text, status: "pending",
            dados: { aiGenerated: true },
          }).returning({ id: waMsgs.id });
          await whatsappOutgoingQueue.add("send", { messageId: outMsg.id, phone: lead.telefone, conteudo: text, tipo: "text", sessaoId: contato.sessaoId });
        }
        await db.update(contatosT).set({
          ultimaMsg: parts[parts.length - 1]?.trim().substring(0, 100),
          ultimaMsgAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(contatosT.id, contato.id));
        enviados++;
      }

      // Persiste o resumo/qualificação atualizados pra próxima retentativa (ou
      // pro fluxo reativo, se o lead responder depois) não perder o que essa
      // mensagem acrescentou.
      if (aiResponse.conversationSummary) {
        await db.update(stateT).set({
          conversationSummary: aiResponse.conversationSummary,
          updatedAt: new Date(),
        }).where(eq(stateT.contatoId, contato.id));
      }

      await db.update(leadsT).set({ lastContactAt: now, nextFollowupAt: proximoTier }).where(eq(leadsT.id, lead.id));

      await db.insert(logsT).values({
        organizacaoId: lead.organizacaoId, contatoId: contato.id, leadId: lead.id,
        tipo: "resposta", inputContent: "[retentativa automática]", outputContent: aiResponse.responseText,
        decisao: "respond", tokensInput: aiResponse.tokensInput, tokensOutput: aiResponse.tokensOutput,
        modeloUsado: config.modelo,
      });
    } catch (e) {
      console.error(`[AI-SDR-Retry] erro no lead ${lead.id}:`, e instanceof Error ? e.message : e);
    }
  }

  return { enviados };
}

// ─── Agente SDR: confirmação de reunião no dia ─────────────────────────────
// Roda 1x/dia de manhã (job "ai-sdr-meeting-confirmation"). Reuniões marcadas
// pra hoje recebem confirmação via WhatsApp. Se o lead responder que não pode,
// o handoff normal (motivo pedido_contato/sentimento_negativo) encaminha pra um
// humano reagendar — reagendamento automático fica fora do escopo desta fase
// (ver callface/ai-sdr-agente-spec.md seção 7 e riscos na seção 9).
async function runAiSdrMeetingConfirmationSweep(): Promise<{ enviados: number }> {
  const {
    reunioes: reuniosT, leads: leadsT, contatos: contatosT,
    whatsappMensagens: waMsgs, atividades: ativT, usuarios: usuariosT,
  } = await import("../lib/db/schema");

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const reunioesHoje = await db.select({
    id: reuniosT.id, data: reuniosT.data, leadId: reuniosT.leadId,
    organizacaoId: reuniosT.organizacaoId, responsavelId: reuniosT.responsavelId,
  }).from(reuniosT)
    .where(and(gte(reuniosT.data, startOfDay), lte(reuniosT.data, endOfDay), eq(reuniosT.status, "agendada")));

  let enviados = 0;

  for (const r of reunioesHoje) {
    if (!r.leadId) continue;
    try {
      const [jaConfirmado] = await db.select({ id: ativT.id }).from(ativT)
        .where(and(eq(ativT.leadId, r.leadId), eq(ativT.titulo, "Confirmação de reunião enviada"), gte(ativT.createdAt, startOfDay)))
        .limit(1);
      if (jaConfirmado) continue; // já mandou hoje, não duplica

      const [lead] = await db.select().from(leadsT).where(eq(leadsT.id, r.leadId)).limit(1);
      if (!lead?.telefone) continue;

      const [contato] = await db.select({ id: contatosT.id, sessaoId: contatosT.sessaoId })
        .from(contatosT).where(eq(contatosT.leadId, r.leadId)).limit(1);
      if (!contato?.sessaoId) continue;

      let closerNome: string | null = null;
      if (r.responsavelId) {
        const [closer] = await db.select({ nome: usuariosT.nome }).from(usuariosT).where(eq(usuariosT.id, r.responsavelId)).limit(1);
        closerNome = closer?.nome || null;
      }

      const hora = new Date(r.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
      const texto = closerNome
        ? `Oi ${lead.nome}! Passando pra confirmar: nossa reunião com ${closerNome} é hoje às ${hora}. Tá confirmado?`
        : `Oi ${lead.nome}! Passando pra confirmar: nossa reunião é hoje às ${hora}. Tá confirmado?`;

      const { whatsappOutgoingQueue } = await import("../lib/queue/index");
      const [outMsg] = await db.insert(waMsgs).values({
        contatoId: contato.id, leadId: r.leadId, sessaoId: contato.sessaoId, telefone: lead.telefone,
        direcao: "out", tipo: "text", conteudo: texto, status: "pending",
        dados: { aiGenerated: true, tipo: "confirmacao_reuniao", reuniaoId: r.id },
      }).returning({ id: waMsgs.id });
      await whatsappOutgoingQueue.add("send", { messageId: outMsg.id, phone: lead.telefone, conteudo: texto, tipo: "text", sessaoId: contato.sessaoId });

      await db.insert(ativT).values({
        leadId: r.leadId,
        organizacaoId: r.organizacaoId,
        tipo: "nota",
        titulo: "Confirmação de reunião enviada",
        descricao: `Reunião hoje às ${hora}${closerNome ? ` · closer ${closerNome}` : ""}`,
      });

      enviados++;
    } catch (e) {
      console.error(`[AI-SDR-Confirmacao] erro na reunião ${r.id}:`, e instanceof Error ? e.message : e);
    }
  }

  return { enviados };
}

// ─── WhatsApp Incoming Worker ────────────────────────────────
const whatsappIncomingWorker = new Worker(
  "whatsapp-incoming",
  async (job) => {
    // Route raw webhook events — parse and re-dispatch as typed jobs
    if (job.name === "webhook-event") {
      return handleWebhookEvent(job.data);
    }

    // Route phone-outgoing messages to separate handler
    if (job.name === "phone-outgoing-message") {
      return handlePhoneOutgoing(job.data);
    }

    // Route call events
    if (job.name === "call-event") {
      const { type, phone: callPhone, organizacaoId: callOrgId, sessaoId: callSessaoId } = job.data as {
        type: "offer" | "accept" | "terminate";
        phone: string;
        organizacaoId: string;
        sessaoId: string;
        timestamp: number;
      };
      const { normalizePhone, phoneLastDigits } = await import("../lib/whatsapp/phone-utils");
      const { contatos: contatosT, whatsappMensagens: waMsgs, atividades: ativT } = await import("../lib/db/schema");
      const normalized = normalizePhone(callPhone);
      const last8 = phoneLastDigits(callPhone);

      // Find contato by phone + session
      const contato = await findOrCreateContato({
        phone: callPhone, normalized, last8, organizacaoId: callOrgId, sessaoId: callSessaoId,
      });

      const callLabels: Record<string, string> = {
        offer: "Chamada recebida",
        accept: "Chamada atendida",
        terminate: "Chamada encerrada",
      };

      await db.insert(waMsgs).values({
        contatoId: contato.id,
        leadId: contato.leadId || undefined,
        sessaoId: callSessaoId,
        telefone: normalized,
        direcao: "in",
        tipo: "call",
        conteudo: `📞 ${callLabels[type]}`,
        status: "received",
        statusAt: new Date(),
      });

      // Only create activity if linked to lead
      if (contato.leadId) {
        await db.insert(ativT).values({
          leadId: contato.leadId,
          organizacaoId: callOrgId,
          tipo: "ligacao",
          titulo: `Chamada WhatsApp: ${callLabels[type]}`,
          descricao: `${callLabels[type]} de ${contato.nome} (${normalized})`,
        });
      }

      console.log(`[WA-Call] ${callLabels[type]} from ${contato.nome} (${normalized})`);
      return;
    }

    // Route history sync
    if (job.name === "history-sync") {
      const { organizacaoId: hsOrgId, sessaoId: hsSessaoId, conversations, ownPhone } = job.data as {
        organizacaoId: string;
        sessaoId: string;
        conversations: Array<{ ID?: string; id?: string; Messages?: Array<Record<string, unknown>>; messages?: Array<Record<string, unknown>> }>;
        ownPhone: string;
      };
      const { normalizePhone, phoneLastDigits } = await import("../lib/whatsapp/phone-utils");
      const { whatsappMensagens: waMsgs } = await import("../lib/db/schema");

      let imported = 0;
      const ownLast8 = ownPhone ? phoneLastDigits(ownPhone) : "";
      const MAX_MSGS_PER_CONVERSATION = 50;

      console.log(`[HistorySync] Processing ${conversations.length} conversations (ownPhone: ${ownPhone})`);

      for (const conv of conversations) {
        const chatId = (conv.ID || conv.id || "") as string;
        if (!chatId || chatId.includes("@g.us") || chatId.includes("@broadcast") || chatId.includes("@newsletter")) continue;

        const phone = chatId.replace(/@.*$/, "").replace(/:.*$/, "");
        // Real phone numbers never exceed 15 digits; WhatsApp Channel ids (120363...) are 18.
        if (!phone || phone.length < 8 || phone.length > 15) continue;
        // Skip self-chats
        if (ownLast8 && phone.endsWith(ownLast8)) continue;

        const normalized = normalizePhone(phone);
        const last8 = phoneLastDigits(phone);

        // Find or create contato for history sync
        const contato = await findOrCreateContato({
          phone, normalized, last8, organizacaoId: hsOrgId, sessaoId: hsSessaoId,
        });

        const allMsgs = conv.Messages || conv.messages || [];
        // Limit to last N messages per conversation (most recent first)
        const msgs = allMsgs.slice(-MAX_MSGS_PER_CONVERSATION);
        let convImported = 0;

        for (const msg of msgs) {
          const info = (msg.Info || msg.info || {}) as Record<string, unknown>;
          const msgBody = (msg.Message || msg.message || {}) as Record<string, unknown>;
          const msgId = ((info.ID || info.Id || info.id || "") as string);
          if (!msgId) continue;

          // Dedup check
          const [existing] = await db.select({ id: waMsgs.id })
            .from(waMsgs)
            .where(eq(waMsgs.uazapiMessageId, msgId))
            .limit(1);
          if (existing) continue;

          const isFromMe = !!(info.IsFromMe || info.isFromMe);

          // Extract message content and type
          const conversation = (msgBody.conversation || "") as string;
          const extText = (msgBody.extendedTextMessage as Record<string, string> | undefined);
          const imageMsg = msgBody.imageMessage as Record<string, string> | undefined;
          const audioMsg = msgBody.audioMessage as Record<string, string> | undefined;
          const videoMsg = msgBody.videoMessage as Record<string, string> | undefined;
          const docMsg = msgBody.documentMessage as Record<string, string> | undefined;
          const stickerMsg = msgBody.stickerMessage as Record<string, string> | undefined;
          const locMsg = msgBody.locationMessage as Record<string, number> | undefined;

          let tipo = "text";
          let text = conversation || extText?.text || "";
          let caption = "";

          if (imageMsg) {
            tipo = "image"; caption = imageMsg.caption || "";
          } else if (audioMsg) {
            tipo = "audio";
          } else if (videoMsg) {
            tipo = "video"; caption = videoMsg.caption || "";
          } else if (docMsg) {
            tipo = "document"; caption = docMsg.caption || "";
          } else if (stickerMsg) {
            tipo = "sticker";
          } else if (locMsg) {
            tipo = "location";
            text = `${locMsg.degreesLatitude},${locMsg.degreesLongitude}`;
          }

          const content = text || caption;
          // Skip completely empty messages (no text, no media type)
          if (!content && tipo === "text") continue;

          const msgTimestamp = info.Timestamp
            ? new Date(info.Timestamp as string)
            : info.MessageTimestamp
              ? new Date((info.MessageTimestamp as number) * 1000)
              : new Date();

          await db.insert(waMsgs).values({
            contatoId: contato.id,
            leadId: contato.leadId || undefined,
            sessaoId: hsSessaoId,
            telefone: normalized,
            direcao: isFromMe ? "out" : "in",
            tipo,
            conteudo: content || (tipo !== "text" ? `[${tipo}]` : null),
            uazapiMessageId: msgId,
            status: isFromMe ? "sent" : "received",
            statusAt: msgTimestamp,
            createdAt: msgTimestamp,
          });
          imported++;
          convImported++;
        }

        // Update contato preview with latest message
        if (convImported > 0) {
          const [latestMsg] = await db.select({ conteudo: waMsgs.conteudo, createdAt: waMsgs.createdAt })
            .from(waMsgs).where(eq(waMsgs.contatoId, contato.id))
            .orderBy(desc(waMsgs.createdAt)).limit(1);
          if (latestMsg) {
            const { contatos: contatosT } = await import("../lib/db/schema");
            await db.update(contatosT).set({
              ultimaMsg: latestMsg.conteudo?.substring(0, 100) || null,
              ultimaMsgAt: latestMsg.createdAt,
              updatedAt: new Date(),
            }).where(eq(contatosT.id, contato.id));
          }
          console.log(`[HistorySync] Imported ${convImported} msgs for ${contato.nome} (${normalized})`);
        }
      }

      console.log(`[HistorySync] Total: ${imported} messages from ${conversations.length} conversations`);
      return;
    }

    const { phone, organizacaoId, sessaoId, message, timestamp } = job.data as {
      phone: string;
      organizacaoId: string;
      sessaoId?: string;
      usuarioId?: string | null;
      message: { id: string; type: string; text: string; caption: string; mediaUrl: string; mediaFilename: string; pushName?: string; raw: unknown; mediaDownloadInfo?: Record<string, unknown> | null; base64Media?: string | null; base64MimeType?: string | null; wuzapiMessageId?: string | null };
      timestamp: number;
    };

    const { normalizePhone, phoneLastDigits } = await import("../lib/whatsapp/phone-utils");
    const { contatos, leads, whatsappMensagens, atividades, notificacoes, usuarios, whatsappSessao: waSessao, pessoas: pessoasT, communications: commsT } = await import("../lib/db/schema");
    const { downloadMedia: dlMedia, downloadMediaByMessageId: dlByMsgId, saveBase64ToDisk: saveToDisk, sessionToConfig: toConfig } = await import("../lib/whatsapp/client");

    const normalized = normalizePhone(phone);
    const last8 = phoneLastDigits(phone);
    console.log(`[WA-In] Message from ${normalized} (match: %${last8})`);

    // Skip inter-session messages: if sender phone matches another session in the same org,
    // the outgoing handler on that session already cross-saved this as IN via crossSaveInterSession
    if (sessaoId) {
      const { whatsappSessao: waSessaoCheck } = await import("../lib/db/schema");
      const otherSessions = await db.select({
        id: waSessaoCheck.id,
        phoneNumber: waSessaoCheck.phoneNumber,
      })
        .from(waSessaoCheck)
        .where(eq(waSessaoCheck.organizacaoId, organizacaoId));

      const senderIsSession = otherSessions.some(s => {
        if (s.id === sessaoId) return false;
        const cleanPhone = (s.phoneNumber || "").replace(/:.*$/, "");
        return cleanPhone.length >= 8 && normalized.endsWith(cleanPhone.slice(-8));
      });

      if (senderIsSession) {
        console.log(`[WA-In] Skipping inter-session message from ${normalized} (handled by cross-save)`);
        return;
      }
    }

    // Find or create contato (NOT lead)
    const contato = await findOrCreateContato({
      phone, normalized, last8, organizacaoId,
      sessaoId: sessaoId || null,
      pushName: message.pushName,
    });

    const content = message.text || message.caption || "";
    const msgType = message.type || "text";

    // Download and save incoming media locally (WhatsApp CDN URLs expire)
    let localMediaUrl = message.mediaUrl || null;
    if (["image", "audio", "video", "document", "sticker"].includes(msgType)) {
      const fileId = message.id || `in-${Date.now()}`;
      let saved = false;

      // Resolve session config once
      let inConfig = undefined;
      if (sessaoId) {
        const [sess] = await db.select({ apiToken: waSessao.apiToken })
          .from(waSessao).where(eq(waSessao.id, sessaoId)).limit(1);
        if (sess) inConfig = toConfig(sess);
      }

      if (message.mediaDownloadInfo) {
        try {
          const dlInfo = message.mediaDownloadInfo as { url: string; mediaKey: string; mimetype: string; fileSHA256: string; fileLength: number | string; directPath: string };
          const downloaded = await dlMedia(msgType, dlInfo, inConfig);
          if (downloaded.base64) {
            localMediaUrl = saveToDisk(downloaded.base64, fileId, msgType, message.mediaFilename || undefined, downloaded.mimetype);
            saved = true;
          }
        } catch (dlErr) {
          console.error(`[WA-In] Failed to download media via mediaDownloadInfo:`, dlErr);
        }
      }

      // Fallback: re-download via wuzapi MessageId (base64 was stripped from job payload)
      if (!saved && message.wuzapiMessageId) {
        try {
          const downloaded = await dlByMsgId(msgType, message.wuzapiMessageId, inConfig);
          if (downloaded) {
            localMediaUrl = saveToDisk(downloaded.base64, fileId, msgType, message.mediaFilename || undefined, downloaded.mimetype);
            saved = true;
          }
        } catch (dlErr) {
          console.error(`[WA-In] Failed to download media via wuzapi messageId:`, dlErr);
        }
      }

      if (!saved && message.base64Media) {
        try {
          localMediaUrl = saveToDisk(message.base64Media, fileId, msgType, message.mediaFilename || undefined, message.base64MimeType || undefined);
          saved = true;
        } catch (b64Err) {
          console.error(`[WA-In] Failed to save base64 media:`, b64Err);
        }
      }
    }

    const [inboundMsgRow] = await db.insert(whatsappMensagens).values({
      contatoId: contato.id,
      leadId: contato.leadId || undefined,
      sessaoId: sessaoId || null,
      telefone: normalized,
      direcao: "in",
      tipo: msgType,
      conteudo: content,
      mediaUrl: localMediaUrl,
      mediaFilename: message.mediaFilename || null,
      uazapiMessageId: message.id || null,
      status: "received",
      statusAt: new Date(timestamp * 1000),
    }).returning({ id: whatsappMensagens.id });

    // O canal atualiza o estado das cadências antes de qualquer resposta da IA.
    // Se houver um grafo publicado para mensagem recebida, ele assume o turno;
    // caso contrário o runtime direto/legado abaixo continua funcionando.
    let roteadoPorAutomacao = false;
    try {
      const recebidaEm = new Date(timestamp * 1000);
      const [{ registrarRespostaEmCadencias }, { publicarEvento }, { dispatchAutomationEvent }, { eventOutbox }] = await Promise.all([
        import("../lib/cadencia/cadence-engine"), import("../lib/events/outbox"), import("../lib/automations/event-dispatcher"), import("../lib/db/schema"),
      ]);
      await registrarRespostaEmCadencias({ organizacaoId, contatoId: contato.id, leadId: contato.leadId, recebidaEm });
      const eventId = await publicarEvento({
        organizacaoId, eventType: "ConversationMessageReceived", aggregateType: "contato", aggregateId: contato.id,
        payload: { contatoId: contato.id, leadId: contato.leadId ?? null, messageId: inboundMsgRow.id, channel: "whatsapp", messageType: msgType },
        idempotencyKey: `whatsapp:${inboundMsgRow.id}:received`,
      });
      if (eventId) {
        const [event] = await db.select().from(eventOutbox).where(eq(eventOutbox.id, eventId)).limit(1);
        if (event) roteadoPorAutomacao = (await dispatchAutomationEvent(event)).matched > 0;
      }
    } catch (err) {
      console.error("[Automation] falha ao rotear mensagem recebida; usando runtime direto:", err);
    }

    // F2/dual-write (Communication Intelligence) — best-effort, nunca
    // bloqueia o processamento real da mensagem recebida.
    try {
      let pessoaId: string | null = null;
      if (contato.leadId) {
        const [pessoa] = await db.select({ id: pessoasT.id }).from(pessoasT).where(eq(pessoasT.leadIdLegado, contato.leadId)).limit(1);
        pessoaId = pessoa?.id ?? null;
      }
      await db
        .insert(commsT)
        .values({
          organizacaoId,
          pessoaId,
          canal: "whatsapp",
          direcao: "entrada",
          conteudo: content,
          status: "received",
          externalId: message.id || null,
          ocorridoEm: new Date(timestamp * 1000),
          raw: { msgType, contatoId: contato.id },
        })
        .onConflictDoNothing({ target: [commsT.canal, commsT.externalId] });
    } catch (err) {
      console.error("[F2/dual-write] falha ao sincronizar communications da mensagem WhatsApp (best-effort):", err);
    }

    // F5/Automation: gatilho "whatsapp_recebido" — best-effort.
    try {
      const { dispararAutomacoes } = await import("../lib/crm/automacao-engine");
      await dispararAutomacoes("whatsapp_recebido", {
        entityType: "contato",
        entityId: contato.id,
        organizacaoId,
        campos: { tipo: msgType },
        telefone: normalized,
      });
    } catch (err) {
      console.error("[F5/automacao-engine] falha ao disparar automações de whatsapp_recebido (best-effort):", err);
    }

    // Update contato preview + unread
    const preview = content.length > 100 ? content.substring(0, 97) + "..." : content;
    await db.update(contatos).set({
      ultimaMsg: preview || `[${msgType}]`,
      ultimaMsgAt: new Date(),
      naoLidas: rawSql`nao_lidas + 1`,
      updatedAt: new Date(),
    }).where(eq(contatos.id, contato.id));

    // Also update lead preview if linked
    if (contato.leadId) {
      await db.update(leads).set({
        whatsappUltimaMsg: preview || `[${msgType}]`,
        whatsappNaoLidas: rawSql`COALESCE(whatsapp_nao_lidas, 0) + 1`,
        whatsappUltimaMsgAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(leads.id, contato.leadId));
    }

    // Activity dedup: max 1 per day per lead (only if linked to lead)
    if (contato.leadId) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const [existingActivity] = await db.select({ id: atividades.id })
        .from(atividades)
        .where(and(
          eq(atividades.leadId, contato.leadId),
          eq(atividades.tipo, "whatsapp"),
          gte(atividades.createdAt, todayStart),
        ))
        .limit(1);
      if (!existingActivity) {
        await db.insert(atividades).values({
          leadId: contato.leadId,
          organizacaoId,
          tipo: "whatsapp",
          titulo: "Troca de mensagens por WhatsApp",
        });
      }
    }

    // WhatsApp unread counts are shown via sidebar badge (contatos.naoLidas),
    // no need to flood the notification bell with every message.

    console.log(`[WA-In] Processed message for contato ${contato.id} (${contato.nome})${contato.leadId ? ` → lead ${contato.leadId}` : ''}`);

    // ─── AI SDR: check if we should auto-respond ────────────────
    // Respond to text messages and media with captions; for media without text,
    // describe the type so the AI can acknowledge it
    const aiSdrTypes = ["text", "image", "audio", "video", "document", "sticker", "location", "contact"];
    if (!roteadoPorAutomacao && aiSdrTypes.includes(msgType)) {
      const tipoLabel: Record<string, string> = {
        image: "Imagem recebida", audio: "Audio recebido", video: "Video recebido",
        document: "Documento recebido", sticker: "Sticker recebido",
        location: "Localizacao compartilhada", contact: "Contato compartilhado",
      };
      const sdrMessage = content || (msgType !== "text" ? `[${tipoLabel[msgType] || msgType}]` : "");
      if (sdrMessage) {
        try {
          await handleAiSdrResponse({
            contatoId: contato.id,
            contatoNome: contato.nome,
            leadId: contato.leadId || null,
            organizacaoId,
            sessaoId: sessaoId || null,
            currentMessage: sdrMessage,
            phone: normalized,
            sourceMessageId: inboundMsgRow?.id ?? null,
          });
        } catch (sdrErr) {
          console.error(`[AI-SDR] Error processing for contato ${contato.id}:`, sdrErr);
        }
      }
    }
  },
  { connection, concurrency: 2 }
);

// ─── WhatsApp Outgoing Worker ────────────────────────────────
const whatsappOutgoingWorker = new Worker(
  "whatsapp-outgoing",
  async (job) => {
    const { messageId, phone, conteudo, tipo, mediaData, mediaUrl, fileName, latitude, longitude, sessaoId, replyStanzaId } = job.data as {
      messageId: string;
      phone: string;
      conteudo: string;
      tipo: string;
      mediaData?: string;
      mediaUrl?: string;
      fileName?: string;
      latitude?: number;
      longitude?: number;
      sessaoId?: string;
      replyStanzaId?: string;
    };

    const { sendText, sendImage, sendAudio, sendVideo, sendDocument, sendLocation, sendContact, sendSticker, sessionToConfig, saveBase64ToDisk } = await import("../lib/whatsapp/client");
    const { whatsappMensagens, whatsappSessao, contatos, leads } = await import("../lib/db/schema");

    // Resolve per-session config
    let config = undefined;
    if (sessaoId) {
      const [sessao] = await db.select({ apiToken: whatsappSessao.apiToken })
        .from(whatsappSessao)
        .where(eq(whatsappSessao.id, sessaoId))
        .limit(1);
      if (sessao) config = sessionToConfig(sessao);
    }

    // Build reply context if replying to a message
    const reply = replyStanzaId ? { stanzaId: replyStanzaId } : undefined;

    console.log(`[WA-Out] Sending ${tipo} to ${phone} (msg: ${messageId})${reply ? ` [reply to ${reply.stanzaId}]` : ""}`);

    // Pre-check: resolve LID and correct phone number via WhatsApp lookup
    let correctedPhone = phone;
    try {
      const { checkWhatsApp } = await import("../lib/whatsapp/client");
      const [check] = await checkWhatsApp([phone], config);
      if (check && !check.isOnWhatsApp) {
        console.log(`[WA-Out] Phone ${phone} not found on WhatsApp`);
      } else if (check?.jid) {
        // WhatsApp may return a corrected JID (e.g. removing extra 9th digit)
        const jidPhone = check.jid.replace(/@.*$/, "");
        if (jidPhone && jidPhone !== phone) {
          console.log(`[WA-Out] WhatsApp corrected phone: ${phone} → ${jidPhone}`);
          correctedPhone = jidPhone;
        }
      }
    } catch (err) {
      console.log(`[WA-Out] Pre-check failed (non-blocking):`, err);
    }

    try {
      let result: { messageId: string; status: string };
      let convertedAudioData: string | undefined; // For saving converted OGG to disk
      const media = mediaData || mediaUrl || "";

      const sendPhone = correctedPhone;

      switch (tipo) {
        case "image":
          result = await sendImage(sendPhone, media, conteudo, config, reply);
          break;
        case "audio": {
          const audioResult = await sendAudio(sendPhone, media, true, config, reply);
          result = audioResult;
          convertedAudioData = audioResult.convertedAudio; // Save converted OGG, not raw WebM
          break;
        }
        case "video":
          result = await sendVideo(sendPhone, media, conteudo, config, reply);
          break;
        case "document":
          result = await sendDocument(sendPhone, media, fileName || "document", config, reply);
          break;
        case "sticker":
          result = await sendSticker(sendPhone, media, config);
          break;
        case "location":
          result = await sendLocation(sendPhone, latitude || 0, longitude || 0, undefined, config, reply);
          break;
        case "contact": {
          let contactName = "Contato";
          let vcard = "";
          try {
            const parsed = JSON.parse(conteudo);
            contactName = parsed.name || "Contato";
            vcard = parsed.vcard || "";
          } catch {
            contactName = conteudo;
          }
          result = await sendContact(sendPhone, contactName, vcard, config);
          break;
        }
        default:
          result = await sendText(sendPhone, conteudo, config, reply);
      }

      // Save media to disk so it shows in chat
      // For audio: use converted OGG (not raw browser WebM) so it plays in CRM
      let savedMediaUrl: string | null = null;
      const mediaToSave = tipo === "audio" && convertedAudioData ? convertedAudioData : media;
      if (mediaToSave && ["image", "audio", "video", "document", "sticker"].includes(tipo)) {
        try {
          savedMediaUrl = saveBase64ToDisk(mediaToSave, messageId, tipo, fileName);
          console.log(`[WA-Out] Media saved: ${savedMediaUrl}`);
        } catch (mediaErr) {
          console.error(`[WA-Out] Failed to save media to disk:`, mediaErr);
        }
      }

      await db.update(whatsappMensagens).set({
        uazapiMessageId: result.messageId,
        status: "sent",
        statusAt: new Date(),
        ...(savedMediaUrl && { mediaUrl: savedMediaUrl }),
      }).where(eq(whatsappMensagens.id, messageId));

      // Update contato preview + timestamp so conversation list sorts correctly
      const [msg] = await db.select({
        contatoId: whatsappMensagens.contatoId,
        leadId: whatsappMensagens.leadId,
      }).from(whatsappMensagens).where(eq(whatsappMensagens.id, messageId)).limit(1);

      if (msg?.contatoId) {
        const preview = tipo === "text" ? (conteudo.length > 100 ? conteudo.substring(0, 97) + "..." : conteudo) : `[${tipo}]`;
        await db.update(contatos).set({
          ultimaMsg: preview,
          ultimaMsgAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(contatos.id, msg.contatoId));

        // Also update lead preview if linked
        if (msg.leadId) {
          await db.update(leads).set({
            whatsappUltimaMsg: preview,
            whatsappUltimaMsgAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(leads.id, msg.leadId));
        }
      }

      console.log(`[WA-Out] Sent successfully: ${result.messageId}`);
    } catch (error) {
      console.error(`[WA-Out] Failed to send:`, error);
      await db.update(whatsappMensagens).set({
        status: "failed",
        statusAt: new Date(),
      }).where(eq(whatsappMensagens.id, messageId));
      throw error;
    }
  },
  { connection, concurrency: 1 }
);

// ─── WhatsApp Status Update Worker ──────────────────────────
const whatsappStatusWorker = new Worker(
  "whatsapp-status-update",
  async (job) => {
    const { messageId, status, timestamp } = job.data as {
      messageId: string;
      status: string;
      timestamp: number;
    };

    const { whatsappMensagens } = await import("../lib/db/schema");

    const [msg] = await db.select({ id: whatsappMensagens.id, status: whatsappMensagens.status })
      .from(whatsappMensagens)
      .where(eq(whatsappMensagens.uazapiMessageId, messageId))
      .limit(1);

    if (!msg) {
      console.log(`[WA-Status] Message not found: ${messageId}`);
      return;
    }

    const statusOrder: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3 };
    const currentOrder = statusOrder[msg.status] ?? -1;
    const newOrder = statusOrder[status] ?? -1;

    if (newOrder > currentOrder) {
      await db.update(whatsappMensagens).set({
        status,
        statusAt: new Date(timestamp * 1000),
      }).where(eq(whatsappMensagens.id, msg.id));
      console.log(`[WA-Status] ${messageId}: ${msg.status} -> ${status}`);
    }
  },
  { connection, concurrency: 1 }
);

// Scheduled Jobs Queue
const scheduledQueue = new Queue("scheduled-jobs", { connection, defaultJobOptions: { removeOnComplete: { count: 200 }, removeOnFail: { count: 500 } } });

// SLA + Scheduled Worker
const slaWorker = new Worker(
  "scheduled-jobs",
  async (job) => {
    const { leads, negocios, tarefas, notificacoes, usuarios, statusChanges } = await import("../lib/db/schema");

    if (job.name === "catalogo-stripe-sync") {
      // Sem chave configurada isto não é erro de integração, é ambiente sem
      // Stripe. Falhar alto aqui encheria o log de um sistema que nunca foi
      // configurado para vender pelo Stripe.
      if (!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_API_KEY) return;
      try {
        const { lerCatalogoDoStripe } = await import("../lib/integrations/stripe-catalogo");
        const { sincronizarCatalogoStripe } = await import("../lib/catalogo/sincronizar-stripe");
        const catalogo = await lerCatalogoDoStripe();
        const orgs = await db.execute<{ id: string }>(rawSql`SELECT id::text FROM organizacoes`);
        for (const org of orgs) {
          const r = await sincronizarCatalogoStripe(org.id, catalogo);
          const mexeu = r.produtosCriados + r.precosCriados + r.precosDesativados;
          if (mexeu > 0) {
            console.log(
              `[Catalogo] ${r.produtosCriados} produto(s) novo(s), ${r.precosCriados} preço(s) novo(s), ` +
              `${r.precosDesativados} desativado(s)`,
            );
          }
          // Pendência de metadata some do log quando ninguém age; repetir de
          // hora em hora vira ruído. Aparece só quando há produto novo.
          if (r.produtosCriados > 0 && r.pendencias.length) {
            for (const pd of r.pendencias) console.log(`[Catalogo] pendente: ${pd.produto} — ${pd.oQueFalta}`);
          }
        }
      } catch (e) {
        console.error("[Catalogo] sync falhou:", e instanceof Error ? e.message : e);
      }
      return;
    }

    if (job.name === "sdr-followup-escalation") {
      // Board Pré-vendas: leads parados em "Em Contato" há 48h+ (2 dias) sobem pra
      // "Follow up" e a Jenifer assume. Base do relógio = leads.contato_desde_at.
      try {
        const { runSdrFollowupEscalation } = await import("../lib/crm/sdr-escalation");
        const res = await runSdrFollowupEscalation(db);
        if (res.moved > 0) console.log(`[SDR-Escalation] ${res.moved} leads: Em Contato → Follow up (48h)`);
      } catch (e) {
        console.error("[SDR-Escalation] erro:", e instanceof Error ? e.message : e);
      }
      return;
    }

    if (job.name === "ai-sdr-outreach") {
      // Agente SDR: leads em "Novo" recebem a 1ª mensagem sozinhos.
      try {
        const res = await runAiSdrFirstContactSweep();
        if (res.iniciados > 0) console.log(`[AI-SDR-Outreach] ${res.iniciados} leads: Novo → Em Contato (automático)`);
      } catch (e) {
        console.error("[AI-SDR-Outreach] erro:", e instanceof Error ? e.message : e);
      }
      return;
    }

    if (job.name === "ai-sdr-retry") {
      // Agente SDR: retentativa automática (~2h/24h/40h) pra quem não respondeu.
      try {
        const res = await runAiSdrRetrySweep();
        if (res.enviados > 0) console.log(`[AI-SDR-Retry] ${res.enviados} follow-ups automáticos enviados`);
      } catch (e) {
        console.error("[AI-SDR-Retry] erro:", e instanceof Error ? e.message : e);
      }
      return;
    }

    if (job.name === "ai-sdr-meeting-confirmation") {
      // Agente SDR: confirmação das reuniões marcadas pra hoje.
      try {
        const res = await runAiSdrMeetingConfirmationSweep();
        if (res.enviados > 0) console.log(`[AI-SDR-Confirmacao] ${res.enviados} confirmações de reunião enviadas`);
      } catch (e) {
        console.error("[AI-SDR-Confirmacao] erro:", e instanceof Error ? e.message : e);
      }
      return;
    }

    if (job.name === "stripe-sync") {
      try {
        const { syncStripe } = await import("../lib/integrations/stripe-sync");
        await syncStripe();
      } catch (e) {
        console.error("[StripeSync] erro:", e instanceof Error ? e.message : e);
      }
      return;
    }

    if (job.name === "outlook-reuniao-sync") {
      // Reuniao reagendada/cancelada direto no Outlook (fora do CRM) reflete
      // no card do pipeline — polling simples, sem webhook do Graph.
      try {
        const { syncOutlookReunioes } = await import("../lib/crm/outlook-reuniao-sync");
        await syncOutlookReunioes(db);
      } catch (e) {
        console.error("[OutlookReuniaoSync] erro:", e instanceof Error ? e.message : e);
      }
      return;
    }

    if (job.name === "rd-criativo-sync") {
      // Preenche o CRIATIVO (utm_content/utm_term) dos leads pagos recentes que
      // chegaram sem essa marcacao, consultando a API do RD (traffic_value da
      // conversao de Lead Ads). Cinto-e-suspensorio do parser do webhook.
      try {
        const { enriquecerCriativosRd } = await import("../lib/integrations/rd-criativo");
        const r = await enriquecerCriativosRd(3);
        if (r.candidatos > 0) console.log(`[rd-criativo] candidatos=${r.candidatos} preenchidos=${r.preenchidos} semDado=${r.semDadoNoRd} erros=${r.erros}`);
      } catch (e) {
        console.error("[rd-criativo] erro:", e instanceof Error ? e.message : e);
      }
      return;
    }

    if (job.name === "expirar-propostas") {
      // dataValidade vencida (< hoje, "válido até" inclui o próprio dia) em proposta
      // ainda "enviada" (aguardando pagamento) → marca expirada e mata o link no
      // Stripe. Sem isso, o campo de validade era só decorativo (não travava nada).
      const { propostas } = await import("../lib/db/schema");
      const { expireCheckoutSession } = await import("../lib/integrations/stripe-checkout");
      const { syncNegocioValoresFromPropostas } = await import("../lib/crm/sync-negocio-valores");
      const today = new Date().toISOString().split("T")[0];

      const vencidas = await db
        .select({
          id: propostas.id,
          numero: propostas.numero,
          stripeSessionId: propostas.stripeSessionId,
          negocioId: propostas.negocioId,
        })
        .from(propostas)
        .where(and(
          eq(propostas.status, "enviada"),
          isNotNull(propostas.dataValidade),
          lt(propostas.dataValidade, today),
        ));

      for (const p of vencidas) {
        await db.update(propostas).set({ status: "expirada", updatedAt: new Date() }).where(eq(propostas.id, p.id));
        if (p.stripeSessionId) {
          await expireCheckoutSession(p.stripeSessionId).catch((e) => {
            console.error(`[ExpirarPropostas] falha ao expirar sessão ${p.stripeSessionId} da proposta #${p.numero}:`, e);
          });
        }
        if (p.negocioId) {
          await syncNegocioValoresFromPropostas(p.negocioId).catch(() => {});
        }
      }
      console.log(`[ExpirarPropostas] ${vencidas.length} proposta(s) marcada(s) como expirada(s)`);
      return;
    }

    if (job.name === "reconcile-pagamentos") {
      // De-para de 5 dias: propostas dadas como ganhas (aceita) com checkout do
      // Stripe que NÃO confirmaram pagamento em 5 dias → avisa a responsável
      // (comercial). O ganho conta na hora (comprovante); isto é a rede de segurança.
      const { propostas, contratos } = await import("../lib/db/schema");
      const { getCheckoutSessionStatus } = await import("../lib/integrations/stripe-sync");
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const pend = await db
        .select({
          id: propostas.id,
          numero: propostas.numero,
          sessionId: propostas.stripeSessionId,
          leadNome: leads.nome,
          leadEmpresa: leads.empresa,
          negResp: negocios.responsavelId,
          leadResp: leads.responsavelId,
        })
        .from(propostas)
        .innerJoin(contratos, eq(propostas.contratoId, contratos.id))
        .leftJoin(leads, eq(propostas.leadId, leads.id))
        .leftJoin(negocios, eq(propostas.negocioId, negocios.id))
        .where(and(
          eq(propostas.status, "aceita"),
          isNotNull(propostas.stripeSessionId),
          lte(contratos.createdAt, fiveDaysAgo),
        ));

      let avisados = 0;
      for (const p of pend) {
        if (!p.sessionId) continue;
        const st = await getCheckoutSessionStatus(p.sessionId);
        if (!st) continue; // sem key / erro: não dá pra afirmar, pula
        if (st.payment_status === "paid" || st.payment_status === "no_payment_required") continue; // pago, ok
        const alvo = p.negResp || p.leadResp;
        if (!alvo) continue;
        const link = `/propostas/${p.id}`;
        const [jaAvisou] = await db
          .select({ id: notificacoes.id })
          .from(notificacoes)
          .where(and(eq(notificacoes.tipo, "pagamento_pendente"), eq(notificacoes.link, link)))
          .limit(1);
        if (jaAvisou) continue; // já avisamos essa proposta
        await db.insert(notificacoes).values({
          usuarioId: alvo,
          titulo: `Pagamento não confirmado: P-${String(p.numero).padStart(3, "0")}`,
          mensagem: `A proposta de ${p.leadEmpresa || p.leadNome || "cliente"} foi marcada como ganha, mas o Stripe ainda não confirmou o pagamento após 5 dias. Confira o comprovante / a cobrança.`,
          tipo: "pagamento_pendente",
          link,
        });
        avisados++;
      }
      console.log(`[Depara] ${pend.length} aceitas c/ checkout 5d+, ${avisados} avisos de pagamento não confirmado`);
      return;
    }

    if (job.name === "check-sla") {
      console.log("[SLA] Checking SLA breaches...");
      const now = new Date();
      const slaLimits: Record<string, number> = {
        reuniao_agendada: 48, reuniao_realizada: 72, proposta_apresentada: 72,
        negociacao_iniciada: 168, em_fechamento: 120,
      };

      for (const [status, hours] of Object.entries(slaLimits)) {
        const threshold = new Date(now.getTime() - hours * 60 * 60 * 1000);
        const breachedNegocios = await db.select({
          id: negocios.id, titulo: negocios.titulo, leadId: negocios.leadId,
          leadNome: leads.nome, leadEmpresa: leads.empresa,
        })
          .from(negocios)
          .leftJoin(leads, eq(negocios.leadId, leads.id))
          .where(and(eq(negocios.status, status), lte(negocios.updatedAt, threshold)));

        if (breachedNegocios.length > 0) {
          for (const neg of breachedNegocios) {
            // Find admin from the lead's org
            const [lead] = neg.leadId ? await db.select({ organizacaoId: leads.organizacaoId }).from(leads).where(eq(leads.id, neg.leadId)).limit(1) : [];
            if (!lead?.organizacaoId) continue;
            const [admin] = await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.role, "admin"), eq(usuarios.organizacaoId, lead.organizacaoId))).limit(1);
            if (admin) {
              // Achado real (09/08): `notificacoes` não tem unique constraint
              // nenhum — o onConflictDoNothing() daqui nunca teve conflito pra
              // detectar, então era um no-op. Rodando a cada 30min sem dedupe
              // real, isso gerou 167k+ notificações duplicadas em produção
              // (alguns negócios com 2000+ repetidas desde 25/06). Mesmo
              // padrão de dedupe já usado corretamente em follow-up-proposta:
              // só cria se não existir uma não lida do mesmo negócio+etapa.
              const linkNegocio = `/negocios/${neg.id}`;
              const [jaAvisou] = await db.select({ id: notificacoes.id }).from(notificacoes)
                .where(and(eq(notificacoes.tipo, "sla_alerta"), eq(notificacoes.link, linkNegocio), eq(notificacoes.lida, false)))
                .limit(1);
              if (!jaAvisou) {
                await db.insert(notificacoes).values({
                  usuarioId: admin.id,
                  titulo: `SLA estourado: ${neg.titulo}`,
                  mensagem: `Negócio "${neg.titulo}" (${neg.leadEmpresa || neg.leadNome || "sem empresa"}) está em "${status}" há mais de ${hours}h`,
                  tipo: "sla_alerta",
                  link: linkNegocio,
                });
              }
            }
          }
          console.log(`[SLA] ${breachedNegocios.length} negócios breached in "${status}"`);
        }
      }
    }

    if (job.name === "follow-up-proposta") {
      // Proposta apresentada parada 3+ dias → notifica o DONO do negócio (fallback
      // admin) com link direto pro card + cria tarefa. Com DEDUPE: antes disso o job
      // criava tarefa duplicada TODA HORA pro admin (pedido Kauã 21/07: follow-up
      // com mensagem levando pro card).
      console.log("[FollowUp] Checking proposals needing follow-up...");
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const staleDeals = await db.select({
        id: negocios.id, titulo: negocios.titulo, leadId: negocios.leadId, responsavelId: negocios.responsavelId,
        leadNome: leads.nome, leadEmpresa: leads.empresa,
      })
        .from(negocios)
        .leftJoin(leads, eq(negocios.leadId, leads.id))
        .where(and(eq(negocios.status, "proposta_apresentada"), lte(negocios.updatedAt, threeDaysAgo)));

      let criadas = 0;
      for (const deal of staleDeals) {
        const [lead] = deal.leadId ? await db.select({ organizacaoId: leads.organizacaoId }).from(leads).where(eq(leads.id, deal.leadId)).limit(1) : [];
        if (!lead?.organizacaoId) continue;
        let alvo = deal.responsavelId;
        if (!alvo) {
          const [admin] = await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.role, "admin"), eq(usuarios.organizacaoId, lead.organizacaoId))).limit(1);
          alvo = admin?.id ?? null;
        }
        if (!alvo) continue;
        const link = `/negocios/${deal.id}`;
        const quem = deal.leadEmpresa || deal.leadNome || deal.titulo;
        // dedupe: se já existe notificação NÃO LIDA deste negócio, não repete
        const [jaAvisou] = await db.select({ id: notificacoes.id }).from(notificacoes)
          .where(and(eq(notificacoes.tipo, "followup_proposta"), eq(notificacoes.link, link), eq(notificacoes.lida, false)))
          .limit(1);
        if (jaAvisou) continue;
        await db.insert(notificacoes).values({
          usuarioId: alvo,
          tipo: "followup_proposta",
          titulo: `Follow-up: ${quem}`,
          mensagem: `A proposta de "${deal.titulo}" está sem resposta há 3+ dias — hora de retomar o contato.`,
          link,
        });
        // dedupe da tarefa: só cria se não houver follow-up aberto pro mesmo lead
        const [tarefaAberta] = await db.select({ id: tarefas.id }).from(tarefas)
          .where(and(eq(tarefas.tipo, "follow_up"), eq(tarefas.concluida, false), deal.leadId ? eq(tarefas.leadId, deal.leadId) : rawSql`false`))
          .limit(1);
        if (!tarefaAberta) {
          await db.insert(tarefas).values({
            organizacaoId: lead.organizacaoId,
            leadId: deal.leadId,
            usuarioId: alvo,
            titulo: `Follow-up proposta: ${quem}`,
            tipo: "follow_up",
            prioridade: "alta",
            dataVencimento: new Date().toISOString().split("T")[0],
          });
        }
        criadas++;
      }
      console.log(`[FollowUp] ${criadas} follow-ups notificados (${staleDeals.length} propostas paradas)`);
    }

    // CS sweep (08/09) — marcos vencidos viram tarefa, riscos são
    // reavaliados contra o dado real, janelas de renovação abrem. Tudo
    // idempotente: rodar de hora em hora produz o mesmo estado que rodar
    // uma vez. Ver lib/cs/sweep.ts.
    if (job.name === "cs-sweep") {
      const { rodarSweepCsTodasOrgs } = await import("../lib/cs/sweep");
      const resultados = await rodarSweepCsTodasOrgs();
      for (const r of resultados) {
        const mexeu = r.tarefasDeMarco + r.tarefasDeRisco + r.tarefasDeRenovacao + r.riscosAbertos + r.riscosResolvidos + r.renovacoesCriadas;
        if (mexeu > 0) {
          console.log(`[cs-sweep] org ${r.organizacaoId}: ${r.tarefasDeMarco} tarefa(s) de marco, ${r.tarefasDeRisco} de risco, ${r.tarefasDeRenovacao} de renovação; riscos +${r.riscosAbertos}/~${r.riscosAtualizados}/-${r.riscosResolvidos}; renovações +${r.renovacoesCriadas} (${r.renovacoesAbertas} abertas)`);
        }
      }
    }

    if (job.name === "alerta-renovacao") {
      console.log("[Renovacao] Checking contract renewals...");
      const { contratos } = await import("../lib/db/schema");
      const sixtyDaysFromNow = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const expiring = await db.select()
        .from(contratos)
        .where(and(eq(contratos.status, "ativo"), lte(contratos.vencimento, sixtyDaysFromNow)));

      for (const contrato of expiring) {
        const [lead] = await db.select({ id: leads.id, nome: leads.nome, renovacaoAlertada: leads.renovacaoAlertada, organizacaoId: leads.organizacaoId })
          .from(leads)
          .where(eq(leads.id, contrato.leadId))
          .limit(1);
        if (!lead?.organizacaoId) continue;

        const [admin] = await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.role, "admin"), eq(usuarios.organizacaoId, lead.organizacaoId))).limit(1);
        if (lead && !lead.renovacaoAlertada && admin) {
          await db.insert(tarefas).values({
            organizacaoId: lead.organizacaoId,
            leadId: lead.id,
            usuarioId: admin.id,
            titulo: `Renovação de contrato: ${lead.nome}`,
            descricao: `Contrato vence em ${contrato.vencimento}. MRR: R$ ${contrato.mrr}`,
            tipo: "renovacao",
            prioridade: "alta",
            dataVencimento: contrato.vencimento!,
          });
          await db.update(leads).set({ renovacaoAlertada: true }).where(eq(leads.id, lead.id));

          // F5/Automation: gatilho "contrato_vencendo" — best-effort, roda ao
          // lado da tarefa hardcoded acima (não substitui, motor migrado só
          // fica ativo pra quem configurar regra em `automacoes`).
          try {
            const { dispararAutomacoes } = await import("../lib/crm/automacao-engine");
            await dispararAutomacoes("contrato_vencendo", {
              entityType: "lead",
              entityId: lead.id,
              organizacaoId: lead.organizacaoId,
              campos: { mrr: contrato.mrr, vencimento: contrato.vencimento },
              nome: lead.nome,
            });
          } catch (err) {
            console.error("[F5/automacao-engine] falha ao disparar automações de contrato_vencendo (best-effort):", err);
          }
        }
      }
      console.log(`[Renovacao] Checked ${expiring.length} expiring contracts`);
    }

    if (job.name === "check-whatsapp-connection") {
      console.log("[WhatsApp] Checking all session connections...");
      const { whatsappSessao } = await import("../lib/db/schema");
      const { getStatus, sessionToConfig } = await import("../lib/whatsapp/client");

      // Check ALL sessions, not just one hardcoded session
      const sessions = await db.select().from(whatsappSessao);

      for (const sessao of sessions) {
        try {
          const config = sessionToConfig(sessao);
          const connStatus = await getStatus(config);
          const statusValue = connStatus.connected ? "connected" : "disconnected";

          await db.update(whatsappSessao).set({
            status: statusValue,
            ...(connStatus.phone && { phoneNumber: connStatus.phone }),
            ...(connStatus.connected && { lastConnectedAt: new Date() }),
            updatedAt: new Date(),
          }).where(eq(whatsappSessao.id, sessao.id));

          // Alert if disconnected for > 10 minutes
          if (!connStatus.connected && sessao.lastConnectedAt) {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            if (sessao.lastConnectedAt < tenMinutesAgo) {
              const [admin] = await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.role, "admin"), eq(usuarios.organizacaoId, sessao.organizacaoId))).limit(1);
              if (admin) {
                // Dedupe (mesmo padrão de sla_alerta/follow-up-proposta, ver ca6c633):
                // roda a cada 5min sem isso — achado real 13/08, 17k+ notificações
                // duplicadas (uma sessão desconectada por dias gera uma por ciclo,
                // pra sempre). Título já é específico por sessão (link é fixo
                // "/whatsapp" pra todas, não serve de chave de dedupe aqui).
                const titulo = `WhatsApp desconectado: ${sessao.label || sessao.sessionName}`;
                const [jaAvisou] = await db.select({ id: notificacoes.id }).from(notificacoes)
                  .where(and(eq(notificacoes.tipo, "sistema"), eq(notificacoes.titulo, titulo), eq(notificacoes.lida, false)))
                  .limit(1);
                if (!jaAvisou) {
                  await db.insert(notificacoes).values({
                    usuarioId: admin.id,
                    titulo,
                    mensagem: `A sessão "${sessao.label || sessao.sessionName}" está desconectada há mais de 10 minutos.`,
                    tipo: "sistema",
                    link: "/whatsapp",
                  });
                }
              }
            }
          }

          console.log(`[WhatsApp] ${sessao.sessionName}: ${statusValue}`);
        } catch (error) {
          console.error(`[WhatsApp] Failed to check ${sessao.sessionName}:`, error);
        }
      }
    }

    if (job.name === "reativar-lead-perdido") {
      console.log("[Reativacao] Checking lost deals for reactivation...");
      const reactivationRules: Record<string, number> = {
        preco_alto: 60, sem_budget: 90, escolheu_concorrente: 180, nao_respondeu: 30,
      };

      for (const [motivo, days] of Object.entries(reactivationRules)) {
        const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const lostDeals = await db.select({
          id: negocios.id, titulo: negocios.titulo, leadId: negocios.leadId,
          leadNome: leads.nome, leadEmpresa: leads.empresa,
          leadOrgId: leads.organizacaoId,
        })
          .from(negocios)
          .leftJoin(leads, eq(negocios.leadId, leads.id))
          .where(and(eq(negocios.status, "perdido"), eq(negocios.motivoPerda, motivo), lte(negocios.updatedAt, threshold)));

        for (const deal of lostDeals) {
          if (!deal.leadId || !deal.leadOrgId) continue;
          const [admin] = await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.role, "admin"), eq(usuarios.organizacaoId, deal.leadOrgId))).limit(1);
          if (admin) {
            const existing = await db.select({ id: tarefas.id }).from(tarefas)
              .where(and(eq(tarefas.leadId, deal.leadId), eq(tarefas.tipo, "follow_up"), eq(tarefas.concluida, false)))
              .limit(1);

            if (existing.length === 0) {
              await db.insert(tarefas).values({
                organizacaoId: deal.leadOrgId,
                leadId: deal.leadId,
                usuarioId: admin.id,
                titulo: `Recontato: ${deal.leadEmpresa || deal.leadNome || deal.titulo} (perdido por ${motivo} há ${days}d)`,
                tipo: "follow_up",
                prioridade: "media",
                dataVencimento: new Date().toISOString().split("T")[0],
              });
            }
          }

          // F5/Automation: gatilho "lead_inativo" — best-effort, ao lado da
          // tarefa hardcoded acima (mesmo critério de contrato_vencendo).
          try {
            const { dispararAutomacoes } = await import("../lib/crm/automacao-engine");
            await dispararAutomacoes("lead_inativo", {
              entityType: "lead",
              entityId: deal.leadId,
              organizacaoId: deal.leadOrgId,
              campos: { motivoPerda: motivo, diasInativo: days },
              nome: deal.leadNome,
            });
          } catch (err) {
            console.error("[F5/automacao-engine] falha ao disparar automações de lead_inativo (best-effort):", err);
          }
        }
      }
      console.log("[Reativacao] Done checking lost deals");
    }

    if (job.name === "snapshot-diario") {
      console.log("[F6/snapshot-diario] Calculando snapshot diário de todas as orgs...");
      const { calcularSnapshotDiarioTodasOrgs } = await import("../lib/analytics/snapshot-diario");
      await calcularSnapshotDiarioTodasOrgs();
      console.log("[F6/snapshot-diario] Done");
    }

    if (job.name === "cadence-sweep") {
      // F5/Cadence Engine: motor genérico ainda sem nenhuma cadence_definitions
      // real usando-o (a migração da cadência do AI SDR/SDR inbound pra cá é
      // decisão separada, não feita nesta rodada) — mas o sweep já roda de
      // verdade, pronto pra processar o que for cadastrado.
      const { sweepCadenciasDevidas } = await import("../lib/cadencia/cadence-engine");
      const { processados } = await sweepCadenciasDevidas();
      if (processados > 0) console.log(`[F5/cadence-engine] ${processados} enrollments avançados`);
    }

    if (job.name === "lembrete-reuniao-30min") {
      // Automação real pedida pelo Kauã (10/08) — lembrete de reunião 30min
      // antes via WhatsApp, usando a mesma fila real de envio do resto do
      // sistema. Ver lib/crm/lembrete-reuniao.ts.
      const { enviarLembretesReunioes30min } = await import("../lib/crm/lembrete-reuniao");
      const { enviados, falhados } = await enviarLembretesReunioes30min();
      if (enviados > 0 || falhados > 0) {
        console.log(`[lembrete-reuniao] ${enviados} enviados, ${falhados} falhados`);
      }
    }

    if (job.name === "event-outbox-sweep") {
      // Eventos/Event Outbox: F0 criou a tabela, mas nada publicava nem
      // consumia até 09/08 (achado da revisão externa). Este sweep é o lado
      // real do consumidor — ver lib/events/{outbox,consumer}.ts, ADR-EXEC-016.
      const { processarEventosPendentes, alertarDeadLetter } = await import("../lib/events/consumer");
      const { processados, falhados } = await processarEventosPendentes();
      if (processados > 0 || falhados > 0) {
        console.log(`[F0/event-outbox] ${processados} processados, ${falhados} falhados`);
      }
      // Dead-letter deixa de ser invisível: alerta uma vez por dia por org
      // (audit_log serve de trava de repetição). Nunca reprocessa sozinho —
      // erro permanente viraria loop de retry.
      await alertarDeadLetter().catch((e) => console.error("[F0/event-outbox] falha ao alertar dead-letter (best-effort):", e));
    }
  },
  { connection, concurrency: 1 }
);

// ─── Email Sync Worker ──────────────────────────────────────
const emailSyncQueue = new Queue("email-sync", { connection, defaultJobOptions: { removeOnComplete: { count: 200 }, removeOnFail: { count: 500 } } });

const emailSyncWorker = new Worker(
  "email-sync",
  async (job) => {
    const { emailContas: emailContasT, emails: emailsT, leads: leadsT, leadUserUnread: leadUserUnreadT } = await import("../lib/db/schema");
    const { createEmailClient } = await import("../lib/email/factory");

    if (job.name === "sync-trigger") {
      // Find all active accounts and queue sync for each
      const activeContas = await db.select({ id: emailContasT.id })
        .from(emailContasT)
        .where(eq(emailContasT.syncStatus, "active"));

      for (const conta of activeContas) {
        await emailSyncQueue.add("incremental-sync", { contaId: conta.id }, {
          removeOnComplete: 20,
          removeOnFail: 10,
          jobId: `sync-${conta.id}-${Date.now()}`,
        });
      }
      console.log(`[EmailSync] Queued sync for ${activeContas.length} accounts`);
      return;
    }

    if (job.name === "incremental-sync" || job.name === "full-sync") {
      const { contaId } = job.data as { contaId: string };
      console.log(`[EmailSync] ${job.name} for account ${contaId}`);

      const [conta] = await db.select().from(emailContasT).where(eq(emailContasT.id, contaId)).limit(1);
      if (!conta || conta.syncStatus !== "active") return;

      try {
        const config = {
          id: conta.id,
          tipo: conta.tipo as "google" | "microsoft" | "imap",
          email: conta.email,
          accessToken: conta.accessToken,
          refreshToken: conta.refreshToken,
          tokenExpiry: conta.tokenExpiry,
          imapHost: conta.imapHost,
          imapPort: conta.imapPort,
          smtpHost: conta.smtpHost,
          smtpPort: conta.smtpPort,
          imapUser: conta.imapUser,
          smtpUser: conta.smtpUser,
          imapPass: conta.imapPass,
          smtpPass: conta.smtpPass,
        };

        const client = createEmailClient(config);
        const since = job.name === "full-sync"
          ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          : conta.syncMode === "label"
            ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // label mode: always 30 days (user may label old emails)
            : conta.lastSyncAt || new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Build filter options based on syncMode
        const fetchOptions = conta.syncMode === "label" && conta.syncFiltroLabel
          ? { label: conta.syncFiltroLabel }
          : undefined;

        const totalImported = await processAndStoreEmails(
          client, db, since, conta, fetchOptions,
          emailsT, leadsT, leadUserUnreadT, emailContasT,
        );

        await db.update(emailContasT).set({
          lastSyncAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        }).where(eq(emailContasT.id, contaId));

        console.log(`[EmailSync] Imported ${totalImported} emails for ${conta.email}`);
      } catch (error) {
        console.error(`[EmailSync] Error syncing ${conta.email}:`, error);
        await db.update(emailContasT).set({
          lastError: error instanceof Error ? error.message : "Sync failed",
          updatedAt: new Date(),
        }).where(eq(emailContasT.id, contaId));
      }
    }

    // ─── Backfill job ───
    if (job.name === "backfill") {
      const { contaId, sinceDate } = job.data as { contaId: string; sinceDate: string };
      console.log(`[EmailSync] Backfill for account ${contaId} since ${sinceDate}`);

      const [conta] = await db.select().from(emailContasT).where(eq(emailContasT.id, contaId)).limit(1);
      if (!conta) return;

      try {
        await db.update(emailContasT).set({
          backfillStatus: "running",
          backfillProgress: 0,
          updatedAt: new Date(),
        }).where(eq(emailContasT.id, contaId));

        const config = {
          id: conta.id,
          tipo: conta.tipo as "google" | "microsoft" | "imap",
          email: conta.email,
          accessToken: conta.accessToken,
          refreshToken: conta.refreshToken,
          tokenExpiry: conta.tokenExpiry,
          imapHost: conta.imapHost,
          imapPort: conta.imapPort,
          smtpHost: conta.smtpHost,
          smtpPort: conta.smtpPort,
          imapUser: conta.imapUser,
          smtpUser: conta.smtpUser,
          imapPass: conta.imapPass,
          smtpPass: conta.smtpPass,
        };

        const client = createEmailClient(config);
        const since = new Date(sinceDate);
        const fetchOptions = conta.syncMode === "label" && conta.syncFiltroLabel
          ? { label: conta.syncFiltroLabel }
          : undefined;

        const totalImported = await processAndStoreEmails(
          client, db, since, conta, fetchOptions,
          emailsT, leadsT, leadUserUnreadT, emailContasT,
          async (progress) => {
            await db.update(emailContasT).set({
              backfillProgress: progress,
              updatedAt: new Date(),
            }).where(eq(emailContasT.id, contaId));
          },
        );

        await db.update(emailContasT).set({
          backfillStatus: "completed",
          backfillProgress: 100,
          updatedAt: new Date(),
        }).where(eq(emailContasT.id, contaId));

        console.log(`[EmailSync] Backfill completed: ${totalImported} emails for ${conta.email}`);
      } catch (error) {
        console.error(`[EmailSync] Backfill error for ${conta.email}:`, error);
        await db.update(emailContasT).set({
          backfillStatus: "error",
          lastError: `Backfill failed: ${error instanceof Error ? error.message : String(error)}`,
          updatedAt: new Date(),
        }).where(eq(emailContasT.id, contaId));
      }
    }
  },
  { connection, concurrency: 1 }
);

// Shared helper: fetch, dedup, match leads, store emails
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processAndStoreEmails(
  client: any,
  db: ReturnType<typeof drizzle>,
  since: Date,
  conta: any,
  fetchOptions: { label?: string } | undefined,
  emailsT: any,
  leadsT: any,
  leadUserUnreadT: any,
  emailContasT: any,
  onProgress?: (progress: number) => Promise<void>,
): Promise<number> {
  let pageToken: string | undefined;
  let totalImported = 0;
  let pageCount = 0;

  // Collect all raw emails first (across all pages)
  const allRawEmails: any[] = [];

  do {
    const result = await client.fetchEmails(since, pageToken, fetchOptions);
    pageToken = result.nextToken;
    pageCount++;

    for (const rawEmail of result.emails) {
      allRawEmails.push(rawEmail);
    }

    // Report progress for backfill
    if (onProgress) {
      const progress = pageToken ? Math.min(pageCount * 10, 80) : 85;
      await onProgress(progress);
    }
  } while (pageToken);

  // If using label mode and client supports getThreadEmails, fetch full threads
  // so we don't lose conversation context
  if (fetchOptions?.label && client.getThreadEmails) {
    const threadIds = new Set<string>();
    for (const rawEmail of allRawEmails) {
      if (rawEmail.threadId) threadIds.add(rawEmail.threadId);
    }

    const existingProviderIds = new Set(allRawEmails.map((e: any) => e.providerMessageId));

    for (const tid of threadIds) {
      try {
        const threadEmails = await client.getThreadEmails(tid);
        for (const te of threadEmails) {
          if (!existingProviderIds.has(te.providerMessageId)) {
            allRawEmails.push(te);
            existingProviderIds.add(te.providerMessageId);
          }
        }
      } catch (err) {
        console.error(`[EmailSync] Failed to fetch thread ${tid}:`, err);
      }
    }

    console.log(`[EmailSync] Label mode: ${threadIds.size} threads expanded, ${allRawEmails.length} total messages`);
  }

  // Now store all emails (dedup, match leads, etc.)
  for (const rawEmail of allRawEmails) {
    if (rawEmail.providerMessageId) {
      const [existing] = await db.select({ id: emailsT.id })
        .from(emailsT)
        .where(eq(emailsT.providerMessageId, rawEmail.providerMessageId))
        .limit(1);
      if (existing) continue;
    }

    // Match lead by email address
    const emailAddr = rawEmail.from.includes(conta.email) ? rawEmail.to.split(",")[0].trim() : rawEmail.from;
    const cleanEmail = emailAddr.replace(/.*<(.+)>.*/, "$1").trim().toLowerCase();
    let leadId: string | null = null;

    if (cleanEmail) {
      const [lead] = await db.select({ id: leadsT.id })
        .from(leadsT)
        .where(and(like(leadsT.email, cleanEmail), eq(leadsT.organizacaoId, conta.organizacaoId)))
        .limit(1);
      if (lead) leadId = lead.id;
    }

    // leads_only mode: skip emails that don't match any lead
    if (conta.syncMode === "leads_only" && !leadId) {
      continue;
    }

    const direcao = rawEmail.from.includes(conta.email) ? "out" : "in";

    await db.insert(emailsT).values({
      organizacaoId: conta.organizacaoId,
      leadId,
      contaId: conta.id,
      de: rawEmail.from,
      para: rawEmail.to,
      cc: rawEmail.cc || null,
      assunto: rawEmail.subject || "(sem assunto)",
      corpo: rawEmail.html || rawEmail.text || "",
      corpoTexto: rawEmail.text || rawEmail.html?.replace(/<[^>]*>/g, "") || "",
      direcao,
      status: "sent",
      lido: rawEmail.read,
      messageId: rawEmail.messageId || null,
      inReplyTo: rawEmail.inReplyTo || null,
      threadId: rawEmail.threadId || null,
      providerMessageId: rawEmail.providerMessageId,
      labels: rawEmail.labels || null,
      createdAt: rawEmail.date,
    });

    // F2/dual-write (Communication Intelligence) — best-effort, nunca
    // bloqueia o sync real da caixa de e-mail. Import local (não veio nos
    // parâmetros da função, que já são passados pelo caller) — dynamic
    // import é cacheado pelo Node, custo é desprezível.
    try {
      const { pessoas: pessoasEmailT, communications: commsEmailT } = await import("../lib/db/schema");
      let pessoaIdEmail: string | null = null;
      if (leadId) {
        const [pessoa] = await db.select({ id: pessoasEmailT.id }).from(pessoasEmailT).where(eq(pessoasEmailT.leadIdLegado, leadId)).limit(1);
        pessoaIdEmail = pessoa?.id ?? null;
      }
      await db
        .insert(commsEmailT)
        .values({
          organizacaoId: conta.organizacaoId,
          pessoaId: pessoaIdEmail,
          canal: "email",
          direcao: direcao === "in" ? "entrada" : "saida",
          conteudo: rawEmail.subject || null,
          status: "sent",
          externalId: rawEmail.providerMessageId || rawEmail.messageId || null,
          ocorridoEm: rawEmail.date,
          raw: { assunto: rawEmail.subject, threadId: rawEmail.threadId },
        })
        .onConflictDoNothing({ target: [commsEmailT.canal, commsEmailT.externalId] });
    } catch (err) {
      console.error("[F2/dual-write] falha ao sincronizar communications de email (best-effort):", err);
    }

    totalImported++;

    if (leadId) {
      const updateData: Record<string, unknown> = {
        emailUltimoAssunto: rawEmail.subject || "(sem assunto)",
        emailUltimaMsgAt: rawEmail.date,
        updatedAt: new Date(),
      };
      if (direcao === "in" && !rawEmail.read) {
        updateData.emailNaoLidos = rawSql`COALESCE(email_nao_lidos, 0) + 1`;
      }
      await db.update(leadsT).set(updateData).where(eq(leadsT.id, leadId));

      // Upsert per-user unread counter for incoming unread emails
      if (direcao === "in" && !rawEmail.read && conta.usuarioId) {
        await db.insert(leadUserUnreadT).values({
          leadId,
          usuarioId: conta.usuarioId,
          whatsappNaoLidas: 0,
          emailNaoLidos: 1,
        }).onConflictDoUpdate({
          target: [leadUserUnreadT.leadId, leadUserUnreadT.usuarioId],
          set: {
            emailNaoLidos: rawSql`lead_user_unread.email_nao_lidos + 1`,
          },
        });
      }
    }
  }

  if (onProgress) {
    await onProgress(100);
  }

  return totalImported;
}

// ─── Email Sequence Worker ──────────────────────────────────
const emailSequenceWorker = new Worker(
  "email-sequence",
  async (job) => {
    if (job.name !== "check-sequences") return;

    const {
      emailSequenciaExecucoes: execT,
      emailSequenciaPassos: passosT,
      emailTemplates: templatesT,
      emailContas: contasT,
      emails: emailsT,
      leads: leadsT,
      pessoas: pessoasSeqT,
      communications: commsSeqT,
    } = await import("../lib/db/schema");
    const { createEmailClient } = await import("../lib/email/factory");
    const { interpolateTemplate } = await import("../lib/email/template-engine");

    const dueExecucoes = await db.select()
      .from(execT)
      .where(and(eq(execT.status, "ativo"), lte(execT.proximaExecucaoAt, new Date())));

    for (const exec of dueExecucoes) {
      try {
        const passos = await db.select()
          .from(passosT)
          .where(eq(passosT.sequenciaId, exec.sequenciaId))
          .orderBy(passosT.ordem);

        if (exec.passoAtual >= passos.length) {
          await db.update(execT).set({ status: "concluido", concluidoAt: new Date() }).where(eq(execT.id, exec.id));
          continue;
        }

        const currentStep = passos[exec.passoAtual];

        // Check condition steps (auto-cancel on reply)
        if (currentStep.tipo === "condicao") {
          const condicao = currentStep.condicao as { tipo?: string } | null;
          if (condicao?.tipo === "respondeu") {
            const [reply] = await db.select({ id: emailsT.id })
              .from(emailsT)
              .where(and(eq(emailsT.leadId, exec.leadId), eq(emailsT.direcao, "in")))
              .limit(1);
            if (reply) {
              await db.update(execT).set({ status: "cancelado", concluidoAt: new Date() }).where(eq(execT.id, exec.id));
              console.log(`[Sequence] Lead replied, cancelling ${exec.id}`);
              continue;
            }
          }
        }

        if (currentStep.tipo === "email" && currentStep.templateId) {
          const [template] = await db.select().from(templatesT).where(eq(templatesT.id, currentStep.templateId)).limit(1);
          if (!template) continue;

          const [lead] = await db.select().from(leadsT).where(eq(leadsT.id, exec.leadId)).limit(1);
          if (!lead || !lead.email) {
            await db.update(execT).set({ status: "erro" }).where(eq(execT.id, exec.id));
            continue;
          }

          const [conta] = await db.select().from(contasT).where(eq(contasT.id, exec.contaId)).limit(1);
          if (!conta) { await db.update(execT).set({ status: "erro" }).where(eq(execT.id, exec.id)); continue; }

          const templateData = {
            nome: lead.nome, sobrenome: lead.sobrenome || "", email: lead.email,
            telefone: lead.telefone || "", empresa: lead.empresa || "", cargo: lead.cargo || "",
          };

          const subject = interpolateTemplate(template.assunto, templateData);
          const html = interpolateTemplate(template.corpo, templateData);

          const client = createEmailClient({
            id: conta.id, tipo: conta.tipo as "google" | "microsoft" | "imap", email: conta.email,
            accessToken: conta.accessToken, refreshToken: conta.refreshToken, tokenExpiry: conta.tokenExpiry,
            imapHost: conta.imapHost, imapPort: conta.imapPort, smtpHost: conta.smtpHost, smtpPort: conta.smtpPort,
            imapUser: conta.imapUser, smtpUser: conta.smtpUser, imapPass: conta.imapPass, smtpPass: conta.smtpPass,
          });

          const result = await client.sendEmail({ to: lead.email, subject, html, text: html.replace(/<[^>]*>/g, "") });

          await db.insert(emailsT).values({
            organizacaoId: conta.organizacaoId, leadId: lead.id, contaId: conta.id,
            de: conta.email, para: lead.email, assunto: subject, corpo: html,
            corpoTexto: html.replace(/<[^>]*>/g, ""), direcao: "out", status: "sent", lido: true,
            providerMessageId: result.messageId || null, threadId: result.threadId || null,
            sequenciaExecucaoId: exec.id,
          });

          console.log(`[Sequence] Sent step ${exec.passoAtual} to ${lead.email}`);

          // F2/dual-write (Communication Intelligence) — email de sequência
          // automatizada, best-effort, mesmo padrão do resto do canal email.
          try {
            const [pessoaSeq] = await db.select({ id: pessoasSeqT.id }).from(pessoasSeqT).where(eq(pessoasSeqT.leadIdLegado, lead.id)).limit(1);
            await db
              .insert(commsSeqT)
              .values({
                organizacaoId: conta.organizacaoId,
                pessoaId: pessoaSeq?.id ?? null,
                canal: "email",
                direcao: "saida",
                conteudo: html,
                status: "sent",
                externalId: result.messageId || `seq-${exec.id}-${exec.passoAtual}`,
                ocorridoEm: new Date(),
                raw: { sequenciaExecucaoId: exec.id, passo: exec.passoAtual, assunto: subject },
              })
              .onConflictDoNothing({ target: [commsSeqT.canal, commsSeqT.externalId] });
          } catch (err) {
            console.error("[F2/dual-write] falha ao sincronizar communications do email de sequência (best-effort):", err);
          }
        }

        // Advance to next step
        const nextStep = exec.passoAtual + 1;
        if (nextStep >= passos.length) {
          await db.update(execT).set({ passoAtual: nextStep, status: "concluido", concluidoAt: new Date() }).where(eq(execT.id, exec.id));
        } else {
          const nextPasso = passos[nextStep];
          const delayMs = (nextPasso.delayMinutos || 0) * 60 * 1000;
          await db.update(execT).set({ passoAtual: nextStep, proximaExecucaoAt: new Date(Date.now() + delayMs) }).where(eq(execT.id, exec.id));
        }
      } catch (error) {
        console.error(`[Sequence] Error on execution ${exec.id}:`, error);
        await db.update(execT).set({ status: "erro" }).where(eq(execT.id, exec.id));
      }
    }
  },
  { connection, concurrency: 1 }
);

// ─── Enrichment Worker (Apollo.io) ──────────────────────────
const enrichmentWorker = new Worker(
  "enrichment",
  async (job) => {
    const { type, ids, organizacaoId } = job.data as {
      type: "leads" | "empresas";
      ids: string[];
      organizacaoId: string;
    };
    console.log(`[Enrichment] Starting ${type} enrichment: ${ids.length} items`);

    const { leads, empresas, organizacoes } = await import("../lib/db/schema");
    const { enrichPerson, enrichOrganization, extractDomainFromEmail, extractDomainFromUrl } =
      await import("../lib/apollo/client");

    // Resolve per-org Apollo API key
    const [org] = await db.select({ apolloApiKey: organizacoes.apolloApiKey }).from(organizacoes).where(eq(organizacoes.id, organizacaoId)).limit(1);
    const apiKey = org?.apolloApiKey || process.env.APOLLO_API_KEY || undefined;

    const BATCH_SIZE = 10;
    let enriched = 0;
    let notFound = 0;
    let errors = 0;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);

      for (const id of batch) {
        try {
          if (type === "leads") {
            const [lead] = await db
              .select()
              .from(leads)
              .where(and(eq(leads.id, id), eq(leads.organizacaoId, organizacaoId)))
              .limit(1);

            if (!lead || lead.enrichStatus === "enriched") continue;

            const person = await enrichPerson({
              email: lead.email || undefined,
              name: lead.nome,
              organization: lead.empresa || undefined,
              linkedinUrl: lead.linkedin || undefined,
            }, apiKey);

            if (!person) {
              await db.update(leads).set({ enrichStatus: "not_found", enrichedAt: new Date(), updatedAt: new Date() }).where(eq(leads.id, id));
              notFound++;
              continue;
            }

            const updates: Record<string, unknown> = {
              apolloId: person.id,
              enrichedAt: new Date(),
              enrichStatus: "enriched",
              updatedAt: new Date(),
            };
            // Fill empty fields
            if (person.title && !lead.cargo) updates.cargo = person.title;
            if (person.linkedin_url && !lead.linkedin) updates.linkedin = person.linkedin_url;
            if (person.phone_numbers?.[0]?.raw_number && !lead.telefone) updates.telefone = person.phone_numbers[0].raw_number;
            if (person.email && !lead.email) updates.email = person.email;
            // Rich Apollo fields
            if (person.seniority) updates.apolloSeniority = person.seniority;
            if (person.headline) updates.apolloHeadline = person.headline;
            if (person.photo_url) updates.apolloPhotoUrl = person.photo_url;
            if (person.city) updates.apolloCity = person.city;
            if (person.state) updates.apolloState = person.state;
            if (person.country) updates.apolloCountry = person.country;
            if (person.departments?.length) updates.apolloDepartments = person.departments;
            if (person.employment_history?.length) updates.apolloEmploymentHistory = person.employment_history;
            if (person.twitter_url) updates.twitter = person.twitter_url;
            if (person.github_url) updates.github = person.github_url;
            if (person.facebook_url) updates.facebook = person.facebook_url;
            if (person.is_likely_to_engage !== undefined) updates.apolloLikelyEngage = person.is_likely_to_engage;

            await db.update(leads).set(updates).where(eq(leads.id, id));
            enriched++;
          } else {
            const [empresa] = await db
              .select()
              .from(empresas)
              .where(and(eq(empresas.id, id), eq(empresas.organizacaoId, organizacaoId)))
              .limit(1);

            if (!empresa || empresa.enrichStatus === "enriched") continue;

            const domain = empresa.website ? extractDomainFromUrl(empresa.website) : null;
            const org = await enrichOrganization({ domain: domain || undefined, name: empresa.nome }, apiKey);

            if (!org) {
              await db.update(empresas).set({ enrichStatus: "not_found", enrichedAt: new Date(), updatedAt: new Date() }).where(eq(empresas.id, id));
              notFound++;
              continue;
            }

            const orgUpdates: Record<string, unknown> = {
              apolloId: org.id,
              enrichedAt: new Date(),
              enrichStatus: "enriched",
              updatedAt: new Date(),
            };
            if (org.industry) orgUpdates.industry = org.industry;
            if (org.estimated_num_employees) orgUpdates.employeeCount = org.estimated_num_employees;
            if (org.annual_revenue_printed || org.organization_revenue_printed) {
              orgUpdates.annualRevenue = org.annual_revenue_printed || org.organization_revenue_printed;
            }
            if (org.founded_year) orgUpdates.foundedYear = org.founded_year;
            if (!empresa.website && org.website_url) orgUpdates.website = org.website_url;
            if (!empresa.telefone && org.phone) orgUpdates.telefone = org.phone;
            if (!empresa.linkedin && org.linkedin_url) orgUpdates.linkedin = org.linkedin_url;
            if (!empresa.cidade && org.city) orgUpdates.cidade = org.city;
            if (!empresa.estado && org.state) orgUpdates.estado = org.state;
            // Rich Apollo fields
            if (org.short_description) orgUpdates.apolloDescription = org.short_description;
            if (org.logo_url) orgUpdates.logoUrl = org.logo_url;
            if (org.raw_address) orgUpdates.endereco = org.raw_address;
            if (org.postal_code) orgUpdates.cep = org.postal_code;
            if (org.country) orgUpdates.pais = org.country;
            if (org.total_funding_printed) orgUpdates.totalFunding = org.total_funding_printed;
            if (org.latest_funding_stage) orgUpdates.fundingStage = org.latest_funding_stage;
            if (org.organization_headcount_six_month_growth != null) orgUpdates.growth6m = String(org.organization_headcount_six_month_growth);
            if (org.organization_headcount_twelve_month_growth != null) orgUpdates.growth12m = String(org.organization_headcount_twelve_month_growth);
            if (org.twitter_url) orgUpdates.twitter = org.twitter_url;
            if (org.facebook_url) orgUpdates.facebook = org.facebook_url;
            if (org.technology_names?.length) orgUpdates.techStack = org.technology_names;
            if (org.keywords?.length) orgUpdates.apolloKeywords = org.keywords.slice(0, 30);

            await db.update(empresas).set(orgUpdates).where(eq(empresas.id, id));
            enriched++;
          }
        } catch (err) {
          console.error(`[Enrichment] Error enriching ${type} ${id}:`, err);
          const table = type === "leads" ? leads : empresas;
          await db.update(table).set({ enrichStatus: "error", updatedAt: new Date() } as Record<string, unknown>).where(eq(table.id, id));
          errors++;
        }
      }

      const progress = Math.min(100, Math.round(((i + batch.length) / ids.length) * 100));
      console.log(`[Enrichment] Progress: ${i + batch.length}/${ids.length} (${progress}%) — ${enriched} enriched, ${notFound} not found, ${errors} errors`);
      await job.updateProgress(progress);
      await job.updateData({ ...job.data, enriched, notFound, errors, processed: i + batch.length });

      // Rate limit: ~600 req/hr = 10 req/6s, sleep between batches
      if (i + BATCH_SIZE < ids.length) {
        await new Promise((r) => setTimeout(r, 6000));
      }
    }

    console.log(`[Enrichment] Done: ${enriched} enriched, ${notFound} not found, ${errors} errors`);
    return { enriched, notFound, errors, total: ids.length };
  },
  { connection, concurrency: 1 }
);

/**
 * Remove APENAS os schedulers que não existem mais nesta versão do worker.
 *
 * Substitui o `SCAN bull:*:repeat:* + DEL` que rodava no startup (achado da
 * auditoria de 14/09): aquele varria as chaves de TODAS as filas e apagava
 * também a chave do job repetido que estava em voo naquele instante — o job
 * então falhava ao finalizar com "Missing key for job repeat:<id>.
 * moveToFinished". Reproduzido em DEV: 1.723 chaves apagadas e o
 * `email-sync-trigger` quebrando no mesmo startup.
 *
 * `upsertJobScheduler` já é idempotente na BullMQ 5, então não existe motivo
 * pra limpar antes: só o que sobrou de uma versão anterior precisa sair, e
 * isso se faz pela API oficial, depois dos upserts.
 */
async function removerSchedulersObsoletos(queue: Queue, chavesAtuais: string[]): Promise<void> {
  try {
    const existentes = await queue.getJobSchedulers(0, -1);
    const atuais = new Set(chavesAtuais);
    for (const s of existentes) {
      if (s?.key && !atuais.has(s.key)) {
        await queue.removeJobScheduler(s.key);
        console.log(`[Worker] Scheduler obsoleto removido: ${queue.name}/${s.key}`);
      }
    }
  } catch (err) {
    // Limpeza é higiene, não pode impedir o worker de subir.
    console.error(`[Worker] falha ao limpar schedulers obsoletos de ${queue.name} (best-effort):`, err);
  }
}

/** Chaves dos schedulers da fila `scheduled-jobs` nesta versão — fonte da limpeza acima. */
const SCHEDULERS_JOBS_AGENDADOS = [
  "sla-check", "sdr-followup-escalation", "ai-sdr-outreach", "ai-sdr-retry",
  "ai-sdr-meeting-confirmation", "stripe-sync", "reconcile-pagamentos", "expirar-propostas",
  "rd-criativo-sync", "outlook-reuniao-sync", "follow-up-proposta", "cs-sweep",
  "alerta-renovacao", "reativar-lead-perdido", "check-whatsapp-connection", "snapshot-diario",
  "cadence-sweep", "event-outbox-sweep", "lembrete-reuniao-30min",
  "catalogo-stripe-sync",
];

// Schedule recurring jobs
async function setupScheduledJobs() {
  await scheduledQueue.upsertJobScheduler("sla-check", { every: 30 * 60 * 1000 }, { name: "check-sla" });
  await scheduledQueue.upsertJobScheduler("sdr-followup-escalation", { every: 15 * 60 * 1000 }, { name: "sdr-followup-escalation" });
  await scheduledQueue.upsertJobScheduler("ai-sdr-outreach", { every: 5 * 60 * 1000 }, { name: "ai-sdr-outreach" });
  await scheduledQueue.upsertJobScheduler("ai-sdr-retry", { every: 15 * 60 * 1000 }, { name: "ai-sdr-retry" });
  await scheduledQueue.upsertJobScheduler("ai-sdr-meeting-confirmation", { pattern: "0 9 * * *", tz: "America/Sao_Paulo" }, { name: "ai-sdr-meeting-confirmation" });
  // Stripe = fonte da verdade de billing AI: sync a cada 30 min (polling; vira webhook quando publicar)
  await scheduledQueue.upsertJobScheduler("stripe-sync", { every: 30 * 60 * 1000 }, { name: "stripe-sync" });
  await scheduledQueue.upsertJobScheduler("reconcile-pagamentos", { every: 24 * 60 * 60 * 1000 }, { name: "reconcile-pagamentos" });
  await scheduledQueue.upsertJobScheduler("expirar-propostas", { every: 60 * 60 * 1000 }, { name: "expirar-propostas" });
  await scheduledQueue.upsertJobScheduler("rd-criativo-sync", { every: 6 * 60 * 60 * 1000 }, { name: "rd-criativo-sync" });
  await scheduledQueue.upsertJobScheduler("outlook-reuniao-sync", { every: 15 * 60 * 1000 }, { name: "outlook-reuniao-sync" });
  await scheduledQueue.upsertJobScheduler("follow-up-proposta", { every: 60 * 60 * 1000 }, { name: "follow-up-proposta" });
  await scheduledQueue.upsertJobScheduler("cs-sweep", { every: 60 * 60 * 1000 }, { name: "cs-sweep" });
  await scheduledQueue.upsertJobScheduler("alerta-renovacao", { every: 24 * 60 * 60 * 1000 }, { name: "alerta-renovacao" });
  await scheduledQueue.upsertJobScheduler("reativar-lead-perdido", { every: 24 * 60 * 60 * 1000 }, { name: "reativar-lead-perdido" });
  await scheduledQueue.upsertJobScheduler("check-whatsapp-connection", { every: 5 * 60 * 1000 }, { name: "check-whatsapp-connection" });
  await scheduledQueue.upsertJobScheduler("snapshot-diario", { every: 60 * 60 * 1000 }, { name: "snapshot-diario" });
  await scheduledQueue.upsertJobScheduler("cadence-sweep", { every: 5 * 60 * 1000 }, { name: "cadence-sweep" });
  await scheduledQueue.upsertJobScheduler("event-outbox-sweep", { every: 60 * 1000 }, { name: "event-outbox-sweep" });
  await scheduledQueue.upsertJobScheduler("lembrete-reuniao-30min", { every: 5 * 60 * 1000 }, { name: "lembrete-reuniao-30min" });
  // Catálogo comercial: o Stripe é onde o preço é decidido, então o CRM
  // sincroniza em vez de guardar cópia. De hora em hora porque preço muda por
  // decisão humana, não por evento: ninguém altera tabela de preço a cada
  // minuto, e ler a API de graça a cada minuto é desperdício com rate limit.
  await scheduledQueue.upsertJobScheduler("catalogo-stripe-sync", { every: 60 * 60 * 1000 }, { name: "catalogo-stripe-sync" });
  // Email sync: trigger every 5 min
  await emailSyncQueue.upsertJobScheduler("email-sync-trigger", { every: 5 * 60 * 1000 }, { name: "sync-trigger" });
  // Email sequences: check every minute
  const seqQueue = new Queue("email-sequence", { connection });
  await seqQueue.upsertJobScheduler("check-sequences", { every: 60 * 1000 }, { name: "check-sequences" });

  // Só DEPOIS de todos os upserts: tira o que sobrou de versões anteriores.
  await removerSchedulersObsoletos(scheduledQueue, SCHEDULERS_JOBS_AGENDADOS);
  await removerSchedulersObsoletos(emailSyncQueue, ["email-sync-trigger"]);
  await removerSchedulersObsoletos(seqQueue, ["check-sequences"]);

  await seqQueue.close();
  console.log(`[Worker] Scheduled jobs configured (${SCHEDULERS_JOBS_AGENDADOS.length} em scheduled-jobs + email sync + sequences)`);
}

setupScheduledJobs().catch(console.error);

// ─── CIPA Analysis Worker removido (feature Scott Studio, fora do escopo Callface) ───

// ─── Site Lead Qualify Worker ────────────────────────────────────
// For leads from site (no LP URL): generates insumoComercial from project description
const siteLeadQualifyWorker = new Worker(
  "site-lead-qualify",
  async (job) => {
    const { negocioId, leadId, organizacaoId, descricao, servicosInteresse, leadNome } = job.data as {
      negocioId: string; leadId: string; organizacaoId: string;
      descricao: string; servicosInteresse: string[]; leadNome: string;
    };
    console.log(`[SiteQualify] Qualifying site lead ${leadNome} (negocio ${negocioId})`);

    try {
      const { negocios, leads: leadsT, statusChanges, aiSdrConfig } = await import("../lib/db/schema.js");

      // Get API key: try ai_sdr_config (encrypted) first, fallback to env
      let apiKey = process.env.GROQ_API_KEY;
      try {
        const [config] = await db.select({ groqApiKey: aiSdrConfig.groqApiKey })
          .from(aiSdrConfig).where(eq(aiSdrConfig.organizacaoId, organizacaoId)).limit(1);
        if (config?.groqApiKey) {
          const { decrypt } = await import("../lib/email/encryption.js");
          apiKey = decrypt(config.groqApiKey);
        }
      } catch { /* fallback to env */ }
      if (!apiKey) {
        console.warn("[SiteQualify] No GROQ_API_KEY, skipping");
        return;
      }

      const servicosMap: Record<string, string> = {
        site: "Site / Landing Page",
        automacao: "Automacoes e Integracoes",
        funil: "Estrutura de Funis",
        completo: "Estrutura Digital Completa",
        analise: "Analise Gratuita",
      };
      const servicosLabel = (servicosInteresse || []).map(s => servicosMap[s] || s).join(", ") || "nao especificado";
      const projetoDesc = descricao || "nao informado";

      const prompt = `Voce e um analista comercial senior que esta sendo pago para entender PROFUNDAMENTE este lead e gerar um briefing que permita uma conversa consultiva de alto nivel.

PRINCIPIO FUNDAMENTAL: "Ninguem compra de quem precisa vender." Tudo que voce gerar deve fazer o lead sentir que tem uma oportunidade na mao — nunca que tem um vendedor precisando de comissao.

SOBRE A SCOTT STUDIO:
- Fundador: Scott Ferraz
- Ecossistemas digitais completos: sites, landing pages, funis de conversao, automacoes, integracoes
- NAO fazemos trafego, SEO, redes sociais. Nao somos agencia. "A gente cuida do que vem depois do clique."
- Posicionamento: "Estrutura antes de escala"
- Preco medio: R$1.500 a R$3.000 por projeto
- Cases: Castrum +340% conversao, Pensae +210%, Octo +180% leads, CAC -60%

DADOS DO LEAD:
- Nome: ${leadNome}
- Servico selecionado: ${servicosLabel}
- Descricao do projeto (palavras do lead): "${projetoDesc}"

ANALISE NECESSARIA — Gere um JSON com:

1. "analise_do_lead": objeto com analise profunda
   - "perfil_provavel": quem e essa pessoa? (empreendedor, agencia, startup, empresa consolidada?) baseado nas pistas do texto
   - "momento_do_negocio": em que fase ele ta? (comecando, escalando, pivotando, lancamento urgente?)
   - "nivel_de_urgencia": baixo/medio/alto — e POR QUE (cite evidencias do texto)
   - "nivel_de_sofisticacao": quanto ele entende de digital? (iniciante, intermediario, avancado) — baseado no vocabulario usado
   - "necessidades_explicitas": o que ele DISSE que precisa (lista)
   - "necessidades_implicitas": o que ele PROVAVELMENTE precisa mas nao disse (inferido do contexto)
   - "servicos_recomendados": quais servicos Scott Studio se encaixam e por que
   - "estimativa_valor": faixa de valor provavel do projeto baseado na complexidade descrita
   - "red_flags": algo que pode ser problematico (prazo impossivel, expectativa desalinhada, budget provavelmente baixo)
   - "oportunidades": onde a Scott Studio pode surpreender e entregar mais valor

2. "insumo_comercial": briefing pro SDR abordar via WhatsApp

   - "abertura_recomendada": REGRAS ABSOLUTAS:
     Max 3-4 linhas. Apresenta so o nome — sem cargo, sem empresa, sem 'trabalho com X'.
     NUNCA usa: 'oportunidade', 'conversao', 'melhorar', 'solucao', 'ajudar', 'apresentar', 'proposta', 'resultado'.
     ESTRUTURA EM 4 MOVIMENTOS:
     1. APRESENTACAO — nome so
     2. CONTEXTO DE MERCADO — com quem tenho conversado + situacao comum do nicho (cria pertencimento)
     3. OBSERVACAO ESPECIFICA — algo real do formulario/negocio DELE, revelado PARCIALMENTE (despertar curiosidade, nao entregar diagnostico)
     4. PERGUNTA ABERTA — convida a entender mais, nao pede permissao pra vender
     Use as palavras que o lead usou no formulario. Adapte o contexto de mercado ao nicho dele.

   - "angulo_de_ataque": baseado no que o lead DISSE no formulario. Na linguagem do dono do negocio, nao do tecnico. NUNCA mencionar a Scott Studio. Deve responder: 'qual ponto apresentar que vai fazer o lead pensar: caramba, e exatamente isso'

   - "objecao_provavel": especifica pra este lead. Baseada no perfil, nicho e o que ele escreveu. NAO generica.

   - "argumento_scott_studio": resposta pra essa objecao, com case real se aplicavel

   - "closer_c": pergunta Clarify — curiosidade genuina, nao interrogatorio. Faz o lead revelar onde esta travado. Ex: 'Voce ja tem alguma estrutura montada pra isso ou ta partindo do zero?'

   - "closer_l": Label — frase que nomeia a situacao de forma que o lead se reconheca. Deve gerar 'e exatamente isso'. Ex: 'Entao o desafio nao e a ideia — e ter a estrutura pra transformar isso em algo que funcione sozinho.'

   - "closer_o": Overview — pinte o cenario futuro concreto. O que muda se resolver? Com numeros estimados se possivel.

   - "closer_e": Explain — explique como resolver na pratica, simples, sem jargao. Processo + timeline + resultado esperado.

   - "dor_principal": NAO e um problema tecnico — e como o lead SENTE. Escreva como ele descreveria pra um amigo. Use as palavras dele do formulario.

   - "bottleneck": o gargalo que fez ele buscar ajuda. Cite pistas do texto.

   - "pontos_de_conversa": lista de 3-5 topicos que o SDR pode explorar na conversa

   - "perguntas_qualificacao": 3 perguntas pra qualificar (budget, timeline, decisor)

   - "msg_whatsapp": mensagem pronta (max 4 linhas curtas, use \\n). Apresentacao + algo especifico do formulario + contexto de mercado + pergunta aberta. NAO venda. NAO mencione precos.

   - "msg_instagram": mensagem curta (max 3 linhas). Tom leve, com propriedade. NAO se apresente formalmente. Gere curiosidade.

   - "msg_email": formato 'Assunto: ...\\n\\nCorpo'. Assunto curto e especifico. Corpo max 6 linhas: apresentacao 1 frase > o que viu > impacto > contexto mercado > pergunta aberta.

3. "resumo": paragrafo de 4-6 frases com diagnostico completo do lead — quem e, o que precisa, como abordar, qual o potencial, quais cuidados ter

REGRAS:
- Use as PALAVRAS do proprio lead. Se ele falou "pagina de vendas", nao troque por "landing page".
- Seja ESPECIFICO. Nada de "entendo sua necessidade" ou "solucao personalizada".
- A analise deve dar pro SDR tudo que ele precisa pra ter uma conversa de 10 minutos sem precisar perguntar o obvio.
- Infira o maximo possivel do contexto. Se ele fala "lancamento semana que vem", isso diz MUITO sobre urgencia, budget, e momento.
- A abertura NUNCA deve soar como vendedor. O lead deve pensar "como esse cara sabe disso?" e nao "mais um vendedor chato".
Responda APENAS com o JSON valido, sem markdown.`;

      // Try models in order — each has independent rate limits
      const models = ["llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct", "llama-3.1-8b-instant"];
      let content: string | null = null;

      for (const model of models) {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
            max_tokens: 4500,
            response_format: { type: "json_object" },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          content = data.choices?.[0]?.message?.content || null;
          if (content) {
            console.log(`[SiteQualify] Success with model ${model}`);
            break;
          }
        } else if (res.status === 429 || res.status === 400) {
          const errBody = await res.text();
          console.warn(`[SiteQualify] ${model} unavailable (${res.status}), trying next...`);
          continue;
        } else {
          console.error(`[SiteQualify] Groq error ${res.status} on ${model}: ${await res.text()}`);
          continue;
        }
      }

      if (!content) {
        throw new Error("All Groq models unavailable");
      }

      const parsed = JSON.parse(content);
      const ic = parsed.insumo_comercial || {};
      const insumo = {
        abertura_recomendada: ic.abertura_recomendada || "",
        angulo_de_ataque: ic.angulo_de_ataque || "",
        objecao_provavel: ic.objecao_provavel || "",
        argumento_scott_studio: ic.argumento_scott_studio || "",
        closer_c: ic.closer_c || "",
        closer_l: ic.closer_l || "",
        closer_o: ic.closer_o || "",
        closer_e: ic.closer_e || "",
        dor_principal: ic.dor_principal || "",
        bottleneck: ic.bottleneck || "",
        pontos_de_conversa: ic.pontos_de_conversa || [],
        perguntas_qualificacao: ic.perguntas_qualificacao || [],
        msg_whatsapp: ic.msg_whatsapp || "",
        msg_instagram: ic.msg_instagram || "",
        msg_email: ic.msg_email || "",
      };

      const analiseLead = parsed.analise_do_lead || {};

      // Update negocio with full analysis (cipaDiagnostico reused for site lead analysis)
      await db.update(negocios).set({
        insumoComercial: insumo,
        cipaDiagnostico: {
          tipo: "site_form_analysis",
          analise_do_lead: analiseLead,
          servico_selecionado: servicosLabel,
          projeto_descrito: projetoDesc,
        },
        analysisNotes: parsed.resumo || null,
        updatedAt: new Date(),
      }).where(eq(negocios.id, negocioId));

      // Also update lead insumo
      await db.update(leadsT).set({
        insumoComercial: insumo,
        updatedAt: new Date(),
      }).where(eq(leadsT.id, leadId));

      // Step 1: Move to "qualificacao" (IA enriched with insumo)
      await db.update(negocios).set({ status: "reuniao_agendada", updatedAt: new Date() }).where(eq(negocios.id, negocioId));
      await db.insert(statusChanges).values({
        leadId, negocioId,
        deStatus: "novo",
        paraStatus: "reuniao_agendada",
        motivo: "Insumo comercial gerado via formulario do site",
      });
      await db.update(leadsT).set({
        status: "em_qualificacao",
        updatedAt: new Date(),
      }).where(eq(leadsT.id, leadId));

      console.log(`[SiteQualify] Lead ${leadNome} qualified (reuniao_agendada). Insumo gerado.`);
      return { negocioId, leadId, insumo, stage: "reuniao_agendada" };
    } catch (err) {
      console.error(`[SiteQualify] Error qualifying lead ${leadNome}:`, err);
      throw err;
    }
  },
  { connection, concurrency: 2 }
);
trackRedisConnection(siteLeadQualifyWorker);

// ─── Callface Call Events Worker ─────────────────────────────────
// Eventos de ligação finalizada (webhook de saída da Callface, enfileirados por
// /api/webhooks/callface). Persistência + matching + timeline + notificações
// vivem em lib/integrations/callface.ts; idempotência por unique key lá dentro.
const callfaceCallEventsWorker = new Worker(
  "callface-call-events",
  async (job) => {
    const { payload } = job.data as { payload: Record<string, unknown> };
    const { processCallfaceCallEvent } = await import("../lib/integrations/callface.js");
    const r = await processCallfaceCallEvent(db, payload);
    console.log(`[CallfaceEvents] ${r}`);
    return { result: r };
  },
  { connection, concurrency: 2 }
);
trackRedisConnection(callfaceCallEventsWorker);

// Graceful shutdown
const shutdown = async () => {
  console.log("[Worker] Shutting down...");
  await Promise.all([
    scoringWorker.close(),
    notificationWorker.close(), whatsappIncomingWorker.close(), whatsappOutgoingWorker.close(),
    whatsappStatusWorker.close(), slaWorker.close(), enrichmentWorker.close(), scheduledQueue.close(),
    emailSyncWorker.close(), emailSequenceWorker.close(), emailSyncQueue.close(),
    siteLeadQualifyWorker.close(), callfaceCallEventsWorker.close(),
  ]);
  await pgSql.end();
  healthServer.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("[Worker] All workers started successfully");
