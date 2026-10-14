import { fetchComPrazo } from "@/lib/rede/fetch-com-prazo";
/**
 * Catálogo comercial lido do Stripe (SPEC §23, integrações como adaptador).
 *
 * ## Por que ler e não importar de planilha
 *
 * O catálogo já existiu como snapshot commitado, gerado de uma planilha em
 * 02/09. Medido em 21/09, **19 dias depois: 171 dos 213 preços da planilha já
 * não existiam no Stripe, e 13 preços novos tinham sido criados lá**. Importar
 * aquele arquivo teria criado 171 preços fantasmas e escondido 13 reais.
 *
 * Snapshot de catálogo nasce velho. O Stripe é onde o preço é decidido e
 * cobrado, então é ele a fonte: o CRM sincroniza, não copia uma vez.
 *
 * ## O que é do Stripe e o que é do CRM
 *
 * O Stripe manda em nome, descrição, valor, moeda, recorrência e situação
 * (ativo/inativo). São as coisas que ele cobra de verdade.
 *
 * O CRM manda em ordem de exibição, rótulo de categoria, comportamento de
 * quantidade e observação operacional. São decisões de como VENDER, que o
 * Stripe não conhece, e a sincronização nunca as sobrescreve.
 *
 * ## O que ela NÃO faz
 *
 * Não inventa classificação. Produto sem `familia` na metadata do Stripe não
 * recebe uma família por semelhança de nome: entra como pendência nomeada. É a
 * mesma regra do resto do refactor, e aqui ela protege preço.
 */

const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = process.env.STRIPE_API_VERSION || "2026-08-26.dahlia";

/**
 * Prefixos que marcam o catálogo NOVO, definidos pelo Kauã.
 *
 * O Stripe tem 56 produtos ativos, e a maioria é histórica: cobranças
 * pontuais, planos de contrato antigo, itens de negociação específica. Eles
 * continuam existindo e faturando, e não devem virar item de catálogo
 * vendável. O recorte é pelo nome porque foi assim que o produto foi
 * organizado lá.
 */
export const PREFIXOS_CATALOGO = [
  "Callface AI - ",
  "Callface AI White Label - ",
  "PABX - ",
] as const;

export interface ProdutoStripe {
  id: string;
  nome: string;
  descricao: string | null;
  descricaoExtrato: string | null;
  etiquetaUnidade: string | null;
  ativo: boolean;
  metadata: Record<string, string>;
}

export interface PrecoStripe {
  id: string;
  produtoId: string;
  /** `unit_amount`. null = o price não tem valor unitário (escalonado/tiered): NUNCA tratar como zero. */
  valorCentavos: number | null;
  moeda: string;
  recorrente: boolean;
  intervalo: "month" | "year" | null;
  intervaloContagem: number | null;
  apelido: string | null;
  lookupKey: string | null;
  ativo: boolean;
  /** `billing_scheme === "tiered"` ou `tiers_mode` presente: o valor depende da quantidade. */
  escalonado?: boolean;
  /** Divisor de quantidade do Stripe: 1 unidade cobrada a cada N do cliente. */
  divideQuantidadePor: number | null;
  metadata: Record<string, string>;
}

export interface CatalogoStripe {
  produtos: ProdutoStripe[];
  precos: PrecoStripe[];
  lidoEm: Date;
}

/** Price escalonado: não tem `unit_amount`, o valor sai de faixas. Regra única (o portal de planos usa a mesma). */
export function ehPrecoEscalonado(p: { billing_scheme?: string | null; tiers_mode?: string | null }): boolean {
  return p.billing_scheme === "tiered" || !!p.tiers_mode;
}

function chave(): string {
  const k = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY;
  if (!k) {
    throw new Error(
      "STRIPE_SECRET_KEY/STRIPE_API_KEY não configurada: sem ela não há catálogo para sincronizar. " +
      "Isto é configuração ausente, não integração quebrada.",
    );
  }
  return k;
}

/** Percorre a paginação do Stripe até o fim. Página só é detalhe de transporte. */
type BrutoStripe = Record<string, unknown> & { id: string };

async function listarTudo<T extends BrutoStripe>(
  caminho: string, params: Record<string, string>,
): Promise<T[]> {
  const itens: T[] = [];
  let startingAfter: string | null = null;

  // Teto de segurança: catálogo que passe disto é sinal de filtro errado, e
  // laço infinito contra API paga é pior que erro.
  for (let pagina = 0; pagina < 40; pagina++) {
    const q = new URLSearchParams({ ...params, limit: "100" });
    if (startingAfter) q.set("starting_after", startingAfter);

    const r = await fetchComPrazo(`${STRIPE_API}/${caminho}?${q}`, {
      headers: { Authorization: `Bearer ${chave()}`, "Stripe-Version": STRIPE_API_VERSION },
    });
    if (!r.ok) {
      throw new Error(`Stripe ${caminho}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
    }
    const corpo = await r.json() as { data: T[]; has_more: boolean };
    itens.push(...corpo.data);
    if (!corpo.has_more || corpo.data.length === 0) return itens;
    startingAfter = corpo.data[corpo.data.length - 1].id;
  }
  throw new Error(`Stripe ${caminho}: mais de 40 páginas, provavelmente filtro errado`);
}

/** Prefixo do catálogo NOVO: só decide a família quando a metadata não diz; não filtra mais o espelho. */
export function ehProdutoDeCatalogo(nome: string): boolean {
  return PREFIXOS_CATALOGO.some((p) => nome.startsWith(p));
}

/**
 * Lê o catálogo do Stripe: TODOS os Products com ao menos um Price.
 *
 * Antes só os 3 prefixos de nome entravam, e os Products que faturam fora
 * deles (SETUP, CALLFACE AI, AGENTE DE IA...) ficavam invisíveis ao ONFACE.
 * Sem `metadata.familia` nem prefixo, o produto é espelhado com família
 * UNKNOWN: aparece no financeiro, mas fora do construtor de proposta (que só
 * oferece famílias classificadas) até alguém preencher a metadata no Stripe.
 *
 * Inclui INATIVOS de propósito: preço desativado lá precisa ser desativado
 * aqui, e para isso a sincronização tem que enxergá-lo. Sumir da lista e sumir
 * do catálogo são coisas diferentes.
 */
export async function lerCatalogoDoStripe(): Promise<CatalogoStripe> {
  const brutosProduto = await listarTudo<BrutoStripe>("products", {});
  const produtos: ProdutoStripe[] = brutosProduto
    .map((p) => ({
      id: String(p.id),
      nome: String(p.name ?? ""),
      descricao: (p.description as string) ?? null,
      descricaoExtrato: (p.statement_descriptor as string) ?? null,
      etiquetaUnidade: (p.unit_label as string) ?? null,
      ativo: Boolean(p.active),
      metadata: (p.metadata as Record<string, string>) ?? {},
    }));

  const brutosPreco = await listarTudo<BrutoStripe>("prices", {});
  const comPreco = new Set(brutosPreco.map((p) => String(p.product)));
  const idsProduto = new Set(produtos.filter((p) => comPreco.has(p.id)).map((p) => p.id));
  const precos: PrecoStripe[] = brutosPreco
    .filter((p) => idsProduto.has(String(p.product)))
    .map((p) => {
      const rec = p.recurring as { interval?: string; interval_count?: number } | null;
      const tq = p.transform_quantity as { divide_by?: number } | null;
      return {
        id: String(p.id),
        produtoId: String(p.product),
        valorCentavos: p.unit_amount == null ? null : Number(p.unit_amount),
        escalonado: ehPrecoEscalonado(p as { billing_scheme?: string; tiers_mode?: string }),
        moeda: String(p.currency ?? "brl").toUpperCase(),
        recorrente: p.type === "recurring",
        intervalo: (rec?.interval as "month" | "year") ?? null,
        intervaloContagem: rec?.interval_count ?? null,
        apelido: (p.nickname as string) ?? null,
        lookupKey: (p.lookup_key as string) ?? null,
        ativo: Boolean(p.active),
        divideQuantidadePor: tq?.divide_by ?? null,
        metadata: (p.metadata as Record<string, string>) ?? {},
      };
    });

  // Produto sem nenhum Price não fatura nem se vende: não polui o espelho.
  return { produtos: produtos.filter((p) => idsProduto.has(p.id)), precos, lidoEm: new Date() };
}
