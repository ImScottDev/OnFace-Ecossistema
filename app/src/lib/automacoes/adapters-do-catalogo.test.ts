/**
 * Trava: todo passo que o editor oferece tem adapter no motor único.
 *
 * Os dois editores (Cadências e Fluxos) montam o passo e o motor procura o
 * adapter pelo nome, em runtime. Um nome que não existe não quebra nada ao
 * salvar nem ao publicar: quebra na hora de executar, num passo que já era
 * para ter saído — "adapter não registrado" dentro de uma execução de cliente.
 *
 * Nenhum adapter é chamado aqui: o teste só confere o registro, que é o que
 * `executarAcaoAvulsa` consulta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { adaptersRegistrados } from "@/lib/cadencia/cadence-engine";
import { compileFollowupGraph } from "@/lib/ai-platform/followup/compile";
import type { FollowupGraph, FollowupNode } from "@/lib/ai-platform/followup/graph";
import { CATALOGO_NOS, TIPOS_NO, type TipoNo } from "./grafo";
import { ADAPTER } from "./executor";
// Registram os adapters novos (fluxo_*, agente_*) no mesmo registro do motor.
import "./adapters-fluxo";
import "./adapters-agente";

type ModoAcao = Extract<FollowupNode, { type: "action" }>["config"]["mode"];

/** O tipo é a trava: modo novo no grafo da cadência não compila sem entrar aqui. */
const CONFIG_POR_MODO: Record<ModoAcao, Record<string, unknown>> = {
  ai_message: { mode: "ai_message", prompt_hint: "oi" },
  template: { mode: "template", template_id: "00000000-0000-0000-0000-000000000001" },
  whatsapp: { mode: "whatsapp", message: "oi" },
  create_task: { mode: "create_task", title: "t", priority: "media", due_minutes: 60 },
  add_tag: { mode: "add_tag", label_id: "00000000-0000-0000-0000-000000000001" },
  remove_tag: { mode: "remove_tag", label_id: "00000000-0000-0000-0000-000000000001" },
  update_stage: { mode: "update_stage", stage: "proposta" },
  assign_owner: { mode: "assign_owner", owner_id: "00000000-0000-0000-0000-000000000001" },
  add_note: { mode: "add_note", title: "n" },
  email: { mode: "email", subject: "s", message: "m" },
  callface_call: { mode: "callface_call" },
};

test("cadência: todo modo de ação do editor compila para um adapter registrado", () => {
  const registrados = new Set(adaptersRegistrados());
  for (const [modo, config] of Object.entries(CONFIG_POR_MODO)) {
    const grafo = {
      version: 1,
      nodes: [
        { id: "trigger", type: "trigger", label: "Início", position: { x: 0, y: 0 }, config: { event: "manual", filters: {} } },
        { id: "a1", type: "action", label: modo, position: { x: 0, y: 100 }, config },
      ],
      edges: [{ id: "e1", source: "trigger", target: "a1", condition: null }],
    } as unknown as FollowupGraph;
    const [passo] = compileFollowupGraph(grafo);
    assert.ok(passo.adapter, `modo ${modo} compilou sem adapter`);
    assert.ok(registrados.has(passo.adapter!), `modo ${modo} pede o adapter "${passo.adapter}", que não está registrado`);
  }
  assert.ok(registrados.has("ai_classify"), "o bloco de classificação da cadência roda pelo adapter ai_classify");
});

test("fluxo: todo bloco de ação, integração e IA do catálogo tem adapter registrado", () => {
  const registrados = new Set(adaptersRegistrados());
  // Dois blocos não passam pelo mapa de adapters de propósito: a etapa vai pela
  // porta de domínio do pipeline e o WhatsApp escolhe texto ou modelo na hora.
  const PROPRIOS: TipoNo[] = ["mover_etapa", "enviar_whatsapp"];
  const semAdapter: string[] = [];
  for (const tipo of TIPOS_NO) {
    const meta = CATALOGO_NOS[tipo];
    if (meta.categoria === "gatilho" || meta.categoria === "logica" || PROPRIOS.includes(tipo)) continue;
    const nome = ADAPTER[tipo];
    if (!nome || !registrados.has(nome)) semAdapter.push(`${tipo} → ${nome ?? "(sem mapa)"}`);
  }
  assert.deepEqual(semAdapter, [], "bloco do catálogo sem adapter no motor");
  for (const tipo of PROPRIOS) assert.ok(CATALOGO_NOS[tipo], `${tipo} saiu do catálogo: revise a lista de exceções`);
  assert.ok(registrados.has("whatsapp") && registrados.has("whatsapp_template"), "os dois modos do bloco de WhatsApp");
  assert.ok(registrados.has("crm_update_stage"), "etapa fora do pipeline (lead, empresa) ainda usa o adapter");
});
