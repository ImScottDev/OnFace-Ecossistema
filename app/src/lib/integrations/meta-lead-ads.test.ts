/**
 * Adapter de Lead Ads da Meta (SPEC §20).
 *
 * O normalizador é onde o lead de campanha paga se perde: formulário
 * personalizado não usa nome de campo padrão, a Meta entrega `field_data` como
 * lista de listas, e integrador entrega achatado. Errar aqui é perder lead
 * pago, que é o erro mais caro do funil.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarLeadAds, chaveDeIdempotencia, montarEventoCapi, hashCapi,
} from "@onface/integrations-meta";

test("lê o formato nativo da Meta, com field_data", () => {
  const n = normalizarLeadAds({
    leadgen_id: "1234567890",
    created_time: 1789000000,
    ad_id: "ad_1", adset_id: "adset_1", campaign_id: "camp_1",
    ad_name: "Criativo A", adset_name: "Conjunto SP", campaign_name: "Callface AI Setembro",
    field_data: [
      { name: "full_name", values: ["Maria Souza"] },
      { name: "email", values: ["maria@empresa.com.br"] },
      { name: "phone_number", values: ["+55 11 98888-7777"] },
      { name: "company_name", values: ["Empresa LTDA"] },
      { name: "qual_seu_maior_desafio", values: ["Perco ligação de cliente"] },
    ],
  });

  assert.equal(n.nome, "Maria Souza");
  assert.equal(n.email, "maria@empresa.com.br");
  assert.equal(n.telefone, "+55 11 98888-7777");
  assert.equal(n.empresa, "Empresa LTDA");
  assert.equal(n.atribuicao.campaignId, "camp_1");
  assert.equal(n.atribuicao.utmCampaign, "Callface AI Setembro");
  assert.equal(n.atribuicao.utmSource, "meta");

  // A pergunta do cliente é o que mais vale no formulário e não tem campo
  // padrão. Descartar o que não é identidade joga fora a qualificação.
  assert.equal(n.respostas.qual_seu_maior_desafio, "Perco ligação de cliente");
});

test("junta first_name e last_name quando não veio full_name", () => {
  const n = normalizarLeadAds({
    field_data: [
      { name: "first_name", values: ["João"] },
      { name: "last_name", values: ["Pereira"] },
      { name: "email", values: ["joao@x.com"] },
    ],
  });
  assert.equal(n.nome, "João Pereira");
});

test("aceita o formato achatado que integrador costuma mandar", () => {
  const n = normalizarLeadAds({
    leadgen_id: "9", email: "z@y.com", telefone: "11999998888", nome: "Ana",
  } as never);
  assert.equal(n.nome, "Ana");
  assert.equal(n.email, "z@y.com");
  assert.equal(n.telefone, "11999998888");
});

test("a chave de idempotência usa o id da Meta, porque ela reentrega o webhook", () => {
  const a = normalizarLeadAds({ leadgen_id: "abc", field_data: [{ name: "email", values: ["a@b.c"] }] });
  const b = normalizarLeadAds({ leadgen_id: "abc", field_data: [{ name: "email", values: ["a@b.c"] }] });
  assert.equal(chaveDeIdempotencia(a), chaveDeIdempotencia(b), "reentrega do mesmo lead tem que dar a mesma chave");
  assert.equal(chaveDeIdempotencia(a), "meta:leadgen:abc");

  // Sem id da Meta, a chave cai na identidade — nunca em timestamp, que faria
  // toda reentrega virar um lead novo.
  const semId = normalizarLeadAds({ field_data: [{ name: "email", values: ["a@b.c"] }], ad_id: "ad9" });
  assert.equal(chaveDeIdempotencia(semId), "meta:sem-id:a@b.c:ad9");

  // Sem identidade nenhuma não há chave: esse lead não entra, e é certo.
  assert.equal(chaveDeIdempotencia(normalizarLeadAds({})), null);
});

test("o CAPI manda dado pessoal hasheado, nunca em claro", () => {
  const corpo = montarEventoCapi({
    eventName: "Purchase", eventTime: 1789000000, eventId: "ev1",
    email: " Maria@Empresa.com.BR ", telefone: "(11) 98888-7777",
    valor: 1200, moeda: "BRL",
  });
  const userData = corpo.user_data as Record<string, string[]>;

  assert.ok(!JSON.stringify(corpo).includes("maria@empresa"), "e-mail foi em claro para a Meta");
  assert.ok(!JSON.stringify(corpo).includes("98888"), "telefone foi em claro para a Meta");
  assert.equal(userData.em[0], hashCapi("maria@empresa.com.br"), "o e-mail é normalizado antes do hash");
  assert.match(userData.ph[0], /^[a-f0-9]{64}$/, "o telefone precisa sair hasheado");
  assert.deepEqual(corpo.custom_data, { value: 1200, currency: "BRL" });
});

test("evento sem credencial é config ausente, não integração quebrada", async () => {
  const { enviarParaCapi } = await import("@onface/integrations-meta");
  const r = await enviarParaCapi(
    [{ eventName: "Lead", eventTime: 1, eventId: "x" }],
    { datasetId: null, accessToken: null },
  );
  assert.equal(r.ok, false);
  assert.equal(r.semCredencial, true, "sem isso, o alerta de integração dispara em ambiente nunca configurado");
});

/**
 * O formulário personalizado não usa o nome exato do campo.
 *
 * A campanha "TRT | Lead | Aquisição White Label — II" pergunta
 * `número_do_whatsapp`. O casamento era por igualdade exata contra
 * ["phone_number", "telefone", "celular", "whatsapp", "phone"], nenhum casava,
 * e o lead entrava SEM TELEFONE — com o número parado em `campos_custom`.
 * Medido em produção em 19/10/2026.
 */
test("campo do formulário que CONTÉM o sinônimo vira telefone (White Label)", () => {
  const n = normalizarLeadAds({
    leadgen_id: "1",
    field_data: [
      { name: "número_do_whatsapp", values: ["(11) 96319-4410"] },
      { name: "qual_seu_maior_interesse?", values: ["White Label"] },
    ],
  } as never);
  assert.equal(n.telefone, "(11) 96319-4410");
});

test("aproximação não rouba campo de outro papel nem aceita valor sem cara de telefone", () => {
  const n = normalizarLeadAds({
    leadgen_id: "2",
    field_data: [
      { name: "nome_da_empresa", values: ["Acme"] },
      { name: "telefone_de_contato", values: ["não tenho"] },
      { name: "full_name", values: ["Ana Souza"] },
    ],
  } as never);
  assert.equal(n.empresa, "Acme");
  assert.equal(n.nome, "Ana Souza");
  // "não tenho" não tem oito dígitos: melhor sem telefone do que com lixo.
  assert.equal(n.telefone, null);
});
