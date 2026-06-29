import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { EmailClient, SendEmailParams, SendEmailResult, RawEmail, EmailContaConfig, FetchEmailsOptions } from "./types";
import { decrypt } from "./encryption";

export class ImapEmailClient implements EmailClient {
  private config: EmailContaConfig;

  constructor(config: EmailContaConfig) {
    this.config = config;
  }

  private getImapClient(): ImapFlow {
    return new ImapFlow({
      host: this.config.imapHost!,
      port: this.config.imapPort || 993,
      secure: (this.config.imapPort || 993) === 993,
      auth: {
        user: this.config.imapUser ? decrypt(this.config.imapUser) : this.config.email,
        pass: this.config.imapPass ? decrypt(this.config.imapPass) : "",
      },
      logger: false,
    });
  }

  private getSmtpTransport() {
    const port = this.config.smtpPort || 587;
    return nodemailer.createTransport({
      host: this.config.smtpHost!,
      port,
      secure: port === 465,
      auth: {
        user: this.config.smtpUser ? decrypt(this.config.smtpUser) : this.config.email,
        pass: this.config.smtpPass ? decrypt(this.config.smtpPass) : "",
      },
    });
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const transport = this.getSmtpTransport();

    const info = await transport.sendMail({
      from: params.fromAlias || this.config.email,
      to: params.to,
      cc: params.cc || undefined,
      bcc: params.bcc || undefined,
      subject: params.subject,
      html: params.html,
      text: params.text || params.html.replace(/<[^>]*>/g, ""),
      inReplyTo: params.inReplyTo || undefined,
      references: params.inReplyTo || undefined,
    });

    return {
      messageId: info.messageId || "",
    };
  }

  async fetchEmails(since: Date, _pageToken?: string, options?: FetchEmailsOptions): Promise<{ emails: RawEmail[]; nextToken?: string }> {
    const client = this.getImapClient();
    const emails: RawEmail[] = [];
    const mailbox = options?.label || "INBOX";

    try {
      await client.connect();
      const lock = await client.getMailboxLock(mailbox);

      try {
        const messages = client.fetch(
          { since },
          {
            uid: true,
            envelope: true,
            bodyStructure: true,
            source: true,
            flags: true,
          }
        );

        let count = 0;
        for await (const msg of messages) {
          if (count >= 50) break;
          const email = this.mapMessage(msg as unknown as Record<string, unknown>);
          if (email) emails.push(email);
          count++;
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }

    return { emails };
  }

  async getEmail(providerMessageId: string): Promise<RawEmail> {
    const client = this.getImapClient();

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");

      try {
        const msg = await client.fetchOne(providerMessageId, {
          uid: true,
          envelope: true,
          source: true,
          flags: true,
        });

        const email = this.mapMessage(msg as unknown as Record<string, unknown>);
        if (!email) throw new Error("Failed to parse email");
        return email;
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async markRead(providerMessageId: string): Promise<void> {
    const client = this.getImapClient();
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        await client.messageFlagsAdd(providerMessageId, ["\\Seen"]);
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async markUnread(providerMessageId: string): Promise<void> {
    const client = this.getImapClient();
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        await client.messageFlagsRemove(providerMessageId, ["\\Seen"]);
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  }

  private mapMessage(msg: Record<string, unknown>): RawEmail | null {
    try {
      const envelope = msg.envelope as Record<string, unknown> | undefined;
      if (!envelope) return null;

      const flags = (msg.flags as Set<string>) || new Set();
      const source = msg.source as Buffer | undefined;
      const html = source ? source.toString("utf8") : "";

      const fromAddr = (envelope.from as Array<{ address?: string }>)?.[0]?.address || "";
      const toAddr = (envelope.to as Array<{ address?: string }>)?.map((a) => a.address).filter(Boolean).join(", ") || "";
      const ccAddr = (envelope.cc as Array<{ address?: string }>)?.map((a) => a.address).filter(Boolean).join(", ") || undefined;

      return {
        providerMessageId: String(msg.uid || ""),
        from: fromAddr,
        to: toAddr,
        cc: ccAddr,
        subject: (envelope.subject as string) || "",
        html,
        date: new Date((envelope.date as string) || 0),
        messageId: (envelope.messageId as string) || undefined,
        inReplyTo: (envelope.inReplyTo as string) || undefined,
        read: flags.has("\\Seen"),
      };
    } catch {
      return null;
    }
  }
}

// Test IMAP/SMTP connection
export async function testImapConnection(config: {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
}): Promise<{ success: boolean; error?: string }> {
  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapPort === 993,
    auth: { user: config.imapUser, pass: config.imapPass },
    logger: false,
  });

  try {
    await client.connect();
    await client.logout();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Connection failed" };
  }
}

export async function testSmtpConnection(config: {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
}): Promise<{ success: boolean; error?: string }> {
  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: { user: config.smtpUser, pass: config.smtpPass },
  });

  try {
    await transport.verify();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Connection failed" };
  }
}
