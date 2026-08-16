import type { SignatureProvider } from "@/lib/crm/signature/provider";
import { SimpleElectronicSignatureProvider } from "@/lib/crm/signature/simple-provider";

/**
 * Único ponto de decisão de QUAL provider está ativo. Trocar de provider no
 * futuro é registrar outra implementação aqui (ou por config/org) — nenhum
 * outro arquivo do domínio de Contratos precisa mudar.
 */
export function getSignatureProvider(): SignatureProvider {
  return new SimpleElectronicSignatureProvider();
}

export type { SignatureProvider, SignatureStatus } from "@/lib/crm/signature/provider";
