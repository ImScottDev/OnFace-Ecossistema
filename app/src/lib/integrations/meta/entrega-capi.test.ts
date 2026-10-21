/**
 * As duas promessas que o arquivo faz no cabeçalho, verificadas: `event_id`
 * determinístico pelo FATO (não pela linha da fila) e `event_time` do fato
 * (não do envio). Teste puro, sem banco e sem rede.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveDoFato, instanteDoFato, tipoNaPolitica } from "./entrega-capi";
import { POLITICA_EVENTOS, regraDoEvento } from "@onface/integrations-meta";

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

test("a jornada comercial inteira tem destino na Meta, etapa por etapa", () => {
  // Cada estágio que o Scott cobrou, e o que a Meta recebe. O teste existe
  // porque metade disto estava sem mapeamento: o evento entrava na fila e
  // morria em "sem_mapeamento", em silêncio.
  const jornada: Array<[string, Record<string, unknown>, string]> = [
    ["AcquisitionCreated", {}, "Lead"],
    ["AcquisitionQualified", {}, "QualifiedLead"],
    ["AcquisitionDisqualified", {}, "LeadDisqualified"],
    ["MeetingScheduled", {}, "Schedule"],
    ["OpportunityCreated", {}, "OpportunityCreated"],
    ["OpportunityStageChanged", { para: "reuniao_realizada" }, "MeetingHeld"],
    ["OpportunityStageChanged", { para: "diagnostico" }, "MeetingHeld"],
    ["ProposalSent", {}, "ProposalSent"],
    ["OpportunityStageChanged", { para: "negociacao" }, "NegotiationStarted"],
    ["OpportunityStageChanged", { para: "negociacao_iniciada" }, "NegotiationStarted"],
    ["ProposalAccepted", {}, "ProposalAccepted"],
    ["OpportunityWon", {}, "OpportunityWon"],
    ["DealWon", {}, "OpportunityWon"],
    ["OpportunityLost", {}, "OpportunityLost"],
    ["PaymentConfirmed", {}, "Purchase"],
    ["PaymentCompleted", {}, "Purchase"],
  ];
  for (const [eventType, payload, esperado] of jornada) {
    const regra = regraDoEvento(tipoNaPolitica(eventType, payload));
    assert.ok(regra, `${eventType} não tem destino na Meta: morre em "sem_mapeamento"`);
    assert.equal(regra!.nomeMeta, esperado, `${eventType} foi para o evento errado`);
  }
});

test("etapa sem sinal novo NÃO vira evento: duplicar inflaria a conversão", () => {
  // Proposta, ganho, perda e desqualificação já têm evento próprio.
  for (const etapa of ["proposta", "proposta_apresentada", "ganho", "perdido", "desqualificado", "entrada"]) {
    assert.equal(regraDoEvento(tipoNaPolitica("OpportunityStageChanged", { para: etapa })), null,
      `a etapa ${etapa} virou evento e vai contar a mesma conversão duas vezes`);
  }
});

test("desfecho negativo é marcado, para ninguém configurar como conversão a otimizar", () => {
  for (const nome of ["AcquisitionDisqualified", "OpportunityLost"] as const) {
    assert.equal(POLITICA_EVENTOS[nome].desfecho, "negativo",
      `${nome} sem marca de desfecho: alguém configura como objetivo e a Meta busca quem não fecha`);
    assert.equal(POLITICA_EVENTOS[nome].padrao, false, "desfecho negativo não é evento padrão da Meta");
  }
});

test("mudança de etapa sem a etapa no payload não inventa evento", () => {
  assert.equal(regraDoEvento(tipoNaPolitica("OpportunityStageChanged", {})), null);
  assert.equal(regraDoEvento(tipoNaPolitica("OpportunityStageChanged", null)), null);
});
