import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { contratos } from "@/lib/db/schema";
import { publicarEvento } from "@/lib/events/outbox";
import { registrarEvidencia } from "@/lib/crm/won-evidence";
import { marcarContratoAssinadoNoGrupo } from "@/lib/crm/grupo-comercial";
import { criarCheckoutParaGrupo } from "@/lib/crm/checkout";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";
import { enviarEmailFinalContrato } from "@/lib/crm/contrato-email-final";

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
  if (!configuredSecret) return NextResponse.json({ error: "webhook secret not configured" }, { status: 500 });
  if (!receivedSecret || receivedSecret !== configuredSecret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: DocumensoPayload;
  try {
    body = JSON.parse(await request.text()) as DocumensoPayload;
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const event = String(body.event || "").toUpperCase();
  const payload = body.payload;
  const providerRef = payload?.envelopeId || (payload?.externalId || "").replace(/^callface-contrato-/, "");
  if (!providerRef) return NextResponse.json({ received: true, ignored: "missing envelope id" });

  const [contract] = await db.select().from(contratos).where(eq(contratos.signatureProviderRef, providerRef)).limit(1);
  if (!contract) return NextResponse.json({ received: true, unresolved: true }, { status: 202 });

  const recipients = payload?.recipients || [];
  const eventKey = `documenso:${event}:${providerRef}:${body.createdAt || payload?.completedAt || "event"}`;
  const commonPayload = { provider: "documenso", providerRef, event, recipients, raw: body };

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
    if (contract.negocioId) {
      await registrarEvidencia({ negocioId: contract.negocioId, organizacaoId: contract.organizacaoId, tipo: "signed_contract", sourceRef: contract.id, grupoComercialId: contract.grupoComercialId, metadata: { provider: "documenso", recipients } });
      await syncNegocioValoresFromPropostas(contract.negocioId);
    }
    if (contract.grupoComercialId) {
      await marcarContratoAssinadoNoGrupo(contract.grupoComercialId);
      const checkout = await criarCheckoutParaGrupo({ grupoId: contract.grupoComercialId, origem: "automatico_pos_aceite" });
      if (checkout.ok) await publicarEvento({ organizacaoId: contract.organizacaoId, eventType: "PaymentStarted", aggregateType: "checkout", aggregateId: checkout.checkoutId, payload: { contratoId: contract.id, grupoComercialId: contract.grupoComercialId, checkoutUrl: checkout.url }, idempotencyKey: `payment-started-contract:${contract.id}` });
    }
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
