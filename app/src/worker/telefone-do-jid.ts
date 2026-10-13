/**
 * Telefone real a partir dos JIDs de uma mensagem do WhatsApp. Puro.
 *
 * `@lid` é um identificador interno do WhatsApp, NÃO um telefone. Gravá-lo como
 * telefone criou conversas que nunca casam com a pessoa (363 com 14+ dígitos).
 * Sem telefone real devolve null: o chamador não grava um número inventado.
 */
export interface JidsDaMensagem {
  isFromMe: boolean;
  chat: string;
  sender?: string;
  senderAlt?: string;
  recipientAlt?: string;
}

function digitosReais(jid?: string): string | null {
  if (!jid || jid.includes("@lid")) return null;
  const d = jid.replace(/@.*$/, "").replace(/:.*$/, "");
  /* Telefone tem de 8 a 15 dígitos. Fora disso é id de canal/comunidade (120363…, 18 dígitos). */
  return /^\d{8,15}$/.test(d) ? d : null;
}

export function telefoneDoJid(m: JidsDaMensagem): string | null {
  const fontes = m.isFromMe ? [m.chat, m.recipientAlt] : [m.chat, m.sender, m.senderAlt];
  for (const f of fontes) {
    const d = digitosReais(f);
    if (d) return d;
  }
  return null;
}
