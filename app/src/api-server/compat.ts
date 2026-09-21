/**
 * Compatibility helpers for converting Next.js API routes to Hono.
 * Provides familiar patterns so route conversion is mechanical.
 */
import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { CodigoPermissao } from "@/lib/auth/permissoes";
import { getTenantFromRequest, TenantContext } from "./auth.js";

// Get tenant context or throw (returns 401 via error handler)
export async function getCtx(c: Context): Promise<TenantContext> {
  const ctx = await getTenantFromRequest(c);
  if (!ctx) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  return ctx;
}

// Get super admin context or throw 403
export async function getSuperCtx(c: Context): Promise<TenantContext> {
  const ctx = await getCtx(c);
  if (ctx.userRole !== "super_admin") {
    throw new HTTPException(403, { message: "Forbidden" });
  }
  return ctx;
}

// Get query params from Hono context (replaces `new URL(request.url).searchParams`)
export function qp(c: Context, key: string): string | null {
  return c.req.query(key) ?? null;
}

// Parse JSON body safely
export async function parseBody<T = unknown>(c: Context): Promise<T> {
  try {
    return await c.req.json<T>();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }
}

// Custom HTTP error class
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Global error handler for Hono app
export function errorHandler(err: unknown, c: Context) {
  // Handle Hono HTTPException
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status as 400);
  }
  // Handle HttpError
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status as 400);
  }
  // Handle plain object throws { status, message }
  if (err && typeof err === "object" && "status" in err) {
    const e = err as { status: number; message: string };
    return c.json({ error: e.message }, e.status as 400);
  }
  console.error("[API Error]", err);
  return c.json({ error: "Internal server error" }, 500);
}

/**
 * Contexto com visão de GESTÃO, ou 403.
 *
 * `isAdminView` cobre admin, gerente, super_admin e os papéis de gestão da
 * RBAC v2 (director, coordinator, operations). Closer, SDR e leitor não passam.
 *
 * Existe porque o gate de papel do CRM 1 se perdeu na migração (achado 14/09):
 * o middleware ainda protegia `/financeiro` e `/configuracoes`, que viraram
 * redirects, enquanto os destinos reais (`/clientes/financeiro`, `/ajustes`)
 * ficaram abertos a qualquer papel autenticado — inclusive no backend, onde
 * nenhuma rota financeira checava papel.
 */
export async function getGestaoCtx(c: Context): Promise<TenantContext> {
  const ctx = await getCtx(c);
  const { isAdminView } = await import("@/lib/auth/roles");
  if (!isAdminView(ctx.userRole)) {
    throw new HTTPException(403, { message: "Acesso restrito a admin, gerente ou direção." });
  }
  return ctx;
}

/**
 * Gate por PERMISSÃO, não por cargo (SPEC §31).
 *
 * `getGestaoCtx` responde "é gestão?", que é a pergunta grossa: quem passa por
 * ela pode tudo. Aqui a pergunta é a que o SPEC exige — *pode fazer ISTO?* — e
 * é o que permite dizer "move oportunidade mas não aprova desconto", e o que
 * permite o agente de IA agir com permissão delegada sem exceder a delegação.
 *
 * O cutover é seguro porque foi provado: `auth/permissoes.test.ts` compara,
 * usuário real por usuário real e permissão por permissão, o que o RBAC
 * responde contra o que o gate legado responderia. Zero divergências.
 */
export async function exigirCtx(c: Context, permissao: CodigoPermissao): Promise<TenantContext> {
  const ctx = await getCtx(c);
  const { temPermissao } = await import("@/lib/auth/permissoes");
  const pode = await temPermissao(
    { usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId, role: ctx.userRole, tipo: "HUMAN" },
    permissao,
  );
  if (!pode) {
    // A mensagem diz qual permissão falta: quem recebe 403 precisa saber o que
    // pedir, e "acesso negado" manda a pessoa para o suporte em vez de para o
    // administrador dela.
    throw new HTTPException(403, { message: `Sem permissão: ${permissao}` });
  }
  return ctx;
}
