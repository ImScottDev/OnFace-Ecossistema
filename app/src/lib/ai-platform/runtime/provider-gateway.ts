export type AiProvider = "groq" | "openai" | "anthropic" | "google" | "claude_subscription";

export type AgentMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolCalls?: ModelToolCall[];
};

export type ModelTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ModelToolCall = { id: string; name: string; input: Record<string, unknown> };
export type ModelCallResult = { text: string | null; toolCalls: ModelToolCall[]; tokensInput: number; tokensOutput: number; rawFinishReason?: string };

export type ModelCallInput = {
  provider: AiProvider;
  model: string;
  apiKey: string;
  baseUrl?: string | null;
  messages: AgentMessage[];
  tools: ModelTool[];
  maxTokens: number;
  temperature?: number;
};

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function parseOpenAiResponse(data: unknown): ModelCallResult {
  const payload = data as { choices?: Array<{ finish_reason?: string; message?: { content?: string | null; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const choice = payload.choices?.[0];
  return {
    text: choice?.message?.content?.trim() || null,
    toolCalls: (choice?.message?.tool_calls ?? []).flatMap((call, index) => call.function?.name ? [{ id: call.id ?? `tool-${index}`, name: call.function.name, input: parseJsonObject(call.function.arguments) }] : []),
    tokensInput: payload.usage?.prompt_tokens ?? 0,
    tokensOutput: payload.usage?.completion_tokens ?? 0,
    rawFinishReason: choice?.finish_reason,
  };
}

export function parseAnthropicResponse(data: unknown): ModelCallResult {
  const payload = data as { content?: Array<{ type?: string; text?: string; id?: string; name?: string; input?: unknown }>; usage?: { input_tokens?: number; output_tokens?: number }; stop_reason?: string };
  const content = payload.content ?? [];
  return {
    text: content.filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n").trim() || null,
    toolCalls: content.flatMap((block, index) => block.type === "tool_use" && block.name ? [{ id: block.id ?? `tool-${index}`, name: block.name, input: parseJsonObject(block.input) }] : []),
    tokensInput: payload.usage?.input_tokens ?? 0,
    tokensOutput: payload.usage?.output_tokens ?? 0,
    rawFinishReason: payload.stop_reason,
  };
}

export function parseGoogleResponse(data: unknown): ModelCallResult {
  const payload = data as { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; functionCall?: { name?: string; args?: unknown } }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
  const candidate = payload.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  return {
    text: parts.map((part) => part.text ?? "").join("\n").trim() || null,
    toolCalls: parts.flatMap((part, index) => part.functionCall?.name ? [{ id: `google-tool-${index}`, name: part.functionCall.name, input: parseJsonObject(part.functionCall.args) }] : []),
    tokensInput: payload.usageMetadata?.promptTokenCount ?? 0,
    tokensOutput: payload.usageMetadata?.candidatesTokenCount ?? 0,
    rawFinishReason: candidate?.finishReason,
  };
}

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}: ${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { throw new Error("Provider devolveu resposta não JSON"); }
}

async function callOpenAiCompatible(input: ModelCallInput): Promise<ModelCallResult> {
  const defaultBase = input.provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1";
  const base = (input.baseUrl || defaultBase).replace(/\/$/, "");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${input.apiKey}` },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages.map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
        ...(message.toolCalls?.length ? { tool_calls: message.toolCalls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.input) } })) } : {}),
      })),
      tools: input.tools.length ? input.tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } })) : undefined,
      tool_choice: input.tools.length ? "auto" : undefined,
      // OpenAI recusa `max_tokens` nos modelos atuais (400 medido na credencial do banco); Groq ainda usa o nome antigo.
      ...(input.provider === "openai" ? { max_completion_tokens: input.maxTokens } : { max_tokens: input.maxTokens }),
      temperature: input.temperature ?? 0.3,
    }),
  });
  return parseOpenAiResponse(await readResponse(response));
}

async function callAnthropic(input: ModelCallInput): Promise<ModelCallResult> {
  const system = input.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const messages = input.messages.filter((message) => message.role !== "system").map((message) => {
    if (message.role === "tool") return { role: "user", content: [{ type: "tool_result", tool_use_id: message.toolCallId, content: message.content }] };
    if (message.role === "assistant" && message.toolCalls?.length) return { role: "assistant", content: [
      ...(message.content ? [{ type: "text", text: message.content }] : []),
      ...message.toolCalls.map((call) => ({ type: "tool_use", id: call.id, name: call.name, input: call.input })),
    ] };
    return { role: message.role === "assistant" ? "assistant" : "user", content: message.content };
  });
  const response = await fetch(`${(input.baseUrl || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": input.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: input.model, system, messages, max_tokens: input.maxTokens, temperature: input.temperature ?? 0.3, ...(input.tools.length ? { tools: input.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })) } : {}) }),
  });
  return parseAnthropicResponse(await readResponse(response));
}

async function callGoogle(input: ModelCallInput): Promise<ModelCallResult> {
  const system = input.messages.filter((message) => message.role === "system").map((message) => ({ text: message.content }));
  const contents = input.messages.filter((message) => message.role !== "system").map((message) => {
    if (message.role === "tool") return { role: "user", parts: [{ functionResponse: { name: message.toolName, response: parseJsonObject(message.content) } }] };
    if (message.role === "assistant" && message.toolCalls?.length) return { role: "model", parts: [
      ...(message.content ? [{ text: message.content }] : []),
      ...message.toolCalls.map((call) => ({ functionCall: { name: call.name, args: call.input } })),
    ] };
    return { role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] };
  });
  const base = (input.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  const response = await fetch(`${base}/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: system.length ? { parts: system } : undefined,
      contents,
      tools: input.tools.length ? [{ functionDeclarations: input.tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })) }] : undefined,
      generationConfig: { maxOutputTokens: input.maxTokens, temperature: input.temperature ?? 0.3 },
    }),
  });
  return parseGoogleResponse(await readResponse(response));
}

export async function runModelCall(input: ModelCallInput): Promise<ModelCallResult> {
  if (input.provider === "claude_subscription") {
    throw new Error("Claude Subscription deve ser executado pelo ClaudeSubscriptionAdapter, não pelo gateway HTTP.");
  }
  if (input.provider === "anthropic") return callAnthropic(input);
  if (input.provider === "google") return callGoogle(input);
  return callOpenAiCompatible(input);
}
