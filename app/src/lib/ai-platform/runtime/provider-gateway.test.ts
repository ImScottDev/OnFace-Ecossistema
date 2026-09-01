import assert from "node:assert/strict";
import test from "node:test";
import { parseAnthropicResponse, parseGoogleResponse, parseOpenAiResponse } from "./provider-gateway";

test("normaliza tool call OpenAI/Groq", () => {
  const result = parseOpenAiResponse({ choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id: "1", function: { name: "handoff_request", arguments: '{"motivo":"pedido"}' } }] } }], usage: { prompt_tokens: 12, completion_tokens: 3 } });
  assert.deepEqual(result.toolCalls[0], { id: "1", name: "handoff_request", input: { motivo: "pedido" } });
  assert.equal(result.tokensInput, 12);
});

test("normaliza blocos Anthropic", () => {
  const result = parseAnthropicResponse({ content: [{ type: "text", text: "Oi" }, { type: "tool_use", id: "2", name: "context_read_contact", input: { include: "lead" } }], usage: { input_tokens: 9, output_tokens: 4 } });
  assert.equal(result.text, "Oi");
  assert.equal(result.toolCalls[0]?.name, "context_read_contact");
});

test("normaliza functionCall Google", () => {
  const result = parseGoogleResponse({ candidates: [{ finishReason: "STOP", content: { parts: [{ functionCall: { name: "task_create", args: { titulo: "Retornar" } } }] } }], usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 2 } });
  assert.deepEqual(result.toolCalls[0]?.input, { titulo: "Retornar" });
  assert.equal(result.tokensOutput, 2);
});
