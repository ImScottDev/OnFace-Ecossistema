import assert from "node:assert/strict";
import test from "node:test";
import { decryptCredential, encryptCredential, maskCredential } from "./credentials";

test("credencial faz roundtrip AES-GCM sem persistir segredo em claro", () => {
  const previous = process.env.AI_CREDENTIALS_ENCRYPTION_KEY;
  process.env.AI_CREDENTIALS_ENCRYPTION_KEY = "chave-local-de-teste-com-entropia-suficiente";
  try {
    const encrypted = encryptCredential("sk-callface-segredo-1234");
    assert.equal(encrypted.ciphertext.includes("sk-callface"), false);
    assert.equal(encrypted.last4, "1234");
    assert.equal(decryptCredential(encrypted), "sk-callface-segredo-1234");
    assert.equal(maskCredential(encrypted.last4), "••••••••1234");
  } finally {
    if (previous === undefined) delete process.env.AI_CREDENTIALS_ENCRYPTION_KEY;
    else process.env.AI_CREDENTIALS_ENCRYPTION_KEY = previous;
  }
});

test("credencial adulterada falha na autenticação", () => {
  const previous = process.env.AI_CREDENTIALS_ENCRYPTION_KEY;
  process.env.AI_CREDENTIALS_ENCRYPTION_KEY = "chave-local-de-teste-com-entropia-suficiente";
  try {
    const encrypted = encryptCredential("sk-callface-segredo-5678");
    assert.throws(() => decryptCredential({ ...encrypted, ciphertext: Buffer.from("adulterado").toString("base64") }));
  } finally {
    if (previous === undefined) delete process.env.AI_CREDENTIALS_ENCRYPTION_KEY;
    else process.env.AI_CREDENTIALS_ENCRYPTION_KEY = previous;
  }
});
