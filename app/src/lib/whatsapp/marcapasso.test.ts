import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  INTERVALO_MAX_MS, INTERVALO_MIN_MS, MAX_POR_DIA_POR_NUMERO, MAX_POR_HORA_POR_NUMERO,
  NumeroNoLimite, aguardarVezDoNumero, decidir, intervaloSorteado, zerarMarcapasso,
} from "./marcapasso";

/* O número da agente foi restringido em 21/10/2026 com 47 mensagens em dois
   dias para 4 contatos. O que destoava: 14 pares de envios com 0,0 segundo de
   intervalo. Estes testes guardam os dois eixos — espaço entre envios e teto
   por chip — que não existiam em lugar nenhum do código. */

const estado = (p: { ultimoEnvio?: number; naHora?: number; noDia?: number }, agora: number) => ({
  ultimoEnvio: p.ultimoEnvio ?? 0,
  horas: new Map([[Math.floor(agora / 3_600_000), p.naHora ?? 0]]),
  dias: new Map([[Math.floor(agora / 86_400_000), p.noDia ?? 0]]),
});

test("número que nunca enviou fala na hora", () => {
  assert.deepEqual(decidir(undefined, Date.now(), 10_000), { esperarMs: 0, estourou: null });
});

test("dois envios seguidos não saem no mesmo segundo", () => {
  const agora = Date.now();
  const { esperarMs } = decidir(estado({ ultimoEnvio: agora }, agora), agora, 10_000);
  assert.equal(esperarMs, 10_000, "envio colado no anterior tem de esperar");
});

test("quem já esperou o bastante não espera de novo", () => {
  const agora = Date.now();
  const { esperarMs } = decidir(estado({ ultimoEnvio: agora - 30_000 }, agora), agora, 10_000);
  assert.equal(esperarMs, 0);
});

test("teto por hora protege o chip", () => {
  const agora = Date.now();
  assert.equal(decidir(estado({ naHora: MAX_POR_HORA_POR_NUMERO }, agora), agora, 1).estourou, "hora");
  assert.equal(decidir(estado({ naHora: MAX_POR_HORA_POR_NUMERO - 1 }, agora), agora, 1).estourou, null);
});

test("teto do dia vence o da hora: é o limite mais grave", () => {
  const agora = Date.now();
  const e = estado({ naHora: 0, noDia: MAX_POR_DIA_POR_NUMERO }, agora);
  assert.equal(decidir(e, agora, 1).estourou, "dia");
});

test("o intervalo é sorteado, nunca fixo", () => {
  assert.equal(intervaloSorteado(() => 0), INTERVALO_MIN_MS);
  assert.equal(intervaloSorteado(() => 1), INTERVALO_MAX_MS);
  const amostras = new Set(Array.from({ length: 30 }, () => intervaloSorteado()));
  assert.ok(amostras.size > 5, "intervalo fixo é tão suspeito quanto nenhum intervalo");
});

test("o marcapasso espera de verdade entre dois envios do mesmo número", async () => {
  zerarMarcapasso();
  const esperas: number[] = [];
  const fingirEspera = async (ms: number) => { esperas.push(ms); };
  await aguardarVezDoNumero("sessao-a", fingirEspera);
  await aguardarVezDoNumero("sessao-a", fingirEspera);
  // O primeiro sai na hora e por isso nem chama a espera; só o segundo espera.
  assert.equal(esperas.length, 1, "só o segundo envio deveria esperar");
  assert.ok(esperas[0]! >= INTERVALO_MIN_MS, `o segundo esperou ${esperas[0]}ms, menos que o mínimo`);
  assert.ok(esperas[0]! <= INTERVALO_MAX_MS, `o segundo esperou ${esperas[0]}ms, mais que o máximo`);
});

test("números diferentes não disputam a mesma vez", async () => {
  zerarMarcapasso();
  const esperas: number[] = [];
  const fingirEspera = async (ms: number) => { esperas.push(ms); };
  await aguardarVezDoNumero("sessao-a", fingirEspera);
  await aguardarVezDoNumero("sessao-b", fingirEspera);
  assert.deepEqual(esperas, [], "nenhum dos dois esperou: o chip de um não atrasa o do outro");
});

test("estourar o teto do chip avisa com motivo legível", async () => {
  zerarMarcapasso();
  const semEspera = async () => {};
  for (let i = 0; i < MAX_POR_HORA_POR_NUMERO; i++) await aguardarVezDoNumero("sessao-c", semEspera);
  await assert.rejects(() => aguardarVezDoNumero("sessao-c", semEspera), (e: Error) => {
    assert.ok(e instanceof NumeroNoLimite);
    assert.match(e.message, /rajada|teto/i);
    return true;
  });
});
