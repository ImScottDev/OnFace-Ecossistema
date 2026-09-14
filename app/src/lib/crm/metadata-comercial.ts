/**
 * Frente 2C.1 — metadata comercial canônica (`crm_*`), preparada pra 2C.2.
 *
 * O que a integração real vai precisar mandar junto de cada objeto do Stripe
 * (session, subscription, invoice) pra que qualquer reconciliação futura saiba
 * de onde aquele dinheiro veio, sem depender de casar por valor/e-mail.
 *
 * Aqui ela é apenas MONTADA e PERSISTIDA em `checkouts.metadata`. NÃO é
 * enviada ao Stripe nesta frente: mudar o payload de saída é integração nova,
 * explicitamente fora do escopo da 2C.1. Quando a 2C.2 chegar, é só passar
 * este objeto pro `appendNested(form, "metadata", ...)` — a montagem já está
 * pronta e testada.
 *
 * Chaves fixas (limite do Stripe: 50 chaves, valores até 500 caracteres —
 * todas aqui são UUID ou rótulo curto, folgado).
 */
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  propostaGrupoComercial, propostas, negocios, leads, empresas, oportunidades, oportunidadeItens, pessoas,
} from "@/lib/db/schema";

export interface MetadataComercial extends Record<string, string> {
  crm_proposal_id: string;
  crm_opportunity_id: string;
  crm_company_id: string;
  crm_person_id: string;
  crm_lead_id: string;
  crm_bundle_id: string;
  crm_service_family: string;
  crm_revenue_nature: string;
  crm_origin: string;
  crm_campaign: string;
  crm_seller_id: string;
  crm_group_id: string;
  crm_organization_id: string;
}

/**
 * Monta a metadata de um grupo comercial. Campo sem dado real fica string
 * vazia — nunca um placeholder inventado, porque metadata errada no provedor
 * de pagamento é pior que metadata ausente (a reconciliação passa a confiar
 * num vínculo falso).
 */
export async function montarMetadataComercial(grupoId: string): Promise<MetadataComercial | null> {
  const [grupo] = await db.select().from(propostaGrupoComercial).where(eq(propostaGrupoComercial.id, grupoId)).limit(1);
  if (!grupo) return null;

  const [proposta] = await db.select({ id: propostas.id, leadId: propostas.leadId, negocioId: propostas.negocioId, criadoPorId: propostas.criadoPorId })
    .from(propostas).where(eq(propostas.id, grupo.propostaId)).limit(1);

  const [negocio] = grupo.negocioId
    ? await db.select({ id: negocios.id, empresaId: negocios.empresaId, leadId: negocios.leadId, bundleId: negocios.bundleId })
        .from(negocios).where(eq(negocios.id, grupo.negocioId)).limit(1)
    : [undefined];

  const leadId = negocio?.leadId ?? proposta?.leadId ?? null;
  const [lead] = leadId
    ? await db.select({ id: leads.id, origem: leads.origem, utmSource: leads.utmSource, utmCampaign: leads.utmCampaign, empresaId: leads.empresaId })
        .from(leads).where(eq(leads.id, leadId)).limit(1)
    : [undefined];

  const [oportunidade] = grupo.negocioId
    ? await db.select({ id: oportunidades.id, bundleId: oportunidades.bundleId }).from(oportunidades).where(eq(oportunidades.negocioIdLegado, grupo.negocioId)).limit(1)
    : [undefined];

  const [pessoa] = leadId
    ? await db.select({ id: pessoas.id }).from(pessoas).where(eq(pessoas.leadIdLegado, leadId)).limit(1)
    : [undefined];

  // Natureza de receita do grupo: a dominante entre os itens já materializados.
  // Um grupo com MRR + SETUP é rotulado MRR (é o que a receita recorrente
  // representa comercialmente); "MIXED" quando há mais de uma e nenhuma é MRR.
  const itens = await db.select({ revenueNature: oportunidadeItens.revenueNature })
    .from(oportunidadeItens).where(eq(oportunidadeItens.grupoComercialId, grupoId));
  const naturezas = new Set(itens.map((i) => i.revenueNature).filter((n) => n && n !== "UNKNOWN"));
  const revenueNature = naturezas.has("MRR") ? "MRR" : naturezas.size === 1 ? [...naturezas][0] : naturezas.size > 1 ? "MIXED" : "";

  const empresaId = negocio?.empresaId ?? lead?.empresaId ?? null;
  const [empresa] = empresaId
    ? await db.select({ id: empresas.id }).from(empresas).where(eq(empresas.id, empresaId)).limit(1)
    : [undefined];

  return {
    crm_proposal_id: grupo.propostaId,
    crm_opportunity_id: oportunidade?.id ?? "",
    crm_company_id: empresa?.id ?? "",
    crm_person_id: pessoa?.id ?? "",
    crm_lead_id: leadId ?? "",
    crm_bundle_id: oportunidade?.bundleId ?? negocio?.bundleId ?? "",
    crm_service_family: grupo.serviceFamily ?? "",
    crm_revenue_nature: revenueNature,
    crm_origin: lead?.origem ?? lead?.utmSource ?? "",
    crm_campaign: lead?.utmCampaign ?? "",
    crm_seller_id: proposta?.criadoPorId ?? "",
    crm_group_id: grupo.id,
    crm_organization_id: grupo.organizacaoId,
  };
}
