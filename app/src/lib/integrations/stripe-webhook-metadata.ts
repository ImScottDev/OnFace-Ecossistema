const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * A metadata chega dentro de um evento Stripe cuja assinatura ja foi
 * verificada. Ela e fallback de tenant, nunca substitui um vinculo persistido
 * de checkout, fatura ou assinatura existente.
 */
export function organizationIdFromStripeMetadata(object: Record<string, unknown>): string | null {
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const organizationId = (metadata as Record<string, unknown>).crm_organization_id;
  return typeof organizationId === "string" && UUID_RE.test(organizationId) ? organizationId : null;
}
