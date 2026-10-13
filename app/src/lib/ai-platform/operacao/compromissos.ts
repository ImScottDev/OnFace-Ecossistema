/**
 * Compromissos do agente: retomadas que ELE mesmo agenda.
 *
 * "Me chama quinta" vira uma linha em ai_agent_compromissos com o motivo e a
 * orientação do agente, nunca a mensagem pronta. Quando vence, o worker:
 *   confere se o agente ainda é o responsável, se ninguém assumiu, se o canal
 *   permite, se o horário vale, e só então reconstrói o contexto e deixa o agente
 *   decidir. Humano que assumiu = compromisso BLOQUEADO e preservado (com motivo),
 *   não enviado. Persistente, cancelável, reagendável, idempotente, observável.
 * Cadência não participa: este módulo não importa nada de cadence_*.
 */
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiAgentCompromissos, aiAgents, aiAgentVersions, aiSdrContatoState } from "@/lib/db/schema";
import { ativaDesde, atribuicaoViva, humanoAtendendoRecentemente, humanoRespondeuDesde } from "./atribuicoes";
import { avaliarEnvio } from "./politica-canal";
import { acionarAgente } from "./acionar";
import { dentroDoHorario, lerLimites } from "@/lib/agentes/guardrails";

export type Compromisso = typeof aiAgentCompromissos.$inferSelect;
export class CompromissoRecusado extends Error {}

const MIN = 60_000;
export const MAX_DIAS_RETOMADA = 90;
const MAX_TENTATIVAS = 3;
const EXPIRA_APOS_MS = 3 * 86_400_000;

export interface EntradaCompromisso {
  organizacaoId: string;
  agentId: string;
  atribuicaoId?: string | null;
  contatoId: string;
  leadId?: string | null;
  dueAt: Date;
  motivo: string;
  instrucao?: string | null;
  tipo?: "retomada" | "lembrete" | "verificacao";
  origemRunId?: string | null;
  origemMensagemId?: string | null;
  agora?: Date;
}

const chaveDe = (e: EntradaCompromisso) =>
  createHash("sha256").update([e.agentId, e.contatoId, e.dueAt.toISOString().slice(0, 16), e.motivo.trim().toLowerCase()].join("|")).digest("hex").slice(0, 40);

/** Cria a retomada. Já existindo uma pendente do mesmo agente neste contato, ela é REAGENDADA (uma retomada viva por conversa). */
export async function criarCompromisso(e: EntradaCompromisso): Promise<Compromisso> {
  const agora = e.agora ?? new Date();
  if (Number.isNaN(e.dueAt.getTime())) throw new CompromissoRecusado("data/hora inválida; use ISO 8601 com fuso, ex.: 2026-10-15T10:00:00-03:00");
  if (e.dueAt.getTime() < agora.getTime() + 5 * MIN) throw new CompromissoRecusado("a retomada precisa ser pelo menos 5 minutos no futuro");
  if (e.dueAt.getTime() > agora.getTime() + MAX_DIAS_RETOMADA * 86_400_000) throw new CompromissoRecusado(`retomada além de ${MAX_DIAS_RETOMADA} dias não é permitida`);
  const motivo = e.motivo.trim();
  if (!motivo) throw new CompromissoRecusado("informe o motivo da retomada");

  const [viva] = await db.select().from(aiAgentCompromissos).where(and(
    eq(aiAgentCompromissos.organizacaoId, e.organizacaoId), eq(aiAgentCompromissos.agentId, e.agentId), eq(aiAgentCompromissos.contatoId, e.contatoId),
    eq(aiAgentCompromissos.tipo, e.tipo ?? "retomada"), eq(aiAgentCompromissos.status, "pendente"))).limit(1);
  const key = chaveDe(e);
  if (viva) {
    if (viva.idempotencyKey === key) return viva; // mesma combinação: nada a fazer
    const [r] = await db.update(aiAgentCompromissos).set({
      dueAt: e.dueAt, motivo, instrucao: e.instrucao ?? viva.instrucao, reagendadoDe: viva.dueAt, idempotencyKey: key,
      origemRunId: e.origemRunId ?? viva.origemRunId, updatedAt: agora,
    }).where(eq(aiAgentCompromissos.id, viva.id)).returning();
    return r;
  }
  const [c] = await db.insert(aiAgentCompromissos).values({
    organizacaoId: e.organizacaoId, agentId: e.agentId, atribuicaoId: e.atribuicaoId ?? null, contatoId: e.contatoId, leadId: e.leadId ?? null,
    tipo: e.tipo ?? "retomada", motivo, instrucao: e.instrucao ?? null, dueAt: e.dueAt, idempotencyKey: key,
    origemRunId: e.origemRunId ?? null, origemMensagemId: e.origemMensagemId ?? null,
  }).onConflictDoNothing().returning();
  if (c) return c;
  const [ja] = await db.select().from(aiAgentCompromissos).where(and(eq(aiAgentCompromissos.organizacaoId, e.organizacaoId), eq(aiAgentCompromissos.idempotencyKey, key))).limit(1);
  return ja;
}

export async function cancelarCompromisso(p: { organizacaoId: string; compromissoId: string; motivo: string; contatoId?: string | null; agentId?: string | null }): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(p.compromissoId)) return false;
  const conds = [eq(aiAgentCompromissos.id, p.compromissoId), eq(aiAgentCompromissos.organizacaoId, p.organizacaoId), inArray(aiAgentCompromissos.status, ["pendente", "bloqueado"])];
  if (p.contatoId) conds.push(eq(aiAgentCompromissos.contatoId, p.contatoId));
  if (p.agentId) conds.push(eq(aiAgentCompromissos.agentId, p.agentId));
  const r = await db.update(aiAgentCompromissos).set({ status: "cancelado", bloqueioMotivo: p.motivo.slice(0, 300), updatedAt: new Date() }).where(and(...conds)).returning({ id: aiAgentCompromissos.id });
  return r.length > 0;
}

export async function reagendarCompromisso(p: { organizacaoId: string; compromissoId: string; dueAt: Date; agora?: Date }): Promise<Compromisso> {
  const agora = p.agora ?? new Date();
  if (p.dueAt.getTime() < agora.getTime() + 5 * MIN) throw new CompromissoRecusado("a retomada precisa ser pelo menos 5 minutos no futuro");
  const [atual] = await db.select().from(aiAgentCompromissos).where(and(eq(aiAgentCompromissos.id, p.compromissoId), eq(aiAgentCompromissos.organizacaoId, p.organizacaoId), inArray(aiAgentCompromissos.status, ["pendente", "bloqueado"]))).limit(1);
  if (!atual) throw new CompromissoRecusado("compromisso não encontrado ou já encerrado");
  const [r] = await db.update(aiAgentCompromissos).set({ dueAt: p.dueAt, status: "pendente", bloqueioMotivo: null, reagendadoDe: atual.dueAt, updatedAt: agora }).where(eq(aiAgentCompromissos.id, atual.id)).returning();
  return r;
}

export async function listarCompromissos(organizacaoId: string, f: { agentId?: string; contatoId?: string; status?: string[]; limite?: number } = {}) {
  const conds = [eq(aiAgentCompromissos.organizacaoId, organizacaoId)];
  if (f.agentId) conds.push(eq(aiAgentCompromissos.agentId, f.agentId));
  if (f.contatoId) conds.push(eq(aiAgentCompromissos.contatoId, f.contatoId));
  if (f.status?.length) conds.push(inArray(aiAgentCompromissos.status, f.status));
  return db.select().from(aiAgentCompromissos).where(and(...conds)).orderBy(sql`${aiAgentCompromissos.dueAt} ASC`).limit(f.limite ?? 100);
}

const setStatus = (id: string, status: Compromisso["status"], extra: Partial<Compromisso> = {}) =>
  db.update(aiAgentCompromissos).set({ status, updatedAt: new Date(), ...extra }).where(eq(aiAgentCompromissos.id, id));

/** Texto de trabalho para o agente (não é mensagem ao contato). */
export function instrucaoDeRetomada(c: Pick<Compromisso, "motivo" | "instrucao" | "createdAt" | "dueAt">, contatoRespondeuDesde: boolean): string {
  const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return [
    `RETOMADA COMBINADA. Você mesma agendou este retorno em ${fmt(c.createdAt)} para ${fmt(c.dueAt)}.`,
    `Motivo: ${c.motivo}.`,
    c.instrucao ? `Sua orientação na época: ${c.instrucao}` : null,
    contatoRespondeuDesde ? "O contato escreveu depois do combinado: leia a conversa e veja se o assunto já avançou." : "O contato não escreveu depois do combinado.",
    "Releia o contexto atualizado. Se ainda fizer sentido, retome de onde pararam com uma mensagem curta e natural (não repita o que já foi dito). Se a situação mudou (já agendou, já decidiu, pediu para parar), ajuste ou não envie nada.",
  ].filter(Boolean).join("\n");
}

type Desfecho = { fim: "concluido" | "bloqueado" | "adiado" | "cancelado" | "falhou" | "expirado"; motivo?: string };

async function cumprir(c: Compromisso, agora: Date): Promise<Desfecho> {
  if (agora.getTime() - c.dueAt.getTime() > EXPIRA_APOS_MS) return { fim: "expirado", motivo: "passou de 3 dias do horário combinado sem poder retomar" };
  const [agente] = await db.select({ status: aiAgents.status, pub: aiAgents.publishedVersionId, nome: aiAgents.nome }).from(aiAgents).where(and(eq(aiAgents.id, c.agentId), eq(aiAgents.organizacaoId, c.organizacaoId))).limit(1);
  if (!agente || agente.status !== "published" || !agente.pub) return { fim: "bloqueado", motivo: "agente_nao_publicado" };
  const [versao] = await db.select().from(aiAgentVersions).where(eq(aiAgentVersions.id, agente.pub)).limit(1);

  const atrib = await atribuicaoViva(c.organizacaoId, { contatoId: c.contatoId, leadId: c.leadId });
  if (atrib) {
    if (atrib.agentId !== c.agentId) return { fim: "bloqueado", motivo: "outro_agente_assumiu" };
    if (atrib.status === "humano") return { fim: "bloqueado", motivo: "humano_assumiu" };
    if (atrib.status === "pausada") return { fim: "bloqueado", motivo: "agente_pausado" };
  } else if (c.atribuicaoId) {
    return { fim: "cancelado", motivo: "atribuição encerrada" };
  }
  if (!c.contatoId) return { fim: "bloqueado", motivo: "sem_contato" };
  const [estado] = await db.select({ ativo: aiSdrContatoState.aiAtivo }).from(aiSdrContatoState).where(eq(aiSdrContatoState.contatoId, c.contatoId)).limit(1);
  if (estado && !estado.ativo) return { fim: "bloqueado", motivo: "ia_pausada_na_conversa" };
  // Com atribuição: humano que respondeu depois que o agente assumiu. Sem atribuição: humano atendendo nas últimas horas.
  if (atrib ? await humanoRespondeuDesde(c.contatoId, ativaDesde(atrib)) : await humanoAtendendoRecentemente(c.contatoId)) return { fim: "bloqueado", motivo: "humano_atendendo" };

  const canal = await avaliarEnvio({ organizacaoId: c.organizacaoId, contatoId: c.contatoId, proativo: true, agora });
  if (!canal.permitido) return canal.tentarDepois && c.tentativas <= 4 ? { fim: "adiado", motivo: canal.codigo } : { fim: "bloqueado", motivo: canal.codigo };

  const limites = lerLimites(versao?.guardrailConfig);
  if (!dentroDoHorario(limites.horario, agora)) return { fim: "adiado", motivo: "fora_do_horario" };

  const [resp] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM whatsapp_mensagens WHERE contato_id = ${c.contatoId}::uuid AND direcao = 'in' AND created_at > ${c.createdAt.toISOString()}::timestamptz`);
  const r = await acionarAgente({
    organizacaoId: c.organizacaoId, agentId: c.agentId, contatoId: c.contatoId, leadId: c.leadId, evento: "agent.retomada",
    mensagem: instrucaoDeRetomada(c, (resp?.n ?? 0) > 0), motivoDaExecucao: `Retomada: ${c.motivo}`, proativo: true,
    atribuicaoId: atrib?.id ?? c.atribuicaoId ?? null, compromissoId: c.id, agora,
  });
  if (r.resultado === "respondeu" || r.resultado === "handover") { await setStatus(c.id, "concluido", { runId: r.runId ?? null, concluidoEm: new Date(), bloqueioMotivo: null }); return { fim: "concluido" }; }
  if (r.resultado === "ocupado") return { fim: "adiado", motivo: "execucao_em_andamento" };
  if (r.resultado === "falhou") return { fim: "falhou", motivo: r.motivo };
  return { fim: "bloqueado", motivo: r.motivo ?? r.resultado };
}

export async function processarCompromissosVencidos(p: { agora?: Date; limite?: number; /** Só estes agentes (execução dirigida e testes isolados). */ agentIds?: string[] } = {}): Promise<{ concluidos: number; bloqueados: number; adiados: number; falhas: number; expirados: number; cancelados: number }> {
  const agora = p.agora ?? new Date();
  const out = { concluidos: 0, bloqueados: 0, adiados: 0, falhas: 0, expirados: 0, cancelados: 0 };
  // Worker que caiu no meio: o que ficou "processando" há mais de 10 min volta à fila.
  await db.execute(sql`UPDATE ai_agent_compromissos SET status = 'pendente', updated_at = now() WHERE status = 'processando' AND updated_at < now() - interval '10 minutes'`);
  const reivindicados = await db.execute<Record<string, unknown>>(sql`
    UPDATE ai_agent_compromissos SET status = 'processando', tentativas = tentativas + 1, updated_at = now()
     WHERE id IN (SELECT id FROM ai_agent_compromissos WHERE status = 'pendente' AND due_at <= ${agora.toISOString()}::timestamptz AND ${p.agentIds?.length ? sql`agent_id IN (${sql.join(p.agentIds.map((i) => sql`${i}::uuid`), sql`, `)})` : sql`true`} ORDER BY due_at LIMIT ${p.limite ?? 10} FOR UPDATE SKIP LOCKED)
    RETURNING id::text`);
  for (const { id } of reivindicados as unknown as { id: string }[]) {
    const [c] = await db.select().from(aiAgentCompromissos).where(eq(aiAgentCompromissos.id, id)).limit(1);
    if (!c) continue;
    let d: Desfecho;
    try { d = await cumprir(c, agora); } catch (e) { d = { fim: "falhou", motivo: e instanceof Error ? e.message : String(e) }; }
    switch (d.fim) {
      case "concluido": out.concluidos++; break;
      case "bloqueado": await setStatus(c.id, "bloqueado", { bloqueioMotivo: d.motivo ?? null }); out.bloqueados++; break;
      case "cancelado": await setStatus(c.id, "cancelado", { bloqueioMotivo: d.motivo ?? null }); out.cancelados++; break;
      case "expirado": await setStatus(c.id, "expirado", { bloqueioMotivo: d.motivo ?? null }); out.expirados++; break;
      case "adiado": {
        // Fora do horário/canal fora do ar não consome tentativa: a próxima janela é nova.
        const espera = d.motivo === "fora_do_horario" ? 30 * MIN : 15 * MIN;
        await setStatus(c.id, "pendente", { dueAt: new Date(Math.max(agora.getTime(), c.dueAt.getTime()) + espera), tentativas: Math.max(0, c.tentativas - 1), bloqueioMotivo: d.motivo ?? null, reagendadoDe: c.dueAt });
        out.adiados++; break;
      }
      case "falhou":
        if (c.tentativas >= MAX_TENTATIVAS) { await setStatus(c.id, "falhou", { bloqueioMotivo: d.motivo?.slice(0, 300) ?? null }); out.falhas++; }
        else { await setStatus(c.id, "pendente", { dueAt: new Date(agora.getTime() + 10 * MIN), bloqueioMotivo: d.motivo?.slice(0, 300) ?? null }); out.adiados++; }
        break;
    }
  }
  return out;
}

/**
 * Regra de retomada do handoff (handoff_config.retomada = "automatica"): atendimento que ficou com uma pessoa e
 * ficou parado devolve ao agente. Parado = o contato escreveu e nenhuma pessoa respondeu em `retomadaHoras`
 * (padrão 24). Com "somente_humano" (padrão) só uma pessoa devolve.
 */
export async function retomarAtribuicoesParadas(): Promise<number> {
  const paradas = await db.execute<{ id: string; organizacao_id: string }>(sql`
    SELECT a.id::text, a.organizacao_id::text
      FROM ai_agent_atribuicoes a
      JOIN ai_agents ag ON ag.id = a.agent_id AND ag.status = 'published'
      JOIN ai_agent_versions v ON v.id = ag.published_version_id
     WHERE a.status = 'humano' AND a.contato_id IS NOT NULL AND v.handoff_config->>'retomada' = 'automatica'
       AND EXISTS (SELECT 1 FROM whatsapp_mensagens i WHERE i.contato_id = a.contato_id AND i.direcao = 'in'
                     AND i.created_at < now() - (coalesce((v.handoff_config->>'retomadaHoras')::int, 24)) * interval '1 hour'
                     AND i.created_at > coalesce((SELECT max(o.created_at) FROM whatsapp_mensagens o WHERE o.contato_id = a.contato_id AND o.direcao = 'out'), 'epoch'))
     LIMIT 20`);
  const { retomarAtribuicao } = await import("./atribuicoes");
  let n = 0;
  for (const p of paradas) { try { await retomarAtribuicao({ organizacaoId: p.organizacao_id, atribuicaoId: p.id }); n++; } catch (e) { console.error("[retomadas] devolver ao agente:", e); } }
  return n;
}
