// Email provider abstraction types

export interface SendEmailParams {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html: string;
  text?: string;
  inReplyTo?: string;
  threadId?: string;
  fromAlias?: string; // if set, used as "From:" header (must be a verified alias of the authenticated account)
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
}

export interface SendEmailResult {
  messageId: string;
  threadId?: string;
}

export interface RawEmail {
  providerMessageId: string;
  threadId?: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html: string;
  text?: string;
  date: Date;
  messageId?: string; // RFC 2822 Message-ID header
  inReplyTo?: string;
  read: boolean;
  labels?: string[];
  attachments?: Array<{ name: string; contentType: string; size: number; contentId?: string }>;
}

export interface FetchEmailsOptions {
  label?: string; // Gmail label name, MS folder ID, or IMAP folder name
}

export interface EmailClient {
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;
  fetchEmails(since: Date, pageToken?: string, options?: FetchEmailsOptions): Promise<{ emails: RawEmail[]; nextToken?: string }>;
  getEmail(providerMessageId: string): Promise<RawEmail>;
  getThreadEmails?(threadId: string): Promise<RawEmail[]>;
  markRead(providerMessageId: string): Promise<void>;
  markUnread(providerMessageId: string): Promise<void>;
}

export interface EmailContaConfig {
  id: string;
  tipo: "google" | "microsoft" | "imap";
  email: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiry?: Date | null;
  imapHost?: string | null;
  imapPort?: number | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  imapUser?: string | null;
  smtpUser?: string | null;
  imapPass?: string | null;
  smtpPass?: string | null;
}
