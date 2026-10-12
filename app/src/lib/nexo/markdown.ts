/**
 * Markdown mínimo das respostas do NEXO, em blocos tipados. Sem HTML do
 * modelo (nunca interpretado), sem link externo (só rota interna `/...`).
 * Cobre o que o modelo usa: título, parágrafo, lista, tabela, citação, régua,
 * negrito e link. O resto fica como texto.
 *
 * ponytail: parser de linha; se precisar de código/aninhamento, trocar por uma lib.
 */
export type Trecho = { texto: string; negrito?: boolean; href?: string };
export type Bloco =
  | { tipo: "titulo"; nivel: 1 | 2 | 3; trechos: Trecho[] }
  | { tipo: "paragrafo"; trechos: Trecho[] }
  | { tipo: "lista"; itens: Trecho[][] }
  | { tipo: "tabela"; cabecalho: Trecho[][]; linhas: Trecho[][][] }
  | { tipo: "citacao"; trechos: Trecho[] }
  | { tipo: "regua" };

const LINK = /\[([^\]]{1,120})\]\((\/(?!\/)[^\s)]*)\)/;

/** Negrito `**x**` e links `[x](/rota)` viram trechos; o resto é texto. */
export function trechos(linha: string): Trecho[] {
  const out: Trecho[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]{1,120})\]\((\/(?!\/)[^\s)]*)\)/g;
  let i = 0;
  for (const m of linha.matchAll(re)) {
    if (m.index! > i) out.push({ texto: linha.slice(i, m.index) });
    if (m[1] !== undefined) {
      const l = m[1].match(LINK);
      out.push(l ? { texto: l[1]!, negrito: true, href: l[2] } : { texto: m[1], negrito: true });
    } else out.push({ texto: m[2]!, href: m[3] });
    i = m.index! + m[0].length;
  }
  if (i < linha.length) out.push({ texto: linha.slice(i) });
  return out.filter((t) => t.texto.length > 0);
}

const celulas = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => trechos(c.trim()));
const ehSeparadorDeTabela = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);

export function blocos(md: string): Bloco[] {
  const linhas = md.replace(/\r/g, "").split("\n");
  const out: Bloco[] = [];
  let i = 0;
  const paragrafo: string[] = [];
  const fechaParagrafo = () => { if (paragrafo.length) { out.push({ tipo: "paragrafo", trechos: trechos(paragrafo.join(" ")) }); paragrafo.length = 0; } };
  while (i < linhas.length) {
    const l = linhas[i]!;
    const t = l.trim();
    if (!t) { fechaParagrafo(); i++; continue; }
    if (/^-{3,}$|^\*{3,}$/.test(t)) { fechaParagrafo(); out.push({ tipo: "regua" }); i++; continue; }
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) { fechaParagrafo(); out.push({ tipo: "titulo", nivel: h[1]!.length as 1 | 2 | 3, trechos: trechos(h[2]!) }); i++; continue; }
    if (t.startsWith(">")) { fechaParagrafo(); out.push({ tipo: "citacao", trechos: trechos(t.replace(/^>\s?/, "")) }); i++; continue; }
    if (t.startsWith("|") && i + 1 < linhas.length && ehSeparadorDeTabela(linhas[i + 1]!)) {
      fechaParagrafo();
      const cabecalho = celulas(t); i += 2;
      const corpo: Trecho[][][] = [];
      while (i < linhas.length && linhas[i]!.trim().startsWith("|")) { corpo.push(celulas(linhas[i]!)); i++; }
      out.push({ tipo: "tabela", cabecalho, linhas: corpo }); continue;
    }
    if (/^([-*•]|\d+[.)])\s+/.test(t)) {
      fechaParagrafo();
      const itens: Trecho[][] = [];
      while (i < linhas.length && /^([-*•]|\d+[.)])\s+/.test(linhas[i]!.trim())) { itens.push(trechos(linhas[i]!.trim().replace(/^([-*•]|\d+[.)])\s+/, ""))); i++; }
      out.push({ tipo: "lista", itens }); continue;
    }
    paragrafo.push(t); i++;
  }
  fechaParagrafo();
  return out;
}

/** Texto plano (sem marcação) para prévia e busca. */
export function textoPlano(md: string): string {
  return blocos(md).map((b) => {
    if (b.tipo === "regua") return "";
    if (b.tipo === "lista") return b.itens.map((it) => it.map((t) => t.texto).join("")).join("; ");
    if (b.tipo === "tabela") return b.linhas.map((l) => l.map((c) => c.map((t) => t.texto).join("")).join(" | ")).join("; ");
    return b.trechos.map((t) => t.texto).join("");
  }).filter(Boolean).join(" ");
}
