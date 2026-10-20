/**
 * Caixa de entrada da captação (Meta, RD, site, API pública) para a gestão.
 *
 *   GET  /api/captacao/entregas?status=falhou&canal=meta  → últimas entregas da organização
 *   POST /api/captacao/entregas/:id/reprocessar           → roda de novo o processamento do webhook
 *
 * Só gestão (admin, gerente, super admin), como a distribuição de leads. A
 * organização vem da sessão; a regra mora em lib/captacao/reprocessar.ts.
 */
import { Hono } from "hono";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { EntregaRecusada, listarEntregas, reprocessarEntrega, STATUS_ENTREGA } from "@/lib/captacao/reprocessar";

const app = new Hono();
const GESTAO = ["admin", "gerente", "super_admin"];

const filtro = z.object({
  status: z.enum(STATUS_ENTREGA as [string, ...string[]]).optional(),
  canal: z.enum(["meta", "rd", "site", "api"]).optional(),
  limite: z.coerce.number().int().min(1).max(500).optional(),
});

app.get("/entregas", async (c) => {
  const ctx = await getCtx(c);
  if (!GESTAO.includes(ctx.userRole)) return c.json({ error: "Forbidden" }, 403);
  const f = filtro.safeParse({ status: c.req.query("status") || undefined, canal: c.req.query("canal") || undefined, limite: c.req.query("limite") || undefined });
  if (!f.success) return c.json({ error: "Filtro inválido", details: f.error.flatten() }, 400);
  return c.json({ entregas: await listarEntregas(ctx.organizacaoId, f.data as Parameters<typeof listarEntregas>[1]) });
});

app.post("/entregas/:id/reprocessar", async (c) => {
  const ctx = await getCtx(c);
  if (!GESTAO.includes(ctx.userRole)) return c.json({ error: "Forbidden" }, 403);
  if (ctx.isViewingAs) return c.json({ error: "Ver como é somente leitura." }, 403);
  const id = c.req.param("id");
  if (!z.string().uuid().safeParse(id).success) return c.json({ error: "Entrega inválida" }, 400);
  try {
    return c.json(await reprocessarEntrega({ organizacaoId: ctx.organizacaoId, entregaId: id, usuarioId: ctx.userId }));
  } catch (e) {
    if (e instanceof EntregaRecusada) return c.json({ error: e.message, codigo: e.codigo }, e.codigo === "nao_encontrada" ? 404 : 409);
    throw e;
  }
});

export const captacaoRoutes = app;
