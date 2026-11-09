import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveDoPasso, passosDaJornada } from "./motor";
import type { PlaybookDoMotor, PassoDoMotor } from "./playbook";

const passo = (o: Partial<PassoDoMotor> & { passo: string; ordem: number }): PassoDoMotor => ({
  id: o.passo, titulo: o.passo, playbook: `md ${o.passo}`, itens: [`item ${o.passo}`], prazoDias: 0, prioridade: "media",
  condicao: null, bloco: "abertura", slaHoras: null, itensCondicionais: [], varianteUpgrade: null, ...o,
});
const pb: Pick<PlaybookDoMotor, "passos"> = {
  passos: [
    passo({ passo: "contato", ordem: 1, varianteUpgrade: { titulo: "Contato do upgrade", playbook: "md up", itens: ["ligar"] } }),
    passo({ passo: "reuniao", ordem: 2, itensCondicionais: [{ complemento: "agente_ia", playbook: "md agente", itens: ["treinar agente"] }] }),
    passo({ passo: "nps", ordem: 3 }),
  ],
};

test("primeira jornada: todos os passos, e o treino do agente entra DENTRO da reunião (não vira tarefa)", () => {
  const sem = passosDaJornada(pb, { complementos: [], upgrade: false, complementosAnteriores: null });
  assert.deepEqual(sem.map((s) => s.passo.passo), ["contato", "reuniao", "nps"]);
  assert.deepEqual(sem[1].itens, ["item reuniao"]);
  const com = passosDaJornada(pb, { complementos: ["agente_ia"], upgrade: false, complementosAnteriores: null });
  assert.equal(com.length, 3);
  assert.deepEqual(com[1].itens, ["item reuniao", "treinar agente"]);
  assert.match(com[1].playbook, /md agente/);
  assert.equal(com[1].conteudoCondicional, true);
});

test("upgrade: só a tarefa de contato, na variante de upgrade", () => {
  const r = passosDaJornada(pb, { complementos: [], upgrade: true, complementosAnteriores: [] });
  assert.equal(r.length, 1);
  assert.equal(r[0].titulo, "Contato do upgrade");
  assert.deepEqual(r[0].itens, ["ligar"]);
});

test("upgrade com complemento NOVO (agente de IA isolado): contato + conteúdo específico do agente", () => {
  const r = passosDaJornada(pb, { complementos: ["agente_ia"], upgrade: true, complementosAnteriores: [] });
  assert.deepEqual(r.map((s) => s.passo.passo), ["contato", "reuniao"]);
  assert.deepEqual(r[1].itens, ["treinar agente"]);
});

test("upgrade com complemento que o cliente já tinha, ou anterior desconhecido: não repete o treino", () => {
  assert.equal(passosDaJornada(pb, { complementos: ["agente_ia"], upgrade: true, complementosAnteriores: ["agente_ia"] }).length, 1);
  assert.equal(passosDaJornada(pb, { complementos: ["agente_ia"], upgrade: true, complementosAnteriores: null }).length, 1);
});

test("passo com condição própria só existe com o complemento", () => {
  const cond: Pick<PlaybookDoMotor, "passos"> = { passos: [passo({ passo: "so_agente", ordem: 1, condicao: { complemento: "agente_ia" } })] };
  assert.equal(passosDaJornada(cond, { complementos: [], upgrade: false, complementosAnteriores: null }).length, 0);
  assert.equal(passosDaJornada(cond, { complementos: ["agente_ia"], upgrade: false, complementosAnteriores: null }).length, 1);
});

test("a chave de idempotência segue o formato combinado", () => {
  assert.equal(chaveDoPasso("ONBOARDING", "abc", "contato_boas_vindas"), "ONBOARDING:abc:contato_boas_vindas");
});
