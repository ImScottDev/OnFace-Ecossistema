import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ESTADOS_QUE_NAO_CHEGARAM, TERMINAIS, entregaFalhou, estadoDeEventoResend, textoDaEntrega } from "./entrega-estado";

describe("entrega de e-mail: o estado vem do provedor, nunca é presumido", () => {
  it("e-mail recusado não aparece como entregue", () => {
    // Os dois casos reais do dono (P-1565 v1 e v2): bounced e suppressed.
    for (const evento of ["bounced", "suppressed", "complained", "failed", "canceled"]) {
      const estado = estadoDeEventoResend(evento);
      assert.ok(entregaFalhou(estado), `${evento} deve contar como não entregue`);
      assert.ok(ESTADOS_QUE_NAO_CHEGARAM.includes(estado));
      const texto = textoDaEntrega(estado);
      assert.doesNotMatch(texto, /entregue ao servidor/i, `${evento}: o texto não pode dizer entregue`);
      assert.doesNotMatch(texto, /^enviado/i);
    }
    assert.match(textoDaEntrega("bounced"), /NÃO CHEGOU/);
    assert.match(textoDaEntrega("suppressed"), /NÃO CHEGOU/);
    assert.match(textoDaEntrega("failed", "Resend HTTP 422"), /NÃO ENVIADO: Resend HTTP 422/);
  });

  it("só delivered (e abertura/clique, que o implicam) diz entregue; o resto nunca é promovido", () => {
    assert.equal(estadoDeEventoResend("delivered"), "delivered");
    assert.equal(estadoDeEventoResend("opened"), "delivered");
    assert.equal(estadoDeEventoResend("sent"), "sent");
    assert.equal(estadoDeEventoResend("evento_novo_que_nao_conhecemos"), "sent");
    assert.equal(estadoDeEventoResend(null), "sent");
    assert.doesNotMatch(textoDaEntrega("sent"), /entregue ao servidor/i);
    assert.match(textoDaEntrega("sent"), /não confirmada/);
    assert.equal(entregaFalhou("delivered"), false);
    assert.equal(entregaFalhou("sent"), false);
  });

  it("estado final não é consultado de novo; atraso e aceito continuam sendo", () => {
    for (const t of ["delivered", "bounced", "suppressed", "failed", "complained"] as const) assert.ok(TERMINAIS.includes(t));
    assert.ok(!TERMINAIS.includes("sent"));
    assert.ok(!TERMINAIS.includes("delivery_delayed"));
  });
});
