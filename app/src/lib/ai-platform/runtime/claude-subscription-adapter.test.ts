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

test("catálogo compacto não perde parâmetro, obrigatoriedade nem valor de enum, e é menor que o JSON", async () => {
  const { modelToolsForIds } = await import("../tools/registry");
  const { NEXO_TOOL_IDS } = await import("@/lib/nexo/ferramentas");
  const { compactarCatalogo } = await import("./claude-subscription-adapter");
  const tools = modelToolsForIds(NEXO_TOOL_IDS);
  const texto = compactarCatalogo(tools);
  const json = JSON.stringify(tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })));
  assert.ok(texto.length < json.length * 0.8, `compacto ${texto.length} vs json ${json.length}`);
  for (const t of tools) {
    assert.ok(texto.includes(`${t.name} — ${t.description}`), `${t.name}: descrição`);
    const ini = texto.indexOf(`${t.name} — `);
    const prox = texto.indexOf("\nnexo_", ini + 1);
    const bloco = texto.slice(ini, prox === -1 ? undefined : prox);
    const sch = t.parameters as { properties?: Record<string, { enum?: string[] }>; required?: string[] };
    for (const [nome, p] of Object.entries(sch.properties ?? {})) {
      const obrig = (sch.required ?? []).includes(nome) ? "*" : "";
      assert.ok(bloco.includes(`\n  ${nome}${obrig} `), `${t.name}.${nome}${obrig}`);
      for (const v of p.enum ?? []) assert.ok(bloco.includes(String(v)), `${t.name}.${nome}: enum ${v}`);
    }
  }
});
