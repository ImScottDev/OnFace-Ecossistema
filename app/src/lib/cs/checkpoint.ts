/**
 * Execução de um checkpoint da jornada.
 *
 * Concluir um marco não é só marcar `status = CONCLUIDO`: é o momento em que
 * o CS registra o que descobriu na conversa. Por isso este módulo faz, numa
 * única operação, tudo o que decorre do checkpoint — fechar a tarefa, abrir
 * risco, criar a próxima ação, registrar a expansão e, no M12, virar o ciclo.
 *
 * Deixar isso a cargo do analista (concluir aqui, depois lembrar de abrir o
 * risco ali) é como o acompanhamento se perde.
 */
import { db } from "@/lib/db";
import { csMarcos, tarefas, negocios, empresas, servicosCanonicos, leads } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { abrirProximoCiclo } from "./jornada";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";
import { CODIGO_FECHA_CICLO } from "./playbooks";
import { marcarRiscoManual, type Severidade } from "./riscos";
import { criarTarefaCs, registrarInteracao } from "./tarefas";
import { registrarHealthCheck, type RespostasHealthCheck } from "./health-check";

export interface ResultadoCheckpoint {
  /** Itens do checklist marcados. */
  checklist?: Record<string, boolean>;
  /** Respostas às perguntas do playbook. */
  respostas?: Record<string, string>;
  /** Sinais observados que o CS marcou na lista do playbook. */
  sinaisObservados?: string[];
  nota?: string;
}

export interface ExecutarCheckpointInput {
  marcoId: string;
  organizacaoId: string;
  usuarioId: string;
  resultado: ResultadoCheckpoint;
  /** Marco que não se aplica a esta conta — registrado, não apagado. */
  pular?: boolean;
  /** Health check colhido durante a conversa. */
  healthCheck?: RespostasHealthCheck | null;
  risco?: { severidade: Severidade; motivo: string } | null;
  expansao?: { titulo: string; tipo: string; servicoOrigemId?: string | null; valorEstimado?: string | null } | null;
  proximaAcao?: { titulo: string; venceEm: string; prioridade?: "alta" | "media" | "baixa" } | null;
}

export interface SaidaCheckpoint {
  marco: typeof csMarcos.$inferSelect;
  cicloAberto: number | null;
  riscoId: string | null;
  negocioExpansaoId: string | null;
  healthCheckId: string | null;
  proximaAcaoId: string | null;
}

export async function executarCheckpoint(input: ExecutarCheckpointInput): Promise<SaidaCheckpoint | null> {
  const [marcoAtual] = await db.select().from(csMarcos)
    .where(and(eq(csMarcos.id, input.marcoId), eq(csMarcos.organizacaoId, input.organizacaoId)))
    .limit(1);
  if (!marcoAtual) return null;

  // Já concluído: não reabre nem sobrescreve o que ficou registrado. Um
  // checkpoint é um fato datado, não um formulário editável.
  if (marcoAtual.status !== "PENDENTE") return null;

  const [marco] = await db.update(csMarcos)
    .set({
      status: input.pular ? "PULADO" : "CONCLUIDO",
      concluidoEm: new Date(),
      concluidoPor: input.usuarioId,
      resultado: { ...input.resultado, healthCheck: input.healthCheck ?? null },
      updatedAt: new Date(),
    })
    .where(eq(csMarcos.id, input.marcoId))
    .returning();

  // Fecha a tarefa que o marco gerou — senão ela fica na fila pra sempre,
  // dizendo que falta fazer o que já foi feito.
  if (marco.tarefaId) {
    await db.update(tarefas).set({ concluida: true, concluidaEm: new Date() }).where(eq(tarefas.id, marco.tarefaId));
  }

  const [empresa] = await db.select({ nome: empresas.nome }).from(empresas).where(eq(empresas.id, marco.empresaId)).limit(1);

  let healthCheckId: string | null = null;
  if (input.healthCheck && Object.keys(input.healthCheck).length > 0) {
    const hc = await registrarHealthCheck({
      organizacaoId: input.organizacaoId,
      empresaId: marco.empresaId,
      respostas: input.healthCheck,
      marcoId: marco.id,
      registradoPor: input.usuarioId,
    });
    healthCheckId = hc.id;
  }

  let riscoId: string | null = null;
  if (input.risco?.motivo) {
    const risco = await marcarRiscoManual({
      organizacaoId: input.organizacaoId,
      empresaId: marco.empresaId,
      severidade: input.risco.severidade,
      motivo: `${input.risco.motivo} (checkpoint ${marco.codigo})`,
      responsavelId: input.usuarioId,
      abertoPor: input.usuarioId,
    });
    riscoId = risco.id;
  }

  let negocioExpansaoId: string | null = null;
  if (input.expansao?.titulo) {
    // Mesma regra do módulo: expansão é oportunidade comercial de verdade,
    // nunca alteração de serviço por anotação de checkpoint.
    let serviceFamily: string | null = null;
    if (input.expansao.servicoOrigemId) {
      const [s] = await db.select({ f: servicosCanonicos.serviceFamily })
        .from(servicosCanonicos).where(eq(servicosCanonicos.id, input.expansao.servicoOrigemId)).limit(1);
      serviceFamily = s?.f ?? null;
    }
    // Sem lead o Ganho manual não gera contrato nem materializa o serviço novo (mesmo fix de POST /cs/clientes/:id/expansao).
    const [leadDaEmpresa] = await db.select({ id: leads.id }).from(leads)
      .where(and(eq(leads.empresaId, marco.empresaId), eq(leads.organizacaoId, input.organizacaoId)))
      .orderBy(desc(leads.updatedAt)).limit(1);
    const [negocio] = await db.insert(negocios).values({
      organizacaoId: input.organizacaoId,
      empresaId: marco.empresaId,
      leadId: leadDaEmpresa?.id ?? null,
      titulo: input.expansao.titulo,
      descricao: `Identificada no checkpoint ${marco.codigo} do ciclo ${marco.ciclo}`,
      status: "reuniao_agendada",
      origemNegocio: "carteira",
      commercialMotion: "EXPANSION",
      servicoOrigemId: input.expansao.servicoOrigemId ?? null,
      serviceFamily,
      valorTotal: input.expansao.valorEstimado ?? null,
      responsavelId: input.usuarioId,
      camposCustom: { tipoExpansao: input.expansao.tipo, origemCs: true, marcoId: marco.id },
    }).returning({ id: negocios.id });
    negocioExpansaoId = negocio.id;

  // A expansão precisa existir no canônico como qualquer outra oportunidade.
  //
  // O comentário logo acima diz o que este bloco decidiu: "expansão é
  // oportunidade comercial de verdade, nunca alteração de serviço por anotação
  // de checkpoint". Faltava a outra metade dessa frase, que é o negócio chegar
  // em `oportunidades` — sem ela, a expansão nasce só no legado e some das
  // leituras canônicas (pipeline, relatórios, política de Ganho).
  //
  // Hoje o banco tem ZERO negócios com `commercial_motion = 'EXPANSION'`: o
  // caminho nunca foi exercido. Por isso o buraco não aparece em contagem
  // nenhuma, e por isso ele é barato de fechar agora, antes do primeiro uso,
  // em vez de virar backfill depois.
    await syncOportunidadeFromNegocio(negocio.id);
  }

  let proximaAcaoId: string | null = null;
  if (input.proximaAcao?.titulo) {
    const { id } = await criarTarefaCs({
      organizacaoId: input.organizacaoId,
      empresaId: marco.empresaId,
      titulo: input.proximaAcao.titulo,
      motivo: `Definida no checkpoint ${marco.codigo}`,
      tipo: "cs_followup",
      origem: "MANUAL",
      prioridade: input.proximaAcao.prioridade ?? "media",
      venceEm: new Date(input.proximaAcao.venceEm),
      usuarioId: input.usuarioId,
    });
    proximaAcaoId = id;
  }

  // M12 fecha o ciclo e abre o próximo. Só na conclusão de verdade: marco
  // pulado não fecha ano de relacionamento que não aconteceu.
  let cicloAberto: number | null = null;
  if (!input.pular && marco.codigo === CODIGO_FECHA_CICLO) {
    const novo = await abrirProximoCiclo(marco.id);
    cicloAberto = novo?.ciclo ?? null;
  }

  await registrarInteracao({
    organizacaoId: input.organizacaoId,
    empresaId: marco.empresaId,
    tipo: "cs_marco",
    titulo: `${input.pular ? "Checkpoint pulado" : "Checkpoint concluído"}: ${marco.titulo}${marco.ciclo > 1 ? ` (ciclo ${marco.ciclo})` : ""}`,
    descricao: input.resultado.nota ?? null,
    usuarioId: input.usuarioId,
    dados: {
      marcoId: marco.id, codigo: marco.codigo, ciclo: marco.ciclo,
      empresa: empresa?.nome, riscoId, negocioExpansaoId, healthCheckId, cicloAberto,
    },
  });

  return { marco, cicloAberto, riscoId, negocioExpansaoId, healthCheckId, proximaAcaoId };
}
