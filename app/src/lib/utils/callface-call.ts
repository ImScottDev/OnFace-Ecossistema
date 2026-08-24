/**
 * URL do webphone da Callface que já inicia a ligação ao abrir
 * (`?call_to=<DDD+número, SEM código de país>`). Abrir em nova aba/janela —
 * não navega pra fora do CRM. O resultado da chamada volta sozinho pelo
 * webhook de saída, independente de como a ligação foi originada (discador
 * manual, teclado, ou este deep link) — não precisa de nenhum retorno
 * síncrono aqui.
 *
 * NÃO usar `normalizePhone` (lib/whatsapp/phone-utils) aqui — aquela função
 * prefixa "55" pro WhatsApp, mas a Callface já prefixa "55" sozinha no
 * backend dela. Bug real encontrado 23/07: número com DDD 19 virava um
 * número com "55" duplicado e discava errado. A Callface espera só
 * DDD+número puro (ex: 11987654321), mesmo formato usado no upload de
 * planilha de campanha (ver lib/integrations/callpilot-trigger.ts).
 */
/** DDD+número puro, sem código de país — mesma normalização usada pelo
 * webphone da Callface. Extraído pra reusar tanto no deep link direto
 * (`callfaceCallUrl`) quanto no prefill do discador interno (`Cf2Dialer`,
 * via `/atendimento?canal=ligacao&telefone=...`). */
export function digitsForDialer(telefone: string): string {
  return telefone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
}

export function callfaceCallUrl(telefone: string): string {
  return `https://app.callface.ai/calls?call_to=${digitsForDialer(telefone)}`;
}
