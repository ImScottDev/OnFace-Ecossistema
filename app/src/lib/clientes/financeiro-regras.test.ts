import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assinaturaFinanceira, classificarFatura, rotuloMesCobranca, situacaoFinanceira, statusDaAssinatura } from "./financeiro-regras";
import { periodoCorrente } from "../integrations/stripe-financeiro";

/** O caso Ademicon (Stripe live, 13/10/2026): faturas de 12/08, 12/09 e 12/10, assinatura past_due. */
const agora = new Date("2026-10-13T15:00:00Z");
const fat = (emitida: string, status: string, extra: object = {}) => classificarFatura({
  id: emitida, origem: "stripe", externalId: null, status, valor: 229.9, emitidaEm: new Date(emitida), vencimento: null,
  pagaEm: status === "paga" ? new Date(emitida) : null, competencia: "2026-08-01", hostedInvoiceUrl: null, tentativas: status === "aberta" ? 1 : 0,
  assinaturaId: "a", valorEstornado: 0, pagamentoFalhou: false, ...extra,
}, agora);

describe("financeiro do cliente", () => {
  it("past_due é 'Vencida', não 'Ativa'", () => {
    assert.equal(statusDaAssinatura("past_due", false), "vencida");
    assert.equal(statusDaAssinatura("unpaid", false), "inadimplente");
  });
  it("cada fatura fica no mês em que foi cobrada: agosto, setembro, outubro (não agosto duas vezes)", () => {
    const meses = [fat("2026-08-12T14:45:00Z", "paga"), fat("2026-09-12T14:46:00Z", "paga"), fat("2026-10-12T14:46:00Z", "aberta")]
      .map((f) => rotuloMesCobranca(f.mesCobranca));
    assert.deepEqual(meses, ["Agosto/2026", "Setembro/2026", "Outubro/2026"]);
  });
  it("aberta com tentativa já feita é pagamento que falhou, com a data da emissão", () => {
    const f = fat("2026-10-12T14:46:00Z", "aberta");
    assert.equal(f.pagamentoFalhou, true);
    assert.equal(f.estado, "vencida");
    assert.equal(f.dataCobranca?.toISOString(), "2026-10-12T14:46:00.000Z");
  });
  it("assinatura vencida ainda tem próxima fatura: o fim do período", () => {
    const a = assinaturaFinanceira({
      id: "a", stripeSubscriptionId: "sub", produto: null, status: "past_due", cancelaNoFim: false, mrr: 229.9, iniciadaEm: null, canceladaEm: null,
      periodoFim: null, itens: [{ precoUnitario: 229.9, quantidade: 1, intervalo: "month", periodoCatalogo: null, status: "active", periodoFim: new Date("2026-11-12T14:45:53Z"), produto: "Callface Copilot" }],
    });
    assert.equal(a.statusRotulo, "Vencida");
    assert.equal(a.produtoReal, "Callface Copilot");
    assert.equal(a.proximaCobranca?.data.toISOString(), "2026-11-12T14:45:53.000Z");
  });
  it("API basil: o período vem no item", () => {
    assert.deepEqual(periodoCorrente({ items: { data: [{ current_period_start: 10, current_period_end: 20 }, { current_period_end: 15 }] } }), { inicio: 10, fim: 15 });
    assert.equal(periodoCorrente({ current_period_end: 99, items: { data: [{ current_period_end: 15 }] } }).fim, 99);
  });
});

describe("situação financeira do cliente (hoje 14/10/2026)", () => {
  const hoje = new Date("2026-10-14T15:00:00Z");
  const D = (s: string) => new Date(s);
  const ass = (o: object = {}) => ({ statusStripe: "active", ativa: true, fimDoPeriodo: D("2026-10-15T14:00:00Z"), canceladaEm: null, cancelaNoFim: false, proximaCobranca: { data: D("2026-10-15T14:00:00Z"), valor: 89.9 }, ...o });
  const fa = (estado: string, mes: string, extra: object = {}) => ({ estado: estado as never, valor: 89.9, mesCobranca: mes, dataCobranca: D(mes + "-12T12:00:00Z"), pagaEm: null, ...extra });

  it("fatura do mês paga", () => {
    const s = situacaoFinanceira([fa("recebida", "2026-10", { pagaEm: D("2026-10-12T12:00:00Z") })], [ass({ proximaCobranca: { data: D("2026-11-12T12:00:00Z"), valor: 89.9 } })], hoje);
    assert.equal(s.mes.estado, "recebida");
    assert.equal(s.mesRotulo, "outubro");
  });
  it("fatura do mês vencida ganha de paga", () => {
    assert.equal(situacaoFinanceira([fa("recebida", "2026-10"), fa("vencida", "2026-10")], [ass()], hoje).mes.estado, "vencida");
  });
  it("sem fatura no mês e ciclo fecha ainda em outubro: será gerada", () => {
    const s = situacaoFinanceira([fa("recebida", "2026-09")], [ass()], hoje);
    assert.equal(s.mes.estado, "sera_gerada");
    assert.equal(s.mes.valor, 89.9);
  });
  it("sem fatura no mês e ciclo fecha em novembro: nada esperado em outubro", () => {
    assert.equal(situacaoFinanceira([], [ass({ proximaCobranca: { data: D("2026-11-03T12:00:00Z"), valor: 89.9 } })], hoje).mes.estado, "sem_fatura_no_mes");
  });
  it("ciclo terminou e o Stripe não renovou", () => {
    assert.equal(situacaoFinanceira([], [ass({ proximaCobranca: { data: D("2026-10-13T12:00:00Z"), valor: 89.9 } })], hoje).mes.estado, "aguardando_stripe");
  });
  it("THAYS: cancelada em 01/10, 3 faturas pagas até setembro", () => {
    const s = situacaoFinanceira([fa("recebida", "2026-09")], [ass({ statusStripe: "canceled", ativa: false, canceladaEm: D("2026-10-01T16:58:00Z"), proximaCobranca: null })], hoje);
    assert.equal(s.mes.estado, "sem_assinatura");
    assert.deepEqual(s.proxima, { data: D("2026-10-01T16:58:00Z"), motivo: "cancelada" });
  });
  it("ativa sem fim de ciclo no espelho diz o que falta", () => {
    const s = situacaoFinanceira([], [ass({ fimDoPeriodo: null, proximaCobranca: null })], hoje);
    assert.deepEqual(s.proxima, { data: null, motivo: "sem_fim_do_ciclo" });
  });
  it("sem assinatura nenhuma", () => {
    assert.deepEqual(situacaoFinanceira([], [], hoje).proxima, { data: null, motivo: "sem_assinatura" });
  });
});
