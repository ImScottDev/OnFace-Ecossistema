import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { contratos } from "@/lib/db/schema";
import { publicarEvento } from "@/lib/events/outbox";
import { enviarEmailFinalContrato } from "@/lib/crm/contrato-email-final";
import { processarContratoAssinado } from "@/lib/crm/pos-assinatura";

type Recipient = {
  email?: string;
  name?: string;
  signedAt?: string | null;
  signingStatus?: string;
  readStatus?: string;
  role?: string;
  rejectionReason?: string | null;
};

type DocumensoPayload = {
  event?: string;
  createdAt?: string;
  payload?: {
    id?: number | string;
    envelopeId?: string;
    externalId?: string | null;
    status?: string;
    completedAt?: string | null;
    recipients?: Recipient[];
    documentUrl?: string | null;
    downloadUrl?: string | null;
    signedDocumentUrl?: string | null;
  };
};

function recipientNames(recipients: Recipient[] | undefined): string {
  return (recipients || []).filter((r) => r.role !== "CC" && r.role !== "VIEWER" && r.name).map((r) => r.name!.trim()).join(", ");
}

function finalDocumentUrl(contractId: string, payload: DocumensoPayload["payload"]): string {
  const providerUrl = payload?.signedDocumentUrl || payload?.downloadUrl || payload?.documentUrl;
  // O link interno continua sendo a fonte oficial, mesmo quando o provider
  // muda ou quando a URL externa expira. A URL do provider fica só no evento.
  return `/api/contratos/${contractId}/pdf-final${providerUrl ? `?providerUrl=${encodeURIComponent(providerUrl)}` : ""}`;
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.DOCUMENSO_WEBHOOK_SECRET;
  const receivedSecret = request.headers.get("x-documenso-secret");
  // Sem segredo, a integração não está pronta. 503 mantém o contrato de
  // indisponibilidade temporária e permite retentativa do provedor.
  if (!configuredSecret) return NextResponse.json({ error: "webhook secret not configured" }, { status: 503 });
  if (!receivedSecret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const recebido = Buffer.from(receivedSecret);
  const esperado = Buffer.from(configuredSecret);
  if (recebido.length !== esperado.length || !crypto.timingSafeEqual(recebido, esperado)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: DocumensoPayload;
  try {
    body = JSON.parse(await request.text()) as DocumensoPayload;
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const event = String(body.event || "").trim().toUpperCase().replace(/[.-]/g, "_");
  const payload = body.payload;
  const providerRef = payload?.envelopeId
    || (typeof payload?.id === "string" && payload.id.startsWith("envelope_") ? payload.id : undefined);
  const externalContractId = payload?.externalId?.replace(/^callface-contrato-/, "") || undefined;
  if (!providerRef && !externalContractId) {
    return NextResponse.json({ received: true, ignored: "missing envelope and external ids" });
  }

  const [contract] = await db.select().from(contratos).where(
    providerRef
      ? eq(contratos.signatureProviderRef, providerRef)
      : eq(contratos.id, externalContractId!),
  ).limit(1);
  if (!contract) return NextResponse.json({ received: true, unresolved: true }, { status: 202 });

  const recipients = payload?.recipients || [];
  const resolvedProviderRef = providerRef || contract.signatureProviderRef || externalContractId!;
  const eventKey = `documenso:${event}:${resolvedProviderRef}:${body.createdAt || payload?.completedAt || "event"}`;
  const commonPayload = { provider: "documenso", providerRef: resolvedProviderRef, event, recipients, raw: body };

  if (event === "DOCUMENT_OPENED") {
    await db.update(contratos).set({ signatureStatus: "opened", updatedAt: new Date() }).where(and(eq(contratos.id, contract.id), ne(contratos.signatureStatus, "signed")));
    await publicarEvento({ organizacaoId: contract.organizacaoId, eventType: "SignerViewed", aggregateType: "contrato", aggregateId: contract.id, payload: commonPayload, idempotencyKey: eventKey });
  } else if (event === "DOCUMENT_SIGNED" || event === "DOCUMENT_RECIPIENT_COMPLETED") {
    const allSigners = recipients.filter((r) => r.role !== "CC" && r.role !== "VIEWER");
    const signedCount = allSigners.filter((r) => r.signingStatus === "SIGNED" || r.signedAt).length;
    const status = signedCount > 0 ? (signedCount >= allSigners.length && allSigners.length > 0 ? "signed" : "partially_signed") : "opened";
    await db.update(contratos).set({ signatureStatus: status, signatarios: recipients, updatedAt: new Date() }).where(and(eq(contratos.id, contract.id), ne(contratos.signatureStatus, "signed")));
    await publicarEvento({ organizacaoId: contract.organizacaoId, eventType: "SignerSigned", aggregateType: "contrato", aggregateId: contract.id, payload: commonPayload, idempotencyKey: eventKey });
  } else if (event === "DOCUMENT_COMPLETED") {
    // A atualização condicional transforma o retry do webhook em no-op real:
    // apenas a primeira entrega pode liberar evidência/checkout.
    const [claimed] = await db.update(contratos).set({
      status: "ativo",
      assinaturaStatus: "assinado",
      signatureStatus: "signed",
      assinadoEm: payload?.completedAt ? new Date(payload.completedAt) : new Date(),
      assinadoNome: recipientNames(recipients) || null,
      signatarios: recipients,
      documentoFinalUrl: finalDocumentUrl(contract.id, payload || {}),
      updatedAt: new Date(),
    }).where(and(eq(contratos.id, contract.id), ne(contratos.assinaturaStatus, "assinado"))).returning({ id: contratos.id });
    if (!claimed) return NextResponse.json({ received: true, duplicate: true });

    await publicarEvento({ organizacaoId: contract.organizacaoId, eventType: "ContractCompleted", aggregateType: "contrato", aggregateId: contract.id, payload: commonPayload, idempotencyKey: `contract-completed:${contract.id}` });
    await publicarEvento({ organizacaoId: contract.organizacaoId, eventType: "FinalDocumentGenerated", aggregateType: "contrato", aggregateId: contract.id, payload: { ...commonPayload, documentoFinalUrl: finalDocumentUrl(contract.id, payload || {}) }, idempotencyKey: `contract-final-document:${contract.id}` });
    // Frente 2C.1 — motor único das consequências da assinatura, o MESMO
    // usado pela assinatura eletrônica simples (lib/crm/pos-assinatura.ts).
    // Antes daqui esse bloco era uma cópia divergente que nunca marcava ganho:
    // PABX/White Label ficavam presos esperando pagamento pra virar cliente.
    // `contract` é a linha ANTES do update — relê pra passar o estado assinado.
    const [contratoAssinado] = await db.select().from(contratos).where(eq(contratos.id, contract.id)).limit(1);
    const resultado = await processarContratoAssinado({
      contrato: contratoAssinado ?? contract,
      provider: "documenso",
      metadata: { recipients },
    });
    console.log(`[DocumensoWebhook] contrato ${contract.id} assinado — familia=${resultado.familia} ganho=${resultado.ganhoLiberado} entrega=${resultado.entregaLiberada} pendencia=${resultado.pendenciaFinanceiraId ?? "—"}`);
    const base = process.env.NEXTAUTH_URL || "https://crm.callface.io";
    await enviarEmailFinalContrato({
      contrato: contract,
      baseUrl: base,
      providerDocumentUrl: payload?.signedDocumentUrl || payload?.downloadUrl || payload?.documentUrl || null,
    });
  } else if (event === "DOCUMENT_REJECTED") {
    await db.update(contratos).set({ assinaturaStatus: "recusado", signatureStatus: "declined", updatedAt: new Date() }).where(and(eq(contratos.id, contract.id), ne(contratos.signatureStatus, "signed")));
    await publicarEvento({ organizacaoId: contract.organizacaoId, eventType: "ContractDeclined", aggregateType: "contrato", aggregateId: contract.id, payload: commonPayload, idempotencyKey: eventKey });
  } else if (event === "DOCUMENT_CANCELLED" || event === "RECIPIENT_EXPIRED") {
    const expired = event === "RECIPIENT_EXPIRED";
    await db.update(contratos).set({ assinaturaStatus: expired ? "expirado" : "cancelado", signatureStatus: expired ? "expired" : "canceled", updatedAt: new Date() }).where(and(eq(contratos.id, contract.id), ne(contratos.signatureStatus, "signed")));
    await publicarEvento({ organizacaoId: contract.organizacaoId, eventType: expired ? "ContractExpired" : "ContractDeclined", aggregateType: "contrato", aggregateId: contract.id, payload: commonPayload, idempotencyKey: eventKey });
  }

  return NextResponse.json({ received: true, event, contractId: contract.id });
}
