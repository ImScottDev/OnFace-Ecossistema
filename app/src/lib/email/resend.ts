/**
 * Resend — envio de email transacional do CRM (proposta, confirmação de
 * pagamento, etc.). Caminho separado do email-por-OAuth (Microsoft/Gmail):
 * Resend é "do sistema" (no-reply), não da caixa do vendedor.
 *
 * Requer:
 *   RESEND_API_KEY   — chave da conta Resend
 *   RESEND_FROM      — remetente verificado, ex.: "Callface <no-reply@callface.ai>"
 *
 * Se a chave não estiver configurada, faz no-op (loga aviso) em vez de quebrar
 * o fluxo que chamou. Assim o resto do CRM funciona antes do Resend ligar.
 */

const RESEND_API = "https://api.resend.com/emails";

export interface SendResendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  /** sobrescreve o RESEND_FROM padrão, se precisar */
  from?: string;
}

export interface ResendResult {
  sent: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

export async function sendResendEmail(params: SendResendEmailParams): Promise<ResendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = params.from || process.env.RESEND_FROM;

  if (!key || !from) {
    console.warn("[Resend] RESEND_API_KEY/RESEND_FROM não configurados — email não enviado (no-op).");
    return { sent: false, skipped: true };
  }

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      ...(params.replyTo ? { reply_to: params.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    const error = `Resend HTTP ${res.status}: ${text.slice(0, 200)}`;
    console.error(`[Resend] ${error}`);
    return { sent: false, error };
  }

  const data = (await res.json()) as { id?: string };
  return { sent: true, id: data.id };
}
