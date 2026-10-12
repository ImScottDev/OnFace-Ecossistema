import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tituloDoEvento } from "./rotulos-evento";

describe("tituloDoEvento — troca de responsável", () => {
  it("mostra de → para e diz que é o Customer Success quando a entidade é cliente", () => {
    assert.equal(
      tituloDoEvento("OwnerChanged", null, { entidade: "cliente", de: "Ana", para: "Bia" }),
      "Customer Success: Ana → Bia",
    );
  });
  it("sem responsável anterior, não inventa nome", () => {
    assert.equal(tituloDoEvento("OwnerChanged", null, { para: "Bia" }), "Responsável: sem responsável → Bia");
  });
});

describe("tituloDoEvento — evento de domínio sem título", () => {
  it("sai em português, nunca o nome do tipo cru", () => {
    assert.equal(tituloDoEvento("CompanyCreated", null, null), "Empresa criada");
    assert.equal(tituloDoEvento("CompanyUpdated", null, null), "Empresa atualizada");
    assert.equal(tituloDoEvento("PersonUpdated", null, null), "Pessoa atualizada");
    assert.equal(tituloDoEvento("PersonLinkedToCompany", null, {}), "Pessoa vinculada à empresa");
  });
});
