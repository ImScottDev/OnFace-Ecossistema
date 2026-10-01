import assert from "node:assert/strict";
import test from "node:test";
import { ClaudeSubscriptionAdapter } from "./claude-subscription-adapter";

test("Claude Subscription falha fechado sem token OAuth", () => {
  const adapter = new ClaudeSubscriptionAdapter({ PATH: process.env.PATH });
  assert.rejects(() => adapter.runTextOnly("Responda somente ONFACE_OK"), /CLAUDE_CODE_OAUTH_TOKEN/);
});

test("Claude Subscription rejeita credenciais da Anthropic API", () => {
  const adapter = new ClaudeSubscriptionAdapter({
    PATH: process.env.PATH,
    CLAUDE_CODE_OAUTH_TOKEN: "poc-token",
    ANTHROPIC_API_KEY: "must-not-be-used",
  });
  assert.rejects(() => adapter.runTextOnly("Responda somente ONFACE_OK"), /não aceita ANTHROPIC_API_KEY/);
});
