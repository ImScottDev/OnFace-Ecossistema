/**
 * F6 (Analytics) — Snapshot diário de agregados de empresa, separado da OLTP.
 *
 * O dashboard hoje recomputa esses números a cada carregamento de página
 * (10+ blocos de query síncrona). Este módulo pré-computa o mesmo resultado
 * uma vez (via job agendado) e grava em `metricas_diarias`, pra leitura
 * futura não precisar mais bater direto na OLTP a cada request.
 *
 * IMPORTANTE: chama as MESMAS funções canônicas já usadas pelo dashboard
 * (getMetaComercialAgregada/getPipelineAtual/getFechadoPeriodo) — nunca
 * reimplementa a lógica de agregação. O dashboard já teve bug real de
 * contagem duplicada quando dois lugares calculavam a mesma coisa de forma
 * diferente (ver comentário em dashboard/page.tsx, achado 22/07) — esse é
 * exatamente o padrão que este módulo evita repetir.
 *
 * Escopo desta rodada: só o agregado de EMPRESA (visão admin/gerente,
 * soMeu=false). Não substitui o dashboard ainda (strangler pattern, mesmo
 * critério do resto do projeto) — só constrói e valida a infra de
 * projeção. Trocar o dashboard pra ler daqui é um passo futuro separado,
 * depois de rodar de verdade por um tempo.
 */
import { db } from "@/lib/db";
import { metricasDiarias } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { getMetaComercialAgregada } from "@/lib/metas";
import { getPipelineAtual, getFechadoPeriodo } from "@/lib/relatorios/comercial";

export async function calcularSnapshotDiario(organizacaoId: string) {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const hoje = now.toISOString().split("T")[0];

  const [metaEmpresa, pipelineAtual, fechadoMes, mrrStripeRows, mrrRiscoRows] = await Promise.all([
    getMetaComercialAgregada(organizacaoId, now),
    getPipelineAtual(organizacaoId, undefined),
    getFechadoPeriodo(organizacaoId, thisMonthStart, now, undefined),
    db.execute(sql`
      SELECT COALESCE(sum(mrr::numeric),0) AS mrr, count(DISTINCT lead_id) AS clientes
      FROM assinaturas WHERE organizacao_id = ${organizacaoId} AND status IN ('active','trialing','past_due')
    `),
    db.execute(sql`
      SELECT COALESCE(sum(mrr::numeric),0) AS mrr, count(*) AS qtd
      FROM assinaturas WHERE organizacao_id = ${organizacaoId} AND status = 'unpaid'
    `),
  ]);

  const mrrStripeRow = (mrrStripeRows as unknown as { mrr: unknown; clientes: unknown }[])[0] ?? { mrr: 0, clientes: 0 };
  const mrrRiscoRow = (mrrRiscoRows as unknown as { mrr: unknown; qtd: unknown }[])[0] ?? { mrr: 0, qtd: 0 };

  const snapshot = {
    organizacaoId,
    data: hoje,
    metaValorAlvo: String(metaEmpresa.valorAlvo),
    metaRealizado: String(metaEmpresa.realizado),
    metaClosers: metaEmpresa.closers,
    pipelineTotal: String(pipelineAtual.total),
    pipelinePonderado: String(pipelineAtual.ponderado),
    pipelineNegociosAbertos: pipelineAtual.negociosAbertos,
    fechadoMesGanhos: fechadoMes.ganhos,
    fechadoMesReceita: String(fechadoMes.receita),
    fechadoMesRecorrente: String(fechadoMes.recorrente),
    fechadoMesAvulso: String(fechadoMes.avulso),
    mrrStripe: String(Number(mrrStripeRow.mrr) || 0),
    mrrStripeClientes: Number(mrrStripeRow.clientes) || 0,
    mrrRisco: String(Number(mrrRiscoRow.mrr) || 0),
    mrrRiscoQtd: Number(mrrRiscoRow.qtd) || 0,
  };

  await db
    .insert(metricasDiarias)
    .values(snapshot)
    .onConflictDoUpdate({
      target: [metricasDiarias.organizacaoId, metricasDiarias.data],
      set: { ...snapshot, calculadoEm: new Date() },
    });

  return snapshot;
}

/** Calcula o snapshot de hoje pra todas as organizações ativas. Best-effort por org. */
export async function calcularSnapshotDiarioTodasOrgs() {
  const { organizacoes } = await import("@/lib/db/schema");
  const orgs = await db.select({ id: organizacoes.id }).from(organizacoes);
  for (const org of orgs) {
    try {
      await calcularSnapshotDiario(org.id);
    } catch (err) {
      console.error(`[F6/snapshot-diario] falha ao calcular snapshot da org ${org.id} (best-effort):`, err);
    }
  }
}
