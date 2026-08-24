/**
 * Commercial Core v3 (ADR-EXEC-022) — correção da unidade operacional do
 * pipeline. Achado real (correção do Kauã sobre o v2): uma oportunidade não
 * deve conter simultaneamente linhas comerciais INDEPENDENTES (Callface AI +
 * PABX) — isso cria ambiguidade de pipeline (stage/aging/responsável/
 * resultado de quem?). Cada linha com ciclo próprio vira sua PRÓPRIA
 * oportunidade; as nascidas da mesma negociação ficam relacionadas via
 * oportunidade_bundle (agregação, nunca status).
 *
 * O que NÃO muda: itens da MESMA linha continuam na MESMA oportunidade
 * (White Label licença+setup+adicional = 1 oportunidade só, com N
 * oportunidade_itens — ver ADR-EXEC-019). A separação é por FAMÍLIA
 * (service_family), não por item.
 */
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { negocios, leads, oportunidadeBundle } from "@/lib/db/schema";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";
import { criarPropostaComItens, type ItemEntrada } from "@/lib/crm/proposta-criacao";
import { resolverServiceFamiliesPorCatalogoIds } from "@/lib/crm/composicao-comercial";

export const FAMILY_LABEL: Record<string, string> = { CALLFACE_AI: "Callface AI", PABX: "PABX", WHITE_LABEL: "White Label", UNKNOWN: "Outros" };

/** Agrupa um carrinho de itens por linha comercial (service_family do catálogo). */
export async function agruparItensPorLinhaComercial(itens: ItemEntrada[]): Promise<Map<string, ItemEntrada[]>> {
  const familyMap = await resolverServiceFamiliesPorCatalogoIds(itens.map((i) => i.servicoCatalogoId));
  const grupos = new Map<string, ItemEntrada[]>();
  for (const item of itens) {
    const familia = item.servicoCatalogoId ? familyMap.get(item.servicoCatalogoId) || "UNKNOWN" : "UNKNOWN";
    const lista = grupos.get(familia) || [];
    lista.push(item);
    grupos.set(familia, lista);
  }
  return grupos;
}

export interface OportunidadeCriada {
  family: string;
  label: string;
  negocioId: string;
  propostaId: string;
  propostaNumeroFormatado: string;
}

/**
 * Organiza uma venda multi-linha: 1 bundle + N oportunidades (negócios),
 * cada uma com sua própria proposta contendo só os itens da SUA família.
 * Se `negocioBaseId` for passado (proposta criada a partir de um negócio já
 * existente), ele é reaproveitado pra PRIMEIRA família — as demais ganham
 * negócios-irmãos novos. Nenhuma duplicação invisível: cada oportunidade
 * nova é uma linha real, visível e nomeada no pipeline.
 */
export async function organizarVendaMultiLinha(opts: {
  organizacaoId: string;
  leadId: string;
  responsavelId?: string | null;
  negocioBaseId?: string | null;
  itensPorFamilia: Map<string, ItemEntrada[]>;
  moeda: string;
  observacoes?: string;
  condicoesPagamento?: string;
  prazoContratoMeses?: number | null;
  dataValidade?: string;
  signatarios?: Array<{ nome: string; email: string; papel?: string; ordem?: number }>;
  criadoPorId: string;
}): Promise<{ bundleId: string; oportunidades: OportunidadeCriada[] }> {
  const [lead] = await db
    .select({ nome: leads.nome, empresa: leads.empresa, empresaId: leads.empresaId, responsavelId: leads.responsavelId })
    .from(leads)
    .where(eq(leads.id, opts.leadId))
    .limit(1);
  if (!lead) throw new Error("Lead não encontrado");

  const nomeBase = lead.empresa || lead.nome || "Negociação";
  const [bundle] = await db.insert(oportunidadeBundle).values({
    organizacaoId: opts.organizacaoId,
    nome: `${nomeBase} — Nova venda`,
    leadId: opts.leadId,
    empresaId: lead.empresaId,
  }).returning();

  const resultados: OportunidadeCriada[] = [];
  let primeiraFamilia = true;

  for (const [family, itens] of opts.itensPorFamilia) {
    const label = FAMILY_LABEL[family] || family;
    let negocioId: string;

    if (primeiraFamilia && opts.negocioBaseId) {
      negocioId = opts.negocioBaseId;
      await db.update(negocios).set({ bundleId: bundle.id, titulo: `${nomeBase} · ${label}`, updatedAt: new Date() }).where(eq(negocios.id, negocioId));
    } else {
      const [novoNeg] = await db.insert(negocios).values({
        organizacaoId: opts.organizacaoId,
        leadId: opts.leadId,
        empresaId: lead.empresaId,
        titulo: `${nomeBase} · ${label}`,
        status: "proposta_apresentada",
        responsavelId: opts.responsavelId ?? lead.responsavelId,
        origemNegocio: "novo",
        origemQualificacao: "direta",
        bundleId: bundle.id,
      }).returning({ id: negocios.id });
      negocioId = novoNeg.id;
    }

    await syncOportunidadeFromNegocio(negocioId);

    const proposta = await criarPropostaComItens({
      organizacaoId: opts.organizacaoId, leadId: opts.leadId, negocioId, moeda: opts.moeda,
      observacoes: opts.observacoes, condicoesPagamento: opts.condicoesPagamento, prazoContratoMeses: opts.prazoContratoMeses, dataValidade: opts.dataValidade,
      signatarios: opts.signatarios,
      itens, criadoPorId: opts.criadoPorId,
    });

    resultados.push({ family, label, negocioId, propostaId: proposta.id, propostaNumeroFormatado: proposta.numeroFormatado });
    primeiraFamilia = false;
  }

  return { bundleId: bundle.id, oportunidades: resultados };
}

/** Oportunidades irmãs de um negócio (mesmo bundle) — pra tela de negócio mostrar "esta negociação também inclui...". */
export async function listarOportunidadesIrmas(negocioId: string) {
  const [negocio] = await db.select({ bundleId: negocios.bundleId }).from(negocios).where(eq(negocios.id, negocioId)).limit(1);
  if (!negocio?.bundleId) return [];
  return db
    .select({ id: negocios.id, titulo: negocios.titulo, status: negocios.status, valorTotal: negocios.valorTotal, mrrFechado: negocios.mrrFechado, mrrEstimado: negocios.mrrEstimado })
    .from(negocios)
    .where(eq(negocios.bundleId, negocio.bundleId));
}
