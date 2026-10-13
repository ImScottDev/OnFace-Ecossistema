import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { idsDoContexto, contextoComNomes, semUuidCru, REMOVIDO } from "./resolver-ids";
import { tituloDoEvento } from "./rotulos-evento";

const A = "688c60da-0a05-4105-ab66-afea31cf7cfd";
const B = "4ab818b4-1dbc-424a-a870-9659742534c4";

describe("resolver ids da timeline", () => {
  it("troca UUID por nome, 'sem responsável' para nulo, e '(removido)' para id sem dono", () => {
    const nomes = new Map([[A, "Ana"]]);
    const ctx = { de: A, para: B, origemAtribuicao: "manual" };
    assert.deepEqual(idsDoContexto([ctx, null]).sort(), [B, A].sort());
    assert.equal(tituloDoEvento("OwnerChanged", null, contextoComNomes(ctx, nomes)), `Responsável: Ana → ${REMOVIDO}`);
    assert.equal(tituloDoEvento("OwnerChanged", null, contextoComNomes({ de: null, para: A }, nomes)), "Responsável: sem responsável → Ana");
    assert.equal(tituloDoEvento("LeadAssigned", null, contextoComNomes({ responsavelId: A }, nomes)), "Responsável: sem responsável → Ana");
  });
  it("varre UUID solto do texto sem tocar em URL", () => {
    assert.equal(semUuidCru(`Dono ${A}`), `Dono ${REMOVIDO}`);
    assert.equal(semUuidCru(`https://x/p/${A}`), `https://x/p/${A}`);
  });
});
