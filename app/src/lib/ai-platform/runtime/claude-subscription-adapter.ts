import { query, type SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";

const CLIENT_APP = "onface-nexo-dev-poc/1.0";

export type ClaudeSubscriptionResult = {
  text: string;
  durationMs: number;
  turns: number;
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
    const token = this.token();
    let result: SDKResultMessage | undefined;
    const session = query({
      prompt,
      options: {
        // O POC nao pode tocar em arquivos, shell, MCP ou qualquer ferramenta.
        tools: [],
        permissionMode: "dontAsk",
        permissionPrompts: "none",
        maxTurns: 1,
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
    return { text: result.result.trim(), durationMs: result.duration_ms, turns: result.num_turns };
  }
}
