/**
 * Quem recebe um lead que acabou de ser captado, e por quê.
 *
 * Uma decisão só, usada por todas as portas de entrada (criarLead, webhooks da
 * Meta e do RD, POST /leads): regra de distribuição (Ajustes > Leads) que case
 * com a atribuição do lead; sem regra, a política de inbound da organização.
 *
 * Duas regras de uso que existem por causa de bugs reais:
 *   - chame DEPOIS da deduplicação. Lead que já existia não ganha dono novo
 *     e não gasta vez de rodízio;
 *   - chame POR LEAD. Os webhooks resolviam uma vez por requisição, então um
 *     lote de dez leads da Meta ia inteiro para a mesma pessoa.
 */
import {
  MOTIVO_POLITICA_INBOUND, MOTIVO_SEM_DONO, resolverPorRegra, type AtribuicaoCaptacao,
} from "@/lib/agentes/distribuicao";
import { resolverResponsavelInbound } from "@/lib/vendas/pre-vendas";

export type { AtribuicaoCaptacao };
export { MOTIVO_POLITICA_INBOUND, MOTIVO_SEM_DONO };

export interface Distribuicao {
  responsavelId: string | null;
  regraId: string | null;
  sessaoWhatsappId: string | null;
  motivo: string;
  via: "regra_distribuicao" | "politica_inbound";
}

export async function distribuirLeadCaptado(params: {
  organizacaoId: string; atribuicao: AtribuicaoCaptacao; agora?: Date;
}): Promise<Distribuicao> {
  const porRegra = await resolverPorRegra({ organizacaoId: params.organizacaoId, etapa: "novo", agora: params.agora, atribuicao: params.atribuicao });
  if (porRegra) {
    return {
      responsavelId: porRegra.responsavelId, regraId: porRegra.regraId,
      sessaoWhatsappId: porRegra.sessaoWhatsappId, motivo: porRegra.motivo, via: "regra_distribuicao",
    };
  }
  const padrao = await resolverResponsavelInbound(params.organizacaoId);
  return {
    responsavelId: padrao, regraId: null, sessaoWhatsappId: null,
    motivo: padrao ? MOTIVO_POLITICA_INBOUND : MOTIVO_SEM_DONO, via: "politica_inbound",
  };
}

/** Colunas de proveniência para o INSERT do lead (drizzle). */
export function colunasDaDistribuicao(d: Distribuicao) {
  return {
    responsavelId: d.responsavelId,
    distribuicaoRegraId: d.regraId,
    distribuicaoMotivo: d.motivo,
    sessaoWhatsappPreferidaId: d.sessaoWhatsappId,
  };
}
