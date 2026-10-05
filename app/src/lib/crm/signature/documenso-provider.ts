import { db } from "@/lib/db";
import { contratos, leads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { contratoPdfHtml, renderContratoPdf } from "@/lib/crm/contrato-pdf";
import type {
  ConfirmarAssinaturaResult,
  EnviarParaAssinaturaOpts,
  EnviarParaAssinaturaResult,
  SignatureProvider,
  SignatureRecipient,
  SignatureStatus,
} from "@/lib/crm/signature/provider";

type DocumensoResponse = Record<string, unknown>;

function baseUrl(): string {
  return (process.env.DOCUMENSO_API_URL || "https://app.documenso.com/api/v2").replace(/\/$/, "");
}

function apiKey(): string {
  return process.env.DOCUMENSO_API_TOKEN || "";
}

function recipientsFrom(value: unknown): SignatureRecipient[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item, index) => ({
      nome: String(item.nome || item.name || "").trim(),
      email: String(item.email || "").trim(),
      papel: item.papel ? String(item.papel) : null,
      ordem: typeof item.ordem === "number" ? item.ordem : index + 1,
      signingUrl: item.signingUrl ? String(item.signingUrl) : null,
    }))
    .filter((item) => item.nome && item.email);
}

/**
 * Adapter real para Documenso V2. Ele só é selecionado quando as credenciais
 * estão configuradas; sem elas, o CRM continua com o provider simples local.
 * O domínio continua falando apenas SignatureProvider.
 */
export class DocumensoSignatureProvider implements SignatureProvider {
  readonly nome = "documenso";

  private async request(path: string, init: RequestInit): Promise<DocumensoResponse> {
    const response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { Authorization: apiKey(), ...(init.headers || {}) },
    });
    const body = await response.json().catch(() => ({})) as DocumensoResponse;
    if (!response.ok) throw new Error(`Documenso ${response.status}: ${String(body.message || body.error || "erro na API")}`);
    return body;
  }

  async enviarParaAssinatura(contratoId: string, opts?: EnviarParaAssinaturaOpts): Promise<EnviarParaAssinaturaResult> {
    const [row] = await db
      .select({ id: contratos.id, descricao: contratos.descricao, corpoGerado: contratos.corpoGerado, createdAt: contratos.createdAt, signatarios: contratos.signatarios, leadNome: leads.nome, leadEmpresa: leads.empresa })
      .from(contratos)
      .innerJoin(leads, eq(contratos.leadId, leads.id))
      .where(eq(contratos.id, contratoId))
      .limit(1);
    if (!row) throw new Error("Contrato não encontrado para envio ao Documenso");

    const signatarios = recipientsFrom(opts?.signatarios || row.signatarios);
    if (signatarios.length === 0) throw new Error("Contrato sem signatários válidos para o Documenso");
    const html = contratoPdfHtml({ descricao: row.descricao, corpoGerado: row.corpoGerado, clienteNome: row.leadEmpresa || row.leadNome, createdAt: row.createdAt, assinado: false });
    const pdf = await renderContratoPdf(html);
    const payload = {
      type: "DOCUMENT",
      title: opts?.titulo || row.descricao || `Contrato Callface ${contratoId.slice(0, 8)}`,
      externalId: `callface-contrato-${contratoId}`,
      visibility: "EVERYONE",
      recipients: signatarios.map((recipient, index) => ({
        email: recipient.email,
        name: recipient.nome,
        role: "SIGNER",
        signingOrder: recipient.ordem || index + 1,
        fields: [
          { identifier: 0, type: "SIGNATURE", page: 1, positionX: 10, positionY: 78 + (index * 7), width: 30, height: 5 },
          { identifier: 0, type: "DATE", page: 1, positionX: 52, positionY: 78 + (index * 7), width: 22, height: 4 },
        ],
      })),
      meta: {
        subject: "Assine seu contrato com a Callface",
        message: "Revise o documento e assine com segurança. Você receberá uma cópia após a conclusão.",
      },
    };
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    form.append("files", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), `contrato-${contratoId.slice(0, 8)}.pdf`);
    const created = await this.request("/envelope/create", { method: "POST", body: form });
    const providerRef = String(created.envelopeId || created.id || "");
    if (!providerRef) throw new Error("Documenso não devolveu envelopeId");

    // O envelope nasce em DRAFT. Sem esta segunda chamada o cliente nunca
    // recebe o convite e o CRM ficaria com um status enganoso de enviado.
    const distributed = await this.request("/envelope/distribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envelopeId: providerRef, meta: { language: "pt-BR" } }),
    });
    const distributedRecipients = recipientsFrom(distributed.recipients);
    const recipientsPersistidos = signatarios.map((recipient, index) => ({
      ...recipient,
      ...(distributedRecipients.find((item) => item.email.toLowerCase() === recipient.email.toLowerCase()) || {}),
      ordem: recipient.ordem || index + 1,
    }));

    await db.update(contratos).set({
      signatureProviderRef: providerRef,
      signatureStatus: "sent_for_signature",
      assinaturaStatus: "pendente",
      signatarios: recipientsPersistidos,
      updatedAt: new Date(),
    }).where(eq(contratos.id, contratoId));
    return { providerRef, status: "sent_for_signature" };
  }

  async registrarAbertura(providerRef: string): Promise<SignatureStatus> {
    const [contract] = await db.select({ id: contratos.id, signatureStatus: contratos.signatureStatus }).from(contratos).where(eq(contratos.signatureProviderRef, providerRef)).limit(1);
    if (contract && contract.signatureStatus === "sent_for_signature") await db.update(contratos).set({ signatureStatus: "opened", updatedAt: new Date() }).where(eq(contratos.id, contract.id));
    return "opened";
  }

  async confirmarAssinatura(): Promise<ConfirmarAssinaturaResult> {
    throw new Error("Documenso confirma assinaturas pelo webhook DOCUMENT_SIGNED/DOCUMENT_COMPLETED");
  }
}

export function isDocumensoConfigured(): boolean {
  // A Callface usa somente a instância self-hosted. Exigir a URL explícita
  // evita que um token seja enviado por engano para o Documenso Cloud.
  return Boolean(apiKey() && process.env.DOCUMENSO_API_URL);
}

/** Baixa o PDF assinado somente depois que o envelope foi concluído. */
export async function baixarDocumentoAssinado(providerRef: string): Promise<{ buffer: ArrayBuffer; filename: string }> {
  if (!isDocumensoConfigured()) throw new Error("Documenso não configurado");
  const response = await fetch(`${baseUrl()}/envelope/${encodeURIComponent(providerRef)}`, {
    headers: { Authorization: apiKey() },
  });
  const envelope = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Documenso ${response.status}: envelope não encontrado`);
  if (envelope.status !== "COMPLETED") throw new Error("O contrato ainda não foi concluído no Documenso");
  const items = Array.isArray(envelope.envelopeItems) ? envelope.envelopeItems : [];
  const item = items.find((value): value is Record<string, unknown> => !!value && typeof value === "object");
  const itemId = item?.id;
  if (!itemId) throw new Error("Documenso não devolveu o item PDF do envelope");
  const pdfResponse = await fetch(`${baseUrl()}/envelope/item/${encodeURIComponent(String(itemId))}/download?version=signed`, {
    headers: { Authorization: apiKey() },
  });
  if (!pdfResponse.ok) throw new Error(`Documenso ${pdfResponse.status}: PDF assinado indisponível`);
  const filename = typeof envelope.title === "string" && envelope.title.trim()
    ? `${envelope.title.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 100)}-assinado.pdf`
    : `contrato-${providerRef.slice(0, 12)}-assinado.pdf`;
  return { buffer: await pdfResponse.arrayBuffer(), filename };
}
