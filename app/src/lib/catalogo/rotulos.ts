/* ─────────────────────────────────────────────────────────────────────────
 * Como o catálogo aparece para gente: nome, variação, descrição e recorrência.
 *
 * Módulo SEM banco, de propósito: o editor de proposta e o Cliente 360 são
 * Client Components e usam as mesmas regras que a página pública, o PDF e o
 * contrato. Uma fonte só, para o mesmo item não ter três nomes.
 *
 * - Nome: o do Product no Stripe (espelhado em servicos_catalogo.nome).
 * - Variação: o apelido do Price, sem repetir o nome do produto.
 * - Descrição: a comercial do ONFACE ganha da description do Stripe.
 * ───────────────────────────────────────────────────────────────────────── */

const FAMILIAS = ["Callface AI White Label - ", "Callface AI - ", "PABX - "];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Tira `prefixo` do começo de `texto` (sem diferenciar caixa/acento) só se ele terminar numa palavra inteira. */
function tirarPrefixo(texto: string, prefixo: string): string | null {
  const p = prefixo.trim();
  if (!p || semAcento(texto).indexOf(semAcento(p)) !== 0) return null;
  const resto = texto.slice(p.length);
  if (resto && !/^[\s—–\-|·:]/.test(resto)) return null;
  return resto.replace(/^[\s—–\-|·:]+/, "").trim();
}

/**
 * O apelido do Price, legível dentro do cartão do produto.
 *
 * O Stripe guarda "PABX - Canais — 04 Canais", "PABX - Linha 4004 — Linha 4004 | Até 800min"
 * ou "PABX - BINA Inteligente — Bina Inteligente 1000 Minutos". Para quem vende,
 * a variação é "04 Canais", "Linha 4004 · Até 800min" e "1000 Minutos".
 */
export function variacaoAmigavel(produto: string, variacao: string | null | undefined): string {
  let v = (variacao ?? "").trim();
  if (!v) return "";
  const nome = produto.trim();
  const curto = FAMILIAS.reduce<string | null>((a, f) => a ?? tirarPrefixo(nome, f), null) ?? nome;

  v = tirarPrefixo(v, nome) ?? FAMILIAS.reduce<string | null>((a, f) => a ?? tirarPrefixo(v, f), null) ?? v;
  // "Linha 4004 — Linha 4004 | Até 800min": o lado esquerdo repete o direito.
  const partes = v.split(/\s+[—–]\s+/);
  if (partes.length > 1 && semAcento(partes[1]).startsWith(semAcento(partes[0]))) {
    v = [partes[0] + partes[1].slice(partes[0].length), ...partes.slice(2)].join(" — ");
  }
  // "Bina Inteligente 1000 Minutos" dentro de "PABX - BINA Inteligente": o cartão já diz BINA.
  if (curto !== nome) v = tirarPrefixo(v, curto) || v;
  return v.replace(/\s+[—–|]\s+/g, " · ").replace(/\s+/g, " ").trim();
}

/** A descrição do produto para o cliente: a comercial do ONFACE, depois a do Stripe. Nunca o sku. */
export function descricaoDoProduto(d: { comercial?: string | null; stripe?: string | null }): string {
  return d.comercial?.trim() || d.stripe?.trim() || "";
}

/** A recorrência em palavras de cliente, a partir do tipo do item e do período do Price. */
export function rotuloDaRecorrencia(tipo: string | null | undefined, periodo: string | null | undefined): string {
  if (tipo === "setup") return "Setup, pagamento único";
  if (tipo !== "recorrente") return "Pagamento único";
  return periodo === "anual" ? "Cobrança anual" : "Cobrança mensal";
}

/** O sufixo do valor recorrente: "/mês", "/ano" ou nada. */
export function sufixoDoValor(tipo: string | null | undefined, periodo: string | null | undefined): string {
  if (tipo !== "recorrente") return "";
  return periodo === "anual" ? "/ano" : "/mês";
}
