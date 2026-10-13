/**
 * Regras comerciais da proposta numa camada só.
 *
 * A Server Action, o núcleo (`proposta-criacao.ts`) e a rota Hono
 * (`api-server/routes/propostas.ts`) passam por aqui; ninguém recalcula
 * subtotal por conta própria. Módulo puro (sem banco) para ser testável.
 */
import { RegraDeNegocio, VALIDADES_PROPOSTA } from "@/lib/vendas/dominio";

export interface ItemParaCalculo {
  nome?: string;
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  descontoTipo?: string;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;
const finito = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * Valida o item e devolve o subtotal em reais, nunca negativo.
 * quantidade > 0; valor e desconto >= 0; % <= 100; desconto em valor <= bruto.
 */
export function subtotalValidado(item: ItemParaCalculo): number {
  const rotulo = item.nome ? ` "${item.nome}"` : "";
  const { quantidade: q, valorUnitario: u, desconto: d } = item;
  if (!finito(q) || q <= 0) throw new RegraDeNegocio("item_quantidade_invalida", `Item${rotulo}: a quantidade precisa ser maior que zero.`);
  if (!finito(u) || u < 0) throw new RegraDeNegocio("item_valor_invalido", `Item${rotulo}: o valor não pode ser negativo.`);
  if (!finito(d) || d < 0) throw new RegraDeNegocio("item_desconto_invalido", `Item${rotulo}: o desconto não pode ser negativo.`);
  const tipo = item.descontoTipo ?? "percentual";
  if (tipo !== "percentual" && tipo !== "valor") throw new RegraDeNegocio("item_desconto_invalido", `Item${rotulo}: tipo de desconto desconhecido.`);
  const bruto = arredondar(q * u);
  if (tipo === "percentual") {
    if (d > 100) throw new RegraDeNegocio("item_desconto_maior_que_total", `Item${rotulo}: o desconto não pode passar de 100%.`);
    return arredondar(q * u * (1 - d / 100));
  }
  if (d > bruto) throw new RegraDeNegocio("item_desconto_maior_que_total", `Item${rotulo}: o desconto (R$ ${d.toFixed(2)}) não pode passar do valor do item (R$ ${bruto.toFixed(2)}).`);
  return arredondar(q * u - d);
}

/** Subtotal de cada linha + totais por natureza, já validados. */
export function calcularItens<T extends ItemParaCalculo & { tipo: string; ordem?: number }>(itens: T[]) {
  if (itens.length === 0) throw new RegraDeNegocio("proposta_sem_itens", "A proposta precisa de pelo menos um item.");
  let totalRecorrente = 0, totalAvulso = 0;
  const calculados = itens.map((item, idx) => {
    const subtotal = subtotalValidado(item);
    if (item.tipo === "recorrente") totalRecorrente += subtotal; else totalAvulso += subtotal;
    return { ...item, subtotal, ordem: item.ordem ?? idx };
  });
  return { itens: calculados, totalRecorrente: arredondar(totalRecorrente), totalAvulso: arredondar(totalAvulso), totalGeral: arredondar(totalRecorrente + totalAvulso) };
}

/* ── Moeda e validade: uma política só para action, núcleo e rota ──────── */

/** Moedas que o catálogo e o Stripe suportam hoje. As demais são recusadas com erro claro. */
export const MOEDAS_SUPORTADAS = ["BRL"] as const;

export function validarMoeda(moeda: unknown): string {
  const m = typeof moeda === "string" ? moeda.trim().toUpperCase() : "";
  if (!(MOEDAS_SUPORTADAS as readonly string[]).includes(m)) {
    throw new RegraDeNegocio("moeda_nao_suportada", `Moeda "${String(moeda)}" não suportada. Hoje o catálogo e o Stripe trabalham só em ${MOEDAS_SUPORTADAS.join(", ")}.`);
  }
  return m;
}

/** Mesma lista do envio pelo módulo Vendas (`VALIDADES_PROPOSTA`): 7, 14, 22 ou 30 dias. */
export const VALIDADE_PADRAO_DIAS = 14;

const MS_DIA = 86_400_000;
const isoDia = (d: Date) => d.toISOString().slice(0, 10);

/** Data de validade padrão (hoje + 14 dias), substituindo o antigo +10 do envio legado. */
export function dataValidadePadrao(hoje: Date = new Date()): string {
  return isoDia(new Date(hoje.getTime() + VALIDADE_PADRAO_DIAS * MS_DIA));
}

/**
 * Uma data de validade informada diretamente (API): data válida, não passada,
 * no máximo na maior validade da política (30 dias). Devolve YYYY-MM-DD.
 */
export function validarDataValidade(data: string, hoje: Date = new Date()): string {
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(data) && isoDia(new Date(`${data}T00:00:00Z`)) === data;
  const maximo = Math.max(...VALIDADES_PROPOSTA);
  if (!ok) throw new RegraDeNegocio("validade_invalida", "Validade inválida: use uma data no formato AAAA-MM-DD.");
  if (data < isoDia(hoje)) throw new RegraDeNegocio("validade_invalida", "A validade não pode estar no passado.");
  if (data > isoDia(new Date(hoje.getTime() + maximo * MS_DIA))) {
    throw new RegraDeNegocio("validade_invalida", `A validade máxima é de ${maximo} dias.`);
  }
  return data;
}
