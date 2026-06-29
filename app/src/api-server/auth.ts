import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { jwtDecrypt } from "jose";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { organizacoes, usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
const ORG_OVERRIDE_COOKIE = "mcrm-org-override";
const VIEW_AS_COOKIE = "mcrm-view-as";
const ADMIN_ROLES = ["admin", "gerente", "super_admin"];

// NextAuth v5 derives encryption key using HKDF with cookie name as salt
const COOKIE_NAME = "__Secure-authjs.session-token";

async function getDerivedKey(secret: string): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode(COOKIE_NAME),
      info: new TextEncoder().encode(`Auth.js Generated Encryption Key (${COOKIE_NAME})`),
    },
    keyMaterial,
    512 // 64 bytes for A256CBC-HS512
  );
  return new Uint8Array(derived);
}

let cachedKey: Uint8Array | null = null;
async function getKey(): Promise<Uint8Array> {
  if (!cachedKey) cachedKey = await getDerivedKey(NEXTAUTH_SECRET);
  return cachedKey;
}

export interface TenantContext {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  organizacaoId: string;
  organizacaoSlug: string;
  isOverridden: boolean;
  originalOrgId: string;
  // View-as (impersonação de leitura): role/userId efetivos podem ser de outro usuário,
  // mas real* sempre aponta pro admin de verdade que ativou.
  isViewingAs: boolean;
  realRole: string;
  realUserId: string;
  viewAsName: string;
}

// Decode the NextAuth session from the encrypted JWT cookie
async function decodeSession(cookieValue: string): Promise<Record<string, unknown> | null> {
  try {
    const key = await getKey();
    const { payload } = await jwtDecrypt(cookieValue, key, {
      clockTolerance: 15,
    });
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Extract tenant context from Hono request (same logic as Next.js getTenantContext)
export async function getTenantFromRequest(c: Context): Promise<TenantContext | null> {
  // Try both cookie names (HTTPS uses __Secure- prefix)
  const token = getCookie(c, "__Secure-authjs.session-token")
    || getCookie(c, "authjs.session-token");

  if (!token) return null;

  const payload = await decodeSession(token);
  if (!payload?.id || !payload?.organizacaoId) return null;

  let organizacaoId = payload.organizacaoId as string;
  let organizacaoSlug = (payload.organizacaoSlug as string) || "";
  const userRole = (payload.role as string) || "vendedor";

  // Super admin org override via cookie
  if (userRole === "super_admin") {
    const override = getCookie(c, ORG_OVERRIDE_COOKIE);
    if (override) {
      const [overrideId, overrideSlug] = override.split(":");
      if (overrideId) {
        const [org] = await db.select({ id: organizacoes.id })
          .from(organizacoes)
          .where(eq(organizacoes.id, overrideId))
          .limit(1);
        if (org) {
          organizacaoId = overrideId;
          organizacaoSlug = overrideSlug || "";
        }
      }
    }
  }

  // View-as: só admin/gerente/super_admin podem "visualizar como" outro usuário.
  // O role do cookie NUNCA é confiado pros dados — buscamos o usuário no banco e
  // usamos o role/id reais dele, e só se for da mesma org (efetiva) e ativo.
  let effUserId = payload.id as string;
  let effUserName = (payload.name as string) || "";
  let effRole = userRole;
  let isViewingAs = false;
  let viewAsName = "";

  if (ADMIN_ROLES.includes(userRole)) {
    const viewAs = getCookie(c, VIEW_AS_COOKIE);
    const targetId = viewAs ? viewAs.split(":")[0] : "";
    if (targetId && targetId !== (payload.id as string)) {
      const [u] = await db
        .select({
          id: usuarios.id,
          nome: usuarios.nome,
          role: usuarios.role,
          organizacaoId: usuarios.organizacaoId,
          ativo: usuarios.ativo,
        })
        .from(usuarios)
        .where(eq(usuarios.id, targetId))
        .limit(1);
      if (u && u.organizacaoId === organizacaoId && u.ativo) {
        effUserId = u.id;
        effUserName = u.nome;
        effRole = u.role;
        isViewingAs = true;
        viewAsName = u.nome;
      }
    }
  }

  return {
    userId: effUserId,
    userName: effUserName,
    userEmail: (payload.email as string) || "",
    userRole: effRole,
    organizacaoId,
    organizacaoSlug,
    isOverridden: organizacaoId !== (payload.organizacaoId as string),
    originalOrgId: payload.organizacaoId as string,
    isViewingAs,
    realRole: userRole,
    realUserId: payload.id as string,
    viewAsName,
  };
}

// Hono middleware — sets ctx on c.var
export async function authMiddleware(c: Context, next: Next) {
  const ctx = await getTenantFromRequest(c);
  c.set("ctx", ctx);
  await next();
}

// Helper for routes that require auth
export function requireAuth(c: Context): TenantContext {
  const ctx = c.get("ctx") as TenantContext | null;
  if (!ctx) throw new Error("UNAUTHORIZED");
  return ctx;
}
