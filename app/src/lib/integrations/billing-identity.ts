/**
 * Deterministic Stripe -> CRM identity resolution.
 *
 * This module deliberately does not create identities or aliases. Creation and
 * correction belong to the approved CRM-only remediation job, where every
 * change is written to billing_correction_ledger. Runtime sync only consumes
 * confirmed evidence and sends uncertainty to the review queue.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { billingCustomerAliases, billingIdentities, empresas, leads } from "../db/schema";

export type StripeCustomerSnapshot = {
  id: string;
  email?: string | null;
  metadata?: Record<string, string> | null;
};

export type BillingResolution = {
  kind: "CONFIRMED" | "REVIEW" | "UNRESOLVED";
  source: "ALIAS" | "CRM_METADATA" | "CNPJ" | "UNIQUE_EMAIL" | "NONE";
  leadId?: string;
  empresaId?: string | null;
  billingIdentityId?: string;
  reason?: string;
};

export function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

export function normalizeCnpj(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") || "";
  return digits.length === 14 ? digits : null;
}

function metadataId(metadata: Record<string, string> | null | undefined, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata?.[key]?.trim();
    if (value) return value;
  }
  return null;
}

export async function resolveBillingCustomer(
  organizacaoId: string,
  customer: StripeCustomerSnapshot,
): Promise<BillingResolution> {
  // 1. An alias previously confirmed by the CRM-only remediation is immutable
  // evidence. It wins over e-mail and legacy Customer metadata.
  const [alias] = await db
    .select({
      identityId: billingIdentities.id,
      identityStatus: billingIdentities.status,
      leadId: billingIdentities.leadId,
      empresaId: billingIdentities.empresaId,
    })
    .from(billingCustomerAliases)
    .innerJoin(billingIdentities, eq(billingCustomerAliases.billingIdentityId, billingIdentities.id))
    .where(and(eq(billingCustomerAliases.stripeCustomerId, customer.id), eq(billingIdentities.organizacaoId, organizacaoId)))
    .limit(1);
  if (alias?.identityStatus === "CONFIRMED" && alias.leadId) {
    return { kind: "CONFIRMED", source: "ALIAS", leadId: alias.leadId, empresaId: alias.empresaId, billingIdentityId: alias.identityId };
  }
  if (alias) {
    return { kind: "REVIEW", source: "ALIAS", billingIdentityId: alias.identityId, reason: "alias existe sem lead confirmado" };
  }

  // 2. IDs opacos do CRM na metadata são a única metadata que pode confirmar
  // uma identidade sozinha. Nunca use nome/telefone como chave.
  const metadataLeadId = metadataId(customer.metadata, ["crm_lead_id", "lead_id"]);
  if (metadataLeadId) {
    const [lead] = await db
      .select({ id: leads.id, empresaId: leads.empresaId })
      .from(leads)
      .where(and(eq(leads.id, metadataLeadId), eq(leads.organizacaoId, organizacaoId)))
      .limit(1);
    if (lead) return { kind: "CONFIRMED", source: "CRM_METADATA", leadId: lead.id, empresaId: lead.empresaId };
    return { kind: "REVIEW", source: "CRM_METADATA", reason: "crm_lead_id não pertence à organização" };
  }

  const metadataEmpresaId = metadataId(customer.metadata, ["crm_empresa_id", "empresa_id"]);
  if (metadataEmpresaId) {
    const matches = await db
      .select({ id: leads.id, empresaId: leads.empresaId })
      .from(leads)
      .where(and(eq(leads.organizacaoId, organizacaoId), eq(leads.empresaId, metadataEmpresaId)));
    if (matches.length === 1) return { kind: "CONFIRMED", source: "CRM_METADATA", leadId: matches[0].id, empresaId: matches[0].empresaId };
    return { kind: "REVIEW", source: "CRM_METADATA", reason: matches.length ? "empresa metadata possui múltiplos leads" : "crm_empresa_id não encontrado" };
  }

  // 3. CNPJ is strong identity proof, but it still needs exactly one CRM lead
  // to make an automated subscription/contract link safe.
  const cnpj = normalizeCnpj(metadataId(customer.metadata, ["crm_cnpj", "cnpj", "user_cnpj"]));
  if (cnpj) {
    const companies = await db
      .select({ id: empresas.id })
      .from(empresas)
      .where(and(eq(empresas.organizacaoId, organizacaoId), sql`regexp_replace(coalesce(${empresas.cnpj}, ''), '\\D', '', 'g') = ${cnpj}`));
    if (companies.length === 1) {
      const matches = await db
        .select({ id: leads.id, empresaId: leads.empresaId })
        .from(leads)
        .where(and(eq(leads.organizacaoId, organizacaoId), eq(leads.empresaId, companies[0].id)));
      if (matches.length === 1) return { kind: "CONFIRMED", source: "CNPJ", leadId: matches[0].id, empresaId: companies[0].id };
      return { kind: "REVIEW", source: "CNPJ", empresaId: companies[0].id, reason: "CNPJ encontrou zero ou múltiplos leads" };
    }
    return { kind: "REVIEW", source: "CNPJ", reason: companies.length ? "CNPJ vinculado a mais de uma empresa" : "CNPJ não encontrado no CRM" };
  }

  // 4. E-mail is strictly a last, unique fallback. It lets the mirror see a
  // subscription, but does not write a new permanent Stripe customer link.
  const email = normalizeEmail(customer.email);
  if (email) {
    const candidates = await db
      .select({ id: leads.id, empresaId: leads.empresaId })
      .from(leads)
      .where(and(eq(leads.organizacaoId, organizacaoId), eq(leads.email, email)));
    if (candidates.length === 1) return { kind: "CONFIRMED", source: "UNIQUE_EMAIL", leadId: candidates[0].id, empresaId: candidates[0].empresaId };
    if (candidates.length > 1) return { kind: "REVIEW", source: "UNIQUE_EMAIL", reason: "e-mail aparece em mais de um lead" };
  }
  return { kind: "UNRESOLVED", source: "NONE" };
}

/** Safe utility for the approved CRM-only batch. It never calls Stripe. */
export async function loadConfirmedBillingAliases(organizacaoId: string) {
  return db
    .select({
      stripeCustomerId: billingCustomerAliases.stripeCustomerId,
      billingIdentityId: billingIdentities.id,
      leadId: billingIdentities.leadId,
      empresaId: billingIdentities.empresaId,
      canonicalStripeCustomerId: billingIdentities.canonicalStripeCustomerId,
    })
    .from(billingCustomerAliases)
    .innerJoin(billingIdentities, eq(billingCustomerAliases.billingIdentityId, billingIdentities.id))
    .where(and(eq(billingIdentities.organizacaoId, organizacaoId), eq(billingIdentities.status, "CONFIRMED")));
}
