/**
 * Linhas do recebível de uma venda, SEPARADAS por natureza (D13 da auditoria).
 *
 * Mensalidade (MRR) e implantação (SETUP) têm vencimento e tratamento próprios
 * e entram em métricas diferentes (`mrr_faturavel` × `receita_setup`). Um
 * recebível só com a soma das duas desfazia essa separação. Puro, sem banco.
 *
 * Chave de idempotência (`faturas.external_id`):
 *   CRM2:<grupo>               legado, mistura as duas naturezas (não é recriado)
 *   CRM2:<grupo>:MRR           mensalidade
 *   CRM2:<grupo>:SETUP         implantação à vista
 *   CRM2:<grupo>:SETUP:<i>     implantação parcelada, parcela i
 */
export type NaturezaRecebivel = "MRR" | "SETUP";

export interface ItemDoRecebivel {
  tipo: string;
  revenueNature: string | null;
  subtotal: string | null;
}

export interface LinhaDoRecebivel {
  sufixo: string; // MRR | SETUP | SETUP:<i>
  natureza: NaturezaRecebivel;
  valor: number;
  vencimento: Date | null;
  parcela: number | null;
  totalParcelas: number | null;
}

const DIA_MS = 24 * 60 * 60 * 1000;
const num = (v: string | null | undefined) => {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : 0;
};
const centavos = (v: number) => Math.round(v * 100);

/** Recorrente é MRR; setup e avulso são implantação (cobrança única). */
export function naturezaDoItem(i: Pick<ItemDoRecebivel, "tipo" | "revenueNature">): NaturezaRecebivel {
  if (i.revenueNature === "MRR") return "MRR";
  if (!i.revenueNature || i.revenueNature === "UNKNOWN") return i.tipo === "recorrente" ? "MRR" : "SETUP";
  return "SETUP";
}

/**
 * `vencimento` é o da primeira cobrança (null = proposta sem condição de
 * vencimento; nunca inventamos data). Parcelas da implantação vencem a cada
 * 30 dias a partir dele; a sobra de centavos fica na primeira.
 */
export function linhasDoRecebivel(
  itens: ItemDoRecebivel[],
  opts: { vencimento: Date | null; parcelas?: number | null },
): LinhaDoRecebivel[] {
  let mrr = 0;
  let setup = 0;
  for (const i of itens) {
    if (naturezaDoItem(i) === "MRR") mrr += centavos(num(i.subtotal));
    else setup += centavos(num(i.subtotal));
  }
  const linhas: LinhaDoRecebivel[] = [];
  if (mrr > 0) linhas.push({ sufixo: "MRR", natureza: "MRR", valor: mrr / 100, vencimento: opts.vencimento, parcela: null, totalParcelas: null });
  if (setup > 0) {
    const n = opts.parcelas && opts.parcelas > 1 ? Math.floor(opts.parcelas) : 1;
    if (n === 1) {
      linhas.push({ sufixo: "SETUP", natureza: "SETUP", valor: setup / 100, vencimento: opts.vencimento, parcela: null, totalParcelas: null });
    } else {
      const base = Math.floor(setup / n);
      const sobra = setup - base * n;
      for (let p = 1; p <= n; p++) {
        linhas.push({
          sufixo: `SETUP:${p}`, natureza: "SETUP", valor: (base + (p === 1 ? sobra : 0)) / 100,
          vencimento: opts.vencimento ? new Date(opts.vencimento.getTime() + (p - 1) * 30 * DIA_MS) : null,
          parcela: p, totalParcelas: n,
        });
      }
    }
  }
  return linhas;
}
