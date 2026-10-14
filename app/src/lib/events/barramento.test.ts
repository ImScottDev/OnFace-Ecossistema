import test from "node:test";
import assert from "node:assert/strict";
import { publicarNoBarramento, montarEventoBarramento, ambienteDoBarramento } from "./barramento";

const evento = {
  id: "11111111-1111-4111-8111-111111111111",
  organizacaoId: "22222222-2222-4222-8222-222222222222",
  eventType: "ProposalAccepted",
  aggregateType: "proposta",
  aggregateId: "33333333-3333-4333-8333-333333333333",
  payload: { propostaId: "33333333-3333-4333-8333-333333333333", email: "a@b.com", nome: "Fulano" },
  correlationId: null, idempotencyKey: null, status: "pending", attempts: 0, lastError: null,
  processingStartedAt: null, processedAt: null, createdAt: new Date("2026-10-13T12:00:00Z"),
} as never;

test("o mesmo evento do outbox gera o mesmo id_evento, sem dado pessoal", () => {
  const a = montarEventoBarramento(evento, "PABX");
  const b = montarEventoBarramento(evento, "PABX");
  assert.equal(a.id_evento, b.id_evento);
  assert.equal(a.id_evento, "11111111-1111-4111-8111-111111111111");
  assert.equal(a.evento, "proposta.aceita");
  assert.ok(!JSON.stringify(a).includes("a@b.com") && !JSON.stringify(a).includes("Fulano"));
});

test("sem configuração, o consumidor não publica e não quebra", async () => {
  const antes = [process.env.ONFACE_BARRAMENTO_URL, process.env.ONFACE_BARRAMENTO_TOKEN];
  delete process.env.ONFACE_BARRAMENTO_URL;
  delete process.env.ONFACE_BARRAMENTO_TOKEN;
  try {
    const r = await publicarNoBarramento(evento, { fetch: (() => { throw new Error("não devia chamar"); }) as never });
    assert.deepEqual(r, { publicado: false, motivo: "sem_configuracao" });
  } finally {
    if (antes[0]) process.env.ONFACE_BARRAMENTO_URL = antes[0];
    if (antes[1]) process.env.ONFACE_BARRAMENTO_TOKEN = antes[1];
  }
});

test("n8n fora (não-2xx) lança para o sweep tentar de novo", async () => {
  process.env.ONFACE_BARRAMENTO_URL = "http://n8n.invalido/x";
  process.env.ONFACE_BARRAMENTO_TOKEN = "t";
  try {
    await assert.rejects(publicarNoBarramento(evento, {
      fetch: (async () => new Response("", { status: 503 })) as never,
      familia: async () => "DESCONHECIDA",
    }), /503/);
  } finally {
    delete process.env.ONFACE_BARRAMENTO_URL;
    delete process.env.ONFACE_BARRAMENTO_TOKEN;
  }
});

test("o evento diz de qual ambiente veio, para o n8n não tratar homologação como venda real", () => {
  const antes = { ...process.env };
  try {
    process.env.NEXTAUTH_URL = "https://crm.callface.io";
    assert.equal(ambienteDoBarramento(), "producao");

    process.env.NEXTAUTH_URL = "https://dev.crm.callface.io";
    assert.equal(ambienteDoBarramento(), "homologacao", "dev. não é produção, mesmo contendo o domínio");

    delete process.env.NEXTAUTH_URL; delete process.env.AUTH_URL; delete process.env.NEXT_PUBLIC_APP_URL;
    assert.equal(ambienteDoBarramento(), "homologacao", "sem URL, nunca se declara produção");
  } finally {
    process.env = antes;
  }
});
