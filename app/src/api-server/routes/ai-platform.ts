import { Hono } from "hono";
import { indexarConhecimento } from "@/lib/ai-platform/conhecimento/indexar";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  aiAlerts, aiAgentRuns, aiAgentRunSteps, aiCaseEvents, aiCases, aiContactFieldProposals, aiImprovementProposals,
  aiKnowledgeChunks, aiKnowledgeSources, aiKnowledgeVersions, aiMemoryEntries, aiMemoryPointers, aiMemoryVersions,
  aiModels, aiProviderCredentials, aiPurposeBindings, aiRouterMembers, aiRouters, aiRouterDecisions,
  aiSkillActivations, aiSkillPointers, aiSkillVersions, aiUsageBudgets, auditLog, contatos,
} from "@/lib/db/schema";
import { decryptCredential, encryptCredential, maskCredential } from "@/lib/ai-platform/security/credentials";
import { runModelCall, type AiProvider } from "@/lib/ai-platform/runtime/provider-gateway";
import { ClaudeSubscriptionAdapter } from "@/lib/ai-platform/runtime/claude-subscription-adapter";
import { executeRegisteredTool } from "@/lib/ai-platform/tools/registry";
import { getCtx, exigirCtx } from "../compat.js";

const app = new Hono();
const providers = ["groq", "openai", "anthropic", "google"] as const;

async function audit(ctx: Awaited<ReturnType<typeof getCtx>>, action: string, entityType: string, entityId: string | null, after?: unknown) {
  await db.insert(auditLog).values({ organizacaoId: ctx.organizacaoId, actorId: ctx.userId, action, entityType, entityId, after: after ?? null, source: "api" });
}

app.get("/automacoes/ai/providers", async (c) => {
  const ctx = await getCtx(c);
  const [models, bindings] = await Promise.all([
    db.select().from(aiModels).orderBy(aiModels.provider, aiModels.displayName),
    db.select().from(aiPurposeBindings).where(eq(aiPurposeBindings.organizacaoId, ctx.organizacaoId)),
  ]);
  return c.json({ providers, models, bindings });
});

/**
 * A assinatura Claude pertence exclusivamente ao Super Admin e vive no
 * ambiente do runtime. Esta rota deliberadamente devolve apenas o estado,
 * nunca o token OAuth nem uma chave mascarada. Assim a tela pode orientar e
 * testar a conexão sem transformar o banco numa segunda cópia do segredo.
 */
app.get("/automacoes/ai/claude-subscription", async (c) => {
  await exigirCtx(c, "ai.configure");
  return c.json({
    configured: Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim()),
    provider: "claude_subscription",
    credentialSource: "environment",
  });
});

/** Teste explícito e auditável da assinatura; nenhuma ação de CRM ou canal. */
app.post("/automacoes/ai/claude-subscription/test", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) {
    return c.json({ error: "Claude Subscription não está conectada neste ambiente." }, 409);
  }
  try {
    const result = await new ClaudeSubscriptionAdapter().runTextOnly("Responda somente ONFACE_OK");
    if (result.text !== "ONFACE_OK") {
      throw new Error("O Claude respondeu fora do contrato de verificação.");
    }
    await audit(ctx, "ai.claude_subscription.verify", "ai_provider", null, { provider: "claude_subscription", ok: true });
    return c.json({ ok: true, response: result.text, durationMs: result.durationMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await audit(ctx, "ai.claude_subscription.verify", "ai_provider", null, { provider: "claude_subscription", ok: false, error: message.slice(0, 300) });
    return c.json({ ok: false, error: message }, 422);
  }
});

app.put("/automacoes/ai/providers/bindings/:purpose", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const parsed = z.object({ provider: z.enum(providers), credentialId: z.string().uuid().nullable().optional(), modelId: z.string().min(1), baseUrl: z.string().url().nullable().optional(), ativo: z.boolean().default(true) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Binding invalido", details: parsed.error.flatten() }, 400);
  const purpose = c.req.param("purpose");
  const [binding] = await db.insert(aiPurposeBindings).values({ organizacaoId: ctx.organizacaoId, purpose, provider: parsed.data.provider, credentialId: parsed.data.credentialId ?? null, modelId: parsed.data.modelId, baseUrl: parsed.data.baseUrl ?? null, ativo: parsed.data.ativo })
    .onConflictDoUpdate({ target: [aiPurposeBindings.organizacaoId, aiPurposeBindings.purpose], set: { provider: parsed.data.provider, credentialId: parsed.data.credentialId ?? null, modelId: parsed.data.modelId, baseUrl: parsed.data.baseUrl ?? null, ativo: parsed.data.ativo, updatedAt: new Date() } }).returning();
  await audit(ctx, "ai.binding.upsert", "ai_purpose_binding", binding.id, { purpose, provider: binding.provider, modelId: binding.modelId });
  return c.json(binding);
});

app.get("/automacoes/ai/credentials", async (c) => {
  const ctx = await getCtx(c);
  const rows = await db.select({ id: aiProviderCredentials.id, provider: aiProviderCredentials.provider, label: aiProviderCredentials.label, apiKeyLast4: aiProviderCredentials.apiKeyLast4, validatedAt: aiProviderCredentials.validatedAt, validationError: aiProviderCredentials.validationError, modelsAvailable: aiProviderCredentials.modelsAvailable, ativo: aiProviderCredentials.ativo, createdAt: aiProviderCredentials.createdAt, updatedAt: aiProviderCredentials.updatedAt })
    .from(aiProviderCredentials).where(eq(aiProviderCredentials.organizacaoId, ctx.organizacaoId)).orderBy(desc(aiProviderCredentials.updatedAt));
  return c.json({ credentials: rows.map((row) => ({ ...row, masked: maskCredential(row.apiKeyLast4) })) });
});

app.post("/automacoes/ai/credentials", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const parsed = z.object({ provider: z.enum(providers), label: z.string().min(1).max(80), apiKey: z.string().min(8) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Credencial invalida", details: parsed.error.flatten() }, 400);
  const encrypted = encryptCredential(parsed.data.apiKey);
  const [credential] = await db.insert(aiProviderCredentials).values({ organizacaoId: ctx.organizacaoId, provider: parsed.data.provider, label: parsed.data.label, apiKeyCiphertext: encrypted.ciphertext, apiKeyIv: encrypted.iv, apiKeyTag: encrypted.tag, apiKeyLast4: encrypted.last4, encryptionVersion: encrypted.version, createdById: ctx.userId }).returning({ id: aiProviderCredentials.id, provider: aiProviderCredentials.provider, label: aiProviderCredentials.label, apiKeyLast4: aiProviderCredentials.apiKeyLast4, ativo: aiProviderCredentials.ativo });
  await audit(ctx, "ai.credential.create", "ai_provider_credential", credential.id, { provider: credential.provider, label: credential.label, last4: credential.apiKeyLast4 });
  return c.json({ ...credential, masked: maskCredential(credential.apiKeyLast4) }, 201);
});

app.patch("/automacoes/ai/credentials/:id", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const parsed = z.object({ label: z.string().min(1).max(80).optional(), ativo: z.boolean().optional(), apiKey: z.string().min(8).optional() }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Atualizacao invalida" }, 400);
  const encrypted = parsed.data.apiKey ? encryptCredential(parsed.data.apiKey) : null;
  const [row] = await db.update(aiProviderCredentials).set({ ...(parsed.data.label ? { label: parsed.data.label } : {}), ...(parsed.data.ativo !== undefined ? { ativo: parsed.data.ativo } : {}), ...(encrypted ? { apiKeyCiphertext: encrypted.ciphertext, apiKeyIv: encrypted.iv, apiKeyTag: encrypted.tag, apiKeyLast4: encrypted.last4, encryptionVersion: encrypted.version, validatedAt: null, validationError: null } : {}), updatedAt: new Date() })
    .where(and(eq(aiProviderCredentials.id, c.req.param("id")), eq(aiProviderCredentials.organizacaoId, ctx.organizacaoId))).returning({ id: aiProviderCredentials.id, provider: aiProviderCredentials.provider, label: aiProviderCredentials.label, apiKeyLast4: aiProviderCredentials.apiKeyLast4, ativo: aiProviderCredentials.ativo });
  if (!row) return c.json({ error: "Credencial nao encontrada" }, 404);
  await audit(ctx, "ai.credential.update", "ai_provider_credential", row.id, { provider: row.provider, label: row.label, ativo: row.ativo, last4: row.apiKeyLast4 });
  return c.json({ ...row, masked: maskCredential(row.apiKeyLast4) });
});

app.post("/automacoes/ai/credentials/:id/validate", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure");
  const [credential] = await db.select().from(aiProviderCredentials).where(and(eq(aiProviderCredentials.id, c.req.param("id")), eq(aiProviderCredentials.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!credential) return c.json({ error: "Credencial nao encontrada" }, 404);
  const [model] = await db.select().from(aiModels).where(and(eq(aiModels.provider, credential.provider), eq(aiModels.isDefaultForProvider, true))).limit(1);
  if (!model) return c.json({ error: "Provider sem modelo default" }, 409);
  try {
    await runModelCall({ provider: credential.provider as AiProvider, model: model.modelId, apiKey: decryptCredential({ ciphertext: credential.apiKeyCiphertext, iv: credential.apiKeyIv, tag: credential.apiKeyTag }), messages: [{ role: "user", content: "Responda somente OK." }], tools: [], maxTokens: 8, temperature: 0 });
    await db.update(aiProviderCredentials).set({ validatedAt: new Date(), validationError: null, updatedAt: new Date() }).where(eq(aiProviderCredentials.id, credential.id));
    return c.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(aiProviderCredentials).set({ validationError: message.slice(0, 500), updatedAt: new Date() }).where(eq(aiProviderCredentials.id, credential.id));
    return c.json({ ok: false, error: message }, 422);
  }
});

const routerSchema = z.object({ nome: z.string().min(1).max(100), channelSessionId: z.string().uuid(), ativo: z.boolean().default(true), config: z.record(z.string(), z.unknown()).default({ classifierModel: null, sticky: true, minConfidence: 0.6 }), fallbackAgentId: z.string().uuid().nullable().optional(), members: z.array(z.object({ agentId: z.string().uuid(), intentName: z.string().min(1), intentDescription: z.string().min(1), examples: z.array(z.string()).default([]), position: z.number().int().default(0) })).default([]) });

app.get("/automacoes/ai/routers", async (c) => {
  const ctx = await getCtx(c);
  const [routers, members] = await Promise.all([db.select().from(aiRouters).where(eq(aiRouters.organizacaoId, ctx.organizacaoId)).orderBy(desc(aiRouters.updatedAt)), db.select().from(aiRouterMembers).where(eq(aiRouterMembers.organizacaoId, ctx.organizacaoId)).orderBy(aiRouterMembers.position)]);
  return c.json({ routers: routers.map((router) => ({ ...router, members: members.filter((member) => member.routerId === router.id) })) });
});

app.post("/automacoes/ai/routers", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure"); const parsed = routerSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Roteador invalido", details: parsed.error.flatten() }, 400);
  const result = await db.transaction(async (tx) => {
    const [router] = await tx.insert(aiRouters).values({ organizacaoId: ctx.organizacaoId, nome: parsed.data.nome, channelSessionId: parsed.data.channelSessionId, ativo: parsed.data.ativo, config: parsed.data.config, fallbackAgentId: parsed.data.fallbackAgentId ?? null, createdById: ctx.userId }).returning();
    const members = parsed.data.members.length ? await tx.insert(aiRouterMembers).values(parsed.data.members.map((member) => ({ organizacaoId: ctx.organizacaoId, routerId: router.id, ...member }))).returning() : [];
    return { router, members };
  });
  await audit(ctx, "ai.router.create", "ai_router", result.router.id, { nome: result.router.nome });
  return c.json(result, 201);
});

app.put("/automacoes/ai/routers/:id", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure"); const parsed = routerSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Roteador invalido", details: parsed.error.flatten() }, 400);
  const result = await db.transaction(async (tx) => {
    const [router] = await tx.update(aiRouters).set({ nome: parsed.data.nome, channelSessionId: parsed.data.channelSessionId, ativo: parsed.data.ativo, config: parsed.data.config, fallbackAgentId: parsed.data.fallbackAgentId ?? null, updatedAt: new Date() }).where(and(eq(aiRouters.id, c.req.param("id")), eq(aiRouters.organizacaoId, ctx.organizacaoId))).returning();
    if (!router) return null;
    await tx.delete(aiRouterMembers).where(and(eq(aiRouterMembers.routerId, router.id), eq(aiRouterMembers.organizacaoId, ctx.organizacaoId)));
    const members = parsed.data.members.length ? await tx.insert(aiRouterMembers).values(parsed.data.members.map((member) => ({ organizacaoId: ctx.organizacaoId, routerId: router.id, ...member }))).returning() : [];
    return { router, members };
  });
  if (!result) return c.json({ error: "Roteador nao encontrado" }, 404);
  return c.json(result);
});

app.get("/automacoes/ai/routers/decisions", async (c) => {
  const ctx = await getCtx(c); return c.json({ decisions: await db.select().from(aiRouterDecisions).where(eq(aiRouterDecisions.organizacaoId, ctx.organizacaoId)).orderBy(desc(aiRouterDecisions.createdAt)).limit(250) });
});

app.get("/automacoes/ai/knowledge", async (c) => {
  const ctx = await getCtx(c); return c.json({ sources: await db.select().from(aiKnowledgeSources).where(eq(aiKnowledgeSources.organizacaoId, ctx.organizacaoId)).orderBy(desc(aiKnowledgeSources.updatedAt)) });
});

app.post("/automacoes/ai/knowledge", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure"); const parsed = z.object({ nome: z.string().min(1), sourceType: z.enum(["text", "url", "file", "faq"]), sourceUri: z.string().nullable().optional(), content: z.string().min(1).optional() }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Fonte invalida", details: parsed.error.flatten() }, 400);
  const [source] = await db.insert(aiKnowledgeSources).values({ organizacaoId: ctx.organizacaoId, nome: parsed.data.nome, sourceType: parsed.data.sourceType, sourceUri: parsed.data.sourceUri ?? null, status: parsed.data.content ? "indexing" : "pending", createdById: ctx.userId }).returning();
  if (parsed.data.content) await indexKnowledge(ctx.organizacaoId, source.id, parsed.data.content);
  return c.json({ source }, 201);
});

const indexKnowledge = indexarConhecimento;

app.post("/automacoes/ai/knowledge/:id/reindex", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure"); const parsed = z.object({ content: z.string().min(1).optional() }).safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Conteudo invalido" }, 400);
  const [source] = await db.select().from(aiKnowledgeSources).where(and(eq(aiKnowledgeSources.id, c.req.param("id")), eq(aiKnowledgeSources.organizacaoId, ctx.organizacaoId))).limit(1); if (!source) return c.json({ error: "Fonte nao encontrada" }, 404);
  let content = parsed.data.content;
  if (!content && source.sourceType === "url" && source.sourceUri) { const response = await fetch(source.sourceUri); if (!response.ok) return c.json({ error: `URL respondeu ${response.status}` }, 422); content = await response.text(); }
  if (!content) return c.json({ error: "Envie content para reindexar" }, 400);
  return c.json({ version: await indexKnowledge(ctx.organizacaoId, source.id, content) });
});

app.get("/automacoes/ai/memory", async (c) => {
  const ctx = await getCtx(c); const [pointer, versions, entries] = await Promise.all([db.select().from(aiMemoryPointers).where(eq(aiMemoryPointers.organizacaoId, ctx.organizacaoId)).limit(1).then((rows) => rows[0] ?? null), db.select().from(aiMemoryVersions).where(eq(aiMemoryVersions.organizacaoId, ctx.organizacaoId)).orderBy(desc(aiMemoryVersions.versionNumber)), db.select().from(aiMemoryEntries).where(eq(aiMemoryEntries.organizacaoId, ctx.organizacaoId)).orderBy(desc(aiMemoryEntries.createdAt))]);
  return c.json({ pointer, activeVersion: pointer ? versions.find((version) => version.id === pointer.versionId) ?? null : null, versions, entries });
});

app.put("/automacoes/ai/memory", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure"); const parsed = z.object({ content: z.string().min(1) }).safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Memoria invalida" }, 400);
  const result = await db.transaction(async (tx) => { const [last] = await tx.select({ versionNumber: aiMemoryVersions.versionNumber }).from(aiMemoryVersions).where(eq(aiMemoryVersions.organizacaoId, ctx.organizacaoId)).orderBy(desc(aiMemoryVersions.versionNumber)).limit(1); const [version] = await tx.insert(aiMemoryVersions).values({ organizacaoId: ctx.organizacaoId, versionNumber: (last?.versionNumber ?? 0) + 1, content: parsed.data.content, createdById: ctx.userId }).returning(); await tx.insert(aiMemoryPointers).values({ organizacaoId: ctx.organizacaoId, versionId: version.id }).onConflictDoUpdate({ target: aiMemoryPointers.organizacaoId, set: { versionId: version.id, updatedAt: new Date() } }); return version; });
  return c.json(result);
});

app.post("/automacoes/ai/memory/entries", async (c) => {
  const ctx = await exigirCtx(c, "ai.use"); const parsed = z.object({ title: z.string().min(1), body: z.string().min(1), status: z.enum(["proposed", "active", "archived"]).default("active") }).safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Entrada invalida" }, 400);
  const [entry] = await db.insert(aiMemoryEntries).values({ organizacaoId: ctx.organizacaoId, title: parsed.data.title, body: parsed.data.body, source: "manual", status: parsed.data.status, createdById: ctx.userId }).returning(); return c.json(entry, 201);
});

app.get("/automacoes/ai/skills", async (c) => {
  const ctx = await getCtx(c); const [versions, pointers, activations] = await Promise.all([db.select().from(aiSkillVersions).where(sql`${aiSkillVersions.organizacaoId} = ${ctx.organizacaoId} OR ${aiSkillVersions.organizacaoId} IS NULL`).orderBy(aiSkillVersions.name, desc(aiSkillVersions.versionNumber)), db.select().from(aiSkillPointers).where(eq(aiSkillPointers.organizacaoId, ctx.organizacaoId)), db.select().from(aiSkillActivations).where(eq(aiSkillActivations.organizacaoId, ctx.organizacaoId)).orderBy(desc(aiSkillActivations.createdAt)).limit(100)]); return c.json({ versions, pointers, activations });
});

app.post("/automacoes/ai/skills", async (c) => {
  const ctx = await exigirCtx(c, "ai.configure"); const parsed = z.object({ name: z.string().min(1), description: z.string().optional(), instructions: z.string().min(1), manifest: z.array(z.unknown()).default([]) }).safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Skill invalida" }, 400);
  const result = await db.transaction(async (tx) => { const [last] = await tx.select({ versionNumber: aiSkillVersions.versionNumber }).from(aiSkillVersions).where(and(eq(aiSkillVersions.organizacaoId, ctx.organizacaoId), eq(aiSkillVersions.name, parsed.data.name))).orderBy(desc(aiSkillVersions.versionNumber)).limit(1); const [version] = await tx.insert(aiSkillVersions).values({ organizacaoId: ctx.organizacaoId, name: parsed.data.name, versionNumber: (last?.versionNumber ?? 0) + 1, description: parsed.data.description ?? null, instructions: parsed.data.instructions, manifest: parsed.data.manifest, createdById: ctx.userId }).returning(); await tx.insert(aiSkillPointers).values({ organizacaoId: ctx.organizacaoId, name: version.name, versionId: version.id }).onConflictDoUpdate({ target: [aiSkillPointers.organizacaoId, aiSkillPointers.name], set: { versionId: version.id, ativo: true, updatedAt: new Date() } }); return version; }); return c.json(result, 201);
});

app.get("/automacoes/ai/cases", async (c) => { const ctx = await getCtx(c); return c.json({ cases: await db.select().from(aiCases).where(eq(aiCases.organizacaoId, ctx.organizacaoId)).orderBy(desc(aiCases.updatedAt)).limit(250) }); });
app.get("/automacoes/ai/cases/:id/events", async (c) => { const ctx = await getCtx(c); const [caseRow] = await db.select().from(aiCases).where(and(eq(aiCases.id, c.req.param("id")), eq(aiCases.organizacaoId, ctx.organizacaoId))).limit(1); if (!caseRow) return c.json({ error: "Caso nao encontrado" }, 404); return c.json({ case: caseRow, events: await db.select().from(aiCaseEvents).where(and(eq(aiCaseEvents.caseId, caseRow.id), eq(aiCaseEvents.organizacaoId, ctx.organizacaoId))).orderBy(aiCaseEvents.createdAt) }); });
app.post("/automacoes/ai/cases/:id/action", async (c) => {
  const ctx = await exigirCtx(c, "ai.use");
  const parsed = z.object({ action: z.enum(["reply", "resolve", "escalate", "cancel", "approve"]), body: z.string().optional() }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Acao invalida" }, 400);
  const [current] = await db.select().from(aiCases).where(and(eq(aiCases.id, c.req.param("id")), eq(aiCases.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!current) return c.json({ error: "Caso nao encontrado" }, 404);
  let execution: Awaited<ReturnType<typeof executeRegisteredTool>> | null = null;
  if (parsed.data.action === "approve") {
    const snapshot = current.contextSnapshot && typeof current.contextSnapshot === "object" ? current.contextSnapshot as Record<string, unknown> : {};
    if (current.source !== "tool_approval" || current.status !== "awaiting_human" || typeof snapshot.toolName !== "string" || !snapshot.toolInput || typeof snapshot.toolInput !== "object") return c.json({ error: "Caso não possui ação pendente aprovável" }, 409);
    if (!current.agentId || !current.runId) return c.json({ error: "Caso sem rastreabilidade do agente" }, 409);
    execution = await executeRegisteredTool(snapshot.toolName, { organizacaoId: ctx.organizacaoId, agentId: current.agentId, runId: current.runId, contatoId: current.contatoId, leadId: current.leadId, mode: "live", autonomy: "autonomous" }, snapshot.toolInput as Record<string, unknown>);
    if (!execution.ok) {
      await db.update(aiCases).set({ status: "escalated", updatedAt: new Date() }).where(eq(aiCases.id, current.id));
      await db.insert(aiCaseEvents).values({ organizacaoId: ctx.organizacaoId, caseId: current.id, kind: "approval_failed", actorKind: "human", actorUserId: ctx.userId, humanAction: "approve", body: execution.error ?? "Falha ao executar ação aprovada", metadata: { execution } });
      return c.json({ error: execution.error ?? "Ação aprovada falhou", execution }, 422);
    }
  }
  const status = parsed.data.action === "approve" ? "resolved" : { reply: "awaiting_contact", resolve: "resolved", escalate: "escalated", cancel: "cancelled" }[parsed.data.action];
  const [caseRow] = await db.update(aiCases).set({ status, ...(status === "resolved" || status === "cancelled" ? { closedAt: new Date() } : {}), updatedAt: new Date() }).where(eq(aiCases.id, current.id)).returning();
  await db.insert(aiCaseEvents).values({ organizacaoId: ctx.organizacaoId, caseId: caseRow.id, kind: parsed.data.action === "reply" ? "human_replied" : parsed.data.action, actorKind: "human", actorUserId: ctx.userId, humanAction: parsed.data.action, body: parsed.data.body ?? null, metadata: execution ? { execution } : {} });
  await audit(ctx, `ai.case.${parsed.data.action}`, "ai_case", caseRow.id, execution ?? { status });
  return c.json({ case: caseRow, execution });
});

app.get("/automacoes/ai/alerts", async (c) => { const ctx = await getCtx(c); return c.json({ alerts: await db.select().from(aiAlerts).where(eq(aiAlerts.organizacaoId, ctx.organizacaoId)).orderBy(desc(aiAlerts.createdAt)).limit(250) }); });
app.patch("/automacoes/ai/alerts/:id", async (c) => { const ctx = await exigirCtx(c, "ai.use"); const parsed = z.object({ status: z.enum(["open", "acknowledged", "resolved"]) }).safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Status invalido" }, 400); const [alert] = await db.update(aiAlerts).set({ status: parsed.data.status, ...(parsed.data.status === "acknowledged" ? { acknowledgedById: ctx.userId, acknowledgedAt: new Date() } : {}), ...(parsed.data.status === "resolved" ? { resolvedAt: new Date() } : {}) }).where(and(eq(aiAlerts.id, c.req.param("id")), eq(aiAlerts.organizacaoId, ctx.organizacaoId))).returning(); return alert ? c.json(alert) : c.json({ error: "Alerta nao encontrado" }, 404); });

app.get("/automacoes/ai/proposals", async (c) => { const ctx = await getCtx(c); const [fields, improvements] = await Promise.all([db.select().from(aiContactFieldProposals).where(eq(aiContactFieldProposals.organizacaoId, ctx.organizacaoId)).orderBy(desc(aiContactFieldProposals.proposedAt)), db.select().from(aiImprovementProposals).where(eq(aiImprovementProposals.organizacaoId, ctx.organizacaoId)).orderBy(desc(aiImprovementProposals.createdAt))]); return c.json({ fieldProposals: fields, improvementProposals: improvements }); });
app.post("/automacoes/ai/proposals/fields/:id/decision", async (c) => { const ctx = await exigirCtx(c, "ai.use"); const parsed = z.object({ decision: z.enum(["accept", "dismiss"]), reason: z.string().optional() }).safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Decisao invalida" }, 400); const [proposal] = await db.select().from(aiContactFieldProposals).where(and(eq(aiContactFieldProposals.id, c.req.param("id")), eq(aiContactFieldProposals.organizacaoId, ctx.organizacaoId), eq(aiContactFieldProposals.status, "pending"))).limit(1); if (!proposal) return c.json({ error: "Proposta pendente nao encontrada" }, 404); await db.transaction(async (tx) => { if (parsed.data.decision === "accept") { const patch = proposal.campo === "nome" ? { nome: proposal.valorProposto } : proposal.campo === "email" ? { email: proposal.valorProposto } : { telefone: proposal.valorProposto }; await tx.update(contatos).set({ ...patch, updatedAt: new Date() }).where(and(eq(contatos.id, proposal.contatoId), eq(contatos.organizacaoId, ctx.organizacaoId))); } await tx.update(aiContactFieldProposals).set({ status: parsed.data.decision === "accept" ? "accepted" : "dismissed", decidedAt: new Date(), decidedByUserId: ctx.userId, motivoRecusa: parsed.data.decision === "dismiss" ? parsed.data.reason ?? null : null, updatedAt: new Date() }).where(eq(aiContactFieldProposals.id, proposal.id)); }); return c.json({ ok: true }); });

app.get("/automacoes/ai/runs", async (c) => { const ctx = await getCtx(c); const runs = await db.select().from(aiAgentRuns).where(eq(aiAgentRuns.organizacaoId, ctx.organizacaoId)).orderBy(desc(aiAgentRuns.startedAt)).limit(250); return c.json({ runs }); });
app.get("/automacoes/ai/runs/:id/steps", async (c) => { const ctx = await getCtx(c); const [run] = await db.select({ id: aiAgentRuns.id }).from(aiAgentRuns).where(and(eq(aiAgentRuns.id, c.req.param("id")), eq(aiAgentRuns.organizacaoId, ctx.organizacaoId))).limit(1); if (!run) return c.json({ error: "Run nao encontrado" }, 404); return c.json({ steps: await db.select().from(aiAgentRunSteps).where(and(eq(aiAgentRunSteps.runId, run.id), eq(aiAgentRunSteps.organizacaoId, ctx.organizacaoId))).orderBy(aiAgentRunSteps.sequence) }); });

app.get("/automacoes/ai/usage", async (c) => { const ctx = await getCtx(c); const [summary, byAgent, budgets] = await Promise.all([db.select({ runs: sql<number>`count(*)::int`, tokensInput: sql<number>`coalesce(sum(${aiAgentRuns.tokensInput}),0)::int`, tokensOutput: sql<number>`coalesce(sum(${aiAgentRuns.tokensOutput}),0)::int`, cost: sql<string>`coalesce(sum(${aiAgentRuns.custo}),0)` }).from(aiAgentRuns).where(and(eq(aiAgentRuns.organizacaoId, ctx.organizacaoId), sql`${aiAgentRuns.startedAt} >= date_trunc('month', now())`)).then((rows) => rows[0]), db.select({ agentId: aiAgentRuns.agentId, runs: sql<number>`count(*)::int`, tokens: sql<number>`coalesce(sum(${aiAgentRuns.tokensInput} + ${aiAgentRuns.tokensOutput}),0)::int`, cost: sql<string>`coalesce(sum(${aiAgentRuns.custo}),0)` }).from(aiAgentRuns).where(and(eq(aiAgentRuns.organizacaoId, ctx.organizacaoId), sql`${aiAgentRuns.startedAt} >= date_trunc('month', now())`)).groupBy(aiAgentRuns.agentId), db.select().from(aiUsageBudgets).where(eq(aiUsageBudgets.organizacaoId, ctx.organizacaoId))]); return c.json({ period: "month", summary, byAgent, budgets }); });
app.put("/automacoes/ai/usage/budgets", async (c) => { const ctx = await exigirCtx(c, "ai.configure"); const parsed = z.object({ agentId: z.string().uuid().nullable().optional(), provider: z.string().nullable().optional(), period: z.enum(["daily", "monthly"]).default("monthly"), tokenLimit: z.number().int().positive().nullable().optional(), costLimit: z.number().positive().nullable().optional(), warningPercent: z.number().int().min(1).max(100).default(80), hardStop: z.boolean().default(true), ativo: z.boolean().default(true) }).safeParse(await c.req.json()); if (!parsed.success) return c.json({ error: "Orcamento invalido" }, 400); const [budget] = await db.insert(aiUsageBudgets).values({ organizacaoId: ctx.organizacaoId, agentId: parsed.data.agentId ?? null, provider: parsed.data.provider ?? null, period: parsed.data.period, tokenLimit: parsed.data.tokenLimit ?? null, costLimit: parsed.data.costLimit == null ? null : String(parsed.data.costLimit), warningPercent: parsed.data.warningPercent, hardStop: parsed.data.hardStop, ativo: parsed.data.ativo }).returning(); return c.json(budget, 201); });

export const aiPlatformRoutes = app;
