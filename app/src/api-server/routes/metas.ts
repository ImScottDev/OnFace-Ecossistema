import { Hono } from "hono";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { isAdminView } from "@/lib/auth/roles";
import { getMetasDoUsuario, getRealizadoMeta, upsertMeta, META_TIPOS, type MetaTipo } from "@/lib/metas";

const app = new Hono();

const upsertSchema = z.object({
  usuarioId: z.string().uuid(),
  periodo: z.string().min(7), // YYYY-MM-DD (1º dia do mês) ou YYYY-MM
  tipo: z.enum(META_TIPOS as [MetaTipo, ...MetaTipo[]]),
  valorAlvo: z.coerce.number().nonnegative(),
});

// POST /metas — upsert de meta (admin/gerente apenas)
app.post("/", async (c) => {
  const ctx = await getCtx(c);
  if (!isAdminView(ctx.userRole)) {
    return c.json({ error: "Apenas admin/gerente podem definir metas" }, 403);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  // O usuário alvo precisa ser da mesma organização do admin
  const [alvo] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.id, parsed.data.usuarioId), eq(usuarios.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!alvo) {
    return c.json({ error: "Usuário não encontrado nesta organização" }, 404);
  }

  const meta = await upsertMeta({
    organizacaoId: ctx.organizacaoId,
    usuarioId: parsed.data.usuarioId,
    periodo: parsed.data.periodo,
    tipo: parsed.data.tipo,
    valorAlvo: parsed.data.valorAlvo,
    criadoPor: ctx.userId,
  });
  return c.json({ meta });
});

// GET /metas/usuario/:usuarioId?periodo=YYYY-MM-DD — metas + realizado do mês
// Admin/gerente veem de qualquer um; demais só de si mesmos.
app.get("/usuario/:usuarioId", async (c) => {
  const ctx = await getCtx(c);
  const usuarioId = c.req.param("usuarioId");
  if (!isAdminView(ctx.userRole) && usuarioId !== ctx.userId) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const periodo = c.req.query("periodo") || new Date().toISOString().slice(0, 10);

  const metasUsuario = await getMetasDoUsuario(ctx.organizacaoId, usuarioId, periodo);
  const comRealizado = await Promise.all(
    metasUsuario.map(async (m) => ({
      ...m,
      realizado: await getRealizadoMeta(ctx.organizacaoId, usuarioId, periodo, m.tipo as MetaTipo),
    })),
  );
  return c.json({ metas: comRealizado });
});

export const metasRoutes = app;
