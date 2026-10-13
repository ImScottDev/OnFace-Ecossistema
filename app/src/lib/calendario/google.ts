/**
 * Adapter Google Calendar do CalendarProvider (Módulo 09).
 *
 * A API do Google Calendar é REST pura e o fluxo de token é OAuth2 padrão, e
 * é por isso que este adapter não traz SDK: são quatro chamadas HTTP e um
 * refresh. Uma dependência a mais aqui só aumentaria superfície.
 *
 * ESTADO DESTE ADAPTER: implementado e SEM CREDENCIAL neste ambiente. Ele
 * responde `nao_configurado` enquanto `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
 * não existirem, e o CRM segue funcionando — reunião continua sendo criada no
 * ONFACE, com o aviso explícito de que nenhum convite externo saiu.
 *
 * Isso é diferente de "não implementado": o caminho existe inteiro e o que
 * falta é credencial. Tratar as duas coisas como a mesma faria o alerta tocar
 * em ambiente que nunca foi configurado, que é ruído que ninguém olha.
 */
import { garantirDestinoPermitido } from "@/lib/email/trava-destino";
import { db } from "@/lib/db";
import { emailContas } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type {
  CalendarProvider, EventoParaCriar, EventoParaAtualizar, ResultadoProvider, MotivoFalha,
} from "./provider";

const BASE = "https://www.googleapis.com/calendar/v3";

function classificar(status: number, corpo: string): { motivo: MotivoFalha; tentarDeNovo: boolean; detalhe: string } {
  if (status === 401 || status === 403) {
    return { motivo: "token_expirado", tentarDeNovo: false, detalhe: corpo.slice(0, 300) };
  }
  return {
    motivo: "erro_provedor",
    tentarDeNovo: status === 429 || status >= 500,
    detalhe: `HTTP ${status} ${corpo.slice(0, 300)}`,
  };
}

/**
 * Troca o refresh token por um access token. O Google não devolve refresh novo
 * a cada troca, então o que está guardado continua valendo — sobrescrevê-lo
 * com vazio é o erro clássico que derruba a conexão no dia seguinte.
 */
async function accessToken(contaId: string): Promise<string> {
  const [conta] = await db
    .select({ refreshToken: emailContas.refreshToken })
    .from(emailContas).where(eq(emailContas.id, contaId)).limit(1);
  if (!conta?.refreshToken) throw new Error("conta Google sem refresh token");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: conta.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new Error("Google token: resposta sem access_token");
  return j.access_token;
}

async function chamar(
  token: string, caminho: string, init: RequestInit,
): Promise<{ ok: true; dados: Record<string, unknown> } | { ok: false; status: number; corpo: string }> {
  const res = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) return { ok: false, status: res.status, corpo: await res.text().catch(() => "") };
  const texto = await res.text();
  return { ok: true, dados: texto ? (JSON.parse(texto) as Record<string, unknown>) : {} };
}

export const googleCalendar: CalendarProvider = {
  nome: "google",

  configurado() {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  },

  async contaDoUsuario(usuarioId: string): Promise<string | null> {
    if (!this.configurado()) return null;
    const [conta] = await db
      .select({ id: emailContas.id })
      .from(emailContas)
      .where(and(
        eq(emailContas.usuarioId, usuarioId),
        eq(emailContas.tipo, "google"),
        eq(emailContas.syncStatus, "active"),
      ))
      .limit(1);
    return conta?.id ?? null;
  },

  async criar(contaId: string, ev: EventoParaCriar): Promise<ResultadoProvider> {
    if (!this.configurado()) {
      return { ok: false, motivo: "nao_configurado", detalhe: "GOOGLE_CLIENT_ID/SECRET ausentes", tentarDeNovo: false };
    }
    try {
      const token = await accessToken(contaId);
      const corpo: Record<string, unknown> = {
        summary: ev.titulo,
        start: { dateTime: ev.inicioISO, timeZone: "UTC" },
        end: { dateTime: ev.fimISO, timeZone: "UTC" },
      };
      if (ev.corpo) corpo.description = ev.corpo;
      const convidados = [...new Set([ev.convidadoEmail, ...(ev.convidados ?? [])].filter((e): e is string => !!e))];
      garantirDestinoPermitido(convidados);
      if (convidados.length) corpo.attendees = convidados.map((email) => ({ email }));
      if (ev.online !== false) {
        corpo.conferenceData = {
          createRequest: { requestId: `onface-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } },
        };
      }
      // sendUpdates=all: sem isso o convidado não é notificado e o convite
      // "existe" só na agenda de quem criou.
      const r = await chamar(token, "/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", {
        method: "POST", body: JSON.stringify(corpo),
      });
      if (!r.ok) return { ok: false, ...classificar(r.status, r.corpo) };
      const d = r.dados as { id?: string; htmlLink?: string; hangoutLink?: string };
      return { ok: true, eventId: String(d.id), link: d.htmlLink ?? null, joinUrl: d.hangoutLink ?? null };
    } catch (e) {
      return { ok: false, motivo: "erro_provedor", detalhe: String(e).slice(0, 300), tentarDeNovo: true };
    }
  },

  async atualizar(contaId: string, eventId: string, m: EventoParaAtualizar): Promise<ResultadoProvider> {
    if (!this.configurado()) {
      return { ok: false, motivo: "nao_configurado", detalhe: "GOOGLE_CLIENT_ID/SECRET ausentes", tentarDeNovo: false };
    }
    try {
      const token = await accessToken(contaId);
      const corpo: Record<string, unknown> = {};
      if (m.titulo) corpo.summary = m.titulo;
      if (m.inicioISO) corpo.start = { dateTime: m.inicioISO, timeZone: "UTC" };
      if (m.fimISO) corpo.end = { dateTime: m.fimISO, timeZone: "UTC" };
      if (m.corpo) corpo.description = m.corpo;
      garantirDestinoPermitido(m.convidados);
      if (m.convidados) corpo.attendees = m.convidados.map((email) => ({ email }));
      if (Object.keys(corpo).length === 0) return { ok: true, eventId };

      // PATCH, não PUT: PUT substituiria o evento inteiro e apagaria o que o
      // usuário mexeu direto no Google.
      const r = await chamar(token, `/calendars/primary/events/${eventId}?sendUpdates=all`, {
        method: "PATCH", body: JSON.stringify(corpo),
      });
      if (!r.ok) {
        if (r.status === 404 || r.status === 410) return { ok: true, eventId: null, naoExiste: true };
        return { ok: false, ...classificar(r.status, r.corpo) };
      }
      return { ok: true, eventId };
    } catch (e) {
      return { ok: false, motivo: "erro_provedor", detalhe: String(e).slice(0, 300), tentarDeNovo: true };
    }
  },

  async cancelar(contaId: string, eventId: string): Promise<ResultadoProvider> {
    if (!this.configurado()) {
      return { ok: false, motivo: "nao_configurado", detalhe: "GOOGLE_CLIENT_ID/SECRET ausentes", tentarDeNovo: false };
    }
    try {
      const token = await accessToken(contaId);
      const r = await chamar(token, `/calendars/primary/events/${eventId}?sendUpdates=all`, { method: "DELETE" });
      // Já não existe = o objetivo já foi alcançado.
      if (!r.ok && r.status !== 404 && r.status !== 410) return { ok: false, ...classificar(r.status, r.corpo) };
      return { ok: true, eventId };
    } catch (e) {
      return { ok: false, motivo: "erro_provedor", detalhe: String(e).slice(0, 300), tentarDeNovo: true };
    }
  },

  async ocupados(contaId: string, inicioISO: string, fimISO: string) {
    if (!this.configurado()) return { ok: false as const, motivo: "nao_configurado" as const, detalhe: "GOOGLE_CLIENT_ID/SECRET ausentes" };
    try {
      const token = await accessToken(contaId);
      const r = await chamar(token, "/freeBusy", { method: "POST", body: JSON.stringify({ timeMin: inicioISO, timeMax: fimISO, items: [{ id: "primary" }] }) });
      if (!r.ok) return { ok: false as const, ...classificar(r.status, r.corpo) };
      const j = r.dados as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } };
      return { ok: true as const, faixas: (j.calendars?.primary?.busy ?? []).map((b) => ({ inicio: new Date(b.start), fim: new Date(b.end) })) };
    } catch (e) {
      return { ok: false as const, motivo: "erro_provedor" as const, detalhe: String(e).slice(0, 300) };
    }
  },
};
