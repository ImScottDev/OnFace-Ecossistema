/* ─────────────────────────────────────────────────────────────────────────
 * O catálogo comercial na forma que o Builder de proposta consome.
 *
 * O protótipo traz o catálogo HARDCODED dentro de `catalogo()`, com preços
 * concretos. Eles não batem com o banco — o Agente IA está R$ 349,90 no mock e
 * R$ 500,00 no catálogo real — e uma proposta criada com preço de mock é um
 * compromisso com o cliente por um valor que a empresa não pratica.
 *
 * Por isso a tradução mora aqui e o método do protótipo é sobrescrito: o
 * arquivo gerado não se edita, e o preço não se adivinha.
 * ───────────────────────────────────────────────────────────────────────── */

import type { ItemCatalogo } from "@/lib/vendas/propostas";

/** Um preço na forma do desenho. */
export interface PrecoDoDesenho {
  /** `catalogoPrecoId`: é ELE que `acaoCriar` exige por item. */
  id: string;
  v: number;
  /** "mes" | "ano" | "avulso" — o desenho decide o rótulo e a natureza por aqui. */
  int: "mes" | "ano" | "avulso";
  d: string;
  padrao: 0 | 1;
  min: number | null;
  max: number | null;
}

/** Um produto na forma do desenho. */
export interface ProdutoDoDesenho {
  id: string;
  nome: string;
  desc: string;
  tipo: "plano" | "setup" | "hardware" | "pacote";
  unidade: string;
  qtd: number;
  inicial: boolean;
  precos: PrecoDoDesenho[];
}

/**
 * O intervalo de cobrança, lido da variação.
 *
 * O banco marca "Full — Mensal" e "Full — Anual" as duas como `MRR`: a
 * natureza da receita é a mesma, o que muda é a periodicidade. Quem sabe disso
 * é o texto da variação, então é dele que o intervalo sai.
 */
function intervaloDe(item: ItemCatalogo): PrecoDoDesenho["int"] {
  // `MRR` é a ÚNICA natureza recorrente do domínio (`NATUREZAS_RECEITA`): o
  // anual também é MRR, e o que o distingue é a variação, não a natureza.
  if (item.naturezaReceita !== "MRR") return "avulso";
  if (item.periodo === "anual") return "ano";
  if (item.periodo === "mensal") return "mes";
  return /anual|\bano\b/i.test(item.variacao ?? "") ? "ano" : "mes";
}

/** O tipo do produto, que decide o ícone e o agrupamento na tela. */
function tipoDe(natureza: ItemCatalogo["naturezaReceita"]): ProdutoDoDesenho["tipo"] {
  if (natureza === "SETUP") return "setup";
  if (natureza === "HARDWARE") return "hardware";
  if (natureza === "MRR") return "plano";
  return "pacote";
}

/**
 * O rótulo do preço.
 *
 * A variação do banco às vezes repete o nome do serviço inteiro
 * ("Callface AI - Full — Mensal"). Dentro do cartão do produto, que já mostra
 * o nome, isso vira ruído — fica só o que distingue um preço do outro.
 */
export function rotuloDoPreco(item: ItemCatalogo): string {
  const bruto = (item.variacao ?? "").trim();
  const chave = (item.lookupKey ?? "").replace(/_/g, " ").trim().toLowerCase();
  // Variação que é o lookup_key cru nunca vai para a tela: o período diz o que ela é.
  if (!bruto || (chave && bruto.toLowerCase() === chave)) {
    return item.periodo === "anual" ? "Anual" : item.periodo === "mensal" ? "Mensal" : item.periodo === "unico" ? "Avulso" : "Padrão";
  }
  const semONome = bruto.startsWith(item.nome)
    ? bruto.slice(item.nome.length).replace(/^\s*[—–-]\s*/, "").trim()
    : bruto;
  const rotulo = semONome || bruto;
  // Recorrente vs avulso sempre visível: setup/one-time não é MRR.
  if (/mensal|anual|avulso|\bano\b|\bm[eê]s\b/i.test(rotulo)) return rotulo;
  const int = intervaloDe(item);
  return `${rotulo} · ${int === "mes" ? "mensal" : int === "ano" ? "anual" : "avulso"}`;
}

/**
 * Agrupa os preços por serviço e devolve o catálogo por família.
 *
 * O desenho quer `{ CALLFACE_AI: [...], PABX: [...] }` com um produto por
 * serviço e os preços dele dentro — é assim que o cartão oferece Mensal e
 * Anual sem virar dois produtos.
 */
export function catalogoDoDesenho(
  porFamilia: Record<string, ItemCatalogo[]>,
): Record<string, ProdutoDoDesenho[]> {
  const saida: Record<string, ProdutoDoDesenho[]> = {};

  for (const [familia, itens] of Object.entries(porFamilia)) {
    const porServico = new Map<string, ProdutoDoDesenho>();

    for (const item of itens) {
      let p = porServico.get(item.servicoCatalogoId);
      if (!p) {
        p = {
          id: item.servicoCatalogoId,
          nome: item.nome,
          desc: item.descricao?.trim() ?? "",
          tipo: tipoDe(item.naturezaReceita),
          unidade: "un.",
          qtd: 1,
          inicial: false,
          precos: [],
        };
        porServico.set(item.servicoCatalogoId, p);
      }
      // Um serviço com preço recorrente é um plano, mesmo que a primeira
      // linha vista tenha sido a avulsa.
      if (p.tipo === "pacote" && tipoDe(item.naturezaReceita) === "plano") p.tipo = "plano";

      const novo = {
        id: item.catalogoPrecoId,
        v: Number(item.valor),
        int: intervaloDe(item),
        d: rotuloDoPreco(item),
        padrao: 0 as const,
        min: null,
        max: null,
      };
      // Dois Prices que o vendedor não distingue (mesmo rótulo, valor e recorrência) viram uma escolha só.
      if (p.precos.some((x) => x.d === novo.d && x.v === novo.v && x.int === novo.int)) continue;
      p.precos.push(novo);
    }

    for (const p of porServico.values()) {
      /* O padrão é o mensal, porque é o que se vende. Sem nenhum recorrente,
         o primeiro serve — o que não pode é nenhum preço marcado, que deixaria
         o cartão sem valor escolhido. */
      const mensal = p.precos.find((x) => x.int === "mes");
      (mensal ?? p.precos[0]).padrao = 1;
    }

    saida[familia] = [...porServico.values()];
  }

  return saida;
}
