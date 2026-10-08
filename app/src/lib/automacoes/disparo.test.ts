/**
 * Gatilho de evento dos Fluxos (disparo.ts, contrato §3.1 e §3.5).
 * Os dois primeiros testes são puros; o terceiro liga uma automação de teste
 * no banco local, dispara eventos à mão e apaga tudo no fim.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, fecharConexao } from "@/lib/db";
import { automacaoExecucoes, automacoes } from "@/lib/db/schema";
import { CONFIG_PADRAO, EVENTOS_PLATAFORMA } from "./grafo";
import { atualizarFluxo, criarFluxo, publicarFluxo } from "./fluxos-servico";
import { dispararFluxosPorEvento, dispararFluxosPorGatilhoLegado, entidadeDoEvento } from "./disparo";

const criadas: string[] = [];
after(async () => {
  for (const id of criadas) await db.delete(automacoes).where(eq(automacoes.id, id));
  await fecharConexao();
});

test("cada evento tem UMA fonte e nenhum tipo do outbox aparece em dois eventos", () => {
  const vistos = new Map<string, string>();
  for (const e of EVENTOS_PLATAFORMA) {
    assert.ok(Boolean(e.fontes.outbox?.length) !== Boolean(e.fontes.legado), `${e.id}: outbox OU legado, nunca os dois`);
    for (const t of e.fontes.outbox ?? []) {
      assert.ok(!vistos.has(t), `${t} dispararia ${vistos.get(t)} e ${e.id}`);
      vistos.set(t, e.id);
    }
  }
});

test("entidade do evento: canônico vira o id legado que as telas conhecem", () => {
  const n = randomUUID(), l = randomUUID(), o = randomUUID();
  assert.deepEqual(entidadeDoEvento({ aggregateType: "oportunidade", aggregateId: o, payload: { negocio_legado_id: n } }, "negocio"), { tipo: "negocio", id: n });
  assert.deepEqual(entidadeDoEvento({ aggregateType: "aquisicao", aggregateId: o, payload: { lead_legado_id: l } }, "lead"), { tipo: "lead", id: l });
  assert.deepEqual(entidadeDoEvento({ aggregateType: "x", aggregateId: o, payload: { entityType: "contato", entityId: l } }, "lead"), { tipo: "contato", id: l });
  assert.deepEqual(entidadeDoEvento({ aggregateType: "lead", aggregateId: l, payload: {} }, "lead"), { tipo: "lead", id: l });
  assert.equal(entidadeDoEvento({ aggregateType: "x", aggregateId: "nao-uuid", payload: {} }, "lead"), null);
});

test("evento dispara uma vez por fato; replay, carimbo de automação e gatilho legado duplicado não disparam", async () => {
  const [u] = await db.execute<{ id: string; org: string }>(sql`SELECT id, organizacao_id AS org FROM usuarios WHERE role = 'admin' AND ativo = true ORDER BY created_at LIMIT 1`);
  const [lead] = await db.execute<{ id: string }>(sql`SELECT id FROM leads WHERE organizacao_id = ${u.org}::uuid ORDER BY updated_at DESC LIMIT 1`);
  const f = await criarFluxo(u.org, u.id, {
    nome: "[teste disparo]",
    config: { ...CONFIG_PADRAO, reentrada: "sempre" }, // só o carimbo/replay podem barrar
    grafo: {
      versao: 1,
      nos: [
        { id: "n1", tipo: "gatilho", posicao: { x: 0, y: 0 }, config: { modo: "evento", evento: "lead.criado", filtros: [], permitirOrigemAutomacao: false } },
        { id: "n2", tipo: "esperar", posicao: { x: 0, y: 160 }, config: { quantidade: 1, unidade: "minutos" } },
      ],
      arestas: [{ id: "e1", origem: "n1", saida: "ok", destino: "n2" }],
    },
  });
  criadas.push(f.id);
  await publicarFluxo(u.org, f.id, u.id);
  await atualizarFluxo(u.org, f.id, { ativo: true });

  const evento = { id: randomUUID(), organizacaoId: u.org, eventType: "LeadCreated", aggregateType: "lead", aggregateId: lead.id, payload: { origem: "teste" } };
  assert.equal(await dispararFluxosPorEvento(evento), 1, "fato novo dispara");
  assert.equal(await dispararFluxosPorEvento(evento), 0, "o mesmo evento reentregue pelo outbox não dispara de novo");
  assert.equal(await dispararFluxosPorEvento({ ...evento, id: randomUUID(), payload: { _automacao: { automacaoId: randomUUID(), execucaoId: randomUUID(), profundidade: 0 } } }), 0,
    "evento produzido por outra automação é descartado");
  assert.equal(await dispararFluxosPorGatilhoLegado("novo_lead", { organizacaoId: u.org, entityType: "lead", entityId: lead.id, campos: {} }), 0,
    "novo_lead também vira outbox: ouvir os dois dispararia em dobro");

  assert.equal(await dispararFluxosPorEvento({ ...evento, id: randomUUID(), eventType: "AcquisitionCreated", aggregateType: "aquisicao", aggregateId: randomUUID(), payload: { lead_legado_id: lead.id } }), 0,
    "o mesmo fato gravado em dois tipos de evento (legado e canônico) roda a automação uma vez só");

  const execs = await db.select().from(automacaoExecucoes).where(eq(automacaoExecucoes.automacaoId, f.id));
  assert.equal(execs.length, 1);
  assert.equal(execs[0].modo, "evento");
  assert.deepEqual([execs[0].entityType, execs[0].entityId], ["lead", lead.id]);
  assert.equal(execs[0].idempotencyKey, `evento:${f.id}:${evento.id}`);
});
