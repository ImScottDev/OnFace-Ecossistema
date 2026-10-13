import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { telefoneDoJid } from "./telefone-do-jid";

const LID = "123456789012345@lid"; // 15 dígitos: passava no filtro antigo

describe("telefone a partir do JID", () => {
  it("LID sozinho não vira telefone", () => {
    assert.equal(telefoneDoJid({ isFromMe: false, chat: LID, sender: LID }), null);
    assert.equal(telefoneDoJid({ isFromMe: true, chat: LID }), null);
  });

  it("com LID no chat, usa o número real do SenderAlt / RecipientAlt", () => {
    assert.equal(telefoneDoJid({ isFromMe: false, chat: LID, senderAlt: "5511911515479@s.whatsapp.net" }), "5511911515479");
    assert.equal(telefoneDoJid({ isFromMe: true, chat: LID, recipientAlt: "5511911515479:7@s.whatsapp.net" }), "5511911515479");
  });

  it("JID normal continua valendo", () => {
    assert.equal(telefoneDoJid({ isFromMe: false, chat: "5511989759431@s.whatsapp.net" }), "5511989759431");
  });

  it("id de canal (18 dígitos) e número curto não são telefone", () => {
    assert.equal(telefoneDoJid({ isFromMe: false, chat: "120363123456789012@s.whatsapp.net" }), null);
    assert.equal(telefoneDoJid({ isFromMe: false, chat: "1234@s.whatsapp.net" }), null);
  });
});
