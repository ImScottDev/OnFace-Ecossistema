/**
 * Regras comerciais da proposta numa camada só.
 *
 * A Server Action, o núcleo (`proposta-criacao.ts`) e a rota Hono
 * (`api-server/routes/propostas.ts`) passam por aqui; ninguém recalcula
 * subtotal por conta própria. Módulo puro (sem banco) para ser testável.
 */
import { RegraDeNegocio } from "@/lib/vendas/dominio";

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
