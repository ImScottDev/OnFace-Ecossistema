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

const EXPECTED_MESSAGE = "ONFACE_AGENT_SMOKE_TOOL_OK";

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
      systemPrompt: [
        "Você está em um teste de integração do ONFACE.",
        "Na primeira resposta, chame exatamente duas ferramentas:",
        "lead_update_status com status 'em_contato' e message_prepare com uma única mensagem.",
        `A mensagem precisa ser exatamente ${EXPECTED_MESSAGE}.`,
        "Não responda em texto fora das chamadas de ferramenta.",
      ].join(" "),
      provider: "openai",
      modelo: process.env.ONFACE_AGENT_SMOKE_MODEL || "gpt-4.1-mini",
      tools: ["lead.update_status", "message.prepare"],
      triggerConfig: { eventType: "onface.dev.agent.smoke" },
      handoffConfig: {},
      knowledgeConfig: {},
      guardrailConfig: { autonomy: "autonomous", permissoes: ["acquisition.manage"] },
      maxSteps: 2,
      tokenBudget: 256,
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

    const steps = await db.select({ kind: aiAgentRunSteps.kind, name: aiAgentRunSteps.name, status: aiAgentRunSteps.status, output: aiAgentRunSteps.output })
      .from(aiAgentRunSteps)
      .where(and(eq(aiAgentRunSteps.runId, result.runId), eq(aiAgentRunSteps.organizacaoId, organization.id)));

    const previewDaEtapa = steps.some((step) => {
      if (step.name !== "lead_update_status" || step.status !== "completed" || !step.output || typeof step.output !== "object") return false;
      const output = step.output as { data?: { preview?: unknown; operation?: unknown } };
      return output.data?.preview === true && output.data.operation === "lead.update_status";
    });

    const assertions: Array<[string, boolean]> = [
      ["run em modo test", result.status === "completed"],
      ["resposta preparada pelo agente", result.responseText === EXPECTED_MESSAGE],
      ["nenhuma mensagem enviada", result.sentMessageIds.length === 0],
      ["chamada do modelo registrada", steps.some((step) => step.kind === "model_call" && step.status === "completed")],
      ["mudança de lead passou pelo preview seguro", previewDaEtapa],
      ["mensagem passou pela ferramenta", steps.some((step) => step.kind === "tool_call" && step.name === "message_prepare" && step.status === "completed")],
      ["guardrail registrado", steps.some((step) => step.kind === "guardrail" && step.status === "completed")],
      ["nenhum egress foi criado", !steps.some((step) => step.kind === "egress")],
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
