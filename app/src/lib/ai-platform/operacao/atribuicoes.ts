/**
 * Atribuição persistente de agente (ai_agent_atribuicoes).
 *
 * Responde "QUEM conduz este atendimento agora e em que estado". É diferente de:
 *  - responsável do lead (`leads.responsavel_id`): dono comercial do registro;
 *  - cadência: sequência pré-definida de mensagens (outro produto);
 *  - automação: o que DISPARA a atribuição.
 * Atribuir muda a responsabilidade operacional (persistente); acionar pede uma
 * execução pontual (ver acionar.ts). Uma atribuição viva por contato: nunca dois
 * agentes respondendo ao mesmo contato.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiAgentAtribuicoes, aiAgentCompromissos, aiAgents, aiSdrContatoState, atividades, contatos, leads, usuarios,
} from "@/lib/db/schema";
import { isSystemAgentSlug } from "@/lib/ai/agent-studio";

export type Atribuicao = typeof aiAgentAtribuicoes.$inferSelect;
export type StatusAtribuicao = "ativa" | "pausada" | "aguardando_aprovacao" | "humano" | "falha" | "encerrada";
export const STATUS_VIVOS: StatusAtribuicao[] = ["ativa", "pausada", "aguardando_aprovacao", "falha"];
export type OrigemAtribuicao = "manual" | "atendimento" | "automacao" | "regra" | "evento";

export class AtribuicaoRecusada extends Error {
  constructor(public codigo: string, mensagem: string) { super(mensagem); }
}

export type AtorAtribuicao = { usuarioId?: string | null; rotulo?: string };

type Alvo = { contatoId?: string | null; leadId?: string | null; negocioId?: string | null };

const MS_HORA = 3_600_000;
/** Mensagem de humano nas últimas horas = atendimento humano em andamento. */
export const JANELA_HUMANO_HORAS = 4;

async function agenteDaOrg(organizacaoId: string, agentId: string) {
  const [a] = await db.select({ id: aiAgents.id, nome: aiAgents.nome, slug: aiAgents.slug, status: aiAgents.status, published: aiAgents.publishedVersionId, archivedAt: aiAgents.archivedAt })
    .from(aiAgents).where(and(eq(aiAgents.id, agentId), eq(aiAgents.organizacaoId, organizacaoId))).limit(1);
  return a ?? null;
}

/** Atribuição viva (qualquer estado que ainda bloqueia outro agente) do contato ou lead. */
export async function atribuicaoViva(organizacaoId: string, alvo: Alvo): Promise<Atribuicao | null> {
  const conds = [];
  if (alvo.contatoId) conds.push(eq(aiAgentAtribuicoes.contatoId, alvo.contatoId));
  if (alvo.leadId) conds.push(eq(aiAgentAtribuicoes.leadId, alvo.leadId));
  if (!conds.length) return null;
  const [a] = await db.select().from(aiAgentAtribuicoes)
    .where(and(eq(aiAgentAtribuicoes.organizacaoId, organizacaoId), sql`(${sql.join(conds, sql` OR `)})`, inArray(aiAgentAtribuicoes.status, [...STATUS_VIVOS, "humano"])))
    .orderBy(sql`${aiAgentAtribuicoes.updatedAt} DESC`).limit(1);
  return a ?? null;
}

/** Última mensagem enviada por uma PESSOA (não por IA) nesta conversa. */
export async function humanoAtendendoRecentemente(contatoId: string, horas = JANELA_HUMANO_HORAS): Promise<boolean> {
  const [r] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM whatsapp_mensagens
     WHERE contato_id = ${contatoId}::uuid AND direcao = 'out' AND enviado_por_id IS NOT NULL
       AND coalesce(dados->>'aiGenerated','false') <> 'true'
       AND created_at > ${new Date(Date.now() - horas * MS_HORA).toISOString()}::timestamptz`);
  return (r?.n ?? 0) > 0;
}

/** Pessoa do time escreveu nesta conversa depois de `desde` (o agente deixou de ser o único a falar). */
export async function humanoRespondeuDesde(contatoId: string, desde: Date): Promise<boolean> {
  const [r] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM whatsapp_mensagens
     WHERE contato_id = ${contatoId}::uuid AND direcao = 'out' AND enviado_por_id IS NOT NULL
       AND coalesce(dados->>'aiGenerated','false') <> 'true' AND created_at > ${desde.toISOString()}::timestamptz`);
  return (r?.n ?? 0) > 0;
}

/** Desde quando o agente conduz (criação ou última retomada). */
export const ativaDesde = (a: Pick<Atribuicao, "estado" | "createdAt">): Date => {
  const v = (a.estado as Record<string, unknown> | null)?.ativa_desde;
  return typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v) : a.createdAt;
};

async function contatoDoLead(organizacaoId: string, leadId: string): Promise<string | null> {
  const [c] = await db.select({ id: contatos.id }).from(contatos)
    .where(and(eq(contatos.organizacaoId, organizacaoId), eq(contatos.leadId, leadId))).orderBy(sql`${contatos.ultimaMsgAt} DESC NULLS LAST`).limit(1);
  return c?.id ?? null;
}

/** Mantém a flag única que o worker e o Atendimento já leem (ai_sdr_contato_state). */
async function sincronizarEstadoDaConversa(p: { organizacaoId: string; contatoId: string | null; ativo: boolean; motivo?: string | null; usuarioId?: string | null; ligar?: boolean }) {
  if (!p.contatoId) return;
  const agora = new Date();
  const ligada = p.ligar ? { iaLigadaPor: p.usuarioId ?? null, iaLigadaEm: agora } : {};
  await db.insert(aiSdrContatoState).values({
    contatoId: p.contatoId, organizacaoId: p.organizacaoId, aiAtivo: p.ativo,
    handoffStatus: p.ativo ? "ai_handling" : "human_assigned", handoffAt: p.ativo ? null : agora,
    handoffMotivo: p.ativo ? null : (p.motivo ?? "atribuicao"), handoffUsuarioId: p.ativo ? null : (p.usuarioId ?? null), ...ligada,
  }).onConflictDoUpdate({
    target: aiSdrContatoState.contatoId,
    set: {
      aiAtivo: p.ativo, handoffStatus: p.ativo ? "ai_handling" : "human_assigned", handoffAt: p.ativo ? null : agora,
      handoffMotivo: p.ativo ? null : (p.motivo ?? "atribuicao"), handoffUsuarioId: p.ativo ? null : (p.usuarioId ?? null), updatedAt: agora, ...ligada,
    },
  });
}

async function notaNaTimeline(p: { organizacaoId: string; leadId?: string | null; negocioId?: string | null; usuarioId?: string | null; titulo: string; descricao?: string | null; dados?: Record<string, unknown> }) {
  if (!p.leadId && !p.negocioId) return;
  await db.insert(atividades).values({
    organizacaoId: p.organizacaoId, leadId: p.leadId ?? null, negocioId: p.negocioId ?? null, usuarioId: p.usuarioId ?? null,
    tipo: "nota", titulo: p.titulo, descricao: p.descricao ?? null, dados: p.dados ?? {},
  });
}

export interface EntradaAtribuir extends Alvo {
  organizacaoId: string;
  agentId: string;
  objetivo?: string | null;
  autonomia?: "suggest" | "approval" | "autonomous" | null;
  origem?: OrigemAtribuicao;
  origemRef?: string | null;
  ator?: AtorAtribuicao;
  /** Troca o agente que já está atribuído (humano decidiu). Regras e automações nunca trocam sozinhas. */
  trocar?: boolean;
  /** Quem manda é uma pessoa e sabe que há humano atendendo. */
  sobrepoeHumano?: boolean;
}

export async function atribuirAgente(e: EntradaAtribuir): Promise<{ atribuicao: Atribuicao; criada: boolean }> {
  const agente = await agenteDaOrg(e.organizacaoId, e.agentId);
  if (!agente || agente.archivedAt) throw new AtribuicaoRecusada("agente_invalido", "Agente não encontrado nesta organização.");
  if (isSystemAgentSlug(agente.slug)) throw new AtribuicaoRecusada("agente_interno", "NEXO e Hermes são internos e não recebem atendimento.");
  if (agente.status !== "published" || !agente.published) throw new AtribuicaoRecusada("agente_nao_publicado", `${agente.nome} não está publicado.`);

  let leadId = e.leadId ?? null;
  let contatoId = e.contatoId ?? null;
  if (contatoId && !leadId) {
    const [c] = await db.select({ leadId: contatos.leadId }).from(contatos).where(and(eq(contatos.id, contatoId), eq(contatos.organizacaoId, e.organizacaoId))).limit(1);
    if (!c) throw new AtribuicaoRecusada("contato_invalido", "Contato não encontrado nesta organização.");
    leadId = c.leadId ?? null;
  }
  if (leadId) {
    const [l] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.id, leadId), eq(leads.organizacaoId, e.organizacaoId))).limit(1);
    if (!l) throw new AtribuicaoRecusada("lead_invalido", "Lead não encontrado nesta organização.");
    contatoId = contatoId ?? await contatoDoLead(e.organizacaoId, leadId);
  }
  if (!contatoId && !leadId && !e.negocioId) throw new AtribuicaoRecusada("alvo_obrigatorio", "Informe contato, lead ou oportunidade.");

  const origem = e.origem ?? "manual";
  const existente = await atribuicaoViva(e.organizacaoId, { contatoId, leadId });
  if (existente) {
    if (existente.agentId === e.agentId && existente.status !== "humano") {
      const [atual] = await db.update(aiAgentAtribuicoes).set({
        objetivo: e.objetivo ?? existente.objetivo, autonomia: e.autonomia ?? existente.autonomia, updatedAt: new Date(),
      }).where(eq(aiAgentAtribuicoes.id, existente.id)).returning();
      return { atribuicao: atual, criada: false };
    }
    if (existente.status === "humano" && !e.sobrepoeHumano && origem !== "manual" && origem !== "atendimento") {
      throw new AtribuicaoRecusada("humano_em_andamento", "Uma pessoa assumiu este atendimento. Só uma pessoa pode devolvê-lo ao agente.");
    }
    if (existente.agentId !== e.agentId && !e.trocar && existente.status !== "humano") {
      throw new AtribuicaoRecusada("ja_atribuida", "Já existe outro agente conduzindo este atendimento. Troque explicitamente.");
    }
    await encerrarAtribuicao({ organizacaoId: e.organizacaoId, atribuicaoId: existente.id, motivo: existente.status === "humano" ? "reassumido por agente" : "trocado de agente", ator: e.ator, silencioso: true });
  }
  if (contatoId && origem !== "manual" && origem !== "atendimento" && !e.sobrepoeHumano && await humanoAtendendoRecentemente(contatoId)) {
    throw new AtribuicaoRecusada("humano_em_andamento", "Há atendimento humano em andamento nesta conversa; a regra não substitui uma pessoa.");
  }

  const [nova] = await db.insert(aiAgentAtribuicoes).values({
    organizacaoId: e.organizacaoId, agentId: e.agentId, contatoId, leadId, negocioId: e.negocioId ?? null,
    status: "ativa", objetivo: e.objetivo ?? null, autonomia: e.autonomia ?? null, origem, origemRef: e.origemRef ?? null,
    atribuidoPor: e.ator?.usuarioId ?? null, estado: { ativa_desde: new Date().toISOString() },
  }).returning();
  await sincronizarEstadoDaConversa({ organizacaoId: e.organizacaoId, contatoId, ativo: true, usuarioId: e.ator?.usuarioId ?? null, ligar: true });
  await notaNaTimeline({
    organizacaoId: e.organizacaoId, leadId, negocioId: e.negocioId, usuarioId: e.ator?.usuarioId ?? null,
    titulo: `Atendimento atribuído a ${agente.nome}`,
    descricao: [e.objetivo ? `Objetivo: ${e.objetivo}` : null, `Origem: ${origem}${e.origemRef ? ` (${e.origemRef})` : ""}`].filter(Boolean).join("\n"),
    dados: { atribuicaoId: nova.id, agentId: e.agentId, origem },
  });
  return { atribuicao: nova, criada: true };
}

async function carregar(organizacaoId: string, atribuicaoId: string): Promise<Atribuicao> {
  const [a] = await db.select().from(aiAgentAtribuicoes).where(and(eq(aiAgentAtribuicoes.id, atribuicaoId), eq(aiAgentAtribuicoes.organizacaoId, organizacaoId))).limit(1);
  if (!a) throw new AtribuicaoRecusada("atribuicao_nao_encontrada", "Atribuição não encontrada.");
  return a;
}

export async function pausarAtribuicao(p: { organizacaoId: string; atribuicaoId: string; motivo?: string; ator?: AtorAtribuicao }): Promise<Atribuicao> {
  const a = await carregar(p.organizacaoId, p.atribuicaoId);
  if (!["ativa", "falha", "aguardando_aprovacao"].includes(a.status)) throw new AtribuicaoRecusada("estado_invalido", `Não dá para pausar uma atribuição ${a.status}.`);
  const [n] = await db.update(aiAgentAtribuicoes).set({ status: "pausada", motivoEstado: p.motivo ?? "pausado por uma pessoa", updatedAt: new Date() }).where(eq(aiAgentAtribuicoes.id, a.id)).returning();
  await sincronizarEstadoDaConversa({ organizacaoId: p.organizacaoId, contatoId: a.contatoId, ativo: false, motivo: "manual_toggle", usuarioId: p.ator?.usuarioId ?? null });
  await notaNaTimeline({ organizacaoId: p.organizacaoId, leadId: a.leadId, usuarioId: p.ator?.usuarioId ?? null, titulo: "Agente pausado neste atendimento", descricao: p.motivo ?? null, dados: { atribuicaoId: a.id } });
  return n;
}

export async function retomarAtribuicao(p: { organizacaoId: string; atribuicaoId: string; ator?: AtorAtribuicao }): Promise<Atribuicao> {
  const a = await carregar(p.organizacaoId, p.atribuicaoId);
  if (!["pausada", "humano", "falha"].includes(a.status)) throw new AtribuicaoRecusada("estado_invalido", `Não dá para retomar uma atribuição ${a.status}.`);
  const [n] = await db.update(aiAgentAtribuicoes).set({ status: "ativa", motivoEstado: null, humanoUsuarioId: null, updatedAt: new Date(), estado: sql`${aiAgentAtribuicoes.estado} || jsonb_build_object('ativa_desde', ${new Date().toISOString()}::text)` }).where(eq(aiAgentAtribuicoes.id, a.id)).returning();
  await sincronizarEstadoDaConversa({ organizacaoId: p.organizacaoId, contatoId: a.contatoId, ativo: true, usuarioId: p.ator?.usuarioId ?? null, ligar: true });
  // Compromissos que ficaram presos pelo humano voltam à fila: o agente reconstrói o contexto e decide se ainda valem.
  await db.update(aiAgentCompromissos).set({ status: "pendente", bloqueioMotivo: null, updatedAt: new Date() })
    .where(and(eq(aiAgentCompromissos.atribuicaoId, a.id), eq(aiAgentCompromissos.status, "bloqueado")));
  await notaNaTimeline({ organizacaoId: p.organizacaoId, leadId: a.leadId, usuarioId: p.ator?.usuarioId ?? null, titulo: "Agente retomou o atendimento", dados: { atribuicaoId: a.id } });
  return n;
}

export interface EntradaTransferencia {
  organizacaoId: string;
  atribuicaoId?: string;
  contatoId?: string | null;
  leadId?: string | null;
  motivo: string;
  resumo?: string | null;
  humanoUsuarioId?: string | null;
  copiloto?: boolean;
  ator?: AtorAtribuicao;
}

/** Humano assume (ou o agente passa): a IA para de responder, o histórico fica, o resumo vai para a timeline. */
export async function transferirParaHumano(e: EntradaTransferencia): Promise<Atribuicao | null> {
  const a = e.atribuicaoId
    ? await carregar(e.organizacaoId, e.atribuicaoId)
    : await atribuicaoViva(e.organizacaoId, { contatoId: e.contatoId, leadId: e.leadId });
  if (!a) {
    // Sem atribuição, a conversa ainda pode ter IA ligada: desliga para a IA parar.
    await sincronizarEstadoDaConversa({ organizacaoId: e.organizacaoId, contatoId: e.contatoId ?? null, ativo: false, motivo: e.motivo, usuarioId: e.humanoUsuarioId ?? e.ator?.usuarioId ?? null });
    return null;
  }
  if (e.humanoUsuarioId) {
    const [h] = await db.select({ id: usuarios.id }).from(usuarios).where(and(eq(usuarios.id, e.humanoUsuarioId), eq(usuarios.organizacaoId, e.organizacaoId), eq(usuarios.ativo, true), sql`${usuarios.tipo} <> 'agente'`)).limit(1);
    if (!h) throw new AtribuicaoRecusada("humano_invalido", "Escolha uma pessoa ativa desta organização.");
  }
  const humano = e.humanoUsuarioId ?? e.ator?.usuarioId ?? null;
  const [n] = await db.update(aiAgentAtribuicoes).set({
    status: "humano", motivoEstado: e.motivo, resumoHandoff: e.resumo ?? a.resumoHandoff, humanoUsuarioId: humano, copiloto: e.copiloto ?? a.copiloto, updatedAt: new Date(),
  }).where(eq(aiAgentAtribuicoes.id, a.id)).returning();
  await sincronizarEstadoDaConversa({ organizacaoId: e.organizacaoId, contatoId: a.contatoId, ativo: false, motivo: e.motivo, usuarioId: humano });
  await notaNaTimeline({
    organizacaoId: e.organizacaoId, leadId: a.leadId, usuarioId: e.ator?.usuarioId ?? null, titulo: "Atendimento passou para uma pessoa",
    descricao: [`Motivo: ${e.motivo}`, e.resumo ? `Resumo para quem assume:\n${e.resumo}` : null].filter(Boolean).join("\n"), dados: { atribuicaoId: a.id, humanoUsuarioId: humano },
  });
  return n;
}

export async function encerrarAtribuicao(p: { organizacaoId: string; atribuicaoId: string; motivo?: string; ator?: AtorAtribuicao; silencioso?: boolean }): Promise<Atribuicao> {
  const a = await carregar(p.organizacaoId, p.atribuicaoId);
  const [n] = await db.update(aiAgentAtribuicoes).set({ status: "encerrada", motivoEstado: p.motivo ?? "concluída", encerradaEm: new Date(), updatedAt: new Date() }).where(eq(aiAgentAtribuicoes.id, a.id)).returning();
  // Retomadas pendentes deixam de valer: cancelamento explícito, com motivo.
  await db.update(aiAgentCompromissos).set({ status: "cancelado", bloqueioMotivo: "atribuição encerrada", updatedAt: new Date() })
    .where(and(eq(aiAgentCompromissos.atribuicaoId, a.id), inArray(aiAgentCompromissos.status, ["pendente", "bloqueado"])));
  if (!p.silencioso) await notaNaTimeline({ organizacaoId: p.organizacaoId, leadId: a.leadId, usuarioId: p.ator?.usuarioId ?? null, titulo: "Atuação do agente encerrada", descricao: p.motivo ?? null, dados: { atribuicaoId: a.id } });
  return n;
}

/** Registro que o runtime atualiza ao fim de cada execução. */
export async function registrarExecucaoNaAtribuicao(atribuicaoId: string, p: { runId?: string | null; status: StatusAtribuicao; estado?: Record<string, unknown>; motivo?: string | null }) {
  await db.update(aiAgentAtribuicoes).set({
    ...(p.runId ? { ultimoRunId: p.runId } : {}), ultimaExecucaoEm: new Date(), status: p.status, motivoEstado: p.motivo ?? null, updatedAt: new Date(),
    ...(p.estado ? { estado: sql`${aiAgentAtribuicoes.estado} || ${JSON.stringify(p.estado)}::jsonb` } : {}),
  }).where(and(eq(aiAgentAtribuicoes.id, atribuicaoId), sql`${aiAgentAtribuicoes.status} <> 'encerrada'`));
}

/** Concessão exclusiva de execução (lease): impede dois runs simultâneos do mesmo atendimento. */
export async function tomarLease(atribuicaoId: string, segundos = 240): Promise<boolean> {
  const ate = new Date(Date.now() + segundos * 1000).toISOString();
  const r = await db.execute<{ id: string }>(sql`
    UPDATE ai_agent_atribuicoes SET estado = estado || jsonb_build_object('lease_ate', ${ate}::text)
     WHERE id = ${atribuicaoId}::uuid
       AND (estado->>'lease_ate' IS NULL OR (estado->>'lease_ate')::timestamptz < now())
    RETURNING id::text`);
  return r.length > 0;
}

export async function soltarLease(atribuicaoId: string) {
  await db.execute(sql`UPDATE ai_agent_atribuicoes SET estado = estado - 'lease_ate' WHERE id = ${atribuicaoId}::uuid`);
}

export async function listarAtribuicoes(organizacaoId: string, filtro: { agentId?: string; status?: StatusAtribuicao[]; limite?: number } = {}) {
  const conds = [eq(aiAgentAtribuicoes.organizacaoId, organizacaoId)];
  if (filtro.agentId) conds.push(eq(aiAgentAtribuicoes.agentId, filtro.agentId));
  if (filtro.status?.length) conds.push(inArray(aiAgentAtribuicoes.status, filtro.status));
  return db.select({ a: aiAgentAtribuicoes, agente: aiAgents.nome, lead: leads.nome, contato: contatos.nome })
    .from(aiAgentAtribuicoes).innerJoin(aiAgents, eq(aiAgents.id, aiAgentAtribuicoes.agentId))
    .leftJoin(leads, eq(leads.id, aiAgentAtribuicoes.leadId)).leftJoin(contatos, eq(contatos.id, aiAgentAtribuicoes.contatoId))
    .where(and(...conds)).orderBy(sql`${aiAgentAtribuicoes.updatedAt} DESC`).limit(filtro.limite ?? 100);
}


/** O agente pediu uma pessoa: o estado da atribuição acompanha a flag da conversa que a ferramenta já grava. */
export async function solicitarHandoffNaAtribuicao(p: { organizacaoId: string; contatoId?: string | null; leadId?: string | null; motivo: string; resumo?: string | null; copiloto?: boolean }): Promise<void> {
  const a = await atribuicaoViva(p.organizacaoId, { contatoId: p.contatoId, leadId: p.leadId });
  if (!a || a.status === "humano") return;
  await db.update(aiAgentAtribuicoes).set({ status: "humano", motivoEstado: p.motivo, resumoHandoff: p.resumo ?? a.resumoHandoff, copiloto: p.copiloto ?? a.copiloto, updatedAt: new Date() }).where(eq(aiAgentAtribuicoes.id, a.id));
}
