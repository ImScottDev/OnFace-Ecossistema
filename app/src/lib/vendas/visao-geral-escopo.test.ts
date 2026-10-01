/**
 * RBAC de /vendas: quem vê meta do time e ranking inteiro, quem vê só o seu,
 * quem não vê ranking. Puro — o recorte por SQL é validado contra o banco.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { escopoVendas } from "@/lib/vendas/visao-geral";

describe("escopoVendas", () => {
  it("papéis de gestão veem o time", () => {
    for (const r of ["admin", "gerente", "director", "coordinator", "super_admin"]) {
      assert.equal(escopoVendas(r), "gestao", r);
    }
  });
  it("closer, sdr e vendedor (legado) veem só o próprio", () => {
    for (const r of ["closer", "sdr", "vendedor"]) assert.equal(escopoVendas(r), "pessoal", r);
  });
  it("leitor não vê ranking", () => assert.equal(escopoVendas("leitor"), "leitor"));
  it("papel desconhecido ou ausente mostra menos", () => {
    assert.equal(escopoVendas("estagiario"), "pessoal");
    assert.equal(escopoVendas(null), "pessoal");
  });
});
