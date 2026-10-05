import crypto from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { authTokens } from "@/lib/db/schema";

export type TokenTipo = "convite" | "reset";

export { appUrl } from "@/lib/app-url";

const sha256 = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");

/**
 * Cria um token de uso único e devolve o valor CRU (pro link do email).
 * No banco guardamos só o hash. ttlMs define a validade.
 */
export async function criarToken(usuarioId: string, tipo: TokenTipo, ttlMs: number): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  await db.insert(authTokens).values({
    usuarioId,
    tipo,
    tokenHash: sha256(raw),
    expiraEm: new Date(Date.now() + ttlMs),
  });
  return raw;
}

/** Valida um token cru: existe, não usado, não expirado. Retorna dados ou null. */
export async function validarToken(raw: string): Promise<{ id: string; usuarioId: string; tipo: TokenTipo } | null> {
  if (!raw) return null;
  const [row] = await db
    .select({ id: authTokens.id, usuarioId: authTokens.usuarioId, tipo: authTokens.tipo })
    .from(authTokens)
    .where(and(
      eq(authTokens.tokenHash, sha256(raw)),
      isNull(authTokens.usadoEm),
      gt(authTokens.expiraEm, new Date()),
    ))
    .limit(1);
  return row ? { id: row.id, usuarioId: row.usuarioId, tipo: row.tipo as TokenTipo } : null;
}

/** Marca o token como usado (uso único). */
export async function consumirToken(id: string): Promise<void> {
  await db.update(authTokens).set({ usadoEm: new Date() }).where(eq(authTokens.id, id));
}
