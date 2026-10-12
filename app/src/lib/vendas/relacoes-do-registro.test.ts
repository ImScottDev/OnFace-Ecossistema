import { test } from "node:test";
import assert from "node:assert/strict";
import { relacoesDoRegistro, type VinculoDoRegistro } from "./relacoes-do-registro";

const empresa = "3714f498-de84-47ae-9366-ae671eeab1f5";
const lead = "135dc5f9-a317-4f2b-bc80-6b690b55703d";
const outro = "f1896da5-ae42-49ab-8f9a-cec69c54fced";
const base = { empresaId: empresa, pessoaId: null, leadId: lead, titulo: "Conta", sub: "", status: "Novo" };

test("aquisição abre qualificação, não a ficha da pessoa", () => {
  const r = relacoesDoRegistro([{ ...base, id: lead, k: "aquisicao" }], { empresaId: empresa, leadId: lead });
  assert.equal(r.length, 1);
  assert.equal(r[0].href, `/pre-vendas?lead=${lead}`);
  assert.equal(r[0].tipo, "Pré-vendas");
});

test("cliente e oportunidade coexistem com destinos distintos", () => {
  const r = relacoesDoRegistro([
    { ...base, id: empresa, k: "cliente", status: "Cliente ativo" },
    { ...base, id: outro, k: "opp", status: "Negociação" },
  ], { empresaId: empresa, leadId: lead });
  assert.deepEqual(r.map(x => x.href), [`/clientes/${empresa}`, `/pipeline/${outro}`]);
  assert.equal(r[0].titulo, "Abrir Cliente 360");
  assert.equal(r[1].tipo, "Oportunidade");
});

test("contato não herda aquisição de outra pessoa da mesma conta", () => {
  const r = relacoesDoRegistro([
    { ...base, id: lead, k: "aquisicao" },
    { ...base, id: outro, leadId: outro, k: "aquisicao" },
    { ...base, id: empresa, leadId: null, k: "cliente" },
  ], { empresaId: empresa, leadId: lead });
  assert.deepEqual(r.map(x => x.href), [`/pre-vendas?lead=${lead}`, `/clientes/${empresa}`]);
});

test("empresas homônimas não misturam relações", () => {
  const r = relacoesDoRegistro([
    { ...base, id: lead, k: "aquisicao" },
    { ...base, empresaId: outro, id: outro, k: "aquisicao" },
  ], { empresaId: empresa });
  assert.deepEqual(r.map(x => x.href), [`/pre-vendas?lead=${lead}`]);
});

test("pessoa canônica sem lead usa seu próprio vínculo", () => {
  const r = relacoesDoRegistro([
    { ...base, pessoaId: outro, id: lead, k: "aquisicao" },
    { ...base, pessoaId: lead, id: outro, k: "aquisicao" },
  ], { empresaId: empresa, pessoaId: outro });
  assert.deepEqual(r.map(x => x.href), [`/pre-vendas?lead=${lead}`]);
});

test("vínculo inválido não produz URL para outra entidade", () => {
  const rows: VinculoDoRegistro[] = [{ ...base, id: "undefined", k: "opp" }];
  assert.deepEqual(relacoesDoRegistro(rows, { empresaId: empresa }), []);
});
