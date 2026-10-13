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

/** Linhas do quadro de valores do contrato. Sem setup, nada: "SETUP R$ 0,00" pareceria cobrança de zero. */
export function linhasSetupResumoHtml(setupTotal: string, forma: string, temSetup: boolean): string {
  if (!temSetup) return "";
  const linha = (rotulo: string, valor: string) => `<tr><td class="cf-rotulo">${rotulo}</td><td class="cf-valor">${escaparHtml(valor)}</td></tr>`;
  return [linha("SETUP", setupTotal), forma ? linha("FORMA DE PAGAMENTO DO SETUP", forma) : ""].filter(Boolean).join("\n");
}

/** Quadro do setup (White Label, cláusula 6): itens discriminados, total e forma. Vazio sem setup. */
export function quadroSetupHtml(linhasItens: string, setupTotal: string, forma: string, temSetup: boolean): string {
  if (!temSetup) return "";
  const cabecalho = "<tr><th>Item de setup</th><th>Descrição</th><th>Qtd.</th><th>Valor unitário</th><th>Total</th></tr>";
  const rodape = (rotulo: string, valor: string) => `<tr><td colspan="4" style="text-align:right"><b>${rotulo}</b></td><td class="cf-valor">${escaparHtml(valor)}</td></tr>`;
  return `<table class="cf-valores" border="1"><tbody>${cabecalho}${linhasItens}${rodape("Total do setup", setupTotal)}${forma ? rodape("Forma de pagamento do setup", forma) : ""}</tbody></table>`;
}
