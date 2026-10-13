import { test } from "node:test";
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
