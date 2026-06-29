import { Hono } from "hono";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCtx } from "../compat.js";

const app = new Hono();

// GET /usuarios — list org users (for admin user selector, etc.)
app.get("/", async (c) => {
  const ctx = await getCtx(c);
  // Vendedor/closer não enxerga a equipe: recebe só o próprio usuário. Assim os
  // seletores de responsável seguem funcionando (com ele como única opção) e ele
  // não vê a lista da equipe.
  const soEu = ctx.userRole === "vendedor" || ctx.userRole === "closer";

  const data = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      role: usuarios.role,
      avatarUrl: usuarios.avatarUrl,
      ativo: usuarios.ativo,
    })
    .from(usuarios)
    .where(and(
      eq(usuarios.organizacaoId, ctx.organizacaoId),
      eq(usuarios.ativo, true),
      soEu ? eq(usuarios.id, ctx.userId) : undefined,
    ));

  return c.json({ usuarios: data });
});

export const usuariosRoutes = app;
