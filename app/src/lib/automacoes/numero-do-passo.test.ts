import assert from "node:assert/strict";
import test from "node:test";

import { configDoAdapter } from "./executor";

/**
 * "Falar pelo número" tem de chegar ao acionamento do agente.
 *
 * O catálogo oferece o campo no passo "IA: responder" (grafo.ts), e o motor o
 * descartava: a conversa nascia sempre no número da versão do agente ou no pool
 * operacional. Quem escolhia um número não era atendido e não recebia erro.
 */
const ctx = { registro: {} } as never;

test("IA: responder leva o número escolhido ao adapter do agente", () => {
  const no = { id: "n1", tipo: "ia_responder" } as never;
  const com = configDoAdapter(no, { agenteId: "ag-1", instrucao: "Responder", sessaoId: "sessao-1" }, ctx, 1000);
  assert.equal(com.adapter, "agente_acionar");
  assert.equal(com.config.sessao_id, "sessao-1");

  // Sem escolha, segue como antes: quem decide é a versão do agente / o pool.
  const sem = configDoAdapter(no, { agenteId: "ag-1", instrucao: "Responder" }, ctx, 1000);
  assert.equal(sem.config.sessao_id, undefined);
});

test("Enviar WhatsApp continua levando o número escolhido", () => {
  const no = { id: "n2", tipo: "enviar_whatsapp" } as never;
  const r = configDoAdapter(no, { mensagem: "oi", sessaoId: "sessao-9" }, ctx, 1000);
  assert.equal(r.config.sessao_id, "sessao-9");
});
