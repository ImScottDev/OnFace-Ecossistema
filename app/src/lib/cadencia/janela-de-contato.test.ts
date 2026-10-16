/**
 * A cadência não fala com o cliente de madrugada nem no fim de semana.
 *
 *   node --import tsx --test src/lib/cadencia/janela-de-contato.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { dentroDaJanela, proximoHorarioDeContato, contataOCliente } from "./janela-de-contato";

/** Instante em São Paulo (UTC-3), escrito como UTC para não depender do TZ da máquina. */
const spz = (iso: string) => new Date(`${iso}-03:00`);
const horaEmSp = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour12: false, hour: "2-digit", minute: "2-digit", weekday: "short" })
    .format(d);

test("madrugada de quarta fica fora; o meio da tarde fica dentro", () => {
  assert.equal(dentroDaJanela(spz("2026-10-14T03:00:00")), false);
  assert.equal(dentroDaJanela(spz("2026-10-14T15:00:00")), true);
});

test("sábado e domingo ficam fora, mesmo em plena tarde", () => {
  assert.equal(dentroDaJanela(spz("2026-10-17T15:00:00")), false); // sábado
  assert.equal(dentroDaJanela(spz("2026-10-18T15:00:00")), false); // domingo
});

test("as bordas: 8h entra, 20h já não", () => {
  assert.equal(dentroDaJanela(spz("2026-10-14T08:00:00")), true);
  assert.equal(dentroDaJanela(spz("2026-10-14T19:59:00")), true);
  assert.equal(dentroDaJanela(spz("2026-10-14T20:00:00")), false);
});

test("o que cai às 3h da manhã é empurrado para as 8h do mesmo dia", () => {
  const empurrado = proximoHorarioDeContato(spz("2026-10-14T03:00:00"));
  assert.match(horaEmSp(empurrado), /Wed 08:00/);
});

test("o que cai no sábado espera a segunda, não o domingo", () => {
  const empurrado = proximoHorarioDeContato(spz("2026-10-17T10:00:00"));
  assert.match(horaEmSp(empurrado), /Mon 08:00/);
});

test("depois das 20h de sexta, só na segunda", () => {
  const empurrado = proximoHorarioDeContato(spz("2026-10-16T22:30:00"));
  assert.match(horaEmSp(empurrado), /Mon 08:00/);
});

test("quem já está na janela não é adiado nem um minuto", () => {
  const agora = spz("2026-10-14T15:23:00");
  assert.equal(proximoHorarioDeContato(agora).getTime(), agora.getTime());
});

test("só espera a janela quem fala com o cliente", () => {
  assert.equal(contataOCliente("whatsapp_template"), true);
  assert.equal(contataOCliente("ai_agent_message"), true);
  assert.equal(contataOCliente("crm_callface_call"), true);
  assert.equal(contataOCliente("email"), true);
  // Interno: criar tarefa ou etiquetar de madrugada não incomoda ninguém.
  assert.equal(contataOCliente("crm_create_task"), false);
  assert.equal(contataOCliente("crm_add_tag"), false);
  assert.equal(contataOCliente("crm_update_stage"), false);
  assert.equal(contataOCliente(null), false);
});
