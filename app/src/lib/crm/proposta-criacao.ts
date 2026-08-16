/**
 * Núcleo de criação de proposta — extraído de POST /propostas pra ser
 * reutilizável tanto no caminho normal (1 negócio, 1 proposta) quanto no
 * caminho multi-linha (ADR-EXEC-022, lib/crm/oportunidade-bundle.ts), que
 * chama esta função N vezes (uma por negócio-irmão).
 */
import { db } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { propostas, propostaItens } from "@/lib/db/schema";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";
import { syncOportunidadeItensFromProposta, resolverServiceFamiliesPorCatalogoIds, mapTipoParaRevenueNature } from "@/lib/crm/composicao-comercial";
import { resolverCommercialModelPadraoPorCatalogoIds, resolverCommercialModelDoItem } from "@/lib/crm/commercial-model";

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
  dataValidade?: string;
  itens: ItemEntrada[];
  criadoPorId: string;
}) {
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
    totalRecorrente: totalRecorrente.toFixed(2),
    totalAvulso: totalAvulso.toFixed(2),
    totalGeral: (totalRecorrente + totalAvulso).toFixed(2),
    criadoPorId: opts.criadoPorId,
  }).returning();

  if (itensWithCalc.length > 0) {
    const familyMap = await resolverServiceFamiliesPorCatalogoIds(itensWithCalc.map((i) => i.servicoCatalogoId));
    const commercialModelMap = await resolverCommercialModelPadraoPorCatalogoIds(itensWithCalc.map((i) => i.servicoCatalogoId));
    await db.insert(propostaItens).values(
      itensWithCalc.map((item) => ({
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
        serviceFamily: item.servicoCatalogoId ? familyMap.get(item.servicoCatalogoId) || "UNKNOWN" : "UNKNOWN",
        revenueNature: mapTipoParaRevenueNature(item.tipo),
        commercialModel: resolverCommercialModelDoItem({ overrideExplicito: item.commercialModel, servicoCatalogoId: item.servicoCatalogoId, catalogoDefaultMap: commercialModelMap }),
      }))
    );
  }

  await syncNegocioValoresFromPropostas(opts.negocioId);
  await syncOportunidadeItensFromProposta(proposta.id);

  return { ...proposta, numeroFormatado: `#P-${String(numero).padStart(3, "0")}-v1` };
}
