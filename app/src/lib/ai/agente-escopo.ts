/**
 * Escopo do agente → prompt que o modelo recebe.
 *
 * O editor tem três listas ("Pode ajudar com", "Não deve tratar de",
 * "Transferir para humano quando") e as expressões de handoff. Sem esta
 * função elas seriam enfeite: o runtime só manda `systemPrompt` ao modelo.
 * Por isso a compilação mora aqui, client-safe, e é usada pelos DOIS lados:
 * o runtime (`execute-agent.ts`) monta a mensagem de sistema com ela e a
 * tela mostra o resultado em "Ver prompt compilado". O que a pessoa lê é
 * exatamente o que vai para o modelo.
 *
 * Onde fica guardado: `guardrail_config.escopo` (as três listas) e
 * `handoff_config.keywords` (expressões). Nenhuma coluna nova.
 */

export interface EscopoAgente {
  podeAjudar: string[];
  naoDeveTratar: string[];
  transferirQuando: string[];
}

/** Regra fixa do runtime. Antes vivia inline no execute-agent. */
export const REGRAS_DO_RUNTIME =
  "Você opera dentro do CRM Callface. Use somente as ferramentas disponibilizadas. Não invente fatos, preços, agenda ou ações executadas. Para responder ao contato, devolva texto final ou use message_prepare. Para qualquer exceção ou pedido humano, use handoff_request.";

function lista(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [];
}

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
}

export function lerEscopo(guardrailConfig: unknown): EscopoAgente {
  const e = objeto(objeto(guardrailConfig).escopo);
  return { podeAjudar: lista(e.podeAjudar), naoDeveTratar: lista(e.naoDeveTratar), transferirQuando: lista(e.transferirQuando) };
}

/** Expressões de handoff valem só com o handoff ligado (enabled !== false). */
export function lerExpressoesHandoff(handoffConfig: unknown): string[] {
  const h = objeto(handoffConfig);
  return h.enabled === false ? [] : lista(h.keywords);
}

export function compilarPrompt(version: { systemPrompt: string | null; guardrailConfig: unknown; handoffConfig: unknown }): string {
  const escopo = lerEscopo(version.guardrailConfig);
  const expressoes = lerExpressoesHandoff(version.handoffConfig);
  const partes = [(version.systemPrompt ?? "").trim()];

  if (escopo.podeAjudar.length) {
    partes.push(`Você pode ajudar com:\n${escopo.podeAjudar.map((x) => `- ${x}`).join("\n")}`);
  }
  if (escopo.naoDeveTratar.length) {
    partes.push(`Você NÃO deve tratar de (recuse com educação e ofereça uma pessoa da equipe):\n${escopo.naoDeveTratar.map((x) => `- ${x}`).join("\n")}`);
  }
  const transferir = [...escopo.transferirQuando];
  if (expressoes.length) transferir.push(`o contato usar expressões como: ${expressoes.map((x) => `"${x}"`).join(", ")}`);
  if (transferir.length) {
    partes.push(`Transfira para um humano com handoff_request quando:\n${transferir.map((x) => `- ${x}`).join("\n")}`);
  }
  partes.push(REGRAS_DO_RUNTIME);
  return partes.filter(Boolean).join("\n\n");
}
