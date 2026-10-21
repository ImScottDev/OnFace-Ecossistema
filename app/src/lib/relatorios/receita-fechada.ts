import { sql } from "drizzle-orm";
import { negocios } from "@/lib/db/schema";

/**
 * Tradução para SQL da política de receita VENDIDA (booking) — não faturamento,
 * não caixa. A política e a versão em TS moram em `receita-fechada-shared.ts`;
 * as duas formas existem de propósito (uma agrega no banco, a outra decompõe
 * uma linha já carregada) e `receita-fechada.test.ts` prova que concordam.
 *
 * Três grandezas separadas, decisão do Scott em 21/10/2026:
 *   MRR vendido + SETUP vendido = BOOKING.  AVULSO fica fora, em métrica própria.
 */
export {
  decomporVenda,
  valorVendido,
  tipoRecorre,
  type VendaBruta,
  type VendaDecomposta,
} from "./receita-fechada-shared";

const naoRecorre = sql`COALESCE(${negocios.tipoReceita}, '') IN ('avulso', 'projeto')`;

/** Mensalidade vendida. Zero em projeto/avulso. */
export const VALOR_MRR_VENDIDO = sql<number>`CASE WHEN ${naoRecorre} THEN 0 ELSE COALESCE(${negocios.mrrFechado}, 0)::numeric END`;

/** Implantação de venda recorrente. Zero em projeto/avulso. */
export const VALOR_SETUP_VENDIDO = sql<number>`CASE WHEN ${naoRecorre} THEN 0 ELSE COALESCE(${negocios.valorSetup}, 0)::numeric END`;

/**
 * Projeto/avulso. Zero em venda recorrente. Sem valor total, cai no setup:
 * é onde a migração gravou o valor do projeto.
 */
export const VALOR_AVULSO_VENDIDO = sql<number>`CASE WHEN ${naoRecorre}
  THEN CASE WHEN COALESCE(${negocios.valorTotal}, 0)::numeric > 0
    THEN ${negocios.valorTotal}::numeric ELSE COALESCE(${negocios.valorSetup}, 0)::numeric END
  ELSE 0::numeric END`;

/** O booking: recorrente + implantação. É o "vendido" do Fechamento e das metas. */
export const VALOR_BOOKING_VENDIDO = sql<number>`(${VALOR_MRR_VENDIDO} + ${VALOR_SETUP_VENDIDO})`;

/**
 * Tudo que a venda representa: booking + avulso.
 *
 * Atenção ao usar como "booking": ele soma projeto com mensalidade. Para o
 * número de venda ganha, use `VALOR_BOOKING_VENDIDO` e mostre o avulso ao lado.
 */
export const VALOR_TOTAL_VENDIDO = sql<number>`(${VALOR_MRR_VENDIDO} + ${VALOR_SETUP_VENDIDO} + ${VALOR_AVULSO_VENDIDO})`;

/**
 * Legado: setup de venda recorrente E projeto avulso no mesmo bucket. Quem lê
 * isto chama o resultado de "setup" e mostra outra coisa. Consumidores restantes
 * são da camada pré-catálogo, que será aposentada; não use em código novo.
 *
 * @deprecated prefira `VALOR_SETUP_VENDIDO` e `VALOR_AVULSO_VENDIDO` separados.
 */
export const VALOR_NAO_RECORRENTE_VENDIDO = sql<number>`(${VALOR_SETUP_VENDIDO} + ${VALOR_AVULSO_VENDIDO})`;
