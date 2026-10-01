import { ClaudeSubscriptionAdapter } from "@/lib/ai-platform/runtime/claude-subscription-adapter";

const result = await new ClaudeSubscriptionAdapter().runAgent({
  model: process.env.CLAUDE_SUBSCRIPTION_SMOKE_MODEL || "claude-sonnet-4-6",
  systemPrompt: "Você está executando um teste controlado do runtime ONFACE. Não use nenhuma ação fora da ferramenta disponibilizada.",
  userPrompt: "Chame echo_once com value igual a ONFACE_TOOL_OK. Depois responda somente ONFACE_TOOL_OK.",
  tools: [{
    name: "echo_once",
    description: "Retorna exatamente o value recebido. Use uma única vez para validar a ponte de ferramentas.",
    parameters: {
      type: "object",
      properties: { value: { type: "string" } },
      required: ["value"],
      additionalProperties: false,
    },
  }],
  maxTurns: 3,
  invokeTool: async (name, input) => name === "echo_once" && input.value === "ONFACE_TOOL_OK"
    ? { ok: true, data: { value: input.value } }
    : { ok: false, error: "ferramenta ou argumento inesperado" },
});

if (result.text !== "ONFACE_TOOL_OK") throw new Error(`Resposta inesperada: ${result.text}`);
if (result.toolCalls.length !== 1 || result.toolCalls[0]?.name !== "echo_once" || !result.toolCalls[0].result.ok) {
  throw new Error("A ponte de ferramentas Claude Subscription não executou echo_once corretamente.");
}

console.log("Claude Subscription tool bridge: ONFACE_TOOL_OK");
