import { Hono } from "hono";
import { db } from "@/lib/db";
import {
  aiSdrConfig, aiSdrContatoState, aiSdrLogs,
  whatsappSessao, whatsappMensagens, organizacoes, usuarios, contatos,
  servicosCatalogo,
} from "@/lib/db/schema";
import { eq, and, desc, sql, gte, count } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { encrypt, decrypt } from "@/lib/email/encryption.js";

const app = new Hono();

// ─── CONFIG ─────────────────────────────────────────────────────

// GET /ai-sdr/config
app.get("/config", async (c) => {
  const ctx = await getCtx(c);

  const [config] = await db
    .select()
    .from(aiSdrConfig)
    .where(eq(aiSdrConfig.organizacaoId, ctx.organizacaoId))
    .limit(1);

  if (!config) return c.json({ config: null });

  // Mask API key
  let masked: string | null = null;
  if (config.groqApiKey) {
    try {
      const decrypted = decrypt(config.groqApiKey);
      masked = `gsk_...${decrypted.slice(-6)}`;
    } catch {
      masked = "***encrypted***";
    }
  }

  return c.json({
    config: {
      ...config,
      groqApiKey: masked,
    },
  });
});

// PUT /ai-sdr/config
app.put("/config", async (c) => {
  const ctx = await getCtx(c);
  const body = await c.req.json();

  const {
    ativo, groqApiKey, modelo, systemPrompt, nomeAssistente,
    idiomaResposta, horarioComercial, foraHorarioMsg, maxTokensResposta,
    temperaturaModelo, handoffTriggers, stageConfig, styleGuide,
    knowledgeBase, rateLimitMsgs, rateLimitWindowMin, delayMinMs,
    delayMaxMs, debounceMs,
  } = body;

  // Encrypt API key if provided (non-masked)
  let encryptedKey: string | undefined;
  if (groqApiKey && !groqApiKey.startsWith("gsk_...")) {
    encryptedKey = encrypt(groqApiKey);
  }

  const values: Record<string, unknown> = {
    organizacaoId: ctx.organizacaoId,
    updatedAt: new Date(),
  };
  if (ativo !== undefined) values.ativo = ativo;
  if (encryptedKey) values.groqApiKey = encryptedKey;
  if (modelo) values.modelo = modelo;
  if (systemPrompt !== undefined) values.systemPrompt = systemPrompt;
  if (nomeAssistente) values.nomeAssistente = nomeAssistente;
  if (idiomaResposta) values.idiomaResposta = idiomaResposta;
  if (horarioComercial !== undefined) values.horarioComercial = horarioComercial;
  if (foraHorarioMsg !== undefined) values.foraHorarioMsg = foraHorarioMsg;
  if (maxTokensResposta) values.maxTokensResposta = maxTokensResposta;
  if (temperaturaModelo) values.temperaturaModelo = temperaturaModelo;
  if (handoffTriggers !== undefined) values.handoffTriggers = handoffTriggers;
  if (stageConfig !== undefined) values.stageConfig = stageConfig;
  if (styleGuide !== undefined) values.styleGuide = styleGuide;
  if (knowledgeBase !== undefined) values.knowledgeBase = knowledgeBase;
  if (rateLimitMsgs) values.rateLimitMsgs = rateLimitMsgs;
  if (rateLimitWindowMin) values.rateLimitWindowMin = rateLimitWindowMin;
  if (delayMinMs) values.delayMinMs = delayMinMs;
  if (delayMaxMs) values.delayMaxMs = delayMaxMs;
  if (debounceMs) values.debounceMs = debounceMs;

  const [config] = await db
    .insert(aiSdrConfig)
    .values(values as typeof aiSdrConfig.$inferInsert)
    .onConflictDoUpdate({
      target: aiSdrConfig.organizacaoId,
      set: values,
    })
    .returning();

  return c.json({ config });
});

// ─── CONTATO STATE ──────────────────────────────────────────────

// GET /ai-sdr/contatos/:id/state
app.get("/contatos/:id/state", async (c) => {
  const ctx = await getCtx(c);
  const contatoId = c.req.param("id");

  const [state] = await db
    .select()
    .from(aiSdrContatoState)
    .where(and(
      eq(aiSdrContatoState.contatoId, contatoId),
      eq(aiSdrContatoState.organizacaoId, ctx.organizacaoId),
    ))
    .limit(1);

  return c.json({ state: state || null });
});

// PATCH /ai-sdr/contatos/:id/toggle
app.patch("/contatos/:id/toggle", async (c) => {
  const ctx = await getCtx(c);
  const contatoId = c.req.param("id");
  const { aiAtivo } = await c.req.json();

  const values: Record<string, unknown> = {
    contatoId,
    organizacaoId: ctx.organizacaoId,
    aiAtivo: !!aiAtivo,
    updatedAt: new Date(),
  };

  if (!aiAtivo) {
    values.handoffAt = new Date();
    values.handoffMotivo = "manual_toggle";
    values.handoffUsuarioId = ctx.userId;
  } else {
    values.handoffAt = null;
    values.handoffMotivo = null;
    values.handoffUsuarioId = null;
  }

  const [state] = await db
    .insert(aiSdrContatoState)
    .values(values as typeof aiSdrContatoState.$inferInsert)
    .onConflictDoUpdate({
      target: aiSdrContatoState.contatoId,
      set: values,
    })
    .returning();

  return c.json({ state });
});

// ─── LOGS ───────────────────────────────────────────────────────

// GET /ai-sdr/logs
app.get("/logs", async (c) => {
  const ctx = await getCtx(c);
  const { contatoId, tipo, limit: limitStr, offset: offsetStr } = c.req.query();

  const conditions = [eq(aiSdrLogs.organizacaoId, ctx.organizacaoId)];
  if (contatoId) conditions.push(eq(aiSdrLogs.contatoId, contatoId));
  if (tipo) conditions.push(eq(aiSdrLogs.tipo, tipo));

  const limit = Math.min(parseInt(limitStr || "50"), 200);
  const offset = parseInt(offsetStr || "0");

  const [logs, [{ total }]] = await Promise.all([
    db.select()
      .from(aiSdrLogs)
      .where(and(...conditions))
      .orderBy(desc(aiSdrLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() })
      .from(aiSdrLogs)
      .where(and(...conditions)),
  ]);

  return c.json({ logs, total });
});

// ─── STATS ──────────────────────────────────────────────────────

// GET /ai-sdr/stats
app.get("/stats", async (c) => {
  const ctx = await getCtx(c);
  const orgId = ctx.organizacaoId;

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    [totalMsgs],
    [msgs24h],
    [totalHandoffs],
    [handoffs7d],
    [totalTokens],
    [activeContacts],
  ] = await Promise.all([
    db.select({ count: count() }).from(aiSdrLogs)
      .where(and(eq(aiSdrLogs.organizacaoId, orgId), eq(aiSdrLogs.tipo, "resposta"))),
    db.select({ count: count() }).from(aiSdrLogs)
      .where(and(eq(aiSdrLogs.organizacaoId, orgId), eq(aiSdrLogs.tipo, "resposta"), gte(aiSdrLogs.createdAt, last24h))),
    db.select({ count: count() }).from(aiSdrLogs)
      .where(and(eq(aiSdrLogs.organizacaoId, orgId), eq(aiSdrLogs.tipo, "handoff"))),
    db.select({ count: count() }).from(aiSdrLogs)
      .where(and(eq(aiSdrLogs.organizacaoId, orgId), eq(aiSdrLogs.tipo, "handoff"), gte(aiSdrLogs.createdAt, last7d))),
    db.select({ total: sql<number>`coalesce(sum(${aiSdrLogs.tokensInput} + ${aiSdrLogs.tokensOutput}), 0)` })
      .from(aiSdrLogs).where(eq(aiSdrLogs.organizacaoId, orgId)),
    db.select({ count: count() }).from(aiSdrContatoState)
      .where(and(eq(aiSdrContatoState.organizacaoId, orgId), eq(aiSdrContatoState.aiAtivo, true))),
  ]);

  return c.json({
    totalMsgsAi: totalMsgs.count,
    msgsAi24h: msgs24h.count,
    totalHandoffs: totalHandoffs.count,
    handoffs7d: handoffs7d.count,
    totalTokens: totalTokens.total,
    activeContacts: activeContacts.count,
  });
});

// ─── STYLE LEARNING ─────────────────────────────────────────────

// POST /ai-sdr/style/analyze
app.post("/style/analyze", async (c) => {
  const ctx = await getCtx(c);
  const orgId = ctx.organizacaoId;

  // Fetch last 500 human outgoing messages
  const humanMsgs = await db
    .select({
      conteudo: whatsappMensagens.conteudo,
    })
    .from(whatsappMensagens)
    .innerJoin(contatos, eq(whatsappMensagens.contatoId, contatos.id))
    .where(and(
      eq(contatos.organizacaoId, orgId),
      eq(whatsappMensagens.direcao, "out"),
      eq(whatsappMensagens.tipo, "text"),
      sql`(${whatsappMensagens.dados}->>'aiGenerated')::boolean IS NOT TRUE`,
      sql`${whatsappMensagens.conteudo} IS NOT NULL`,
    ))
    .orderBy(desc(whatsappMensagens.createdAt))
    .limit(500);

  if (humanMsgs.length < 20) {
    return c.json({ error: "Poucas mensagens humanas para análise (mín 20)" }, 400);
  }

  // Get config for API key
  const [config] = await db
    .select()
    .from(aiSdrConfig)
    .where(eq(aiSdrConfig.organizacaoId, orgId))
    .limit(1);

  let apiKey = process.env.GROQ_API_KEY;
  if (config?.groqApiKey) {
    try { apiKey = decrypt(config.groqApiKey); } catch { /* use env fallback */ }
  }

  if (!apiKey) return c.json({ error: "Groq API key não configurada" }, 400);

  try {
    const sampledMsgs = humanMsgs
      .filter((m) => m.conteudo && m.conteudo.length > 10)
      .map((m) => m.conteudo)
      .join("\n---\n");

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config?.modelo || "llama-3.3-70b-versatile",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `Analise estas ${humanMsgs.length} mensagens de vendedores reais e extraia um guia de estilo de comunicação detalhado:

${sampledMsgs}

Extraia:
- Tom e nível de formalidade
- Vocabulário e expressões frequentes
- Uso de emojis (quais, com que frequência)
- Estrutura de abordagem (saudação, desenvolvimento, fechamento)
- Como lidam com objeções
- Como fazem follow-up
- Como propõem reuniões
- Comprimento médio das mensagens

Retorne um guia de estilo conciso (max 500 palavras) que uma IA possa seguir para imitar esse estilo.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return c.json({ error: `Groq API error: ${errText}` }, 500);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const styleGuide = data.choices[0]?.message?.content || "";

    // Save to config
    if (config) {
      await db
        .update(aiSdrConfig)
        .set({ styleGuide, updatedAt: new Date() })
        .where(eq(aiSdrConfig.organizacaoId, orgId));
    }

    return c.json({ styleGuide, messagesAnalyzed: humanMsgs.length });
  } catch (error: unknown) {
    console.error("[AI-SDR Style] Error:", error);
    return c.json({ error: "Erro ao analisar estilo" }, 500);
  }
});

// GET /ai-sdr/style/preview
app.get("/style/preview", async (c) => {
  const ctx = await getCtx(c);

  const [config] = await db
    .select({ styleGuide: aiSdrConfig.styleGuide })
    .from(aiSdrConfig)
    .where(eq(aiSdrConfig.organizacaoId, ctx.organizacaoId))
    .limit(1);

  return c.json({ styleGuide: config?.styleGuide || null });
});

export const aiSdrRoutes = app;
