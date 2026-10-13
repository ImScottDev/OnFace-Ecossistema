import { test } from "node:test";
import assert from "node:assert/strict";
import { classificar, type FatosDeClassificacao } from "./classificacao";

const nada: FatosDeClassificacao = {
  servicoAtivo: false, aquisicaoAberta: false, oportunidadeAberta: false, nutricao: false, desqualificado: false, perdido: false,
};
const c = (f: Partial<FatosDeClassificacao>) => classificar({ ...nada, ...f });

test("cliente com nova oportunidade continua cliente", () => {
  assert.equal(c({ servicoAtivo: true, oportunidadeAberta: true }).classe, "cliente");
});
test("lead em Pré-vendas", () => {
  const r = c({ aquisicaoAberta: true, etapaAberta: "novo" });
  assert.deepEqual([r.classe, r.estagio], ["lead", "Pré-vendas · Novo"]);
});
test("lead convertido: aquisição encerrada + oportunidade aberta é lead no Pipeline", () => {
  const r = c({ aquisicaoAberta: false, oportunidadeAberta: true });
  assert.deepEqual([r.classe, r.estagio], ["lead", "Pipeline"]);
});
test("nutrição, desqualificado e perdido são contato com motivo", () => {
  assert.deepEqual(c({ nutricao: true, motivo: "sem_orcamento" }).estagio, "Nutrição");
  assert.equal(c({ nutricao: true }).classe, "contato");
  const d = c({ desqualificado: true, motivo: "sem_fit" });
  assert.deepEqual([d.classe, d.estagio], ["contato", "Desqualificado"]);
  assert.ok(d.motivo && d.motivo !== "");
  const p = c({ perdido: true, motivo: "preco" });
  assert.deepEqual([p.classe, p.estagio], ["contato", "Perdido"]);
});
test("prospecção é prospect; descartado e desqualificado não", () => {
  assert.equal(c({ prospeccaoEstado: "em_cadencia" }).classe, "prospect");
  assert.equal(c({ prospeccaoEstado: "descartado" }).classe, "contato");
  assert.equal(c({ prospeccaoEstado: "em_cadencia", desqualificado: true }).classe, "contato");
});
test("prospect que virou lead é lead", () => {
  assert.equal(c({ prospeccaoEstado: "oportunidade", oportunidadeAberta: true }).classe, "lead");
});
test("cadastro avulso é contato sem estágio", () => {
  assert.deepEqual(c({}), { classe: "contato", motivo: null, estagio: null });
});
