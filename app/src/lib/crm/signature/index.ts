import type { SignatureProvider } from "@/lib/crm/signature/provider";
import { SimpleElectronicSignatureProvider } from "@/lib/crm/signature/simple-provider";
import { DocumensoSignatureProvider, isDocumensoConfigured } from "@/lib/crm/signature/documenso-provider";

/**
 * Único ponto de decisão de QUAL provider está ativo. Trocar de provider no
 * futuro é registrar outra implementação aqui (ou por config/org) — nenhum
 * outro arquivo do domínio de Contratos precisa mudar.
 */
export function getSignatureProvider(): SignatureProvider {
  if (isDocumensoConfigured()) return new DocumensoSignatureProvider();
  return new SimpleElectronicSignatureProvider();
}

export type { SignatureProvider, SignatureStatus, SignatureRecipient, EnviarParaAssinaturaOpts } from "@/lib/crm/signature/provider";
