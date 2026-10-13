/**
 * Domínio de e-mail como pista de empresa. Puro (sem banco) para ser testável.
 *
 * Regra de ouro: domínio de provedor público NUNCA identifica empresa (um lead do
 * Gmail não pode virar cliente de outra empresa), e domínio que aponta para mais
 * de uma empresa não resolve sozinho: fica para decisão humana.
 */

const DOMINIOS_PUBLICOS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.com.br", "outlook.com", "outlook.com.br",
  "live.com", "live.com.br", "msn.com", "yahoo.com", "yahoo.com.br", "ymail.com", "uol.com.br",
  "bol.com.br", "terra.com.br", "globo.com", "globomail.com", "icloud.com", "me.com", "mac.com",
  "aol.com", "protonmail.com", "proton.me", "pm.me", "mail.com", "gmx.com", "zoho.com",
  "yandex.com", "ig.com.br", "r7.com", "oi.com.br", "zipmail.com.br",
]);

/** "João@Gmail.com", "https://www.acme.com.br/x" ou "acme.com.br" -> domínio limpo, ou null. */
export function normalizarDominio(valor?: string | null): string | null {
  let d = valor?.trim().toLowerCase();
  if (!d) return null;
  if (d.includes("@")) d = d.split("@").pop()!;
  d = d.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");
  return d.includes(".") ? d : null;
}

export function dominioPublico(valor?: string | null): boolean {
  const d = normalizarDominio(valor);
  return !d || DOMINIOS_PUBLICOS.has(d);
}

/** Domínio que serve como identificador de empresa; null para provedor público. */
export function dominioCorporativo(email?: string | null): string | null {
  const d = normalizarDominio(email);
  return d && !DOMINIOS_PUBLICOS.has(d) ? d : null;
}

/** O id só sai quando os candidatos distintos são exatamente UM. Ambíguo ou vazio: null. */
export function empresaUnicaDoDominio(dominio: string | null | undefined, candidatos: string[]): string | null {
  if (dominioPublico(dominio)) return null;
  const distintos = [...new Set(candidatos)];
  return distintos.length === 1 ? distintos[0] : null;
}
