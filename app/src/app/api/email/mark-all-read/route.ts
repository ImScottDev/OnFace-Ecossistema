import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emails, leads, emailContas, leadUserUnread } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// POST /api/email/mark-all-read — mark all emails as read for the current user's accounts
export async function POST() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  // Get current user's email account IDs
  const userContas = await db
    .select({ id: emailContas.id })
    .from(emailContas)
    .where(and(
      eq(emailContas.organizacaoId, ctx.organizacaoId),
      eq(emailContas.usuarioId, ctx.userId),
    ));

  if (userContas.length === 0) {
    return NextResponse.json({ success: true });
  }

  const userContaIds = userContas.map((c) => c.id);

  // Mark unread emails from user's accounts as read
  await db.update(emails)
    .set({ lido: true })
    .where(and(
      eq(emails.organizacaoId, ctx.organizacaoId),
      inArray(emails.contaId, userContaIds),
      eq(emails.lido, false),
    ));

  // Reset per-user email unread counts
  await db.update(leadUserUnread)
    .set({ emailNaoLidos: 0 })
    .where(and(
      eq(leadUserUnread.usuarioId, ctx.userId),
      sql`${leadUserUnread.emailNaoLidos} > 0`,
    ));

  // Also update legacy leads.emailNaoLidos (backward compat)
  await db.update(leads)
    .set({ emailNaoLidos: 0 })
    .where(and(eq(leads.organizacaoId, ctx.organizacaoId), sql`email_nao_lidos > 0`));

  return NextResponse.json({ success: true });
}
