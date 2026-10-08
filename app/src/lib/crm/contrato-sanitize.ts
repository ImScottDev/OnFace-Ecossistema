import sanitizeHtml from "sanitize-html";

/**
 * Saneia o corpo do template na GRAVAÇÃO, não na exibição.
 *
 * O corpo é escrito por um admin da organização e depois renderizado para
 * outros usuários e dentro do PDF que vai ao Documenso. Limpar uma vez, na
 * entrada, mantém um ponto único: a UI, o preview e o PDF leem o que já está
 * limpo, sem cada um lembrar de sanitizar.
 *
 * O que entra é documento jurídico colado do Zoho/Word: parágrafos, quadros
 * das partes, tabelas de itens e de SLA. `<style>` e `<script>` ficam de fora
 * — o CSS de página do PDF é do CRM, e nenhum contrato precisa de script.
 */
export function sanitizarCorpoContrato(corpo: string): string {
  return sanitizeHtml(corpo, {
    allowedTags: [
      "p", "div", "span", "br", "hr", "section", "article",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "b", "strong", "i", "em", "u", "s", "sub", "sup", "small", "font",
      "ul", "ol", "li", "blockquote", "pre", "code",
      "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
      "img", "a",
    ],
    allowedAttributes: {
      "*": ["style", "class", "id", "align", "valign", "width", "height", "colspan", "rowspan", "dir", "lang"],
      table: ["border", "cellpadding", "cellspacing", "style", "class", "align", "width"],
      font: ["face", "size", "color"],
      img: ["src", "alt", "width", "height", "style"],
      a: ["href", "target", "rel", "id"],
      col: ["span", "width", "style"],
    },
    allowedSchemes: ["http", "https", "data", "mailto"],
    // Comentários do Word/Zoho só poluem o corpo salvo.
    allowedSchemesAppliedToAttributes: ["href", "src"],
    nonTextTags: ["style", "script", "textarea", "option", "noscript"],
  });
}
