/**
 * Health Check — a percepção declarada pelo cliente numa conversa.
 *
 * É uma FERRAMENTA do CS, não o health score da conta. Nota boa dada por
 * educação não apaga fatura vencida nem entrega parada: os sinais duros
 * continuam vindo de `lib/cs/riscos.ts` e são independentes destes.
 *
 * O que este módulo faz é o caminho inverso — quando a resposta do cliente
 * é ruim, isso VIRA sinal de risco, com o motivo sendo a resposta dele.
 */
import { db } from "@/lib/db";
import { npsRespostas, csRiscos, leads, empresas } from "@/lib/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { QUESTIONARIO_HEALTH_CHECK } from "./playbooks";
import { registrarInteracao } from "./tarefas";

export interface RespostasHealthCheck {
  nps?: number;
  valor_percebido?: number;
  adocao?: number;
  satisfacao_suporte?: number;
  intencao_continuidade?: boolean;
  dificuldades?: string;
  subir_um_ponto?: string;
}

export interface ResultadoHealthCheck {
  id: string;
  faixa: "verde" | "amarelo" | "vermelho" | null;
  riscosAbertos: string[];
}

/** Mesma régua do playbook de CS: verde 7-10 / amarelo 5-6 / vermelho 0-4. */
export function faixaNps(score: number): "verde" | "amarelo" | "vermelho" {
  if (score >= 7) return "verde";
  if (score >= 5) return "amarelo";
  return "vermelho";
}

/**
 * Avalia quais respostas cruzaram o limiar. O limiar vem do questionário
 * (`limiarRisco`), não de números soltos aqui — assim mudar a régua é editar
 * o playbook, não caçar comparação em três arquivos.
 */
function sinaisDasRespostas(r: RespostasHealthCheck): { tipo: string; motivo: string; severidade: "ATENCAO" | "EM_RISCO" }[] {
  const sinais: { tipo: string; motivo: string; severidade: "ATENCAO" | "EM_RISCO" }[] = [];

  for (const p of QUESTIONARIO_HEALTH_CHECK) {
    if (p.limiarRisco === undefined) continue;
    const valor = (r as Record<string, unknown>)[p.chave];
    if (typeof valor !== "number" || valor > p.limiarRisco) continue;

    // Metade do limiar pra baixo é detrator declarado, não só insatisfação.
    const grave = valor <= p.limiarRisco / 2;
    sinais.push({
      tipo: p.chave === "nps" ? "NPS_BAIXO" : "HEALTH_CHECK_BAIXO",
      motivo: `Health check — ${p.pergunta.replace(/^De \d+ a \d+, /, "")} resposta: ${valor}${p.tipo === "escala_0_10" ? "/10" : "/5"}`,
      severidade: grave ? "EM_RISCO" : "ATENCAO",
    });
  }

  // Intenção de NÃO continuar é o sinal mais forte que uma conversa produz.
  if (r.intencao_continuidade === false) {
    sinais.push({
      tipo: "INTENCAO_SAIDA",
      motivo: `Cliente declarou que NÃO pretende continuar${r.dificuldades ? ` — ${r.dificuldades}` : ""}`,
      severidade: "EM_RISCO",
    });
  }

  return sinais;
}

export async function registrarHealthCheck(input: {
  organizacaoId: string;
  empresaId: string;
  respostas: RespostasHealthCheck;
  marcoId?: string | null;
  registradoPor?: string | null;
}): Promise<ResultadoHealthCheck> {
  // Lead representativo só pra manter compatibilidade com o histórico de NPS,
  // que sempre foi por lead. A consulta nova é por empresa_id.
  const [lead] = await db.select({ id: leads.id }).from(leads)
    .where(and(eq(leads.empresaId, input.empresaId), eq(leads.organizacaoId, input.organizacaoId)))
    .orderBy(desc(leads.updatedAt)).limit(1);

  const [registro] = await db.insert(npsRespostas).values({
    organizacaoId: input.organizacaoId,
    empresaId: input.empresaId,
    leadId: lead?.id ?? null,
    marcoId: input.marcoId ?? null,
    registradoPor: input.registradoPor ?? null,
    score: input.respostas.nps ?? null,
    comentario: input.respostas.subir_um_ponto ?? input.respostas.dificuldades ?? null,
    respostas: input.respostas,
    tipo: "health_check",
    respondidoEm: new Date(),
  }).returning({ id: npsRespostas.id });

  const [empresa] = await db.select({ nome: empresas.nome }).from(empresas).where(eq(empresas.id, input.empresaId)).limit(1);

  const riscosAbertos: string[] = [];
  for (const sinal of sinaisDasRespostas(input.respostas)) {
    const [risco] = await db.insert(csRiscos).values({
      organizacaoId: input.organizacaoId,
      empresaId: input.empresaId,
      tipo: sinal.tipo,
      severidade: sinal.severidade,
      origem: "AUTOMATICO",
      motivo: sinal.motivo,
      fonte: "nps_respostas:health_check",
      detalhe: { healthCheckId: registro.id, respostas: input.respostas },
    }).onConflictDoNothing().returning({ id: csRiscos.id });
    if (risco) riscosAbertos.push(risco.id);
  }

  await registrarInteracao({
    organizacaoId: input.organizacaoId,
    empresaId: input.empresaId,
    tipo: "cs_health_check",
    titulo: `Health check registrado${input.respostas.nps !== undefined ? ` — NPS ${input.respostas.nps}` : ""}`,
    descricao: input.respostas.dificuldades ?? input.respostas.subir_um_ponto ?? null,
    usuarioId: input.registradoPor ?? null,
    dados: { healthCheckId: registro.id, empresa: empresa?.nome, respostas: input.respostas },
  });

  return {
    id: registro.id,
    faixa: input.respostas.nps !== undefined ? faixaNps(input.respostas.nps) : null,
    riscosAbertos,
  };
}

/** Histórico de health checks da conta — a evolução importa mais que a última nota. */
export async function historicoHealthCheck(organizacaoId: string, empresaId: string) {
  return db.select({
    id: npsRespostas.id,
    score: npsRespostas.score,
    respostas: npsRespostas.respostas,
    comentario: npsRespostas.comentario,
    respondidoEm: npsRespostas.respondidoEm,
    marcoId: npsRespostas.marcoId,
  })
    .from(npsRespostas)
    .where(and(
      eq(npsRespostas.organizacaoId, organizacaoId),
      eq(npsRespostas.tipo, "health_check"),
      sql`(${npsRespostas.empresaId} = ${empresaId} OR ${npsRespostas.leadId} IN (SELECT id FROM leads WHERE empresa_id = ${empresaId}))`,
    ))
    .orderBy(desc(npsRespostas.respondidoEm))
    .limit(24);
}
