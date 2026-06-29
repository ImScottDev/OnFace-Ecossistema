import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emails, leads, emailContas } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { createEmailClient } from "@/lib/email/factory";
import type { EmailContaConfig } from "@/lib/email/types";

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
});

// POST /api/email/send — send email via connected account
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = sendSchema.parse(body);

    // Get account
    const [conta] = await db.select()
      .from(emailContas)
      .where(and(eq(emailContas.id, data.contaId), eq(emailContas.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!conta) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

    // If leadId provided, verify it belongs to org
    if (data.leadId) {
      const [lead] = await db.select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, data.leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
        .limit(1);
      if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    }

    // Try to auto-match lead by email if not provided
    let matchedLeadId = data.leadId || null;
    if (!matchedLeadId) {
      const recipientEmail = data.para.split(",")[0].trim();
      const [matched] = await db.select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.email, recipientEmail), eq(leads.organizacaoId, ctx.organizacaoId)))
        .limit(1);
      if (matched) matchedLeadId = matched.id;
    }

    // Create email record (status: queued)
    const corpoTexto = data.corpo.replace(/<[^>]*>/g, "");
    const [emailRecord] = await db.insert(emails).values({
      organizacaoId: ctx.organizacaoId,
      leadId: matchedLeadId,
      contaId: conta.id,
      de: conta.email,
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

    // Send via provider
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
      });

      // Update email record with sent status
      await db.update(emails).set({
        status: "sent",
        providerMessageId: result.messageId || null,
        threadId: result.threadId || data.threadId || null,
      }).where(eq(emails.id, emailRecord.id));

      // Update lead email tracking
      if (matchedLeadId) {
        await db.update(leads).set({
          emailUltimoAssunto: data.assunto,
          emailUltimaMsgAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(leads.id, matchedLeadId));
      }

      return NextResponse.json({ ...emailRecord, status: "sent" }, { status: 201 });
    } catch (sendError) {
      console.error("[Email Send] Failed:", sendError);
      await db.update(emails).set({ status: "failed" }).where(eq(emails.id, emailRecord.id));
      return NextResponse.json({ error: "Falha ao enviar email", details: sendError instanceof Error ? sendError.message : "Unknown" }, { status: 500 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    console.error("[Email Send] Error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
