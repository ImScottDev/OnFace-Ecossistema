import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { donoDoAgente, nomeDaPessoaNoAgente } from "./dono-da-ligacao";

/** A equipe real que motivou a regra: duas pessoas de nome parecido. */
const EQUIPE = [
  { id: "mayra", nome: "Mayra Mossim Schincariol" },
  { id: "mayara", nome: "Mayara Anjos" },
  { id: "jenifer", nome: "Jenifer Matos" },
];

describe("de quem é a ligação do agente", () => {
  it("'Agente Mayra' é da Mayra, não da Mayara", () => {
    // 226 ligações em 7 dias caíam no rodízio por falta desta linha.
    assert.equal(donoDoAgente("Agente Mayra", EQUIPE), "mayra");
  });

  it("não confunde Mayra com Mayara em nenhuma direção", () => {
    assert.equal(donoDoAgente("Agente Mayara", EQUIPE), "mayara");
  });

  it("agente genérico não tem dono — vai para o rodízio, como antes", () => {
    assert.equal(donoDoAgente("Assistente de Vendas", EQUIPE), null);
    assert.equal(donoDoAgente("Agente IA", EQUIPE), null);
    assert.equal(donoDoAgente("", EQUIPE), null);
    assert.equal(donoDoAgente(null, EQUIPE), null);
  });

  it("nome que casa com duas pessoas não casa com nenhuma", () => {
    const duasMayras = [
      { id: "a", nome: "Mayra Schincariol" },
      { id: "b", nome: "Mayra Oliveira" },
    ];
    assert.equal(donoDoAgente("Agente Mayra", duasMayras), null);
  });

  it("acento e caixa não atrapalham", () => {
    assert.equal(donoDoAgente("AGENTE JENIFER", EQUIPE), "jenifer");
    assert.equal(donoDoAgente("Agente Jênifer", EQUIPE), "jenifer");
  });

  it("sobrenome também identifica", () => {
    assert.equal(donoDoAgente("Agente Schincariol", EQUIPE), "mayra");
  });

  it("tira as palavras do robô e guarda só o nome", () => {
    assert.deepEqual(nomeDaPessoaNoAgente("Agente de Vendas Mayra"), ["mayra"]);
  });
});
