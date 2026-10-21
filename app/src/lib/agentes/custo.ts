/**
 * Custo da IA: o que cada execução gastou e o teto que impede a conta de
 * fugir.
 *
 * Por que existe: o painel de Execuções mostrava "R$ 0,00" com 229 execuções
 * reais. Os tokens eram gravados, o custo não: no caminho de assinatura
 * (`claude_subscription`, o provider que a produção usa) o `total_cost_usd`
 * devolvido pelo SDK ia parar no JSON do passo e o número gravado era `0`,
 * fixo. Sem custo gravado não há teto possível — painel que não sabe quanto
 * gastou não serve de freio.
 *
 * O teto é de GASTO, não de quantidade de mensagens: o limite por hora foi
 * solto de propósito (matava qualificação no meio da conversa). O que não
 * pode estourar é a conta.
 *
 * Unidade: dólar, a mesma de `ai_agent_runs.custo` (os preços em `ai_models`
 * são por milhão de tokens em USD e o SDK devolve `total_cost_usd`).
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiUsageBudgets } from "@/lib/db/schema";

/**
 * Teto usado quando ninguém configurou nada, em dólares. Conservador de
 * propósito: organização que nunca abriu a tela não acorda com a conta
 * estourada. Para soltar, grave um orçamento em Automações › IA › Orçamento
 * (PUT /automacoes/ai/usage/budgets) com `costLimit` 0 = sem teto.
 */
export const TETO_PADRAO_USD = { dia: 20, mes: 200 } as const;

export type Tetos = { dia: number | null; mes: number | null };
export type Gasto = { dia: number; mes: number };
export type EstouroDeTeto = { periodo: "dia" | "mes"; gasto: number; teto: number };

type LinhaDeOrcamento = {
  agentId: string | null;
  period: string;
  costLimit: string | number | null;
  hardStop: boolean;
  ativo: boolean;
};

/** Preço de um passo a partir do `usage` do modelo e da tabela de preços. */
export function precoPorTokens(
  tokensInput: number,
  tokensOutput: number,
  preco: { inputPricePerMillion?: string | number | null; outputPricePerMillion?: string | number | null } | null | undefined,
): number {
  if (!preco) return 0;
  return (tokensInput / 1_000_000) * Number(preco.inputPricePerMillion ?? 0)
    + (tokensOutput / 1_000_000) * Number(preco.outputPricePerMillion ?? 0);
}

/**
 * Custo que o SDK da assinatura já calculou. Devolve `null` quando ele não
 * veio, para quem chamou cair na tabela de preços em vez de gravar zero.
 */
export function custoEstimadoDoSdk(estimadoUsd: number | null | undefined): number | null {
  const n = Number(estimadoUsd);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Teto de cada período para este agente. Sem linha de orçamento para o
 * período, vale o padrão. Com linha, o que está configurado manda — e limite
 * zero, nulo ou só de aviso (`hardStop` falso) quer dizer sem teto.
 */
export function tetosConfigurados(orcamentos: LinhaDeOrcamento[], agentId: string): Tetos {
  const doPeriodo = (period: "daily" | "monthly", padrao: number): number | null => {
    const linhas = orcamentos.filter((o) => o.ativo && o.period === period && (!o.agentId || o.agentId === agentId));
    if (!linhas.length) return padrao;
    const limites = linhas.filter((o) => o.hardStop).map((o) => Number(o.costLimit ?? 0)).filter((v) => v > 0);
    return limites.length ? Math.min(...limites) : null;
  };
  return { dia: doPeriodo("daily", TETO_PADRAO_USD.dia), mes: doPeriodo("monthly", TETO_PADRAO_USD.mes) };
}

/** O dia vence antes do mês: quem estourou hoje para hoje. */
export function estourouTeto(gasto: Gasto, tetos: Tetos): EstouroDeTeto | null {
  if (tetos.dia != null && gasto.dia >= tetos.dia) return { periodo: "dia", gasto: gasto.dia, teto: tetos.dia };
  if (tetos.mes != null && gasto.mes >= tetos.mes) return { periodo: "mes", gasto: gasto.mes, teto: tetos.mes };
  return null;
}

/** Motivo do bloqueio, no mesmo formato de `taxa_maxima_hora` e `fora_do_horario`. */
export const motivoDoTeto = (e: EstouroDeTeto) => `teto_de_gasto_${e.periodo}` as const;

export async function gastoDaOrganizacao(organizacaoId: string): Promise<Gasto> {
  const [g] = await db.execute<{ dia: string | null; mes: string | null }>(sql`
    SELECT coalesce(sum(custo) FILTER (WHERE started_at >= date_trunc('day', now())), 0) AS dia,
           coalesce(sum(custo), 0) AS mes
      FROM ai_agent_runs
     WHERE organizacao_id = ${organizacaoId}::uuid AND modo = 'live'
       AND started_at >= date_trunc('month', now())`);
  return { dia: Number(g?.dia ?? 0), mes: Number(g?.mes ?? 0) };
}

/** `null` = pode acionar. Qualquer outra coisa é o estouro que barra o agente. */
export async function tetoDeGastoEstourado(organizacaoId: string, agentId: string): Promise<EstouroDeTeto | null> {
  const orcamentos = await db.select().from(aiUsageBudgets)
    .where(and(eq(aiUsageBudgets.organizacaoId, organizacaoId), eq(aiUsageBudgets.ativo, true)));
  const tetos = tetosConfigurados(orcamentos, agentId);
  if (tetos.dia == null && tetos.mes == null) return null;
  return estourouTeto(await gastoDaOrganizacao(organizacaoId), tetos);
}
