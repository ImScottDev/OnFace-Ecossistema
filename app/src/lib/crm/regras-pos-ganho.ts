/**
 * Regras PURAS do que o Ganho grava (sem banco, para entrar no portão).
 *
 * Existe porque três contas decidem se o dinheiro de uma venda aparece, e as três
 * estavam inline, sem teste:
 *
 *  1. `valoresFechadosDoGanho` — `negocios.mrr_fechado` e `valor_setup`. Faturamento do
 *     mês, meta e placar do vendedor somam ESSAS duas colunas. O Ganho automático
 *     (pagamento no Stripe, contrato assinado) marcava status e etapa e não as gravava:
 *     a venda existia e valia R$ 0 em todo número. Só o PATCH manual as preenchia.
 *  2. `chaveCanonicaDoItem` — a chave do serviço canônico por item. Todo item MRR de uma
 *     venda paga por Stripe usava `STRIPE:<assinatura>`, a MESMA chave: dois itens
 *     recorrentes na mesma assinatura viravam UMA linha, a última sobrescrevia a primeira.
 *  3. `valoresDoServico` — valor e quantidade do serviço. O valor é o TOTAL da linha
 *     (já com quantidade e desconto). Quantidade é atributo informativo: nunca multiplica
 *     o valor de novo, e a linha NÃO se desdobra em componentes (uma linha por item).
 *     Desdobrar faria seis leituras de MRR somarem em dobro (`metrica-definicao-unica`).
 */

const num = (v: string | number | null | undefined): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * O que gravar em `mrr_fechado` / `valor_setup` quando o negócio vira ganho.
 * Só devolve o campo que está VAZIO (nulo ou zero) e tem estimativa: valor que alguém
 * digitou no PATCH manual nunca é sobrescrito.
 *
 * `valorProjeto` é o que `sync-negocio-valores` soma de avulso + setup (a cópia literal
 * de `valor_setup`, ver relatorios.ts), então é dele que o setup sai.
 */
export function valoresFechadosDoGanho(n: {
  mrrFechado: string | null;
  mrrEstimado: string | null;
  valorSetup: string | null;
  valorProjeto: string | null;
}): { mrrFechado?: string; valorSetup?: string } {
  const r: { mrrFechado?: string; valorSetup?: string } = {};
  if (!(num(n.mrrFechado) > 0) && num(n.mrrEstimado) > 0) r.mrrFechado = num(n.mrrEstimado).toFixed(2);
  if (!(num(n.valorSetup) > 0) && num(n.valorProjeto) > 0) r.valorSetup = num(n.valorProjeto).toFixed(2);
  return r;
}

/**
 * Backfill do histórico: o que gravar num negócio GANHO que ficou sem `mrr_fechado` e `valor_setup`
 * (anterior a `valoresFechadosDoGanho` no Ganho). Mesma regra do Ganho, com um degrau a mais:
 *  1. há mensalidade/projeto estimados -> a decomposição do Ganho (`valoresFechadosDoGanho`);
 *  2. senão, receita recorrente PURA com `valor_total > 0` -> o total é a mensalidade, por definição
 *     (herança do diagnóstico do legado: ganho do Zoho só tem o total);
 *  3. senão nada: híbrido/projeto sem decomposição vai para correção humana, não se adivinha.
 * Só olha negócio com os dois componentes vazios; o resto o Ganho/PATCH já preencheu.
 */
export function valoresDoGanhoAntigo(n: {
  mrrFechado: string | null;
  mrrEstimado: string | null;
  valorSetup: string | null;
  valorProjeto: string | null;
  valorTotal: string | null;
  tipoReceita: string | null;
}): { mrrFechado?: string; valorSetup?: string; regra: "decomposto" | "total_recorrente" | "nenhuma" } {
  if (num(n.mrrFechado) > 0 || num(n.valorSetup) > 0) return { regra: "nenhuma" };
  const dec = valoresFechadosDoGanho(n);
  if (dec.mrrFechado || dec.valorSetup) return { ...dec, regra: "decomposto" };
  if (n.tipoReceita === "recorrente" && num(n.valorTotal) > 0) return { mrrFechado: num(n.valorTotal).toFixed(2), regra: "total_recorrente" };
  return { regra: "nenhuma" };
}

/**
 * Chave canônica do serviço de UM item.
 *  - MRR pago por assinatura Stripe: `STRIPE:<assinatura>` (mesma convenção da reconciliação,
 *    que guarda UMA linha por assinatura) — mas só quando é o ÚNICO item recorrente do lote;
 *  - vários itens recorrentes na mesma assinatura: `STRIPE:<assinatura>:<item>`, uma linha por
 *    item, para o valor de cada um sobreviver (e a soma das linhas bater com a assinatura);
 *  - tudo o mais: `CRM2:<item>`.
 */
export function chaveCanonicaDoItem(o: { itemId: string; ehMrr: boolean; stripeSubscriptionId: string | null; itensMrrNoLote: number }): string {
  if (!o.ehMrr || !o.stripeSubscriptionId) return `CRM2:${o.itemId}`;
  return o.itensMrrNoLote > 1 ? `STRIPE:${o.stripeSubscriptionId}:${o.itemId}` : `STRIPE:${o.stripeSubscriptionId}`;
}

/** Valor recorrente e quantidade que o serviço canônico de um item grava. */
export function valoresDoServico(item: { revenueNature: string; valorTotal: string | null; quantidade: string | null }): { valorRecorrente: string; quantidade: string } {
  const q = num(item.quantidade);
  return {
    // Regra dura de servico-canonico.ts: só MRR alimenta current_recurring_value. E é o TOTAL da linha.
    valorRecorrente: item.revenueNature === "MRR" ? num(item.valorTotal).toFixed(2) : "0.00",
    quantidade: (q > 0 ? q : 1).toString(),
  };
}
