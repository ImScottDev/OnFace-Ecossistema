/**
 * Prova uma chamada real do runtime de agentes sem tocar em contatos,
 * WhatsApp, automacoes ou configuracao publicada. O agente e os rastros do
 * proprio smoke sao removidos ao final, inclusive quando o provider falha.
 *
 * Requer uma credencial valida em OPENAI_API_KEY e pode escolher o modelo com
 * ONFACE_AGENT_SMOKE_MODEL. Nunca execute contra producao.
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiAgentRuns, aiAgentRunSteps, aiAgentVersions, aiAgents, organizacoes } from "@/lib/db/schema";
import { executeAgent } from "@/lib/ai-platform/runtime/execute-agent";

const EXPECTED = "ONFACE_AGENT_SMOKE_OK";

async function main() {
  const [organization] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
  if (!organization) throw new Error("Organizacao DEV nao encontrada");

  const suffix = randomUUID().slice(0, 8);
  let agentId: string | null = null;

  try {
    const [agent] = await db.insert(aiAgents).values({
      organizacaoId: organization.id,
      nome: "Smoke runtime IA DEV",
      slug: `smoke-runtime-ia-${suffix}`,
      descricao: "Agente temporario para validar provider e guardrails do runtime DEV.",
      finalidade: "smoke",
      prioridade: 0,
      status: "draft",
    }).returning({ id: aiAgents.id });
    agentId = agent.id;

    const [version] = await db.insert(aiAgentVersions).values({
      organizacaoId: organization.id,
      agentId,
      versao: 1,
      status: "draft",
      systemPrompt: `Responda exatamente ${EXPECTED}, sem pontuacao adicional.`,
      provider: "openai",
      modelo: process.env.ONFACE_AGENT_SMOKE_MODEL || "gpt-4.1-mini",
      tools: [],
      triggerConfig: { eventType: "onface.dev.agent.smoke" },
      handoffConfig: {},
      knowledgeConfig: {},
      guardrailConfig: { autonomy: "suggest" },
      maxSteps: 1,
      tokenBudget: 64,
      historyMessageWindow: 1,
      historyTokenWindow: 500,
      casesEnabled: false,
    }).returning({ id: aiAgentVersions.id });

    const result = await executeAgent({
      organizacaoId: organization.id,
      agentId,
      versionId: version.id,
      eventType: "onface.dev.agent.smoke",
      message: "Execute o smoke agora.",
      mode: "test",
      suppressEgress: true,
    });

    const steps = await db.select({ kind: aiAgentRunSteps.kind, status: aiAgentRunSteps.status })
      .from(aiAgentRunSteps)
      .where(and(eq(aiAgentRunSteps.runId, result.runId), eq(aiAgentRunSteps.organizacaoId, organization.id)));

    const assertions: Array<[string, boolean]> = [
      ["run em modo test", result.status === "completed"],
      ["resposta do provider", result.responseText === EXPECTED],
      ["nenhuma mensagem enviada", result.sentMessageIds.length === 0],
      ["chamada do modelo registrada", steps.some((step) => step.kind === "model_call" && step.status === "completed")],
      ["guardrail registrado", steps.some((step) => step.kind === "guardrail" && step.status === "completed")],
    ];
    for (const [label, passed] of assertions) console.log(`${passed ? "ok" : "FALHOU"} ${label}`);
    if (assertions.some(([, passed]) => !passed)) throw new Error("Smoke do runtime de IA falhou");

    console.log(JSON.stringify({ runId: result.runId, tokensInput: result.tokensInput, tokensOutput: result.tokensOutput }));
  } finally {
    if (agentId) {
      await db.delete(aiAgentRuns).where(and(eq(aiAgentRuns.agentId, agentId), eq(aiAgentRuns.organizacaoId, organization.id)));
      await db.delete(aiAgents).where(and(eq(aiAgents.id, agentId), eq(aiAgents.organizacaoId, organization.id)));
      console.log("limpeza concluida");
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
