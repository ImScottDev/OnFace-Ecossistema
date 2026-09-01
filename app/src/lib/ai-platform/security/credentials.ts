import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type EncryptedCredential = {
  ciphertext: string;
  iv: string;
  tag: string;
  last4: string;
  version: 1;
};

function encryptionKey(): Buffer {
  const source = process.env.AI_CREDENTIALS_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!source) throw new Error("AI_CREDENTIALS_ENCRYPTION_KEY ou NEXTAUTH_SECRET precisa estar configurada");
  return createHash("sha256").update(`callface-ai-credentials:v1:${source}`).digest();
}

export function encryptCredential(secret: string): EncryptedCredential {
  const value = secret.trim();
  if (value.length < 8) throw new Error("Credencial inválida");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), last4: value.slice(-4), version: 1 };
}

export function decryptCredential(value: Pick<EncryptedCredential, "ciphertext" | "iv" | "tag">): string {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export function maskCredential(last4: string): string {
  return `••••••••${last4}`;
}
