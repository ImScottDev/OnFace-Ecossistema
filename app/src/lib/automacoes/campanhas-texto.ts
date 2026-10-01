/**
 * Partes puras do disparo de campanha (sem db), para o worker e para teste.
 */

/** `{{nome}}` e `{{empresa}}`; variável sem valor vira vazio, nunca "{{nome}}" cru na mensagem. */
export function personalizar(texto: string, vars: { nome?: string | null; empresa?: string | null }): string {
  const primeiroNome = (vars.nome ?? "").trim().split(/\s+/)[0] ?? "";
  return texto
    .replace(/\{\{\s*nome\s*\}\}/gi, primeiroNome)
    .replace(/\{\{\s*empresa\s*\}\}/gi, (vars.empresa ?? "").trim());
}

/** O corpo é HTML (feito para e-mail); WhatsApp recebe o texto com as quebras de parágrafo. */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Erro da allowlist (lib/whatsapp/client.ts) é bloqueio do ambiente, não falha de envio. */
export function classificarErroEnvio(e: unknown): { status: "bloqueado" | "falhou"; erro: string } {
  const msg = e instanceof Error ? e.message : String(e);
  if (/allowlist/i.test(msg)) return { status: "bloqueado", erro: "Bloqueado pela allowlist deste ambiente (WHATSAPP_ALLOWLIST): nada saiu." };
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|timed? ?out|aborted/i.test(msg)) {
    return { status: "falhou", erro: `Serviço de envio inacessível (${msg.slice(0, 80)}): a mensagem não saiu.` };
  }
  return { status: "falhou", erro: msg.slice(0, 300) };
}
