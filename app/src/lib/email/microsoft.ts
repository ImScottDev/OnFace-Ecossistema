import { ConfidentialClientApplication, type Configuration } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import { EmailClient, SendEmailParams, SendEmailResult, RawEmail, EmailContaConfig, FetchEmailsOptions } from "./types";
import { decrypt, encrypt } from "./encryption";
import { db } from "@/lib/db";
import { emailContas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const SCOPES = ["Mail.ReadWrite", "Mail.Send", "User.Read", "offline_access"];
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 min before expiry

function getMsalConfig(): Configuration {
  return {
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}`,
    },
  };
}

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

      // Re-init client with new token
      this.client = Client.init({
        authProvider: (done) => done(null, this.accessToken),
      });

      // Persist to DB
      await db.update(emailContas).set({
        accessToken: encrypt(refreshed.accessToken),
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

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}&response_mode=query&state=${state}`;
}

export async function exchangeMicrosoftCode(code: string) {
  const cca = new ConfidentialClientApplication(getMsalConfig());
  const result = await cca.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: getRedirectUri(),
  });

  // Get user info
  const client = Client.init({
    authProvider: (done) => done(null, result.accessToken),
  });
  const me = await client.api("/me").select("mail,displayName").get();

  return {
    email: (me.mail as string) || result.account?.username || "",
    name: (me.displayName as string) || "",
    accessToken: result.accessToken,
    refreshToken: "", // MSAL handles refresh internally via cache
    expiryDate: result.expiresOn || null,
  };
}

export async function refreshMicrosoftToken(refreshToken: string): Promise<{
  accessToken: string;
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
    expiryDate: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}
