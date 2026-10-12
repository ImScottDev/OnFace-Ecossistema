/**
 * Estado da IA numa conversa de WhatsApp: "o agente responde aqui? por quê? e
 * por que não respondeu?". Antes a tela dizia "O NEXO ainda não está ligado" em
 * toda conversa, fosse qual fosse o estado real.
 *
 * Fonte única de cada fato:
 *  - quem PODE responder: agente publicado (ai_agents.published_version_id) cujo
 *    gatilho inclui `conversation.message_received` e cuja versão está ligada a
 *    este número (channel_session_id) ou a nenhum (vale para todos); na falta,
 *    o SDR legado (ai_sdr_config.ativo);
 *  - se está PAUSADA nesta conversa: ai_sdr_contato_state.ai_ativo, a mesma linha
 *    que o handoff do agente e o worker já usam;
 *  - o que ACONTECEU: ai_agent_runs (status, erro) do contato.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const EVENTO_RESPOSTA = "conversation.message_received";

export type AgenteElegivel = { id: string; nome: string; sessaoId: string | null; prioridade: number };
export type AtribuicaoNoEstado = {
  id: string; agentId: string; agente: string; status: string; objetivo: string | null; motivoEstado: string | null; resumoHandoff: string | null;
  copiloto: boolean; humano: string | null; proximaRetomadaEm: string | null; ultimaExecucaoEm: string | null;
};
export type EntradaEstadoIa = {
  /** Atribuição persistente de agente (Atendimento/automação). Quando existe, ela manda no estado. */
  atribuicao?: AtribuicaoNoEstado | null;
  agentes: AgenteElegivel[];
  legadoAtivo: boolean;
  sessao: { id: string; label: string; status: string } | null;
  pausa: { aiAtivo: boolean; motivo: string | null; por: string | null; em: string | null } | null;
  /** Quem ligou a resposta automática nesta conversa (opt-in). Sem isso, nenhum agente responde. */
  ligada: { por: string | null; em: string | null } | null;
  ultimaExecucao: { status: string; em: string; agente: string | null; erro: string | null } | null;
  ultimaEntradaEm: string | null;
};
export type EstadoIa = {
  estado: "ativa" | "pausada" | "sem_agente" | "desligada" | "aguardando_aprovacao" | "humano" | "falha";
  /** Atribuição persistente, quando há: objetivo, handoff e próxima retomada do agente. */
  atribuicao: AtribuicaoNoEstado | null;
  agente: { id: string | null; nome: string; origem: "nativo" | "legado" } | null;
  /** Por que está neste estado, em uma frase. */
  motivo: string;
  /** Algo que impede o envio mesmo com o agente ligado (ex.: número desconectado). */
  aviso: string | null;
  ultimaExecucao: EntradaEstadoIa["ultimaExecucao"];
  /** Preenchido quando o cliente escreveu depois da última execução: por que o agente não respondeu. */
  semResposta: string | null;
};

/** Versão ligada a um número só atende conversa dele; sem número fixo vale para todos. Usada pelo runtime e pela tela. */
export const versaoAtendeSessao = (vinculadaA: string | null | undefined, sessaoDoContato: string | null | undefined): boolean =>
  !vinculadaA || vinculadaA === (sessaoDoContato ?? null);

const MOTIVOS_PAUSA: Record<string, string> = {
  manual_toggle: "pausada por uma pessoa do time",
  criterio_concluido: "o agente concluiu o critério e passou para uma pessoa",
  pedido_contato: "o cliente pediu uma pessoa",
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Pura: dado o que o banco diz, decide o estado e a explicação. */
export function decidirEstadoIa(e: EntradaEstadoIa): EstadoIa {
  const doNumero = e.agentes
    .filter((a) => versaoAtendeSessao(a.sessaoId, e.sessao?.id))
    .sort((a, b) => b.prioridade - a.prioridade);
  const agente: EstadoIa["agente"] = doNumero[0]
    ? { id: doNumero[0].id, nome: doNumero[0].nome, origem: "nativo" }
    : e.legadoAtivo ? { id: null, nome: "SDR (configuração clássica)", origem: "legado" } : null;

  let estado: EstadoIa["estado"];
  let motivo: string;
  const at = e.atribuicao ?? null;
  if (at && at.status !== "encerrada") {
    const agAt: EstadoIa["agente"] = { id: at.agentId, nome: at.agente, origem: "nativo" };
    const retomada = at.proximaRetomadaEm ? ` Próxima retomada combinada: ${quando(at.proximaRetomadaEm)}.` : "";
    if (at.status === "humano") { estado = "humano"; motivo = `Atendimento sob responsabilidade ${at.humano ? `de ${at.humano}` : "humana"}${at.motivoEstado ? `: ${at.motivoEstado}` : ""}. ${at.agente} não responde${at.copiloto ? " e segue como copiloto interno" : ""}.`; }
    else if (at.status === "pausada") { estado = "pausada"; motivo = `${at.agente} está pausado neste atendimento${at.motivoEstado ? `: ${at.motivoEstado}` : ""}.${retomada}`; }
    else if (at.status === "aguardando_aprovacao") { estado = "aguardando_aprovacao"; motivo = `${at.agente} preparou uma ação e aguarda a decisão de uma pessoa.`; }
    else if (at.status === "falha") { estado = "falha"; motivo = `A última execução de ${at.agente} falhou${at.motivoEstado ? `: ${at.motivoEstado}` : ""}. Ele tenta de novo na próxima mensagem.`; }
    else { estado = "ativa"; motivo = `${at.agente} conduz este atendimento${at.objetivo ? ` (objetivo: ${at.objetivo})` : ""}.${retomada}`; }
    const aviso = e.sessao && e.sessao.status !== "connected" ? `O número ${e.sessao.label?.trim() || ""} está desconectado: o agente não consegue enviar respostas.`.replace("  ", " ") : null;
    const exec = e.ultimaExecucao;
    const semResposta = exec && ["failed", "aborted"].includes(exec.status) ? `A última execução (${quando(exec.em)}) ${exec.status === "failed" ? "falhou" : "foi interrompida"}${exec.erro ? `: ${exec.erro}` : ""}.` : null;
    return { estado, atribuicao: at, agente: agAt, motivo, aviso, ultimaExecucao: exec, semResposta };
  }
  if (e.pausa && !e.pausa.aiAtivo) {
    estado = "pausada";
    const por = e.pausa.motivo ? (MOTIVOS_PAUSA[e.pausa.motivo] ?? `motivo: ${e.pausa.motivo}`) : "pausada";
    motivo = `IA pausada nesta conversa: ${por}${e.pausa.por ? ` (${e.pausa.por})` : ""}${e.pausa.em ? ` em ${quando(e.pausa.em)}` : ""}.`;
  } else if (agente && !e.ligada) {
    estado = "desligada";
    motivo = `Resposta automática desligada nesta conversa. Ligue para ${agente.nome} responder as mensagens novas.`;
  } else if (agente) {
    estado = "ativa";
    motivo = `${agente.nome} responde as mensagens novas desta conversa${e.ligada?.por ? ` (ligado por ${e.ligada.por}` : ""}${e.ligada?.por && e.ligada.em ? ` em ${quando(e.ligada.em)})` : e.ligada?.por ? ")" : ""}.`;
  } else {
    estado = "sem_agente";
    const outro = e.agentes.find((a) => a.sessaoId && a.sessaoId !== e.sessao?.id);
    motivo = outro
      ? `O agente "${outro.nome}" está ligado a outro número, não a ${e.sessao?.label?.trim() || "este"}. Nenhum agente atende este número.`
      : "Nenhum agente publicado atende conversas de WhatsApp. Publique um em Automações > Agentes.";
  }

  const aviso = agente && e.sessao && e.sessao.status !== "connected"
    ? `O número ${e.sessao.label?.trim() || ""} está desconectado: o agente não consegue enviar respostas.`.replace("  ", " ")
    : null;

  let semResposta: string | null = null;
  const exec = e.ultimaExecucao;
  const entrada = e.ultimaEntradaEm;
  if (entrada && (!exec || new Date(exec.em) < new Date(entrada))) {
    if (estado === "pausada") semResposta = `A mensagem de ${quando(entrada)} não foi respondida pela IA porque ela está pausada.`;
    else if (estado === "sem_agente") semResposta = `A mensagem de ${quando(entrada)} ficou sem resposta automática: não há agente para este número.`;
    else if (estado === "desligada") semResposta = `A mensagem de ${quando(entrada)} ficou sem resposta automática: ninguém ligou a IA nesta conversa.`;
    else if (aviso) semResposta = `A mensagem de ${quando(entrada)} não teve resposta automática: o número está desconectado.`;
    else semResposta = `A mensagem de ${quando(entrada)} ainda não tem execução do agente (a resposta pode estar na fila).`;
  } else if (exec && ["failed", "aborted"].includes(exec.status)) {
    semResposta = `A última execução (${quando(exec.em)}) ${exec.status === "failed" ? "falhou" : "foi interrompida"}${exec.erro ? `: ${exec.erro}` : ""}.`;
  }

  return { estado, atribuicao: null, agente, motivo, aviso, ultimaExecucao: exec, semResposta };
}

function eventosDoGatilho(t: unknown): string[] {
  if (!t || typeof t !== "object") return [];
  const c = t as Record<string, unknown>;
  return [c.eventType, c.trigger, ...(Array.isArray(c.events) ? c.events : []), ...(Array.isArray(c.eventTypes) ? c.eventTypes : [])]
    .filter((v): v is string => typeof v === "string");
}

export async function estadoDaIaNaConversa(organizacaoId: string, contatoId: string): Promise<EstadoIa | null> {
  const [contato] = await db.execute<{ sessao_id: string | null }>(sql`
    SELECT sessao_id::text FROM contatos WHERE id = ${contatoId}::uuid AND organizacao_id = ${organizacaoId}::uuid`);
  if (!contato) return null;

  const [atribRows] = await Promise.all([db.execute<{ id: string; agent_id: string; agente: string; status: string; objetivo: string | null; motivo_estado: string | null; resumo_handoff: string | null; copiloto: boolean; humano: string | null; retomada: string | null; ultima: string | null }>(sql`
    SELECT a.id::text, a.agent_id::text, ag.nome AS agente, a.status, a.objetivo, a.motivo_estado, a.resumo_handoff, a.copiloto, u.nome AS humano,
           (SELECT min(c.due_at)::text FROM ai_agent_compromissos c WHERE c.atribuicao_id = a.id AND c.status IN ('pendente','bloqueado')) AS retomada, a.ultima_execucao_em::text AS ultima
      FROM ai_agent_atribuicoes a JOIN ai_agents ag ON ag.id = a.agent_id LEFT JOIN usuarios u ON u.id = a.humano_usuario_id
     WHERE a.organizacao_id = ${organizacaoId}::uuid AND a.contato_id = ${contatoId}::uuid AND a.status <> 'encerrada' ORDER BY a.updated_at DESC LIMIT 1`)]);
  const [agentes, sessao, pausa, legado, run, entrada] = await Promise.all([
    db.execute<{ id: string; nome: string; prioridade: number; sessao_id: string | null; trigger: unknown }>(sql`
      SELECT a.id::text, a.nome, a.prioridade, v.channel_session_id::text AS sessao_id, v.trigger_config AS trigger
        FROM ai_agents a JOIN ai_agent_versions v ON v.id = a.published_version_id
       WHERE a.organizacao_id = ${organizacaoId}::uuid AND a.status = 'published' AND v.status = 'published' AND a.archived_at IS NULL
       ORDER BY a.prioridade DESC, a.updated_at DESC`), // mesma ordem de selectAgent no runtime
    contato.sessao_id
      ? db.execute<{ id: string; label: string; status: string }>(sql`
          SELECT id::text, COALESCE(NULLIF(btrim(label), ''), session_name) AS label, status FROM whatsapp_sessao WHERE id = ${contato.sessao_id}::uuid`)
      : Promise.resolve([] as { id: string; label: string; status: string }[]),
    db.execute<{ ai_ativo: boolean; motivo: string | null; por: string | null; em: string | null; ligada_por: string | null; ligada_em: string | null }>(sql`
      SELECT s.ai_ativo, s.handoff_motivo AS motivo, u.nome AS por, s.handoff_at::text AS em, l.nome AS ligada_por, s.ia_ligada_em::text AS ligada_em
        FROM ai_sdr_contato_state s LEFT JOIN usuarios u ON u.id = s.handoff_usuario_id LEFT JOIN usuarios l ON l.id = s.ia_ligada_por
       WHERE s.contato_id = ${contatoId}::uuid`),
    db.execute<{ ativo: boolean }>(sql`SELECT ativo FROM ai_sdr_config WHERE organizacao_id = ${organizacaoId}::uuid`),
    db.execute<{ status: string; em: string; agente: string | null; erro: string | null }>(sql`
      SELECT r.status, r.started_at::text AS em, a.nome AS agente, COALESCE(r.erro, r.abort_reason) AS erro
        FROM ai_agent_runs r JOIN ai_agents a ON a.id = r.agent_id
       WHERE r.contato_id = ${contatoId}::uuid AND r.modo = 'live' ORDER BY r.started_at DESC LIMIT 1`),
    db.execute<{ em: string | null }>(sql`
      SELECT max(created_at)::text AS em FROM whatsapp_mensagens WHERE contato_id = ${contatoId}::uuid AND direcao = 'in'`),
  ]);

  const ar = atribRows[0];
  return decidirEstadoIa({
    atribuicao: ar ? { id: ar.id, agentId: ar.agent_id, agente: ar.agente, status: ar.status, objetivo: ar.objetivo, motivoEstado: ar.motivo_estado, resumoHandoff: ar.resumo_handoff, copiloto: ar.copiloto, humano: ar.humano, proximaRetomadaEm: ar.retomada, ultimaExecucaoEm: ar.ultima } : null,
    agentes: agentes
      .filter((a) => eventosDoGatilho(a.trigger).includes(EVENTO_RESPOSTA))
      .map((a) => ({ id: a.id, nome: a.nome, sessaoId: a.sessao_id, prioridade: a.prioridade })),
    legadoAtivo: legado[0]?.ativo === true,
    sessao: sessao[0] ?? null,
    pausa: pausa[0] ? { aiAtivo: pausa[0].ai_ativo, motivo: pausa[0].motivo, por: pausa[0].por, em: pausa[0].em } : null,
    ligada: pausa[0]?.ligada_em ? { por: pausa[0].ligada_por, em: pausa[0].ligada_em } : null,
    ultimaExecucao: run[0] ?? null,
    ultimaEntradaEm: entrada[0]?.em ?? null,
  });
}
