import { sql } from "drizzle-orm";
import { negocios } from "@/lib/db/schema";

/**
 * Política única da receita VENDIDA (booking), não faturamento nem caixa:
 * - recorrente: mensalidade do ganho; setup é receita não-recorrente adicional;
 * - projeto/avulso: o valor do projeto; fallback para setup se total está ausente.
 * `valorProjeto` NUNCA soma: a migração o duplicava com valorSetup.
 */
const avulso = sql`COALESCE(${negocios.tipoReceita}, '') IN ('avulso', 'projeto')`;
export const VALOR_MRR_VENDIDO = sql<number>`CASE WHEN ${avulso} THEN 0 ELSE COALESCE(${negocios.mrrFechado}, 0)::numeric END`;
export const VALOR_NAO_RECORRENTE_VENDIDO = sql<number>`CASE WHEN ${avulso}
  THEN CASE WHEN COALESCE(${negocios.valorTotal}, 0)::numeric > 0
    THEN ${negocios.valorTotal}::numeric ELSE COALESCE(${negocios.valorSetup}, 0)::numeric END
  ELSE COALESCE(${negocios.valorSetup}, 0)::numeric END`;
export const VALOR_TOTAL_VENDIDO = sql<number>`(${VALOR_MRR_VENDIDO} + ${VALOR_NAO_RECORRENTE_VENDIDO})`;

export type VendaBruta = {
  tipoReceita: string | null;
  mrrFechado: number | null;
  valorSetup: number | null;
  valorTotal: number | null;
};
export function decomporVenda(venda: VendaBruta) {
  const recorrente = venda.tipoReceita !== "avulso" && venda.tipoReceita !== "projeto";
  const mrr = recorrente ? Number(venda.mrrFechado ?? 0) : 0;
  const avulso = recorrente ? Number(venda.valorSetup ?? 0)
    : Number(venda.valorTotal ?? 0) > 0 ? Number(venda.valorTotal)
      : Number(venda.valorSetup ?? 0);
  return { recorrente: mrr, avulso, total: mrr + avulso };
}
