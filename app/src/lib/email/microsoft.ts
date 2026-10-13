import { Client } from "@microsoft/microsoft-graph-client";
import { EmailClient, SendEmailParams, SendEmailResult, RawEmail, EmailContaConfig, FetchEmailsOptions } from "./types";
import { decrypt, encrypt } from "./encryption";
import { db } from "@/lib/db";
import { emailContas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Calendars.ReadWrite foi pedido/consentido no app registration (chamado TI Wevy,
// pra Natália ler disponibilidade real e criar reunião no Outlook), mas nunca tinha
// sido declarado aqui — o token emitido hoje parece incluir acesso à agenda mesmo
// assim (grant estático do tenant), mas sem declarar explicitamente, um refresh de
// token (que manda esse SCOPES de novo) podia devolver um token só de e-mail e
// derrubar o acesso à agenda sem aviso. Declarando explícito pra ficar garantido.
const SCOPES = ["Mail.ReadWrite", "Mail.Send", "Calendars.ReadWrite", "User.Read", "offline_access"];
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 min before expiry

function getRedirectUri(): string {
  return `${process.env.NEXTAUTH_URL}/api/email/auth/microsoft/callback`;
}

export class MicrosoftEmailClient implements EmailClient {
  private client: Client;
  private accessToken: string;
  private refreshToken: string;
  private tokenExpiry: Date | null;
  private contaId: string;

  constructor(config: EmailContaConfig) {
    this.accessToken = config.accessToken ? decrypt(config.accessToken) : "";
    this.refreshToken = config.refreshToken ? decrypt(config.refreshToken) : "";
    this.tokenExpiry = config.tokenExpiry || null;
    this.contaId = config.id;

    this.client = Client.init({
      authProvider: (done) => {
        done(null, this.accessToken);
      },
    });
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.tokenExpiry || !this.refreshToken) return;
    const now = Date.now();
    const expiry = new Date(this.tokenExpiry).getTime();
    if (now < expiry - TOKEN_REFRESH_BUFFER_MS) return; // Still valid

    try {
      console.log(`[Microsoft] Refreshing token for account ${this.contaId}`);
      const refreshed = await refreshMicrosoftToken(this.refreshToken);
      this.accessToken = refreshed.accessToken;
      this.tokenExpiry = refreshed.expiryDate;
      if (refreshed.refreshToken) this.refreshToken = refreshed.refreshToken;

      // Re-init client with new token
      this.client = Client.init({
        authProvider: (done) => done(null, this.accessToken),
      });

      // Persist to DB (inclui o refresh token se a Entra ID rotacionou um novo)
      await db.update(emailContas).set({
        accessToken: encrypt(refreshed.accessToken),
        ...(refreshed.refreshToken ? { refreshToken: encrypt(refreshed.refreshToken) } : {}),
        tokenExpiry: refreshed.expiryDate,
        lastError: null,
      }).where(eq(emailContas.id, this.contaId));
    } catch (error) {
      console.error(`[Microsoft] Token refresh failed for ${this.contaId}:`, error);
      await db.update(emailContas).set({
        lastError: `Token refresh failed: ${String(error)}`,
      }).where(eq(emailContas.id, this.contaId));
      throw error;
    }
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    await this.ensureValidToken();
    const toRecipients = params.to.split(",").map((e) => ({
      emailAddress: { address: e.trim() },
    }));

    const message: Record<string, unknown> = {
      subject: params.subject,
      body: { contentType: "HTML", content: params.html },
      toRecipients,
    };

    if (params.cc) {
      message.ccRecipients = params.cc.split(",").map((e) => ({
        emailAddress: { address: e.trim() },
      }));
    }
    if (params.bcc) {
      message.bccRecipients = params.bcc.split(",").map((e) => ({
        emailAddress: { address: e.trim() },
      }));
    }

    const res = await this.client.api("/me/sendMail").post({ message, saveToSentItems: true });

    return {
      messageId: res?.id || "",
      threadId: res?.conversationId || undefined,
    };
  }

  async fetchEmails(since: Date, pageToken?: string, options?: FetchEmailsOptions): Promise<{ emails: RawEmail[]; nextToken?: string }> {
    await this.ensureValidToken();
    const isoDate = since.toISOString();
    const basePath = options?.label
      ? `/me/mailFolders/${options.label}/messages`
      : "/me/messages";
    let request = this.client
      .api(basePath)
      .filter(`receivedDateTime ge ${isoDate}`)
      .orderby("receivedDateTime desc")
      .top(50)
      .select("id,conversationId,from,toRecipients,ccRecipients,subject,body,bodyPreview,receivedDateTime,internetMessageId,isRead,internetMessageHeaders");

    if (pageToken) {
      request = this.client.api(pageToken);
    }

    const res = await request.get();
    const messages = res.value || [];
    const emails: RawEmail[] = messages.map((msg: Record<string, unknown>) => this.mapMessage(msg));
    const nextToken = res["@odata.nextLink"] || undefined;

    return { emails, nextToken };
  }

  async getEmail(providerMessageId: string): Promise<RawEmail> {
    await this.ensureValidToken();
    const res = await this.client
      .api(`/me/messages/${providerMessageId}`)
      .select("id,conversationId,from,toRecipients,ccRecipients,subject,body,bodyPreview,receivedDateTime,internetMessageId,isRead,internetMessageHeaders")
      .get();

    return this.mapMessage(res);
  }

  async markRead(providerMessageId: string): Promise<void> {
    await this.ensureValidToken();
    await this.client.api(`/me/messages/${providerMessageId}`).patch({ isRead: true });
  }

  async markUnread(providerMessageId: string): Promise<void> {
    await this.ensureValidToken();
    await this.client.api(`/me/messages/${providerMessageId}`).patch({ isRead: false });
  }

  private mapMessage(msg: Record<string, unknown>): RawEmail {
    const from = msg.from as { emailAddress?: { address?: string } } | undefined;
    const toRecipients = msg.toRecipients as Array<{ emailAddress?: { address?: string } }> | undefined;
    const ccRecipients = msg.ccRecipients as Array<{ emailAddress?: { address?: string } }> | undefined;
    const body = msg.body as { content?: string; contentType?: string } | undefined;

    // Extract In-Reply-To from internet headers
    const headers = msg.internetMessageHeaders as Array<{ name: string; value: string }> | undefined;
    const inReplyTo = headers?.find((h) => h.name.toLowerCase() === "in-reply-to")?.value;

    return {
      providerMessageId: (msg.id as string) || "",
      threadId: (msg.conversationId as string) || undefined,
      from: from?.emailAddress?.address || "",
      to: toRecipients?.map((r) => r.emailAddress?.address).filter(Boolean).join(", ") || "",
      cc: ccRecipients?.map((r) => r.emailAddress?.address).filter(Boolean).join(", ") || undefined,
      subject: (msg.subject as string) || "",
      html: body?.contentType === "html" ? body.content || "" : "",
      text: body?.contentType === "text" ? body.content || "" : undefined,
      date: new Date((msg.receivedDateTime as string) || 0),
      messageId: (msg.internetMessageId as string) || undefined,
      inReplyTo,
      read: (msg.isRead as boolean) ?? true,
    };
  }
}

// Helper for OAuth flow
export function getMicrosoftAuthUrl(state: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID!;
  const tenantId = process.env.MICROSOFT_TENANT_ID || "common";
  const redirectUri = encodeURIComponent(getRedirectUri());
  const scope = encodeURIComponent(SCOPES.join(" "));

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}&response_mode=query&state=${encodeURIComponent(state)}`;
}

// BUG REAL corrigido 20/07: essa função usava `ConfidentialClientApplication.acquireTokenByCode`
// (MSAL Node), que guarda o refresh token só no cache INTERNO do próprio objeto `cca` —
// como um `cca` novo é criado a cada chamada (sem cache persistido em disco/Redis/DB), esse
// cache é descartado assim que a função retorna. Resultado: `refreshToken` sempre voltava "",
// a conta conectava mas o access token morria em ~1h e nunca mais renovava sozinho (usuário
// tinha que reconectar toda hora — nada do "conecta uma vez", que era a promessa da feature).
// Fix: bate direto no endpoint de token (mesmo padrão já usado em `refreshMicrosoftToken`
// abaixo), que devolve o `refresh_token` de verdade no corpo da resposta, sem depender de
// cache nenhum do MSAL.
export async function exchangeMicrosoftCode(code: string) {
  const tenantId = process.env.MICROSOFT_TENANT_ID || "common";
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      code,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
      scope: SCOPES.join(" "),
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(`Token exchange failed: ${data.error_description || data.error}`);

  const client = Client.init({
    authProvider: (done) => done(null, data.access_token),
  });
  const me = await client.api("/me").select("mail,displayName").get();

  return {
    email: (me.mail as string) || "",
    name: (me.displayName as string) || "",
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string) || "",
    expiryDate: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}

export async function refreshMicrosoftToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string | null; // Entra ID pode rotacionar o refresh token a cada uso — sempre persistir se vier
  expiryDate: Date | null;
}> {
  const tenantId = process.env.MICROSOFT_TENANT_ID || "common";
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: SCOPES.join(" "),
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(`Token refresh failed: ${data.error_description || data.error}`);

  return {
    accessToken: data.access_token,
    refreshToken: (data.refresh_token as string) || null,
    expiryDate: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}

// ─── Agenda real (Calendars.ReadWrite) ──────────────────────────────────────
// Usado pelo fluxo manual de Pré-vendas (seleção de closer + slots reais,
// criação/cancelamento do evento no Outlook). Independente da classe
// MicrosoftEmailClient (que cuida do próprio token pro fluxo de e-mail) —
// aqui cada chamada resolve/atualiza o token da conta a partir do banco.

/** Garante um access token válido pra uma conta Microsoft, refrescando e persistindo se preciso. */
async function getValidAccessToken(contaId: string): Promise<string> {
  const [conta] = await db
    .select({
      accessToken: emailContas.accessToken,
      refreshToken: emailContas.refreshToken,
      tokenExpiry: emailContas.tokenExpiry,
    })
    .from(emailContas)
    .where(eq(emailContas.id, contaId))
    .limit(1);

  if (!conta?.accessToken) throw new Error(`Conta Microsoft ${contaId} sem token salvo`);

  const expiry = conta.tokenExpiry ? new Date(conta.tokenExpiry).getTime() : 0;
  const stillValid = expiry - TOKEN_REFRESH_BUFFER_MS > Date.now();
  if (stillValid) return decrypt(conta.accessToken);

  if (!conta.refreshToken) return decrypt(conta.accessToken); // sem refresh token, tenta com o que tem

  const refreshed = await refreshMicrosoftToken(decrypt(conta.refreshToken));
  await db.update(emailContas).set({
    accessToken: encrypt(refreshed.accessToken),
    ...(refreshed.refreshToken ? { refreshToken: encrypt(refreshed.refreshToken) } : {}),
    tokenExpiry: refreshed.expiryDate,
  }).where(eq(emailContas.id, contaId));
  return refreshed.accessToken;
}

async function graphFetch(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph ${path}: HTTP ${res.status} ${text.slice(0, 400)}`);
  }
  return res.status === 204 ? null : res.json();
}

export interface BusyRange {
  inicio: Date;
  fim: Date;
}

/**
 * Horários ocupados reais no Outlook do closer num intervalo. Considera
 * qualquer evento que não seja explicitamente "free" (tentative/busy/oof
 * bloqueiam, igual o Calendly trata por padrão).
 */
export async function getBusyTimes(contaId: string, startISO: string, endISO: string): Promise<BusyRange[]> {
  const accessToken = await getValidAccessToken(contaId);
  const params = new URLSearchParams({
    startDateTime: startISO,
    endDateTime: endISO,
    $select: "start,end,showAs",
    $top: "100",
  });
  const data = await graphFetch(accessToken, `/me/calendarView?${params.toString()}`, {
    headers: { Prefer: 'outlook.timezone="UTC"' },
  });
  const events = (data?.value || []) as Array<{ start: { dateTime: string }; end: { dateTime: string }; showAs: string }>;
  return events
    .filter((e) => e.showAs !== "free")
    .map((e) => ({ inicio: new Date(`${e.start.dateTime}Z`), fim: new Date(`${e.end.dateTime}Z`) }));
}

export interface CriarEventoParams {
  contaId: string;
  titulo: string;
  inicioISO: string;
  fimISO: string;
  attendeeEmail?: string | null;
  /** Vários convidados; soma-se a `attendeeEmail`. */
  attendeeEmails?: string[] | null;
  corpo?: string | null;
  // Bloqueio de agenda (férias/folga/compromisso) não é reunião — sem Teams,
  // só ocupa o horário. Default false preserva todo call site existente.
  semTeams?: boolean;
}

export interface EventoCriado {
  eventId: string;
  webLink: string;
  joinUrl: string | null;
}

/** Cria o evento de verdade no Outlook do closer, com Teams meeting automático. */
export async function createOutlookEvent(params: CriarEventoParams): Promise<EventoCriado> {
  const accessToken = await getValidAccessToken(params.contaId);
  const body: Record<string, unknown> = {
    subject: params.titulo,
    start: { dateTime: params.inicioISO, timeZone: "UTC" },
    end: { dateTime: params.fimISO, timeZone: "UTC" },
    ...(params.semTeams ? { showAs: "busy" } : { isOnlineMeeting: true, onlineMeetingProvider: "teamsForBusiness" }),
  };
  if (params.corpo) body.body = { contentType: "text", content: params.corpo };
  const convidados = [...new Set([params.attendeeEmail, ...(params.attendeeEmails ?? [])].filter((e): e is string => !!e))];
  if (convidados.length) {
    body.attendees = convidados.map((address) => ({ emailAddress: { address }, type: "required" }));
  }

  const created = await graphFetch(accessToken, "/me/events", { method: "POST", body: JSON.stringify(body) });
  return {
    eventId: created.id,
    webLink: created.webLink,
    joinUrl: created.onlineMeeting?.joinUrl || null,
  };
}

/**
 * Atualiza um evento existente no Outlook — a peça que faltava.
 *
 * O cliente tinha create, get e delete. Sem update, reagendar uma reunião no
 * ONFACE mudava a data aqui e deixava o convite antigo de pé na agenda do
 * cliente, sem ninguém ser avisado.
 *
 * PATCH parcial de propósito: mandar o corpo inteiro sobrescreveria campos que
 * o usuário mexeu direto no Outlook (anotação, participante extra).
 */
export async function updateOutlookEvent(params: {
  contaId: string;
  eventId: string;
  titulo?: string | null;
  inicioISO?: string | null;
  fimISO?: string | null;
  corpo?: string | null;
  /** Lista completa: substitui os convidados do evento (o Outlook avisa quem entrou e quem saiu). */
  attendeeEmails?: string[] | null;
}): Promise<{ atualizado: boolean; naoExiste?: boolean }> {
  const accessToken = await getValidAccessToken(params.contaId);
  const body: Record<string, unknown> = {};
  if (params.titulo) body.subject = params.titulo;
  if (params.inicioISO) body.start = { dateTime: params.inicioISO, timeZone: "UTC" };
  if (params.fimISO) body.end = { dateTime: params.fimISO, timeZone: "UTC" };
  if (params.corpo) body.body = { contentType: "text", content: params.corpo };
  if (params.attendeeEmails) body.attendees = params.attendeeEmails.map((address) => ({ emailAddress: { address }, type: "required" }));
  if (Object.keys(body).length === 0) return { atualizado: false };

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${params.eventId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // 404 é evento apagado do lado do Outlook: não é erro de integração, é
  // estado. Quem chama decide se recria.
  if (res.status === 404) return { atualizado: false, naoExiste: true };
  if (!res.ok) {
    throw new Error(`Graph PATCH event ${params.eventId}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return { atualizado: true };
}

export interface EventoOutlook {
  existe: boolean;
  cancelado: boolean;
  inicioISO: string | null;
  fimISO: string | null;
  titulo: string | null;
}

/**
 * Lê o estado atual de um evento no Outlook do closer — base do sync de volta
 * (reunião reagendada/cancelada direto no Outlook, fora do CRM). 404 = evento
 * apagado lá (tratar como cancelado).
 */
export async function getOutlookEvent(contaId: string, eventId: string): Promise<EventoOutlook> {
  const accessToken = await getValidAccessToken(contaId);
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}?$select=start,end,subject,isCancelled`, {
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' },
  });
  if (res.status === 404) return { existe: false, cancelado: true, inicioISO: null, fimISO: null, titulo: null };
  if (!res.ok) throw new Error(`Graph GET event ${eventId}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const ev = (await res.json()) as { start?: { dateTime: string }; end?: { dateTime: string }; subject?: string; isCancelled?: boolean };
  return {
    existe: true,
    cancelado: !!ev.isCancelled,
    inicioISO: ev.start?.dateTime ? `${ev.start.dateTime}Z` : null,
    fimISO: ev.end?.dateTime ? `${ev.end.dateTime}Z` : null,
    titulo: ev.subject || null,
  };
}

/** Cancela o evento no Outlook do closer. Best-effort: se já não existir, ignora. */
export async function deleteOutlookEvent(contaId: string, eventId: string): Promise<void> {
  const accessToken = await getValidAccessToken(contaId);
  try {
    await graphFetch(accessToken, `/me/events/${eventId}`, { method: "DELETE" });
  } catch (e) {
    console.error(`[Outlook] falha ao cancelar evento ${eventId} (ignorado, best-effort):`, e);
  }
}
