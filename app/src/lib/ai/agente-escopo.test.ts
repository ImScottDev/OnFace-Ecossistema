import { test } from "node:test";
import assert from "node:assert/strict";
import { compilarPrompt, lerEscopo, REGRAS_DO_RUNTIME } from "./agente-escopo";

test("sem escopo, o prompt é o mesmo de antes: instruções + regras do runtime", () => {
  assert.equal(compilarPrompt({ systemPrompt: "Seja breve.", guardrailConfig: {}, handoffConfig: {} }), `Seja breve.\n\n${REGRAS_DO_RUNTIME}`);
});

test("listas do escopo e expressões de handoff entram no prompt", () => {
  const p = compilarPrompt({
    systemPrompt: "Base",
    guardrailConfig: { autonomy: "suggest", escopo: { podeAjudar: ["planos"], naoDeveTratar: ["jurídico", " "], transferirQuando: ["pedir desconto"] } },
    handoffConfig: { enabled: true, keywords: ["atendente"] },
  });
  assert.match(p, /pode ajudar com:\n- planos/);
  assert.match(p, /NÃO deve tratar de.*\n- jurídico$/m);
  assert.match(p, /handoff_request quando:\n- pedir desconto\n- o contato usar expressões como: "atendente"/);
  assert.ok(p.endsWith(REGRAS_DO_RUNTIME));
});

test("handoff desligado não manda expressões; lixo no jsonb não quebra", () => {
  assert.doesNotMatch(compilarPrompt({ systemPrompt: "x", guardrailConfig: null, handoffConfig: { enabled: false, keywords: ["humano"] } }), /"humano"/);
  assert.deepEqual(lerEscopo({ escopo: { podeAjudar: "não é lista" } }), { podeAjudar: [], naoDeveTratar: [], transferirQuando: [] });
});

test("nome legado de ferramenta (NEXO/Hermes) vira o id que o runtime resolve", async () => {
  const { normalizarIdFerramenta } = await import("./agent-studio");
  assert.equal(normalizarIdFerramenta("context_read_crm"), "context.read_crm");
  assert.equal(normalizarIdFerramenta("lead_update_status"), "lead.update_status");
  assert.equal(normalizarIdFerramenta("knowledge.search"), "knowledge.search");
  assert.equal(normalizarIdFerramenta("nao_existe"), "nao_existe");
});
