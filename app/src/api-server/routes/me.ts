import { Hono } from "hono";
import { getCtx } from "../compat.js";
import { normalizeRole } from "@/lib/auth/roles";

const app = new Hono();

/**
 * GET /api/me — identidade EFETIVA do request (respeita view-as).
 * O front usa isto pra decidir qual relatório mostrar: sob view-as, a sessão do
 * navegador continua sendo o admin, mas o papel efetivo é o do usuário visualizado.
 */
app.get("/", async (c) => {
  const ctx = await getCtx(c);
  return c.json({
    userId: ctx.userId,
    nome: ctx.userName,
    role: normalizeRole(ctx.userRole),
    rawRole: ctx.userRole,
    isViewingAs: ctx.isViewingAs,
    realRole: normalizeRole(ctx.realRole),
    organizacaoId: ctx.organizacaoId,
  });
});

export const meRoutes = app;
