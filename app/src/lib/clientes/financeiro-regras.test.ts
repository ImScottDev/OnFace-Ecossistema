import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assinaturaFinanceira, classificarFatura, rotuloMesCobranca, statusDaAssinatura } from "./financeiro-regras";
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
