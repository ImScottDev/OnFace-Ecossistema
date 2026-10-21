/**
 * Parte PURA da receita VENDIDA (booking) — tipos e decomposição, SEM importar
 * `db` nem o schema. Pode ser usada em Client Components.
 *
 * A política mora aqui e só aqui. A tradução para SQL fica em
 * `receita-fechada.ts`, escrita a partir destas mesmas regras.
 *
 * Três grandezas distintas, decisão do Scott em 21/10/2026:
 *   - recorrente: a mensalidade do ganho (MRR vendido);
 *   - setup: receita única de implantação de uma venda recorrente;
 *   - avulso: projeto/avulso, que não recorre e não é implantação.
 *
 * `booking` = recorrente + setup. `avulso` fica FORA do booking, em métrica
 * própria: somar projeto com mensalidade num número só foi a origem dos
 * números incoerentes.
 *
 * `valorProjeto` NUNCA soma: a migração o duplicava com `valorSetup`.
 */

export type VendaBruta = {
  tipoReceita: string | null;
  mrrFechado: number | null;
  valorSetup: number | null;
  valorTotal: number | null;
};

export type VendaDecomposta = {
  /** Mensalidade vendida. Zero em projeto/avulso. */
  recorrente: number;
  /** Implantação de venda recorrente. Zero em projeto/avulso. */
  setup: number;
  /** Projeto/avulso. Zero em venda recorrente. */
  avulso: number;
  /** O que a Callface vendeu de recorrente mais a implantação: recorrente + setup. */
  booking: number;
  /** Tudo que a venda representa: booking + avulso. */
  total: number;
};

/** Tipos de receita que NÃO recorrem. Qualquer outro valor (inclusive nulo) recorre. */
const NAO_RECORRE = new Set(["avulso", "projeto"]);

export function tipoRecorre(tipoReceita: string | null): boolean {
  return !NAO_RECORRE.has(tipoReceita ?? "");
}

export function decomporVenda(venda: VendaBruta): VendaDecomposta {
  const recorre = tipoRecorre(venda.tipoReceita);
  const recorrente = recorre ? Number(venda.mrrFechado ?? 0) : 0;
  const setup = recorre ? Number(venda.valorSetup ?? 0) : 0;
  // Projeto sem valor total cai no setup: é onde a migração gravou o valor do projeto.
  const avulso = recorre
    ? 0
    : Number(venda.valorTotal ?? 0) > 0
      ? Number(venda.valorTotal)
      : Number(venda.valorSetup ?? 0);
  return { recorrente, setup, avulso, booking: recorrente + setup, total: recorrente + setup + avulso };
}

/** O número que o Fechamento e as metas chamam de "vendido": o booking. */
export function valorVendido(venda: VendaBruta): number {
  return decomporVenda(venda).booking;
}
