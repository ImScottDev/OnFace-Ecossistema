import assert from "node:assert/strict";
import test from "node:test";
import { encrypt } from "./encryption";
import { createEmailOAuthState, readEmailOAuthState } from "./oauth-state";

process.env.EMAIL_ENCRYPTION_KEY = "a".repeat(64);

const ORGANIZACAO_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const NOW = 1_700_000_000_000;

test("aceita state OAuth cifrado, recente e com escopo de tenant", () => {
  const value = createEmailOAuthState({ organizacaoId: ORGANIZACAO_ID, userId: USER_ID }, NOW);

  assert.deepEqual(readEmailOAuthState(value, NOW + 60_000), {
    organizacaoId: ORGANIZACAO_ID,
    userId: USER_ID,
    issuedAt: NOW,
  });
});

test("rejeita state OAuth vencido antes de trocar o code", () => {
  const value = createEmailOAuthState({ organizacaoId: ORGANIZACAO_ID, userId: USER_ID }, NOW);

  assert.throws(() => readEmailOAuthState(value, NOW + 10 * 60 * 1000 + 1), /expired or invalid/);
});

test("rejeita state OAuth com tenant malformado", () => {
  const value = encrypt(JSON.stringify({
    organizacaoId: "nao-e-uuid",
    userId: USER_ID,
    issuedAt: NOW,
  }));

  assert.throws(() => readEmailOAuthState(value, NOW), /expired or invalid/);
});
