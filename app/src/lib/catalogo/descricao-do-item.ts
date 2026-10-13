import { sql } from "drizzle-orm";
import { propostaItens, servicosCatalogo } from "@/lib/db/schema";

/**
 * A descrição de uma linha de proposta para quem lê (link público, PDF, contrato):
 * a gravada na linha; nas linhas antigas, que nasceram sem ela, a do catálogo
 * (comercial do ONFACE, senão a do Stripe). Exige LEFT JOIN de `servicos_catalogo`
 * pela `proposta_itens.servico_catalogo_id`.
 */
export const descricaoDoItemSql = sql<string | null>`COALESCE(
  NULLIF(btrim(${propostaItens.descricao}), ''),
  NULLIF(btrim(${servicosCatalogo.descricaoComercial}), ''),
  NULLIF(btrim(${servicosCatalogo.descricao}), ''))`;
