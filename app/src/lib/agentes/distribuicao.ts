/**
 * Regra de distribuição de leads novos: "novos leads em etapa X -> responsável Y".
 *
 * Y é um usuário (humano OU agente, que também é usuário) ou um rodízio entre
 * vários. A regra pode valer só em certos dias/horários (ex.: a Lia à noite e no
 * fim de semana, o time humano no horário comercial) e é editável a qualquer
 * momento; cada mudança grava quem mudou, de quê para quê, em `audit_log`.
 *
 * Aplicada em `criarLead` (porta única de Pré-vendas). Sem regra vigente vale o
 * comportamento anterior (`settings.preVendas.responsavelInboundId`).
 */
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, regrasDistribuicaoLeads, usuarios } from "@/lib/db/schema";

export const FUSO_DA_OPERACAO = "America/Sao_Paulo";
export type Regra = typeof regrasDistribuicaoLeads.$inferSelect;

export interface EntradaRegra {
  id?: string;
  nome: string;
  etapa?: string;
  alvoTipo: "usuario" | "rodizio";
  alvoUsuarioId?: string | null;
  rodizioUsuarioIds?: string[];
  diasSemana?: number[] | null;
  horaInicio?: string | null;
  horaFim?: string | null;
  humanoDevolucaoId?: string | null;
  prioridade?: number;
  ativo?: boolean;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/** Dia da semana (0 = domingo) e minutos desde 00:00 no fuso da operação. */
export function relogioDaOperacao(agora: Date): { dia: number; minutos: number } {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: FUSO_DA_OPERACAO, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(agora);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { dia, minutos: Number(get("hour")) * 60 + Number(get("minute")) };
}

const emMinutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** A regra vale neste instante? (ativa + dia da semana + janela de horário; janela que cruza a meia-noite é aceita). */
export function regraVigente(r: Pick<Regra, "ativo" | "diasSemana" | "horaInicio" | "horaFim">, agora: Date): boolean {
  if (!r.ativo) return false;
  const { dia, minutos } = relogioDaOperacao(agora);
  if (r.horaInicio && r.horaFim) {
    const ini = emMinutos(r.horaInicio), fim = emMinutos(r.horaFim);
    const dentro = ini <= fim ? minutos >= ini && minutos < fim : minutos >= ini || minutos < fim;
    if (!dentro) return false;
    // Janela que cruza a meia-noite: a parte da madrugada pertence ao dia anterior.
    const diaDaJanela = ini > fim && minutos < fim ? (dia + 6) % 7 : dia;
    if (r.diasSemana?.length && !r.diasSemana.includes(diaDaJanela)) return false;
    return true;
  }
  if (r.diasSemana?.length && !r.diasSemana.includes(dia)) return false;
  return true;
}

/** Próximo do rodízio depois de `ultimo` (volta ao início). */
export function proximoDoRodizio(ids: string[], ultimo: string | null | undefined): string | null {
  if (!ids.length) return null;
  const i = ultimo ? ids.indexOf(ultimo) : -1;
  return ids[(i + 1) % ids.length] ?? null;
}

export interface ResultadoDistribuicao { responsavelId: string; regraId: string; regraNome: string }

/**
 * Responsável de um lead que acabou de nascer, segundo as regras. Null quando
 * nenhuma regra vigente resolve um usuário ativo (o chamador cai no padrão).
 */
export async function resolverPorRegra(params: { organizacaoId: string; etapa?: string; agora?: Date }): Promise<ResultadoDistribuicao | null> {
  const agora = params.agora ?? new Date();
  const regras = await db.select().from(regrasDistribuicaoLeads)
    .where(and(eq(regrasDistribuicaoLeads.organizacaoId, params.organizacaoId), eq(regrasDistribuicaoLeads.ativo, true), eq(regrasDistribuicaoLeads.etapa, params.etapa ?? "novo")))
    .orderBy(asc(regrasDistribuicaoLeads.prioridade), asc(regrasDistribuicaoLeads.createdAt));

  for (const r of regras) {
    if (!regraVigente(r, agora)) continue;
    const candidatos = r.alvoTipo === "rodizio" ? r.rodizioUsuarioIds : r.alvoUsuarioId ? [r.alvoUsuarioId] : [];
    if (!candidatos.length) continue;
    const ativos = await db.select({ id: usuarios.id }).from(usuarios)
      .where(and(eq(usuarios.organizacaoId, params.organizacaoId), eq(usuarios.ativo, true), inArray(usuarios.id, candidatos)));
    const ativoSet = new Set(ativos.map((u) => u.id));
    const vivos = candidatos.filter((id) => ativoSet.has(id));
    if (!vivos.length) continue;
    const escolhido = r.alvoTipo === "rodizio" ? proximoDoRodizio(vivos, r.rodizioUltimoId) : vivos[0];
    if (!escolhido) continue;
    // ponytail: cursor sem lock, duas criações simultâneas podem cair no mesmo; trocar por UPDATE ... RETURNING atômico se virar problema.
    if (r.alvoTipo === "rodizio") await db.update(regrasDistribuicaoLeads).set({ rodizioUltimoId: escolhido }).where(eq(regrasDistribuicaoLeads.id, r.id));
    return { responsavelId: escolhido, regraId: r.id, regraNome: r.nome };
  }
  return null;
}

/* ── CRUD com histórico ────────────────────────────────────────────────── */

export class ErroDeRegra extends Error {}

function validar(e: EntradaRegra) {
  if (!e.nome?.trim()) throw new ErroDeRegra("Dê um nome à regra.");
  if (e.alvoTipo === "usuario" && !e.alvoUsuarioId) throw new ErroDeRegra("Escolha o responsável.");
  if (e.alvoTipo === "rodizio" && (e.rodizioUsuarioIds?.length ?? 0) < 2) throw new ErroDeRegra("O rodízio precisa de pelo menos duas pessoas ou agentes.");
  if (Boolean(e.horaInicio) !== Boolean(e.horaFim)) throw new ErroDeRegra("Informe o horário de início e o de fim, ou nenhum dos dois.");
  for (const h of [e.horaInicio, e.horaFim]) if (h && !HHMM.test(h)) throw new ErroDeRegra("Horário inválido (use HH:MM).");
  if (e.diasSemana?.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new ErroDeRegra("Dia da semana inválido.");
}

async function exigirUsuariosDaOrg(organizacaoId: string, ids: (string | null | undefined)[]) {
  const alvo = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!alvo.length) return;
  const ok = await db.select({ id: usuarios.id }).from(usuarios)
    .where(and(eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.ativo, true), inArray(usuarios.id, alvo)));
  if (ok.length !== alvo.length) throw new ErroDeRegra("Responsável inválido: não é um usuário ativo desta organização.");
}

export async function listarRegras(organizacaoId: string): Promise<Regra[]> {
  return db.select().from(regrasDistribuicaoLeads).where(eq(regrasDistribuicaoLeads.organizacaoId, organizacaoId))
    .orderBy(asc(regrasDistribuicaoLeads.prioridade), asc(regrasDistribuicaoLeads.createdAt));
}

export async function salvarRegra(organizacaoId: string, atorId: string, e: EntradaRegra): Promise<Regra> {
  validar(e);
  await exigirUsuariosDaOrg(organizacaoId, [e.alvoUsuarioId, e.humanoDevolucaoId, ...(e.rodizioUsuarioIds ?? [])]);
  const valores = {
    nome: e.nome.trim(), etapa: e.etapa ?? "novo", alvoTipo: e.alvoTipo,
    alvoUsuarioId: e.alvoTipo === "usuario" ? e.alvoUsuarioId! : null,
    rodizioUsuarioIds: e.alvoTipo === "rodizio" ? e.rodizioUsuarioIds! : [],
    diasSemana: e.diasSemana?.length ? e.diasSemana : null,
    horaInicio: e.horaInicio || null, horaFim: e.horaFim || null,
    humanoDevolucaoId: e.humanoDevolucaoId || null,
    prioridade: e.prioridade ?? 100, ativo: e.ativo ?? true, updatedAt: new Date(),
  };
  if (!e.id) {
    const [nova] = await db.insert(regrasDistribuicaoLeads).values({ organizacaoId, createdBy: atorId, ...valores }).returning();
    await db.insert(auditLog).values({ organizacaoId, actorId: atorId, action: "regra_distribuicao.criada", entityType: "regra_distribuicao", entityId: nova.id, before: null, after: valores as never });
    return nova;
  }
  const [antes] = await db.select().from(regrasDistribuicaoLeads).where(and(eq(regrasDistribuicaoLeads.id, e.id), eq(regrasDistribuicaoLeads.organizacaoId, organizacaoId))).limit(1);
  if (!antes) throw new ErroDeRegra("Regra não encontrada.");
  const [nova] = await db.update(regrasDistribuicaoLeads).set(valores).where(eq(regrasDistribuicaoLeads.id, e.id)).returning();
  await db.insert(auditLog).values({ organizacaoId, actorId: atorId, action: "regra_distribuicao.alterada", entityType: "regra_distribuicao", entityId: e.id, before: antes as never, after: nova as never });
  return nova;
}

export async function removerRegra(organizacaoId: string, atorId: string, id: string): Promise<void> {
  const [antes] = await db.select().from(regrasDistribuicaoLeads).where(and(eq(regrasDistribuicaoLeads.id, id), eq(regrasDistribuicaoLeads.organizacaoId, organizacaoId))).limit(1);
  if (!antes) throw new ErroDeRegra("Regra não encontrada.");
  await db.delete(regrasDistribuicaoLeads).where(eq(regrasDistribuicaoLeads.id, id));
  await db.insert(auditLog).values({ organizacaoId, actorId: atorId, action: "regra_distribuicao.removida", entityType: "regra_distribuicao", entityId: id, before: antes as never, after: null });
}

export interface LinhaHistorico { id: string; quando: string; quem: string | null; acao: string; regra: string; resumo: string }

/** Quem mudou o quê, mais recente primeiro. */
export async function historicoDasRegras(organizacaoId: string, limite = 30): Promise<LinhaHistorico[]> {
  const linhas = await db.execute<{ id: string; quando: Date; quem: string | null; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null }>(sql`
    SELECT a.id::text, a.created_at AS quando, u.nome AS quem, a.action, a.before, a.after
      FROM audit_log a LEFT JOIN usuarios u ON u.id = a.actor_id
     WHERE a.organizacao_id = ${organizacaoId}::uuid AND a.entity_type = 'regra_distribuicao'
     ORDER BY a.created_at DESC LIMIT ${limite}`);
  const nomes = new Map((await db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(eq(usuarios.organizacaoId, organizacaoId))).map((u) => [u.id, u.nome]));
  const alvo = (r: Record<string, unknown> | null) => {
    if (!r) return "—";
    if (r.alvoTipo === "rodizio") return `rodízio (${((r.rodizioUsuarioIds as string[]) ?? []).map((i) => nomes.get(i) ?? "?").join(", ")})`;
    return nomes.get(String(r.alvoUsuarioId)) ?? "—";
  };
  return linhas.map((l) => ({
    id: l.id, quando: new Date(l.quando).toISOString(), quem: l.quem,
    acao: l.action.replace("regra_distribuicao.", ""),
    regra: String((l.after ?? l.before)?.nome ?? (l.action.endsWith("padroes_alterados") ? "Padrões" : "")),
    resumo: l.action.endsWith("padroes_alterados") ? "Padrões de handover e de follow-up alterados"
      : l.action.endsWith("criada") ? `Novos leads em "${l.after?.etapa}" para ${alvo(l.after)}`
      : l.action.endsWith("removida") ? "Regra removida"
      : `${alvo(l.before)} -> ${alvo(l.after)}${l.before?.ativo !== l.after?.ativo ? (l.after?.ativo ? " (ativada)" : " (desativada)") : ""}`,
  }));
}
