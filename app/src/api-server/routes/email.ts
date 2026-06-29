import { Hono } from "hono";
import { db } from "@/lib/db";
import {
  emails, leads, emailContas, leadUserUnread, usuarios,
  emailTemplates, emailSequencias, emailSequenciaPassos, emailSequenciaExecucoes,
} from "@/lib/db/schema";
import { eq, desc, and, sql, ilike, or, isNull, inArray, asc } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { createEmailClient } from "@/lib/email/factory";
import type { EmailContaConfig } from "@/lib/email/types";
import { encrypt, decrypt } from "@/lib/email/encryption";
import { testImapConnection, testSmtpConnection } from "@/lib/email/imap";
import { extractVariables } from "@/lib/email/template-engine";
import { getGoogleAuthUrl } from "@/lib/email/google";
import { exchangeGoogleCode } from "@/lib/email/google";
import { getMicrosoftAuthUrl } from "@/lib/email/microsoft";
import { exchangeMicrosoftCode } from "@/lib/email/microsoft";

const app = new Hono();

// ─── GET /email — list email conversations ──────────────────────────────────
// Groups emails by thread_id (or by counterpart address if no thread).
// Shows ALL emails — with or without a lead — like WhatsApp conversations.

app.get("/email", async (c) => {
  const ctx = await getCtx(c);

  const leadId = c.req.query("leadId") ?? null;
  const lido = c.req.query("lido") ?? null;
  const search = c.req.query("search") ?? null;
  const viewAs = c.req.query("viewAs") ?? null;
  const page = parseInt(c.req.query("page") || "1");
  const limit = 50;
  const offset = (page - 1) * limit;

  let effectiveUserId = ctx.userId;
  let readOnly = false;
  if (viewAs && viewAs !== ctx.userId) {
    if (ctx.userRole === "admin" || ctx.userRole === "super_admin") {
      effectiveUserId = viewAs;
      readOnly = true;
    }
  }

  // Single lead view — return all emails for that lead
  if (leadId) {
    const [lead] = await db.select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!lead) return c.json({ error: "Lead não encontrado" }, 404);

    const emailList = await db
      .select({
        id: emails.id,
        organizacaoId: emails.organizacaoId,
        leadId: emails.leadId,
        contaId: emails.contaId,
        de: emails.de,
        para: emails.para,
        cc: emails.cc,
        bcc: emails.bcc,
        assunto: emails.assunto,
        corpo: emails.corpo,
        corpoTexto: emails.corpoTexto,
        direcao: emails.direcao,
        status: emails.status,
        lido: emails.lido,
        enviadoPorId: emails.enviadoPorId,
        messageId: emails.messageId,
        inReplyTo: emails.inReplyTo,
        threadId: emails.threadId,
        providerMessageId: emails.providerMessageId,
        labels: emails.labels,
        anexos: emails.anexos,
        sequenciaExecucaoId: emails.sequenciaExecucaoId,
        createdAt: emails.createdAt,
        contaUsuarioId: emailContas.usuarioId,
        contaUsuarioNome: usuarios.nome,
      })
      .from(emails)
      .leftJoin(emailContas, eq(emails.contaId, emailContas.id))
      .leftJoin(usuarios, eq(emailContas.usuarioId, usuarios.id))
      .where(eq(emails.leadId, leadId))
      .orderBy(desc(emails.createdAt))
      .limit(100);

    return c.json({ emails: emailList });
  }

  // Thread view — return all emails in a thread (by threadId or single email)
  const threadId = c.req.query("threadId") ?? null;
  const emailId = c.req.query("emailId") ?? null;
  if (threadId || emailId) {
    const threadConditions: any[] = [eq(emails.organizacaoId, ctx.organizacaoId)];
    if (threadId) {
      threadConditions.push(eq(emails.threadId, threadId));
    } else if (emailId) {
      threadConditions.push(eq(emails.id, emailId));
    }

    const emailList = await db
      .select({
        id: emails.id,
        de: emails.de,
        para: emails.para,
        cc: emails.cc,
        assunto: emails.assunto,
        corpo: emails.corpo,
        corpoTexto: emails.corpoTexto,
        direcao: emails.direcao,
        status: emails.status,
        lido: emails.lido,
        messageId: emails.messageId,
        threadId: emails.threadId,
        createdAt: emails.createdAt,
      })
      .from(emails)
      .where(and(...threadConditions))
      .orderBy(asc(emails.createdAt))
      .limit(100);

    return c.json({ emails: emailList });
  }

  // Get user's email accounts
  const userContas = await db
    .select({ id: emailContas.id, email: emailContas.email, tipo: emailContas.tipo, assinatura: emailContas.assinatura })
    .from(emailContas)
    .where(and(
      eq(emailContas.organizacaoId, ctx.organizacaoId),
      eq(emailContas.usuarioId, effectiveUserId),
    ));

  if (userContas.length === 0) {
    return c.json({
      emails: [],
      contas: [],
      page,
      ...(readOnly ? { readOnly: true } : {}),
    });
  }

  const userContaIds = userContas.map((cont) => cont.id);

  // Thread-grouped inbox — like Gmail: one row per thread, showing latest message
  // Uses raw SQL to get the latest email per thread_id (or per email if no thread)
  const conditions: any[] = [
    eq(emails.organizacaoId, ctx.organizacaoId),
    inArray(emails.contaId, userContaIds),
  ];

  if (lido === "false") {
    conditions.push(eq(emails.lido, false));
  }

  if (search) {
    conditions.push(
      or(
        ilike(emails.assunto, `%${search}%`),
        ilike(emails.de, `%${search}%`),
        ilike(emails.para, `%${search}%`),
      )!,
    );
  }

  // Get all matching emails, then group by thread in JS
  // (simpler than complex SQL window functions with Drizzle)
  const allEmails = await db
    .select({
      id: emails.id,
      de: emails.de,
      para: emails.para,
      cc: emails.cc,
      assunto: emails.assunto,
      corpoTexto: emails.corpoTexto,
      direcao: emails.direcao,
      lido: emails.lido,
      leadId: emails.leadId,
      threadId: emails.threadId,
      providerMessageId: emails.providerMessageId,
      createdAt: emails.createdAt,
      leadNome: leads.nome,
      leadStatus: leads.status,
    })
    .from(emails)
    .leftJoin(leads, eq(emails.leadId, leads.id))
    .where(and(...conditions))
    .orderBy(desc(emails.createdAt))
    .limit(500);

  // Group by threadId — show latest email per thread with message count + unread count
  const threadMap = new Map<string, { latest: typeof allEmails[0]; count: number; unread: number }>();

  for (const email of allEmails) {
    const key = email.threadId || email.id; // emails without threadId are standalone
    const existing = threadMap.get(key);
    if (!existing) {
      threadMap.set(key, { latest: email, count: 1, unread: email.lido ? 0 : 1 });
    } else {
      existing.count++;
      if (!email.lido) existing.unread++;
      // latest stays as-is (allEmails already sorted by createdAt DESC)
    }
  }

  const emailList = Array.from(threadMap.values())
    .map(({ latest, count, unread }) => ({
      ...latest,
      threadCount: count,
      threadUnread: unread,
    }))
    .slice(offset, offset + limit);

  return c.json({
    emails: emailList,
    contas: userContas,
    page,
    ...(readOnly ? { readOnly: true } : {}),
  });
});

// ─── POST /email/send ───────────────────────────────────────────────────────

const sendSchema = z.object({
  contaId: z.string().uuid(),
  para: z.string().min(1),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  assunto: z.string().min(1),
  corpo: z.string().min(1),
  inReplyTo: z.string().optional(),
  threadId: z.string().optional(),
  leadId: z.string().uuid().optional(),
  fromAlias: z.string().email().optional(),
});

app.post("/email/send", async (c) => {
  const ctx = await getCtx(c);

  try {
    const body = await c.req.json();
    const data = sendSchema.parse(body);

    const [conta] = await db.select()
      .from(emailContas)
      .where(and(eq(emailContas.id, data.contaId), eq(emailContas.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!conta) return c.json({ error: "Conta não encontrada" }, 404);

    if (data.leadId) {
      const [lead] = await db.select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, data.leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
        .limit(1);
      if (!lead) return c.json({ error: "Lead não encontrado" }, 404);
    }

    let matchedLeadId = data.leadId || null;
    if (!matchedLeadId) {
      const recipientEmail = data.para.split(",")[0].trim();
      const [matched] = await db.select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.email, recipientEmail), eq(leads.organizacaoId, ctx.organizacaoId)))
        .limit(1);
      if (matched) matchedLeadId = matched.id;
    }

    const corpoTexto = data.corpo.replace(/<[^>]*>/g, "");
    const effectiveFromAlias = data.fromAlias || conta.envioComo || null;
    const [emailRecord] = await db.insert(emails).values({
      organizacaoId: ctx.organizacaoId,
      leadId: matchedLeadId,
      contaId: conta.id,
      de: effectiveFromAlias || conta.email,
      para: data.para,
      cc: data.cc || null,
      bcc: data.bcc || null,
      assunto: data.assunto,
      corpo: data.corpo,
      corpoTexto,
      direcao: "out",
      status: "queued",
      lido: true,
      enviadoPorId: ctx.userId,
      inReplyTo: data.inReplyTo || null,
      threadId: data.threadId || null,
    }).returning();

    const contaConfig: EmailContaConfig = {
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

    try {
      const client = createEmailClient(contaConfig);
      const result = await client.sendEmail({
        to: data.para,
        cc: data.cc,
        bcc: data.bcc,
        subject: data.assunto,
        html: data.corpo,
        text: corpoTexto,
        inReplyTo: data.inReplyTo,
        threadId: data.threadId,
        fromAlias: effectiveFromAlias || undefined,
      });

      await db.update(emails).set({
        status: "sent",
        providerMessageId: result.messageId || null,
        threadId: result.threadId || data.threadId || null,
      }).where(eq(emails.id, emailRecord.id));

      if (matchedLeadId) {
        await db.update(leads).set({
          emailUltimoAssunto: data.assunto,
          emailUltimaMsgAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(leads.id, matchedLeadId));
      }

      return c.json({ ...emailRecord, status: "sent" }, 201);
    } catch (sendError) {
      console.error("[Email Send] Failed:", sendError);
      await db.update(emails).set({ status: "failed" }).where(eq(emails.id, emailRecord.id));
      return c.json({ error: "Falha ao enviar email", details: sendError instanceof Error ? sendError.message : "Unknown" }, 500);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    console.error("[Email Send] Error:", error);
    return c.json({ error: "Erro interno" }, 500);
  }
});

// ─── GET /email/contas ──────────────────────────────────────────────────────

const createImapSchema = z.object({
  email: z.string().email(),
  nome: z.string().optional(),
  imapHost: z.string().min(1),
  imapPort: z.number().int().default(993),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().default(587),
  imapUser: z.string().min(1),
  smtpUser: z.string().min(1),
  imapPass: z.string().min(1),
  smtpPass: z.string().min(1),
});

app.get("/email/contas", async (c) => {
  const ctx = await getCtx(c);

  const contas = await db
    .select({
      id: emailContas.id,
      tipo: emailContas.tipo,
      email: emailContas.email,
      nome: emailContas.nome,
      syncStatus: emailContas.syncStatus,
      syncMode: emailContas.syncMode,
      syncFiltroLabel: emailContas.syncFiltroLabel,
      backfillStatus: emailContas.backfillStatus,
      backfillProgress: emailContas.backfillProgress,
      lastSyncAt: emailContas.lastSyncAt,
      lastError: emailContas.lastError,
      isDefault: emailContas.isDefault,
      assinatura: emailContas.assinatura,
      envioComo: emailContas.envioComo,
      createdAt: emailContas.createdAt,
    })
    .from(emailContas)
    .where(eq(emailContas.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(emailContas.createdAt));

  return c.json(contas);
});

app.post("/email/contas", async (c) => {
  const ctx = await getCtx(c);

  try {
    const body = await c.req.json();
    const data = createImapSchema.parse(body);

    const [conta] = await db.insert(emailContas).values({
      organizacaoId: ctx.organizacaoId,
      usuarioId: ctx.userId,
      tipo: "imap",
      email: data.email,
      nome: data.nome || null,
      imapHost: data.imapHost,
      imapPort: data.imapPort,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      imapUser: encrypt(data.imapUser),
      smtpUser: encrypt(data.smtpUser),
      imapPass: encrypt(data.imapPass),
      smtpPass: encrypt(data.smtpPass),
      syncStatus: "active",
    }).returning();

    return c.json(conta, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    console.error("[Email Contas] Create error:", error);
    return c.json({ error: "Erro interno" }, 500);
  }
});

// ─── PATCH/DELETE /email/contas/:id ─────────────────────────────────────────

const contaUpdateSchema = z.object({
  nome: z.string().optional(),
  syncStatus: z.enum(["active", "paused"]).optional(),
  isDefault: z.boolean().optional(),
  syncMode: z.enum(["sync_all", "leads_only", "label"]).optional(),
  syncFiltroLabel: z.string().nullable().optional(),
  assinatura: z.string().nullable().optional(),
  envioComo: z.union([z.string().email(), z.literal("")]).nullable().optional(),
});

app.patch("/email/contas/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  try {
    const body = await c.req.json();
    const data = contaUpdateSchema.parse(body);

    if (data.isDefault) {
      await db.update(emailContas)
        .set({ isDefault: false })
        .where(eq(emailContas.organizacaoId, ctx.organizacaoId));
    }

    // Normalize empty string to null for envioComo
    const normalized = { ...data, envioComo: data.envioComo === "" ? null : data.envioComo };

    const [updated] = await db.update(emailContas)
      .set({ ...normalized, updatedAt: new Date() })
      .where(and(eq(emailContas.id, id), eq(emailContas.organizacaoId, ctx.organizacaoId)))
      .returning();

    if (!updated) return c.json({ error: "Conta não encontrada" }, 404);
    return c.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    return c.json({ error: "Erro interno" }, 500);
  }
});

app.delete("/email/contas/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [deleted] = await db.delete(emailContas)
    .where(and(eq(emailContas.id, id), eq(emailContas.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!deleted) return c.json({ error: "Conta não encontrada" }, 404);
  return c.json({ success: true });
});

// ─── POST /email/contas/:id/test ────────────────────────────────────────────

app.post("/email/contas/:id/test", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [conta] = await db.select()
    .from(emailContas)
    .where(and(eq(emailContas.id, id), eq(emailContas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!conta) return c.json({ error: "Conta não encontrada" }, 404);

  try {
    if (conta.tipo === "imap") {
      const imapResult = await testImapConnection({
        imapHost: conta.imapHost!,
        imapPort: conta.imapPort || 993,
        imapUser: conta.imapUser ? decrypt(conta.imapUser) : "",
        imapPass: conta.imapPass ? decrypt(conta.imapPass) : "",
      });

      const smtpResult = await testSmtpConnection({
        smtpHost: conta.smtpHost!,
        smtpPort: conta.smtpPort || 587,
        smtpUser: conta.smtpUser ? decrypt(conta.smtpUser) : "",
        smtpPass: conta.smtpPass ? decrypt(conta.smtpPass) : "",
      });

      const success = imapResult.success && smtpResult.success;
      await db.update(emailContas).set({
        syncStatus: success ? "active" : "error",
        lastError: success ? null : `IMAP: ${imapResult.error || "OK"}, SMTP: ${smtpResult.error || "OK"}`,
        updatedAt: new Date(),
      }).where(eq(emailContas.id, id));

      return c.json({ imap: imapResult, smtp: smtpResult, success });
    }

    const client = createEmailClient({
      id: conta.id,
      tipo: conta.tipo as "google" | "microsoft" | "imap",
      email: conta.email,
      accessToken: conta.accessToken,
      refreshToken: conta.refreshToken,
      tokenExpiry: conta.tokenExpiry,
    });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await client.fetchEmails(since);

    await db.update(emailContas).set({
      syncStatus: "active",
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(emailContas.id, id));

    return c.json({ success: true });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Connection test failed";
    await db.update(emailContas).set({
      syncStatus: "error",
      lastError: errorMsg,
      updatedAt: new Date(),
    }).where(eq(emailContas.id, id));

    return c.json({ success: false, error: errorMsg }, 400);
  }
});

// ─── POST /email/contas/:id/sync — manual sync now ─────────────────────────

app.post("/email/contas/:id/sync", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [conta] = await db.select({ id: emailContas.id, syncStatus: emailContas.syncStatus })
    .from(emailContas)
    .where(and(eq(emailContas.id, id), eq(emailContas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!conta) return c.json({ error: "Conta não encontrada" }, 404);

  const { Queue } = await import("bullmq");
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const url = new URL(redisUrl);
  const queue = new Queue("email-sync", {
    connection: {
      host: url.hostname,
      port: parseInt(url.port || "6379"),
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
      db: parseInt(url.pathname?.slice(1) || "0"),
      maxRetriesPerRequest: null as null,
    },
  });

  await queue.add("full-sync", { contaId: id }, {
    removeOnComplete: 5,
    removeOnFail: 5,
    jobId: `manual-sync-${id}-${Date.now()}`,
  });

  await queue.close();
  return c.json({ success: true, message: "Sync iniciado" });
});

// ─── POST /email/contas/:id/backfill ─────────────────────────────────────────

app.post("/email/contas/:id/backfill", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  try {
    const body = await c.req.json();
    const { sinceDate } = z.object({ sinceDate: z.string() }).parse(body);

    const [conta] = await db.select()
      .from(emailContas)
      .where(and(eq(emailContas.id, id), eq(emailContas.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!conta) return c.json({ error: "Conta não encontrada" }, 404);
    if (conta.backfillStatus === "running") return c.json({ error: "Backfill já em andamento" }, 409);

    // Queue backfill job via BullMQ
    const { Queue } = await import("bullmq");
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const url = new URL(redisUrl);
    const queue = new Queue("email-sync", {
      connection: {
        host: url.hostname,
        port: parseInt(url.port || "6379"),
        ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
        db: parseInt(url.pathname?.slice(1) || "0"),
        maxRetriesPerRequest: null as null,
      },
    });

    await queue.add("backfill", { contaId: id, sinceDate }, {
      removeOnComplete: 5,
      removeOnFail: 5,
      jobId: `backfill-${id}-${Date.now()}`,
    });

    await db.update(emailContas).set({
      backfillStatus: "running",
      backfillProgress: 0,
      updatedAt: new Date(),
    }).where(eq(emailContas.id, id));

    await queue.close();
    return c.json({ success: true, message: "Backfill iniciado" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    console.error("[Email] Backfill error:", error);
    return c.json({ error: "Erro interno" }, 500);
  }
});

// ─── POST /email/mark-all-read ──────────────────────────────────────────────

app.post("/email/mark-all-read", async (c) => {
  const ctx = await getCtx(c);

  const userContas = await db
    .select({ id: emailContas.id })
    .from(emailContas)
    .where(and(
      eq(emailContas.organizacaoId, ctx.organizacaoId),
      eq(emailContas.usuarioId, ctx.userId),
    ));

  if (userContas.length === 0) {
    return c.json({ success: true });
  }

  const userContaIds = userContas.map((cont) => cont.id);

  await db.update(emails)
    .set({ lido: true })
    .where(and(
      eq(emails.organizacaoId, ctx.organizacaoId),
      inArray(emails.contaId, userContaIds),
      eq(emails.lido, false),
    ));

  await db.update(leadUserUnread)
    .set({ emailNaoLidos: 0 })
    .where(and(
      eq(leadUserUnread.usuarioId, ctx.userId),
      sql`${leadUserUnread.emailNaoLidos} > 0`,
    ));

  await db.update(leads)
    .set({ emailNaoLidos: 0 })
    .where(and(eq(leads.organizacaoId, ctx.organizacaoId), sql`email_nao_lidos > 0`));

  return c.json({ success: true });
});

// ─── Email Templates ────────────────────────────────────────────────────────

const emailTemplateCreateSchema = z.object({
  nome: z.string().min(1).max(100),
  assunto: z.string().min(1),
  corpo: z.string().min(1),
  categoria: z.string().optional(),
});

const emailTemplateUpdateSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  assunto: z.string().min(1).optional(),
  corpo: z.string().min(1).optional(),
  categoria: z.string().nullable().optional(),
});

app.get("/email/templates", async (c) => {
  const ctx = await getCtx(c);

  const templates = await db.select()
    .from(emailTemplates)
    .where(eq(emailTemplates.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(emailTemplates.updatedAt));

  return c.json(templates);
});

app.post("/email/templates", async (c) => {
  const ctx = await getCtx(c);

  try {
    const body = await c.req.json();
    const data = emailTemplateCreateSchema.parse(body);

    const vars = extractVariables(data.assunto + " " + data.corpo);

    const [template] = await db.insert(emailTemplates).values({
      organizacaoId: ctx.organizacaoId,
      nome: data.nome,
      assunto: data.assunto,
      corpo: data.corpo,
      variaveis: vars,
      categoria: data.categoria || null,
    }).returning();

    return c.json(template, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    return c.json({ error: "Erro interno" }, 500);
  }
});

app.patch("/email/templates/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  try {
    const body = await c.req.json();
    const data = emailTemplateUpdateSchema.parse(body);

    const updates: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.assunto || data.corpo) {
      const [current] = await db.select({ assunto: emailTemplates.assunto, corpo: emailTemplates.corpo })
        .from(emailTemplates)
        .where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizacaoId, ctx.organizacaoId)))
        .limit(1);
      if (current) {
        const newAssunto = data.assunto || current.assunto;
        const newCorpo = data.corpo || current.corpo;
        updates.variaveis = extractVariables(newAssunto + " " + newCorpo);
      }
    }

    const [updated] = await db.update(emailTemplates)
      .set(updates)
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizacaoId, ctx.organizacaoId)))
      .returning();

    if (!updated) return c.json({ error: "Template não encontrado" }, 404);
    return c.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    return c.json({ error: "Erro interno" }, 500);
  }
});

app.delete("/email/templates/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [deleted] = await db.delete(emailTemplates)
    .where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!deleted) return c.json({ error: "Template não encontrado" }, 404);
  return c.json({ success: true });
});

// ─── Email Sequences ────────────────────────────────────────────────────────

const passoSchema = z.object({
  ordem: z.number().int().min(0),
  tipo: z.enum(["email", "espera", "condicao"]),
  templateId: z.string().uuid().optional(),
  delayMinutos: z.number().int().min(0).default(0),
  condicao: z.record(z.string(), z.unknown()).optional(),
});

const sequenciaCreateSchema = z.object({
  nome: z.string().min(1).max(100),
  descricao: z.string().optional(),
  gatilho: z.enum(["manual", "novo_lead", "mudanca_status"]).default("manual"),
  gatilhoConfig: z.record(z.string(), z.unknown()).optional(),
  passos: z.array(passoSchema).min(1),
});

const sequenciaUpdateSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  descricao: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
  gatilho: z.enum(["manual", "novo_lead", "mudanca_status"]).optional(),
  gatilhoConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  passos: z.array(passoSchema).optional(),
});

app.get("/email/sequencias", async (c) => {
  const ctx = await getCtx(c);

  const sequencias = await db.select()
    .from(emailSequencias)
    .where(eq(emailSequencias.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(emailSequencias.updatedAt));

  const result = await Promise.all(
    sequencias.map(async (seq) => {
      const passos = await db.select()
        .from(emailSequenciaPassos)
        .where(eq(emailSequenciaPassos.sequenciaId, seq.id))
        .orderBy(emailSequenciaPassos.ordem);
      return { ...seq, passos };
    })
  );

  return c.json(result);
});

app.post("/email/sequencias", async (c) => {
  const ctx = await getCtx(c);

  try {
    const body = await c.req.json();
    const data = sequenciaCreateSchema.parse(body);

    const [sequencia] = await db.insert(emailSequencias).values({
      organizacaoId: ctx.organizacaoId,
      nome: data.nome,
      descricao: data.descricao || null,
      gatilho: data.gatilho,
      gatilhoConfig: data.gatilhoConfig || null,
    }).returning();

    for (const passo of data.passos) {
      await db.insert(emailSequenciaPassos).values({
        sequenciaId: sequencia.id,
        ordem: passo.ordem,
        tipo: passo.tipo,
        templateId: passo.templateId || null,
        delayMinutos: passo.delayMinutos,
        condicao: passo.condicao || null,
      });
    }

    const passos = await db.select()
      .from(emailSequenciaPassos)
      .where(eq(emailSequenciaPassos.sequenciaId, sequencia.id))
      .orderBy(emailSequenciaPassos.ordem);

    return c.json({ ...sequencia, passos }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    console.error("[Sequencias] Create error:", error);
    return c.json({ error: "Erro interno" }, 500);
  }
});

// ─── PATCH/DELETE /email/sequencias/:id ─────────────────────────────────────

app.patch("/email/sequencias/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  try {
    const body = await c.req.json();
    const data = sequenciaUpdateSchema.parse(body);

    const { passos, ...seqData } = data;

    const [updated] = await db.update(emailSequencias)
      .set({ ...seqData, updatedAt: new Date() })
      .where(and(eq(emailSequencias.id, id), eq(emailSequencias.organizacaoId, ctx.organizacaoId)))
      .returning();

    if (!updated) return c.json({ error: "Sequência não encontrada" }, 404);

    if (passos) {
      await db.delete(emailSequenciaPassos).where(eq(emailSequenciaPassos.sequenciaId, id));
      for (const passo of passos) {
        await db.insert(emailSequenciaPassos).values({
          sequenciaId: id,
          ordem: passo.ordem,
          tipo: passo.tipo,
          templateId: passo.templateId || null,
          delayMinutos: passo.delayMinutos,
          condicao: passo.condicao || null,
        });
      }
    }

    const updatedPassos = await db.select()
      .from(emailSequenciaPassos)
      .where(eq(emailSequenciaPassos.sequenciaId, id))
      .orderBy(emailSequenciaPassos.ordem);

    return c.json({ ...updated, passos: updatedPassos });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    return c.json({ error: "Erro interno" }, 500);
  }
});

app.delete("/email/sequencias/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [deleted] = await db.delete(emailSequencias)
    .where(and(eq(emailSequencias.id, id), eq(emailSequencias.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!deleted) return c.json({ error: "Sequência não encontrada" }, 404);
  return c.json({ success: true });
});

// ─── POST /email/sequencias/:id/executar ────────────────────────────────────

const executeSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1),
  contaId: z.string().uuid(),
});

app.post("/email/sequencias/:id/executar", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  try {
    const body = await c.req.json();
    const data = executeSchema.parse(body);

    const [sequencia] = await db.select()
      .from(emailSequencias)
      .where(and(eq(emailSequencias.id, id), eq(emailSequencias.organizacaoId, ctx.organizacaoId), eq(emailSequencias.ativo, true)))
      .limit(1);
    if (!sequencia) return c.json({ error: "Sequência não encontrada ou inativa" }, 404);

    const [conta] = await db.select({ id: emailContas.id })
      .from(emailContas)
      .where(and(eq(emailContas.id, data.contaId), eq(emailContas.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!conta) return c.json({ error: "Conta não encontrada" }, 404);

    const [firstStep] = await db.select()
      .from(emailSequenciaPassos)
      .where(eq(emailSequenciaPassos.sequenciaId, id))
      .orderBy(emailSequenciaPassos.ordem)
      .limit(1);

    const now = new Date();
    const delayMs = (firstStep?.delayMinutos || 0) * 60 * 1000;
    const nextExecution = new Date(now.getTime() + delayMs);

    const execucoes = [];
    for (const leadId of data.leadIds) {
      const [lead] = await db.select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
        .limit(1);
      if (!lead) continue;

      const [exec] = await db.insert(emailSequenciaExecucoes).values({
        sequenciaId: id,
        leadId,
        contaId: data.contaId,
        passoAtual: 0,
        status: "ativo",
        proximaExecucaoAt: nextExecution,
        iniciadoAt: now,
      }).returning();

      execucoes.push(exec);
    }

    return c.json({ execucoes, count: execucoes.length }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    return c.json({ error: "Erro interno" }, 500);
  }
});

// ─── PATCH /email/sequencias/execucoes/:id ──────────────────────────────────

const execUpdateSchema = z.object({
  action: z.enum(["pausar", "retomar", "cancelar"]),
});

app.patch("/email/sequencias/execucoes/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  try {
    const body = await c.req.json();
    const { action } = execUpdateSchema.parse(body);

    const statusMap = {
      pausar: "pausado",
      retomar: "ativo",
      cancelar: "cancelado",
    };

    const updates: Record<string, unknown> = { status: statusMap[action] };
    if (action === "cancelar") updates.concluidoAt = new Date();

    const [updated] = await db.update(emailSequenciaExecucoes)
      .set(updates)
      .where(eq(emailSequenciaExecucoes.id, id))
      .returning();

    if (!updated) return c.json({ error: "Execução não encontrada" }, 404);
    return c.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    return c.json({ error: "Erro interno" }, 500);
  }
});

// ─── GET /email/thread/:threadId ────────────────────────────────────────────

app.get("/email/thread/:threadId", async (c) => {
  const ctx = await getCtx(c);
  const threadId = c.req.param("threadId");

  const threadEmails = await db.select()
    .from(emails)
    .where(and(eq(emails.threadId, threadId), eq(emails.organizacaoId, ctx.organizacaoId)))
    .orderBy(asc(emails.createdAt));

  return c.json({ emails: threadEmails });
});

// ─── OAuth: Google ──────────────────────────────────────────────────────────

app.get("/email/auth/google", async (c) => {
  const ctx = await getCtx(c);

  const state = encrypt(JSON.stringify({
    organizacaoId: ctx.organizacaoId,
    userId: ctx.userId,
  }));

  const url = getGoogleAuthUrl(state);
  return c.redirect(url);
});

app.get("/email/auth/google/callback", async (c) => {
  const code = c.req.query("code") ?? null;
  const stateParam = c.req.query("state") ?? null;

  if (!code || !stateParam) {
    return c.redirect(`${process.env.NEXTAUTH_URL}/configuracoes/email?error=missing_params`);
  }

  try {
    const state = JSON.parse(decrypt(stateParam));
    const { organizacaoId, userId } = state;

    const tokens = await exchangeGoogleCode(code);

    await db.insert(emailContas).values({
      organizacaoId,
      usuarioId: userId,
      tipo: "google",
      email: tokens.email,
      nome: tokens.name,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      tokenExpiry: tokens.expiryDate,
      syncStatus: "active",
    });

    return c.redirect(`${process.env.NEXTAUTH_URL}/configuracoes/email?success=google`);
  } catch (error) {
    console.error("[Google OAuth] Callback error:", error);
    return c.redirect(`${process.env.NEXTAUTH_URL}/configuracoes/email?error=oauth_failed`);
  }
});

// ─── OAuth: Microsoft ───────────────────────────────────────────────────────

app.get("/email/auth/microsoft", async (c) => {
  const ctx = await getCtx(c);

  const state = encrypt(JSON.stringify({
    organizacaoId: ctx.organizacaoId,
    userId: ctx.userId,
  }));

  const url = getMicrosoftAuthUrl(state);
  return c.redirect(url);
});

app.get("/email/auth/microsoft/callback", async (c) => {
  const code = c.req.query("code") ?? null;
  const stateParam = c.req.query("state") ?? null;

  if (!code || !stateParam) {
    return c.redirect(`${process.env.NEXTAUTH_URL}/configuracoes/email?error=missing_params`);
  }

  try {
    const state = JSON.parse(decrypt(stateParam));
    const { organizacaoId, userId } = state;

    const tokens = await exchangeMicrosoftCode(code);

    await db.insert(emailContas).values({
      organizacaoId,
      usuarioId: userId,
      tipo: "microsoft",
      email: tokens.email,
      nome: tokens.name,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      tokenExpiry: tokens.expiryDate,
      syncStatus: "active",
    });

    return c.redirect(`${process.env.NEXTAUTH_URL}/configuracoes/email?success=microsoft`);
  } catch (error) {
    console.error("[Microsoft OAuth] Callback error:", error);
    return c.redirect(`${process.env.NEXTAUTH_URL}/configuracoes/email?error=oauth_failed`);
  }
});

// ─── GET /email/:id ─────────────────────────────────────────────────────────
// NOTE: Must be AFTER all specific /email/* routes to avoid matching "contas", "templates" etc as :id

app.get("/email/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [email] = await db.select()
    .from(emails)
    .where(and(eq(emails.id, id), eq(emails.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!email) return c.json({ error: "Email não encontrado" }, 404);
  return c.json(email);
});

// ─── PATCH /email/:id ───────────────────────────────────────────────────────

const emailUpdateSchema = z.object({
  lido: z.boolean().optional(),
  leadId: z.string().uuid().nullable().optional(),
});

app.patch("/email/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  try {
    const body = await c.req.json();
    const data = emailUpdateSchema.parse(body);

    const [updated] = await db.update(emails)
      .set(data)
      .where(and(eq(emails.id, id), eq(emails.organizacaoId, ctx.organizacaoId)))
      .returning();

    if (!updated) return c.json({ error: "Email não encontrado" }, 404);

    if (data.lido !== undefined && updated.leadId) {
      if (data.lido) {
        await db.update(leads).set({
          emailNaoLidos: sql`GREATEST(COALESCE(email_nao_lidos, 0) - 1, 0)`,
        }).where(eq(leads.id, updated.leadId));
      } else {
        await db.update(leads).set({
          emailNaoLidos: sql`COALESCE(email_nao_lidos, 0) + 1`,
        }).where(eq(leads.id, updated.leadId));
      }

      if (data.lido) {
        await db.execute(sql`
          INSERT INTO lead_user_unread (id, lead_id, usuario_id, whatsapp_nao_lidas, email_nao_lidos)
          VALUES (gen_random_uuid(), ${updated.leadId}, ${ctx.userId}, 0, 0)
          ON CONFLICT (lead_id, usuario_id)
          DO UPDATE SET email_nao_lidos = GREATEST(lead_user_unread.email_nao_lidos - 1, 0)
        `);
      } else {
        await db.execute(sql`
          INSERT INTO lead_user_unread (id, lead_id, usuario_id, whatsapp_nao_lidas, email_nao_lidos)
          VALUES (gen_random_uuid(), ${updated.leadId}, ${ctx.userId}, 0, 1)
          ON CONFLICT (lead_id, usuario_id)
          DO UPDATE SET email_nao_lidos = lead_user_unread.email_nao_lidos + 1
        `);
      }
    }

    return c.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    return c.json({ error: "Erro interno" }, 500);
  }
});

export const emailRoutes = app;
