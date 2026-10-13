/**
 * Graph de agenda: o que o cliente de e-mail (`lib/email/microsoft.ts`) não tem.
 * Leitura de evento, assinatura (change notifications), delta query e
 * getSchedule. Todas as chamadas usam o token da conta de QUEM É DONO da
 * agenda, então nenhuma lê ou escreve no calendário de outra pessoa.
 *
 * Escopos: Calendars.ReadWrite (já consentido) cobre tudo aqui. getSchedule da
 * própria caixa e assinatura em /me/events não pedem escopo novo.
 */
import { getValidAccessToken } from "@/lib/email/microsoft";

const GRAPH = "https://graph.microsoft.com/v1.0";
/** Máximo do Graph para assinatura de events é 4230 min; fica abaixo para sobrar folga. */
export const VIDA_ASSINATURA_MIN = 4200;

export interface EventoGraph {
  id: string;
  subject?: string | null;
  isCancelled?: boolean;
  start?: { dateTime: string; timeZone?: string };
  end?: { dateTime: string; timeZone?: string };
  onlineMeeting?: { joinUrl?: string | null } | null;
  location?: { displayName?: string | null } | null;
  organizer?: { emailAddress?: { address?: string } } | null;
  attendees?: Array<{ emailAddress?: { address?: string }; status?: { response?: string }; type?: string }>;
  "@removed"?: { reason?: string };
}

const CAMPOS = "id,subject,start,end,isCancelled,onlineMeeting,location,attendees,organizer";

async function gf(contaId: string, caminho: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken(contaId);
  return fetch(caminho.startsWith("http") ? caminho : `${GRAPH}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: 'outlook.timezone="UTC"', ...(init.headers ?? {}) },
  });
}

async function falhar(r: Response, o: string): Promise<never> {
  throw new Error(`Graph ${o}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
}

/** O instante UTC de um `{dateTime}` devolvido com Prefer UTC. */
export const instanteUTC = (dateTime: string): Date => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(dateTime) ? dateTime : `${dateTime}Z`);

/** Evento atual, ou null quando foi apagado (404). */
export async function lerEvento(contaId: string, eventId: string): Promise<EventoGraph | null> {
  const r = await gf(contaId, `/me/events/${encodeURIComponent(eventId)}?$select=${CAMPOS}`);
  if (r.status === 404) return null;
  if (!r.ok) await falhar(r, `GET event ${eventId}`);
  return (await r.json()) as EventoGraph;
}

// ─── Change notifications ───────────────────────────────────────────────────

export interface Assinatura { id: string; expiraEm: Date }

export async function criarAssinatura(contaId: string, notificationUrl: string, clientState: string): Promise<Assinatura> {
  const expiracao = new Date(Date.now() + VIDA_ASSINATURA_MIN * 60_000);
  const r = await gf(contaId, "/subscriptions", {
    method: "POST",
    body: JSON.stringify({ changeType: "created,updated,deleted", notificationUrl, resource: "/me/events", expirationDateTime: expiracao.toISOString(), clientState }),
  });
  if (!r.ok) await falhar(r, "POST subscriptions");
  const j = (await r.json()) as { id: string; expirationDateTime: string };
  return { id: j.id, expiraEm: new Date(j.expirationDateTime) };
}

/** null = a assinatura não existe mais (404): quem chama cria outra. */
export async function renovarAssinatura(contaId: string, subscriptionId: string): Promise<Assinatura | null> {
  const expiracao = new Date(Date.now() + VIDA_ASSINATURA_MIN * 60_000);
  const r = await gf(contaId, `/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "PATCH", body: JSON.stringify({ expirationDateTime: expiracao.toISOString() }) });
  if (r.status === 404) return null;
  if (!r.ok) await falhar(r, "PATCH subscription");
  const j = (await r.json()) as { id: string; expirationDateTime: string };
  return { id: j.id, expiraEm: new Date(j.expirationDateTime) };
}

// ─── Delta query ────────────────────────────────────────────────────────────

export interface ResultadoDelta { eventos: EventoGraph[]; deltaLink: string }

/** `deltaLink` null = leitura inicial da janela [ontem, hoje+90d]. 410 = token de delta expirou: `expirado`. */
export async function deltaCalendario(contaId: string, deltaLink: string | null): Promise<ResultadoDelta | "expirado"> {
  const url0 = deltaLink ?? `/me/calendarView/delta?${new URLSearchParams({
    startDateTime: new Date(Date.now() - 86_400_000).toISOString(),
    endDateTime: new Date(Date.now() + 90 * 86_400_000).toISOString(),
    $select: CAMPOS,
  })}`;
  const eventos: EventoGraph[] = [];
  let url: string | undefined = url0;
  for (let pagina = 0; url && pagina < 50; pagina++) {
    const r: Response = await gf(contaId, url, { headers: { Prefer: 'outlook.timezone="UTC", odata.maxpagesize=50' } });
    if (r.status === 410) return "expirado";
    if (!r.ok) await falhar(r, "delta calendarView");
    const j = (await r.json()) as { value?: EventoGraph[]; "@odata.nextLink"?: string; "@odata.deltaLink"?: string };
    eventos.push(...(j.value ?? []));
    if (j["@odata.deltaLink"]) return { eventos, deltaLink: j["@odata.deltaLink"] };
    url = j["@odata.nextLink"];
  }
  throw new Error("Graph delta calendarView: sem deltaLink após 50 páginas");
}

// ─── Disponibilidade ────────────────────────────────────────────────────────

/**
 * Faixas ocupadas da caixa `email` via POST /me/calendar/getSchedule. tentative,
 * busy e oof bloqueiam; free e workingElsewhere não. Uma resposta com `error`
 * para a caixa LANÇA: "não consegui ver" nunca vira "livre".
 */
export async function ocupadosPorSchedule(contaId: string, email: string, inicioISO: string, fimISO: string): Promise<{ inicio: Date; fim: Date }[]> {
  const r = await gf(contaId, "/me/calendar/getSchedule", {
    method: "POST",
    body: JSON.stringify({
      schedules: [email],
      startTime: { dateTime: new Date(inicioISO).toISOString().replace("Z", ""), timeZone: "UTC" },
      endTime: { dateTime: new Date(fimISO).toISOString().replace("Z", ""), timeZone: "UTC" },
      availabilityViewInterval: 15,
    }),
  });
  if (!r.ok) await falhar(r, "getSchedule");
  const j = (await r.json()) as { value?: Array<{ error?: { message?: string }; scheduleItems?: Array<{ status: string; start: { dateTime: string }; end: { dateTime: string } }> }> };
  const item = j.value?.[0];
  if (!item || item.error) throw new Error(`Graph getSchedule: ${item?.error?.message ?? "sem resposta para a caixa"}`);
  return (item.scheduleItems ?? [])
    .filter((s) => s.status !== "free" && s.status !== "workingElsewhere")
    .map((s) => ({ inicio: instanteUTC(s.start.dateTime), fim: instanteUTC(s.end.dateTime) }));
}

// ─── Reparo ─────────────────────────────────────────────────────────────────

export async function eventosNaJanela(contaId: string, inicioISO: string, fimISO: string): Promise<EventoGraph[]> {
  const out: EventoGraph[] = [];
  let url: string | undefined = `/me/calendarView?${new URLSearchParams({ startDateTime: inicioISO, endDateTime: fimISO, $select: CAMPOS, $top: "100" })}`;
  for (let i = 0; url && i < 10; i++) {
    const r: Response = await gf(contaId, url);
    if (!r.ok) await falhar(r, "calendarView");
    const j = (await r.json()) as { value?: EventoGraph[]; "@odata.nextLink"?: string };
    out.push(...(j.value ?? []));
    url = j["@odata.nextLink"];
  }
  return out;
}

export async function apagarEvento(contaId: string, eventId: string): Promise<void> {
  const r = await gf(contaId, `/me/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  if (!r.ok && r.status !== 404) await falhar(r, `DELETE event ${eventId}`);
}
