import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mesmaPessoa, telefoneDeIdentidade, type IdentidadeDoLead } from "./mesma-pessoa";

const L = (o: Partial<IdentidadeDoLead> & { id: string }): IdentidadeDoLead => ({ nome: "Ana Souza", ...o });

describe("mesma pessoa", () => {
  it("o mesmo registro, a mesma pessoa canônica e o vínculo de deduplicação ligam", () => {
    assert.ok(mesmaPessoa(L({ id: "a" }), L({ id: "a" })));
    assert.ok(mesmaPessoa(L({ id: "a", pessoaId: "p" }), L({ id: "b", pessoaId: "p" })));
    assert.ok(mesmaPessoa(L({ id: "dup", canonicalLeadId: "canon" }), L({ id: "canon" })));
    assert.ok(mesmaPessoa(L({ id: "canon" }), L({ id: "dup", canonicalLeadId: "canon" })));
    assert.ok(mesmaPessoa(L({ id: "d1", canonicalLeadId: "c" }), L({ id: "d2", canonicalLeadId: "c" })));
  });

  it("o mesmo e-mail liga, sem diferenciar caixa nem espaço", () => {
    assert.ok(mesmaPessoa(L({ id: "a", email: "Ana@Acme.com " }), L({ id: "b", nome: "Outro Nome", email: "ana@acme.com" })));
    assert.ok(!mesmaPessoa(L({ id: "a", email: "ana@acme.com" }), L({ id: "b", email: "bia@acme.com" })));
    assert.ok(!mesmaPessoa(L({ id: "a", email: "" }), L({ id: "b", email: "" })), "vazio não é igual a vazio");
    assert.ok(!mesmaPessoa(L({ id: "a", email: "sem-arroba" }), L({ id: "b", email: "sem-arroba" })));
  });

  it("telefone liga SÓ com o mesmo primeiro nome (central e número-lixo não ligam gente diferente)", () => {
    const fone = "(11) 99999-0001";
    assert.ok(mesmaPessoa(L({ id: "a", telefones: [fone] }), L({ id: "b", nome: "ANA Souza Lima", telefones: ["+55 11 99999-0001"] })));
    assert.ok(mesmaPessoa(L({ id: "a", nome: "Vinícius", telefones: [fone] }), L({ id: "b", nome: "Vinicius", telefones: [null, "11999990001"] })), "acento não separa");
    assert.ok(!mesmaPessoa(L({ id: "a", telefones: [fone] }), L({ id: "b", nome: "Bruno", telefones: [fone] })), "mesmo telefone, outra pessoa");
    assert.ok(!mesmaPessoa(L({ id: "a", nome: "Mauricio", telefones: ["1000000000"] }), L({ id: "b", nome: "Mauricio", telefones: ["1000000000"] })), "número-lixo");
    assert.ok(!mesmaPessoa(L({ id: "a", telefones: ["12345"] }), L({ id: "b", telefones: ["12345"] })), "curto demais");
  });

  it("telefone: o 55 do país sai e preenchimento não é número", () => {
    assert.equal(telefoneDeIdentidade("+55 (19) 91234-5678"), "19912345678");
    assert.equal(telefoneDeIdentidade("(19) 91234-5678"), "19912345678");
    assert.equal(telefoneDeIdentidade("(11) 3333-4444"), "1133334444");
    assert.equal(telefoneDeIdentidade("1000000000"), null);
    assert.equal(telefoneDeIdentidade("abc"), null);
    assert.equal(telefoneDeIdentidade(null), null);
  });
});
