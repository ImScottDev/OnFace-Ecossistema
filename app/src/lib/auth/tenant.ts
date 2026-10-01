import { auth } from "./config";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizacoes, usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { podeVerComo } from "./roles";

const ORG_OVERRIDE_COOKIE = "mcrm-org-override";
const VIEW_AS_COOKIE = "mcrm-view-as";

/**
 * Get the authenticated user's tenant context.
 * For super_admin: if org-override cookie is set, uses that org instead.
 */
export async function getTenantContext() {
  const session = await auth();
  if (!session?.user?.organizacaoId) {
    return null;
  }

  let organizacaoId = session.user.organizacaoId;
  let organizacaoSlug = session.user.organizacaoSlug || "";
  const userRole = (session.user as { role?: string }).role || "vendedor";

  // Super admin can override org context via cookie
  if (userRole === "super_admin") {
    try {
      const cookieStore = await cookies();
      const override = cookieStore.get(ORG_OVERRIDE_COOKIE)?.value;
      if (override) {
        // Cookie format: "orgId:orgSlug"
        const [overrideId, overrideSlug] = override.split(":");
        if (overrideId) {
          // Validate that the org actually exists before accepting override
          const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).where(eq(organizacoes.id, overrideId)).limit(1);
          if (org) {
            organizacaoId = overrideId;
            organizacaoSlug = overrideSlug || "";
          }
        }
      }
    } catch {
      // cookies() may fail in some contexts
    }
  }

  // View-as: só o super_admin pode "visualizar como" outro usuário (podeVerComo).
  // Espelha o override do api-server/auth.ts pra os server components (dashboard etc.)
  // refletirem o que o usuário visualizado veria. Vendedor real não tem o cookie.
  let effUserId = session.user.id as string;
  let effUserName = session.user.name || "";
  let effRole = userRole;
  let isViewingAs = false;
  if (podeVerComo(userRole)) {
    try {
      const cookieStore = await cookies();
      const viewAs = cookieStore.get(VIEW_AS_COOKIE)?.value;
      const targetId = viewAs ? viewAs.split(":")[0] : "";
      if (targetId && targetId !== session.user.id) {
        const [u] = await db
          .select({ id: usuarios.id, nome: usuarios.nome, role: usuarios.role, organizacaoId: usuarios.organizacaoId, ativo: usuarios.ativo })
          .from(usuarios).where(eq(usuarios.id, targetId)).limit(1);
        if (u && u.organizacaoId === organizacaoId && u.ativo) {
          effUserId = u.id;
          effUserName = u.nome;
          effRole = u.role;
          isViewingAs = true;
        }
      }
    } catch {
      // cookies() may fail in some contexts
    }
  }

  return {
    userId: effUserId,
    userName: effUserName,
    userEmail: session.user.email || "",
    userRole: effRole,
    organizacaoId,
    organizacaoSlug,
    isOverridden: organizacaoId !== session.user.organizacaoId,
    originalOrgId: session.user.organizacaoId,
    isViewingAs,
    realRole: userRole,
    realUserId: session.user.id as string,
  };
}

export async function getSuperAdminContext() {
  const ctx = await getTenantContext();
  if (!ctx || ctx.userRole !== "super_admin") return null;
  return ctx;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
