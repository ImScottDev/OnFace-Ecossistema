/**
 * Metadata que o ONFACE grava em TODO objeto do Stripe (Customer, Subscription,
 * Checkout Session, Invoice, Quote) pra se ir do Stripe ao ONFACE e voltar
 * (stripe-onface-definicao §13), sem depender de casar por valor/e-mail.
 *
 * Um lugar só:
 *  - `metadataStripe`          monta o conjunto padrão a partir dos ids;
 *  - `montarMetadataComercial` o conjunto de um grupo comercial (checkout);
 *  - `idsDaMetadataStripe` / `negocioDaMetadataStripe` / `metadataFaltante`
 *    leem e completam, para quem vem do Stripe (sync, backfill, resolver).
 *
 * O conjunto padrão tem DUAS grafias de propósito: `organizacaoId`, `empresaId`,
 * `negocioId` e `propostaId` (a definição) e os `crm_*` que o Stripe já tem
 * gravados e que a reconciliação lê. Quem lê aceita qualquer uma.
 *
 * Chaves fixas (limite do Stripe: 50 chaves, valores até 500 caracteres —
 * todas aqui são UUID ou rótulo curto, folgado).
 */
import { db } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import {
  propostaGrupoComercial, propostas, negocios, leads, empresas, oportunidades, oportunidadeItens, pessoas,
} from "@/lib/db/schema";

/** Ids internos que identificam o objeto no ONFACE. Tudo opcional, menos a organização. */
export interface IdsStripe {
  organizacaoId: string;
  empresaId?: string | null;
  /** `negocios.id` (o negócio dono do MRR — é o que o sync grava em `mrr_movimentos`). */
  negocioId?: string | null;
  /** `oportunidades.id` (v2). Só entra quando existe; nunca vira palpite do negócio. */
  oportunidadeId?: string | null;
  propostaId?: string | null;
  leadId?: string | null;
  /** CNPJ da empresa; vai só com 14 dígitos (digits-only), que é como se casa depois. */
  cnpj?: string | null;
}

/**
 * O conjunto padrão. Só entram chaves COM valor: string vazia APAGA a chave no
 * Stripe numa atualização, e o objetivo é preservar o que já está lá.
 */
export function metadataStripe(ids: IdsStripe): Record<string, string> {
  const m: Record<string, string> = {};
  const poe = (chave: string, valor: string | null | undefined) => {
    const v = typeof valor === "string" ? valor.trim() : "";
    if (v) m[chave] = v.slice(0, 500);
  };
  poe("organizacaoId", ids.organizacaoId);
  poe("empresaId", ids.empresaId);
  poe("negocioId", ids.negocioId);
  poe("propostaId", ids.propostaId);

  poe("crm_organization_id", ids.organizacaoId);
  poe("crm_company_id", ids.empresaId);
  poe("crm_negocio_id", ids.negocioId);
  poe("crm_opportunity_id", ids.oportunidadeId);
  poe("crm_proposal_id", ids.propostaId);
  poe("crm_lead_id", ids.leadId);
  const cnpj = ids.cnpj?.replace(/\D/g, "") ?? "";
  if (cnpj.length === 14) m.crm_cnpj = cnpj;
  return m;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const primeiroUuid = (m: Record<string, string> | null | undefined, chaves: string[]): string | null => {
  for (const chave of chaves) {
    const v = m?.[chave]?.trim();
    if (v && UUID.test(v)) return v.toLowerCase();
  }
  return null;
};

/**
 * Os ids que uma metadata do Stripe carrega, qualquer que seja a grafia
 * (`empresaId`, `crm_company_id`, `crm_empresa_id`, `onfaceEmpresaId`; `negocioId`
 * ou `crm_negocio_id`...). Valor que não é UUID é descartado: metadata vem de
 * fora e não pode virar chave de consulta sem validar.
 */
export function idsDaMetadataStripe(m: Record<string, string> | null | undefined) {
  return {
    organizacaoId: primeiroUuid(m, ["organizacaoId", "crm_organization_id"]),
    empresaId: primeiroUuid(m, ["empresaId", "crm_company_id", "crm_empresa_id", "onfaceEmpresaId"]),
    negocioId: primeiroUuid(m, ["negocioId", "crm_negocio_id"]),
    oportunidadeId: primeiroUuid(m, ["crm_opportunity_id"]),
    propostaId: primeiroUuid(m, ["propostaId", "crm_proposal_id"]),
  };
}

/** Grafias da empresa que a busca por metadata no Stripe procura. */
export const CHAVES_DE_EMPRESA = ["empresaId", "crm_company_id", "crm_empresa_id", "onfaceEmpresaId"] as const;

/**
 * O `negocios.id` que uma metadata aponta, ou `null`.
 *
 * Aceita `crm_negocio_id`/`negocioId` e também `crm_opportunity_id`: quem
 * emitia só a segunda (o checkout, quando não havia oportunidade, gravava o
 * negócio ali) deixava o sync cego. Cada candidato é conferido NA ORGANIZAÇÃO —
 * o id vem de fora, e `mrr_movimentos.negocio_id` é chave estrangeira: um valor
 * solto derrubaria o sync inteiro. Oportunidade v2 vira o negócio legado dela.
 */
export async function negocioDaMetadataStripe(
  executor: Pick<typeof db, "select">,
  organizacaoId: string,
  metadata: Record<string, string> | null | undefined,
): Promise<string | null> {
  const ids = idsDaMetadataStripe(metadata);
  const candidatos = [...new Set([ids.negocioId, ids.oportunidadeId].filter((x): x is string => !!x))];
  for (const id of candidatos) {
    const [n] = await executor.select({ id: negocios.id }).from(negocios)
      .where(and(eq(negocios.id, id), eq(negocios.organizacaoId, organizacaoId))).limit(1);
    if (n) return n.id;
    const [o] = await executor.select({ negocioId: oportunidades.negocioIdLegado }).from(oportunidades)
      .where(and(eq(oportunidades.id, id), eq(oportunidades.organizacaoId, organizacaoId))).limit(1);
    if (o?.negocioId) return o.negocioId;
  }
  return null;
}

/**
 * O que falta no objeto: chave da `desejada` ausente (ou vazia) em `atual`.
 * Só ADICIONA — chave que já tem valor nunca é sobrescrita, e nada é removido.
 */
export function metadataFaltante(
  atual: Record<string, string> | null | undefined,
  desejada: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(Object.entries(desejada).filter(([k, v]) => v && !atual?.[k]?.trim()));
}

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

  /* O conjunto padrão (organizacaoId, empresaId, negocioId, propostaId + crm_*)
     entra por baixo; os `crm_*` do grupo logo abaixo mantêm o formato de sempre,
     com string vazia onde não há dado. */
  const padrao = metadataStripe({
    organizacaoId: grupo.organizacaoId,
    empresaId: empresa?.id,
    negocioId: grupo.negocioId ?? proposta?.negocioId,
    oportunidadeId: oportunidade?.id,
    propostaId: grupo.propostaId,
    leadId,
  });

  return {
    ...padrao,
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
