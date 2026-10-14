// Leituras de servidor que a página pública e o PDF da proposta dividem: a(s) família(s) comercial(is)
// dos itens e o modelo de PDF escolhido. Fica fora de `conteudo-familia.ts` porque importa `db`.
import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { propostas, propostaItens, servicosCatalogo, catalogoPrecos } from "@/lib/db/schema";
import { FAMILIAS_CONHECIDAS } from "./conteudo-familia";
import { MODELOS_PDF, type ModeloPdf } from "./modelos-pdf";

/** Famílias dos itens, na ordem dos itens. O Price declara a família; o produto avulso é reserva (igual a agruparItensPorLinhaComercial). */
export async function familiasDaProposta(propostaId: string): Promise<string[]> {
  const scPreco = alias(servicosCatalogo, "sc_preco");
  const rows = await db
    .select({ doPreco: scPreco.serviceFamily, doProduto: servicosCatalogo.serviceFamily })
    .from(propostaItens)
    .leftJoin(servicosCatalogo, eq(servicosCatalogo.id, propostaItens.servicoCatalogoId))
    .leftJoin(catalogoPrecos, eq(catalogoPrecos.id, propostaItens.catalogoPrecoId))
    .leftJoin(scPreco, eq(scPreco.id, catalogoPrecos.servicoCatalogoId))
    .where(eq(propostaItens.propostaId, propostaId))
    .orderBy(asc(propostaItens.ordem));
  const out: string[] = [];
  for (const r of rows) {
    const f = r.doPreco || r.doProduto;
    if (f && (FAMILIAS_CONHECIDAS as string[]).includes(f) && !out.includes(f)) out.push(f);
  }
  return out;
}

/**
 * Modelo de PDF gravado na proposta (coluna `modelo_pdf`, migration 0127). NULL = "padrao", o PDF de sempre.
 *
 * Leitura derivada: quem chama JÁ resolveu a proposta (rota do produto pelo tenant da
 * sessão, rota pública pelo id da proposta, que é a credencial da página pública). Por
 * isso não refiltra por organização — refiltrar quebraria a página pública, que não tem
 * sessão.
 */
export async function modeloPdfDaProposta(propostaId: string): Promise<ModeloPdf> {
  const [p] = await db.select({ modelo: propostas.modeloPdf }).from(propostas).where(eq(propostas.id, propostaId)).limit(1);
  return (MODELOS_PDF as readonly string[]).includes(p?.modelo ?? "") ? (p!.modelo as ModeloPdf) : "padrao";
}

/** ESCRITA: filtra por organização, porque aqui o id vem do cliente. */
export async function gravarModeloPdf(propostaId: string, organizacaoId: string, modelo: ModeloPdf): Promise<void> {
  await db.update(propostas)
    .set({ modeloPdf: modelo === "padrao" ? null : modelo, updatedAt: new Date() })
    .where(and(eq(propostas.id, propostaId), eq(propostas.organizacaoId, organizacaoId)));
}
