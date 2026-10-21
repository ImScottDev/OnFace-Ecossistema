import { strict as assert } from "node:assert";
import { test } from "node:test";
import { MAX_MENSAGENS_POR_TURNO } from "./execute-agent";

/* O WhatsApp restringiu o número da agente em 21/10/2026 por padrão de robô:
   não por volume (47 mensagens em dois dias, 4 contatos, nenhuma conversa
   iniciada por ela), mas por rajada — três disparos a cada turno, 22 numa hora
   para a mesma pessoa. O teto existe para isso não se repetir. */

test("o teto por turno é baixo o bastante para não parecer metralhadora", () => {
  assert.ok(MAX_MENSAGENS_POR_TURNO <= 2, `teto em ${MAX_MENSAGENS_POR_TURNO}: três ou mais por turno é o padrão que fez o WhatsApp restringir a conta`);
  assert.ok(MAX_MENSAGENS_POR_TURNO >= 1, "o agente precisa poder responder");
});

test("o prompt da agente pede uma mensagem por resposta", async () => {
  const { LIA_PROMPT } = await import("../lia/definicao");
  assert.match(LIA_PROMPT, /UMA mensagem por resposta/i,
    "o prompt precisa pedir uma mensagem por resposta: foi a quebra em três que restringiu a conta");
});
