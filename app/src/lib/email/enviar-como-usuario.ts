/**
 * E-mail que sai da CAIXA do usuário que clicou em enviar (Microsoft/Outlook,
 * Google ou IMAP), com o registro em `emails` igual ao do botão Enviar do
 * e-mail. Quem chama decide o que fazer quando o usuário não tem caixa
 * conectada (`null`): a proposta cai no Resend, sem travar o fluxo.
 */
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailContas, emails } from "@/lib/db/schema";
import { createEmailClient } from "./factory";
import type { EmailContaConfig } from "./types";

export type EnvioPelaConta =
  | { enviado: true; de: string; contaId: string }
  | { enviado: false; erro: string; de: string };

/** Ordem de preferência: Outlook (o padrão da Callface), Google, IMAP. */
const PREFERENCIA = sql`CASE tipo WHEN 'microsoft' THEN 0 WHEN 'google' THEN 1 ELSE 2 END`;

/** `null` = o usuário não tem caixa conectada (sem erro). */
export async function enviarPelaCaixaDoUsuario(p: {
  organizacaoId: string; userId: string; para: string; assunto: string; html: string; leadId?: string | null;
}): Promise<EnvioPelaConta | null> {
  const [conta] = await db.select().from(emailContas)
    .where(and(eq(emailContas.organizacaoId, p.organizacaoId), eq(emailContas.usuarioId, p.userId), ne(emailContas.syncStatus, "error")))
    .orderBy(PREFERENCIA, asc(emailContas.createdAt)).limit(1);
  if (!conta) return null;

  const config: EmailContaConfig = {
    id: conta.id, tipo: conta.tipo as EmailContaConfig["tipo"], email: conta.email,
    accessToken: conta.accessToken, refreshToken: conta.refreshToken, tokenExpiry: conta.tokenExpiry,
    imapHost: conta.imapHost, imapPort: conta.imapPort, smtpHost: conta.smtpHost, smtpPort: conta.smtpPort,
    imapUser: conta.imapUser, smtpUser: conta.smtpUser, imapPass: conta.imapPass, smtpPass: conta.smtpPass,
  };
  const de = conta.envioComo || conta.email;
  const corpoTexto = p.html.replace(/<[^>]*>/g, "");
  const [registro] = await db.insert(emails).values({
    organizacaoId: p.organizacaoId, leadId: p.leadId ?? null, contaId: conta.id, de, para: p.para,
    assunto: p.assunto, corpo: p.html, corpoTexto, direcao: "out", status: "queued", lido: true, enviadoPorId: p.userId,
  }).returning({ id: emails.id });
  try {
    // A trava de destino do ambiente vale dentro de cada client (`garantirDestinoPermitido`).
    const r = await createEmailClient(config).sendEmail({
      to: p.para, subject: p.assunto, html: p.html, text: corpoTexto, fromAlias: conta.envioComo || undefined,
    });
    await db.update(emails).set({ status: "sent", providerMessageId: r.messageId || null, threadId: r.threadId || null })
      .where(eq(emails.id, registro.id));
    return { enviado: true, de, contaId: conta.id };
  } catch (e) {
    await db.update(emails).set({ status: "failed" }).where(eq(emails.id, registro.id));
    return { enviado: false, erro: e instanceof Error ? e.message : String(e), de };
  }
}
