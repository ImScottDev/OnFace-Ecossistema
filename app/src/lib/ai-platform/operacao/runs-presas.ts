/**
 * Execução que ficou presa em "running" e o cliente esperando.
 *
 * Sintoma (21/10/2026, produção, com lead quente na linha): o Filipe perguntou
 * "pode me mandar o link para assinar?", a agente respondeu, ele disse "Poxa", e
 * a execução dessa mensagem entrou em `running` às 11:35 e nunca saiu. Um deploy
 * recriou o worker no meio dela. Ninguém mais tocou naquela conversa.
 *
 * Duas coisas se somam e transformam um reinício comum em silêncio permanente:
 *   1. não havia NENHUMA varredura de execução presa — compromissos já tinham a
 *      sua ("o que ficou processando há mais de 10 min volta à fila"), execução
 *      de agente não;
 *   2. a deduplicação de `acionarAgente` trata `running` como "já tratada" por
 *      12 horas, então a mesma mensagem nunca mais seria processada.
 *
 * Aqui a execução pendurada é encerrada como falha, o que devolve a mensagem à
 * fila de elegíveis, e o agente é acionado de novo para a última mensagem do
 * contato que ficou sem resposta. Deploy no meio da conversa deixa de custar um
 * cliente.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** Tempo que uma execução pode ficar em "running" antes de ser dada como perdida. */
export const MINUTOS_ATE_DAR_POR_PERDIDA = 10;

export interface RunPresa {
  runId: string;
  organizacaoId: string;
  agentId: string;
  contatoId: string | null;
  leadId: string | null;
  sourceMessageId: string | null;
}

/**
 * Encerra as execuções penduradas e devolve as que têm conversa para retomar.
 * Idempotente: o próprio UPDATE só pega quem ainda está `running`.
 */
export async function encerrarRunsPresas(minutos = MINUTOS_ATE_DAR_POR_PERDIDA): Promise<RunPresa[]> {
  const linhas = await db.execute<{
    id: string; organizacao_id: string; agent_id: string;
    contato_id: string | null; lead_id: string | null; source_message_id: string | null;
  }>(sql`
    UPDATE ai_agent_runs
       SET status = 'failed',
           error_code = 'execucao_interrompida',
           erro = 'execução interrompida (worker reiniciado ou queda); encerrada pela varredura',
           completed_at = now()
     WHERE status = 'running'
       AND started_at < now() - ${minutos}::int * interval '1 minute'
    RETURNING id::text, organizacao_id::text, agent_id::text,
              contato_id::text, lead_id::text, source_message_id::text`);

  return (linhas as unknown as Array<Record<string, string | null>>).map((l) => ({
    runId: l.id!, organizacaoId: l.organizacao_id!, agentId: l.agent_id!,
    contatoId: l.contato_id, leadId: l.lead_id, sourceMessageId: l.source_message_id,
  }));
}

/**
 * Encerra o que ficou preso e retoma a conversa de quem ficou sem resposta.
 *
 * Só retoma quando a ÚLTIMA mensagem da conversa é do contato: se a agente já
 * respondeu depois, ou se uma pessoa assumiu, não há vácuo para preencher — e
 * `acionarAgente` ainda aplica as suas próprias travas (opt-out, pausa, humano
 * atendendo, horário, taxa, teto de gasto).
 */
export async function recuperarRunsPresas(minutos = MINUTOS_ATE_DAR_POR_PERDIDA): Promise<{ encerradas: number; retomadas: number }> {
  const presas = await encerrarRunsPresas(minutos);
  let retomadas = 0;

  for (const p of presas) {
    if (!p.contatoId) continue;
    try {
      const [ultima] = await db.execute<{ id: string; conteudo: string | null; direcao: string }>(sql`
        SELECT id::text, conteudo, direcao FROM whatsapp_mensagens
         WHERE contato_id = ${p.contatoId}::uuid ORDER BY created_at DESC LIMIT 1`);
      if (!ultima || ultima.direcao !== "in" || !ultima.conteudo?.trim()) continue;

      const { acionarAgente, EVENTO_MENSAGEM } = await import("./acionar");
      const r = await acionarAgente({
        organizacaoId: p.organizacaoId, agentId: p.agentId, contatoId: p.contatoId, leadId: p.leadId,
        evento: EVENTO_MENSAGEM, mensagem: ultima.conteudo, sourceMessageId: ultima.id,
        motivoDaExecucao: "retomada após execução interrompida",
      });
      if (r.resultado === "respondeu" || r.resultado === "handover") retomadas++;
    } catch (e) {
      console.error(`[RunsPresas] não retomou a conversa ${p.contatoId}:`, e instanceof Error ? e.message : e);
    }
  }

  return { encerradas: presas.length, retomadas };
}
