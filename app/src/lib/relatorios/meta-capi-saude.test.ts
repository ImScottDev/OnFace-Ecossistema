import { test } from "node:test";
import assert from "node:assert/strict";
import { resumirSaudeCapi, type EntregaAgregada } from "./meta-capi-saude";
const e = (evento:string, motivo:string, entregue:boolean, quantidade:number): EntregaAgregada => ({
  evento,motivo,entregue,quantidade,atualizado_em:"2026-10-21T10:00:00Z",
});
test("sucesso CAPI usa elegíveis; orgânico e sem política são excluídos, não falhas", () => {
  const s = resumirSaudeCapi([
    e("Lead","",true,5),e("QualifiedLead","",true,3),
    e("Sem mapeamento","sem_mapeamento",false,4),
    e("Lead","sem_touchpoint_meta",false,8),
    e("Schedule","transitorio",false,2),
    e("Purchase","sem_identidade",false,1),
  ]);
  assert.equal(s.total,23);
  assert.equal(s.entregues,8);
  assert.equal(s.excluidos,12);
  assert.equal(s.bloqueados,3);
  assert.equal(s.aguardando,0);
  assert.equal(s.elegiveis,11);
  assert.equal(s.taxaEntrega,72.7);
});
test("sem evento elegível não representa 100% nem 0%", () => {
  const s=resumirSaudeCapi([e("Lead","sem_touchpoint_meta",false,5)]);
  assert.equal(s.taxaEntrega,null);
  assert.equal(s.porEvento[0].entregues,0);
});
test("não mistura falha, pendência e entregue e rejeita quantidades inválidas", () => {
  const s=resumirSaudeCapi([e("Lead","",true,2),e("Lead","",false,1),e("Lead","recusado",false,3),e("Lead","",false,-12)]);
  assert.equal(s.entregues,2);assert.equal(s.bloqueados,3);assert.equal(s.aguardando,1);assert.equal(s.total,6);
});
