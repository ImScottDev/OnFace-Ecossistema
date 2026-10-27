import { escaparHtml } from "@/lib/crm/contrato-variaveis";
import { MESES_DO_PERIODO, periodoDoItem } from "@/lib/crm/periodo-cobranca";

export interface ItemContrato {
  nome: string;
  descricao?: string | null;
  tipo: string;
  quantidade?: string | number | null;
  valorUnitario?: string | number | null;
  subtotal?: string | number | null;
  /** Período de cobrança do Price (mensal | trimestral | semestral | anual | unico). Sem ele, recorrente é mensal. */
  periodo?: string | null;
}

const ROTULO_RECORRENCIA: Record<string, string> = { trimestral: "Trimestral", semestral: "Semestral", anual: "Anual" };

/**
 * Valor MENSAL equivalente das linhas recorrentes (o MRR do contrato). Uma cobrança trimestral de R$ 300
 * é R$ 100 por mês; somar o subtotal cru chamava de "mensal" o valor de três meses (ou de doze).
 */
export function mrrDosItens(itens: ItemContrato[]): number {
  return itens.filter((i) => i.tipo === "recorrente").reduce((soma, i) => {
    const { periodo } = periodoDoItem({ periodo: i.periodo, tipo: i.tipo });
    const meses = periodo === "unico" ? 1 : MESES_DO_PERIODO[periodo];
    return soma + parseFloat(String(i.subtotal || "0")) / meses;
  }, 0);
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
      ...(opts.comRecorrencia ? [item.tipo === "recorrente" ? (ROTULO_RECORRENCIA[periodoDoItem({ periodo: item.periodo, tipo: item.tipo }).periodo] ?? (opts.familia === "WHITE_LABEL" ? "Mensal, por licença ativa" : "Mensal")) : "Única"] : []),
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

/**
 * As condições que o vendedor escreveu em palavras, no contrato.
 *
 * Franquia, excedente, preço por minuto: regras que definem a conta do
 * cliente e que ficavam só no rascunho interno — ele assinava sem elas
 * (visto na proposta #1606, 27/10/2026). Vazio sem observação, para o
 * modelo não imprimir um título sozinho; cada linha do texto vira um
 * parágrafo, preservando como foi escrito.
 */
export function blocoDeObservacoes(texto: string | null | undefined): string {
  const limpo = String(texto ?? "").trim();
  if (!limpo) return "";
  const paragrafos = limpo.split(/\n{1,}/).map((l) => l.trim()).filter(Boolean)
    .map((l) => `<p>${escaparHtml(l)}</p>`).join("");
  return `<p><b>Condições comerciais combinadas</b></p>${paragrafos}`;
}

/** Quadro do setup (White Label, cláusula 6): itens discriminados, total e forma. Vazio sem setup. */
export function quadroSetupHtml(linhasItens: string, setupTotal: string, forma: string, temSetup: boolean): string {
  if (!temSetup) return "";
  const cabecalho = "<tr><th>Item de setup</th><th>Descrição</th><th>Qtd.</th><th>Valor unitário</th><th>Total</th></tr>";
  const rodape = (rotulo: string, valor: string) => `<tr><td colspan="4" style="text-align:right"><b>${rotulo}</b></td><td class="cf-valor">${escaparHtml(valor)}</td></tr>`;
  return `<table class="cf-valores" border="1"><tbody>${cabecalho}${linhasItens}${rodape("Total do setup", setupTotal)}${forma ? rodape("Forma de pagamento do setup", forma) : ""}</tbody></table>`;
}
