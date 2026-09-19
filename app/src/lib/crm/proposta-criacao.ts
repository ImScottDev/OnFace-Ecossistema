/**
 * Núcleo de criação de proposta — extraído de POST /propostas pra ser
 * reutilizável tanto no caminho normal (1 negócio, 1 proposta) quanto no
 * caminho multi-linha (ADR-EXEC-022, lib/crm/oportunidade-bundle.ts), que
 * chama esta função N vezes (uma por negócio-irmão).
 */
import { db } from "@/lib/db";
import { eq, sql, inArray } from "drizzle-orm";
import { propostas, propostaItens, catalogoPrecos, servicosCatalogo } from "@/lib/db/schema";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";
import { syncOportunidadeItensFromProposta, resolverServiceFamiliesPorCatalogoIds, mapTipoParaRevenueNature } from "@/lib/crm/composicao-comercial";
import { resolverCommercialModelPadraoPorCatalogoIds, resolverCommercialModelDoItem } from "@/lib/crm/commercial-model";
import { ehFamiliaValida, RegraDeNegocio } from "@/lib/vendas/dominio";

export interface ItemEntrada {
  servicoCatalogoId?: string | null;
  nome: string;
  descricao?: string;
  tipo: "recorrente" | "avulso" | "setup";
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  descontoTipo: "percentual" | "valor";
  ordem?: number;
  commercialModel?: string;
  /**
   * Catálogo Oficial Stripe (02/09) — o PRICE oficial escolhido. O CRM lê o
   * price direto do banco (nunca confia no valor/família que o cliente
   * mandou): `valorUnitario` é o que foi NEGOCIADO, `valorTabela` vem do
   * catálogo. É isso que faz desconto não virar produto/price novo.
   */
  catalogoPrecoId?: string | null;
}

/**
 * Lê os prices oficiais escolhidos, com o produto pai. Fonte da verdade de
 * família, natureza de receita, SKU e preço de tabela — o front manda apenas
 * o id do price.
 */
async function carregarPrecosOficiais(ids: (string | null | undefined)[]) {
  const unicos = [...new Set(ids.filter((v): v is string => !!v))];
  if (unicos.length === 0) return new Map<string, {
    id: string; stripePriceId: string; stripeProductId: string | null; sku: string | null;
    variacao: string; valor: string; serviceFamily: string; revenueNature: string; exigeContrato: boolean;
  }>();
  const rows = await db
    .select({
      id: catalogoPrecos.id,
      stripePriceId: catalogoPrecos.stripePriceId,
      sku: catalogoPrecos.sku,
      variacao: catalogoPrecos.variacao,
      valor: catalogoPrecos.valor,
      revenueNature: catalogoPrecos.revenueNature,
      exigeContrato: catalogoPrecos.exigeContrato,
      stripeProductId: servicosCatalogo.stripeProductId,
      serviceFamily: servicosCatalogo.serviceFamily,
    })
    .from(catalogoPrecos)
    .innerJoin(servicosCatalogo, eq(servicosCatalogo.id, catalogoPrecos.servicoCatalogoId))
    .where(inArray(catalogoPrecos.id, unicos));
  return new Map(rows.map((r) => [r.id, r]));
}

function calcSubtotal(qty: number, unit: number, desc: number, descTipo: string = "percentual") {
  if (descTipo === "valor") return Math.round((qty * unit - desc) * 100) / 100;
  return Math.round(qty * unit * (1 - desc / 100) * 100) / 100;
}

export async function criarPropostaComItens(opts: {
  organizacaoId: string;
  leadId: string;
  negocioId: string;
  moeda: string;
  observacoes?: string;
  condicoesPagamento?: string;
  condicaoPagamentoTipo?: string;
  parcelas?: number;
  vencimentoDias?: number;
  prazoContratoMeses?: number | null;
  dataValidade?: string;
  signatarios?: Array<{ nome: string; email: string; papel?: string; ordem?: number }>;
  itens: ItemEntrada[];
  criadoPorId: string;
}) {
  // Esta é a última fronteira antes de persistir uma proposta. A UI e o
  // pipeline já orientam o usuário, mas outros chamadores deste núcleo não
  // podem criar uma proposta para uma oportunidade ainda sem família.
  const [negocio] = await db.execute<{ service_family: string | null }>(sql`
    SELECT service_family
      FROM negocios
     WHERE id = ${opts.negocioId}::uuid
       AND organizacao_id = ${opts.organizacaoId}::uuid
  `);
  if (!negocio) {
    throw new RegraDeNegocio("oportunidade_nao_encontrada", "Oportunidade não encontrada.");
  }
  if (!ehFamiliaValida(negocio.service_family)) {
    throw new RegraDeNegocio(
      "proposta_exige_familia",
      "Defina a família comercial antes de criar uma proposta.",
      { rotulo: "Definir família", tipo: "alterar_familia" },
    );
  }

  const [{ maxNum }] = await db
    .select({ maxNum: sql<number>`COALESCE(MAX(${propostas.numero}), 0)` })
    .from(propostas)
    .where(eq(propostas.organizacaoId, opts.organizacaoId));
  const numero = (maxNum || 0) + 1;

  let totalRecorrente = 0, totalAvulso = 0;
  const itensWithCalc = opts.itens.map((item, idx) => {
    const subtotal = calcSubtotal(item.quantidade, item.valorUnitario, item.desconto, item.descontoTipo);
    if (item.tipo === "recorrente") totalRecorrente += subtotal; else totalAvulso += subtotal;
    return { ...item, subtotal, ordem: item.ordem ?? idx };
  });

  const today = new Date().toISOString().split("T")[0];
  const [proposta] = await db.insert(propostas).values({
    organizacaoId: opts.organizacaoId,
    leadId: opts.leadId,
    negocioId: opts.negocioId,
    numero,
    versao: 1,
    moeda: opts.moeda,
    status: "rascunho",
    dataEmissao: today,
    dataValidade: opts.dataValidade || undefined,
    observacoes: opts.observacoes,
    condicoesPagamento: opts.condicoesPagamento,
    condicaoPagamentoTipo: opts.condicaoPagamentoTipo,
    parcelas: opts.parcelas ?? 1,
    vencimentoDias: opts.vencimentoDias,
    prazoContratoMeses: opts.prazoContratoMeses ?? undefined,
    signatarios: opts.signatarios,
    totalRecorrente: totalRecorrente.toFixed(2),
    totalAvulso: totalAvulso.toFixed(2),
    totalGeral: (totalRecorrente + totalAvulso).toFixed(2),
    criadoPorId: opts.criadoPorId,
  }).returning();

  if (itensWithCalc.length > 0) {
    const familyMap = await resolverServiceFamiliesPorCatalogoIds(itensWithCalc.map((i) => i.servicoCatalogoId));
    const commercialModelMap = await resolverCommercialModelPadraoPorCatalogoIds(itensWithCalc.map((i) => i.servicoCatalogoId));
    // Catálogo Oficial Stripe (02/09) — carrega os prices escolhidos DO BANCO.
    // Nunca confia no que o cliente mandou pra família/natureza/preço de
    // tabela: o front manda só o `catalogoPrecoId`, o resto é lido aqui.
    const precoMap = await carregarPrecosOficiais(itensWithCalc.map((i) => i.catalogoPrecoId));
    await db.insert(propostaItens).values(
      itensWithCalc.map((item) => {
        const preco = item.catalogoPrecoId ? precoMap.get(item.catalogoPrecoId) : undefined;
        return {
          propostaId: proposta.id,
          servicoCatalogoId: item.servicoCatalogoId || undefined,
          nome: item.nome,
          descricao: item.descricao,
          tipo: item.tipo,
          moeda: opts.moeda,
          quantidade: item.quantidade.toString(),
          valorUnitario: item.valorUnitario.toFixed(2),
          desconto: item.desconto.toFixed(2),
          descontoTipo: item.descontoTipo,
          subtotal: item.subtotal.toFixed(2),
          ordem: item.ordem,
          // Família e natureza do PRICE oficial quando existe (é ele que
          // declara), com o catálogo do produto como fallback pro legado.
          serviceFamily: preco?.serviceFamily || (item.servicoCatalogoId ? familyMap.get(item.servicoCatalogoId) || "UNKNOWN" : "UNKNOWN"),
          revenueNature: preco?.revenueNature || mapTipoParaRevenueNature(item.tipo),
          commercialModel: resolverCommercialModelDoItem({ overrideExplicito: item.commercialModel, servicoCatalogoId: item.servicoCatalogoId, catalogoDefaultMap: commercialModelMap }),
          // Rastreabilidade oficial: imutável, não sofre desconto.
          catalogoPrecoId: preco?.id,
          stripeProductId: preco?.stripeProductId,
          stripePriceId: preco?.stripePriceId,
          skuPreco: preco?.sku,
          variacao: preco?.variacao,
          valorTabela: preco?.valor,
        };
      })
    );
  }

  await syncNegocioValoresFromPropostas(opts.negocioId);
  await syncOportunidadeItensFromProposta(proposta.id);

  return { ...proposta, numeroFormatado: `#P-${String(numero).padStart(3, "0")}-v1` };
}
