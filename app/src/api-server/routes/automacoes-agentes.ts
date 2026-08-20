// Automações → Agentes (19/08) — 1ª entrada de um catálogo de agentes de IA
// que ainda não existe hoje no CRM2. Achado real (investigação 19/08): não
// há múltiplos "agentes" configuráveis — existe 1 config por organização
// (`ai_sdr_config`) que já roda em produção como AI SDR. Recovery/Collection/
// CS Agent NÃO existem ainda; esta rota não inventa dados pra eles, só
// devolve o único agente real hoje. Estrutura em lista pronta pra crescer
// quando esses outros agentes existirem de fato.
import { Hono } from "hono";
import { db } from "@/lib/db";
import { aiSdrConfig, aiSdrContatoState, aiSdrLogs } from "@/lib/db/schema";
import { eq, and, gte, count } from "drizzle-orm";
import { getCtx } from "../compat.js";

const app = new Hono();

app.get("/automacoes/agentes", async (c) => {
  const ctx = await getCtx(c);
  const orgId = ctx.organizacaoId;

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    [config],
    leadsPorStatus,
    [{ total: leadsTotal }],
    [{ total: execucoes24h }],
  ] = await Promise.all([
    db.select({ ativo: aiSdrConfig.ativo, modelo: aiSdrConfig.modelo, nomeAssistente: aiSdrConfig.nomeAssistente, updatedAt: aiSdrConfig.updatedAt })
      .from(aiSdrConfig)
      .where(eq(aiSdrConfig.organizacaoId, orgId))
      .limit(1),
    db.select({ status: aiSdrContatoState.handoffStatus, n: count() })
      .from(aiSdrContatoState)
      .where(eq(aiSdrContatoState.organizacaoId, orgId))
      .groupBy(aiSdrContatoState.handoffStatus),
    db.select({ total: count() })
      .from(aiSdrContatoState)
      .where(eq(aiSdrContatoState.organizacaoId, orgId)),
    db.select({ total: count() })
      .from(aiSdrLogs)
      .where(and(eq(aiSdrLogs.organizacaoId, orgId), gte(aiSdrLogs.createdAt, last24h))),
  ]);

  const leadsPorStatusMap = leadsPorStatus.reduce(
    (acc, row) => ({ ...acc, [row.status]: row.n }),
    {} as Record<string, number>,
  );

  return c.json({
    agentes: [
      {
        id: "ai-sdr",
        tipo: "ai_sdr",
        nome: config?.nomeAssistente || "AI SDR",
        descricao: "Qualifica e responde leads via WhatsApp com base no funil configurado.",
        ativo: config?.ativo ?? false,
        configurado: !!config,
        modelo: config?.modelo ?? null,
        atualizadoEm: config?.updatedAt ?? null,
        leads: {
          total: leadsTotal,
          porStatus: leadsPorStatusMap,
        },
        execucoes24h,
        configHref: "/configuracoes/ai-sdr",
      },
    ],
    // Próximos agentes do catálogo ainda não existem de verdade — não
    // inventar tela/dado pra eles, só deixar visível que o catálogo cresce.
    planejados: ["recovery_agent", "collection_agent", "cs_agent"],
  });
});

export const automacoesAgentesRoutes = app;
