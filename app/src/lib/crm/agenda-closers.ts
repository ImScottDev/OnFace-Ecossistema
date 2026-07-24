import { and, eq, gte, lte, inArray, desc, sql } from "drizzle-orm";
import { closerDisponibilidade, closerBloqueios, reunioes, usuarios } from "../db/schema";

// Agenda nativa das closers — sem Calendly/Outlook (decisão 10/07, ver
// callface/ai-sdr-agente-spec.md seção 6). Round-robin é STATELESS de propósito:
// em vez de guardar um ponteiro "de quem é a vez" (que quebra se alguém marcar
// manual fora do fluxo), a gente olha a ÚLTIMA reunião criada entre os closers
// ativos e alterna a partir dela. Sempre consistente com o estado real do banco.

export interface DisponibilidadeSemanal {
  inicio: string; // "09:00"
  fim: string; // "18:00"
  diasSemana: number[]; // 0=domingo .. 6=sábado
  timezone?: string;
}

export interface PausaAlmoco {
  inicio: string;
  fim: string;
}

export interface Slot {
  inicio: Date;
  fim: Date;
}

const SLOT_DURATION_MIN = 30;
const LOOKAHEAD_DAYS = 7;
// América/São_Paulo é UTC-3 fixo (sem horário de verão desde 2019). Fixo aqui
// em vez de usar Date.setHours (que usa o timezone do PROCESSO, não o do
// horário de trabalho salvo) — bug real encontrado 13/07: closer configurada
// 9h-18h BRT saía calculada como 9h-18h UTC = 6h-15h BRT, oferecendo reunião
// de manhã cedo real (6h) pro lead.
const BRT_UTC_OFFSET_HOURS = 3;

function getBrtDateParts(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  return {
    year: parseInt(parts.find((p) => p.type === "year")!.value),
    month: parseInt(parts.find((p) => p.type === "month")!.value) - 1,
    day: parseInt(parts.find((p) => p.type === "day")!.value),
  };
}

/** Constrói o instante UTC correspondente a hour:minute NAQUELE dia, em horário de Brasília. */
function brtDateTime(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month, day, hour + BRT_UTC_OFFSET_HOURS, minute, 0, 0));
}

/** Soma dias a uma data (year/month/day), lidando com virada de mês/ano. */
function addDaysToParts(parts: { year: number; month: number; day: number }, days: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(parts.year, parts.month, parts.day + days, 12, 0, 0));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getActiveClosers(db: any, organizacaoId: string) {
  // Pausada no rodízio (férias/folga) sai da ROTAÇÃO, mas continua agendável
  // manualmente — por isso o filtro fica aqui (fila) e não em usuarios.ativo.
  const rows = await db
    .select({ id: usuarios.id, nome: usuarios.nome, pausado: closerDisponibilidade.pausadoRodizio })
    .from(usuarios)
    .leftJoin(closerDisponibilidade, eq(closerDisponibilidade.usuarioId, usuarios.id))
    .where(and(eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.role, "closer"), eq(usuarios.ativo, true)))
    .orderBy(usuarios.nome);
  return rows.filter((r: { pausado: boolean | null }) => !r.pausado).map((r: { id: string; nome: string }) => ({ id: r.id, nome: r.nome }));
}

export interface FilaCloserItem {
  id: string;
  nome: string;
  posicao: number | null; // 1 = próxima da fila; null = pausada
  pausado: boolean;
  proxima: boolean;
}

/**
 * Fila de rodízio VISÍVEL (transparência da distribuição): closers na ordem em
 * que vão receber os próximos leads, começando pela próxima da vez. Pausadas
 * aparecem no fim, sem posição. Mesma lógica stateless do pickNextCloser.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getFilaClosers(db: any, organizacaoId: string): Promise<FilaCloserItem[]> {
  const todas = await db
    .select({ id: usuarios.id, nome: usuarios.nome, pausado: closerDisponibilidade.pausadoRodizio })
    .from(usuarios)
    .leftJoin(closerDisponibilidade, eq(closerDisponibilidade.usuarioId, usuarios.id))
    .where(and(eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.role, "closer"), eq(usuarios.ativo, true)))
    .orderBy(usuarios.nome);

  const ativas = todas.filter((c: { pausado: boolean | null }) => !c.pausado);
  const pausadas = todas.filter((c: { pausado: boolean | null }) => !!c.pausado);
  if (ativas.length === 0) {
    return pausadas.map((c: { id: string; nome: string }) => ({ id: c.id, nome: c.nome, posicao: null, pausado: true, proxima: false }));
  }

  const proxima = await pickNextCloser(db, organizacaoId);
  const idxProxima = Math.max(0, ativas.findIndex((c: { id: string }) => c.id === proxima?.id));
  const ordenadas = [...ativas.slice(idxProxima), ...ativas.slice(0, idxProxima)];

  return [
    ...ordenadas.map((c: { id: string; nome: string }, i: number) => ({ id: c.id, nome: c.nome, posicao: i + 1, pausado: false, proxima: i === 0 })),
    ...pausadas.map((c: { id: string; nome: string }) => ({ id: c.id, nome: c.nome, posicao: null, pausado: true, proxima: false })),
  ];
}

/** Escolhe a próxima closer no round-robin. Null se não houver closer ativa configurada. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pickNextCloser(db: any, organizacaoId: string): Promise<{ id: string; nome: string } | null> {
  const closers = await getActiveClosers(db, organizacaoId);
  if (closers.length === 0) return null;
  if (closers.length === 1) return closers[0];

  const closerIds = closers.map((c: { id: string }) => c.id);
  const [ultima] = await db
    .select({ responsavelId: reunioes.responsavelId, createdAt: reunioes.createdAt })
    .from(reunioes)
    .where(inArray(reunioes.responsavelId, closerIds))
    .orderBy(desc(reunioes.createdAt))
    .limit(1);

  if (!ultima?.responsavelId) return closers[0];
  const idxUltima = closerIds.indexOf(ultima.responsavelId);
  if (idxUltima === -1) return closers[0];
  return closers[(idxUltima + 1) % closers.length];
}

/**
 * Escolhe o próximo closer E RESERVA a vaga atomicamente: pick + o insert que
 * "conta" pro round-robin (normalmente via converterLeadEmOportunidade) rodam
 * dentro da MESMA transação, com lock (pg_advisory_xact_lock por organização,
 * mesmo padrão do stripe-sync). Sem isso, dois chamadores automatizados
 * concorrentes (auto-agendamento da Callface, e no futuro o Agente SDR) liam a
 * mesma "última reunião" antes de qualquer insert comitar, escolhiam o MESMO
 * closer, e a fila pulava inteiro quem devia vir depois — achado real da
 * auditoria de 23/07 (3+ chamadores concorrentes, zero lock).
 *
 * `work` roda com `tx` (não `db`) — passe `tx` pra qualquer insert que precise
 * ficar dentro do lock (ex.: `converterLeadEmOportunidade(tx, {...})`).
 *
 * `pinnedCloserId` (opcional): reaproveita o closer já oferecido pro lead
 * (`leads.agendaCloserId`) em vez de repicar do zero — mantém consistência
 * entre o closer/agenda mostrados durante a ligação/conversa e quem de fato
 * recebe a reunião na confirmação. Se o pinado não existir mais ou tiver
 * saído do rodízio (pausado), cai pro pick normal.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pickNextCloserLocked<T>(
  db: any,
  organizacaoId: string,
  work: (tx: any, closer: { id: string; nome: string } | null) => Promise<T>,
  pinnedCloserId?: string | null,
): Promise<T> {
  return db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"closer-rodizio:" + organizacaoId}))`);
    let closer: { id: string; nome: string } | null = null;
    if (pinnedCloserId) {
      const ativos = await getActiveClosers(tx, organizacaoId);
      closer = ativos.find((c: { id: string }) => c.id === pinnedCloserId) || null;
    }
    if (!closer) closer = await pickNextCloser(tx, organizacaoId);
    return work(tx, closer);
  });
}

/**
 * Conflito REAL de agenda (reuniões do CRM + bloqueios manuais) num intervalo
 * específico. Usado antes de confirmar um horário que veio de fora do CRM
 * (ex.: a IA da Callface "negociou" um horário durante a ligação, sem
 * visibilidade nenhuma da agenda de verdade do closer) — nunca cria reunião em
 * cima de outra só porque alguém de fora confirmou aquele horário.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function closerTemConflito(db: any, usuarioId: string, inicio: Date, fim: Date): Promise<boolean> {
  const janelaIni = new Date(inicio.getTime() - 24 * 60 * 60000);
  const janelaFim = new Date(fim.getTime() + 24 * 60 * 60000);

  const reunioesExistentes = await db
    .select({ data: reunioes.data, duracao: reunioes.duracao })
    .from(reunioes)
    .where(and(eq(reunioes.responsavelId, usuarioId), gte(reunioes.data, janelaIni), lte(reunioes.data, janelaFim)));

  const bloqueiosExistentes = await db
    .select({ inicio: closerBloqueios.inicio, fim: closerBloqueios.fim })
    .from(closerBloqueios)
    .where(and(eq(closerBloqueios.usuarioId, usuarioId), lte(closerBloqueios.inicio, janelaFim), gte(closerBloqueios.fim, janelaIni)));

  const ocupados: Slot[] = [
    ...reunioesExistentes.map((r: { data: Date; duracao: number | null }) => ({
      inicio: new Date(r.data),
      fim: new Date(new Date(r.data).getTime() + (r.duracao || 30) * 60000),
    })),
    ...bloqueiosExistentes.map((b: { inicio: Date; fim: Date }) => ({ inicio: new Date(b.inicio), fim: new Date(b.fim) })),
  ];

  return ocupados.some((o) => inicio < o.fim && fim > o.inicio);
}

function overlapsLunch(start: Date, end: Date, dayParts: { year: number; month: number; day: number }, almoco: PausaAlmoco): boolean {
  const [hIni, mIni] = almoco.inicio.split(":").map(Number);
  const [hFim, mFim] = almoco.fim.split(":").map(Number);
  const lunchStart = brtDateTime(dayParts.year, dayParts.month, dayParts.day, hIni, mIni);
  const lunchEnd = brtDateTime(dayParts.year, dayParts.month, dayParts.day, hFim, mFim);
  return start < lunchEnd && end > lunchStart;
}

/**
 * Calcula slots livres de `durationMin` (default 30) pra uma closer, cruzando
 * horário de trabalho recorrente - reuniões já marcadas - bloqueios manuais.
 * Retorna [] se a closer ainda não configurou disponibilidade (gate: sem config, sem slot).
 */
export async function getAvailableSlots(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  usuarioId: string,
  opts: { durationMin?: number; maxSlots?: number } = {}
): Promise<Slot[]> {
  const durationMin = opts.durationMin || SLOT_DURATION_MIN;
  const maxSlots = opts.maxSlots || 3;

  const [disp] = await db
    .select()
    .from(closerDisponibilidade)
    .where(and(eq(closerDisponibilidade.usuarioId, usuarioId), eq(closerDisponibilidade.ativo, true)))
    .limit(1);
  if (!disp) return [];

  const horario = disp.horarioTrabalho as DisponibilidadeSemanal;
  const almoco = (disp.pausaAlmoco as PausaAlmoco | null) || null;

  const now = new Date();
  const rangeEnd = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  const busyReunioes = await db
    .select({ data: reunioes.data, duracao: reunioes.duracao })
    .from(reunioes)
    .where(
      and(
        eq(reunioes.responsavelId, usuarioId),
        gte(reunioes.data, now),
        lte(reunioes.data, rangeEnd),
        // reuniões canceladas não bloqueiam agenda
        // (status default 'agendada'; não filtramos aqui por simplicidade — cancelamento é raro e liberar
        // manualmente na Fase 2 é aceitável por ora)
      )
    );

  const bloqueios = await db
    .select({ inicio: closerBloqueios.inicio, fim: closerBloqueios.fim })
    .from(closerBloqueios)
    .where(and(eq(closerBloqueios.usuarioId, usuarioId), lte(closerBloqueios.inicio, rangeEnd), gte(closerBloqueios.fim, now)));

  const busyRanges: Slot[] = [
    ...busyReunioes.map((r: { data: Date; duracao: number | null }) => ({
      inicio: new Date(r.data),
      fim: new Date(new Date(r.data).getTime() + (r.duracao || 30) * 60000),
    })),
    ...bloqueios.map((b: { inicio: Date; fim: Date }) => ({ inicio: new Date(b.inicio), fim: new Date(b.fim) })),
  ];

  // Distribuição pedida (Kauã, 13/07): 1 horário do primeiro dia com vaga (o
  // dia da conversa, se ainda houver horário livre) + o restante do PRÓXIMO
  // dia com vaga — em vez de só empilhar os 3 primeiros slots cronológicos,
  // que podiam sair todos do mesmo dia ou ficar mal distribuídos.
  const slotsByDay: Slot[][] = [];

  const hojeBrt = getBrtDateParts(now);

  for (let dayOffset = 0; dayOffset < LOOKAHEAD_DAYS && slotsByDay.length < 3; dayOffset++) {
    const dayParts = addDaysToParts(hojeBrt, dayOffset);
    const weekday = brtDateTime(dayParts.year, dayParts.month, dayParts.day, 12, 0).getUTCDay();
    if (!horario.diasSemana.includes(weekday)) continue;

    const [hIni, mIni] = horario.inicio.split(":").map(Number);
    const [hFim, mFim] = horario.fim.split(":").map(Number);
    const dayStart = brtDateTime(dayParts.year, dayParts.month, dayParts.day, hIni, mIni);
    const dayEnd = brtDateTime(dayParts.year, dayParts.month, dayParts.day, hFim, mFim);

    let cursor = new Date(Math.max(dayStart.getTime(), now.getTime()));
    const roundedMinutes = Math.ceil(cursor.getMinutes() / 30) * 30;
    cursor.setUTCMinutes(roundedMinutes, 0, 0);

    const daySlots: Slot[] = [];
    while (cursor.getTime() + durationMin * 60000 <= dayEnd.getTime() && daySlots.length < maxSlots) {
      const slotEnd = new Date(cursor.getTime() + durationMin * 60000);
      const conflitaAlmoco = almoco && overlapsLunch(cursor, slotEnd, dayParts, almoco);
      const conflitaBusy = busyRanges.some((b) => cursor < b.fim && slotEnd > b.inicio);
      if (!conflitaAlmoco && !conflitaBusy) {
        daySlots.push({ inicio: new Date(cursor), fim: slotEnd });
      }
      cursor = new Date(cursor.getTime() + durationMin * 60000);
    }

    if (daySlots.length > 0) slotsByDay.push(daySlots);
  }

  // Composição: 1 do 1º dia com vaga (pra mostrar direto na conversa) + até 3
  // de cada dia seguinte, cobrindo vários dias — dá margem pra IA cruzar com a
  // preferência de horário que o lead pedir, em vez de travar em só 2-3 opções
  // de um único dia (pedido Kauã 13/07: "ela precisa consultar a agenda de
  // verdade" quando o lead sugerir um horário diferente dos já oferecidos).
  const slots: Slot[] = [];
  slotsByDay.forEach((daySlots, i) => {
    const remaining = maxSlots - slots.length;
    if (remaining <= 0) return;
    const take = i === 0 ? 1 : Math.min(3, remaining);
    slots.push(...daySlots.slice(0, take));
  });

  return slots.slice(0, maxSlots);
}

export interface DiaDisponibilidade {
  data: Date; // meio-dia BRT do dia (só pra identificar o dia)
  slots: Slot[];
}

/**
 * Grade completa de horários livres (não a versão curada 1+3+3 usada na
 * conversa da Natália) — pra tela de Pré-vendas mostrar tipo Calendly: todos
 * os dias com vaga no período, todos os slots de cada dia. Aceita `busyExtra`
 * (ex.: ocupados reais do Outlook, buscados fora daqui) pra cruzar junto com
 * reuniões do CRM e bloqueios manuais.
 */
export async function getFullAvailability(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  usuarioId: string,
  opts: { durationMin?: number; lookaheadDays?: number; maxSlotsPerDay?: number; busyExtra?: Slot[] } = {}
): Promise<DiaDisponibilidade[]> {
  const durationMin = opts.durationMin || SLOT_DURATION_MIN;
  const lookaheadDays = opts.lookaheadDays || LOOKAHEAD_DAYS;
  const maxSlotsPerDay = opts.maxSlotsPerDay || 20;

  const [disp] = await db
    .select()
    .from(closerDisponibilidade)
    .where(and(eq(closerDisponibilidade.usuarioId, usuarioId), eq(closerDisponibilidade.ativo, true)))
    .limit(1);
  if (!disp) return [];

  const horario = disp.horarioTrabalho as DisponibilidadeSemanal;
  const almoco = (disp.pausaAlmoco as PausaAlmoco | null) || null;

  const now = new Date();
  const rangeEnd = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);

  const busyReunioes = await db
    .select({ data: reunioes.data, duracao: reunioes.duracao })
    .from(reunioes)
    .where(and(eq(reunioes.responsavelId, usuarioId), gte(reunioes.data, now), lte(reunioes.data, rangeEnd)));

  const bloqueios = await db
    .select({ inicio: closerBloqueios.inicio, fim: closerBloqueios.fim })
    .from(closerBloqueios)
    .where(and(eq(closerBloqueios.usuarioId, usuarioId), lte(closerBloqueios.inicio, rangeEnd), gte(closerBloqueios.fim, now)));

  const busyRanges: Slot[] = [
    ...busyReunioes.map((r: { data: Date; duracao: number | null }) => ({
      inicio: new Date(r.data),
      fim: new Date(new Date(r.data).getTime() + (r.duracao || 30) * 60000),
    })),
    ...bloqueios.map((b: { inicio: Date; fim: Date }) => ({ inicio: new Date(b.inicio), fim: new Date(b.fim) })),
    ...(opts.busyExtra || []),
  ];

  const hojeBrt = getBrtDateParts(now);
  const dias: DiaDisponibilidade[] = [];

  for (let dayOffset = 0; dayOffset < lookaheadDays; dayOffset++) {
    const dayParts = addDaysToParts(hojeBrt, dayOffset);
    const weekday = brtDateTime(dayParts.year, dayParts.month, dayParts.day, 12, 0).getUTCDay();
    if (!horario.diasSemana.includes(weekday)) continue;

    const [hIni, mIni] = horario.inicio.split(":").map(Number);
    const [hFim, mFim] = horario.fim.split(":").map(Number);
    const dayStart = brtDateTime(dayParts.year, dayParts.month, dayParts.day, hIni, mIni);
    const dayEnd = brtDateTime(dayParts.year, dayParts.month, dayParts.day, hFim, mFim);

    let cursor = new Date(Math.max(dayStart.getTime(), now.getTime()));
    const roundedMinutes = Math.ceil(cursor.getMinutes() / 30) * 30;
    cursor.setUTCMinutes(roundedMinutes, 0, 0);

    const daySlots: Slot[] = [];
    while (cursor.getTime() + durationMin * 60000 <= dayEnd.getTime() && daySlots.length < maxSlotsPerDay) {
      const slotEnd = new Date(cursor.getTime() + durationMin * 60000);
      const conflitaAlmoco = almoco && overlapsLunch(cursor, slotEnd, dayParts, almoco);
      const conflitaBusy = busyRanges.some((b) => cursor < b.fim && slotEnd > b.inicio);
      if (!conflitaAlmoco && !conflitaBusy) {
        daySlots.push({ inicio: new Date(cursor), fim: slotEnd });
      }
      cursor = new Date(cursor.getTime() + durationMin * 60000);
    }

    if (daySlots.length > 0) {
      dias.push({ data: brtDateTime(dayParts.year, dayParts.month, dayParts.day, 12, 0), slots: daySlots });
    }
  }

  return dias;
}

export function formatSlotLabel(slot: Slot): string {
  return slot.inicio.toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}
