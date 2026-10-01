import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiAgentRunSteps, aiAgents, aiAgentVersions } from "@/lib/db/schema";
import { executeAgent } from "@/lib/ai-platform/runtime/execute-agent";

if (process.env.CONFIRM_ONFACE_NEXO_CLAUDE_SMOKE !== "SIM") {
  throw new Error("Defina CONFIRM_ONFACE_NEXO_CLAUDE_SMOKE=SIM para executar o smoke do NEXO.");
}

const [selected] = await db.select({ agent: aiAgents, version: aiAgentVersions })
  .from(aiAgents)
  .innerJoin(aiAgentVersions, eq(aiAgentVersions.agentId, aiAgents.id))
  .where(eq(aiAgents.slug, "nexo"))
  .limit(1);

if (!selected) throw new Error("NEXO não encontrado no ambiente.");
if (selected.version.provider !== "claude_subscription") {
  throw new Error(`NEXO não está configurado para Claude Subscription: ${selected.version.provider ?? "vazio"}`);
}

const result = await executeAgent({
  organizacaoId: selected.agent.organizacaoId,
  agentId: selected.agent.id,
  versionId: selected.version.id,
  eventType: "onface.claude_subscription.smoke",
  message: "Este é um teste técnico interno. Chame context_read_crm uma única vez e depois responda somente ONFACE_NEXO_TOOL_OK.",
  mode: "test",
  suppressEgress: true,
});

const steps = await db.select({ name: aiAgentRunSteps.name, status: aiAgentRunSteps.status })
  .from(aiAgentRunSteps)
  .where(and(eq(aiAgentRunSteps.runId, result.runId), eq(aiAgentRunSteps.kind, "tool_call")));

if (result.status !== "completed" || result.responseText !== "ONFACE_NEXO_TOOL_OK") {
  throw new Error(`Resultado inesperado do NEXO: status=${result.status} resposta=${result.responseText ?? "vazia"}`);
}
if (!steps.some((step) => step.name === "context_read_crm" && step.status === "completed")) {
  throw new Error("NEXO não executou context_read_crm pelo registry do ONFACE.");
}
if (result.sentMessageIds.length) throw new Error("Smoke não pode gerar egress.");

console.log("NEXO Claude Subscription runtime: ONFACE_NEXO_TOOL_OK");
