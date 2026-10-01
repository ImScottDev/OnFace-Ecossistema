/**
 * Texto vindo de integração, pronto para a tela.
 *
 * 575 das 13.388 atividades do banco têm HTML dentro de `descricao` — resíduo
 * da importação do Zoho. O React escapa tudo, então o operador lia
 * "acompanhadas de ligação primeiramente. <br>Cliente desistiu" com a tag
 * no meio da frase.
 *
 * Limpar aqui, e não em cada tela, é o que garante que nenhuma delas precise
 * lembrar: quem consome o domínio recebe texto.
 */

/** As entidades que de fato aparecem no dado importado. */
const ENTIDADES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/**
 * Converte HTML de integração em texto corrido.
 *
 * `<br>` e `</p>` viram quebra de linha porque no original ERAM quebra; as
 * outras tags só somem. Não é um parser de HTML e não precisa ser: a entrada é
 * texto que alguém digitou num editor rico, não markup arbitrário.
 */
export function textoSimples(bruto: string | null | undefined): string | null {
  if (bruto == null) return null;
  if (!bruto.includes("<") && !bruto.includes("&")) return bruto;

  const texto = bruto
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTIDADES[e.toLowerCase()] ?? e)
    // Um editor rico gera sequências de quebra que no texto viram buraco.
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return texto;
}
