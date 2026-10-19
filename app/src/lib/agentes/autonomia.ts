/**
 * Autonomia do agente-usuário.
 *
 * Quando o responsável do lead/oportunidade é uma agente, o worker a aciona em
 * três eventos: lead novo atribuído a ela, mensagem do cliente no WhatsApp da
 * conversa e toque de follow-up vencido. Em todos, antes do modelo:
 *   - parada: cliente pediu uma pessoa / assunto sensível / pediu para parar
 *     -> handover imediato, sem chamar o modelo;
 *   - horário comercial (contato ativo) e taxa máxima de mensagens;
 * e depois dele, o que a agente fez já saiu pelas ferramentas (timeline assinada
 * por ela). O envio é só pela sessão de WhatsApp da conversa (`executeAgent`).
 */
import { and, asc, desc, eq, gt, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiAgentRuns, aiAgentVersions, aiAlerts, aiSdrContatoState, atividades, contatos, delegacoesAgente, leads, negocios,
  whatsappMensagens, whatsappSessao,
} from "@/lib/db/schema";
import { executeAgent, NoEligibleAgentError } from "@/lib/ai-platform/runtime/execute-agent";
import * as preVendas from "@/lib/vendas/pre-vendas";
import { atorDaAgente, devolverAoHumano, lerPadroesDeAgentes } from "./handover";
import { agenteDoUsuario, type UsuarioAgente } from "./usuario-do-agente";
import { delegarAAgente } from "./delegacao";
import { dentroDoHorario, excedeTaxa, lerLimites, motivoDeParada, ROTULO_PARADA, type LimitesDoAgente } from "./guardrails";
import { lerExpressoesHandoff } from "@/lib/ai/agente-escopo";

const DIA = 24 * 60 * 60 * 1000;

export async function versaoPublicada(agentId: string) {
  const [v] = await db.select().from(aiAgentVersions).where(and(eq(aiAgentVersions.agentId, agentId), eq(aiAgentVersions.status, "published"))).limit(1);
  return v ?? null;
}

/** Registra um run que NÃO chamou o modelo (parada ou limite), para a execução aparecer em Execuções com o motivo. */
export async function registrarRunBloqueado(p: {
  organizacaoId: string; agentId: string; versionId: string | null; contatoId: string | null; leadId: string | null;
  evento: string; status: "aborted" | "handed_off"; motivo: string; sourceMessageId?: string | null;
}) {
  const [run] = await db.insert(aiAgentRuns).values({
    organizacaoId: p.organizacaoId, agentId: p.agentId, versionId: p.versionId, contatoId: p.contatoId, leadId: p.leadId,
    sourceMessageId: p.sourceMessageId ?? null, modo: "live", status: p.status, input: { eventType: p.evento },
    trace: [{ type: "guardrail", decisao: p.status === "handed_off" ? "handover" : "bloqueado", motivo: p.motivo }],
    abortReason: p.status === "aborted" ? p.motivo : null, handoffMotivo: p.status === "handed_off" ? p.motivo : null, completedAt: new Date(),
  }).returning({ id: aiAgentRuns.id });
  return run.id;
}

export async function contagemDeMensagens(contatoId: string, agora: Date) {
  const [c] = await db.execute<{ hora: number; dia: number; seguidas: number }>(sql`
    SELECT count(*) FILTER (WHERE m.created_at > ${new Date(agora.getTime() - 3_600_000).toISOString()}::timestamptz)::int AS hora,
           count(*) FILTER (WHERE m.created_at > ${new Date(agora.getTime() - DIA).toISOString()}::timestamptz)::int AS dia,
           (SELECT count(*)::int FROM whatsapp_mensagens x WHERE x.contato_id = ${contatoId}::uuid AND x.direcao = 'out'
              AND x.dados->>'aiGenerated' = 'true'
              AND x.created_at > COALESCE((SELECT max(i.created_at) FROM whatsapp_mensagens i WHERE i.contato_id = ${contatoId}::uuid AND i.direcao = 'in'), 'epoch')) AS seguidas
      FROM whatsapp_mensagens m
     WHERE m.contato_id = ${contatoId}::uuid AND m.direcao = 'out' AND m.dados->>'aiGenerated' = 'true'`);
  return { naHora: c?.hora ?? 0, noDia: c?.dia ?? 0, seguidasSemRetorno: c?.seguidas ?? 0 };
}

/**
 * Quem responde esta conversa é um agente?
 *
 * Olha os DOIS responsáveis — o da conversa e o do lead — e fica com o que for
 * agente, a conversa na frente.
 *
 * Antes o responsável do lead sobrescrevia o da conversa, e bastava o lead ter
 * dono humano para a agente calar: em 19/10/2026 um contato cuja conversa era
 * da Lia, num lead do Kauã, recebeu duas mensagens e não gerou execução
 * nenhuma — o sistema concluía "o responsável não é agente" e nem tentava.
 * Pôr a agente como responsável do número é dizer que ela atende ali; o dono
 * humano do lead é de quem é o NEGÓCIO, e as duas coisas convivem.
 */
export async function agenteResponsavel(organizacaoId: string, p: { leadId?: string | null; contatoId?: string | null }): Promise<(UsuarioAgente & { leadId: string | null }) | null> {
  let leadId = p.leadId ?? null;
  let respDaConversa: string | null = null;
  if (p.contatoId) {
    const [c] = await db.select({ l: contatos.leadId, r: contatos.responsavelId }).from(contatos).where(eq(contatos.id, p.contatoId)).limit(1);
    leadId = leadId ?? c?.l ?? null;
    respDaConversa = c?.r ?? null;
  }
  let respDoLead: string | null = null;
  if (leadId) {
    const [l] = await db.select({ r: leads.responsavelId }).from(leads).where(and(eq(leads.id, leadId), eq(leads.organizacaoId, organizacaoId))).limit(1);
    respDoLead = l?.r ?? null;
  }
  for (const responsavel of candidatosAResponder(respDaConversa, respDoLead)) {
    const a = await agenteDoUsuario(organizacaoId, responsavel);
    if (a) return { ...a, leadId };
  }
  return null;
}

/**
 * Em que ordem perguntar "este responsável é um agente?": a conversa primeiro,
 * o lead depois, sem repetir e sem nulo. É a parte da regra que dá para provar
 * sem banco — ver `autonomia.test.ts`.
 */
export function candidatosAResponder(respDaConversa: string | null, respDoLead: string | null): string[] {
  return [...new Set([respDaConversa, respDoLead].filter((x): x is string => !!x))];
}

export type ResultadoAcionamento =
  | { tratado: false }
  | { tratado: true; resultado: "respondeu" | "handover" | "bloqueado" | "pausado" | "falhou"; motivo?: string; runId?: string };

/**
 * Mensagem do cliente numa conversa cujo responsável é uma agente.
 * `tratado: false` = o responsável não é agente (o chamador segue o fluxo antigo).
 */
export async function acionarAgenteParaMensagem(p: {
  organizacaoId: string; contatoId: string; leadId?: string | null; mensagem: string; sourceMessageId?: string | null; agora?: Date;
}): Promise<ResultadoAcionamento> {
  const agente = await agenteResponsavel(p.organizacaoId, p);
  if (!agente) return { tratado: false };
  const agora = p.agora ?? new Date();
  const versao = await versaoPublicada(agente.agenteId);
  if (!versao) return { tratado: true, resultado: "bloqueado", motivo: "agente_sem_versao_publicada" };
  const leadId = agente.leadId;

  const [pausa] = await db.select({ ativo: aiSdrContatoState.aiAtivo }).from(aiSdrContatoState).where(eq(aiSdrContatoState.contatoId, p.contatoId)).limit(1);
  if (pausa && !pausa.ativo) return { tratado: true, resultado: "pausado", motivo: "ia_pausada_na_conversa" };

  const parada = motivoDeParada(p.mensagem, lerExpressoesHandoff(versao.handoffConfig));
  if (parada) {
    const motivo = ROTULO_PARADA[parada];
    const runId = await registrarRunBloqueado({ organizacaoId: p.organizacaoId, agentId: agente.agenteId, versionId: versao.id, contatoId: p.contatoId, leadId, evento: "conversation.message_received", status: "handed_off", motivo, sourceMessageId: p.sourceMessageId });
    await devolverAoHumano({ organizacaoId: p.organizacaoId, agenteUsuarioId: agente.usuarioId, agentId: agente.agenteId, leadId, contatoId: p.contatoId, motivo, prioridade: parada === "pedido_humano" ? "normal" : "urgente" });
    return { tratado: true, resultado: "handover", motivo: parada, runId };
  }

  const limites = lerLimites(versao.guardrailConfig);
  if (!limites.responderForaDoHorario && !dentroDoHorario(limites.horario, agora)) {
    const runId = await registrarRunBloqueado({ organizacaoId: p.organizacaoId, agentId: agente.agenteId, versionId: versao.id, contatoId: p.contatoId, leadId, evento: "conversation.message_received", status: "aborted", motivo: "fora_do_horario", sourceMessageId: p.sourceMessageId });
    return { tratado: true, resultado: "bloqueado", motivo: "fora_do_horario", runId };
  }
  const estouro = excedeTaxa(await contagemDeMensagens(p.contatoId, agora), limites, false);
  if (estouro) {
    const runId = await registrarRunBloqueado({ organizacaoId: p.organizacaoId, agentId: agente.agenteId, versionId: versao.id, contatoId: p.contatoId, leadId, evento: "conversation.message_received", status: "aborted", motivo: `taxa_maxima_${estouro}`, sourceMessageId: p.sourceMessageId });
    await db.insert(aiAlerts).values({ organizacaoId: p.organizacaoId, kind: "taxa_maxima", severity: "warning", title: `${agente.nome} atingiu o limite de mensagens`, body: `Conversa ${p.contatoId}: limite por ${estouro}.`, refKind: "contato", refId: p.contatoId });
    return { tratado: true, resultado: "bloqueado", motivo: `taxa_maxima_${estouro}`, runId };
  }

  try {
    const r = await executeAgent({
      organizacaoId: p.organizacaoId, agentId: agente.agenteId, eventType: "conversation.message_received", message: p.mensagem,
      contatoId: p.contatoId, leadId, sourceMessageId: p.sourceMessageId ?? null, mode: "live",
    });
    return { tratado: true, resultado: r.handoff ? "handover" : "respondeu", runId: r.runId };
  } catch (err) {
    if (err instanceof NoEligibleAgentError) return { tratado: true, resultado: "bloqueado", motivo: "agente_nao_elegivel" };
    console.error(`[agentes] falha ao acionar ${agente.nome} para o contato ${p.contatoId}:`, err);
    return { tratado: true, resultado: "falhou", motivo: err instanceof Error ? err.message : String(err) };
  }
}

/* ── Conversa do lead (contato) ────────────────────────────────────────── */

/** Contato de WhatsApp do lead; cria na sessão do agente (ou a padrão) quando não existe. */
export async function contatoDoLead(organizacaoId: string, leadId: string, sessaoDoAgente: string | null) {
  const [ja] = await db.select().from(contatos).where(and(eq(contatos.organizacaoId, organizacaoId), eq(contatos.leadId, leadId)))
    .orderBy(...(sessaoDoAgente ? [sql`(${contatos.sessaoId} = ${sessaoDoAgente}::uuid) DESC`] : []), desc(contatos.ultimaMsgAt)).limit(1);
  if (ja) return ja;
  const [lead] = await db.select({ nome: leads.nome, telefone: leads.telefone, email: leads.email, r: leads.responsavelId }).from(leads).where(eq(leads.id, leadId)).limit(1);
  let tel = lead?.telefone?.replace(/\D/g, "");
  if (!lead || !tel) return null;
  if (tel.length === 10 || tel.length === 11) tel = "55" + tel;
  const sessoes = await db.select().from(whatsappSessao).where(eq(whatsappSessao.organizacaoId, organizacaoId));
  const sessao = sessoes.find((s) => s.id === sessaoDoAgente) ?? sessoes.find((s) => s.status === "connected" && s.isDefault) ?? sessoes.find((s) => s.status === "connected") ?? sessoes.find((s) => s.isDefault) ?? sessoes[0];
  if (!sessao) return null;
  const [novo] = await db.insert(contatos).values({ organizacaoId, canal: "whatsapp", nome: lead.nome, telefone: tel, email: lead.email, sessaoId: sessao.id, responsavelId: lead.r, leadId }).returning();
  return novo;
}

async function contextoDoToque(leadId: string) {
  const [l] = await db.select({ nome: leads.nome, empresa: leads.empresa, origem: leads.origem, servicos: leads.servicosInteresse }).from(leads).where(eq(leads.id, leadId)).limit(1);
  return l;
}

/**
 * Primeiro contato: leads novos cujo responsável é uma agente e que ainda não
 * foram tocados por ela. Chamada pelo sweep do worker.
 */
export async function iniciarLeadsNovosDaAgente(agora = new Date(), limite = 10): Promise<{ iniciados: number; bloqueados: number }> {
  const candidatos = await db.execute<{ id: string; organizacao_id: string; responsavel_id: string }>(sql`
    SELECT l.id::text, l.organizacao_id::text, l.responsavel_id::text
      FROM leads l JOIN usuarios u ON u.id = l.responsavel_id AND u.tipo = 'agente' AND u.ativo = true
     WHERE l.tipo = 'lead' AND l.estagio_pre_vendas = 'novo' AND l.primeiro_contato_at IS NULL
       AND l.created_at > now() - interval '7 days'
       -- Já tratado (qualquer run que não falhou) não repete; falha tenta de novo a cada 10 min, no máximo 3 vezes.
       AND NOT EXISTS (SELECT 1 FROM ai_agent_runs r WHERE r.lead_id = l.id AND r.input->>'eventType' = 'lead.atribuido_ao_agente'
                          AND (r.status <> 'failed' OR r.started_at > now() - interval '10 minutes'))
       AND (SELECT count(*) FROM ai_agent_runs r WHERE r.lead_id = l.id AND r.input->>'eventType' = 'lead.atribuido_ao_agente' AND r.status = 'failed') < 3
     ORDER BY l.created_at LIMIT ${limite}`);
  let iniciados = 0, bloqueados = 0;
  for (const c of candidatos) {
    try {
      const agente = await agenteDoUsuario(c.organizacao_id, c.responsavel_id);
      const versao = agente && await versaoPublicada(agente.agenteId);
      if (!agente || !versao) continue;
      const limites = lerLimites(versao.guardrailConfig);
      // Contato ATIVO só em horário comercial: fora dele o lead espera (sem marcar run, tenta no próximo sweep).
      if (!dentroDoHorario(limites.horario, agora)) { bloqueados++; continue; }
      const contato = await contatoDoLead(c.organizacao_id, c.id, versao.channelSessionId);
      if (!contato?.telefone) {
        await registrarRunBloqueado({ organizacaoId: c.organizacao_id, agentId: agente.agenteId, versionId: versao.id, contatoId: null, leadId: c.id, evento: "lead.atribuido_ao_agente", status: "aborted", motivo: "lead_sem_whatsapp" });
        await db.insert(atividades).values({ organizacaoId: c.organizacao_id, leadId: c.id, usuarioId: agente.usuarioId, tipo: "nota_agente", titulo: `${agente.nome} não conseguiu iniciar o contato`, descricao: "O lead não tem telefone/WhatsApp ou a organização não tem sessão de WhatsApp. Um humano precisa completar o contato." });
        bloqueados++;
        continue;
      }
      const l = await contextoDoToque(c.id);
      const r = await executeAgent({
        organizacaoId: c.organizacao_id, agentId: agente.agenteId, eventType: "lead.atribuido_ao_agente", contatoId: contato.id, leadId: c.id, mode: "live",
        message: `Um lead novo foi atribuído a você em Pré-vendas (etapa Novo). Nome: ${l?.nome ?? "—"}. Empresa: ${l?.empresa ?? "não informada"}. Origem: ${l?.origem ?? "não informada"}. Interesse: ${l?.servicos?.join(", ") || "não informado"}. Inicie o contato pelo WhatsApp com uma mensagem curta e consultiva e conduza a qualificação.`,
      });
      iniciados++;
      if (r.sentMessageIds.length) await preVendas.registrarPrimeiroContato({ organizacaoId: c.organizacao_id, leadId: c.id, canal: "whatsapp", origem: "agente", ator: atorDaAgente(agente.usuarioId, agente.agenteId) });
    } catch (e) {
      console.error(`[agentes] primeiro contato do lead ${c.id} falhou:`, e);
    }
  }
  return { iniciados, bloqueados };
}

/* ── Follow-up delegado ────────────────────────────────────────────────── */

export const TAG_FOLLOWUP_IA = "follow-up ia";

/** Tag "Follow-up IA" numa oportunidade/lead delega ao agente padrão de follow-up (Ajustes > Leads). */
export async function delegarPorTag(): Promise<number> {
  const marcadas = await db.execute<{ organizacao_id: string; negocio_id: string | null; lead_id: string | null; por: string | null }>(sql`
    SELECT el.organizacao_id::text,
           CASE WHEN el.entity_type = 'negocio' THEN el.entity_id::text
                WHEN el.entity_type = 'oportunidade' THEN (SELECT o.negocio_id_legado::text FROM oportunidades o WHERE o.id = el.entity_id) END AS negocio_id,
           CASE WHEN el.entity_type = 'lead' THEN el.entity_id::text END AS lead_id,
           el.created_by_id::text AS por
      FROM entity_labels el JOIN labels lb ON lb.id = el.label_id AND lower(lb.nome) = ${TAG_FOLLOWUP_IA}
     WHERE el.entity_type IN ('negocio','oportunidade','lead') AND el.created_at > now() - interval '30 days'`);
  let n = 0;
  for (const m of marcadas) {
    try {
      if (!m.negocio_id && !m.lead_id) continue;
      const padrao = (await lerPadroesDeAgentes(m.organizacao_id)).agenteFollowupPadraoId;
      if (!padrao) continue;
      const ja = await db.select({ id: delegacoesAgente.id }).from(delegacoesAgente)
        .where(and(eq(delegacoesAgente.organizacaoId, m.organizacao_id), m.negocio_id ? eq(delegacoesAgente.negocioId, m.negocio_id) : eq(delegacoesAgente.leadId, m.lead_id!))).limit(1);
      if (ja.length) continue; // já delegada (ativa ou já devolvida): a tag não re-dispara sozinha
      await delegarAAgente({
        organizacaoId: m.organizacao_id, negocioId: m.negocio_id, leadId: m.negocio_id ? null : m.lead_id, agenteUsuarioId: padrao,
        motivo: "Tag \"Follow-up IA\" aplicada", gatilho: "tag", diasSemResposta: 0, ator: { tipo: "AUTOMATION", usuarioId: m.por, ref: "tag:follow-up-ia" },
      });
      n++;
    } catch (e) {
      console.error("[agentes] delegação por tag falhou:", e);
    }
  }
  return n;
}

/** Toques de follow-up vencidos: aciona a agente, ou devolve ao humano quando o teto de toques acabou sem resposta. */
export async function processarDelegacoesVencidas(agora = new Date(), limite = 10): Promise<{ toques: number; devolvidas: number; adiadas: number }> {
  const vencidas = await db.select().from(delegacoesAgente)
    .where(and(eq(delegacoesAgente.status, "ativa"), lte(delegacoesAgente.proximoToqueEm, agora))).orderBy(asc(delegacoesAgente.proximoToqueEm)).limit(limite);
  let toques = 0, devolvidas = 0, adiadas = 0;
  for (const d of vencidas) {
    try {
      const agente = await agenteDoUsuario(d.organizacaoId, d.agenteUsuarioId);
      const versao = agente && await versaoPublicada(agente.agenteId);
      if (!agente || !versao) { adiadas++; continue; }
      const adiar = (dias = d.intervaloDias) => db.update(delegacoesAgente).set({ proximoToqueEm: new Date(agora.getTime() + dias * DIA) }).where(eq(delegacoesAgente.id, d.id));

      // Cliente respondeu desde o último toque: a conversa é tratada pelo fluxo de mensagem recebida.
      const leadId = d.leadId ?? (d.negocioId ? (await db.select({ l: negocios.leadId }).from(negocios).where(eq(negocios.id, d.negocioId)).limit(1))[0]?.l ?? null : null);
      const contato = leadId ? await contatoDoLead(d.organizacaoId, leadId, versao.channelSessionId) : null;
      const desde = d.ultimoToqueEm ?? d.createdAt;
      if (contato) {
        const [resp] = await db.select({ id: whatsappMensagens.id }).from(whatsappMensagens)
          .where(and(eq(whatsappMensagens.contatoId, contato.id), eq(whatsappMensagens.direcao, "in"), gt(whatsappMensagens.createdAt, desde))).limit(1);
        if (resp) { await adiar(); adiadas++; continue; }
      }
      if (d.toques >= d.maxToques) {
        await devolverAoHumano({ organizacaoId: d.organizacaoId, agenteUsuarioId: agente.usuarioId, agentId: agente.agenteId, leadId, negocioId: d.negocioId, contatoId: contato?.id ?? null, motivo: `Sem resposta após ${d.toques} toques de follow-up`, resumo: `Delegação: ${d.motivo}` });
        devolvidas++;
        continue;
      }
      const limites: LimitesDoAgente = lerLimites(versao.guardrailConfig);
      if (!dentroDoHorario(limites.horario, agora)) { adiadas++; continue; }
      if (contato) {
        const estouro = excedeTaxa(await contagemDeMensagens(contato.id, agora), limites, true);
        if (estouro) { await adiar(1); adiadas++; continue; }
      }
      await executeAgent({
        organizacaoId: d.organizacaoId, agentId: agente.agenteId, eventType: "followup.delegado", contatoId: contato?.id ?? null, leadId, mode: "live",
        message: `Follow-up delegado a você (toque ${d.toques + 1} de ${d.maxToques}). Motivo da delegação: ${d.motivo}. Consulte o CRM e a conversa, e retome o contato pelo WhatsApp de forma curta e consultiva, sem repetir o que já foi dito. Se o cliente pedir uma pessoa ou houver assunto sensível, passe para um humano.`,
      });
      await db.update(delegacoesAgente).set({ toques: d.toques + 1, ultimoToqueEm: agora, proximoToqueEm: new Date(agora.getTime() + d.intervaloDias * DIA) }).where(eq(delegacoesAgente.id, d.id));
      toques++;
    } catch (e) {
      console.error(`[agentes] toque da delegação ${d.id} falhou:`, e);
      await db.update(delegacoesAgente).set({ proximoToqueEm: new Date(agora.getTime() + 60 * 60_000) }).where(eq(delegacoesAgente.id, d.id));
    }
  }
  return { toques, devolvidas, adiadas };
}

