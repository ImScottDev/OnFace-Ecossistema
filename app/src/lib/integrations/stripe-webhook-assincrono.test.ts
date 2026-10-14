/**
 * Webhook do Stripe: a requisição só enfileira; o efeito acontece no worker, uma vez só.
 * Puro: portas em memória, sem banco, sem Redis, sem Stripe.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { aceitarEvento, executarComPortas, type LinhaInbox, type PortasInbox } from "./stripe-webhook-inbox";

function portas(status = "pending") {
  const estado = { status, fila: [] as { eventId: string; atraso?: number }[], processou: 0, auditorias: [] as string[] };
  const linha: LinhaInbox = { id: "i1", eventId: "evt_1", eventType: "invoice.paid", status, organizacaoId: "org", attempts: 0, payload: { id: "evt_1", type: "invoice.paid" } };
  const p: PortasInbox = {
    claim: async () => {
      if (["processed", "processing"].includes(estado.status)) return null;
      estado.status = "processing"; return linha;
    },
    situacao: async () => ({ status: estado.status }),
    resolverOrganizacao: async () => "org",
    definirOrganizacao: async () => {},
    devolverUnresolved: async () => {},
    marcarProcessado: async () => { estado.status = "processed"; },
    marcarFalho: async () => { estado.status = "failed"; },
    auditar: async (_o, acao) => { estado.auditorias.push(acao); },
    enfileirar: async (eventId, _t, atraso) => { estado.fila.push({ eventId, atraso }); },
    processar: async () => { estado.processou++; return { passos: ["ok"] }; },
  };
  return { p, estado };
}

test("webhook responde sem esperar o processamento", async () => {
  const { p, estado } = portas();
  // processamento que nunca termina: se a requisição esperasse por ele, o teste travaria.
  p.processar = () => new Promise(() => {});
  const t0 = Date.now();
  const r = await aceitarEvento(p, "i1", "evt_1");
  assert.equal(r.estado, "enfileirado");
  assert.ok(Date.now() - t0 < 100);
  assert.deepEqual(estado.fila, [{ eventId: "evt_1", atraso: 0 }]);
});

test("fila recusa: não finge sucesso (o chamador devolve 500 e o Stripe reentrega)", async () => {
  const { p } = portas();
  p.enfileirar = async () => { throw new Error("redis fora"); };
  const r = await aceitarEvento(p, "i1", "evt_1");
  assert.equal(r.estado, "nao_enfileirado");
  assert.match((r as { erro: string }).erro, /redis fora/);
});

test("evento repetido não produz efeito duplicado", async () => {
  const { p, estado } = portas();
  // 3 entregas do Stripe + 2 jobs na fila para o mesmo evento
  await aceitarEvento(p, "i1", "evt_1"); await aceitarEvento(p, "i1", "evt_1");
  const rs = await Promise.all([executarComPortas(p, "i1", { enfileirarSeFalhar: false }), executarComPortas(p, "i1", { enfileirarSeFalhar: false })]);
  assert.equal(estado.processou, 1, "o claim deixa só um executor processar");
  assert.ok(rs.some((r) => r.estado === "processado"));
  // depois de processado, nova entrega é duplicata e nem entra na fila
  const filaAntes = estado.fila.length;
  assert.equal((await aceitarEvento(p, "i1", "evt_1")).estado, "ja_processado");
  assert.equal((await executarComPortas(p, "i1", { enfileirarSeFalhar: false })).estado, "ja_processado");
  assert.equal(estado.fila.length, filaAntes);
  assert.equal(estado.processou, 1);
});

test("falha no worker fica visível: failed + auditoria + erro lançado para o retry", async () => {
  const { p, estado } = portas();
  p.processar = async () => { throw new Error("sync estourou"); };
  const r = await executarComPortas(p, "i1", { enfileirarSeFalhar: false });
  assert.equal(r.estado, "falhou");
  assert.equal(estado.status, "failed");
  assert.ok(estado.auditorias.includes("stripe.webhook_falhou"));
});
