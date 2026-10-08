import { sql } from "drizzle-orm";
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

/**
 * Nome + sobrenome sem repetir. A carga trouxe "Lucas" + "Lucas Oliveira"
 * (1.069 leads) e `concat_ws` virava "Lucas Lucas Oliveira" na tela.
 */
export function nomeCompleto(nome: string | null | undefined, sobrenome: string | null | undefined): string {
  const n = (nome ?? "").trim();
  const s = (sobrenome ?? "").trim();
  if (!s) return n;
  if (!n) return s;
  const ln = n.toLowerCase();
  const ls = s.toLowerCase();
  if (ls === ln || ls.startsWith(ln + " ")) return s;
  if (ln.endsWith(" " + ls)) return n;
  return `${n} ${s}`;
}

/**
 * MEI vem do cadastro como "63.638.421 Anne Camille ..." (base do CNPJ + nome do titular) e a
 * tela mostrava o número como se fosse parte do nome. O dado fica como está (é o que a Receita
 * devolve); só a LEITURA tira o prefixo. Uso em SQL: `${nomeEmpresaSql("e.nome")}`.
 */
const PREFIXO_CNPJ = /^\d{2}\.\d{3}\.\d{3}\s+/;
export function nomeEmpresaExibivel(nome: string | null | undefined): string {
  const n = (nome ?? "").trim();
  const limpo = n.replace(PREFIXO_CNPJ, "");
  return limpo || n;
}
export function nomeEmpresaSql(coluna: string) {
  return sql.raw(`regexp_replace(${coluna}, '^[0-9]{2}[.][0-9]{3}[.][0-9]{3}[[:space:]]+', '')`);
}
