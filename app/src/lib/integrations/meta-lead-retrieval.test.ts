/**
 * Busca do lead na Graph API (SPEC §20).
 *
 * O ponto central: **o webhook de leadgen não traz os dados do lead.** Ele
 * avisa que existe um lead e entrega o `leadgen_id`. Um webhook que assume
 * `field_data` no payload funciona com o integrador que já buscou por nós e
 * falha em silêncio quando a Meta chama direto.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buscarLeadNaGraph, combinar, normalizarLeadAds, chaveDeIdempotencia } from "@onface/integrations-meta";

/** fetch de mentira, para exercitar o adapter sem tocar a Meta. */
function fetchFalso(status: number, corpo: unknown): typeof fetch {
  return (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
    text: async () => JSON.stringify(corpo),
  })) as unknown as typeof fetch;
}

test("sem token, diz que é configuração ausente e não tenta", async () => {
  const r = await buscarLeadNaGraph("123", null);
  assert.equal(r.ok, false);
  assert.equal(r.semCredencial, true, "config ausente não é falha de integração");
  assert.ok(!r.tentarDeNovo, "não adianta repetir o que não está configurado");
  assert.match(r.erro ?? "", /META_LEADS_ACCESS_TOKEN/);
});

test("permissão negada NÃO vira retry infinito", async () => {
  // Erro 10, 200 e 190 são permissão e token: repetir dá o mesmo resultado, e
  // tratá-los como transitório encheria a fila de tentativas que nunca passam.
  for (const codigo of [10, 200, 190]) {
    const r = await buscarLeadNaGraph("123", "tok", fetchFalso(403, { error: { code: codigo, message: "sem permissão" } }));
    assert.equal(r.ok, false);
    assert.equal(r.semPermissao, true, `código ${codigo} deveria ser marcado como permissão`);
    assert.ok(!r.tentarDeNovo, `código ${codigo} não deveria pedir retry`);
  }
});

test("limite de taxa e erro da Meta pedem retry", async () => {
  for (const codigo of [4, 17, 1, 2]) {
    const r = await buscarLeadNaGraph("123", "tok", fetchFalso(400, { error: { code: codigo, message: "limite" } }));
    assert.equal(r.tentarDeNovo, true, `código ${codigo} é transitório`);
    assert.ok(!r.semPermissao);
  }
  const r500 = await buscarLeadNaGraph("123", "tok", fetchFalso(503, {}));
  assert.equal(r500.tentarDeNovo, true, "5xx é transitório por definição");
});

test("a busca traz o que o webhook não tem, e os dois se combinam", async () => {
  // Isto é o cenário real: o webhook entrega o envelope, a Graph entrega o lead.
  const doWebhook = { leadgen_id: "L1", page_id: "P1", form_id: "F1" };
  const daGraph = await buscarLeadNaGraph("L1", "tok", fetchFalso(200, {
    id: "L1",
    created_time: "2026-09-21T10:00:00+0000",
    ad_id: "A1", campaign_id: "C1", campaign_name: "Setembro",
    field_data: [
      { name: "full_name", values: ["Carla Dias"] },
      { name: "email", values: ["carla@empresa.com"] },
      { name: "phone_number", values: ["+55 11 97777-6666"] },
    ],
  }));
  assert.equal(daGraph.ok, true);

  const juntos = combinar(doWebhook, daGraph.lead);
  // O webhook mantém o que só ele tem.
  assert.equal(juntos.page_id, "P1");
  // A Graph entrega o que o webhook não tinha.
  const n = normalizarLeadAds(juntos);
  assert.equal(n.nome, "Carla Dias");
  assert.equal(n.email, "carla@empresa.com");
  assert.equal(n.atribuicao.campaignId, "C1");
  assert.equal(n.atribuicao.utmCampaign, "Setembro");
});

test("sem a busca, o lead da Meta chega sem identidade nenhuma", () => {
  // Esta é a razão de o retrieval ser obrigatório: é exatamente o que
  // aconteceria se o webhook confiasse no payload.
  const soEnvelope = normalizarLeadAds({ leadgen_id: "L1", page_id: "P1", form_id: "F1" });
  assert.equal(soEnvelope.email, null);
  assert.equal(soEnvelope.telefone, null);
  assert.equal(soEnvelope.nome, null);

  // E mesmo assim a idempotência funciona, porque o leadgen_id basta para ela.
  assert.equal(chaveDeIdempotencia(soEnvelope), "meta:leadgen:L1");
});

test("a idempotência é pelo leadgen_id, com ou sem retrieval", () => {
  // A Meta reentrega o webhook quando não recebe 200 a tempo. O mesmo lead,
  // buscado ou não, tem que dar a mesma chave.
  const semBusca = normalizarLeadAds({ leadgen_id: "L9" });
  const comBusca = normalizarLeadAds({
    leadgen_id: "L9",
    field_data: [{ name: "email", values: ["x@y.com"] }],
  });
  assert.equal(chaveDeIdempotencia(semBusca), chaveDeIdempotencia(comBusca));
});
