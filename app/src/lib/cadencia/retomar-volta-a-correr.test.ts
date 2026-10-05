/**
 * Inscrição pausada e retomada volta a correr.
 *
 * O defeito: pausar (pela tela ou automaticamente, quando o cliente responde)
 * deixa `scheduled_at` NULO. A varredura do motor seleciona
 * `scheduled_at <= now`, e nulo nunca casa. "Retomar" só escrevia
 * `status = 'active'`: a inscrição voltava a parecer ativa e **nunca mais
 * executava um passo**. O lead ficava no limbo — exatamente o que a definição
 * de cadência proíbe (docs/produto/cadencias.md).
 *
 * A trava lê o código das duas pontas, porque o erro é a falta de uma linha:
 * um teste de banco não o pegaria sem antes montar uma inscrição pausada.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..", "..");
const ROTA = path.join(SRC, "api-server", "routes", "automacoes-cadencias.ts");
const MOTOR = path.join(SRC, "lib", "cadencia", "cadence-engine.ts");

const semComentarios = (fonte: string) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("retomar devolve o agendamento, senão a inscrição fica ativa e parada", () => {
  const rota = semComentarios(fs.readFileSync(ROTA, "utf8"));
  const i = rota.indexOf('parsed.data.action === "cancel"');
  assert.ok(i > 0, "o bloco de ação da inscrição mudou de forma: revise esta trava");
  const bloco = rota.slice(i, i + 1600);

  const retomar = bloco.slice(bloco.indexOf("} else {"));
  assert.match(retomar, /status:\s*"active"/, "retomar precisa voltar a inscrição para active");
  assert.match(retomar, /scheduledAt:\s*new Date\(\)/,
    "retomar sem devolver scheduledAt deixa a inscrição ativa e parada para sempre: a varredura filtra scheduledAt <= now");

  const pausar = bloco.slice(bloco.indexOf('"paused"'));
  assert.match(pausar, /scheduledAt:\s*null/,
    "pausar precisa zerar o agendamento, senão a varredura continua pegando a inscrição parada");
});

test("a varredura continua filtrando por agendamento devido", () => {
  // Se este filtro mudar, a trava acima perde o sentido e precisa ser revista
  // junto — é ele que torna `scheduledAt` nulo equivalente a "nunca mais roda".
  const motor = semComentarios(fs.readFileSync(MOTOR, "utf8"));
  assert.match(motor, /lte\(cadenceEnrollments\.scheduledAt/,
    "o sweep deixou de selecionar por scheduledAt devido");
});
