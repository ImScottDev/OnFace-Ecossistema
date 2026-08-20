// Automações → Cadências (19/08) — visão real das cadências configuráveis
// (`cadence_definitions`/`cadence_enrollments`, motor genérico em
// lib/cadencia/cadence-engine.ts). Achado real (investigação 19/08): esse
// motor hoje só tem 1 consumidor real (Prospecção outbound) — existem 2
// outros mecanismos de "sequência no tempo" ainda não unificados a ele
// (cadência SDR inbound sobre `cadencia_execucoes`, e o retry do AI SDR
// hardcoded no worker). Não escondido, reportado explicitamente na
// resposta pra não passar a falsa impressão de que já é 1 motor só.
import { Hono } from "hono";
import { db } from "@/lib/db";
import { cadenceDefinitions, cadenceEnrollments } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCtx } from "../compat.js";

const app = new Hono();

app.get("/automacoes/cadencias", async (c) => {
  const ctx = await getCtx(c);

  const definicoes = await db.select().from(cadenceDefinitions).where(eq(cadenceDefinitions.organizacaoId, ctx.organizacaoId));

  const contagens = await db.execute<{ cadence_definition_id: string; status: string; n: number }>(sql`
    SELECT cadence_definition_id, status, COUNT(*)::int AS n
    FROM cadence_enrollments
    WHERE organizacao_id = ${ctx.organizacaoId}
    GROUP BY 1, 2
  `);

  const [legadoInbound] = await db.execute<{ n: number }>(sql`SELECT COUNT(*)::int AS n FROM cadencia_execucoes WHERE organizacao_id = ${ctx.organizacaoId}`);

  return c.json({
    cadencias: definicoes.map((d) => ({
      ...d,
      totalPassos: Array.isArray(d.steps) ? d.steps.length : 0,
      enrollmentsPorStatus: contagens.filter((ct) => ct.cadence_definition_id === d.id).reduce((acc, ct) => ({ ...acc, [ct.status]: ct.n }), {} as Record<string, number>),
    })),
    // Mecanismos paralelos ainda não unificados a este motor — visibilidade
    // honesta, não é bug escondido, é achado de arquitetura real.
    mecanismosParalelos: {
      cadenciaSdrInboundExecucoes: legadoInbound?.n ?? 0,
      aiSdrRetrySweep: "hardcoded no worker (runAiSdrRetrySweep), não passa por cadence_definitions",
    },
  });
});

export const automacoesCadenciasRoutes = app;
