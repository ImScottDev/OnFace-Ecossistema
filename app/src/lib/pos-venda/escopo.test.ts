/**
 * O escopo vendido lido do snapshot, e o prazo original do projeto.
 *
 * Os dois eram perda silenciosa de dado: `escopoDoSnapshot` congelava os itens
 * e os descartava na leitura (a tela só via a concatenação dos nomes em
 * `produto`), e o projeto não tinha onde dizer qual prazo valia antes de
 * alguém remarcar. Sem banco: é tudo função pura.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { escopoDoSnapshot } from "./escopo";
import { relogiosDe } from "./montagem";
import type { LinhaBase } from "./leitura-base";

const snapshot = (extra: Record<string, unknown>) => ({
  versao: 1, familia: "CALLFACE_AI", produto: "Callface AI - Full + Pacote 500 Minutos",
  quantidade: 4, unidade: "usuários", mensalidade: 1200, setup: 500, recorrencia: "mensal",
  complementos: ["agente_ia"], ...extra,
});

test("o snapshot devolve a venda item a item, com quantidade e valor de cada um", () => {
  const e = escopoDoSnapshot(snapshot({
    itens: [
      { produto: "Callface AI - Full", quantidade: 4, valorTotal: 1200, natureza: "MRR", valorUnitario: 300, desconto: 10, descontoTipo: "percentual" },
      { produto: "Pacote 500 Minutos", quantidade: 1, valorTotal: 500, natureza: "USAGE" },
    ],
  }));
  assert.equal(e?.itens.length, 2);
  assert.deepEqual(e?.itens[0], {
    produto: "Callface AI - Full", quantidade: 4, valorTotal: 1200, natureza: "MRR",
    valorUnitario: 300, desconto: 10, descontoTipo: "percentual",
  });
  // Natureza é texto livre: `USAGE` existe em produção e passa inteira, sem enum que a recuse.
  assert.equal(e?.itens[1].natureza, "USAGE");
  // Item sem os três campos novos: null, não zero — zero seria um desconto que existe e vale nada.
  assert.equal(e?.itens[1].valorUnitario, null);
  assert.equal(e?.itens[1].desconto, null);
  assert.equal(e?.itens[1].descontoTipo, null);
  // Os totais continuam valendo: o item não substitui o resumo, soma a ele.
  assert.equal(e?.mensalidade, 1200);
  assert.equal(e?.setup, 500);
});

test("tipo de desconto desconhecido vira null: sem rótulo é melhor que rótulo errado", () => {
  const e = escopoDoSnapshot(snapshot({
    itens: [{ produto: "X", quantidade: 1, valorTotal: 10, natureza: "MRR", descontoTipo: "cupom_maluco" }],
  }));
  assert.equal(e?.itens[0].descontoTipo, null);
});

test("snapshot antigo, sem o campo, devolve lista vazia em vez de quebrar", () => {
  const e = escopoDoSnapshot(snapshot({}));
  assert.deepEqual(e?.itens, []);
  // E o resto do escopo segue inteiro — é o caso dos 75 projetos de produção.
  assert.equal(e?.produto, "Callface AI - Full + Pacote 500 Minutos");
});

test("item sem nada aproveitável é descartado: linha vazia parece dado e não é", () => {
  const e = escopoDoSnapshot(snapshot({
    itens: [
      { produto: null, quantidade: null, valorTotal: null, natureza: "MRR" },
      "não é objeto",
      null,
      { produto: "Callface AI - Full", quantidade: null, valorTotal: null, natureza: null },
    ],
  }));
  assert.equal(e?.itens.length, 1);
  assert.equal(e?.itens[0].produto, "Callface AI - Full");
});

test("número que chegou como texto no jsonb vira número", () => {
  const e = escopoDoSnapshot(snapshot({ itens: [{ produto: "X", quantidade: "3", valorTotal: "1200.50", natureza: "MRR" }] }));
  assert.equal(e?.itens[0].quantidade, 3);
  assert.equal(e?.itens[0].valorTotal, 1200.5);
});

test("itens não-array é ignorado, não derruba a leitura", () => {
  assert.deepEqual(escopoDoSnapshot(snapshot({ itens: "nada disso" }))?.itens, []);
});

// ---------------------------------------------------------------------------
// Prazo original do projeto
// ---------------------------------------------------------------------------

const linha = (targetAt: string | null, dueAt: string | null): LinhaBase => ({
  id: "p1", tipo: "ONBOARDING", status: "IN_PROGRESS", ciclo: 1, familia: "CALLFACE_AI",
  servicoId: "s1", oportunidadeId: null, anteriorId: null, etapasHerdadas: null, snapshot: null,
  publicToken: "t", entrouEm: "2026-11-01T12:00:00.000Z", concluidoEm: null,
  dueAt, targetAt, responsavel: null, vendedor: null,
  empresa: { id: "e1", nome: "Empresa", documento: null, resolvida: true },
});

const agora = new Date("2026-11-09T12:00:00.000Z");

test("prazo remarcado: a tela recebe o prazo vigente e o que valia antes", () => {
  const r = relogiosDe(linha("2026-11-16T12:00:00.000Z", "2026-11-20T12:00:00.000Z"), null, [], agora);
  assert.equal(r.venceEmOriginal?.toISOString(), "2026-11-16T12:00:00.000Z");
});

test("prazo nunca mexido não inventa um 'era'", () => {
  const igual = "2026-11-16T12:00:00.000Z";
  assert.equal(relogiosDe(linha(igual, igual), null, [], agora).venceEmOriginal, null);
});

test("projeto sem prazo nenhum: nem vencimento nem original, e não conta atraso", () => {
  const r = relogiosDe(linha(null, null), null, [], agora);
  assert.equal(r.venceEmOriginal, null);
  // `temPrazoReal` suprime o julgamento sobre prazo que ninguém combinou.
  assert.equal(r.venceEm, null);
  assert.equal(r.diasDeAtraso, null);
  // Tempo decorrido é fato e continua: 8 dias desde 01/11.
  assert.equal(r.horasCorridas, 192);
});
