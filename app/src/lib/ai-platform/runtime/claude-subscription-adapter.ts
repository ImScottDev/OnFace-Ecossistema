import { createSdkMcpServer, query, tool, type SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { ModelTool } from "./provider-gateway";

const CLIENT_APP = "onface-nexo-dev-poc/1.0";

export type ClaudeSubscriptionResult = {
  text: string;
  durationMs: number;
  turns: number;
};

export type ClaudeSubscriptionToolCall = {
  name: string;
  input: Record<string, unknown>;
  result: { ok: boolean; data?: unknown; error?: string; handoff?: boolean };
};

export type ClaudeSubscriptionAgentResult = ClaudeSubscriptionResult & {
  tokensInput: number;
  tokensOutput: number;
  estimatedCostUsd: number;
  toolCalls: ClaudeSubscriptionToolCall[];
};

type RunAgentInput = {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  tools: ModelTool[];
  maxTurns: number;
  invokeTool: (name: string, input: Record<string, unknown>) => Promise<ClaudeSubscriptionToolCall["result"]>;
};

/**
 * Adapter experimental para o runtime do Claude Code/Agent SDK autenticado
 * pela assinatura do Super Admin. Ele nao e um cliente da Anthropic API.
 */
export class ClaudeSubscriptionAdapter {
  constructor(private readonly environment: Record<string, string | undefined> = process.env) {}

  private token(): string {
    const token = this.environment.CLAUDE_CODE_OAUTH_TOKEN?.trim();
    if (!token) throw new Error("CLAUDE_CODE_OAUTH_TOKEN não configurado para o provider Claude Subscription.");
    if (this.environment.ANTHROPIC_API_KEY || this.environment.ANTHROPIC_AUTH_TOKEN) {
      throw new Error("Claude Subscription não aceita ANTHROPIC_API_KEY nem ANTHROPIC_AUTH_TOKEN; remova a credencial de API deste runtime.");
    }
    return token;
  }

  private childEnvironment(token: string): Record<string, string | undefined> {
    const {
      ANTHROPIC_API_KEY: _apiKey,
      ANTHROPIC_AUTH_TOKEN: _authToken,
      ...inherited
    } = this.environment;
    return {
      ...inherited,
      CLAUDE_CODE_OAUTH_TOKEN: token,
      CLAUDE_AGENT_SDK_CLIENT_APP: CLIENT_APP,
    };
  }

  async runTextOnly(prompt: string): Promise<ClaudeSubscriptionResult> {
    const result = await this.runQuery(prompt, {
      // O POC nao pode tocar em arquivos, shell ou qualquer ferramenta.
      tools: [],
      permissionMode: "dontAsk",
      permissionPrompts: "none",
      maxTurns: 1,
    });

    return { text: result.result.trim(), durationMs: result.duration_ms, turns: result.num_turns };
  }

  /**
   * Executa o Agent SDK com uma ponte interna de ferramentas. A ponte nao abre
   * porta, nao le configuracao MCP externa e nao concede os built-ins do Claude
   * Code; ela so encaminha para o registry do ONFACE recebido pelo chamador.
   */
  async runAgent(request: RunAgentInput): Promise<ClaudeSubscriptionAgentResult> {
    const callableNames = request.tools.map((item) => item.name);
    const toolCalls: ClaudeSubscriptionToolCall[] = [];
    const catalog = request.tools.map((item) => ({ name: item.name, description: item.description, parameters: item.parameters }));

    const bridge = callableNames.length
      ? createSdkMcpServer({
        name: "onface_runtime",
        version: "1.0.0",
        alwaysLoad: true,
        tools: [tool(
          "call_crm_tool",
          `Executa uma ferramenta permitida do ONFACE. Escolha tool_name somente deste catalogo e envie input conforme o schema. Catalogo: ${JSON.stringify(catalog)}`,
          {
            tool_name: z.enum(callableNames as [string, ...string[]]),
            input: z.record(z.string(), z.unknown()),
          },
          async ({ tool_name, input: toolInput }) => {
            const result = await request.invokeTool(tool_name, toolInput);
            toolCalls.push({ name: tool_name, input: toolInput, result });
            return {
              content: [{ type: "text", text: JSON.stringify(result) }],
              structuredContent: result,
              isError: !result.ok,
            };
          },
          { annotations: { openWorldHint: false } },
        )],
      })
      : null;

    const result = await this.runQuery(request.userPrompt, {
      systemPrompt: request.systemPrompt,
      model: request.model,
      tools: [],
      permissionMode: "dontAsk",
      permissionPrompts: "none",
      maxTurns: Math.max(1, request.maxTurns),
      settingSources: [],
      strictMcpConfig: true,
      ...(bridge ? {
        mcpServers: { onface_runtime: bridge },
        allowedTools: ["mcp__onface_runtime__call_crm_tool"],
      } : {}),
    });

    const modelUsage = Object.values(result.modelUsage);
    return {
      text: result.result.trim(),
      durationMs: result.duration_ms,
      turns: result.num_turns,
      tokensInput: modelUsage.reduce((total, usage) => total + usage.inputTokens + usage.cacheReadInputTokens + usage.cacheCreationInputTokens, 0),
      tokensOutput: modelUsage.reduce((total, usage) => total + usage.outputTokens, 0),
      // Estimativa operacional do SDK, nunca uma fatura Anthropic API.
      estimatedCostUsd: result.total_cost_usd,
      toolCalls,
    };
  }

  private async runQuery(prompt: string, options: Parameters<typeof query>[0]["options"]): Promise<Extract<SDKResultMessage, { subtype: "success" }>> {
    const token = this.token();
    let result: SDKResultMessage | undefined;
    const session = query({
      prompt,
      options: {
        ...options,
        persistSession: false,
        env: this.childEnvironment(token),
      },
    });

    for await (const message of session) {
      if (message.type === "result") result = message;
    }

    if (!result) throw new Error("Claude Agent SDK terminou sem resultado.");
    if (result.subtype !== "success" || result.is_error) {
      const details = "errors" in result ? result.errors.join("; ") : result.result;
      throw new Error(`Claude Subscription falhou: ${details || result.subtype}`);
    }
    return result;
  }
}
