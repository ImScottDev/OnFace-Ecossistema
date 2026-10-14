/**
 * Assinatura da caixa (Ajustes > E-mail > Assinatura): "adicionada automaticamente
 * ao final de cada e-mail enviado". Antes só era gravada e devolvida pela API;
 * nenhum envio a lia. Aceita HTML ou texto puro (quebra de linha vira <br>).
 */
const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

export function comAssinatura(html: string, assinatura: string | null | undefined): string {
  const a = (assinatura ?? "").trim();
  if (!a) return html;
  if (html.includes(a)) return html; // já veio no corpo: não duplica
  const bloco = /<[a-z][\s\S]*>/i.test(a)
    ? a
    : a.replace(/[&<>]/g, (c) => ESCAPES[c]).replace(/\r?\n/g, "<br>");
  return `${html}<br><br>${bloco}`;
}
