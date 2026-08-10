/**
 * Regra comercial condicional da proposta: o que ela contém decide o próximo
 * passo depois do aceite — pagamento direto (Callface AI) ou formalização
 * contratual com assinatura antes do pagamento (PABX, e qualquer categoria
 * futura marcada como `requerContrato` no catálogo). Extensível de propósito:
 * nenhum switch por nome de produto na UI, tudo derivado de dado real do
 * catálogo (`servicosCatalogo.requerContrato`). Ver pedido explícito do Kauã
 * (10/08, item 4 do briefing de Propostas) — "não quero isso hardcoded na UI".
 */
import { db } from "@/lib/db";
import { servicosCatalogo } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

export type ProximoPasso = "pagamento" | "contrato";

interface ItemComCatalogo {
  servicoCatalogoId: string | null;
}

/**
 * Item sem vínculo de catálogo (texto livre) nunca é tratado como
 * "requer contrato" por padrão — não dá pra inferir categoria de um nome
 * digitado à mão sem arriscar falso negativo pior (bloquear pagamento) ou
 * falso positivo (vender PABX sem contrato). Documentado como limitação
 * conhecida, não decisão de negócio: o vendedor deve usar o catálogo real
 * pra qualquer item que precise mudar o fluxo comercial.
 */
export async function determinarProximoPasso(itens: ItemComCatalogo[]): Promise<ProximoPasso> {
  const catalogoIds = itens.map((i) => i.servicoCatalogoId).filter((id): id is string => !!id);
  if (catalogoIds.length === 0) return "pagamento";

  const rows = await db
    .select({ id: servicosCatalogo.id, requerContrato: servicosCatalogo.requerContrato })
    .from(servicosCatalogo)
    .where(inArray(servicosCatalogo.id, catalogoIds));

  return rows.some((r) => r.requerContrato) ? "contrato" : "pagamento";
}

/**
 * Produto comercial da proposta pra fins de contrato/evidência — derivado dos
 * itens reais, nunca hardcoded. Antes disso, TODO ponto de criação de
 * contrato no sistema forçava produto="ai" mesmo em venda PABX (bug real,
 * achado na auditoria de 10/08) — isso corrige isso pro caminho novo
 * (proposta pública → aceite → contrato) sem tocar nos outros 3 call sites
 * legados, que ficam de fora do escopo desta mudança.
 */
export async function determinarProdutoProposta(itens: ItemComCatalogo[]): Promise<"ai" | "pabx"> {
  const catalogoIds = itens.map((i) => i.servicoCatalogoId).filter((id): id is string => !!id);
  if (catalogoIds.length === 0) return "ai";

  const rows = await db
    .select({ categoria: servicosCatalogo.categoria })
    .from(servicosCatalogo)
    .where(inArray(servicosCatalogo.id, catalogoIds));

  return rows.some((r) => r.categoria === "pabx") ? "pabx" : "ai";
}
