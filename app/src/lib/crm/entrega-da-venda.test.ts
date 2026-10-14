import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { agruparServicosPorVenda, complementoDoUpgrade, uniaoChecklists } from "@/lib/crm/entrega-da-venda";
import { AI_CHECKLIST_BASE, PABX_CHECKLIST } from "@/lib/crm/pos-venda-checklists";

const svc = (id: string, serviceFamily: string, oportunidadeId: string | null, contratoId: string | null = null) =>
  ({ id, serviceFamily, oportunidadeId, contratoId });

test("venda com três itens gera um onboarding só", () => {
  const grupos = agruparServicosPorVenda([
    svc("s1", "CALLFACE_AI", "op1"), svc("s2", "CALLFACE_AI", "op1"), svc("s3", "CALLFACE_AI", "op1"),
  ]);
  assert.equal(grupos.length, 1);
  assert.deepEqual(grupos[0].servicoIds, ["s1", "s2", "s3"], "o primeiro é o principal; todos ficam ligados");
});

test("vendas diferentes não se misturam; família diferente na mesma venda vira uma entrega por família", () => {
  const grupos = agruparServicosPorVenda([
    svc("a", "CALLFACE_AI", "op1"), svc("b", "PABX", "op1"), svc("c", "CALLFACE_AI", "op2"),
    svc("d", "CALLFACE_AI", null, "ct1"), svc("e", "CALLFACE_AI", null, "ct1"), svc("f", "CALLFACE_AI", null, null),
  ]);
  assert.deepEqual(grupos.map((g) => g.servicoIds), [["a"], ["b"], ["c"], ["d", "e"], ["f"]]);
});

test("checklist é a união sem repetir etapa", () => {
  const uniao = uniaoChecklists([AI_CHECKLIST_BASE, AI_CHECKLIST_BASE, PABX_CHECKLIST]);
  assert.equal(uniao.length, AI_CHECKLIST_BASE.length + PABX_CHECKLIST.length);
  const chaves = uniao.map((i) => `${i.workstream}|${i.titulo}`);
  assert.equal(new Set(chaves).size, chaves.length);
  assert.deepEqual(uniaoChecklists([AI_CHECKLIST_BASE]), [...AI_CHECKLIST_BASE]);
});

test("upgrade não repete etapa já cumprida do mesmo produto", () => {
  const feitas = AI_CHECKLIST_BASE.slice(0, 5).map(({ workstream, titulo }) => ({ workstream, titulo }));
  const { pendentes, herdadas } = complementoDoUpgrade(AI_CHECKLIST_BASE, feitas);
  assert.equal(herdadas.length, 5);
  assert.equal(pendentes.length, AI_CHECKLIST_BASE.length - 5);
  for (const f of feitas) assert.ok(!pendentes.some((p) => p.workstream === f.workstream && p.titulo === f.titulo));
  // Etapa cumprida em OUTRO produto (PABX) não dispensa a do Callface AI.
  const outro = complementoDoUpgrade(AI_CHECKLIST_BASE, PABX_CHECKLIST.map(({ workstream, titulo }) => ({ workstream, titulo })));
  assert.equal(outro.pendentes.length, AI_CHECKLIST_BASE.length);
  // Tudo cumprido: nada complementar.
  assert.equal(complementoDoUpgrade(AI_CHECKLIST_BASE, AI_CHECKLIST_BASE).pendentes.length, 0);
});

/* ── Consolidação do histórico ── */
import { planejarConsolidacao, type EntregaDoHistorico } from "./entrega-da-venda";

const ent = (id: string, o: Partial<EntregaDoHistorico> = {}): EntregaDoHistorico => ({
  id, oportunidadeId: "op1", vendaAmbigua: false, jaConsolidada: false, serviceFamily: "PABX", tipo: "IMPLEMENTATION",
  cycleNumber: 1, status: "NOT_STARTED", virgem: true, progresso: 0, criadaEm: 1, servicoIds: [`s-${id}`], ...o,
});

test("consolidação: entregas virgens da mesma venda e família viram uma, que cobre todos os serviços", () => {
  const { grupos } = planejarConsolidacao([ent("a", { criadaEm: 1 }), ent("b", { criadaEm: 2 }), ent("c", { criadaEm: 3 })]);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].sobrevivente, "a");
  assert.deepEqual(grupos[0].absorvidas, ["b", "c"]);
  assert.deepEqual(grupos[0].servicoIds.sort(), ["s-a", "s-b", "s-c"]);
  assert.equal(grupos[0].gravarOportunidade, true);
});

test("consolidação: famílias diferentes da mesma venda continuam entregas separadas", () => {
  const { grupos } = planejarConsolidacao([ent("a"), ent("b", { serviceFamily: "WHITE_LABEL" })]);
  assert.equal(grupos.length, 2);
  assert.ok(grupos.every((g) => g.absorvidas.length === 0));
});

test("consolidação: nunca absorve entrega com trabalho; a que tem trabalho é quem sobrevive", () => {
  const { grupos } = planejarConsolidacao([ent("virgem", { criadaEm: 1 }), ent("andamento", { criadaEm: 2, virgem: false, status: "IN_PROGRESS", progresso: 3 })]);
  assert.equal(grupos[0].sobrevivente, "andamento");
  assert.deepEqual(grupos[0].absorvidas, ["virgem"]);
});

test("consolidação: duas entregas com trabalho na mesma venda não se juntam — uma fica, a outra vira conflito para decisão humana", () => {
  const { grupos } = planejarConsolidacao([
    ent("x", { virgem: false, status: "IN_PROGRESS", progresso: 1 }),
    ent("y", { virgem: false, status: "COMPLETED", progresso: 9 }),
  ]);
  assert.equal(grupos[0].sobrevivente, "y");
  assert.deepEqual(grupos[0].absorvidas, []);
  assert.deepEqual(grupos[0].conflitos, ["x"]);
});

test("consolidação: quem já tem a venda gravada (regra nova) é o sobrevivente e não regrava", () => {
  const { grupos } = planejarConsolidacao([ent("antiga", { criadaEm: 1 }), ent("nova", { criadaEm: 9, jaConsolidada: true })]);
  assert.equal(grupos[0].sobrevivente, "nova");
  assert.equal(grupos[0].gravarOportunidade, false);
  assert.deepEqual(grupos[0].absorvidas, ["antiga"]);
});

test("consolidação: sem venda, ou venda ambígua, ou sem tipo não é tocada; ciclos diferentes não se juntam", () => {
  const r = planejarConsolidacao([ent("s", { oportunidadeId: null }), ent("m", { vendaAmbigua: true }), ent("t", { tipo: null }), ent("c1"), ent("c2", { cycleNumber: 2 })]);
  assert.deepEqual(r.semVenda.sort(), ["s", "t"]);
  assert.deepEqual(r.ambiguas, ["m"]);
  assert.equal(r.grupos.length, 2);
});

test("consolidação é idempotente: o resultado já consolidado, replanejado, não muda nada", () => {
  const { grupos } = planejarConsolidacao([ent("a", { jaConsolidada: true, servicoIds: ["s-a", "s-b"] })]);
  assert.equal(grupos[0].gravarOportunidade, false);
  assert.deepEqual(grupos[0].absorvidas, []);
  assert.deepEqual(grupos[0].conflitos, []);
});

test("serviço de carga sem oportunidade e sem contrato não é órfão nem agrupa errado: cada um é sua própria venda", () => {
  // 445 dos 508 serviços da base (LEDGER, STRIPE, MARCO_ZERO, ZOHO) não têm venda. Sem evidência de que são a
  // mesma compra, nunca se juntam — nem entre si, nem a uma venda real da mesma família.
  const grupos = agruparServicosPorVenda([
    { id: "l1", serviceFamily: "PABX", oportunidadeId: null, contratoId: null },
    { id: "l2", serviceFamily: "PABX", oportunidadeId: null, contratoId: null },
    { id: "v1", serviceFamily: "PABX", oportunidadeId: "op1", contratoId: null },
  ]);
  assert.equal(grupos.length, 3);
  assert.deepEqual(grupos.map((g) => g.servicoIds), [["l1"], ["l2"], ["v1"]]);
  assert.equal(grupos[0].oportunidadeId, null);
});

test("sem oportunidade, o contrato é a venda: dois serviços do mesmo contrato e família viram um grupo", () => {
  const grupos = agruparServicosPorVenda([
    { id: "a", serviceFamily: "PABX", oportunidadeId: null, contratoId: "c1" },
    { id: "b", serviceFamily: "PABX", oportunidadeId: null, contratoId: "c1" },
  ]);
  assert.equal(grupos.length, 1);
  assert.deepEqual(grupos[0].servicoIds, ["a", "b"]);
});

test("o upgrade de serviço sem venda enxerga as entregas antigas, que também não têm venda", () => {
  // Trava de fonte: `NULL IS DISTINCT FROM NULL` é falso e descartava justamente as entregas legadas.
  const fonte = fs.readFileSync(path.join(process.cwd(), "src/lib/crm/fulfillment.ts"), "utf8");
  assert.match(fonte, /::uuid IS NULL OR f\.oportunidade_id IS DISTINCT FROM/);
  assert.match(fonte, /ORDER BY \(op\.service_family = s\.service_family\) DESC NULLS LAST, oi\.created_at, oi\.id LIMIT 1/);
});

test("os backfills de histórico são dry-run por padrão, preservam o relógio e filtram por organização", () => {
  for (const nome of ["backfill-consolidar-entregas.ts", "backfill-valor-negocios.ts"]) {
    const fonte = fs.readFileSync(path.join(process.cwd(), "src/scripts", nome), "utf8");
    assert.match(fonte, /process\.argv\.includes\("--aplicar"\)/, `${nome}: só grava com --aplicar`);
    assert.match(fonte, /updated_at = updated_at/, `${nome}: preserva updated_at`);
    assert.match(fonte, /organizacao_id = \$\{/, `${nome}: UPDATE com organizacao_id explícito`);
  }
});
