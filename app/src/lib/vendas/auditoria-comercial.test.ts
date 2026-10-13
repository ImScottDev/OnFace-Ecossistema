import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chavesDosItens, compararFotos, descreverAlteracao, descricaoDaTimeline, FOTO_VAZIA,
  resumoDasAlteracoes, totalDaFoto, type FotoComercial, type FotoDoItem,
} from "./auditoria-comercial";

const item = (o: Partial<FotoDoItem> = {}): FotoDoItem => ({
  chave: "preco-a#0", nome: "Ramal", quantidade: 2, valorUnitario: 100, desconto: 0, subtotal: 200, ...o,
});
const foto = (o: Partial<FotoComercial> = {}): FotoComercial => ({ ...FOTO_VAZIA, itens: [item()], ...o });

describe("chavesDosItens", () => {
  it("o mesmo Price repetido ganha sufixos; a linha legada usa o id", () => {
    assert.deepEqual(
      chavesDosItens([
        { id: "1", catalogoPrecoId: "p" }, { id: "2", catalogoPrecoId: "p" },
        { id: "3", catalogoPrecoId: null }, { id: "4", catalogoPrecoId: "q" },
      ]),
      ["p#0", "p#1", "item:3", "q#0"],
    );
  });
  it("não depende do id da linha (regravada a cada salvamento)", () => {
    assert.deepEqual(chavesDosItens([{ id: "novo", catalogoPrecoId: "p" }]), chavesDosItens([{ id: "antigo", catalogoPrecoId: "p" }]));
  });
});

describe("compararFotos", () => {
  it("sem mudança, nada a registrar", () => {
    assert.deepEqual(compararFotos(foto(), foto()), []);
  });

  it("desconto vira de → para, com o item", () => {
    const r = compararFotos(foto(), foto({ itens: [item({ desconto: 50, subtotal: 150 })] }));
    assert.equal(r.length, 1);
    assert.equal(r[0].campo, "desconto");
    assert.equal(r[0].item, "Ramal");
    assert.equal(r[0].de, 0);
    assert.equal(r[0].para, 50);
  });

  it("desconto sem limite: 100% também é só um registro", () => {
    const r = compararFotos(foto(), foto({ itens: [item({ desconto: 200, subtotal: 0 })] }));
    assert.equal(r[0].para, 200);
  });

  it("quantidade e preço negociado são campos separados", () => {
    const r = compararFotos(foto(), foto({ itens: [item({ quantidade: 5, valorUnitario: 90, subtotal: 450 })] }));
    assert.deepEqual(r.map((a) => a.campo), ["quantidade", "preco_negociado"]);
    assert.equal(r[0].de, 2);
    assert.equal(r[0].para, 5);
    assert.equal(r[1].de, 100);
    assert.equal(r[1].para, 90);
  });

  it("diferença de menos de um centavo não é alteração", () => {
    assert.deepEqual(compararFotos(foto(), foto({ itens: [item({ valorUnitario: 100.0004 })] })), []);
  });

  it("item adicionado e removido", () => {
    const depois = foto({ itens: [item(), item({ chave: "preco-b#0", nome: "BINA", quantidade: 1, valorUnitario: 9.9, subtotal: 9.9 })] });
    const add = compararFotos(foto(), depois);
    assert.deepEqual(add.map((a) => [a.campo, a.item]), [["item_adicionado", "BINA"]]);
    const rem = compararFotos(depois, foto());
    assert.deepEqual(rem.map((a) => [a.campo, a.item]), [["item_removido", "BINA"]]);
  });

  it("validade, modo, prazo, parcelas, observações e contato", () => {
    const r = compararFotos(
      foto({ validadeDias: 14, modoFechamento: "CONTRACT", prazoContratoMeses: 12, parcelas: 1, observacoes: "a", contato: "Ana" }),
      foto({ validadeDias: 30, modoFechamento: "PREPAID", prazoContratoMeses: 24, parcelas: 3, observacoes: "b", contato: "Bia" }),
    );
    assert.deepEqual(r.map((a) => a.campo), ["validade_dias", "modo_fechamento", "prazo_contrato", "parcelas", "observacoes", "contato"]);
  });

  it("observação vazia e nula são a mesma coisa; limpar um campo é alteração", () => {
    assert.deepEqual(compararFotos(foto({ observacoes: "  " }), foto({ observacoes: null })), []);
    const r = compararFotos(foto({ observacoes: "texto" }), foto({ observacoes: "" }));
    assert.equal(r[0].campo, "observacoes");
    assert.equal(r[0].para, null);
  });

  it("criação: contra a foto vazia, todo item é adicionado", () => {
    const r = compararFotos(FOTO_VAZIA, foto({ itens: [item({ desconto: 20, subtotal: 180 })] }));
    assert.equal(r.length, 1);
    assert.equal(r[0].campo, "item_adicionado");
    assert.match(r[0].detalhe ?? "", /desconto/);
  });
});

describe("texto", () => {
  it("descreve de → para com a moeda", () => {
    const [a] = compararFotos(foto(), foto({ itens: [item({ desconto: 50, subtotal: 150 })] }));
    const t = descreverAlteracao(a).replace(/ /g, " ");
    assert.match(t, /^Desconto · Ramal: R\$ 0,00 → R\$ 50,00$/);
  });

  it("campo limpo aparece como traço", () => {
    const [a] = compararFotos(foto({ observacoes: "x" }), foto({ observacoes: null }));
    assert.match(descreverAlteracao(a), /x → —$/);
  });

  it("resumo conta e nomeia sem repetir", () => {
    const r = compararFotos(foto(), foto({ itens: [item({ desconto: 50, quantidade: 3, subtotal: 250 })], validadeDias: 7 }));
    assert.equal(resumoDasAlteracoes(r), "3 alterações: quantidade, desconto e validade (dias)");
    assert.equal(resumoDasAlteracoes([]), "Sem alterações");
  });

  it("a descrição da timeline carrega o motivo e corta em 6 linhas", () => {
    const muitos = foto({ itens: Array.from({ length: 9 }, (_, i) => item({ chave: `p${i}#0`, nome: `I${i}` })) });
    const d = descricaoDaTimeline(compararFotos(FOTO_VAZIA, muitos), "pedido do cliente");
    assert.equal(d.split("\n").length, 8);
    assert.match(d, /e mais 3/);
    assert.match(d, /Motivo: pedido do cliente$/);
  });

  it("total da foto soma em centavos", () => {
    assert.equal(totalDaFoto(foto({ itens: [item({ subtotal: 0.1 }), item({ chave: "x", subtotal: 0.2 })] })), 0.3);
  });
});
