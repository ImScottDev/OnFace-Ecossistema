/**
 * Sweep de CS — a única automação periódica do módulo.
 *
 * Roda de hora em hora no worker (`cs-sweep`). Ordem importa: renovação
 * antes de risco, porque `RENOVACAO_SEM_CONTATO` lê `cs_renovacoes`; risco
 * antes das tarefas de risco, pela razão óbvia.
 *
 * Tudo aqui é idempotente por construção — rodar 24x por dia produz o
 * mesmo estado que rodar 1x.
 */
import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { processarMarcosVencidos } from "./jornada";
import { reavaliarRiscos, gerarTarefasDeRisco } from "./riscos";
import { calcularHealth } from "./health";
import { sincronizarRenovacoes, gerarTarefasDeRenovacao } from "./renovacao";

export interface ResultadoSweep {
  organizacaoId: string;
  marcos: number;
  tarefasDeMarco: number;
  renovacoesCriadas: number;
  renovacoesAbertas: number;
  tarefasDeRenovacao: number;
  riscosAbertos: number;
  riscosAtualizados: number;
  riscosResolvidos: number;
  tarefasDeRisco: number;
  healthContas: number;
  healthEmRisco: number;
  healthCobertura: number;
}

export async function rodarSweepCs(organizacaoId: string): Promise<ResultadoSweep> {
  const renov = await sincronizarRenovacoes(organizacaoId);
  const risco = await reavaliarRiscos(organizacaoId);
  const marcos = await processarMarcosVencidos(organizacaoId);
  const tarefasRisco = await gerarTarefasDeRisco(organizacaoId);
  const tarefasRenov = await gerarTarefasDeRenovacao(organizacaoId);
  // O health entra DEPOIS dos riscos: ele lê os riscos abertos como fator, e
  // rodar antes daria a foto de ontem.
  const health = await calcularHealth(organizacaoId);

  return {
    organizacaoId,
    marcos: marcos.marcos,
    tarefasDeMarco: marcos.tarefasCriadas,
    renovacoesCriadas: renov.criadas,
    renovacoesAbertas: renov.abertas,
    tarefasDeRenovacao: tarefasRenov,
    riscosAbertos: risco.abertos,
    riscosAtualizados: risco.atualizados,
    healthContas: health.contas,
    healthEmRisco: health.emRisco,
    healthCobertura: health.coberturaMedia,
    riscosResolvidos: risco.resolvidos,
    tarefasDeRisco: tarefasRisco,
  };
}

export async function rodarSweepCsTodasOrgs(): Promise<ResultadoSweep[]> {
  const orgs = await db.select({ id: organizacoes.id }).from(organizacoes);
  const out: ResultadoSweep[] = [];
  for (const o of orgs) {
    try {
      out.push(await rodarSweepCs(o.id));
    } catch (err) {
      // Uma org quebrada não pode parar as outras.
      console.error(`[cs-sweep] falha na org ${o.id}:`, err);
    }
  }
  return out;
}
