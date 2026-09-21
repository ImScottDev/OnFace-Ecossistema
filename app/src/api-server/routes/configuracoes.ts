import { Hono } from "hono";
import { db } from "@/lib/db";
import { organizacoes, auditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { buildPipelineConfig, type PipelineConfig } from "@/lib/crm/pipeline";

const app = new Hono();

// ─── Integracoes ─────────────────────────────────────────────────

// GET /configuracoes/integracoes/inventario — o que existe, e o estado real de
// cada uma. A tela listava três cartões, dois deles marcados "placeholder" no
// próprio código, enquanto cinco integrações rodavam em produção sem aparecer.
app.get("/integracoes/inventario", async (c) => {
  await getCtx(c);
  const { inventarioDeIntegracoes } = await import("@/lib/integrations/inventario");
  return c.json({ integracoes: await inventarioDeIntegracoes() });
});

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
    disqualifyReasons: body.disqualifyReasons || current.disqualifyReasons,
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


// ─── Settings (ICP, enriquecimento, handover, notificações, tracking) ────────
//
// A coluna `organizacoes.settings` (jsonb) existe desde o schema original, com
// o comentário certo em cima dela — mas o endpoint que a lê e escreve nunca
// existiu. Cinco telas de Ajustes (ICP, Enriquecimento, Handover, Notificações
// e Tracking) chamavam GET/PATCH `/api/configuracoes/settings` e tomavam 404:
// carregavam sempre em branco e o botão Salvar sempre falhava (achado 14/09,
// confirmado por HTTP e no console do navegador).

/** Chaves aceitas. Sem allowlist, o PATCH viraria escrita arbitrária no jsonb. */
const CHAVES_SETTINGS = ["icp", "enriquecimento", "handover", "notificacoes", "tracking", "preVendas"] as const;
type ChaveSettings = (typeof CHAVES_SETTINGS)[number];

/** Campos de `tracking` que são segredo e nunca voltam em claro pro browser. */
const SEGREDOS_TRACKING = ["metaToken", "ga4Secret"] as const;
const MASCARA = "••••••••";

function mascarar(valor: unknown): string {
  const s = typeof valor === "string" ? valor : "";
  if (!s) return "";
  return s.length <= 8 ? MASCARA : `${s.slice(0, 4)}${MASCARA}${s.slice(-4)}`;
}

function lerSettings(bruto: unknown): Record<string, unknown> {
  return bruto && typeof bruto === "object" && !Array.isArray(bruto) ? { ...(bruto as Record<string, unknown>) } : {};
}

// GET /configuracoes/settings — configuração da organização, com segredo mascarado
app.get("/settings", async (c) => {
  const ctx = await getCtx(c);
  if (!["admin", "gerente", "super_admin"].includes(ctx.userRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [org] = await db
    .select({ settings: organizacoes.settings })
    .from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId))
    .limit(1);

  const settings = lerSettings(org?.settings);

  // Tracking guarda token da Meta e secret do GA4. A tela só precisa saber se
  // existe valor gravado, nunca o valor.
  const tracking = lerSettings(settings.tracking);
  for (const campo of SEGREDOS_TRACKING) {
    if (tracking[campo]) tracking[campo] = mascarar(tracking[campo]);
  }
  settings.tracking = tracking;

  return c.json(settings);
});

// PATCH /configuracoes/settings — grava UMA chave: { key, value }
app.patch("/settings", async (c) => {
  const ctx = await getCtx(c);
  if (!["admin", "gerente", "super_admin"].includes(ctx.userRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json().catch(() => null) as { key?: string; value?: unknown } | null;
  const key = body?.key;
  if (!key || !CHAVES_SETTINGS.includes(key as ChaveSettings)) {
    return c.json({ error: `key inválida. Aceitas: ${CHAVES_SETTINGS.join(", ")}` }, 400);
  }
  if (body?.value === undefined) {
    return c.json({ error: "value é obrigatório" }, 400);
  }

  const [org] = await db
    .select({ settings: organizacoes.settings })
    .from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId))
    .limit(1);
  const atual = lerSettings(org?.settings);

  let valor = body.value;

  // Segredo mascarado que volta do browser significa "não mexi nisso" — nunca
  // grava a máscara por cima do valor real.
  if (key === "tracking") {
    const anterior = lerSettings(atual.tracking);
    const novo = lerSettings(valor);
    for (const campo of SEGREDOS_TRACKING) {
      const v = novo[campo];
      if (typeof v === "string" && v.includes(MASCARA)) novo[campo] = anterior[campo] ?? "";
    }
    valor = novo;
  }

  const atualizado = { ...atual, [key]: valor };
  await db
    .update(organizacoes)
    .set({ settings: atualizado, updatedAt: new Date() })
    .where(eq(organizacoes.id, ctx.organizacaoId));

  await db.insert(auditLog).values({
    organizacaoId: ctx.organizacaoId,
    actorId: ctx.userId,
    action: "configuracoes.settings_atualizado",
    entityType: "organizacao",
    entityId: ctx.organizacaoId,
    // Valor de tracking não entra no audit: carrega segredo.
    after: key === "tracking" ? { key, campos: Object.keys(lerSettings(valor)) } : { key, value: valor },
    source: "api",
  });

  return c.json({ ok: true });
});

export const configuracoesRoutes = app;
