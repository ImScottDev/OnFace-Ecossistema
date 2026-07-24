import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.EMAIL_ENCRYPTION_KEY;
  if (!key) throw new Error("EMAIL_ENCRYPTION_KEY not configured");
  return Buffer.from(key, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  // base64url (não base64 puro): esse valor às vezes viaja cru dentro de uma
  // querystring (ex.: state do OAuth Microsoft). "+" sobrevive em alguns
  // encoders de terceiro sem virar %2B e o parser de query do Hono converte
  // "+" solto em espaço ao decodificar — corrompendo o auth tag do GCM antes
  // mesmo de chegar aqui. base64url não usa "+"/"/"/"=", então não tem essa
  // ambiguidade em lugar nenhum da URL. Buffer.from(..., "base64") no decrypt
  // já aceita as duas variantes, então isso não quebra nada que já foi salvo.
  let encrypted = cipher.update(plaintext, "utf8", "base64url");
  encrypted += cipher.final("base64url");
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64url)
  return `${iv.toString("base64url")}:${authTag.toString("base64url")}:${encrypted}`;
}

export function decrypt(encryptedStr: string): string {
  const key = getKey();
  const parts = encryptedStr.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted format");

  // "base64" aqui aceita tanto base64 clássico (valores antigos já salvos)
  // quanto base64url (valores novos) — Node normaliza os dois na decodificação.
  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const encrypted = parts[2];

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
