import { Hono } from "hono";
import { db } from "@/lib/db";
import { negocios, leads, empresas, usuarios, propostas, contratos, propostaGrupoComercial, tarefas } from "@/lib/db/schema";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { getPipelineAtual, getWinRate, getTicketMedio, PIPELINE_ATIVO_STATUSES } from "@/lib/relatorios/comercial";

const app = new Hono();

/**
 * Pipeline (CRM 2.0) — board de OPORTUNIDADES pros closers, sobre a mesma
 * tabela `negocios` que já é fonte de verdade do pipeline operacional
 * (decisão registrada em `qualificacao/Workspace.tsx`). Read-only aqui: a
 * escrita de estágio/won/lost continua no endpoint legado `/api/negocios/:id`
 * (PATCH), reaproveitado sem alteração — este arquivo só serve a leitura
 * enriquecida que o board novo precisa (nome do lead/empresa/responsável
 * num único fetch, sem drawer legado buscando cada um depois).
 *
 * Enriquecimento 17/08 (spec+mockups do Kauã, De/Para Pipeline legado→CRM2):
 * origem real do lead, última proposta vinculada (status/visualização real),
 * contrato pendente de assinatura, grupo comercial com pagamento pendente,
 * próxima tarefa aberta — tudo batch-fetched e reduzido em JS (mesmo padrão
 * de leads.ts), sem window function nova.
 */
app.get("/pipeline-crm2/board", async (c) => {
  const ctx = await getCtx(c);

  const rows = await db
    .select({
      id: negocios.id,
      titulo: negocios.titulo,
      status: negocios.status,
      valorTotal: negocios.valorTotal,
      mrrEstimado: negocios.mrrEstimado,
      mrrFechado: negocios.mrrFechado,
      serviceFamily: negocios.serviceFamily,
      responsavelId: negocios.responsavelId,
      responsavelNome: usuarios.nome,
      leadId: negocios.leadId,
      leadNome: leads.nome,
      leadSobrenome: leads.sobrenome,
      leadEmpresaTexto: leads.empresa,
      leadOrigem: leads.origem,
      leadTelefone: leads.telefone,
      leadEmail: leads.email,
      empresaId: negocios.empresaId,
      empresaNome: empresas.nome,
      previsaoFechamento: negocios.previsaoFechamento,
      motivoPerda: negocios.motivoPerda,
      bundleId: negocios.bundleId,
      createdAt: negocios.createdAt,
      updatedAt: negocios.updatedAt,
      ganhoAt: negocios.ganhoAt,
    })
    .from(negocios)
    .leftJoin(usuarios, eq(usuarios.id, negocios.responsavelId))
    .leftJoin(leads, eq(leads.id, negocios.leadId))
    .leftJoin(empresas, eq(empresas.id, negocios.empresaId))
    .where(eq(negocios.organizacaoId, ctx.organizacaoId))
    .orderBy(sql`${negocios.updatedAt} DESC`)
    .limit(3000);

  const negocioIds = rows.map((n) => n.id);
  const [todasPropostas, todosContratos, todosGrupos, todasTarefas] = negocioIds.length === 0 ? [[], [], [], []] : await Promise.all([
    db
      .select({ negocioId: propostas.negocioId, numero: propostas.numero, status: propostas.status, totalGeral: propostas.totalGeral, primeiraVisualizacaoEm: propostas.primeiraVisualizacaoEm, clienteRespondeuEm: propostas.clienteRespondeuEm, dataValidade: propostas.dataValidade, createdAt: propostas.createdAt })
      .from(propostas)
      .where(inArray(propostas.negocioId, negocioIds))
      .orderBy(desc(propostas.createdAt)),
    db
      .select({ negocioId: contratos.negocioId, status: contratos.status })
      .from(contratos)
      .where(inArray(contratos.negocioId, negocioIds)),
    db
      .select({ negocioId: propostaGrupoComercial.negocioId, status: propostaGrupoComercial.status })
      .from(propostaGrupoComercial)
      .where(inArray(propostaGrupoComercial.negocioId, negocioIds)),
    db
      .select({ negocioId: tarefas.negocioId, titulo: tarefas.titulo, dataVencimento: tarefas.dataVencimento })
      .from(tarefas)
      .where(and(inArray(tarefas.negocioId, negocioIds), eq(tarefas.concluida, false)))
      .orderBy(tarefas.dataVencimento),
  ]);

  const propostaPorNegocio = new Map<string, typeof todasPropostas[number]>();
  for (const p of todasPropostas) {
    if (p.negocioId && !propostaPorNegocio.has(p.negocioId)) propostaPorNegocio.set(p.negocioId, p); // já ordenado desc createdAt = mais recente primeiro
  }
  const contratoPendentePorNegocio = new Set(todosContratos.filter((ct) => ct.status === "pendente_assinatura").map((ct) => ct.negocioId));
  const pagamentoPendentePorNegocio = new Set(todosGrupos.filter((g) => g.status === "pagamento_pendente").map((g) => g.negocioId));
  const proximaTarefaPorNegocio = new Map<string, typeof todasTarefas[number]>();
  for (const t of todasTarefas) {
    if (t.negocioId && !proximaTarefaPorNegocio.has(t.negocioId)) proximaTarefaPorNegocio.set(t.negocioId, t); // já ordenado por dataVencimento asc
  }
  const bundleCount = new Map<string, number>();
  for (const n of rows) {
    if (n.bundleId) bundleCount.set(n.bundleId, (bundleCount.get(n.bundleId) || 0) + 1);
  }

  return c.json({
    negocios: rows.map((n) => {
      const proposta = propostaPorNegocio.get(n.id) || null;
      const proximaTarefa = proximaTarefaPorNegocio.get(n.id) || null;
      return {
        ...n,
        empresaNome: n.empresaNome || n.leadEmpresaTexto || null,
        proposta: proposta ? { numero: proposta.numero, status: proposta.status, totalGeral: proposta.totalGeral, primeiraVisualizacaoEm: proposta.primeiraVisualizacaoEm, clienteRespondeuEm: proposta.clienteRespondeuEm, dataValidade: proposta.dataValidade } : null,
        contratoPendente: contratoPendentePorNegocio.has(n.id),
        pagamentoPendente: pagamentoPendentePorNegocio.has(n.id),
        proximaAcao: proximaTarefa ? { titulo: proximaTarefa.titulo, dataVencimento: proximaTarefa.dataVencimento } : null,
        oportunidadesRelacionadas: n.bundleId ? (bundleCount.get(n.bundleId) || 1) - 1 : 0,
      };
    }),
  });
});

// ── GET /pipeline-crm2/resumo — KPIs reais (reaproveita lib/relatorios/comercial.ts) ──

app.get("/pipeline-crm2/resumo", async (c) => {
  const ctx = await getCtx(c);
  const responsavelId = c.req.query("responsavelId") || null;
  const periodo = c.req.query("periodo") || "mes"; // mes | tudo

  const now = new Date();
  const since = periodo === "tudo" ? new Date(2000, 0, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
  const until = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [pipelineAtivo, winRate, ticketMedio] = await Promise.all([
    getPipelineAtual(ctx.organizacaoId, responsavelId),
    getWinRate(ctx.organizacaoId, since, until, responsavelId),
    getTicketMedio(ctx.organizacaoId, since, until, responsavelId),
  ]);

  // "Sem próxima ação/atrasadas" — negócios ABERTOS sem tarefa pendente futura,
  // ou cuja próxima tarefa já venceu. Real, calculado aqui (não existia
  // relatório pronto pra essa métrica específica).
  const condicoesAbertos = [eq(negocios.organizacaoId, ctx.organizacaoId), inArray(negocios.status, PIPELINE_ATIVO_STATUSES)];
  if (responsavelId) condicoesAbertos.push(eq(negocios.responsavelId, responsavelId));
  const negociosAbertosIds = await db.select({ id: negocios.id }).from(negocios).where(and(...condicoesAbertos));
  const ids = negociosAbertosIds.map((n) => n.id);
  let semProximaAcao = 0;
  if (ids.length > 0) {
    const tarefasAbertas = await db
      .select({ negocioId: tarefas.negocioId, dataVencimento: tarefas.dataVencimento })
      .from(tarefas)
      .where(and(inArray(tarefas.negocioId, ids), eq(tarefas.concluida, false)));
    const hoje = new Date().toISOString().split("T")[0];
    const temAcaoFutura = new Set(tarefasAbertas.filter((t) => !t.dataVencimento || t.dataVencimento >= hoje).map((t) => t.negocioId));
    semProximaAcao = ids.filter((id) => !temAcaoFutura.has(id)).length;
  }

  return c.json({
    pipelineAberto: pipelineAtivo.total,
    forecast: pipelineAtivo.ponderado,
    oportunidadesAbertas: pipelineAtivo.negociosAbertos,
    ticketMedio,
    winRate: winRate.taxa,
    winRateAmostraPequena: winRate.amostraPequena,
    semProximaAcao,
  });
});

export { app as pipelineCrm2Routes };
