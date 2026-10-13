import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { agruparWhatsappPorDia, type MensagemWhatsapp } from "./whatsapp-por-dia";

let n = 0;
const msg = (ocorridoEm: string, direcao: string, chave = "p1"): MensagemWhatsapp => ({
  id: `m${++n}`, chave, pessoaId: chave, direcao, ocorridoEm, usuarioNome: null, resumo: "",
});

describe("agruparWhatsappPorDia", () => {
  it("muitas mensagens no mesmo dia viram um registro com a contagem certa", () => {
    const r = agruparWhatsappPorDia([
      msg("2026-10-12T12:00:00Z", "out"), msg("2026-10-12T12:05:00Z", "in"),
      msg("2026-10-12T15:30:00Z", "entrada"), msg("2026-10-12T20:00:00Z", "saida"), msg("2026-10-12T20:10:00Z", "out"),
    ]);
    assert.equal(r.length, 1);
    assert.equal(r[0].contexto.mensagens, 5);
    assert.equal(r[0].contexto.enviadas, 3);
    assert.equal(r[0].contexto.recebidas, 2);
    assert.match(r[0].titulo, /^WhatsApp · 5 mensagens — 3 enviadas, 2 recebidas · 09:00 às 17:10$/);
    assert.equal(r[0].ocorridoEm, "2026-10-12T20:10:00Z");
  });

  it("dias diferentes (fuso de São Paulo) e conversas diferentes não se misturam", () => {
    const r = agruparWhatsappPorDia([
      // 02:30Z de 13/10 ainda é 12/10 em São Paulo; 03:30Z já é 13/10.
      msg("2026-10-13T02:30:00Z", "in"), msg("2026-10-12T14:00:00Z", "in"), msg("2026-10-12T13:00:00Z", "out"),
      msg("2026-10-13T03:30:00Z", "in"), msg("2026-10-13T04:00:00Z", "in"), msg("2026-10-13T05:00:00Z", "in"),
      msg("2026-10-12T13:00:00Z", "in", "p2"),
    ]);
    const dias = r.filter((x) => x.tipo === "comunicacao_whatsapp_dia");
    assert.deepEqual(dias.map((x) => [x.contexto.dia, x.contexto.mensagens]).sort(), [["2026-10-12", 3], ["2026-10-13", 3]]);
    assert.equal(r.length, 3); // + a mensagem avulsa de p2
  });

  it("uma ou duas mensagens no dia continuam avulsas", () => {
    const r = agruparWhatsappPorDia([msg("2026-10-12T12:00:00Z", "in"), msg("2026-10-12T13:00:00Z", "out")]);
    assert.deepEqual(r.map((x) => x.titulo).sort(), ["WhatsApp enviado", "WhatsApp recebido"]);
  });
});
