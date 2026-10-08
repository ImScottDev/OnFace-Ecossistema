import { escaparHtml } from "@/lib/crm/contrato-variaveis";

export interface ItemContrato {
  nome: string;
  descricao?: string | null;
  tipo: string;
  quantidade?: string | number | null;
  valorUnitario?: string | number | null;
  subtotal?: string | number | null;
}

export function moeda(valor: number, codigo = "BRL"): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: codigo || "BRL" });
}

/**
 * Uma `<tr>` por item, para dentro do `<tbody>` do modelo. Com recorrência são
 * 6 colunas (Item, Descrição, Recorrência, Quantidade, Preço unitário, Total,
 * como no White Label); sem, 5.
 */
export function linhasDeItens(itens: ItemContrato[], tipos: string[], opts: { comRecorrencia: boolean; familia?: string | null; moeda?: string }): string {
  return itens
    .filter((item) => tipos.includes(item.tipo))
    .map((item) => `<tr>${[
      item.nome,
      item.descricao || "—",
      ...(opts.comRecorrencia ? [item.tipo === "recorrente" ? (opts.familia === "WHITE_LABEL" ? "Mensal, por licença ativa" : "Mensal") : "Única"] : []),
      Number(item.quantidade || 1).toLocaleString("pt-BR"),
      moeda(parseFloat(String(item.valorUnitario || "0")), opts.moeda),
      moeda(parseFloat(String(item.subtotal || "0")), opts.moeda),
    ].map((celula) => `<td>${escaparHtml(String(celula))}</td>`).join("")}</tr>`)
    .join("\n");
}
