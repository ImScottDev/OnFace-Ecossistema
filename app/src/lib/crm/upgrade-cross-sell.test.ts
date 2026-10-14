import { test } from "node:test";
import assert from "node:assert/strict";
import { efeitoDaVenda, servicosSubstituidos, servicoRenovado } from "./upgrade-cross-sell";
import { complementoDoUpgrade } from "./entrega-da-venda";
import { AI_CHECKLIST_BASE } from "./pos-venda-checklists";

const v = (o: Partial<Parameters<typeof efeitoDaVenda>[0]> = {}) => ({ motion: "EXPANSION", tipoVenda: null, tipoContratual: null, ...o });

test("efeito da venda: cross-sell e expansão somam; upgrade/downgrade substituem; renovação renova", () => {
  assert.equal(efeitoDaVenda(v({ tipoVenda: "crosssell" })), "SOMA");
  assert.equal(efeitoDaVenda(v({ tipoVenda: "expansao" })), "SOMA");
  assert.equal(efeitoDaVenda(v({ motion: "NEW_BUSINESS" })), "SOMA");
  assert.equal(efeitoDaVenda(v({ tipoVenda: "upgrade" })), "UPGRADE");
  assert.equal(efeitoDaVenda(v({ tipoVenda: "downgrade" })), "DOWNGRADE");
  assert.equal(efeitoDaVenda(v({ tipoVenda: "renovacao", motion: "RENEWAL" })), "RENOVACAO");
  assert.equal(efeitoDaVenda(v({ motion: "RENEWAL" })), "RENOVACAO");
});

test("o documento assinado vale mais que a intenção da abertura; aditivo de quantidade soma", () => {
  assert.equal(efeitoDaVenda(v({ tipoVenda: "crosssell", tipoContratual: "UPGRADE" })), "UPGRADE");
  assert.equal(efeitoDaVenda(v({ tipoVenda: "upgrade", tipoContratual: "DOWNGRADE" })), "DOWNGRADE");
  assert.equal(efeitoDaVenda(v({ tipoVenda: "upgrade", tipoContratual: "ADITIVO" })), "UPGRADE");
  assert.equal(efeitoDaVenda(v({ tipoContratual: "ADITIVO" })), "SOMA");
});

const c = (id: string, canonicalProduct: string | null, contratoId: string | null = null) => ({ id, canonicalProduct, contratoId });

test("substituição: origem declarada vence tudo; candidato único; contrato base; mesmo produto", () => {
  assert.deepEqual(servicosSubstituidos({ origemId: "b", contratoBaseId: null, produtosNovos: ["X"], candidatos: [c("a", "A"), c("b", "B")] }), { ids: ["b"], motivo: "origem_declarada" });
  assert.deepEqual(servicosSubstituidos({ origemId: null, contratoBaseId: null, produtosNovos: ["X"], candidatos: [c("a", "A")] }), { ids: ["a"], motivo: "candidato_unico" });
  assert.deepEqual(servicosSubstituidos({ origemId: null, contratoBaseId: "k2", produtosNovos: ["X"], candidatos: [c("a", "A", "k1"), c("b", "B", "k2")] }), { ids: ["b"], motivo: "contrato_base" });
  assert.deepEqual(servicosSubstituidos({ origemId: null, contratoBaseId: null, produtosNovos: ["canais"], candidatos: [c("a", "Canais"), c("b", "Ramais")] }), { ids: ["a"], motivo: "mesmo_produto" });
});

test("substituição: na dúvida não encerra nada (cross-sell do mesmo produto em outra unidade nunca é apagado por engano)", () => {
  assert.deepEqual(servicosSubstituidos({ origemId: null, contratoBaseId: null, produtosNovos: ["Pro"], candidatos: [c("a", "A"), c("b", "B")] }), { ids: [], motivo: "ambiguo" });
  assert.deepEqual(servicosSubstituidos({ origemId: null, contratoBaseId: null, produtosNovos: ["Pro"], candidatos: [] }), { ids: [], motivo: "nenhum" });
  // Origem que não é candidata (outro cliente, já inativa, outra família) é ignorada.
  assert.deepEqual(servicosSubstituidos({ origemId: "zz", contratoBaseId: null, produtosNovos: [], candidatos: [c("a", "A")] }).motivo, "candidato_unico");
});

test("renovação: família já ativa não gera serviço novo; família vazia materializa normalmente", () => {
  assert.equal(servicoRenovado("Full", [c("a", "Start"), c("b", "Full")]), "b");
  assert.equal(servicoRenovado("Outro", [c("a", "Start")]), "a");
  assert.equal(servicoRenovado("Full", []), null);
});

test("upgrade: a etapa herdada leva data e responsável ORIGINAIS (a primeira vez que foi cumprida)", () => {
  const [e1] = AI_CHECKLIST_BASE;
  const k = { workstream: e1.workstream, titulo: e1.titulo };
  const { herdadas, pendentes } = complementoDoUpgrade(AI_CHECKLIST_BASE, [
    { ...k, concluidaEm: "2026-05-01T10:00:00.000Z", concluidaPor: "recente", fulfillmentId: "f2" },
    { ...k, concluidaEm: "2026-03-01T10:00:00.000Z", concluidaPor: "original", fulfillmentId: "f1" },
  ]);
  assert.equal(herdadas.length, 1);
  assert.equal(herdadas[0].concluidaPor, "original");
  assert.equal(herdadas[0].concluidaEm, "2026-03-01T10:00:00.000Z");
  assert.equal(pendentes.length, AI_CHECKLIST_BASE.length - 1);
});
