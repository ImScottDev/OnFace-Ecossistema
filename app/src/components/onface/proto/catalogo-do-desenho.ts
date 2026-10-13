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
import { variacaoAmigavel } from "@/lib/catalogo/rotulos";

/** Um preço na forma do desenho. */
export interface PrecoDoDesenho {
  /** `catalogoPrecoId`: é ELE que `acaoCriar` exige por item. */
  id: string;
  v: number;
  /** "mes" | "ano" | "avulso" — o desenho decide o rótulo e a natureza por aqui. */
  int: "mes" | "ano" | "avulso";
  d: string;
  /** A variação sem a recorrência ("04 Canais"): o seletor mostra a recorrência num selo à parte. */
  variacao?: string;
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
  // O período do Price manda: locação de hardware é HARDWARE e mesmo assim é cobrada todo mês.
  if (item.periodo === "anual") return "ano";
  if (item.periodo === "mensal") return "mes";
  if (item.periodo === "unico") return "avulso";
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
export function variacaoDoPreco(item: ItemCatalogo): string {
  const bruto = (item.variacao ?? "").trim();
  const chave = (item.lookupKey ?? "").replace(/_/g, " ").trim().toLowerCase();
  // Variação que é o lookup_key cru nunca vai para a tela: o período diz o que ela é.
  if (!bruto || (chave && bruto.toLowerCase() === chave)) {
    return item.periodo === "anual" ? "Anual" : item.periodo === "mensal" ? "Mensal" : item.periodo === "unico" ? "Avulso" : "Padrão";
  }
  return variacaoAmigavel(item.nome, bruto) || bruto;
}

export function rotuloDoPreco(item: ItemCatalogo): string {
  const rotulo = variacaoDoPreco(item);
  if (rotulo === "Padrão") return rotulo;
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
        variacao: variacaoDoPreco(item),
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

/* ── O seletor do catálogo (sanfona) ───────────────────────────────────── */

/** Os grupos do seletor, na ordem em que se vende: plano, adicional, setup, equipamento. */
export const GRUPOS_DO_SELETOR: Array<{ tipo: ProdutoDoDesenho["tipo"]; titulo: string }> = [
  { tipo: "plano", titulo: "Planos e serviços recorrentes" },
  { tipo: "pacote", titulo: "Adicionais e consumo" },
  { tipo: "setup", titulo: "Setup e implantação" },
  { tipo: "hardware", titulo: "Equipamentos" },
];

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface ProdutoNoSeletor {
  produto: ProdutoDoDesenho;
  /** As variações que aparecem: todas, ou só as que casam com a busca. */
  precos: PrecoDoDesenho[];
  /** Busca ativa abre o produto que casou, para a variação ficar à mão. */
  aberto: boolean;
}

/**
 * Filtra e agrupa o catálogo para o seletor.
 *
 * Sem busca: todos os produtos, fechados, agrupados pelo tipo. Com busca: o
 * produto que casa pelo nome ou pela descrição entra com todas as variações; o
 * que casa só por uma variação entra com as variações que casaram. Os dois
 * entram abertos. Cada palavra da busca precisa aparecer (sem acento, sem caixa).
 */
export function catalogoDoSeletor(
  produtos: ProdutoDoDesenho[],
  busca: string,
  abertoId: string | null,
): Array<{ titulo: string; produtos: ProdutoNoSeletor[] }> {
  const termos = normal(busca).split(/\s+/).filter(Boolean);
  const casa = (texto: string) => termos.every((t) => normal(texto).includes(t));

  const visiveis: ProdutoNoSeletor[] = [];
  for (const p of produtos) {
    if (!termos.length) { visiveis.push({ produto: p, precos: p.precos, aberto: p.id === abertoId }); continue; }
    if (casa(`${p.nome} ${p.desc}`)) { visiveis.push({ produto: p, precos: p.precos, aberto: true }); continue; }
    const precos = p.precos.filter((x) => casa(`${p.nome} ${x.variacao ?? x.d}`));
    if (precos.length) visiveis.push({ produto: p, precos, aberto: true });
  }

  return GRUPOS_DO_SELETOR
    .map((g) => ({ titulo: g.titulo, produtos: visiveis.filter((v) => v.produto.tipo === g.tipo) }))
    .filter((g) => g.produtos.length > 0);
}
