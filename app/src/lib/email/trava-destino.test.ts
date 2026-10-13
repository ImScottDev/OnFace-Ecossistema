import assert from "node:assert/strict";
import test from "node:test";
import { garantirDestinoPermitido } from "./trava-destino";

test("sem EMAIL_ALLOWED_DOMAINS não bloqueia nada (produção)", () => {
  delete process.env.EMAIL_ALLOWED_DOMAINS;
  garantirDestinoPermitido("cliente@empresa.com");
});

test("com a trava, só passa @callface.ai (inclui nome, lista, cc e bcc)", () => {
  process.env.EMAIL_ALLOWED_DOMAINS = "callface.ai";
  garantirDestinoPermitido("Time <a@callface.ai>", ["b@CALLFACE.AI"], "c@callface.ai; d@callface.ai", undefined);
  assert.throws(() => garantirDestinoPermitido("a@callface.ai", "cliente@empresa.com"), /fora de EMAIL_ALLOWED_DOMAINS/);
  assert.throws(() => garantirDestinoPermitido("x@callface.ai.evil.com"));
  assert.throws(() => garantirDestinoPermitido("x@notcallface.ai"));
  delete process.env.EMAIL_ALLOWED_DOMAINS;
});
