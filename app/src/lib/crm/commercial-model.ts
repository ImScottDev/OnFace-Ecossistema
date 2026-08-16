/**
 * Commercial Core v2 (ADR-EXEC-021) — Modelo Comercial por item.
 *
 * Correção do achado real do Kauã (16/08): o "próximo passo" da proposta NÃO
 * pode ser determinado só pela service_family/categoria do catálogo. A MESMA
 * família (ex: Callface AI) pode ser vendida SEM fidelidade (pagamento
 * direto) ou COM contrato (desconto em troca de compromisso de 12/24 meses)
 * — isso é uma escolha da NEGOCIAÇÃO, não uma propriedade fixa do produto.
 *
 * Por isso o modelo comercial vive no ITEM (proposta_itens.commercial_model),
 * resolvido assim: override explícito do vendedor > default do catálogo
 * (servicos_catalogo.commercial_model_padrao) > PAGAMENTO_DIRETO (mais
 * conservador — nunca inventa exigência de contrato que ninguém configurou).
 */
import { db } from "@/lib/db";
import { inArray } from "drizzle-orm";
import { servicosCatalogo } from "@/lib/db/schema";

export type CommercialModel = "PAGAMENTO_DIRETO" | "CONTRATO_OBRIGATORIO" | "CONTRATO_FIDELIDADE_OPCIONAL";

const MODELOS_VALIDOS: CommercialModel[] = ["PAGAMENTO_DIRETO", "CONTRATO_OBRIGATORIO", "CONTRATO_FIDELIDADE_OPCIONAL"];

export function isCommercialModel(v: unknown): v is CommercialModel {
  return typeof v === "string" && (MODELOS_VALIDOS as string[]).includes(v);
}

/** Busca o commercial_model_padrao de um lote de itens de catálogo. */
export async function resolverCommercialModelPadraoPorCatalogoIds(catalogoIds: (string | null | undefined)[]): Promise<Map<string, CommercialModel>> {
  const ids = [...new Set(catalogoIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: servicosCatalogo.id, commercialModelPadrao: servicosCatalogo.commercialModelPadrao })
    .from(servicosCatalogo)
    .where(inArray(servicosCatalogo.id, ids));
  return new Map(rows.map((r) => [r.id, isCommercialModel(r.commercialModelPadrao) ? r.commercialModelPadrao : "PAGAMENTO_DIRETO"]));
}

/**
 * Resolve o modelo comercial de UM item no momento da criação/edição da
 * proposta. Override explícito do vendedor sempre vence; sem override,
 * herda o default do catálogo; sem catálogo (item texto livre), fica
 * PAGAMENTO_DIRETO — mesma cautela de sempre (nunca travar pagamento por
 * inferência de um item sem vínculo real).
 */
export function resolverCommercialModelDoItem(opts: {
  overrideExplicito?: string | null;
  servicoCatalogoId?: string | null;
  catalogoDefaultMap: Map<string, CommercialModel>;
}): CommercialModel {
  if (isCommercialModel(opts.overrideExplicito)) return opts.overrideExplicito;
  if (opts.servicoCatalogoId) {
    const doDatalogo = opts.catalogoDefaultMap.get(opts.servicoCatalogoId);
    if (doDatalogo) return doDatalogo;
  }
  return "PAGAMENTO_DIRETO";
}

/** Um grupo com este modelo precisa de contrato/assinatura antes do pagamento? */
export function exigeContrato(model: CommercialModel): boolean {
  return model === "CONTRATO_OBRIGATORIO" || model === "CONTRATO_FIDELIDADE_OPCIONAL";
}
