import test from "node:test";
import assert from "node:assert/strict";
import { TETO_PADRAO_USD, custoEstimadoDoSdk, estourouTeto, motivoDoTeto, precoPorTokens, tetosConfigurados } from "./custo";

/**
 * Regressão de 20/10/2026: "Custo por execução: R$ 0,00" com 229 execuções em
 * produção. Os tokens eram gravados; o custo da assinatura (`total_cost_usd`
 * do SDK) era jogado fora e a coluna recebia zero fixo. Painel que não sabe
 * quanto gastou não serve de teto — e o teto passou a ser de GASTO, porque o
 * limite de mensagens por hora foi solto de propósito.
 */

const AGENTE = "11111111-1111-1111-1111-111111111111";
const OUTRO = "22222222-2222-2222-2222-222222222222";

test("custo sai do usage do modelo e da tabela de preços", () => {
  // claude-sonnet-4-6: US$ 3/milhão na entrada, US$ 15/milhão na saída.
  const preco = { inputPricePerMillion: "3.000000", outputPricePerMillion: "15.000000" };
  assert.equal(precoPorTokens(1_000_000, 0, preco), 3);
  assert.equal(precoPorTokens(0, 1_000_000, preco), 15);
  assert.ok(Math.abs(precoPorTokens(11_837, 934, preco) - 0.049521) < 1e-6);
});

test("sem preço cadastrado o custo é zero, não quebra", () => {
  assert.equal(precoPorTokens(10_000, 500, null), 0);
});

test("a estimativa do SDK vira o custo gravado", () => {
  assert.equal(custoEstimadoDoSdk(0.0430857), 0.0430857);
});

test("sem estimativa do SDK cai na tabela de preços em vez de gravar zero", () => {
  // O `?? calculateCost(...)` só acontece quando isto devolve null.
  assert.equal(custoEstimadoDoSdk(0), null);
  assert.equal(custoEstimadoDoSdk(null), null);
  assert.equal(custoEstimadoDoSdk(undefined), null);
  assert.equal(custoEstimadoDoSdk(Number.NaN), null);
});

test("sem orçamento configurado vale o teto padrão", () => {
  assert.deepEqual(tetosConfigurados([], AGENTE), { dia: TETO_PADRAO_USD.dia, mes: TETO_PADRAO_USD.mes });
});

test("orçamento configurado manda, e cobre só o período que ele define", () => {
  const tetos = tetosConfigurados([
    { agentId: null, period: "daily", costLimit: "5.0000", hardStop: true, ativo: true },
  ], AGENTE);
  assert.deepEqual(tetos, { dia: 5, mes: TETO_PADRAO_USD.mes });
});

test("teto zero quer dizer sem teto", () => {
  const tetos = tetosConfigurados([
    { agentId: null, period: "daily", costLimit: "0", hardStop: true, ativo: true },
    { agentId: null, period: "monthly", costLimit: null, hardStop: true, ativo: true },
  ], AGENTE);
  assert.deepEqual(tetos, { dia: null, mes: null });
});

test("orçamento só de aviso não bloqueia", () => {
  const tetos = tetosConfigurados([
    { agentId: null, period: "daily", costLimit: "5.0000", hardStop: false, ativo: true },
  ], AGENTE);
  assert.equal(tetos.dia, null);
});

test("orçamento de outro agente não vale para este", () => {
  const tetos = tetosConfigurados([
    { agentId: OUTRO, period: "daily", costLimit: "1.0000", hardStop: true, ativo: true },
  ], AGENTE);
  assert.equal(tetos.dia, TETO_PADRAO_USD.dia);
});

test("entre dois tetos do mesmo período vale o mais apertado", () => {
  const tetos = tetosConfigurados([
    { agentId: null, period: "daily", costLimit: "50", hardStop: true, ativo: true },
    { agentId: AGENTE, period: "daily", costLimit: "7", hardStop: true, ativo: true },
  ], AGENTE);
  assert.equal(tetos.dia, 7);
});

test("orçamento inativo é ignorado", () => {
  const tetos = tetosConfigurados([
    { agentId: null, period: "daily", costLimit: "1", hardStop: true, ativo: false },
  ], AGENTE);
  assert.equal(tetos.dia, TETO_PADRAO_USD.dia);
});

test("teto não estourado deixa passar", () => {
  assert.equal(estourouTeto({ dia: 3.5, mes: 42 }, { dia: 20, mes: 200 }), null);
});

test("teto estourado no dia bloqueia com o motivo certo", () => {
  const e = estourouTeto({ dia: 20, mes: 42 }, { dia: 20, mes: 200 });
  assert.deepEqual(e, { periodo: "dia", gasto: 20, teto: 20 });
  assert.equal(motivoDoTeto(e!), "teto_de_gasto_dia");
});

test("teto estourado no mês bloqueia com o motivo certo", () => {
  const e = estourouTeto({ dia: 1, mes: 250 }, { dia: 20, mes: 200 });
  assert.deepEqual(e, { periodo: "mes", gasto: 250, teto: 200 });
  assert.equal(motivoDoTeto(e!), "teto_de_gasto_mes");
});

test("sem teto nenhum, gasto nenhum bloqueia", () => {
  assert.equal(estourouTeto({ dia: 9_999, mes: 99_999 }, { dia: null, mes: null }), null);
});
