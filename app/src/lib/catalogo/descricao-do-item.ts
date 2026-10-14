import { sql } from "drizzle-orm";
import { catalogoPrecos, propostaItens, servicosCatalogo } from "@/lib/db/schema";

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

/**
 * O período de cobrança de uma linha de proposta: o congelado na linha quando ela foi criada
 * (`proposta_itens.periodo`, migration 0121); nas linhas antigas, o do Price do catálogo. Sem isso, editar
 * o Price depois da venda mudava o "/mês" de uma proposta já enviada ou aceita. Exige LEFT JOIN de
 * `catalogo_precos` pela `proposta_itens.catalogo_preco_id`.
 */
export const periodoDoItemSql = sql<string | null>`COALESCE(${propostaItens.periodo}, ${catalogoPrecos.periodo})`;
