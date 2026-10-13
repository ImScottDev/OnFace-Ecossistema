import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assinaturaCobra, statusDaAssinatura, varianteDoStatusAssinatura } from "./financeiro-regras";

/** Caso Thays: assinatura cancelada no Stripe sumia do Cliente 360 ("Assinaturas · 0"). */
describe("assinatura cancelada aparece no histórico", () => {
  it("a leitura do Cliente 360 não filtra por status", () => {
    const rota = readFileSync(new URL("../../api-server/routes/clientes-assinatura.ts", import.meta.url), "utf8");
    const leitura = rota.slice(rota.indexOf('"/clientes/:empresaId/assinaturas-stripe"'), rota.indexOf("/previa"));
    assert.ok(!/inArray\(assinaturas\.status/.test(leitura), "filtro de status esconderia cancelada/pausada/vencida");
  });
  it("cada estado tem rótulo e selo próprios; cancelada é só leitura", () => {
    const estados = ["active", "past_due", "unpaid", "canceled", "paused"].map((s) => statusDaAssinatura(s, false));
    assert.deepEqual(estados, ["ativa", "vencida", "inadimplente", "cancelada", "pausada"]);
    assert.equal(varianteDoStatusAssinatura("ativa"), "success");
    assert.equal(varianteDoStatusAssinatura("vencida"), "danger");
    assert.equal(varianteDoStatusAssinatura("pausada"), "warning");
    assert.equal(varianteDoStatusAssinatura("cancelada"), "secondary");
    assert.equal(assinaturaCobra("canceled"), false);
  });
});
