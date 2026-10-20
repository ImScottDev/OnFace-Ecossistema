/**
 * Ponto único de execução do agente operacional.
 *
 * Mensagem recebida, atribuição, retomada vencida, automação ou "solicitar
 * análise" entram aqui. A ordem é fixa e é o ciclo do agente:
 *   atribuição/exclusividade -> deduplicação -> política de canal -> paradas de
 *   segurança -> lease (um run por atendimento) -> transcrição de áudio ->
 *   runtime (contexto + memória + playbook + ferramentas) -> estado persistido
 *   -> drenagem de mensagens que chegaram durante o run.
 * Nada aqui usa cadência. O estado do agente vive em ai_agent_atribuicoes.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiAgentRuns, aiAlerts, aiCases, aiAgents, whatsappMensagens } from "@/lib/db/schema";
import { executeAgent, NoEligibleAgentError } from "@/lib/ai-platform/runtime/execute-agent";
import { sessaoEhOperacional, usaPoolOperacional } from "@/lib/whatsapp/uso-automatico";
import { contagemDeMensagens, contatoDoLead, registrarRunBloqueado, versaoPublicada } from "@/lib/agentes/autonomia";
import { dentroDoHorario, excedeTaxa, lerLimites, motivoDeParada, ROTULO_PARADA } from "@/lib/agentes/guardrails";
import { devolverAoHumano } from "@/lib/agentes/handover";
import { usuarioDoAgente } from "@/lib/agentes/usuario-do-agente";
import { lerExpressoesHandoff } from "@/lib/ai/agente-escopo";
import {
  ativaDesde, quemRespondeuDesde, atribuicaoViva, atribuirAgente, AtribuicaoRecusada, registrarExecucaoNaAtribuicao, soltarLease, tomarLease, transferirParaHumano,
  type Atribuicao, type OrigemAtribuicao, type StatusAtribuicao,
} from "./atribuicoes";
import { avaliarEnvio } from "./politica-canal";
import { lembrar } from "./memoria";
import { garantirTranscricoes } from "../midia/transcrever";
import { notificarSupervisor } from "./supervisao";

export const EVENTO_MENSAGEM = "conversation.message_received";

export interface EntradaAcionar {
  organizacaoId: string;
  agentId: string;
  contatoId?: string | null;
  leadId?: string | null;
  evento: string;
  mensagem: string;
  motivoDaExecucao?: string | null;
  sourceMessageId?: string | null;
  atribuicaoId?: string | null;
  /** Cria a atribuição quando ainda não existe (automação/atendimento). */
  atribuir?: { origem: OrigemAtribuicao; origemRef?: string | null; objetivo?: string | null; usuarioId?: string | null; sobrepoeHumano?: boolean; trocar?: boolean };
  compromissoId?: string | null;
  /**
   * Número pelo qual o agente deve falar NESTE acionamento.
   *
   * Existe porque o passo "IA: responder" oferece "Falar pelo número" e o
   * motor ignorava o campo: a conversa nascia sempre no número da versão do
   * agente, ou no pool. Quem escolhia não era atendido e não recebia erro.
   * Vazio = como antes (número da versão, ou pool operacional).
   */
  sessaoId?: string | null;
  /** Mesma chave = mesma execução (retry de automação não roda duas vezes). */
  chaveIdempotencia?: string | null;
  /** Só analisar: lê, raciocina e registra nota; não envia mensagem nem altera o comercial. */
  somenteAnalise?: boolean;
  /** Quem disparou, para o trace (automação, atendimento, retomada). */
  origem?: string | null;
  /** Iniciativa do agente (abertura, retomada): exige horário comercial e canal pronto. */
  proativo?: boolean;
  mode?: "live" | "test";
  agora?: Date;
}

export type ResultadoAcionar = {
  resultado: "respondeu" | "handover" | "bloqueado" | "pausado" | "falhou" | "duplicado" | "ocupado" | "sem_resposta";
  motivo?: string; runId?: string; mensagensEnviadas?: number;
};

const bloqueado = (motivo: string, runId?: string): ResultadoAcionar => ({ resultado: "bloqueado", motivo, runId });

async function registrarBloqueio(e: EntradaAcionar, versaoId: string | null, motivo: string, status: "aborted" | "handed_off" = "aborted") {
  return registrarRunBloqueado({
    organizacaoId: e.organizacaoId, agentId: e.agentId, versionId: versaoId, contatoId: e.contatoId ?? null, leadId: e.leadId ?? null,
    evento: e.evento, status, motivo, sourceMessageId: e.sourceMessageId ?? null,
  });
}

/** Mensagem do contato que ainda não tem run deste agente (chegou enquanto outro run andava). */
async function mensagemNaoAtendida(contatoId: string, agentId: string, desde: Date): Promise<{ id: string; conteudo: string | null } | null> {
  const [m] = await db.execute<{ id: string; conteudo: string | null }>(sql`
    SELECT m.id::text, m.conteudo FROM whatsapp_mensagens m
     WHERE m.contato_id = ${contatoId}::uuid AND m.direcao = 'in' AND m.created_at > ${desde.toISOString()}::timestamptz
       AND NOT EXISTS (SELECT 1 FROM ai_agent_runs r WHERE r.source_message_id = m.id AND r.agent_id = ${agentId}::uuid AND r.status IN ('running','completed','handed_off'))
     ORDER BY m.created_at ASC LIMIT 1`);
  return m ?? null;
}

async function textoDaMensagem(e: EntradaAcionar): Promise<string> {
  if (e.evento !== EVENTO_MENSAGEM || !e.sourceMessageId) return e.mensagem;
  const [m] = await db.select({ tipo: whatsappMensagens.tipo, conteudo: whatsappMensagens.conteudo, dados: whatsappMensagens.dados }).from(whatsappMensagens).where(eq(whatsappMensagens.id, e.sourceMessageId)).limit(1);
  if (m?.tipo === "audio") {
    const t = (m.dados as Record<string, unknown> | null)?.transcricao;
    return typeof t === "string" && t.trim() ? `[áudio transcrito] ${t}` : "[O contato enviou um áudio que não pôde ser transcrito. Diga com naturalidade que não conseguiu ouvir e peça para escrever ou resumir.]";
  }
  return e.mensagem;
}

export async function acionarAgente(e: EntradaAcionar): Promise<ResultadoAcionar> {
  const agora = e.agora ?? new Date();
  const mode = e.mode ?? "live";
  const versao = await versaoPublicada(e.agentId);
  if (!versao && mode === "live") return bloqueado("agente_sem_versao_publicada");
  if (mode === "live") {
    const [ag] = await db.select({ status: aiAgents.status }).from(aiAgents).where(and(eq(aiAgents.id, e.agentId), eq(aiAgents.organizacaoId, e.organizacaoId))).limit(1);
    if (!ag) return bloqueado("agente_nao_encontrado");
    if (ag.status !== "published") { await registrarBloqueio(e, versao?.id ?? null, "agente_pausado_globalmente"); return bloqueado("agente_pausado_globalmente"); }
  }

  // Atendimento que começou pelo lead: o contato de WhatsApp é resolvido (ou criado no número do agente) aqui, uma vez.
  if (mode === "live" && !e.contatoId && e.leadId) {
    // O número escolhido no passo vence o da versão. Se ele não valer para
    // este agente, a checagem de canal mais abaixo barra o acionamento com
    // `numero_nao_autorizado_para_o_agente` — escolher número errado falha
    // dizendo o porquê, em vez de sair calado por outro número.
    const sessaoEscolhida = e.sessaoId || versao?.channelSessionId || null;
    const ct = await contatoDoLead(e.organizacaoId, e.leadId, sessaoEscolhida, { poolOperacional: usaPoolOperacional(versao?.guardrailConfig) }).catch(() => null);
    if (ct) e = { ...e, contatoId: ct.id };
    else { const runId = await registrarBloqueio(e, versao?.id ?? null, "lead_sem_whatsapp"); return bloqueado("lead_sem_whatsapp", runId); }
  }

  // 1. Atribuição e exclusividade ------------------------------------------------
  let atrib: Atribuicao | null = null;
  if (mode === "live") {
    atrib = await atribuicaoViva(e.organizacaoId, { contatoId: e.contatoId, leadId: e.leadId });
    if (!atrib && e.atribuir) {
      try {
        atrib = (await atribuirAgente({ organizacaoId: e.organizacaoId, agentId: e.agentId, contatoId: e.contatoId, leadId: e.leadId, ...e.atribuir, ator: { usuarioId: e.atribuir.usuarioId ?? null } })).atribuicao;
      } catch (err) {
        if (err instanceof AtribuicaoRecusada) { await registrarBloqueio(e, versao?.id ?? null, err.codigo); return bloqueado(err.codigo); }
        throw err;
      }
    }
    if (atrib) {
      if (atrib.agentId !== e.agentId) { await registrarBloqueio(e, versao?.id ?? null, "outro_agente_atribuido"); return bloqueado("outro_agente_atribuido"); }
      if (atrib.status === "humano") { await registrarBloqueio(e, versao?.id ?? null, "humano_responsavel"); return { resultado: "pausado", motivo: "humano_responsavel" }; }
      if (atrib.status === "pausada") { await registrarBloqueio(e, versao?.id ?? null, "agente_pausado"); return { resultado: "pausado", motivo: "agente_pausado" }; }
      // Ação ou resposta esperando uma pessoa decidir: o agente não age de novo por cima do que está pendente.
      if (atrib.status === "aguardando_aprovacao") { await registrarBloqueio(e, versao?.id ?? null, "aguardando_aprovacao"); return { resultado: "pausado", motivo: "aguardando_aprovacao" }; }
      // Uma pessoa respondeu depois que o agente assumiu: ela retomou o atendimento. O agente para, o histórico fica.
      const quem = e.contatoId ? await quemRespondeuDesde(e.contatoId, ativaDesde(atrib)) : undefined;
      if (quem !== undefined) {
        // Quem respondeu já está atendendo: fica como responsável, sem aviso a si mesma.
        const transferir = (humanoUsuarioId: string | null) => transferirParaHumano({ organizacaoId: e.organizacaoId, atribuicaoId: atrib!.id, motivo: "humano_respondeu_na_conversa", resumo: "Uma pessoa do time respondeu diretamente neste atendimento.", humanoUsuarioId, notificar: false });
        await transferir(quem).catch((err) => { if (err instanceof AtribuicaoRecusada) return transferir(null); throw err; });
        await registrarBloqueio(e, versao?.id ?? null, "humano_respondeu_na_conversa");
        return { resultado: "pausado", motivo: "humano_respondeu_na_conversa" };
      }
    }
  }

  // 2. Deduplicação por mensagem ------------------------------------------------
  if (mode === "live" && e.sourceMessageId) {
    const [ja] = await db.select({ id: aiAgentRuns.id }).from(aiAgentRuns).where(and(
      eq(aiAgentRuns.sourceMessageId, e.sourceMessageId), eq(aiAgentRuns.agentId, e.agentId), inArray(aiAgentRuns.status, ["running", "completed", "handed_off"]))).limit(1);
    if (ja) return { resultado: "duplicado", runId: ja.id };
  }

  if (mode === "live" && e.chaveIdempotencia) {
    const [ja] = await db.execute<{ id: string }>(sql`
      SELECT id::text FROM ai_agent_runs WHERE agent_id = ${e.agentId}::uuid AND input->'payload'->>'chaveIdempotencia' = ${e.chaveIdempotencia}
         AND status IN ('running','completed','handed_off') AND started_at > now() - interval '12 hours' LIMIT 1`);
    if (ja) return { resultado: "duplicado", runId: ja.id, motivo: "mesma_chave_de_execucao" };
  }

  // 3. Canal e paradas de segurança (antes de gastar modelo) ----------------------
  if (mode === "live" && e.contatoId) {
    // Número autorizado: uma conexão configurada NÃO pertence ao agente por padrão. Só os números escolhidos na versão valem.
    const canais = ((versao?.guardrailConfig as Record<string, unknown> | null)?.canais ?? {}) as { whatsapp?: boolean; sessoes?: string[] };
    if (canais.whatsapp === false) { const runId = await registrarBloqueio(e, versao?.id ?? null, "canal_whatsapp_desligado"); return bloqueado("canal_whatsapp_desligado", runId); }
    const autorizadas = [versao?.channelSessionId, ...(Array.isArray(canais.sessoes) ? canais.sessoes : [])].filter((x): x is string => typeof x === "string" && x.length > 0);
    // Pool operacional: além dos números escolhidos, vale qualquer número operacional (Ajustes › WhatsApp).
    const pool = usaPoolOperacional(versao?.guardrailConfig);
    if (autorizadas.length || pool) {
      const [ct] = await db.execute<{ sessao_id: string | null }>(sql`SELECT sessao_id::text FROM contatos WHERE id = ${e.contatoId}::uuid AND organizacao_id = ${e.organizacaoId}::uuid`);
      const noPool = pool && await sessaoEhOperacional(e.organizacaoId, ct?.sessao_id);
      if (!ct?.sessao_id || (!autorizadas.includes(ct.sessao_id) && !noPool)) { const runId = await registrarBloqueio(e, versao?.id ?? null, "numero_nao_autorizado_para_o_agente"); return bloqueado("numero_nao_autorizado_para_o_agente", runId); }
    }
    const canal = await avaliarEnvio({ organizacaoId: e.organizacaoId, contatoId: e.contatoId, proativo: Boolean(e.proativo), agora });
    if (!canal.permitido) { const runId = await registrarBloqueio(e, versao?.id ?? null, canal.codigo); return bloqueado(canal.codigo, runId); }
    if (e.evento === EVENTO_MENSAGEM) {
      const parada = motivoDeParada(e.mensagem, lerExpressoesHandoff(versao?.handoffConfig));
      if (parada) {
        const motivo = ROTULO_PARADA[parada];
        const runId = await registrarBloqueio(e, versao?.id ?? null, motivo, "handed_off");
        const agenteUsuarioId = await usuarioDoAgente(e.agentId);
        if (parada === "descadastro") {
          await lembrar({ organizacaoId: e.organizacaoId, escopo: "pessoa", contatoId: e.contatoId, leadId: e.leadId ?? null, tipo: "preferencia", chave: "opt_out", valor: "O contato pediu para não receber mensagens", fonte: "mensagem", fonteRef: e.sourceMessageId ?? null, confirmado: Boolean(e.sourceMessageId), agentId: e.agentId, runId });
        }
        // devolverAoHumano já avisa a pessoa; a atribuição só registra quem recebeu (um aviso por handoff).
        const devolvido = agenteUsuarioId ? await devolverAoHumano({ organizacaoId: e.organizacaoId, agenteUsuarioId, agentId: e.agentId, leadId: e.leadId ?? null, contatoId: e.contatoId, motivo, prioridade: parada === "pedido_humano" ? "normal" : "urgente" }) : null;
        await transferirParaHumano({ organizacaoId: e.organizacaoId, contatoId: e.contatoId, leadId: e.leadId, motivo: parada === "descadastro" ? "descadastro" : motivo, resumo: `Última mensagem do contato: "${e.mensagem.slice(0, 300)}"`, humanoUsuarioId: devolvido?.humanoId ?? null, notificar: !devolvido?.humanoId });
        return { resultado: "handover", motivo: parada, runId };
      }
    }
    const limites = lerLimites(versao?.guardrailConfig);
    if ((e.proativo || !limites.responderForaDoHorario) && !dentroDoHorario(limites.horario, agora)) {
      const runId = await registrarBloqueio(e, versao?.id ?? null, "fora_do_horario");
      return bloqueado("fora_do_horario", runId);
    }
    const estouro = excedeTaxa(await contagemDeMensagens(e.contatoId, agora), limites, Boolean(e.proativo));
    if (estouro) {
      const runId = await registrarBloqueio(e, versao?.id ?? null, `taxa_maxima_${estouro}`);
      await db.insert(aiAlerts).values({ organizacaoId: e.organizacaoId, kind: "taxa_maxima", severity: "warning", title: "Agente atingiu o limite de mensagens", body: `Conversa ${e.contatoId}: limite por ${estouro}.`, refKind: "contato", refId: e.contatoId });
      return bloqueado(`taxa_maxima_${estouro}`, runId);
    }
  }

  // 4. Lease: um run por atendimento -------------------------------------------------
  const leaseDe = atrib?.id ?? null;
  if (leaseDe && !(await tomarLease(leaseDe))) return { resultado: "ocupado", motivo: "execucao_em_andamento" };

  let ultimo: ResultadoAcionar = { resultado: "sem_resposta" };
  let entrada = e;
  try {
    // 5. Drena: se chegar mensagem durante o run, atende em seguida (no máx. 3 voltas)
    for (let volta = 0; volta < 3; volta++) {
      const inicio = new Date();
      if (mode === "live" && entrada.contatoId) await garantirTranscricoes(entrada.contatoId).catch(() => 0);
      const mensagem = await textoDaMensagem(entrada);
      try {
        const r = await executeAgent({
          organizacaoId: e.organizacaoId, agentId: e.agentId, eventType: entrada.evento, message: mensagem, contatoId: entrada.contatoId ?? null, leadId: entrada.leadId ?? null,
          sourceMessageId: entrada.sourceMessageId ?? null, mode, atribuicaoId: atrib?.id ?? null, objetivo: atrib?.objetivo ?? e.atribuir?.objetivo ?? null,
          motivoDaExecucao: entrada.motivoDaExecucao ?? null, compromissoId: entrada.compromissoId ?? null, somenteAnalise: e.somenteAnalise, suppressEgress: e.somenteAnalise ? true : undefined,
          payload: { chaveIdempotencia: e.chaveIdempotencia ?? null, origem: e.origem ?? null }, atribuicaoAutonomia: (atrib?.autonomia as "suggest" | "approval" | "autonomous" | null) ?? null,
        });
        let status: StatusAtribuicao = "ativa";
        let motivo: string | null = null;
        if (r.handoff) {
          const [aprov] = await db.select({ id: aiCases.id }).from(aiCases).where(and(eq(aiCases.runId, r.runId), eq(aiCases.source, "tool_approval"))).limit(1);
          status = aprov ? "aguardando_aprovacao" : "humano"; motivo = aprov ? "ação aguardando aprovação" : "agente pediu uma pessoa";
        }
        if (atrib) await registrarExecucaoNaAtribuicao(atrib.id, { runId: r.runId, status, motivo, estado: { ultima_acao: entrada.evento, ultimo_run_em: new Date().toISOString() } });
        ultimo = { resultado: r.handoff ? "handover" : r.sentMessageIds.length || r.responseText ? "respondeu" : "sem_resposta", runId: r.runId, mensagensEnviadas: r.sentMessageIds.length };
        if (r.handoff) break;
      } catch (err) {
        if (err instanceof NoEligibleAgentError) { ultimo = bloqueado("agente_nao_elegivel"); break; }
        const msg = err instanceof Error ? err.message : String(err);
        if (/duplicate key|uq_ai_agent_runs_one_live_per_contact/i.test(msg)) { ultimo = { resultado: "ocupado", motivo: "execucao_em_andamento" }; break; }
        if (atrib) await registrarExecucaoNaAtribuicao(atrib.id, { runId: atrib.ultimoRunId ?? "00000000-0000-0000-0000-000000000000", status: "falha", motivo: msg.slice(0, 300) }).catch(() => undefined);
        console.error(`[agentes] falha ao acionar ${e.agentId} (${entrada.evento}):`, err);
        await notificarSupervisor(e.organizacaoId, versao?.guardrailConfig, { titulo: "Agente falhou ao atender", mensagem: msg, link: "/automacoes/execucoes" }).catch(() => undefined);
        ultimo = { resultado: "falhou", motivo: msg };
        break;
      }
      if (mode !== "live" || e.evento !== EVENTO_MENSAGEM || !entrada.contatoId) break;
      const nova = await mensagemNaoAtendida(entrada.contatoId, e.agentId, inicio);
      if (!nova) break;
      entrada = { ...e, mensagem: nova.conteudo ?? "[mensagem]", sourceMessageId: nova.id };
    }
  } finally {
    if (leaseDe) await soltarLease(leaseDe);
  }
  return ultimo;
}

/** Nome do agente (telas e logs). */
export async function nomeDoAgente(agentId: string): Promise<string | null> {
  const [a] = await db.select({ nome: aiAgents.nome }).from(aiAgents).where(eq(aiAgents.id, agentId)).limit(1);
  return a?.nome ?? null;
}
