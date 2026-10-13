/**
 * Agenda real para o agente: oferecer horários verificados e marcar sem fantasia.
 *
 * Regras que o código garante (o prompt só as repete):
 *  - horário oferecido = grade interna da closer MENOS reuniões/bloqueios do CRM
 *    MENOS os ocupados reais do Outlook. Se a checagem do Outlook falha, NÃO se
 *    oferece nada (`verificado: false`), porque "não consegui ver" não é "livre";
 *  - ao confirmar, a disponibilidade é revalidada com a mesma função;
 *  - o evento externo é criado pelo CalendarProvider; se ele falha, a reunião
 *    interna é cancelada e o resultado diz que NÃO foi confirmada;
 *  - idempotente por (lead, closer, horário): repetir não duplica reunião nem convite.
 */
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reunioes, notificacoes, usuarios, atividades } from "@/lib/db/schema";
import { getFullAvailability, formatSlotLabel } from "@/lib/crm/agenda-closers";
import { converterLeadEmOportunidade } from "@/lib/crm/converter-oportunidade";
import { agendaDoUsuario, criarNaAgenda, atualizarNaAgenda, cancelarNaAgenda } from "./sincronizar";
import { FRASE_DA_FALHA, type MotivoFalha } from "./provider";

export interface SlotLivre { inicioISO: string; fimISO: string; label: string }
export interface Disponibilidade {
  verificado: boolean;
  fonte: "outlook+interno" | "interno";
  /** Por que não foi possível verificar (quando `verificado` é false). */
  motivoNaoVerificado?: string;
  slots: SlotLivre[];
}

export interface OpcoesHorarios {
  organizacaoId: string;
  closerId: string;
  duracaoMin?: number;
  dias?: number;
  maxSlots?: number;
  /** Padrão true: sem Outlook verificado, não oferece horário. */
  exigirOutlook?: boolean;
}

/** Antecedência mínima de um horário oferecido: marcar para daqui a poucos minutos não dá tempo nem de avisar a closer. */
export const ANTECEDENCIA_MINIMA_MIN = 30;

export async function horariosLivres(o: OpcoesHorarios): Promise<Disponibilidade> {
  const dias = o.dias ?? 7;
  const duracao = o.duracaoMin ?? 30;
  const exigir = o.exigirOutlook ?? true;
  const agora = new Date();
  const fimJanela = new Date(agora.getTime() + dias * 86_400_000);

  let busyExtra: { inicio: Date; fim: Date }[] = [];
  let verificado = false;
  let motivo: string | undefined;
  const ag = await agendaDoUsuario(o.closerId);
  if ("erro" in ag) motivo = ag.erro === "sem_conta" ? "a closer não conectou o Outlook" : "o calendário não está configurado neste ambiente";
  else {
    const r = await ag.provider.ocupados(ag.contaId, agora.toISOString(), fimJanela.toISOString());
    if (r.ok) { busyExtra = r.faixas; verificado = true; }
    else motivo = FRASE_DA_FALHA[r.motivo] ?? r.detalhe;
  }

  if (!verificado && exigir) return { verificado: false, fonte: "interno", motivoNaoVerificado: motivo, slots: [] };

  const grade = await getFullAvailability(db, o.closerId, { durationMin: duracao, lookaheadDays: dias, busyExtra, maxSlotsPerDay: 12 });
  const max = o.maxSlots ?? 6;
  const escolhidos: SlotLivre[] = [];
  // No máximo 2 por dia, para a oferta cobrir dias diferentes em vez de empilhar manhãs.
  const limite = Date.now() + ANTECEDENCIA_MINIMA_MIN * 60_000;
  for (const d of grade) {
    for (const s of d.slots.filter((x) => x.inicio.getTime() >= limite).slice(0, 2)) {
      if (escolhidos.length >= max) break;
      escolhidos.push({ inicioISO: s.inicio.toISOString(), fimISO: s.fim.toISOString(), label: formatSlotLabel(s) });
    }
  }
  return { verificado, fonte: verificado ? "outlook+interno" : "interno", motivoNaoVerificado: motivo, slots: escolhidos };
}

/** Token expirado: avisa a closer (no máximo 1 vez por dia) para reconectar o Outlook; sem isso o agente fica sem agenda e ninguém sabe. */
async function avisarReconexao(closerId: string, motivo: MotivoFalha) {
  if (motivo !== "token_expirado") return;
  const [ja] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM notificacoes WHERE usuario_id = ${closerId}::uuid AND tipo = 'calendario_reconectar' AND created_at > now() - interval '1 day'`);
  if ((ja?.n ?? 0) > 0) return;
  await db.insert(notificacoes).values({ usuarioId: closerId, tipo: "calendario_reconectar", titulo: "Reconecte seu calendário", mensagem: "A conexão com o Outlook expirou. Enquanto isso, os agentes não conseguem oferecer horários da sua agenda.", link: "/ajustes/integracoes" }).catch(() => undefined);
}

/** O instante exato ainda está na grade livre (interna + Outlook)? */
export async function horarioEstaLivre(o: OpcoesHorarios & { inicioISO: string }): Promise<{ livre: boolean; verificado: boolean; motivo?: string }> {
  const exigir = o.exigirOutlook ?? true;
  const alvo = new Date(o.inicioISO).getTime();
  const dias = Math.min(30, Math.max(1, Math.ceil((alvo - Date.now()) / 86_400_000) + 1));
  const agora = new Date();
  const ag = await agendaDoUsuario(o.closerId);
  let busyExtra: { inicio: Date; fim: Date }[] = [];
  let verificado = false;
  let motivo: string | undefined;
  if ("erro" in ag) motivo = ag.erro === "sem_conta" ? "a closer não conectou o Outlook" : "o calendário não está configurado neste ambiente";
  else {
    const r = await ag.provider.ocupados(ag.contaId, agora.toISOString(), new Date(agora.getTime() + dias * 86_400_000).toISOString());
    if (r.ok) { busyExtra = r.faixas; verificado = true; } else motivo = FRASE_DA_FALHA[r.motivo] ?? r.detalhe;
  }
  if (!verificado && exigir) return { livre: false, verificado: false, motivo };
  const grade = await getFullAvailability(db, o.closerId, { durationMin: o.duracaoMin ?? 30, lookaheadDays: dias, busyExtra, maxSlotsPerDay: 40 });
  const livre = grade.some((d) => d.slots.some((s) => s.inicio.getTime() === alvo));
  return { livre, verificado, motivo };
}

export type ResultadoAgendamento =
  | { ok: true; reuniaoId: string; negocioId: string | null; closerId: string; closerNome: string; inicioISO: string; sincronizado: boolean; link: string | null; jaExistia: boolean; aviso: string | null }
  | { ok: false; codigo: "horario_indisponivel" | "agenda_nao_verificada" | "outlook_falhou" | "lead_invalido" | "closer_invalido" | "data_invalida"; erro: string };

export interface EntradaAgendar {
  organizacaoId: string;
  leadId: string;
  closerId: string;
  inicioISO: string;
  duracaoMin?: number;
  titulo?: string;
  /** Resumo para a closer: vira nota da reunião e da timeline. */
  resumoParaCloser?: string;
  exigirOutlook?: boolean;
  /** Quem assina na timeline (usuário que representa o agente). */
  usuarioId?: string | null;
}

export async function agendarReuniao(e: EntradaAgendar): Promise<ResultadoAgendamento> {
  const inicio = new Date(e.inicioISO);
  if (Number.isNaN(inicio.getTime()) || inicio.getTime() < Date.now() + 5 * 60_000) return { ok: false, codigo: "data_invalida", erro: "data inválida ou já passada" };
  const duracao = e.duracaoMin ?? 30;
  const exigir = e.exigirOutlook ?? true;

  const [closer] = await db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios)
    .where(and(eq(usuarios.id, e.closerId), eq(usuarios.organizacaoId, e.organizacaoId), eq(usuarios.ativo, true), ne(usuarios.tipo, "agente"))).limit(1);
  if (!closer) return { ok: false, codigo: "closer_invalido", erro: "closer não encontrada ou inativa nesta organização" };

  // Idempotência: mesma reunião (lead, closer, instante) viva não é recriada.
  const [existente] = await db.select({ id: reunioes.id, link: reunioes.link, sync: reunioes.calendarSyncStatus, negocioId: reunioes.negocioId }).from(reunioes)
    .where(and(eq(reunioes.organizacaoId, e.organizacaoId), eq(reunioes.leadId, e.leadId), eq(reunioes.responsavelId, e.closerId), eq(reunioes.data, inicio), ne(reunioes.status, "cancelada"))).limit(1);
  if (existente) return { ok: true, reuniaoId: existente.id, negocioId: existente.negocioId, closerId: closer.id, closerNome: closer.nome, inicioISO: inicio.toISOString(), sincronizado: existente.sync === "ok", link: existente.link, jaExistia: true, aviso: null };

  const livre = await horarioEstaLivre({ organizacaoId: e.organizacaoId, closerId: e.closerId, inicioISO: e.inicioISO, duracaoMin: duracao, exigirOutlook: exigir });
  if (!livre.verificado && exigir) return { ok: false, codigo: "agenda_nao_verificada", erro: `não consegui verificar a agenda real: ${livre.motivo ?? "Outlook indisponível"}` };
  if (!livre.livre) return { ok: false, codigo: "horario_indisponivel", erro: "esse horário não está mais livre; consulte os horários de novo" };

  const conv = await converterLeadEmOportunidade(db, {
    organizacaoId: e.organizacaoId, leadId: e.leadId, usuarioId: e.usuarioId ?? null, closerId: e.closerId,
    reuniao: { data: inicio, titulo: e.titulo, duracao, notas: e.resumoParaCloser, tipo: "video" },
  });
  if ("error" in conv) return { ok: false, codigo: "lead_invalido", erro: String(conv.error) };
  if (!conv.reuniaoId) return { ok: false, codigo: "lead_invalido", erro: "a oportunidade já existia e nenhuma reunião foi criada" };

  const sync = await criarNaAgenda(e.organizacaoId, conv.reuniaoId);
  if (!sync.sincronizado && exigir) {
    // Convite externo não saiu: não existe reunião confirmada. Cancela a interna para não deixar compromisso fantasma.
    await db.update(reunioes).set({ status: "cancelada", updatedAt: new Date() }).where(eq(reunioes.id, conv.reuniaoId));
    return { ok: false, codigo: "outlook_falhou", erro: sync.aviso ?? "o Outlook não aceitou o evento" };
  }

  const [r] = await db.select({ link: reunioes.link }).from(reunioes).where(eq(reunioes.id, conv.reuniaoId)).limit(1);
  const quando = inicio.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  await db.insert(notificacoes).values({
    usuarioId: e.closerId, titulo: "Reunião marcada pela agente", tipo: "reuniao",
    mensagem: `${quando}. ${e.resumoParaCloser ? e.resumoParaCloser.slice(0, 300) : "Veja o histórico do lead."}`, link: `/pre-vendas/${e.leadId}`,
  }).catch(() => undefined);
  await db.insert(atividades).values({
    organizacaoId: e.organizacaoId, leadId: e.leadId, negocioId: conv.negocioId ?? null, usuarioId: e.usuarioId ?? null, tipo: "nota",
    titulo: `Reunião confirmada com ${closer.nome} (${quando})`,
    descricao: [e.resumoParaCloser ? `Resumo para a closer:\n${e.resumoParaCloser}` : null, sync.sincronizado ? "Convite criado no calendário." : sync.aviso].filter(Boolean).join("\n\n"),
    dados: { reuniaoId: conv.reuniaoId, calendario: sync.provider, eventId: sync.eventId ?? null },
  });
  return { ok: true, reuniaoId: conv.reuniaoId, negocioId: conv.negocioId ?? null, closerId: closer.id, closerNome: closer.nome, inicioISO: inicio.toISOString(), sincronizado: sync.sincronizado, link: sync.link ?? r?.link ?? null, jaExistia: false, aviso: sync.sincronizado ? null : sync.aviso ?? null };
}

export async function reagendarReuniao(p: { organizacaoId: string; reuniaoId: string; novoInicioISO: string; exigirOutlook?: boolean }): Promise<ResultadoAgendamento | { ok: false; codigo: "reuniao_nao_encontrada"; erro: string }> {
  const [r] = await db.select().from(reunioes).where(and(eq(reunioes.id, p.reuniaoId), eq(reunioes.organizacaoId, p.organizacaoId), ne(reunioes.status, "cancelada"))).limit(1);
  if (!r?.responsavelId) return { ok: false, codigo: "reuniao_nao_encontrada", erro: "reunião não encontrada" };
  const novo = new Date(p.novoInicioISO);
  if (Number.isNaN(novo.getTime()) || novo.getTime() < Date.now() + 5 * 60_000) return { ok: false, codigo: "data_invalida", erro: "data inválida ou já passada" };
  const livre = await horarioEstaLivre({ organizacaoId: p.organizacaoId, closerId: r.responsavelId, inicioISO: p.novoInicioISO, duracaoMin: r.duracao ?? 30, exigirOutlook: p.exigirOutlook });
  if (!livre.verificado && (p.exigirOutlook ?? true)) return { ok: false, codigo: "agenda_nao_verificada", erro: `não consegui verificar a agenda real: ${livre.motivo ?? "Outlook indisponível"}` };
  if (!livre.livre) return { ok: false, codigo: "horario_indisponivel", erro: "esse horário não está livre" };
  const anterior = r.data;
  await db.update(reunioes).set({ data: novo, status: "agendada", updatedAt: new Date() }).where(eq(reunioes.id, r.id));
  const sync = await atualizarNaAgenda(p.organizacaoId, r.id);
  if (!sync.sincronizado && (p.exigirOutlook ?? true)) {
    await db.update(reunioes).set({ data: anterior, updatedAt: new Date() }).where(eq(reunioes.id, r.id));
    return { ok: false, codigo: "outlook_falhou", erro: sync.aviso ?? "o Outlook não aceitou a mudança" };
  }
  const [cl] = await db.select({ nome: usuarios.nome }).from(usuarios).where(eq(usuarios.id, r.responsavelId)).limit(1);
  return { ok: true, reuniaoId: r.id, negocioId: r.negocioId, closerId: r.responsavelId, closerNome: cl?.nome ?? "", inicioISO: novo.toISOString(), sincronizado: sync.sincronizado, link: sync.link ?? r.link, jaExistia: false, aviso: sync.aviso ?? null };
}

export async function cancelarReuniaoDoAgente(p: { organizacaoId: string; reuniaoId: string; motivo?: string }): Promise<{ ok: boolean; sincronizado: boolean; aviso?: string | null; erro?: string }> {
  const [r] = await db.select({ id: reunioes.id }).from(reunioes).where(and(eq(reunioes.id, p.reuniaoId), eq(reunioes.organizacaoId, p.organizacaoId))).limit(1);
  if (!r) return { ok: false, sincronizado: false, erro: "reunião não encontrada" };
  const sync = await cancelarNaAgenda(p.organizacaoId, r.id);
  await db.update(reunioes).set({ status: "cancelada", notas: sql`coalesce(${reunioes.notas}, '') || ${p.motivo ? `\n[cancelada: ${p.motivo}]` : ""}`, updatedAt: new Date() }).where(eq(reunioes.id, r.id));
  return { ok: true, sincronizado: sync.sincronizado, aviso: sync.aviso ?? null };
}
