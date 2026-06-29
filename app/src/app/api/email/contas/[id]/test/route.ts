import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailContas } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { createEmailClient } from "@/lib/email/factory";
import { decrypt } from "@/lib/email/encryption";
import { testImapConnection, testSmtpConnection } from "@/lib/email/imap";

// POST /api/email/contas/:id/test — test connection
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  const [conta] = await db.select()
    .from(emailContas)
    .where(and(eq(emailContas.id, id), eq(emailContas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!conta) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

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

      return NextResponse.json({ imap: imapResult, smtp: smtpResult, success });
    }

    // For OAuth (Google/Microsoft), try fetching recent emails
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

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Connection test failed";
    await db.update(emailContas).set({
      syncStatus: "error",
      lastError: errorMsg,
      updatedAt: new Date(),
    }).where(eq(emailContas.id, id));

    return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
  }
}
