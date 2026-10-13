import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { atividades, contratos } from "@/lib/db/schema";
import { type ResendResult } from "@/lib/email/resend";
import { enviarResendRegistrado } from "@/lib/email/entrega";

export type ContratoEmailDelivery = {
  status: "sent" | "failed" | "skipped";
  recipients: string[];
  attempts: number;
  resendId?: string;
  error?: string;
  reason?: string;
  lastAttemptAt: string;
  sentAt?: string;
};

type Signatario = { email?: unknown; papel?: unknown; role?: unknown };

const sha256 = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");

function recipientsFromSigners(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is Signatario => Boolean(item && typeof item === "object"))
    .filter((item) => !["cc", "viewer", "observador"].includes(String(item.role ?? item.papel ?? "").toLowerCase()))
    .map((item) => String(item.email || "").trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))];
}

function currentAttempts(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const attempts = (value as { attempts?: unknown }).attempts;
  return typeof attempts === "number" && Number.isFinite(attempts) ? attempts : 0;
}

export async function enviarEmailFinalContrato(params: {
  contrato: Pick<typeof contratos.$inferSelect, "id" | "organizacaoId" | "leadId" | "negocioId" | "signatarios" | "emailEntrega">;
  baseUrl: string;
  providerDocumentUrl?: string | null;
  force?: boolean;
}): Promise<ContratoEmailDelivery> {
  const existing = params.contrato.emailEntrega;
  if (!params.force && existing && typeof existing === "object" && (existing as { status?: string }).status === "sent") {
    return existing as ContratoEmailDelivery;
  }

  const recipients = recipientsFromSigners(params.contrato.signatarios);
  const previousAttempts = currentAttempts(existing);
  const attemptedAt = new Date();
  const publicToken = recipients.length > 0 ? crypto.randomBytes(32).toString("hex") : null;
  const finalUrl = publicToken
    ? `${params.baseUrl}/api/contratos-publicos/${publicToken}/pdf-final`
    : `${params.baseUrl}/api/contratos/${params.contrato.id}/pdf-final`;

  let result: ResendResult;
  if (recipients.length === 0) {
    result = { sent: false, skipped: true };
  } else {
    result = await enviarResendRegistrado({
      to: recipients,
      subject: "Contrato Callface concluído",
      html: `<p>O contrato foi concluído por todos os signatários.</p><p><a href="${finalUrl}">Acessar o documento final</a></p>`,
    }, { organizacaoId: params.contrato.organizacaoId, leadId: params.contrato.leadId, origem: { tipo: "contrato", id: params.contrato.id } });
  }

  const delivery: ContratoEmailDelivery = {
    status: result.sent ? "sent" : result.skipped ? "skipped" : "failed",
    recipients,
    attempts: previousAttempts + 1,
    ...(result.id ? { resendId: result.id } : {}),
    ...(result.error ? { error: result.error } : {}),
    ...(result.skipped ? { reason: "resend_not_configured_or_no_recipients" } : {}),
    lastAttemptAt: attemptedAt.toISOString(),
    ...(result.sent ? { sentAt: attemptedAt.toISOString() } : {}),
  };

  await db.update(contratos).set({
    emailEntrega: delivery,
    ...(publicToken ? {
      documentoPublicoTokenHash: sha256(publicToken),
      documentoPublicoExpiraEm: new Date(attemptedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
    } : {}),
    updatedAt: attemptedAt,
  })
    .where(eq(contratos.id, params.contrato.id));

  await db.insert(atividades).values({
    organizacaoId: params.contrato.organizacaoId,
    leadId: params.contrato.leadId,
    negocioId: params.contrato.negocioId,
    tipo: "contrato_email",
    titulo: result.sent ? "Cópia final do contrato entregue ao provedor de e-mail" : result.skipped ? "Cópia final do contrato pendente" : "Falha ao enviar cópia final do contrato",
    descricao: result.sent ? `Destinatários: ${recipients.join(", ")}` : result.error || "Resend não configurado ou não há signatários com e-mail.",
    dados: { contratoId: params.contrato.id, providerDocumentUrl: params.providerDocumentUrl || null, entrega: delivery },
    timelineVisible: true,
  });

  return delivery;
}
