/**
 * Financeiro do cliente: as REGRAS (puras, sem banco).
 *
 * Existe para que a leitura única (`financeiro.ts`) e os testes falem a mesma
 * língua, e para que Client Component possa importar os tipos e rótulos sem
 * arrastar `db`. Nada aqui lê banco, relógio ou rede: `agora` é sempre parâmetro.
 *
 * Três ideias que a tela inteira obedece:
 *
 *  1. RECEBIDO e A RECEBER nunca se somam. Fatura emitida e não paga é "a
 *     receber" (ou "vencida", quando o dia de cobrança já passou); só vira
 *     "recebida" quando o pagamento confirma. Rascunho NÃO é a receber: a
 *     cobrança ainda não existe, é só previsão.
 *  2. A fatura fica no MÊS DE COBRANÇA (vencimento, ou emissão quando o Stripe
 *     não dá vencimento). Pagar não muda o mês dela: ela migra de "a receber"
 *     para "recebida" no mesmo lugar, nunca some nem aparece antes de existir.
 *     "Recebido no mês" (caixa) é outra pergunta e usa a data do pagamento.
 *  3. Planilha × Stripe: a planilha de faturamento (cliente_receita_mensal)
 *     JÁ contém boa parte do que o Stripe cobrou. Por empresa e mês o total é
 *     max(planilha, fatura); a planilha só entra com o que SOBRA do Stripe
 *     (o legado do PABX via holding). Ver `deduplicarPlanilha`.
 */

export const FUSO = "America/Sao_Paulo";

/** "YYYY-MM-DD" no fuso de São Paulo. */
export function diaSP(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
/** "YYYY-MM" no fuso de São Paulo. */
export function mesSP(d: Date): string { return diaSP(d).slice(0, 7); }

/** Soma `n` meses a "YYYY-MM". */
export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Centavos: 0,1 + 0,2 fecha em 0,3. */
const c = (v: number) => Math.round(v * 100);
const r = (centavos: number) => centavos / 100;

// ─── Assinatura ──────────────────────────────────────────────────────────────

export type StatusAssinatura =
  | "ativa" | "em_teste" | "vencida" | "inadimplente" | "cancelamento_agendado"
  | "cancelada" | "aguardando_pagamento" | "nao_concluida" | "pausada" | "desconhecido";

export const ROTULO_STATUS_ASSINATURA: Record<StatusAssinatura, string> = {
  ativa: "Ativa",
  em_teste: "Em teste",
  vencida: "Vencida",
  inadimplente: "Inadimplente",
  cancelamento_agendado: "Cancelamento agendado",
  cancelada: "Cancelada",
  aguardando_pagamento: "Aguardando 1º pagamento",
  nao_concluida: "Não concluída",
  pausada: "Pausada",
  desconhecido: "Status desconhecido",
};

/**
 * Status do Stripe dito em português claro. `cancelamento_agendado` ganha de
 * `ativa`: a assinatura segue cobrando até o fim do período, mas quem olha
 * precisa saber que ela vai acabar.
 */
export function statusDaAssinatura(status: string, cancelaNoFim: boolean): StatusAssinatura {
  switch (status) {
    case "active": return cancelaNoFim ? "cancelamento_agendado" : "ativa";
    case "trialing": return cancelaNoFim ? "cancelamento_agendado" : "em_teste";
    // past_due é o "Vencida" do Stripe (ainda tenta cobrar); unpaid é quando ele desistiu.
    case "past_due": return "vencida";
    case "unpaid": return "inadimplente";
    case "canceled": return "cancelada";
    case "incomplete": return "aguardando_pagamento";
    case "incomplete_expired": return "nao_concluida";
    case "paused": return "pausada";
    default: return "desconhecido";
  }
}

/** "Ativa ou desativada": a assinatura ainda cobra (ou vai cobrar) este cliente? */
export function assinaturaCobra(status: string): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}

/** Cor do selo (variantes do Badge do DS, por token) de cada estado: ativa, vencida, cancelada, pausada... */
export function varianteDoStatusAssinatura(status: StatusAssinatura): "success" | "danger" | "warning" | "info" | "secondary" {
  switch (status) {
    case "ativa": return "success";
    case "em_teste": return "info";
    case "vencida": case "inadimplente": return "danger";
    case "cancelamento_agendado": case "aguardando_pagamento": case "pausada": return "warning";
    default: return "secondary"; // cancelada, não concluída, desconhecido
  }
}

export type PeriodoAssinatura = "mensal" | "anual" | null;

/** `catalogo_precos.periodo` (fonte do período, ver periodo-cobranca.ts); sem ele, o intervalo do próprio Stripe. */
export function periodoDaAssinatura(periodoCatalogo: string | null | undefined, intervaloStripe: string | null | undefined): PeriodoAssinatura {
  if (periodoCatalogo === "mensal" || periodoCatalogo === "anual") return periodoCatalogo;
  if (intervaloStripe === "month") return "mensal";
  if (intervaloStripe === "year") return "anual";
  return null;
}

export interface ItemBruto {
  precoUnitario: number | null;
  quantidade: number;
  /** "month" | "year" | null (avulso dentro da assinatura). */
  intervalo: string | null;
  periodoCatalogo: string | null;
  /** `inactive` = item que saiu da assinatura. */
  status: string | null;
  periodoFim: Date | null;
  /** Nome do produto COMO O STRIPE O NOMEIA (espelho), nunca o do catálogo de hoje. */
  produto?: string | null;
  stripePriceId?: string | null;
  /** `catalogo_precos.variacao` (ou o apelido do Price no Stripe) quando existir. */
  variacao?: string | null;
  /** O Price ainda está ativo no catálogo atual? false = produto antigo, que continua valendo para quem já tem. */
  naCatalogoAtual?: boolean | null;
}

export interface ItemFinanceiro {
  produto: string | null;
  variacao: string | null;
  quantidade: number;
  precoUnitario: number | null;
  periodo: PeriodoAssinatura;
  stripePriceId: string | null;
  naCatalogoAtual: boolean | null;
}

export interface AssinaturaBruta {
  id: string;
  stripeSubscriptionId: string;
  produto: string | null;
  status: string;
  cancelaNoFim: boolean;
  mrr: number | null;
  iniciadaEm: Date | null;
  canceladaEm: Date | null;
  periodoFim: Date | null;
  itens: ItemBruto[];
}

export interface AssinaturaFinanceira {
  id: string;
  stripeSubscriptionId: string;
  produto: string | null;
  status: StatusAssinatura;
  statusRotulo: string;
  /** Status cru do Stripe, para quem precisa filtrar. */
  statusStripe: string;
  ativa: boolean;
  /** Produto como o Stripe nomeia (nomes dos itens; senão o da assinatura). */
  produtoReal: string | null;
  itens: ItemFinanceiro[];
  quantidade: number;
  /** Valor de UMA cobrança (preço de lista × quantidade dos itens recorrentes), sem cupom. */
  valorCiclo: number | null;
  periodo: PeriodoAssinatura;
  /** Valor normalizado por mês (o `mrr` do espelho). */
  mrr: number | null;
  proximaCobranca: { data: Date; valor: number } | null;
  fimDoPeriodo: Date | null;
  iniciadaEm: Date | null;
  canceladaEm: Date | null;
}

export function assinaturaFinanceira(a: AssinaturaBruta): AssinaturaFinanceira {
  const itens = a.itens.filter((i) => i.status !== "inactive" && i.intervalo);
  const centavos = itens.reduce((s, i) => s + c(i.precoUnitario ?? 0) * (i.quantidade || 1), 0);
  const temPreco = itens.some((i) => i.precoUnitario != null);
  const periodo = itens.length ? periodoDaAssinatura(itens[0].periodoCatalogo, itens[0].intervalo) : (a.mrr != null ? "mensal" : null);
  const valorCiclo = temPreco ? r(centavos) : a.mrr;
  // Fim do período: o da assinatura, ou o mais próximo dos itens (o Stripe novo só informa no item).
  const fimItens = itens.map((i) => i.periodoFim).filter((d): d is Date => !!d).sort((x, y) => x.getTime() - y.getTime())[0] ?? null;
  const fim = a.periodoFim ?? fimItens;
  const status = statusDaAssinatura(a.status, a.cancelaNoFim);
  // Só cobra de novo quem está cobrando e não vai ser cancelado no fim do período.
  const cobraDeNovo = assinaturaCobra(a.status) && !a.cancelaNoFim && !a.canceladaEm;
  return {
    id: a.id, stripeSubscriptionId: a.stripeSubscriptionId, produto: a.produto,
    status, statusRotulo: ROTULO_STATUS_ASSINATURA[status], statusStripe: a.status,
    ativa: assinaturaCobra(a.status),
    produtoReal: [...new Set(itens.map((i) => i.produto).filter((n): n is string => !!n))].join(" + ") || a.produto,
    itens: itens.map((i) => ({ produto: i.produto ?? null, variacao: i.variacao ?? null, quantidade: i.quantidade || 1, precoUnitario: i.precoUnitario, periodo: periodoDaAssinatura(i.periodoCatalogo, i.intervalo), stripePriceId: i.stripePriceId ?? null, naCatalogoAtual: i.naCatalogoAtual ?? null })),
    quantidade: itens.reduce((n, i) => n + (i.quantidade || 1), 0) || 1,
    valorCiclo, periodo, mrr: a.mrr,
    proximaCobranca: cobraDeNovo && fim && valorCiclo != null && valorCiclo > 0 ? { data: fim, valor: valorCiclo } : null,
    fimDoPeriodo: fim, iniciadaEm: a.iniciadaEm, canceladaEm: a.canceladaEm,
  };
}

// ─── "Como está o financeiro deste cliente hoje" ─────────────────────────────

/**
 * Por que NÃO há próxima cobrança (nunca um traço mudo):
 *  sem_assinatura    — nenhuma assinatura no Stripe para a conta
 *  cancelada         — todas encerradas (`data` = cancelamento, quando se sabe)
 *  suspensa          — o Stripe parou de cobrar (inadimplente, não concluída, pausada)
 *  cancela_no_fim    — ainda cobra, mas acaba em `data`: não haverá nova fatura
 *  sem_fim_do_ciclo  — assinatura viva, e o espelho ainda não tem o fim do período (volta no próximo sync)
 *  sem_valor         — ciclo conhecido (`data`), valor de cobrança não
 */
export type MotivoSemProxima = "sem_assinatura" | "cancelada" | "suspensa" | "cancela_no_fim" | "sem_fim_do_ciclo" | "sem_valor";

/**
 * Estado da fatura do mês vigente (mês do dia de cobrança, fuso SP):
 *  vencida / a_receber / recebida — a fatura do mês existe
 *  sera_gerada       — não existe ainda; o Stripe a gera em `data` (ainda neste mês)
 *  aguardando_stripe — o ciclo já terminou em `data` e o Stripe ainda não gerou a renovação
 *  sem_fatura_no_mes — não existe e nenhuma é esperada neste mês (`data` = próxima cobrança, se houver)
 *  sem_assinatura    — não há assinatura cobrando
 */
export type EstadoDoMes = "vencida" | "a_receber" | "recebida" | "sera_gerada" | "aguardando_stripe" | "sem_fatura_no_mes" | "sem_assinatura";

export interface SituacaoFinanceira {
  mesRotulo: string;
  mes: { estado: EstadoDoMes; valor: number | null; data: Date | null };
  proxima: { data: Date; valor: number; assinaturas: number } | { data: Date | null; motivo: MotivoSemProxima };
}

export function situacaoFinanceira(
  faturas: Array<Pick<FaturaFinanceira, "estado" | "valor" | "mesCobranca" | "dataCobranca" | "pagaEm">>,
  assinaturas: Array<Pick<AssinaturaFinanceira, "statusStripe" | "ativa" | "fimDoPeriodo" | "canceladaEm" | "proximaCobranca"> & { cancelaNoFim: boolean }>,
  agora: Date,
): SituacaoFinanceira {
  const mesAtual = mesSP(agora), hoje = diaSP(agora);
  const mesRotulo = rotuloMesCobranca(mesAtual).split("/")[0].toLowerCase();

  // Próxima cobrança: a mais cedo entre as assinaturas que cobrarão de novo.
  const proximas = assinaturas.flatMap((a) => (a.proximaCobranca ? [a.proximaCobranca] : []));
  proximas.sort((x, y) => x.data.getTime() - y.data.getTime());
  let proxima: SituacaoFinanceira["proxima"];
  if (proximas.length) proxima = { data: proximas[0].data, valor: proximas[0].valor, assinaturas: proximas.length };
  else {
    const cobrando = assinaturas.filter((a) => a.ativa);
    const encerradas = assinaturas.filter((a) => a.statusStripe === "canceled");
    const fimAgendado = cobrando.find((a) => a.cancelaNoFim || a.canceladaEm);
    const semFim = cobrando.find((a) => !a.fimDoPeriodo);
    const comFim = cobrando.find((a) => a.fimDoPeriodo);
    if (!assinaturas.length) proxima = { data: null, motivo: "sem_assinatura" };
    else if (fimAgendado) proxima = { data: fimAgendado.fimDoPeriodo ?? fimAgendado.canceladaEm, motivo: "cancela_no_fim" };
    else if (semFim) proxima = { data: null, motivo: "sem_fim_do_ciclo" };
    else if (comFim) proxima = { data: comFim.fimDoPeriodo, motivo: "sem_valor" };
    else if (encerradas.length === assinaturas.length) {
      const quando = encerradas.map((a) => a.canceladaEm ?? a.fimDoPeriodo).filter((d): d is Date => !!d).sort((x, y) => y.getTime() - x.getTime())[0] ?? null;
      proxima = { data: quando, motivo: "cancelada" };
    } else proxima = { data: null, motivo: "suspensa" };
  }

  // Fatura do mês vigente: a que já existe (a pior vence: vencida > a receber > recebida).
  const doMes = faturas.filter((f) => f.mesCobranca === mesAtual && (f.estado === "vencida" || f.estado === "a_receber" || f.estado === "recebida"));
  const soma = (l: typeof doMes) => r(l.reduce((s, f) => s + c(f.valor), 0));
  const vencidas = doMes.filter((f) => f.estado === "vencida"), aReceber = doMes.filter((f) => f.estado === "a_receber"), pagas = doMes.filter((f) => f.estado === "recebida");
  const cedo = (l: typeof doMes) => l.map((f) => f.dataCobranca).filter((d): d is Date => !!d).sort((x, y) => x.getTime() - y.getTime())[0] ?? null;
  let mes: SituacaoFinanceira["mes"];
  if (vencidas.length) mes = { estado: "vencida", valor: soma(vencidas), data: cedo(vencidas) };
  else if (aReceber.length) mes = { estado: "a_receber", valor: soma(aReceber), data: cedo(aReceber) };
  else if (pagas.length) mes = { estado: "recebida", valor: soma(pagas), data: pagas.map((f) => f.pagaEm).filter((d): d is Date => !!d).sort((x, y) => y.getTime() - x.getTime())[0] ?? null };
  else if (!assinaturas.some((a) => a.ativa)) mes = { estado: "sem_assinatura", valor: null, data: null };
  else if ("valor" in proxima) {
    const dia = diaSP(proxima.data);
    mes = dia < hoje ? { estado: "aguardando_stripe", valor: proxima.valor, data: proxima.data }
      : mesSP(proxima.data) === mesAtual ? { estado: "sera_gerada", valor: proxima.valor, data: proxima.data }
      : { estado: "sem_fatura_no_mes", valor: proxima.valor, data: proxima.data };
  } else mes = { estado: "sem_fatura_no_mes", valor: null, data: null };

  return { mesRotulo, mes, proxima };
}

// ─── Fatura ──────────────────────────────────────────────────────────────────

/**
 *  recebida   — paga (e não estornada)
 *  a_receber  — emitida, em aberto, dia de cobrança ainda não passou
 *  vencida    — emitida, em aberto, dia de cobrança passou
 *  prevista   — rascunho: ainda não é cobrança, só previsão (fora de qualquer total)
 *  estornada  — paga e devolvida por inteiro
 *  incobravel — o Stripe desistiu de cobrar
 *  cancelada  — anulada (void)
 */
export type EstadoFatura = "recebida" | "a_receber" | "vencida" | "prevista" | "estornada" | "incobravel" | "cancelada";

export interface FaturaBruta {
  id: string;
  origem: string;
  externalId: string | null;
  /** `faturas.status`: paga | aberta | falhou | rascunho | void | uncollectible */
  status: string;
  valor: number;
  emitidaEm: Date | null;
  vencimento: Date | null;
  pagaEm: Date | null;
  competencia: string | null;
  hostedInvoiceUrl: string | null;
  tentativas: number;
  assinaturaId: string | null;
  /** Soma dos `pagamentos` REFUNDED desta fatura (o que o agente de webhooks grava). */
  valorEstornado: number;
  /** Existe `pagamentos` FAILED nesta fatura. */
  pagamentoFalhou: boolean;
  falhouEm?: Date | null;
}

export interface FaturaFinanceira {
  id: string;
  origem: string;
  externalId: string | null;
  estado: EstadoFatura;
  valor: number;
  /** O que de fato entrou (recebida: valor menos estorno parcial); 0 nos demais. */
  valorRecebido: number;
  /** Dia de cobrança: vencimento, ou emissão quando o Stripe não dá vencimento. */
  dataCobranca: Date | null;
  mesCobranca: string | null;
  pagaEm: Date | null;
  mesPagamento: string | null;
  diasAtraso: number | null;
  hostedInvoiceUrl: string | null;
  tentativas: number;
  /** Falha de pagamento: linha FAILED em `pagamentos`, OU fatura ainda aberta com tentativa de cobrança já feita. */
  pagamentoFalhou: boolean;
  /** Quando a falha vem só da tentativa da fatura (o espelho ainda não tem o FAILED), não há data/motivo do Stripe. */
  falhaInferida: boolean;
  falhouEm: Date | null;
  assinaturaId: string | null;
}

function diasEntre(deDia: string, ateDia: string): number {
  return Math.round((Date.parse(ateDia + "T00:00:00Z") - Date.parse(deDia + "T00:00:00Z")) / 864e5);
}

export function classificarFatura(f: FaturaBruta, agora: Date): FaturaFinanceira {
  const dataCobranca = f.vencimento ?? f.emitidaEm ?? (f.competencia ? new Date(f.competencia + "T12:00:00Z") : null);
  let estado: EstadoFatura;
  let valorRecebido = 0;
  let diasAtraso: number | null = null;
  switch (f.status) {
    case "paga": {
      const liquido = Math.max(0, r(c(f.valor) - c(f.valorEstornado)));
      estado = f.valorEstornado > 0 && liquido <= 0.005 ? "estornada" : "recebida";
      valorRecebido = estado === "recebida" ? liquido : 0;
      break;
    }
    case "rascunho": estado = "prevista"; break;
    case "void": estado = "cancelada"; break;
    case "uncollectible": estado = "incobravel"; break;
    default: { // aberta | falhou
      const atraso = dataCobranca ? diasEntre(diaSP(dataCobranca), diaSP(agora)) : 0;
      estado = atraso > 0 ? "vencida" : "a_receber";
      diasAtraso = atraso > 0 ? atraso : null;
    }
  }
  // Aberta que o Stripe já tentou cobrar (attempt_count > 0) é aberta porque a cobrança FALHOU.
  const tentouEFalhou = (estado === "a_receber" || estado === "vencida") && f.tentativas > 0;
  return {
    id: f.id, origem: f.origem, externalId: f.externalId, estado, valor: f.valor, valorRecebido,
    dataCobranca, mesCobranca: dataCobranca ? mesSP(dataCobranca) : null,
    pagaEm: f.pagaEm, mesPagamento: f.pagaEm ? mesSP(f.pagaEm) : null,
    diasAtraso, hostedInvoiceUrl: f.hostedInvoiceUrl, tentativas: f.tentativas,
    pagamentoFalhou: f.pagamentoFalhou || tentouEFalhou,
    falhaInferida: !f.pagamentoFalhou && tentouEFalhou,
    falhouEm: f.falhouEm ?? (tentouEFalhou ? f.emitidaEm : null),
    assinaturaId: f.assinaturaId,
  };
}

// ─── Planilha × Stripe ───────────────────────────────────────────────────────

/** Origens de `faturas` que a planilha de faturamento também enxerga (cobrança real). */
export const ORIGENS_QUE_A_PLANILHA_ESPELHA: readonly string[] = ["stripe", "zoho_legado"];

export interface DedupPlanilhaMes {
  /** O que sobra da planilha depois de descontar o que as faturas já explicam: legado PABX / holding. */
  planilha: number;
  /** A planilha bruta do mês, para auditoria. */
  planilhaBruta: number;
  /** Cobrado nas faturas (stripe/zoho) no mês. */
  faturado: number;
  /** planilha − faturas quando as duas existem e diferem; null quando batem ou só uma existe. */
  divergencia: number | null;
}

/**
 * CRITÉRIO DE DEDUPLICAÇÃO (explícito): por empresa e mês,
 *     total do mês   = max(planilha, faturas)
 *     origem fatura  = faturas (Stripe é a fonte do que foi cobrado nele)
 *     origem planilha= max(0, planilha − faturas)   (o resto: holding/legado)
 * Porque a planilha mensal lista TUDO que a Callface faturou, inclusive o que
 * está no Stripe (em set/2026, 38 empresas com valor idêntico). Somar os dois
 * contaria em dobro; descartar a planilha perderia o PABX que só existe nela.
 * Quando as duas existem e diferem em mais de 1 centavo, `divergencia` mostra
 * a diferença — é fila de conciliação, não ajuste silencioso.
 */
export function deduplicarPlanilha(planilhaPorMes: Map<string, number>, faturadoPorMes: Map<string, number>): Map<string, DedupPlanilhaMes> {
  const out = new Map<string, DedupPlanilhaMes>();
  for (const mes of new Set([...planilhaPorMes.keys(), ...faturadoPorMes.keys()])) {
    const p = c(planilhaPorMes.get(mes) ?? 0), f = c(faturadoPorMes.get(mes) ?? 0);
    out.set(mes, {
      planilha: r(Math.max(0, p - f)), planilhaBruta: r(p), faturado: r(f),
      divergencia: p > 0 && f > 0 && Math.abs(p - f) > 1 ? r(p - f) : null,
    });
  }
  return out;
}

// ─── Série e totais ──────────────────────────────────────────────────────────

/** Um mês do gráfico. recebido/aReceber/vencido/planilha empilham; `prevista` é só informação (não existe ainda). */
export interface MesFinanceiro {
  /** "YYYY-MM" */
  mes: string;
  recebido: number;
  aReceber: number;
  vencido: number;
  planilha: number;
  total: number;
  prevista: number;
  planilhaBruta: number;
  divergencia: number | null;
}

export interface TotaisFinanceiros {
  /** CAIXA: o que entrou no mês corrente (data do pagamento). */
  recebidoNoMes: number;
  recebido12Meses: number;
  /** Tudo que está emitido e não pago (a vencer + vencido). NUNCA soma com recebido. */
  aReceber: number;
  aReceberVencido: number;
  aReceberAVencer: number;
  /** Em aberto com dia de cobrança no mês corrente. */
  aReceberDoMes: number;
  qtdAReceber: number;
  qtdVencidas: number;
  incobravel: number;
}

export function totaisFinanceiros(faturas: FaturaFinanceira[], agora: Date): TotaisFinanceiros {
  const mesAtual = mesSP(agora);
  const desde = somarMeses(mesAtual, -11);
  let recMes = 0, rec12 = 0, venc = 0, aVencer = 0, doMes = 0, inc = 0, qVenc = 0, qAbertas = 0;
  for (const f of faturas) {
    if (f.estado === "recebida") {
      const m = f.mesPagamento ?? f.mesCobranca;
      if (m === mesAtual) recMes += c(f.valorRecebido);
      if (m && m >= desde && m <= mesAtual) rec12 += c(f.valorRecebido);
    } else if (f.estado === "vencida") { venc += c(f.valor); qVenc++; qAbertas++; if (f.mesCobranca === mesAtual) doMes += c(f.valor); }
    else if (f.estado === "a_receber") { aVencer += c(f.valor); qAbertas++; if (f.mesCobranca === mesAtual) doMes += c(f.valor); }
    else if (f.estado === "incobravel") inc += c(f.valor);
  }
  return {
    recebidoNoMes: r(recMes), recebido12Meses: r(rec12),
    aReceber: r(venc + aVencer), aReceberVencido: r(venc), aReceberAVencer: r(aVencer), aReceberDoMes: r(doMes),
    qtdAReceber: qAbertas, qtdVencidas: qVenc, incobravel: r(inc),
  };
}

export interface EntradaSerie {
  faturas: FaturaFinanceira[];
  assinaturas: AssinaturaFinanceira[];
  /** Linhas de cliente_receita_mensal da empresa: competência "YYYY-MM" e valor. */
  planilha: { mes: string; valor: number }[];
  agora: Date;
  /** Meses para trás a partir do corrente (default 11 = 12 meses). */
  mesesAtras?: number;
  /** Meses para a frente (default 1). */
  mesesAdiante?: number;
}

export function montarSerieFinanceira(e: EntradaSerie): MesFinanceiro[] {
  const mesAtual = mesSP(e.agora);
  const meses: string[] = [];
  for (let k = -(e.mesesAtras ?? 11); k <= (e.mesesAdiante ?? 1); k++) meses.push(somarMeses(mesAtual, k));
  const base = new Map<string, MesFinanceiro>(meses.map((m) => [m, { mes: m, recebido: 0, aReceber: 0, vencido: 0, planilha: 0, total: 0, prevista: 0, planilhaBruta: 0, divergencia: null }]));
  const cent = new Map<string, { rec: number; ar: number; ve: number; pr: number }>(meses.map((m) => [m, { rec: 0, ar: 0, ve: 0, pr: 0 }]));
  const faturadoParaDedup = new Map<string, number>();

  for (const f of e.faturas) {
    const m = f.mesCobranca;
    if (!m) continue;
    const slot = cent.get(m);
    // O que a planilha também enxerga entra na conta de dedup mesmo fora da janela exibida.
    if (ORIGENS_QUE_A_PLANILHA_ESPELHA.includes(f.origem) && (f.estado === "recebida" || f.estado === "a_receber" || f.estado === "vencida")) {
      faturadoParaDedup.set(m, r(c(faturadoParaDedup.get(m) ?? 0) + c(f.valor)));
    }
    if (!slot) continue;
    if (f.estado === "recebida") slot.rec += c(f.valorRecebido);
    else if (f.estado === "a_receber") slot.ar += c(f.valor);
    else if (f.estado === "vencida") slot.ve += c(f.valor);
    else if (f.estado === "prevista") slot.pr += c(f.valor);
  }
  // Próxima cobrança agendada de cada assinatura que ainda NÃO tem fatura (aberta/rascunho) no mês: previsão.
  for (const a of e.assinaturas) {
    const p = a.proximaCobranca;
    if (!p) continue;
    const m = mesSP(p.data);
    const slot = cent.get(m);
    if (!slot) continue;
    const jaTemFatura = e.faturas.some((f) => f.assinaturaId === a.id && f.mesCobranca === m && (f.estado === "a_receber" || f.estado === "vencida" || f.estado === "prevista" || f.estado === "recebida"));
    if (!jaTemFatura) slot.pr += c(p.valor);
  }

  const planilhaPorMes = new Map<string, number>();
  for (const l of e.planilha) planilhaPorMes.set(l.mes, r(c(planilhaPorMes.get(l.mes) ?? 0) + c(l.valor)));
  const dedup = deduplicarPlanilha(planilhaPorMes, faturadoParaDedup);

  return meses.map((m) => {
    const s = cent.get(m)!, d = dedup.get(m);
    const out = base.get(m)!;
    out.recebido = r(s.rec); out.aReceber = r(s.ar); out.vencido = r(s.ve); out.prevista = r(s.pr);
    out.planilha = d?.planilha ?? 0; out.planilhaBruta = d?.planilhaBruta ?? 0; out.divergencia = d?.divergencia ?? null;
    out.total = r(s.rec + s.ar + s.ve + c(out.planilha));
    return out;
  });
}

export function proximaCobrancaGeral(assinaturas: AssinaturaFinanceira[]): { data: Date; valor: number; assinaturaId: string; produto: string | null } | null {
  let melhor: { data: Date; valor: number; assinaturaId: string; produto: string | null } | null = null;
  for (const a of assinaturas) {
    if (!a.proximaCobranca) continue;
    if (!melhor || a.proximaCobranca.data < melhor.data) melhor = { ...a.proximaCobranca, assinaturaId: a.id, produto: a.produto };
  }
  return melhor;
}

// ─── Pagamentos e links ──────────────────────────────────────────────────────

export type SituacaoPagamento = "ok" | "falhou" | "estornado" | "pendente";

export interface PagamentoFinanceiro {
  id: string;
  faturaId: string | null;
  valor: number;
  situacao: SituacaoPagamento;
  data: Date | null;
  metodo: string | null;
  /** true = não há linha em `pagamentos`; veio da tentativa da fatura (sem data/motivo do Stripe). */
  inferido: boolean;
}

export const ROTULO_SITUACAO_PAGAMENTO: Record<SituacaoPagamento, string> = {
  ok: "Pago", falhou: "Falhou", estornado: "Estornado", pendente: "Pendente",
};

export function situacaoDoPagamento(status: string): SituacaoPagamento {
  switch (status.toUpperCase()) {
    case "PAID": return "ok";
    case "FAILED": return "falhou";
    case "REFUNDED": return "estornado";
    default: return "pendente";
  }
}

export const linkFaturaStripe = (externalId: string) => `https://dashboard.stripe.com/invoices/${externalId}`;
export const linkAssinaturaStripe = (id: string) => `https://dashboard.stripe.com/subscriptions/${id}`;

/** Rótulo de mês da fatura: o mês em que ela foi cobrada, não o início do ciclo (que atrasa um mês nas renovações). */
export function rotuloMesCobranca(mes: string | null): string {
  if (!mes) return "Sem data";
  const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${nomes[Number(mes.slice(5)) - 1]}/${mes.slice(0, 4)}`;
}

/** Pagamentos exibidos: as linhas reais + uma por fatura aberta com tentativa falha que ainda não tem FAILED. */
export function pagamentosDaTela(reais: PagamentoFinanceiro[], faturas: FaturaFinanceira[]): PagamentoFinanceiro[] {
  const comFalhaReal = new Set(reais.filter((p) => p.situacao === "falhou" && p.faturaId).map((p) => p.faturaId));
  const inferidos: PagamentoFinanceiro[] = faturas
    .filter((f) => f.falhaInferida && !comFalhaReal.has(f.id))
    .map((f) => ({ id: "tentativa:" + f.id, faturaId: f.id, valor: f.valor, situacao: "falhou" as const, data: f.falhouEm, metodo: null, inferido: true }));
  return [...reais, ...inferidos].sort((a, b) => (b.data?.getTime() ?? 0) - (a.data?.getTime() ?? 0));
}
