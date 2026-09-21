/**
 * Ponte do Ganho — CUTOVER da fase 16, TEMPORÁRIA.
 *
 * O legado decide Ganho em `lib/crm/won-evidence.ts`, lendo
 * `won_evidence_policies`, que é indexada por FAMÍLIA de produto. O SPEC §15
 * move essa decisão para a OFERTA, porque o mesmo produto pode ser vendido de
 * formas com regras opostas: Callface AI direto ganha no pagamento, por
 * contrato ganha na assinatura. Com uma regra por família, uma das duas está
 * errada por construção — e no banco de produção estava: PABX e White Label
 * ganhavam com contrato assinado e nenhum pagamento, contradizendo o que
 * `won-evidence.ts:19` diz por escrito.
 *
 * Esta ponte liga os dois mundos sem duplicar a regra: a decisão vem de
 * `avaliarGanho`, a MESMA função que o caminho canônico usa. O legado só
 * pergunta.
 *
 * Sai na fase 25, junto com `won_evidence_policies`, quando as telas já lerem
 * `oportunidades`.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { avaliarGanho } from "@onface/catalog";
import { avaliarCondicaoDeGanho } from "@onface/sales";
import { criarRepositorioVendas } from "@onface/platform-database";

/** Oportunidade canônica do negócio legado, quando já existe. */
async function oportunidadeDoNegocio(negocioId: string): Promise<string | null> {
  const r = await db.execute<{ id: string }>(sql`
    SELECT id FROM oportunidades WHERE negocio_id_legado = ${negocioId}::uuid LIMIT 1`);
  return (r as unknown as { id: string }[])[0]?.id ?? null;
}

export interface DecisaoDaOferta {
  /** false = este negócio ainda não tem oportunidade com oferta; decida pelo legado. */
  aplicavel: boolean;
  permitido?: boolean;
  motivo?: string;
  falta?: string[];
}

/**
 * Pergunta à política da OFERTA se este negócio pode ser ganho.
 *
 * Devolve `aplicavel: false` quando o negócio ainda não tem oportunidade
 * canônica com oferta — e aí quem decide é o caminho legado. Isso NÃO é
 * permissividade escondida: a oportunidade sem oferta não pode ser ganha pelo
 * caminho canônico (`SEM_OFERTA`), e são 1.084 nesse estado esperando
 * reconciliação humana. Enquanto o legado for o dono do status, ele continua
 * respondendo por elas com o critério que já tinha.
 */
export async function decidirGanhoPelaOferta(negocioId: string): Promise<DecisaoDaOferta> {
  try {
    const oportunidadeId = await oportunidadeDoNegocio(negocioId);
    if (!oportunidadeId) return { aplicavel: false };

    const repo = criarRepositorioVendas(db as never, sql as never);
    const op = await repo.buscarOportunidade(oportunidadeId);
    if (!op?.ofertaComercialId) return { aplicavel: false };

    const oferta = await repo.buscarOferta(op.ofertaComercialId);
    if (!oferta) return { aplicavel: false };

    const estado = await repo.estadoDaOportunidade(oportunidadeId);
    const decisao = avaliarGanho(oferta, estado);
    return decisao.ganha
      ? { aplicavel: true, permitido: true, motivo: `${decisao.motivo} (política da oferta ${oferta.codigo})` }
      : { aplicavel: true, permitido: false, motivo: `${decisao.motivo} (política da oferta ${oferta.codigo})`, falta: decisao.falta };
  } catch (e) {
    // Falhar aqui não pode travar a venda: cai no legado, que é o dono do
    // status até a fase 25.
    console.error("[ponte-ganho] decisão pela oferta falhou; caindo no legado:", e);
    return { aplicavel: false };
  }
}

/**
 * Depois que o legado marcou o negócio como ganho, leva o mesmo fato ao
 * canônico: marca a oportunidade, publica o evento e cria serviço e jornadas
 * conforme a oferta (SPEC §18 — PABX e White Label levam implantação além do
 * onboarding).
 *
 * Best-effort de propósito: o negócio já está ganho no legado; falhar aqui
 * atrasa o canônico, e o backfill reconcilia.
 */
export async function propagarGanhoCanonico(negocioId: string): Promise<void> {
  try {
    const oportunidadeId = await oportunidadeDoNegocio(negocioId);
    if (!oportunidadeId) return;
    const repo = criarRepositorioVendas(db as never, sql as never);
    const r = await avaliarCondicaoDeGanho(repo, oportunidadeId);
    if (!r.ok) {
      // Não é erro do chamador: é divergência entre os dois modelos, e ela
      // precisa aparecer em vez de sumir.
      console.warn(`[ponte-ganho] negócio ${negocioId} ganho no legado mas não no canônico: ${r.erro} (${r.codigo})`);
      return;
    }
    console.log(`[ponte-ganho] oportunidade ${oportunidadeId} ganha no canônico: ${r.dados.motivo}, ${r.dados.jornadas ?? 0} jornada(s)`);
  } catch (e) {
    console.error("[ponte-ganho] propagação do ganho falhou (best-effort):", e);
  }
}
