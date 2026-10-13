import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { dominioCorporativo, dominioPublico, empresaUnicaDoDominio, normalizarDominio } from "./dominio-empresa";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("domínio como pista de empresa", () => {
  it("domínio público nunca casa empresa, mesmo com candidata", () => {
    for (const d of ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br", "bol.com.br", "uol.com.br",
      "icloud.com", "terra.com.br", "live.com", "msn.com", "proton.me", "protonmail.com", "GMAIL.COM"]) {
      assert.equal(dominioPublico(d), true, d);
      assert.equal(empresaUnicaDoDominio(d, [A]), null, d);
    }
    assert.equal(dominioCorporativo("ana@gmail.com"), null);
  });

  it("domínio que aponta para uma única empresa casa", () => {
    assert.equal(empresaUnicaDoDominio("solatiumseguros.com", [A]), A);
    assert.equal(empresaUnicaDoDominio("solatiumseguros.com", [A, A, A]), A, "a mesma empresa repetida é uma só");
    assert.equal(dominioCorporativo("gerencia@solatiumseguros.com"), "solatiumseguros.com");
  });

  it("domínio ambíguo ou sem candidata não resolve", () => {
    assert.equal(empresaUnicaDoDominio("grupo.com.br", [A, B]), null);
    assert.equal(empresaUnicaDoDominio("grupo.com.br", []), null);
    assert.equal(empresaUnicaDoDominio(null, [A]), null);
  });

  it("aceita e-mail, URL e domínio puro", () => {
    assert.equal(normalizarDominio("Ana@ACME.com.br"), "acme.com.br");
    assert.equal(normalizarDominio("https://www.acme.com.br/contato"), "acme.com.br");
    assert.equal(normalizarDominio("acme"), null);
  });
});
