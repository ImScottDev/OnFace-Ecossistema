/**
 * Trava de destino de e-mail para ambientes que não são produção (par da
 * WHATSAPP_ALLOWLIST). Com EMAIL_ALLOWED_DOMAINS="callface.ai", qualquer envio
 * (Resend, Outlook, Gmail, SMTP/IMAP e convite de assinatura do Documenso) cujo
 * destinatário esteja fora do domínio lança ANTES de sair da aplicação.
 * Sem a variável, nada muda: produção não define.
 */
function dominiosPermitidos(): string[] {
  return (process.env.EMAIL_ALLOWED_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

/** Aceita "a@x.com", "Nome <a@x.com>" e listas separadas por vírgula ou ponto e vírgula. */
function enderecos(valor: string | string[] | undefined | null): string[] {
  if (!valor) return [];
  const partes = Array.isArray(valor) ? valor : valor.split(/[;,]/);
  return partes
    .map((p) => (p.match(/<([^>]+)>/)?.[1] ?? p).trim().toLowerCase())
    .filter(Boolean);
}

export function garantirDestinoPermitido(...destinos: Array<string | string[] | undefined | null>): void {
  const permitidos = dominiosPermitidos();
  if (permitidos.length === 0) return;
  const fora = destinos.flatMap(enderecos).filter((e) => !permitidos.some((d) => e.endsWith(`@${d}`)));
  if (fora.length > 0) {
    throw new Error(`E-mail bloqueado pela trava do ambiente: ${fora.join(", ")} fora de EMAIL_ALLOWED_DOMAINS (${permitidos.join(", ")})`);
  }
}
