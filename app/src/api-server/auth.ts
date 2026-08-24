import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { decode } from "@auth/core/jwt";
import { db } from "@/lib/db";
import { organizacoes, usuarios } from "@/lib/db/schema";
import { eq, SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { isPersonalView } from "@/lib/auth/roles";

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
const ORG_OVERRIDE_COOKIE = "mcrm-org-override";
const VIEW_AS_COOKIE = "mcrm-view-as";
const ADMIN_ROLES = ["admin", "gerente", "super_admin"];

// NextAuth v5 derives a chave de criptografia via HKDF usando o NOME DO
// COOKIE como salt/info — e o nome do cookie muda com o protocolo:
// "__Secure-authjs.session-token" só em HTTPS real, "authjs.session-token"
// (sem prefixo) em HTTP local. Bug real achado 09/08: este arquivo tinha
// o nome fixo na variante HTTPS, então em dev local (HTTP) a chave
// derivada ficava sempre errada — decodeSession falhava 100% das vezes
// (não intermitente), causando 401 em qualquer endpoint que passa por
// aqui, disparando o logout forçado global (Providers.tsx). Fix: deriva
// (e cacheia) uma chave por nome de cookie, tenta as 2 na leitura.
const COOKIE_NAME_SECURE = "__Secure-authjs.session-token";
const COOKIE_NAME_INSECURE = "authjs.session-token";

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
async function decodeSession(cookieValue: string, cookieName: string): Promise<Record<string, unknown> | null> {
  try {
    // Use exatamente o mesmo decoder da versão instalada do Auth.js.
    // O formato do JWE (incluindo `kid` e algoritmos aceitos) pertence ao
    // Auth.js; reimplementá-lo aqui fez o Next autenticar enquanto a API
    // Hono recusava o mesmo cookie e disparava o redirect global pro login.
    return await decode({
      token: cookieValue,
      secret: NEXTAUTH_SECRET,
      salt: cookieName,
    }) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

// Extract tenant context from Hono request (same logic as Next.js getTenantContext)
export async function getTenantFromRequest(c: Context): Promise<TenantContext | null> {
  // Try both cookie names (HTTPS usa prefixo __Secure-, HTTP local não) —
  // a chave de decriptação depende do nome exato do cookie encontrado.
  const secureToken = getCookie(c, COOKIE_NAME_SECURE);
  const token = secureToken || getCookie(c, COOKIE_NAME_INSECURE);
  const cookieName = secureToken ? COOKIE_NAME_SECURE : COOKIE_NAME_INSECURE;

  if (!token) return null;

  const payload = await decodeSession(token, cookieName);
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

// ─── F0/RBAC v2: escopo reusável de organização/ownership ───────────────────
// Hoje cada rota reimplementa `and(eq(tabela.id, id), eq(tabela.organizacaoId,
// ctx.organizacaoId))` na mão (achado confirmado na auditoria: consistente,
// mas é opt-in por linha de código, não estrutural). Estes 2 helpers são o
// primeiro passo de infraestrutura pra centralizar isso — adoção é incremental
// rota a rota (F1+), não é retrofit de tudo de uma vez em F0.
//
// Uso: `where(and(orgScope(tabela.organizacaoId, ctx), ...outrasCondicoes))`

/** Condição de escopo de organização, pronta pra `and(...)`. */
export function orgScope(orgIdColumn: PgColumn, ctx: TenantContext): SQL {
  return eq(orgIdColumn, ctx.organizacaoId);
}

/**
 * Empilha (push) a condição de ownership num array de condições existente —
 * mesmo idioma já usado no resto do projeto (`const conditions = [...]; if
 * (x) conditions.push(...)`). SDR/closer só veem os próprios registros
 * (responsavelId = ctx.userId); admin/gerente/director/coordinator/operations
 * veem o agregado, então não empilha nada (sem filtro).
 */
export function pushOwnershipScope(
  conditions: SQL[],
  responsavelIdColumn: PgColumn,
  ctx: TenantContext
): void {
  if (isPersonalView(ctx.userRole)) {
    conditions.push(eq(responsavelIdColumn, ctx.userId));
  }
}
