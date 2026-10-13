/**
 * Price oficial do catálogo para os scripts de ensaio e verificação.
 *
 * Desde o P1-6 toda linha nova de proposta exige um `catalogoPrecoId` válido: existe, é da organização,
 * está ativo (com o produto pai ativo), na moeda da proposta e da família da oportunidade. Script que
 * monta proposta com nome e valor soltos recebe `item_sem_catalogo` — e, pior, os que escreviam direto em
 * `proposta_itens` criavam linha sem origem de preço, que o checkout e a auditoria não sabem ler.
 *
 * Os scripts escolhem aqui o Price real do catálogo e mantêm o NOME e o VALOR NEGOCIADO do cenário (o
 * preço de tabela fica no catálogo; desconto e negociação não viram produto novo).
 */
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { catalogoPrecos, servicosCatalogo } from "@/lib/db/schema";

export type TipoDoPreco = "recorrente" | "avulso" | "setup";

export interface PrecoOficial {
  catalogoPrecoId: string;
  servicoCatalogoId: string;
  produto: string;
  variacao: string;
  tipo: TipoDoPreco;
  valor: number;
  familia: string;
  exigeContrato: boolean;
  periodo: string | null;
}

/**
 * O primeiro Price ativo (e de produto ativo, em BRL) da família com um dos tipos pedidos, na ordem em que
 * os tipos foram listados. `exigeContrato` filtra pela declaração do Price quando informado.
 */
export async function precoOficial(
  organizacaoId: string,
  familia: string,
  o: { tipos: TipoDoPreco[]; exigeContrato?: boolean; periodo?: "mensal" | "anual" | "unico" },
): Promise<PrecoOficial> {
  for (const tipo of o.tipos) {
    const [r] = await db
      .select({
        catalogoPrecoId: catalogoPrecos.id, servicoCatalogoId: servicosCatalogo.id, produto: servicosCatalogo.nome,
        variacao: catalogoPrecos.variacao, tipo: catalogoPrecos.tipo, valor: catalogoPrecos.valor,
        familia: servicosCatalogo.serviceFamily, exigeContrato: catalogoPrecos.exigeContrato, periodo: catalogoPrecos.periodo,
      })
      .from(catalogoPrecos)
      .innerJoin(servicosCatalogo, eq(servicosCatalogo.id, catalogoPrecos.servicoCatalogoId))
      .where(and(
        eq(servicosCatalogo.organizacaoId, organizacaoId),
        eq(servicosCatalogo.serviceFamily, familia),
        eq(catalogoPrecos.tipo, tipo),
        eq(catalogoPrecos.moeda, "BRL"),
        sql`COALESCE(${catalogoPrecos.ativo}, true) = true`,
        sql`COALESCE(${servicosCatalogo.ativo}, true) = true`,
        o.exigeContrato === undefined ? undefined : eq(catalogoPrecos.exigeContrato, o.exigeContrato),
        o.periodo ? eq(catalogoPrecos.periodo, o.periodo) : undefined,
      ))
      .orderBy(asc(servicosCatalogo.nome), asc(catalogoPrecos.ordem), asc(catalogoPrecos.valor))
      .limit(1);
    if (r) return { ...r, tipo: r.tipo as TipoDoPreco, valor: Number(r.valor), familia: r.familia ?? familia };
  }
  throw new Error(
    `Catálogo sem Price ativo de ${familia} (${o.tipos.join(" ou ")}${o.exigeContrato === undefined ? "" : o.exigeContrato ? ", que exige contrato" : ", que não exige contrato"}). ` +
    `Rode a carga do catálogo oficial (importar-catalogo-oficial.ts) antes deste script.`,
  );
}

/** Os campos do Price que a linha de proposta leva. O nome e o valor negociado continuam sendo do cenário. */
export const daLinha = (p: Pick<PrecoOficial, "catalogoPrecoId" | "servicoCatalogoId" | "tipo">) => ({
  catalogoPrecoId: p.catalogoPrecoId, servicoCatalogoId: p.servicoCatalogoId, tipo: p.tipo,
});


/**
 * Grava as linhas de uma proposta-fixture pela MESMA porta do produto (`prepararItensDaProposta` +
 * `inserirItensDaProposta`): cada linha leva o Price oficial da família, e os campos de rastreio (produto,
 * Price do Stripe, SKU, preço de tabela, família, natureza) saem do catálogo, nunca do script.
 * O nome e o valor negociado de cada linha continuam sendo do cenário.
 */
export async function gravarLinhasOficiais(p: {
  organizacaoId: string;
  negocioId: string | null;
  propostaId: string;
  familia: string;
  linhas: Array<{ nome: string; valor: number; quantidade?: number; tipos?: TipoDoPreco[]; exigeContrato?: boolean }>;
}) {
  const { prepararItensDaProposta, inserirItensDaProposta } = await import("@/lib/crm/proposta-criacao");
  const itens = [];
  for (const l of p.linhas) {
    const preco = await precoOficial(p.organizacaoId, p.familia, { tipos: l.tipos ?? ["recorrente"], exigeContrato: l.exigeContrato });
    itens.push({ ...daLinha(preco), nome: l.nome, quantidade: l.quantidade ?? 1, valorUnitario: l.valor, desconto: 0, descontoTipo: "valor" as const });
  }
  const calculo = await prepararItensDaProposta({ organizacaoId: p.organizacaoId, moeda: "BRL", negocioId: p.negocioId }, itens);
  await db.transaction((tx) => inserirItensDaProposta(tx, p.propostaId, "BRL", calculo.itens));
  return calculo;
}
