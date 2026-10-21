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
  const encerradas = (await encerrarRunsPresas(minutos)).length;
  const retomadas = (await responderQuemFicouNoVacuo(minutos)) + (await retomarDepoisDaQueda());
  return { encerradas, retomadas };
}

/**
 * O número caiu no meio da conversa — e o que o cliente respondeu nesse intervalo
 * nunca chegou.
 *
 * Quando a sessão do WhatsApp cai, a mensagem que a pessoa manda não vira webhook:
 * ela some antes de existir aqui. O wuzapi não tem histórico para buscar depois
 * (`/chat/history` não responde), então **não há como recuperar o texto**. O que
 * dá para recuperar é a CONVERSA.
 *
 * Caso real (21/10/2026): a Lia perguntou à Mayra "o que te trouxe até a gente
 * hoje?" às 12:34, o número caiu, ela respondeu, a resposta se perdeu, e o número
 * só voltou às 19:10. Sete horas de silêncio do nosso lado, e do lado dela a
 * impressão de que ninguém leu.
 *
 * O critério é estreito de propósito, para não virar follow-up automático em quem
 * simplesmente não quis responder: a conversa tem de ter parado numa mensagem
 * NOSSA **e o número ter reconectado depois dela**. Sem queda no meio, nada
 * acontece aqui.
 *
 * O agente é acionado com a última fala do cliente, então ele retoma de onde a
 * conversa estava — com o histórico inteiro no contexto. Opt-out, pausa, horário,
 * taxa e teto continuam valendo: quem decide é `atenderPeloNumeroDoAgente`.
 */
async function retomarDepoisDaQueda(): Promise<number> {
  const paradas = await db.execute<{
    contato_id: string; organizacao_id: string; lead_id: string | null;
    sessao_id: string | null; mensagem_id: string; conteudo: string;
  }>(sql`
    WITH ultima AS (
      SELECT DISTINCT ON (m.contato_id) m.contato_id, m.direcao, m.created_at
        FROM whatsapp_mensagens m
       WHERE m.created_at > now() - interval '48 hours'
       ORDER BY m.contato_id, m.created_at DESC)
    SELECT DISTINCT ON (u.contato_id)
           u.contato_id::text, c.organizacao_id::text, c.lead_id::text, c.sessao_id::text,
           i.id::text AS mensagem_id, i.conteudo
      FROM ultima u
      JOIN contatos c ON c.id = u.contato_id
      JOIN whatsapp_sessao s ON s.id = c.sessao_id AND NOT s.privado
      -- a última fala do CLIENTE, que é por onde o agente retoma
      JOIN whatsapp_mensagens i ON i.contato_id = u.contato_id AND i.direcao = 'in'
                               AND coalesce(i.conteudo, '') <> ''
     WHERE u.direcao = 'out'
       AND s.status = 'connected'
       -- a prova da queda: o número reconectou DEPOIS da nossa última mensagem
       AND s.last_connected_at > u.created_at
     ORDER BY u.contato_id, i.created_at DESC`);

  let retomadas = 0;
  for (const p of paradas as unknown as Array<Record<string, string | null>>) {
    try {
      const { atenderPeloNumeroDoAgente } = await import("./numero-do-agente");
      const r = await atenderPeloNumeroDoAgente({
        organizacaoId: p.organizacao_id!, contatoId: p.contato_id!, leadId: p.lead_id,
        sessaoId: p.sessao_id, mensagem: p.conteudo!, sourceMessageId: p.mensagem_id,
      });
      if (r.tratado && r.resultado === "respondeu") {
        retomadas++;
        console.log(`[RunsPresas] conversa ${p.contato_id} retomada depois de queda do número`);
      }
    } catch (e) {
      console.error(`[RunsPresas] retomada pós-queda falhou (${p.contato_id}):`, e instanceof Error ? e.message : e);
    }
  }
  return retomadas;
}

/**
 * O cliente escreveu e ninguém respondeu. Esse é o critério — não "execução
 * presa".
 *
 * A primeira versão disto só retomava as conversas cujas execuções ELA MESMA
 * tinha acabado de encerrar. Quem já estava órfão antes (porque alguém
 * destravou a execução na mão, porque a execução morreu sem deixar linha, ou
 * porque a mensagem nunca chegou a virar execução) continuava no vácuo para
 * sempre. O defeito que a varredura existia para corrigir sobrevivia à
 * varredura.
 *
 * Aqui a pergunta é a do cliente: a última mensagem da conversa é dele, já
 * passou tempo demais, e o número é de um agente que deveria ter respondido.
 * `atenderPeloNumeroDoAgente` decide o resto — se há agente, se há motivo para
 * calar (opt-out, pausa, pessoa atendendo), horário, taxa e teto de gasto.
 */
async function responderQuemFicouNoVacuo(minutos: number): Promise<number> {
  const paradas = await db.execute<{
    contato_id: string; organizacao_id: string; lead_id: string | null;
    sessao_id: string | null; mensagem_id: string; conteudo: string; direcao: string;
  }>(sql`
    SELECT DISTINCT ON (m.contato_id)
           m.contato_id::text, c.organizacao_id::text, c.lead_id::text,
           c.sessao_id::text, m.id::text AS mensagem_id, m.conteudo,
           m.direcao
      FROM whatsapp_mensagens m
      JOIN contatos c ON c.id = m.contato_id
      JOIN whatsapp_sessao s ON s.id = c.sessao_id AND NOT s.privado
     WHERE m.created_at > now() - interval '24 hours'
       AND m.created_at < now() - ${minutos}::int * interval '1 minute'
       AND coalesce(m.conteudo, '') <> ''
     ORDER BY m.contato_id, m.created_at DESC`);

  let retomadas = 0;
  for (const p of paradas as unknown as Array<Record<string, string | null>>) {
    // `DISTINCT ON` já deu a ÚLTIMA mensagem da conversa: só interessa quem parou numa mensagem DO CONTATO.
    if (p.direcao !== "in") continue;
    try {
      const { atenderPeloNumeroDoAgente } = await import("./numero-do-agente");
      const r = await atenderPeloNumeroDoAgente({
        organizacaoId: p.organizacao_id!, contatoId: p.contato_id!, leadId: p.lead_id,
        sessaoId: p.sessao_id, mensagem: p.conteudo!, sourceMessageId: p.mensagem_id,
      });
      if (r.tratado && r.resultado === "respondeu") {
        retomadas++;
        console.log(`[RunsPresas] conversa ${p.contato_id} estava no vácuo e foi retomada`);
      }
    } catch (e) {
      console.error(`[RunsPresas] não retomou a conversa ${p.contato_id}:`, e instanceof Error ? e.message : e);
    }
  }
  return retomadas;
}
