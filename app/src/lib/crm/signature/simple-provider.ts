/**
 * Implementação atual (única registrada) do SignatureProvider — aceite
 * eletrônico simples (nome + IP + timestamp), NÃO é assinatura digital
 * qualificada. Documentado honestamente em crm2-decisoes-pendentes.md.
 * Quando o provider real for escolhido, cria-se outra classe implementando
 * a mesma interface — nada além de `signature/index.ts` muda.
 */
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { contratos } from "@/lib/db/schema";
import type { SignatureProvider, SignatureStatus, EnviarParaAssinaturaResult, ConfirmarAssinaturaOpts, ConfirmarAssinaturaResult, EnviarParaAssinaturaOpts } from "@/lib/crm/signature/provider";

export class SimpleElectronicSignatureProvider implements SignatureProvider {
  readonly nome = "simple_electronic";

  async enviarParaAssinatura(contratoId: string, opts?: EnviarParaAssinaturaOpts): Promise<EnviarParaAssinaturaResult> {
    if ((opts?.signatarios?.length || 0) > 1) {
      throw new Error("Múltiplos signatários exigem um provider de assinatura configurado (DOCUMENSO_API_URL/DOCUMENSO_API_KEY).");
    }
    // Não existe envio real (não há API externa) — o link público JÁ é a
    // "disponibilização pra assinatura". providerRef = o próprio contrato,
    // já que não há um ID de terceiro pra rastrear.
    await db.update(contratos).set({ signatureProviderRef: contratoId, signatureStatus: "sent_for_signature" }).where(eq(contratos.id, contratoId));
    return { providerRef: contratoId, status: "sent_for_signature" };
  }

  async registrarAbertura(providerRef: string): Promise<SignatureStatus> {
    try {
      const [contrato] = await db.select({ signatureStatus: contratos.signatureStatus }).from(contratos).where(eq(contratos.id, providerRef)).limit(1);
      if (contrato && contrato.signatureStatus === "sent_for_signature") {
        await db.update(contratos).set({ signatureStatus: "opened" }).where(eq(contratos.id, providerRef));
      }
      return "opened";
    } catch (err) {
      console.error(`[SimpleElectronicSignatureProvider] falha ao registrar abertura ${providerRef} (best-effort):`, err);
      return "sent_for_signature";
    }
  }

  async confirmarAssinatura(opts: ConfirmarAssinaturaOpts): Promise<ConfirmarAssinaturaResult> {
    const evidencia = { nome: opts.nomeSignatario, ip: opts.ip, timestamp: new Date().toISOString(), metodo: "aceite_eletronico_simples" };
    // Este provider é o dono da evidência CONCRETA (nome/IP/timestamp nos
    // campos legados assinado_*) — o caller só orquestra as consequências de
    // domínio (grupo, evidência comercial, Won), não escreve nesses campos.
    await db.update(contratos).set({
      status: "ativo",
      assinaturaStatus: "aceite_simples",
      assinadoEm: new Date(),
      assinadoNome: opts.nomeSignatario,
      assinadoIp: opts.ip,
      inicio: new Date().toISOString().split("T")[0],
      signatureStatus: "signed",
      signatureProviderRef: opts.providerRef,
      updatedAt: new Date(),
    }).where(eq(contratos.id, opts.providerRef));
    return { status: "signed", evidencia, documentoFinalUrl: null };
  }
}
