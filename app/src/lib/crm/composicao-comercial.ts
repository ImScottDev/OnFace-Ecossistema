/**
 * F4 (Commercial Core) — Composição comercial da Oportunidade.
 *
 * ADR-EXEC-020: oportunidade_itens materializa, de forma incremental e
 * idempotente, a composição comercial real de uma oportunidade a partir dos
 * itens de uma proposta (proposta_itens) — mesmo padrão de dual-write já
 * usado em sync-domain-model.ts (select-then-branch, idempotente por chave
 * de bridge, nunca lança erro que quebre o fluxo legado).
 *
 * Família/natureza NUNCA são inferidas por nome de produto em runtime:
 * família vem do catálogo (servicos_catalogo.service_family, declarada);
 * natureza vem do tipo estrutural do item de proposta (recorrente|avulso|
 * setup) — mapeamento explícito, não string-match.
 */
import { db } from "@/lib/db";
import { eq, and, inArray, notInArray } from "drizzle-orm";
import { propostas, propostaItens, servicosCatalogo, oportunidades, oportunidadeItens, negocios } from "@/lib/db/schema";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";

export type ServiceFamily = "PABX" | "CALLFACE_AI" | "WHITE_LABEL" | "UNKNOWN";
export type RevenueNature = "MRR" | "SETUP" | "PROJECT" | "ONE_TIME" | "USAGE" | "HARDWARE" | "UNKNOWN";

/**
 * tipo do item de proposta -> natureza de receita. "avulso" é mapeado por
 * padrão pra ONE_TIME (opção conservadora) — pode não cobrir corretamente um
 * "avulso" que na prática seja um PROJECT grande ou USAGE variável; isso é
 * calibração comercial, não decisão técnica, registrada em
 * crm2-decisoes-pendentes.md.
 */
const TIPO_PARA_REVENUE_NATURE: Record<string, RevenueNature> = {
  recorrente: "MRR",
  setup: "SETUP",
  avulso: "ONE_TIME",
};

export function mapTipoParaRevenueNature(tipo: string): RevenueNature {
  return TIPO_PARA_REVENUE_NATURE[tipo] ?? "UNKNOWN";
}

/**
 * Resolve service_family pra um lote de servico_catalogo_id — usado no
 * momento de CRIAR/EDITAR itens de proposta (proposta_itens.service_family
 * nasce já preenchido, não fica pra inferir depois em oportunidade_itens).
 */
export async function resolverServiceFamiliesPorCatalogoIds(catalogoIds: (string | null | undefined)[]): Promise<Map<string, ServiceFamily>> {
  const ids = [...new Set(catalogoIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: servicosCatalogo.id, serviceFamily: servicosCatalogo.serviceFamily })
    .from(servicosCatalogo)
    .where(inArray(servicosCatalogo.id, ids));
  return new Map(rows.map((r) => [r.id, (r.serviceFamily as ServiceFamily) || "UNKNOWN"]));
}

async function resolverOportunidadeIdDoNegocio(negocioId: string): Promise<string | null> {
  const [existente] = await db.select({ id: oportunidades.id }).from(oportunidades).where(eq(oportunidades.negocioIdLegado, negocioId)).limit(1);
  if (existente) return existente.id;
  await syncOportunidadeFromNegocio(negocioId);
  const [criada] = await db.select({ id: oportunidades.id }).from(oportunidades).where(eq(oportunidades.negocioIdLegado, negocioId)).limit(1);
  return criada?.id ?? null;
}

/**
 * Materializa oportunidade_itens a partir dos itens reais de uma proposta —
 * representa a composição comercial ATIVA da oportunidade (a proposta mais
 * recentemente sincronizada), não uma soma histórica de todas as propostas/
 * versões já criadas: itens de origem "proposta_item" que não pertencem a
 * ESTA proposta são removidos antes do upsert (uma nova versão substitui a
 * anterior, uma proposta nova substitui uma proposta rejeitada antiga).
 *
 * Idempotente por proposta_item_id_legado (select-then-branch, não
 * ON CONFLICT — o índice é parcial e o padrão do resto do domain model já
 * resolve assim). Best-effort: falha aqui nunca derruba o fluxo real de
 * proposta/negócio.
 */
export async function syncOportunidadeItensFromProposta(propostaId: string): Promise<void> {
  try {
    const [proposta] = await db
      .select({ id: propostas.id, organizacaoId: propostas.organizacaoId, negocioId: propostas.negocioId })
      .from(propostas)
      .where(eq(propostas.id, propostaId))
      .limit(1);
    if (!proposta || !proposta.negocioId) return;

    const oportunidadeId = await resolverOportunidadeIdDoNegocio(proposta.negocioId);
    if (!oportunidadeId) return;

    const itens = await db.select().from(propostaItens).where(eq(propostaItens.propostaId, propostaId));

    const itemIds = itens.map((i) => i.id);
    if (itemIds.length > 0) {
      await db
        .delete(oportunidadeItens)
        .where(
          and(
            eq(oportunidadeItens.oportunidadeId, oportunidadeId),
            eq(oportunidadeItens.origemLegado, "proposta_item"),
            notInArray(oportunidadeItens.propostaItemIdLegado, itemIds)
          )
        );
    } else {
      await db.delete(oportunidadeItens).where(and(eq(oportunidadeItens.oportunidadeId, oportunidadeId), eq(oportunidadeItens.origemLegado, "proposta_item")));
    }

    const catalogoIds = [...new Set(itens.map((i) => i.servicoCatalogoId).filter((id): id is string => !!id))];
    const familyMap = new Map<string, ServiceFamily>();
    if (catalogoIds.length > 0) {
      const rows = await db
        .select({ id: servicosCatalogo.id, serviceFamily: servicosCatalogo.serviceFamily })
        .from(servicosCatalogo)
        .where(inArray(servicosCatalogo.id, catalogoIds));
      for (const r of rows) familyMap.set(r.id, (r.serviceFamily as ServiceFamily) || "UNKNOWN");
    }

    for (const item of itens) {
      const serviceFamily: ServiceFamily =
        (item.serviceFamily as ServiceFamily) || (item.servicoCatalogoId ? familyMap.get(item.servicoCatalogoId) : undefined) || "UNKNOWN";
      const revenueNature: RevenueNature = (item.revenueNature as RevenueNature) || mapTipoParaRevenueNature(item.tipo);

      const valores = {
        organizacaoId: proposta.organizacaoId,
        oportunidadeId,
        produto: item.nome,
        serviceFamily,
        revenueNature,
        quantidade: item.quantidade,
        precoUnitario: item.valorUnitario,
        desconto: item.desconto ?? "0",
        valorTotal: item.subtotal,
        updatedAt: new Date(),
      };

      const [existente] = await db
        .select({ id: oportunidadeItens.id })
        .from(oportunidadeItens)
        .where(eq(oportunidadeItens.propostaItemIdLegado, item.id))
        .limit(1);

      if (existente) {
        await db.update(oportunidadeItens).set(valores).where(eq(oportunidadeItens.id, existente.id));
      } else {
        await db.insert(oportunidadeItens).values({ ...valores, origemLegado: "proposta_item", propostaItemIdLegado: item.id });
      }
    }
  } catch (err) {
    console.error(`[composicao-comercial] falha ao sincronizar oportunidade_itens da proposta ${propostaId} (best-effort):`, err);
  }
}

/** camposCustom.produto do negócio -> família comercial. Só usado no fallback manual (sem proposta nenhuma vinculada). */
function mapProdutoNegocioParaServiceFamily(produto: string | null): ServiceFamily {
  if (produto === "ai") return "CALLFACE_AI";
  if (produto === "pabx") return "PABX";
  if (produto === "white_label") return "WHITE_LABEL";
  return "UNKNOWN";
}

/**
 * Fallback pro Won 100% manual (drag-and-drop / PATCH direto de status, sem
 * NENHUMA proposta por trás — o outro caminho legado de Won suportado desde
 * sempre, ver won-evidence.ts). Sem isso, um negócio fechado manualmente
 * nunca teria composição comercial nem gera serviço canônico. Só roda se a
 * oportunidade ainda não tiver NENHUM item (se já veio de proposta, este
 * fallback nunca sobrescreve).
 */
export async function garantirItemComercialManual(negocioId: string): Promise<void> {
  try {
    const oportunidadeId = await resolverOportunidadeIdDoNegocio(negocioId);
    if (!oportunidadeId) return;

    const [jaTemItem] = await db.select({ id: oportunidadeItens.id }).from(oportunidadeItens).where(eq(oportunidadeItens.oportunidadeId, oportunidadeId)).limit(1);
    if (jaTemItem) return;

    const [negocio] = await db
      .select({ organizacaoId: negocios.organizacaoId, camposCustom: negocios.camposCustom, mrrFechado: negocios.mrrFechado, mrrEstimado: negocios.mrrEstimado, valorTotal: negocios.valorTotal, valorSetup: negocios.valorSetup, titulo: negocios.titulo })
      .from(negocios)
      .where(eq(negocios.id, negocioId))
      .limit(1);
    if (!negocio) return;

    const produtoRaw = (negocio.camposCustom as Record<string, unknown> | null)?.produto;
    const serviceFamily = mapProdutoNegocioParaServiceFamily(typeof produtoRaw === "string" ? produtoRaw : null);

    const mrr = parseFloat(negocio.mrrFechado || negocio.mrrEstimado || "0");
    const setup = parseFloat(negocio.valorSetup || "0");
    const valorTotal = parseFloat(negocio.valorTotal || "0");

    // Um negócio manual pode carregar MRR + setup ao mesmo tempo (ex: PABX
    // fechado fora do fluxo de proposta) — gera um item por natureza presente,
    // nunca um item só "somando tudo" (mesma regra de não colapsar
    // família/natureza numa coisa só).
    const itensParaCriar: { revenueNature: RevenueNature; valor: number }[] = [];
    if (mrr > 0) itensParaCriar.push({ revenueNature: "MRR", valor: mrr });
    if (setup > 0) itensParaCriar.push({ revenueNature: "SETUP", valor: setup });
    if (itensParaCriar.length === 0 && valorTotal > 0) itensParaCriar.push({ revenueNature: "ONE_TIME", valor: valorTotal });
    if (itensParaCriar.length === 0) return; // negócio sem valor nenhum — nada a materializar

    for (const it of itensParaCriar) {
      await db.insert(oportunidadeItens).values({
        organizacaoId: negocio.organizacaoId,
        oportunidadeId,
        produto: negocio.titulo,
        serviceFamily,
        revenueNature: it.revenueNature,
        quantidade: "1",
        precoUnitario: it.valor.toFixed(2),
        valorTotal: it.valor.toFixed(2),
        origemLegado: "manual",
      });
    }
  } catch (err) {
    console.error(`[composicao-comercial] falha ao garantir item comercial manual do negocio ${negocioId} (best-effort):`, err);
  }
}

/**
 * Limpa os itens de origem "proposta_item" da composição comercial de um
 * negócio ANTES de reescrever proposta_itens — necessário porque
 * oportunidade_itens.proposta_item_id_legado é FK (RESTRICT) pra
 * proposta_itens: sem isso, o DELETE FROM proposta_itens do
 * PATCH /propostas/:id falha com violação de FK.
 */
export async function limparOportunidadeItensDeOrigemProposta(negocioId: string): Promise<void> {
  try {
    const [oportunidade] = await db.select({ id: oportunidades.id }).from(oportunidades).where(eq(oportunidades.negocioIdLegado, negocioId)).limit(1);
    if (!oportunidade) return;
    await db
      .delete(oportunidadeItens)
      .where(and(eq(oportunidadeItens.oportunidadeId, oportunidade.id), eq(oportunidadeItens.origemLegado, "proposta_item")));
  } catch (err) {
    console.error(`[composicao-comercial] falha ao limpar oportunidade_itens do negocio ${negocioId} (best-effort):`, err);
  }
}
