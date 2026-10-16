/* A lista de passos tem de sair e voltar do MESMO grafo que o motor lê. Se
 * este arquivo falhar, a tela está escrevendo um formato que o servidor não
 * compila — ou lendo errado o que já está publicado.
 *
 *   pnpm exec tsx --test "src/components/onface/automacoes/cadencias/*.test.ts"
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { followupGraphSchema } from "@/lib/ai-platform/followup/graph";
import { compileFollowupGraph } from "@/lib/ai-platform/followup/compile";
import { validateFollowupForPublish } from "@/lib/ai-platform/followup/validate";
import { grafoParaPassos, passosParaGrafo, pendenciasDosPassos, previaTexto, textoEspera, type Passo } from "./passos";

const SESSAO = "11111111-1111-4111-8111-111111111111";
const TAG = "22222222-2222-4222-8222-222222222222";

const LINEAR: Passo[] = [
  { id: "p1", tipo: "mensagem", esperaMin: 0, canal: "whatsapp", mensagem: "Oi {{primeiro_nome}}, tudo bem?", sessaoId: SESSAO },
  { id: "p2", tipo: "mensagem", esperaMin: 1440, canal: "email", assunto: "Sobre a proposta", mensagem: "Olá {{nome}}" },
  { id: "p3", tipo: "mensagem", esperaMin: 2880, canal: "ligacao" },
  { id: "p4", tipo: "tarefa", esperaMin: 60, titulo: "Ligar de novo", prioridade: "alta", prazoMin: 120 },
  { id: "p5", tipo: "crm", esperaMin: 0, acao: "tag_add", tagId: TAG },
];

test("lista linear vira grafo válido, publicável e compilável", () => {
  const grafo = passosParaGrafo(LINEAR);
  const parsed = followupGraphSchema.safeParse(grafo);
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues?.slice(0, 3)));
  assert.deepEqual(validateFollowupForPublish(grafo), { ok: true, errors: [] });

  const steps = compileFollowupGraph(grafo);
  assert.equal(steps.find((s) => s.id === "p1")?.adapter, "whatsapp");
  assert.deepEqual(steps.find((s) => s.id === "p1")?.config, { mensagem: "Oi {{primeiro_nome}}, tudo bem?", sessao_id: SESSAO });
  assert.equal(steps.find((s) => s.id === "p2")?.adapter, "email");
  assert.equal(steps.find((s) => s.id === "p3")?.adapter, "crm_callface_call");
  assert.equal(steps.find((s) => s.id === "p4")?.adapter, "crm_create_task");
  assert.equal(steps.find((s) => s.id === "p5")?.adapter, "crm_add_tag");
  // A espera de 1 dia antes do e-mail virou step de espera, não sumiu.
  assert.equal(steps.find((s) => s.id === "p2__espera")?.esperaMinutos, 1440);
});

test("grafo volta a ser a mesma lista", () => {
  const { passos, naoLinear, evento } = grafoParaPassos(passosParaGrafo(LINEAR, "lead.criado"));
  assert.equal(naoLinear, false);
  assert.equal(evento, "lead.criado");
  assert.deepEqual(passos.map((p) => [p.id, p.tipo, p.esperaMin]), LINEAR.map((p) => [p.id, p.tipo, p.esperaMin]));
  assert.deepEqual(passos[0], LINEAR[0]);
  assert.equal(passos[1].tipo === "mensagem" && passos[1].canal, "email");
});

test("condição segue a lista no Sim e encerra no Não", () => {
  const passos: Passo[] = [
    { id: "c1", tipo: "condicao", esperaMin: 0, combinador: "and", regras: [{ campo: "status", op: "eq", valor: "aberto" }] },
    { id: "m1", tipo: "mensagem", esperaMin: 1440, canal: "whatsapp", mensagem: "Segue" },
  ];
  const grafo = passosParaGrafo(passos);
  assert.equal(followupGraphSchema.safeParse(grafo).success, true);
  assert.deepEqual(validateFollowupForPublish(grafo), { ok: true, errors: [] });
  const sim = grafo.edges.find((e) => e.source === "c1" && e.condition.type === "cond_result" && e.condition.value);
  assert.equal(sim?.target, "m1__espera");
  assert.equal(grafo.edges.find((e) => e.source === "c1" && e.condition.type === "cond_result" && !e.condition.value)?.target, "end");
  const volta = grafoParaPassos(grafo);
  assert.equal(volta.naoLinear, false);
  assert.deepEqual(volta.passos.map((p) => p.id), ["c1", "m1"]);
});

test("classificação: a classe escolhida segue, as outras e o silêncio encerram", () => {
  const passos: Passo[] = [
    { id: "k1", tipo: "classificar", esperaMin: 0, classes: [{ id: "sim", rotulo: "Quer" }, { id: "nao", rotulo: "Não quer" }], segueEm: "sim", graceMin: 60 },
    { id: "m1", tipo: "mensagem", esperaMin: 0, canal: "whatsapp", mensagem: "Combinado" },
  ];
  const grafo = passosParaGrafo(passos);
  assert.equal(followupGraphSchema.safeParse(grafo).success, true);
  assert.deepEqual(validateFollowupForPublish(grafo), { ok: true, errors: [] });
  assert.equal(grafo.edges.find((e) => e.id === "k1__c-sim")?.target, "m1");
  assert.equal(grafo.edges.find((e) => e.id === "k1__c-nao")?.target, "end");
  const volta = grafoParaPassos(grafo);
  assert.equal(volta.naoLinear, false);
  assert.equal(volta.passos[0].tipo === "classificar" && volta.passos[0].segueEm, "sim");
});

test("grafo que ramifica para outro passo é recusado, não achatado", () => {
  const grafo = passosParaGrafo(LINEAR);
  grafo.edges.push({ id: "extra", source: "p1", target: "p4", priority: 5, condition: { type: "always" } });
  assert.equal(grafoParaPassos(grafo).naoLinear, true);
});

test("espera de segundos persiste na versão compilada e volta ao editor sem arredondar para minuto", () => {
  const grafo = passosParaGrafo([{ id: "p1", tipo: "mensagem", esperaMin: 10 / 60, canal: "whatsapp", mensagem: "Já" }]);
  const wait = grafo.nodes.find((n) => n.type === "wait");
  assert.ok(wait && wait.type === "wait" && wait.config.mode === "fixed");
  if (wait.type !== "wait" || wait.config.mode !== "fixed") return;
  assert.equal(wait.config.duration_ms, 10_000);
  assert.equal(followupGraphSchema.safeParse(grafo).success, true);
  const compiled = compileFollowupGraph(grafo);
  assert.equal(compiled.find((step) => step.tipo === "wait")?.esperaMilissegundos, 10_000);
  assert.equal(grafoParaPassos(grafo).passos[0].esperaMin, 10 / 60);
  assert.equal(textoEspera(10 / 60), "10 segundos depois");
  const semEspera = passosParaGrafo([{ id: "p2", tipo: "mensagem", esperaMin: 0, canal: "whatsapp", mensagem: "Já" }]);
  assert.equal(semEspera.nodes.some((n) => n.type === "wait"), false);
});

/* Recorte real de "Reativação de lead frio" (produção, 15/10): o fim se chama
 * "fim", não "end", e a espera vem DEPOIS da mensagem, não antes. Quem lê o
 * grafo tem de enxergar isso como "manda, espera 1 dia, manda" — foi
 * exatamente onde a primeira versão desta leitura errou. */
const PRODUCAO = followupGraphSchema.parse({
  schema_version: 2,
  nodes: [
    { id: "trigger", type: "trigger", label: "Início", position: { x: 0, y: 0 }, config: { event: "manual", filters: {} } },
    { id: "d0-wa", type: "action", label: "Mensagem com IA", position: { x: 0, y: 1 }, config: { mode: "ai_message", prompt_hint: "Retome o contato." } },
    { id: "w1", type: "wait", label: "Aguardar", position: { x: 0, y: 2 }, config: { mode: "fixed", duration_ms: 86_400_000 } },
    { id: "d3-email", type: "action", label: "E-mail", position: { x: 0, y: 3 }, config: { mode: "email", subject: "Oi", message: "Olá" } },
    { id: "fim", type: "end", label: "Fim", position: { x: 0, y: 4 }, config: { outcome: "exhausted" } },
  ],
  edges: [
    { id: "e0", source: "trigger", target: "d0-wa", priority: 0, condition: { type: "always" } },
    { id: "e1", source: "d0-wa", target: "w1", priority: 0, condition: { type: "always" } },
    { id: "e2", source: "w1", target: "d3-email", priority: 0, condition: { type: "always" } },
    { id: "e3", source: "d3-email", target: "fim", priority: 0, condition: { type: "always" } },
  ],
});

test("cadência publicada em produção é lida sem perder nada", () => {
  const { passos, naoLinear } = grafoParaPassos(PRODUCAO);
  assert.equal(naoLinear, false);
  assert.deepEqual(passos.map((p) => [p.id, p.esperaMin]), [["d0-wa", 0], ["d3-email", 1440]]);
  assert.equal(passos[0].tipo === "mensagem" && passos[0].canal, "whatsapp_ia");
  // Salvar de volta tem de dar a MESMA sequência de steps para o motor.
  const antes = compileFollowupGraph(PRODUCAO).map((s) => `${s.adapter ?? s.tipo}:${s.esperaMinutos ?? ""}`);
  const depois = compileFollowupGraph(passosParaGrafo(passos)).map((s) => `${s.adapter ?? s.tipo}:${s.esperaMinutos ?? ""}`);
  assert.deepEqual(depois, antes);
});

test("pendências apontam o passo incompleto", () => {
  const falhas = pendenciasDosPassos([
    { id: "p1", tipo: "mensagem", esperaMin: 0, canal: "whatsapp", mensagem: "   " },
    { id: "p2", tipo: "crm", esperaMin: 0, acao: "tag_add" },
  ]);
  assert.deepEqual(falhas.map((f) => f.passoId), ["p1", "p2"]);
  assert.deepEqual(pendenciasDosPassos(LINEAR), []);
});

test("prévia usa {{chave}} e deixa chave desconhecida literal", () => {
  assert.equal(previaTexto("Oi {{ primeiro_nome }}, da {{empresa}}?"), "Oi Ana, da Padaria do Bairro?");
  assert.equal(previaTexto("Oi {nome}, cargo {{cargo}}"), "Oi {nome}, cargo {{cargo}}");
});

test("texto da espera fala como gente", () => {
  assert.equal(textoEspera(0), "Na sequência");
  assert.equal(textoEspera(1440), "1 dia depois");
  assert.equal(textoEspera(2880), "2 dias depois");
  assert.equal(textoEspera(120), "2 horas depois");
  assert.equal(textoEspera(90), "90 min depois");
});
