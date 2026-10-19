// Automações → Execuções (19/08) — visão UNIFICADA de observabilidade.
// Achado real (investigação 19/08): não existia nenhuma tela cross-cutting —
// só histórico por-regra dentro do card de cada automação
// (`automacao_execucoes`) e os eventos de cadência (`cadence_enrollment_events`).
// Esta rota junta as duas fontes reais num único formato, sem inventar dado.
import { Hono } from "hono";
import { db } from "@/lib/db";
import {
  automacoes, automacaoExecucoes,
  cadenceDefinitions, cadenceEnrollments, cadenceEnrollmentEvents,
} from "@/lib/db/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { getCtx, qp } from "../compat.js";

// Vocabulário unificado de status pra UI. `automacao_execucoes.status` usa
// "sucesso"; `cadence_enrollment_events.status` usa "executado" pro mesmo
// significado — normalizado aqui (saída E filtro) pra "sucesso" nos dois
// sentidos, senão a UI precisaria conhecer 2 vocabulários diferentes.
// "erro" e "condicao_nao_atendida" já são literalmente iguais nas 2 tabelas.
// "retry_agendado" e "cancelado" só existem em cadência (automação não tem).
type StatusUnificado = "sucesso" | "erro" | "condicao_nao_atendida" | "retry_agendado" | "cancelado";

const STATUS_VALIDOS: StatusUnificado[] = ["sucesso", "erro", "condicao_nao_atendida", "retry_agendado", "cancelado"];

// Filtro (?status=) -> valor real na coluna de cada fonte.
// null = esse status não existe nessa fonte (não faz sentido nem consultar).
const FILTRO_AUTOMACAO: Record<StatusUnificado, string | null> = {
  sucesso: "sucesso",
  erro: "erro",
  condicao_nao_atendida: "condicao_nao_atendida",
  retry_agendado: null,
  cancelado: null,
};

const FILTRO_CADENCIA: Record<StatusUnificado, string | null> = {
  sucesso: "executado",
  erro: "erro",
  condicao_nao_atendida: "condicao_nao_atendida",
  retry_agendado: "retry_agendado",
  cancelado: "cancelado",
};

function normalizaStatusAutomacao(status: string): StatusUnificado {
  return status === "sucesso" ? "sucesso" : (status as StatusUnificado);
}

function normalizaStatusCadencia(status: string): StatusUnificado {
  return status === "executado" ? "sucesso" : (status as StatusUnificado);
}

// Resumo curto pra exibir na linha: erro tem prioridade, senão tenta extrair
// um campo textual comum do resultado jsonb, senão faz fallback pro JSON cru.
function resumoResultado(resultado: unknown, erro: string | null): string | null {
  if (erro) return erro.length > 300 ? `${erro.slice(0, 300)}…` : erro;
  if (resultado && typeof resultado === "object") {
    const r = resultado as Record<string, unknown>;
    const campo = r.message ?? r.motivo ?? r.detalhe ?? r.texto;
    if (typeof campo === "string" && campo.length > 0) {
      return campo.length > 300 ? `${campo.slice(0, 300)}…` : campo;
    }
    try {
      const json = JSON.stringify(resultado);
      if (!json || json === "{}") return null;
      return json.length > 200 ? `${json.slice(0, 200)}…` : json;
    } catch {
      return null;
    }
  }
  return null;
}

interface ExecucaoUnificada {
  id: string;
  tipo: "automacao" | "cadencia";
  nome: string;
  status: StatusUnificado;
  entityType: string;
  entityId: string;
  detalhe: string | null;
  executedAt: Date;
}

const app = new Hono();

// GET /automacoes/execucoes — últimas ~50 execuções (automações + cadências)
// juntas, ordenadas por data, com filtro opcional por status.
app.get("/automacoes/execucoes", async (c) => {
  const ctx = await getCtx(c);
  const statusParam = qp(c, "status");
  const statusFiltro = statusParam && STATUS_VALIDOS.includes(statusParam as StatusUnificado)
    ? (statusParam as StatusUnificado)
    : null;

  // ── Fonte 1: automacao_execucoes ────────────────────────────────────────
  let execAutomacoes: ExecucaoUnificada[] = [];
  const filtroAutomacaoValor = statusFiltro ? FILTRO_AUTOMACAO[statusFiltro] : undefined;
  // undefined = sem filtro pedido (busca tudo da org); null = o status pedido
  // não existe nessa fonte (não busca nada); string = filtra por esse valor
  if (filtroAutomacaoValor !== null) {
    const whereAutomacao = filtroAutomacaoValor
      ? and(eq(automacaoExecucoes.organizacaoId, ctx.organizacaoId), eq(automacaoExecucoes.status, filtroAutomacaoValor))
      : eq(automacaoExecucoes.organizacaoId, ctx.organizacaoId);

    const rows = await db
      .select({
        id: automacaoExecucoes.id,
        nome: automacoes.nome,
        status: automacaoExecucoes.status,
        entityType: automacaoExecucoes.entityType,
        entityId: automacaoExecucoes.entityId,
        resultado: automacaoExecucoes.resultado,
        erro: automacaoExecucoes.erro,
        executedAt: automacaoExecucoes.executedAt,
      })
      .from(automacaoExecucoes)
      .innerJoin(automacoes, eq(automacaoExecucoes.automacaoId, automacoes.id))
      .where(whereAutomacao)
      .orderBy(desc(automacaoExecucoes.executedAt))
      .limit(50);

    execAutomacoes = rows.map((r) => ({
      id: r.id,
      tipo: "automacao" as const,
      nome: r.nome,
      status: normalizaStatusAutomacao(r.status),
      // Execução de fluxo sem registro (agendado "nenhum", webhook) tem entidade nula.
      entityType: r.entityType ?? "",
      entityId: r.entityId ?? "",
      detalhe: resumoResultado(r.resultado, r.erro),
      executedAt: r.executedAt,
    }));
  }

  // ── Fonte 2: cadence_enrollment_events (join enrollment -> definition) ──
  let execCadencias: ExecucaoUnificada[] = [];
  const filtroCadenciaValor = statusFiltro ? FILTRO_CADENCIA[statusFiltro] : undefined;
  if (filtroCadenciaValor !== null) {
    const acesso = or(eq(cadenceDefinitions.visibility, "shared"), eq(cadenceDefinitions.ownerId, ctx.userId));
    const whereCadencia = filtroCadenciaValor
      ? and(eq(cadenceEnrollments.organizacaoId, ctx.organizacaoId), acesso, eq(cadenceEnrollmentEvents.status, filtroCadenciaValor))
      : and(eq(cadenceEnrollments.organizacaoId, ctx.organizacaoId), acesso);

    const rows = await db
      .select({
        id: cadenceEnrollmentEvents.id,
        nome: cadenceDefinitions.nome,
        status: cadenceEnrollmentEvents.status,
        entityType: cadenceEnrollments.entityType,
        entityId: cadenceEnrollments.entityId,
        resultado: cadenceEnrollmentEvents.resultado,
        executedAt: cadenceEnrollmentEvents.createdAt,
      })
      .from(cadenceEnrollmentEvents)
      .innerJoin(cadenceEnrollments, eq(cadenceEnrollmentEvents.enrollmentId, cadenceEnrollments.id))
      .innerJoin(cadenceDefinitions, eq(cadenceEnrollments.cadenceDefinitionId, cadenceDefinitions.id))
      .where(whereCadencia)
      .orderBy(desc(cadenceEnrollmentEvents.createdAt))
      .limit(50);

    execCadencias = rows.map((r) => ({
      id: r.id,
      tipo: "cadencia" as const,
      nome: r.nome,
      status: normalizaStatusCadencia(r.status),
      entityType: r.entityType,
      entityId: r.entityId,
      detalhe: resumoResultado(r.resultado, null),
      executedAt: r.executedAt,
    }));
  }

  const unificado = [...execAutomacoes, ...execCadencias]
    .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
    .slice(0, 50);

  return c.json(unificado);
});

export const automacoesExecucoesRoutes = app;
