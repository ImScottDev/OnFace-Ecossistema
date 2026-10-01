// Leitura da tela Automações → Execuções (server component).
//
// Três fontes reais, todas filtradas por organizacao_id:
//   1. event_outbox — a FILA que o worker consome (sweep do consumer). É a única
//      das três com volume hoje e a única com reprocessamento (dead-letter →
//      POST /api/admin/event-outbox/reprocessar, já existente no Hono).
//   2. automacao_execucoes — execução de regra de automação (Fluxos).
//   3. cadence_enrollment_events — passo do motor de cadência.
//
// A normalização de 2 e 3 espelha api-server/routes/automacoes-execucoes.ts
// (mesmo vocabulário de status). Fica aqui porque a tela lê no servidor: filtro
// na URL sobrevive a reload e deep-link sem um fetch extra no cliente.
//
// cadencia_execucoes (toques manuais do SDR) ficou de fora de propósito: é ação
// humana registrada na pré-vendas, não execução de automação. Somar aqui
// inflaria "execuções" com ligação feita à mão.
import { db } from "@/lib/db";
import {
  automacoes, automacaoExecucoes,
  cadenceDefinitions, cadenceEnrollments, cadenceEnrollmentEvents,
  eventOutbox,
} from "@/lib/db/schema";
import { and, desc, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";

export type FonteExecucao = "fila" | "automacao" | "cadencia";

export type StatusExecucao =
  | "sucesso"
  // Recorte de filtro, nunca status de linha: tudo que o worker ainda não
  // fechou (pending com qualquer tentativa + processing). É o que o card
  // "Aguardando o worker" conta, então o link do card precisa abrir o mesmo
  // conjunto, não só "pending sem tentativa".
  | "aguardando"
  | "pendente"
  | "processando"
  | "retry_agendado"
  | "erro"
  | "condicao_nao_atendida"
  | "cancelado"
  // Marco do ciclo da inscrição na cadência (inscrito, pausado, retomado,
  // resposta recebida). Não é execução de passo, mas o motor grava na mesma
  // tabela; sem status próprio o selo saía vazio.
  | "marco";

export const STATUS_EXECUCAO: StatusExecucao[] = [
  "sucesso", "aguardando", "pendente", "processando", "retry_agendado", "erro", "condicao_nao_atendida", "cancelado", "marco",
];

export interface Execucao {
  id: string;
  fonte: FonteExecucao;
  nome: string;
  status: StatusExecucao;
  entidadeTipo: string;
  entidadeId: string;
  detalhe: string | null;
  /** Payload/resultado cru para o painel de detalhe. */
  dados: unknown;
  /** Onde abrir o detalhe completo (execução de fluxo → editor). */
  link?: string | null;
  tentativas: number | null;
  /** true só para evento do outbox em dead-letter (status=failed). É o único
   * caso que o endpoint de reprocessar aceita. */
  reprocessavel: boolean;
  quando: string;
  concluidoEm: string | null;
}

export interface ResumoExecucoes {
  fila: { processados: number; pendentes: number; processando: number; falhas: number; pendenteMaisAntigo: string | null };
  automacoes: number;
  cadencias: number;
}

// Status do outbox -> vocabulário da tela. "pending" com tentativa > 0 é
// retry: o consumer devolveu pra fila depois de um erro (last_error preenchido).
function statusOutbox(status: string, tentativas: number): StatusExecucao {
  if (status === "processed") return "sucesso";
  if (status === "failed") return "erro";
  if (status === "processing") return "processando";
  return tentativas > 0 ? "retry_agendado" : "pendente";
}

function resumo(resultado: unknown, erro: string | null): string | null {
  const corta = (s: string, n = 240) => (s.length > n ? `${s.slice(0, n)}…` : s);
  if (erro) return corta(erro);
  if (resultado && typeof resultado === "object") {
    const r = resultado as Record<string, unknown>;
    const campo = r.message ?? r.motivo ?? r.detalhe ?? r.texto;
    if (typeof campo === "string" && campo) return corta(campo);
  }
  return null;
}

// Eventos de ciclo de vida que o motor grava junto com os passos.
const MARCO_CADENCIA: Record<string, string> = {
  enrolled: "Inscrito na cadência",
  pause: "Pausado manualmente",
  resume: "Retomado manualmente",
  pausado_por_resposta: "Pausado porque o contato respondeu",
  resposta_recebida: "Resposta do contato recebida",
};

function statusDaCadencia(s: string): StatusExecucao {
  if (s === "executado") return "sucesso";
  if (s === "executando") return "processando";
  if (s === "cancel") return "cancelado";
  if (s in MARCO_CADENCIA) return "marco";
  if (["erro", "retry_agendado", "condicao_nao_atendida", "cancelado"].includes(s)) return s as StatusExecucao;
  // Valor novo que o motor passe a gravar: aparece como marco com o texto cru
  // no detalhe, em vez de selo vazio. O filtro "marco" usa a mesma regra
  // (NOT IN dos valores de passo), então selo e chip nunca divergem.
  return "marco";
}

export const LIMITE = 100;

export async function listarExecucoes(
  organizacaoId: string,
  opts: { fonte: FonteExecucao | null; status: StatusExecucao | null; verFila: boolean },
): Promise<Execucao[]> {
  const { fonte, status, verFila } = opts;
  const quer = (f: FonteExecucao) => !fonte || fonte === f;

  const consultas: Promise<Execucao[]>[] = [];

  if (verFila && quer("fila")) {
    const conds: SQL[] = [eq(eventOutbox.organizacaoId, organizacaoId)];
    // Filtro traduzido para a coluna real do outbox.
    if (status === "sucesso") conds.push(eq(eventOutbox.status, "processed"));
    else if (status === "erro") conds.push(eq(eventOutbox.status, "failed"));
    else if (status === "processando") conds.push(eq(eventOutbox.status, "processing"));
    else if (status === "aguardando") conds.push(inArray(eventOutbox.status, ["pending", "processing"]));
    else if (status === "pendente") conds.push(eq(eventOutbox.status, "pending"), eq(eventOutbox.attempts, 0));
    else if (status === "retry_agendado") conds.push(eq(eventOutbox.status, "pending"), sql`${eventOutbox.attempts} > 0`);
    else if (status) conds.push(sql`false`); // condicao_nao_atendida/cancelado/marco não existem no outbox

    consultas.push(
      db.select().from(eventOutbox).where(and(...conds)).orderBy(desc(eventOutbox.createdAt)).limit(LIMITE)
        .then((rows) => rows.map((r) => ({
          id: r.id,
          fonte: "fila" as const,
          nome: r.eventType,
          status: statusOutbox(r.status, r.attempts),
          entidadeTipo: r.aggregateType,
          entidadeId: r.aggregateId,
          detalhe: resumo(null, r.lastError),
          dados: r.payload,
          tentativas: r.attempts,
          reprocessavel: r.status === "failed",
          quando: r.createdAt.toISOString(),
          concluidoEm: r.processedAt ? r.processedAt.toISOString() : null,
        }))),
    );
  }

  // automacao_execucoes: regra antiga grava sucesso | erro | condicao_nao_atendida;
  // o executor de fluxos grava também executando | aguardando | cancelado.
  const colunaDoStatus: Partial<Record<StatusExecucao, string[]>> = {
    sucesso: ["sucesso"], erro: ["erro"], condicao_nao_atendida: ["condicao_nao_atendida"],
    processando: ["executando"], aguardando: ["aguardando", "executando"], cancelado: ["cancelado"],
  };
  if (quer("automacao") && (!status || colunaDoStatus[status])) {
    const conds: SQL[] = [eq(automacaoExecucoes.organizacaoId, organizacaoId)];
    if (status) conds.push(inArray(automacaoExecucoes.status, colunaDoStatus[status]!));
    consultas.push(
      db.select({
        id: automacaoExecucoes.id, automacaoId: automacaoExecucoes.automacaoId, tipo: automacoes.tipo, nome: automacoes.nome, status: automacaoExecucoes.status,
        entityType: automacaoExecucoes.entityType, entityId: automacaoExecucoes.entityId,
        resultado: automacaoExecucoes.resultado, erro: automacaoExecucoes.erro,
        executedAt: automacaoExecucoes.executedAt, finishedAt: automacaoExecucoes.finishedAt,
      })
        .from(automacaoExecucoes)
        .innerJoin(automacoes, eq(automacaoExecucoes.automacaoId, automacoes.id))
        .where(and(...conds)).orderBy(desc(automacaoExecucoes.executedAt)).limit(LIMITE)
        .then((rows) => rows.map((r) => ({
          id: r.id,
          fonte: "automacao" as const,
          nome: r.nome,
          status: (r.status === "executando" ? "processando" : r.status) as StatusExecucao,
          entidadeTipo: r.entityType ?? "",
          entidadeId: r.entityId ?? "",
          // Execução de fluxo abre no editor com o caminho pintado.
          link: r.tipo === "fluxo" ? `/automacoes/fluxos/${r.automacaoId}?execucao=${r.id}` : null,
          detalhe: resumo(r.resultado, r.erro),
          dados: r.resultado,
          tentativas: null,
          reprocessavel: false,
          quando: r.executedAt.toISOString(),
          concluidoEm: r.finishedAt ? r.finishedAt.toISOString() : null,
        }))),
    );
  }

  // cadence_enrollment_events: vocabulário real do motor (cadence-engine.ts e
  // rota de ações da inscrição). Cada status da tela -> valores na coluna.
  const statusCadencia: Partial<Record<StatusExecucao, string[]>> = {
    sucesso: ["executado"], processando: ["executando"], erro: ["erro"],
    condicao_nao_atendida: ["condicao_nao_atendida"], retry_agendado: ["retry_agendado"],
    cancelado: ["cancelado", "cancel"],
  };
  if (quer("cadencia") && (!status || status === "marco" || statusCadencia[status])) {
    const conds: SQL[] = [eq(cadenceEnrollments.organizacaoId, organizacaoId)];
    // "marco" é o resto: tudo que não é valor de passo. Mesma regra de
    // statusDaCadencia, inclusive para valor desconhecido.
    if (status === "marco") conds.push(notInArray(cadenceEnrollmentEvents.status, Object.values(statusCadencia).flat() as string[]));
    else if (status) conds.push(inArray(cadenceEnrollmentEvents.status, statusCadencia[status]!));
    consultas.push(
      db.select({
        id: cadenceEnrollmentEvents.id, nome: cadenceDefinitions.nome, passo: cadenceEnrollmentEvents.stepId,
        status: cadenceEnrollmentEvents.status, entityType: cadenceEnrollments.entityType,
        entityId: cadenceEnrollments.entityId, resultado: cadenceEnrollmentEvents.resultado,
        tentativa: cadenceEnrollmentEvents.attempt, createdAt: cadenceEnrollmentEvents.createdAt,
      })
        .from(cadenceEnrollmentEvents)
        .innerJoin(cadenceEnrollments, eq(cadenceEnrollmentEvents.enrollmentId, cadenceEnrollments.id))
        .innerJoin(cadenceDefinitions, eq(cadenceEnrollments.cadenceDefinitionId, cadenceDefinitions.id))
        .where(and(...conds)).orderBy(desc(cadenceEnrollmentEvents.createdAt)).limit(LIMITE)
        .then((rows) => rows.map((r) => ({
          id: r.id,
          fonte: "cadencia" as const,
          // stepId "-" = evento da inscrição sem passo corrente.
          nome: r.passo && r.passo !== "-" ? `${r.nome} · passo ${r.passo}` : r.nome,
          status: statusDaCadencia(r.status),
          entidadeTipo: r.entityType,
          entidadeId: r.entityId,
          detalhe: MARCO_CADENCIA[r.status] ?? resumo(r.resultado, null) ?? (statusDaCadencia(r.status) === "marco" ? r.status : null),
          dados: r.resultado,
          tentativas: r.tentativa,
          reprocessavel: false,
          quando: r.createdAt.toISOString(),
          concluidoEm: null,
        }))),
    );
  }

  const tudo = (await Promise.all(consultas)).flat();
  return tudo.sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, LIMITE);
}

/** Contagens da org inteira (não só da página listada). */
export async function resumoExecucoes(organizacaoId: string): Promise<ResumoExecucoes> {
  const [fila, [auto], [cad]] = await Promise.all([
    db.select({ status: eventOutbox.status, n: sql<number>`count(*)::int`, maisAntigo: sql<string | null>`to_char(min(${eventOutbox.createdAt}) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')` })
      .from(eventOutbox).where(eq(eventOutbox.organizacaoId, organizacaoId)).groupBy(eventOutbox.status),
    db.select({ n: sql<number>`count(*)::int` }).from(automacaoExecucoes).where(eq(automacaoExecucoes.organizacaoId, organizacaoId)),
    db.select({ n: sql<number>`count(*)::int` }).from(cadenceEnrollmentEvents)
      .innerJoin(cadenceEnrollments, eq(cadenceEnrollmentEvents.enrollmentId, cadenceEnrollments.id))
      .where(eq(cadenceEnrollments.organizacaoId, organizacaoId)),
  ]);
  const por = (s: string) => fila.find((f) => f.status === s);
  return {
    fila: {
      processados: por("processed")?.n ?? 0,
      pendentes: por("pending")?.n ?? 0,
      processando: por("processing")?.n ?? 0,
      falhas: por("failed")?.n ?? 0,
      pendenteMaisAntigo: por("pending")?.maisAntigo ?? null,
    },
    automacoes: auto?.n ?? 0,
    cadencias: cad?.n ?? 0,
  };
}
