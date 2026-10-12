import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirEstadoIa, versaoAtendeSessao, type EntradaEstadoIa } from "./ia-conversa";

const base: EntradaEstadoIa = {
  agentes: [], legadoAtivo: false, pausa: null, ligada: { por: "Scott", em: "2026-10-08T11:00:00Z" }, ultimaExecucao: null, ultimaEntradaEm: null,
  sessao: { id: "s1", label: "Scott Growth", status: "connected" },
};

test("sem agente publicado: diz que não há agente e por que a mensagem ficou sem resposta", () => {
  const r = decidirEstadoIa({ ...base, ultimaEntradaEm: "2026-10-08T12:00:00Z" });
  assert.equal(r.estado, "sem_agente");
  assert.match(r.motivo, /Nenhum agente publicado/);
  assert.match(r.semResposta ?? "", /não há agente/);
});

test("agente ligado a outro número não atende este", () => {
  const r = decidirEstadoIa({ ...base, agentes: [{ id: "a", nome: "SDR", sessaoId: "s2", prioridade: 1 }] });
  assert.equal(r.estado, "sem_agente");
  assert.match(r.motivo, /outro número/);
});

test("agente sem número fixo vale para todos; pausa vence o agente", () => {
  const ag = [{ id: "a", nome: "SDR Assistente", sessaoId: null, prioridade: 1 }];
  assert.equal(decidirEstadoIa({ ...base, agentes: ag }).estado, "ativa");
  const p = decidirEstadoIa({ ...base, agentes: ag, pausa: { aiAtivo: false, motivo: "manual_toggle", por: "Scott", em: "2026-10-08T12:00:00Z" }, ultimaEntradaEm: "2026-10-08T13:00:00Z" });
  assert.equal(p.estado, "pausada");
  assert.match(p.semResposta ?? "", /pausada/);
});

test("número desconectado vira aviso e explica a falta de resposta", () => {
  const r = decidirEstadoIa({
    ...base, sessao: { id: "s1", label: "Scott Growth", status: "disconnected" },
    agentes: [{ id: "a", nome: "SDR", sessaoId: null, prioridade: 1 }], ultimaEntradaEm: "2026-10-08T12:00:00Z",
  });
  assert.equal(r.estado, "ativa");
  assert.match(r.aviso ?? "", /desconectado/);
  assert.match(r.semResposta ?? "", /desconectado/);
});

test("versão ligada a um número só atende conversa dele (regra do runtime)", () => {
  assert.equal(versaoAtendeSessao(null, "s1"), true);
  assert.equal(versaoAtendeSessao("s1", "s1"), true);
  assert.equal(versaoAtendeSessao("s1", "s2"), false);
  assert.equal(versaoAtendeSessao("s1", null), false);
});

test("agente publicado mas ninguém ligou a IA na conversa: desligada, e explica a mensagem sem resposta", () => {
  const ag = [{ id: "a", nome: "SDR Assistente", sessaoId: null, prioridade: 1 }];
  const r = decidirEstadoIa({ ...base, agentes: ag, ligada: null, ultimaEntradaEm: "2026-10-08T13:00:00Z" });
  assert.equal(r.estado, "desligada");
  assert.match(r.motivo, /Ligue para SDR Assistente/);
  assert.match(r.semResposta ?? "", /ninguém ligou/);
  assert.equal(decidirEstadoIa({ ...base, agentes: ag, ligada: null, legadoAtivo: true }).estado, "desligada");
  assert.match(decidirEstadoIa({ ...base, agentes: ag }).motivo, /ligado por Scott/);
});
