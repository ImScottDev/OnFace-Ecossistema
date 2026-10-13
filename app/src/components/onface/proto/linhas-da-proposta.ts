/* ─────────────────────────────────────────────────────────────────────────
 * As linhas da proposta: o mesmo produto entra quantas vezes for preciso.
 *
 * Um produto do catálogo (Ramal, Hardware, Minutos...) tem várias variantes,
 * e na venda cada variante é uma linha com quantidade, valor e desconto
 * próprios. Nada aqui impede repetir: só decide COM QUAL variante a linha
 * nova nasce e COMO ela se chama.
 * ───────────────────────────────────────────────────────────────────────── */

import type { PrecoDoDesenho, ProdutoDoDesenho } from "./catalogo-do-desenho";
import type { ItemParaCriar } from "./PropostaProto";

/** Produto com preço por faixa: o preço segue a quantidade, não é uma escolha. */
export function ehPorFaixa(p: Pick<ProdutoDoDesenho, "precos">): boolean {
  return p.precos.some((x) => x.min != null);
}

/**
 * O preço da linha nova de um produto.
 *
 * A primeira linha nasce no preço padrão. As seguintes nascem na próxima
 * variante que ainda não tem linha (clicar três vezes em Hardware dá três
 * aparelhos diferentes); quando todas já têm, volta ao padrão. Por faixa, o
 * preço é sempre o padrão: quem manda é a quantidade.
 */
export function precoDaNovaLinha(
  p: Pick<ProdutoDoDesenho, "id" | "precos">,
  linhas: Array<{ prod?: string; preco?: string }>,
  padrao: PrecoDoDesenho,
): PrecoDoDesenho {
  if (ehPorFaixa(p)) return padrao;
  const usados = new Set(linhas.filter((l) => l.prod === p.id).map((l) => l.preco));
  if (usados.size === 0) return padrao;
  return p.precos.find((x) => !usados.has(x.id)) ?? padrao;
}

/**
 * O nome que a linha leva: o do produto e, quando ele tem mais de uma
 * variante, a variante. É o que separa duas linhas do mesmo produto na
 * tela, no contrato e no e-mail, que só mostram o nome.
 */
export function nomeDaLinha(p: Pick<ProdutoDoDesenho, "nome" | "precos">, pr: Pick<PrecoDoDesenho, "d">): string {
  return p.precos.length > 1 && !ehPorFaixa(p) ? `${p.nome} · ${pr.d}` : p.nome;
}

/**
 * O nome depois de trocar a variante da linha. Só acompanha a troca quando o
 * nome ainda é o automático: o que o vendedor escreveu à mão não se mexe.
 */
export function nomeAposTrocarVariante(
  p: Pick<ProdutoDoDesenho, "nome" | "precos">,
  nomeAtual: string,
  de: Pick<PrecoDoDesenho, "d"> | undefined,
  para: Pick<PrecoDoDesenho, "d">,
): string {
  const atual = (nomeAtual || "").trim();
  const automatico = atual === p.nome || (!!de && atual === nomeDaLinha(p, de));
  return automatico ? nomeDaLinha(p, para) : nomeAtual;
}

/* ── Proposta do desenho → entrada do command ──────────────────────────── */

/**
 * O tipo do item, no vocabulário de `acaoCriar`.
 *
 * O desenho carrega a natureza que ele mesmo derivou do intervalo; o command
 * quer três valores. Mensal e anual são os dois recorrentes.
 */
function tipoDoItem(natureza: string): ItemParaCriar["tipo"] {
  // O desenho deriva ARR do intervalo anual; o domínio não tem essa natureza —
  // anual é MRR com periodicidade diferente, e os dois são recorrentes.
  if (natureza === "MRR" || natureza === "ARR") return "recorrente";
  if (natureza === "SETUP") return "setup";
  return "avulso";
}

/**
 * Os itens da proposta montada, prontos para o command.
 *
 * Item sem `preco` é recusado em vez de enviado com id vazio: `catalogoPrecoId`
 * é o que amarra a linha da proposta ao preço praticado, e sem ele a proposta
 * nasce sem origem de valor.
 */
export function itensParaCriar(itens: any[]): {
  itens: Array<Omit<ItemParaCriar, "catalogoPrecoId"> & { catalogoPrecoId: string; itemExistenteId?: string | null }>;
  semPreco: string[];
} {
  const bons: Array<Omit<ItemParaCriar, "catalogoPrecoId"> & { catalogoPrecoId: string; itemExistenteId?: string | null }> = [];
  const semPreco: string[] = [];

  for (const it of itens ?? []) {
    if (!it?.preco) { semPreco.push(it?.nome ?? "item sem nome"); continue; }
    // "item:<id>" é linha de proposta legada, que não tem preço no catálogo: a ação a mantém.
    const legado = String(it.preco).startsWith("item:");
    bons.push({
      catalogoPrecoId: legado ? "" : String(it.preco),
      itemExistenteId: legado ? String(it.preco).slice(5) : null,
      nome: String(it.nome ?? "").trim(),
      descricao: String(it.desc ?? "").trim() || null,
      tipo: tipoDoItem(String(it.natureza ?? "")),
      quantidade: Number(it.qtd) || 1,
      valorUnitario: Number(it.valor) || 0,
      // O desenho guarda desconto em % ou em R$; o command quer o valor da LINHA, nunca acima do que ela vale.
      desconto: Math.min(
        (Number(it.valor) || 0) * (Number(it.qtd) || 1),
        it.descTipo === "pct"
          ? ((Number(it.valor) || 0) * (Number(it.qtd) || 1) * (Number(String(it.descVal).replace(",", ".")) || 0)) / 100
          : Number(String(it.descVal).replace(",", ".")) || 0,
      ),
    });
  }

  return { itens: bons, semPreco };
}
