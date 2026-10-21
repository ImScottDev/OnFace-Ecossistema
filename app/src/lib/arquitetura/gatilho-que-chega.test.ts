/**
 * Gatilho oferecido é gatilho que chega.
 *
 * Auditoria de 20/10/2026: dois editores ofereciam gatilhos que nunca chegavam.
 * Quem configurava escolhia, salvava, e nada acontecia — sem erro, sem aviso.
 *
 *  - O editor de cadência montava a lista com o catálogo do AGENTE inteiro.
 *    `prospect.created` e `prospect.response_received` não existiam em lugar
 *    nenhum do código; `lead.atribuido_ao_agente`, `agent.retomada` e
 *    `cadence.step_due` são eventos internos do runtime de agente e nunca
 *    passam pelo outbox, que é a única entrada de `dispatchAutomationEvent`.
 *  - A tela de Gatilhos do agente oferecia 15 eventos, e só 4 chegam em
 *    `executeAgent`.
 *  - O preset `pre_vendas` nascia com `LeadCreated`: gatilho morto de fábrica.
 *
 * Esta trava exige, para cada gatilho que os editores oferecem, QUEM PUBLICA e
 * QUEM CONSOME — nos dois sentidos, para que a lista também não encolha abaixo
 * do que o sistema entrega. Verificada falhando de propósito antes de entrar
 * (revertendo o `chega` de `cadence.step_due` para `["cadencia"]`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  AGENT_EVENT_CATALOG, AGENT_PRESETS, AGENT_TRIGGER_EVENTS, CADENCE_TRIGGER_EVENTS, DEFAULT_TRIGGER_CONFIG,
} from "@/lib/ai/agent-studio";
// O consumidor de verdade, não uma cópia da regra: `eventMatches` é a função
// que o dispatcher usa para decidir se um fato do outbox casa um gatilho
// configurado. `@/lib/db` conecta preguiçosamente, então importar o dispatcher
// aqui não abre banco nenhum.
import { eventMatches } from "@/lib/automations/event-dispatcher";
import { EVENT_CATALOG, eventoDeCadenciaInvalido, nomeDoGatilhoDeCadencia } from "@/components/crm2/automacoes/followup-types";
import { apelidosDeGatilho } from "@/lib/automations/event-aliases";

const SRC = path.join(process.cwd(), "src");

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ["node_modules", "migrations"].includes(e.name) ? [] : arquivos(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const FONTES = arquivos(SRC);
// A conta do universo: verde de varredura vazia não significa nada.
assert.ok(FONTES.length > 200, `só ${FONTES.length} arquivos alcançados — a varredura quebrou`);
const CODIGO = FONTES.map((p) => fs.readFileSync(p, "utf8")).join("\n");

/** Tipos de evento que alguém grava no outbox: publicador direto (`eventType: "X"`) ou ponte canônica (`{ tipo: "X", agregado:`). */
const PUBLICADOS_NO_OUTBOX = new Set(
  [...CODIGO.matchAll(/eventType: "([A-Za-z]+)"/g), ...CODIGO.matchAll(/\{ tipo: "([A-Za-z]+)", agregado:/g)].map((m) => m[1]),
);

/** Ids de evento entregues a um agente: `eventType:`/`evento:` com ponto no nome (o runtime usa o id pontuado). */
const ENTREGUES_AO_AGENTE = new Set(
  [...CODIGO.matchAll(/\bevent(?:Type)?: "([a-z][a-z_]*(?:\.[a-z][a-z_]*)+)"/g), ...CODIGO.matchAll(/\bevento: "([a-z][a-z_]*(?:\.[a-z][a-z_]*)+)"/g)].map((m) => m[1]),
);

test("todo gatilho que a cadência oferece tem fato de outbox que o dispatcher resolve", () => {
  const orfaos = CADENCE_TRIGGER_EVENTS
    .filter((ev) => ![...PUBLICADOS_NO_OUTBOX].some((publicado) => eventMatches(ev.id, publicado)))
    .map((ev) => ev.id);
  assert.deepEqual(orfaos, [], "gatilho oferecido na cadência que nenhum evento publicado casa em dispatchAutomationEvent");
});

test("a lista da cadência é manual + os eventos de outbox, e nada mais", () => {
  // O editor de cadência (EVENT_CATALOG) não pode voltar a espelhar o catálogo
  // do agente: "manual" é o único acréscimo legítimo.
  assert.deepEqual(
    EVENT_CATALOG.map((e) => e.id),
    ["manual", ...CADENCE_TRIGGER_EVENTS.map((e) => e.id)],
  );
  // Evento interno do runtime de agente nunca pode entrar na lista da cadência.
  const internos = EVENT_CATALOG.filter((e) => AGENT_EVENT_CATALOG.some((c) => c.id === e.id && !c.chega.includes("cadencia")));
  assert.deepEqual(internos.map((e) => e.id), [], "evento que só o agente recebe sendo oferecido como entrada de cadência");
});

/**
 * O outro lado da mesma moeda: oferecer é uma pergunta, JULGAR o que já está
 * salvo é outra. A lista oferecida tem um id canônico por fato; o dispatcher
 * aceita também os apelidos. Julgando o salvo pela lista oferecida, a tela
 * acusava "gatilho inválido" em cadência publicada e funcionando (caso real:
 * "Follow-up pós-proposta", salva com `proposal.sent`) e mandava trocar o
 * gatilho e republicar. Estas duas travas prendem a UI à decisão do dispatcher,
 * nos dois sentidos — nem acusar o que dispara, nem absolver o que não dispara.
 */
test("gatilho salvo com apelido que o dispatcher resolve não é acusado de inválido", () => {
  const acusadosÀTôa = CADENCE_TRIGGER_EVENTS.flatMap((ev) =>
    apelidosDeGatilho(ev.id)
      .filter((nome) => eventoDeCadenciaInvalido(nome) || nomeDoGatilhoDeCadencia(nome) !== ev.nome)
      .map((nome) => `${nome} (apelido de ${ev.id})`),
  );
  assert.deepEqual(acusadosÀTôa, [], "nome que o dispatcher resolve sendo tratado como gatilho morto na tela");
  // O caso real e o contraexemplo, por nome.
  for (const vivo of ["manual", "lead.created", "novo_lead", "AcquisitionCreated", "LeadCreated", "proposal.sent", "proposta_enviada"]) {
    assert.equal(eventoDeCadenciaInvalido(vivo), false, `${vivo} dispara de verdade e a tela chamou de inválido`);
  }
  assert.equal(eventoDeCadenciaInvalido("meeting.no_show"), true, "gatilho que nenhum evento publica deveria continuar marcado");
});

test("a tela não absolve gatilho salvo que nenhum evento publicado casa", () => {
  const absolvidosÀTôa = [...new Set(CADENCE_TRIGGER_EVENTS.flatMap((ev) => apelidosDeGatilho(ev.id)))]
    .filter((nome) => ![...PUBLICADOS_NO_OUTBOX].some((publicado) => eventMatches(nome, publicado)));
  assert.deepEqual(absolvidosÀTôa, [], "nome aceito pela tela que nenhum fato do outbox casa em dispatchAutomationEvent");
});

test("todo gatilho que a tela do agente oferece é entregue por algum chamador a executeAgent", () => {
  const orfaos = AGENT_TRIGGER_EVENTS.filter((ev) => !ENTREGUES_AO_AGENTE.has(ev.id)).map((ev) => ev.id);
  assert.deepEqual(orfaos, [], "gatilho oferecido no agente que nenhum chamador entrega ao runtime");
  // O gate que consome: sem esta comparação, gatilho configurado não filtra nada.
  const gate = fs.readFileSync(path.join(SRC, "lib", "ai-platform", "runtime", "execute-agent.ts"), "utf8");
  assert.match(gate, /configuredEvents\(version\.triggerConfig\)\.includes\(input\.eventType\)/, "o gate de evento do runtime mudou de forma: reveja esta trava");
});

test("o catálogo não guarda evento que não chega a ninguém", () => {
  const mudos = AGENT_EVENT_CATALOG.filter((ev) => ev.chega.length === 0).map((ev) => ev.id);
  assert.deepEqual(mudos, [], "evento no catálogo sem consumidor: ou declare quem o recebe, ou tire da lista");
});

test("preset e gatilho padrão de agente nascem com evento que acorda agente", () => {
  const validos = new Set(AGENT_TRIGGER_EVENTS.map((e) => e.id));
  const mortos = Object.entries(AGENT_PRESETS)
    .flatMap(([nome, preset]) => preset.events.filter((id) => !validos.has(id)).map((id) => `${nome} ← ${id}`))
    .concat(DEFAULT_TRIGGER_CONFIG.events.filter((id) => !validos.has(id)).map((id) => `DEFAULT_TRIGGER_CONFIG ← ${id}`));
  assert.deepEqual(mortos, [], "preset de agente prometendo gatilho que nunca dispara");
  for (const [nome, preset] of Object.entries(AGENT_PRESETS)) {
    assert.ok(preset.events.length > 0, `preset ${nome} sem gatilho nenhum: o agente nasceria surdo`);
  }
});
