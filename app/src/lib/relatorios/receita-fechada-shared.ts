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
  /**
   * Família do serviço. Só WHITE_LABEL muda a conta (ver `WL_NAO_TEM_RECORRENCIA`).
   * Omitir é tratado como família desconhecida, sem exceção aplicada.
   */
  serviceFamily?: string | null;
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

/**
 * White Label não tem recorrência na venda, por definição do produto.
 *
 * A proposta de WL traz duas linhas: "Recorrente" (licenças × preço) e "Setup".
 * O parceiro paga só o setup no fechamento; as licenças são cobradas depois,
 * conforme ele ativa, por fatura avulsa. `aceitar-proposta.ts` grava a linha
 * Recorrente inteira em `mrr_fechado`, tratando um máximo teórico como
 * mensalidade garantida — achado do Kauã em 31/08/2026, reconfirmado pelo Scott
 * em 21/10 ("a recorrência nunca existiu; o que existiu foi só o setup").
 *
 * O valor gravado não é apagado: é a leitura que deixa de chamá-lo de MRR.
 * A classificação da família é curada, com trilha em `billing_correction_ledger`
 * (`src/scripts/conciliar-familia-white-label.ts`), nunca casada por nome aqui.
 */
export const WL_NAO_TEM_RECORRENCIA = "WHITE_LABEL";

export function decomporVenda(venda: VendaBruta): VendaDecomposta {
  const fecha = (recorrente: number, setup: number, avulso: number): VendaDecomposta => ({
    recorrente, setup, avulso, booking: recorrente + setup, total: recorrente + setup + avulso,
  });
  const n = (v: number | null | undefined) => Number(v ?? 0);

  // White Label: só o setup foi vendido. A linha Recorrente da proposta não vira MRR.
  if (venda.serviceFamily === WL_NAO_TEM_RECORRENCIA) return fecha(0, n(venda.valorSetup), 0);

  // Projeto/avulso: o valor do projeto, uma vez só. Sem valor total, cai no setup,
  // que é onde a migração gravou o valor do projeto.
  if (!tipoRecorre(venda.tipoReceita)) {
    const valor = n(venda.valorTotal) > 0 ? n(venda.valorTotal) : n(venda.valorSetup);
    return fecha(0, 0, valor);
  }

  // Venda recorrente: mensalidade mais a implantação.
  return fecha(n(venda.mrrFechado), n(venda.valorSetup), 0);
}

/** O número que o Fechamento e as metas chamam de "vendido": o booking. */
export function valorVendido(venda: VendaBruta): number {
  return decomporVenda(venda).booking;
}
