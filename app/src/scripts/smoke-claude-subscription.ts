import { ClaudeSubscriptionAdapter } from "@/lib/ai-platform/runtime/claude-subscription-adapter";

async function main() {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error("POC bloqueada: remova ANTHROPIC_API_KEY e ANTHROPIC_AUTH_TOKEN do ambiente antes de testar Claude Subscription.");
  }

  const adapter = new ClaudeSubscriptionAdapter();
  const result = await adapter.runTextOnly("Responda somente ONFACE_OK");
  if (result.text !== "ONFACE_OK") {
    throw new Error(`POC retornou resposta inesperada: ${JSON.stringify(result.text)}`);
  }
  console.log("Claude Subscription POC: ONFACE_OK");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
