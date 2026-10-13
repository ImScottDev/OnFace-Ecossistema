import { google, type gmail_v1 } from "googleapis";
import { EmailClient, SendEmailParams, SendEmailResult, RawEmail, EmailContaConfig, FetchEmailsOptions } from "./types";
import { garantirDestinoPermitido } from "./trava-destino";
import { decrypt } from "./encryption";

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/email/auth/google/callback`
  );
}

export class GoogleEmailClient implements EmailClient {
  private gmail: gmail_v1.Gmail;
  private contaConfig: EmailContaConfig;

  constructor(config: EmailContaConfig) {
    this.contaConfig = config;
    const oauth2 = getOAuth2Client();
    oauth2.setCredentials({
      access_token: config.accessToken ? decrypt(config.accessToken) : undefined,
      refresh_token: config.refreshToken ? decrypt(config.refreshToken) : undefined,
      expiry_date: config.tokenExpiry ? config.tokenExpiry.getTime() : undefined,
    });
    this.gmail = google.gmail({ version: "v1", auth: oauth2 });
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    garantirDestinoPermitido(params.to, params.cc, params.bcc);
    // RFC 2047 MIME encoded-word for non-ASCII chars in headers (Subject, From display name)
    const encodeHeader = (s: string) =>
      /[^\x20-\x7e]/.test(s) ? `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=` : s;

    const headers: string[] = [
      `To: ${params.to}`,
      `Subject: ${encodeHeader(params.subject)}`,
      `Content-Type: text/html; charset=utf-8`,
      `MIME-Version: 1.0`,
    ];
    if (params.fromAlias) headers.unshift(`From: ${params.fromAlias}`);
    if (params.cc) headers.push(`Cc: ${params.cc}`);
    if (params.bcc) headers.push(`Bcc: ${params.bcc}`);
    if (params.inReplyTo) {
      headers.push(`In-Reply-To: ${params.inReplyTo}`);
      headers.push(`References: ${params.inReplyTo}`);
    }

    const raw = [...headers, "", params.html].join("\r\n");
    const encodedMessage = Buffer.from(raw, "utf8").toString("base64url");

    const res = await this.gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
        threadId: params.threadId || undefined,
      },
    });

    return {
      messageId: res.data.id || "",
      threadId: res.data.threadId || undefined,
    };
  }

  async fetchEmails(since: Date, pageToken?: string, options?: FetchEmailsOptions): Promise<{ emails: RawEmail[]; nextToken?: string }> {
    const afterEpoch = Math.floor(since.getTime() / 1000);
    let q = `after:${afterEpoch}`;
    if (options?.label) {
      // Gmail supports label: query — wrap in quotes if label has spaces
      const lbl = options.label.includes(" ") ? `"${options.label}"` : options.label;
      q += ` label:${lbl}`;
    }
    const res = await this.gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: 50,
      pageToken: pageToken || undefined,
    });

    const messages = res.data.messages || [];
    const emails: RawEmail[] = [];

    for (const msg of messages) {
      try {
        const email = await this.getEmail(msg.id!);
        emails.push(email);
      } catch (err) {
        console.error(`[Google] Failed to fetch message ${msg.id}:`, err);
      }
    }

    return { emails, nextToken: res.data.nextPageToken || undefined };
  }

  async getEmail(providerMessageId: string): Promise<RawEmail> {
    const res = await this.gmail.users.messages.get({
      userId: "me",
      id: providerMessageId,
      format: "full",
    });

    const headers = res.data.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

    const body = this.extractBody(res.data.payload);
    const isRead = !res.data.labelIds?.includes("UNREAD");

    return {
      providerMessageId: res.data.id || providerMessageId,
      threadId: res.data.threadId || undefined,
      from: getHeader("From"),
      to: getHeader("To"),
      cc: getHeader("Cc") || undefined,
      subject: getHeader("Subject"),
      html: body.html || body.text || "",
      text: body.text || undefined,
      date: new Date(parseInt(res.data.internalDate || "0")),
      messageId: getHeader("Message-ID") || undefined,
      inReplyTo: getHeader("In-Reply-To") || undefined,
      read: isRead,
      labels: res.data.labelIds || undefined,
    };
  }

  async getThreadEmails(threadId: string): Promise<RawEmail[]> {
    const res = await this.gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    const messages = res.data.messages || [];
    const emails: RawEmail[] = [];

    for (const msg of messages) {
      try {
        const headers = msg.payload?.headers || [];
        const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
        const body = this.extractBody(msg.payload);
        const isRead = !msg.labelIds?.includes("UNREAD");

        emails.push({
          providerMessageId: msg.id || "",
          threadId: msg.threadId || threadId,
          from: getHeader("From"),
          to: getHeader("To"),
          cc: getHeader("Cc") || undefined,
          subject: getHeader("Subject"),
          html: body.html || body.text || "",
          text: body.text || undefined,
          date: new Date(parseInt(msg.internalDate || "0")),
          messageId: getHeader("Message-ID") || undefined,
          inReplyTo: getHeader("In-Reply-To") || undefined,
          read: isRead,
          labels: msg.labelIds || undefined,
        });
      } catch (err) {
        console.error(`[Google] Failed to parse thread message ${msg.id}:`, err);
      }
    }

    return emails;
  }

  async markRead(providerMessageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: "me",
      id: providerMessageId,
      requestBody: { removeLabelIds: ["UNREAD"] },
    });
  }

  async markUnread(providerMessageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: "me",
      id: providerMessageId,
      requestBody: { addLabelIds: ["UNREAD"] },
    });
  }

  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): { html: string; text: string } {
    if (!payload) return { html: "", text: "" };

    let html = "";
    let text = "";

    const decode = (data?: string | null) =>
      data ? Buffer.from(data, "base64url").toString("utf8") : "";

    if (payload.mimeType === "text/html" && payload.body?.data) {
      html = decode(payload.body.data);
    } else if (payload.mimeType === "text/plain" && payload.body?.data) {
      text = decode(payload.body.data);
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        const sub = this.extractBody(part);
        if (sub.html) html = sub.html;
        if (sub.text) text = sub.text;
      }
    }

    return { html, text };
  }
}

// Helper for OAuth flow
export function getGoogleAuthUrl(state: string): string {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state,
  });
}

export async function exchangeGoogleCode(code: string) {
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);

  // Get user email
  oauth2.setCredentials(tokens);
  const oauth2Client = google.oauth2({ version: "v2", auth: oauth2 });
  const userInfo = await oauth2Client.userinfo.get();

  return {
    email: userInfo.data.email || "",
    name: userInfo.data.name || "",
    accessToken: tokens.access_token || "",
    refreshToken: tokens.refresh_token || "",
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };
}
