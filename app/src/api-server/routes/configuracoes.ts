import { Hono } from "hono";
import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { buildPipelineConfig, type PipelineConfig } from "@/lib/crm/pipeline";

const app = new Hono();

// ─── Integracoes ─────────────────────────────────────────────────

// GET /configuracoes/integracoes — return integration config (key masked)
app.get("/integracoes", async (c) => {
  const ctx = await getCtx(c);
  if (ctx.userRole !== "admin" && ctx.userRole !== "super_admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [org] = await db
    .select({ apolloApiKey: organizacoes.apolloApiKey })
    .from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId))
    .limit(1);

  const key = org?.apolloApiKey || "";
  const masked = key ? key.slice(0, 4) + "•".repeat(Math.max(0, key.length - 8)) + key.slice(-4) : "";

  return c.json({
    apolloApiKey: masked,
    apolloConfigured: !!key,
  });
});

// PATCH /configuracoes/integracoes — update integration config
app.patch("/integracoes", async (c) => {
  const ctx = await getCtx(c);
  if (ctx.userRole !== "admin" && ctx.userRole !== "super_admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const updates: Record<string, unknown> = {};

  if ("apolloApiKey" in body) {
    updates.apolloApiKey = body.apolloApiKey || null;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "Nenhum campo para atualizar" }, 400);
  }

  await db
    .update(organizacoes)
    .set(updates)
    .where(eq(organizacoes.id, ctx.organizacaoId));

  return c.json({ ok: true });
});

// ─── Pipeline ────────────────────────────────────────────────────

// GET /configuracoes/pipeline — return the current pipeline config for the org
app.get("/pipeline", async (c) => {
  const ctx = await getCtx(c);

  const [org] = await db
    .select({ pipelineConfig: organizacoes.pipelineConfig })
    .from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId))
    .limit(1);

  const config = buildPipelineConfig(org?.pipelineConfig as Partial<PipelineConfig> | null);
  return c.json(config);
});

// PUT /configuracoes/pipeline — update pipeline config (admin/super_admin only)
app.put("/pipeline", async (c) => {
  const ctx = await getCtx(c);
  if (!["admin", "super_admin"].includes(ctx.userRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json() as Partial<PipelineConfig>;

  // Validate stages have required fields
  if (body.stages) {
    for (const stage of body.stages) {
      if (!stage.key || !stage.label || !stage.color) {
        return c.json({ error: "Cada etapa precisa de key, label e color" }, 400);
      }
      // Sanitize key to slug format
      stage.key = stage.key.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    }
    // Check for duplicate keys
    const keys = body.stages.map((s) => s.key);
    if (new Set(keys).size !== keys.length) {
      return c.json({ error: "Chaves de etapa duplicadas" }, 400);
    }
  }

  if (body.closedStages) {
    for (const stage of body.closedStages) {
      if (!stage.key || !stage.label || !stage.color) {
        return c.json({ error: "Cada etapa de fechamento precisa de key, label e color" }, 400);
      }
      stage.key = stage.key.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    }
  }

  // Merge with existing config (so partial updates work)
  const [org] = await db
    .select({ pipelineConfig: organizacoes.pipelineConfig })
    .from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId))
    .limit(1);

  const current = buildPipelineConfig(org?.pipelineConfig as Partial<PipelineConfig> | null);
  const updated: PipelineConfig = {
    stages: body.stages || current.stages,
    closedStages: body.closedStages || current.closedStages,
    lossReasons: body.lossReasons || current.lossReasons,
    setores: body.setores || current.setores,
    origens: body.origens || current.origens,
    servicos: body.servicos || current.servicos,
  };

  await db
    .update(organizacoes)
    .set({ pipelineConfig: updated, updatedAt: new Date() })
    .where(eq(organizacoes.id, ctx.organizacaoId));

  return c.json(updated);
});

export const configuracoesRoutes = app;
