import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emails, leads, emailContas, leadUserUnread, usuarios } from "@/lib/db/schema";
import { eq, desc, and, sql, ilike, or, isNull, inArray } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// GET /api/email — list email conversations grouped by lead (for inbox page)
// Also supports ?leadId=... for lead detail panel (backwards compatible)
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const leadId = request.nextUrl.searchParams.get("leadId");
  const lido = request.nextUrl.searchParams.get("lido");
  const search = request.nextUrl.searchParams.get("search");
  const viewAs = request.nextUrl.searchParams.get("viewAs");
  const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
  const limit = 50;
  const offset = (page - 1) * limit;

  // Determine effective userId: admin/super_admin can use viewAs
  let effectiveUserId = ctx.userId;
  let readOnly = false;
  if (viewAs && viewAs !== ctx.userId) {
    if (ctx.userRole === "admin" || ctx.userRole === "super_admin") {
      effectiveUserId = viewAs;
      readOnly = true;
    }
    // Non-admin users: silently ignore viewAs
  }

  // If leadId is provided, return ALL emails for that lead (unified lead history)
  if (leadId) {
    const [lead] = await db.select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

    // JOIN emailContas → usuarios to add attribution
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

    return NextResponse.json({ emails: emailList });
  }

  // Inbox mode: per-user filtering based on connected email accounts
  // Get effective user's email account IDs
  const userContas = await db
    .select({ id: emailContas.id, email: emailContas.email, tipo: emailContas.tipo })
    .from(emailContas)
    .where(and(
      eq(emailContas.organizacaoId, ctx.organizacaoId),
      eq(emailContas.usuarioId, effectiveUserId),
    ));

  // If user has no email accounts, return empty results
  if (userContas.length === 0) {
    return NextResponse.json({
      conversations: [],
      contas: [],
      unmatchedCount: 0,
      page,
      ...(readOnly ? { readOnly: true } : {}),
    });
  }

  const userContaIds = userContas.map((c) => c.id);

  // Get lead IDs that have emails from this user's accounts
  const leadsWithEmails = await db
    .selectDistinct({ leadId: emails.leadId })
    .from(emails)
    .where(and(
      eq(emails.organizacaoId, ctx.organizacaoId),
      inArray(emails.contaId, userContaIds),
      sql`${emails.leadId} IS NOT NULL`,
    ));

  const relevantLeadIds = leadsWithEmails.map((r) => r.leadId!).filter(Boolean);

  if (relevantLeadIds.length === 0 && lido !== "false" && !search) {
    // No leads with emails from user's accounts — still check unmatched
    let unmatchedCount = 0;
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(emails)
      .where(and(
        eq(emails.organizacaoId, ctx.organizacaoId),
        inArray(emails.contaId, userContaIds),
        isNull(emails.leadId),
      ));
    unmatchedCount = result?.count || 0;

    return NextResponse.json({
      conversations: [],
      contas: userContas,
      unmatchedCount,
      page,
      ...(readOnly ? { readOnly: true } : {}),
    });
  }

  // Build conditions for conversation list
  const conditions = [
    eq(leads.organizacaoId, ctx.organizacaoId),
  ];

  if (relevantLeadIds.length > 0) {
    conditions.push(inArray(leads.id, relevantLeadIds));
  }

  if (lido === "false") {
    // Use per-user unread count from leadUserUnread
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM lead_user_unread
        WHERE lead_user_unread.lead_id = ${leads.id}
          AND lead_user_unread.usuario_id = ${effectiveUserId}
          AND lead_user_unread.email_nao_lidos > 0
      )`
    );
  }

  if (search) {
    conditions.push(
      or(
        ilike(leads.nome, `%${search}%`),
        ilike(leads.email, `%${search}%`),
        ilike(leads.emailUltimoAssunto, `%${search}%`),
      )!
    );
  }

  // Get leads with email conversations, using per-user unread counts
  const conversations = await db
    .select({
      leadId: leads.id,
      nome: leads.nome,
      email: leads.email,
      tipo: leads.tipo,
      empresa: leads.empresa,
      emailNaoLidos: sql<number>`COALESCE((
        SELECT email_nao_lidos FROM lead_user_unread
        WHERE lead_user_unread.lead_id = ${leads.id}
          AND lead_user_unread.usuario_id = ${effectiveUserId}
      ), 0)`,
      emailUltimoAssunto: leads.emailUltimoAssunto,
      emailUltimaMsgAt: leads.emailUltimaMsgAt,
    })
    .from(leads)
    .where(and(...conditions, sql`${leads.emailUltimaMsgAt} IS NOT NULL`))
    .orderBy(desc(leads.emailUltimaMsgAt))
    .limit(limit)
    .offset(offset);

  // Count unmatched emails (leadId = null) — only from user's accounts
  let unmatchedCount = 0;
  if (!lido && !search) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(emails)
      .where(and(
        eq(emails.organizacaoId, ctx.organizacaoId),
        inArray(emails.contaId, userContaIds),
        isNull(emails.leadId),
      ));
    unmatchedCount = result?.count || 0;
  }

  return NextResponse.json({
    conversations,
    contas: userContas,
    unmatchedCount,
    page,
    ...(readOnly ? { readOnly: true } : {}),
  });
}
