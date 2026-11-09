import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularRelogios, complementosDosProdutos, dataDe, estadoDaTarefa, estadoDoProjeto, faixaDoNps, iniciaisDe, vencimentoDoPasso } from "./regras";

const T0 = new Date("2026-11-01T12:00:00Z");
const h = (n: number) => new Date(T0.getTime() + n * 3_600_000);

test("sem espera os dois relógios andam juntos", () => {
  const r = calcularRelogios({ entrouEm: T0, concluidoEm: null, agora: h(48), prazoDias: 15, esperas: [] });
  assert.equal(r.horasCorridas, 48);
  assert.equal(r.horasDoTime, 48);
  assert.equal(r.esperando, null);
  assert.equal(r.consumoDoPrazo, 0.13);
  assert.ok(r.diasDeAtraso! < 0);
});

test("espera de cliente fechada desconta do time e não do cliente", () => {
  const r = calcularRelogios({ entrouEm: T0, concluidoEm: null, agora: h(48), prazoDias: 15,
    esperas: [{ motivo: "cliente", inicio: h(10), fim: h(34), detalhe: null }] });
  assert.equal(r.horasCorridas, 48);
  assert.equal(r.horasDoTime, 24);
  assert.deepEqual(r.esperaAcumulada, { cliente: 24, operadora: 0, interno: 0 });
});

test("espera aberta congela o relógio do time e aparece em `esperando`", () => {
  const e = [{ motivo: "operadora" as const, inicio: h(20), fim: null, detalhe: "portabilidade da Vivo" }];
  const a = calcularRelogios({ entrouEm: T0, concluidoEm: null, agora: h(30), prazoDias: 25, esperas: e });
  const b = calcularRelogios({ entrouEm: T0, concluidoEm: null, agora: h(60), prazoDias: 25, esperas: e });
  assert.equal(a.horasDoTime, 20);
  assert.equal(b.horasDoTime, 20, "horasDoTime não anda enquanto a espera está aberta");
  assert.equal(b.esperando?.detalhe, "portabilidade da Vivo");
  assert.equal(b.esperaAcumulada.operadora, 40);
});

test("espera interna não pausa o time, mas entra no acumulado", () => {
  const r = calcularRelogios({ entrouEm: T0, concluidoEm: null, agora: h(10), prazoDias: 15,
    esperas: [{ motivo: "interno", inicio: h(2), fim: h(6), detalhe: null }] });
  assert.equal(r.horasDoTime, 10);
  assert.equal(r.esperaAcumulada.interno, 4);
});

test("projeto concluído congela os relógios e ignora espera aberta depois da conclusão", () => {
  const r = calcularRelogios({ entrouEm: T0, concluidoEm: h(40), agora: h(500), prazoDias: 15,
    esperas: [{ motivo: "cliente", inicio: h(30), fim: null, detalhe: null }] });
  assert.equal(r.horasCorridas, 40);
  assert.equal(r.horasDoTime, 30);
  assert.equal(r.esperando, null);
});

test("estourou o prazo: atraso positivo e consumo acima de 1", () => {
  const r = calcularRelogios({ entrouEm: T0, concluidoEm: null, agora: h(24 * 20), prazoDias: 15, esperas: [] });
  assert.equal(r.diasDeAtraso, 5);
  assert.ok(r.consumoDoPrazo! > 1);
});

test("SLA de 2 horas vence o prazo em dias; bloco de encerramento começa no dia 5", () => {
  const pb = { blocos: { abertura: 5, execucao: 0, encerramento: 10 } };
  assert.equal(vencimentoDoPasso(pb, { bloco: "abertura", prazoDias: 0, slaHoras: 2 }, T0).getTime(), h(2).getTime());
  assert.equal(vencimentoDoPasso(pb, { bloco: "encerramento", prazoDias: 5 }, T0).getTime(), h(24 * 10).getTime());
  assert.equal(vencimentoDoPasso(pb, { bloco: "encerramento", prazoDias: 10 }, T0).getTime(), h(24 * 15).getTime());
});

test("mapeamentos de estado e NPS", () => {
  assert.equal(estadoDoProjeto("IN_PROGRESS", true), "AGUARDANDO");
  assert.equal(estadoDoProjeto("BLOCKED_PROVIDER", false), "AGUARDANDO");
  assert.equal(estadoDoProjeto("COMPLETED", true), "CONCLUIDO");
  assert.equal(estadoDaTarefa("declinada", false), "NAO_SE_APLICA");
  assert.equal(estadoDaTarefa("a_fazer", true), "CONCLUIDA");
  assert.equal(faixaDoNps(6), "detrator");
  assert.equal(faixaDoNps(7), "neutro");
  assert.equal(faixaDoNps(9), "promotor");
  assert.equal(faixaDoNps(null), null);
});

test("complementos e utilitários", () => {
  assert.deepEqual(complementosDosProdutos(["Callface AI - Agente IA · Mensal"]), ["agente_ia"]);
  assert.deepEqual(complementosDosProdutos(["Callface AI - Pro"]), ["agente_ia"]);
  assert.deepEqual(complementosDosProdutos(["Callface AI - Full · mensal", "Callface AI - Starter"]), []);
  assert.equal(dataDe("lixo"), null);
  assert.equal(iniciaisDe("Victoria da Silva"), "VD");
  assert.equal(iniciaisDe(null), "?");
});
