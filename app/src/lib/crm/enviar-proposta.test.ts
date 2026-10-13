import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decidirDestinoEmail } from "./enviar-proposta";

describe("decidirDestinoEmail", () => {
  it("só o link: nunca há destino, mesmo com e-mail do lead e destinatário informado", () => {
    assert.equal(decidirDestinoEmail({ enviarEmail: false, destinatarioEmail: "a@x.com", emailDoLead: "lead@x.com" }), "");
    assert.equal(decidirDestinoEmail({ enviarEmail: false, emailDoLead: "lead@x.com" }), "");
  });
  it("com e-mail: o destinatário escolhido vence o do lead", () => {
    assert.equal(decidirDestinoEmail({ enviarEmail: true, destinatarioEmail: " a@x.com ", emailDoLead: "lead@x.com" }), "a@x.com");
  });
  it("com e-mail e sem destinatário escolhido: cai no contato; sem ninguém, vazio", () => {
    assert.equal(decidirDestinoEmail({ enviarEmail: true, destinatarioEmail: null, emailDoLead: "lead@x.com" }), "lead@x.com");
    assert.equal(decidirDestinoEmail({ enviarEmail: true }), "");
  });
});
