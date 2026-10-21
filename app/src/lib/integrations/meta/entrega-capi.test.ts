/**
 * As duas promessas que o arquivo faz no cabeçalho, verificadas: `event_id`
 * determinístico pelo FATO (não pela linha da fila) e `event_time` do fato
 * (não do envio). Teste puro, sem banco e sem rede.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveDoFato, instanteDoFato, tipoNaPolitica } from "./entrega-capi";

const DEI = "b540ddfa-e20b-4f08-95e7-387bff45011a";

test("o mesmo fato republicado em outra linha da fila dá a MESMA chave", () => {
  const fato = { eventType: "MeetingScheduled", aggregateId: "agg", payload: { domain_event_id: DEI } };
  assert.equal(
    chaveDoFato({ ...fato, id: "linha-1" }),
    chaveDoFato({ ...fato, id: "linha-2" }),
    "a chave seguiu o id da linha do outbox: a Meta contaria a conversão duas vezes",
  );
  assert.equal(chaveDoFato({ ...fato, id: "linha-1" }), DEI);
});

test("ganho pelos dois caminhos (DealWon legado e OpportunityWon) dedupa no negócio", () => {
  const negocio = "455a2f38-573f-4f7c-a278-e55ea6af05ad";
  const legado = chaveDoFato({ id: "o1", eventType: "DealWon", aggregateId: negocio, payload: {} });
  const canonico = chaveDoFato({ id: "o2", eventType: "OpportunityWon", aggregateId: "opp",
    payload: { negocio_legado_id: negocio, domain_event_id: DEI } });
  assert.equal(legado, canonico, "a mesma venda ganha geraria dois event_id");
  assert.equal(tipoNaPolitica("DealWon"), "OpportunityWon");
});

test("sem nenhuma chave de fato, cai no id da linha em vez de inventar", () => {
  assert.equal(chaveDoFato({ id: "linha-x", eventType: "TagAdded", aggregateId: null, payload: {} }), "linha-x");
});

test("event_time é o do fato; o da fila é só fallback", () => {
  const fila = new Date("2026-10-21T10:00:00Z");
  const fato = "2026-10-14T03:01:31.214Z";
  assert.equal(instanteDoFato({ payload: { ocorrido_em: fato }, createdAt: fila }).toISOString(),
    new Date(fato).toISOString(), "um fato de 14/10 entregue em 21/10 contaria como 21/10");
  assert.equal(instanteDoFato({ payload: {}, createdAt: fila }).getTime(), fila.getTime());
  // Data podre no payload não pode virar NaN e mandar event_time inválido.
  assert.equal(instanteDoFato({ payload: { ocorrido_em: "nao-e-data" }, createdAt: fila }).getTime(), fila.getTime());
});
