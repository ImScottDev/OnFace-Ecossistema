import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirVinculos, similaridadeDeNome, type AlvoEmpresa } from "./vinculo-regra";
import type { OrganizacaoCallfaceAi } from "@onface/integrations-callface-ai";

const org = (id: string, p: Partial<OrganizacaoCallfaceAi> = {}): OrganizacaoCallfaceAi => ({
  id, nome: `Org ${id}`, documentNumber: null, email: null, stripeCustomerId: null, desativadaEm: null, donos: [], ...p,
});
const emp = (empresaId: string, p: Partial<AlvoEmpresa> = {}): AlvoEmpresa => ({
  empresaId, nome: `Empresa ${empresaId}`, razaoSocial: null, cnpj: null, website: null, stripeIds: [], emails: [], ...p,
});
const rodar = (a: AlvoEmpresa[], o: OrganizacaoCallfaceAi[], ligadas = new Map<string, string>()) =>
  decidirVinculos(a, o, ligadas, new Set());

test("CNPJ igual (formatado) liga sozinho e guarda a evidência normalizada", () => {
  const [d] = rodar([emp("e1", { cnpj: "12.345.678/0001-90" })], [org("o1", { documentNumber: "12345678000190" })]);
  assert.equal(d.tipo, "auto");
  if (d.tipo === "auto") {
    assert.equal(d.evidencia.sinais[0].valor, "12345678000190");
    assert.equal(d.evidencia.origem, "auto");
  }
});

test("Stripe customer e e-mail do dono ligam; CPF (11 dígitos) não vira CNPJ", () => {
  const r = rodar(
    [emp("e1", { stripeIds: ["cus_1"] }), emp("e2", { emails: ["Dono@Acme.com"] }), emp("e3", { cnpj: "123.456.789-09" })],
    [org("o1", { stripeCustomerId: "cus_1" }), org("o2", { donos: ["dono@acme.com"] }), org("o3", { documentNumber: "12345678909" })],
  );
  assert.deepEqual(Object.fromEntries(r.map((d) => [d.empresaId, d.tipo])), { e1: "auto", e2: "auto", e3: "sem_sugestao" });
});

test("sinais que apontam para organizações diferentes NÃO ligam", () => {
  const r = rodar([emp("e1", { cnpj: "12345678000190", stripeIds: ["cus_1"] })],
    [org("o1", { documentNumber: "12345678000190" }), org("o2", { stripeCustomerId: "cus_1" })]);
  assert.ok(r.every((d) => d.tipo === "pendente" && d.sinal === "contradicao"));
  assert.equal(r.length, 2);
});

test("mesmo CNPJ em duas organizações ou em duas empresas não liga (1:1)", () => {
  const dupOrg = rodar([emp("e1", { cnpj: "12345678000190" })],
    [org("o1", { documentNumber: "12345678000190" }), org("o2", { documentNumber: "12345678000190" })]);
  assert.ok(dupOrg.every((d) => d.tipo !== "auto"));
  const dupEmp = rodar([emp("e1", { cnpj: "12345678000190" }), emp("e2", { cnpj: "12345678000190" })],
    [org("o1", { documentNumber: "12345678000190" })]);
  assert.ok(dupEmp.every((d) => d.tipo !== "auto"));
});

test("organização já vinculada a outra empresa vira disputa", () => {
  const [d] = rodar([emp("e1", { cnpj: "12345678000190" })], [org("o1", { documentNumber: "12345678000190" })], new Map([["o1", "e9"]]));
  assert.equal(d.tipo, "pendente");
  assert.equal(d.tipo === "pendente" && d.sinal, "disputada");
});

test("duas empresas do lote chegando à mesma organização: nenhuma liga", () => {
  const r = rodar([emp("e1", { stripeIds: ["cus_1"] }), emp("e2", { emails: ["a@x.com"] })],
    [org("o1", { stripeCustomerId: "cus_1", donos: ["a@x.com"] })]);
  assert.ok(r.every((d) => d.tipo === "pendente" && d.sinal === "disputada"));
});

test("NOME sozinho nunca liga: só sugere como pendente, com razão", () => {
  const [d] = rodar([emp("e1", { nome: "Brasal Veículos Ltda" })], [org("o1", { nome: "BRASAL VEICULOS" })]);
  assert.equal(d.tipo, "pendente");
  if (d.tipo === "pendente") assert.match(d.razao, /confirme por uma pessoa/);
});

test("nome sem semelhança nem sinal: sem sugestão; rejeitado não volta", () => {
  assert.equal(rodar([emp("e1", { nome: "Alfa" })], [org("o1", { nome: "Zeta Corp" })])[0].tipo, "sem_sugestao");
  const r = decidirVinculos([emp("e1", { nome: "Brasal Veículos" })], [org("o1", { nome: "Brasal Veiculos" })], new Map(), new Set(["e1|o1"]));
  assert.equal(r[0].tipo, "sem_sugestao");
});

test("similaridade ignora acento e sufixo societário", () => {
  assert.equal(similaridadeDeNome("Padaria Pão Quente LTDA", "padaria pao quente"), 1);
});

test("par que uma pessoa removeu/rejeitou não é religado pelo sync", () => {
  const r = decidirVinculos([emp("e1", { cnpj: "12345678000190" })], [org("o1", { documentNumber: "12345678000190" })], new Map(), new Set(["e1|o1"]));
  assert.equal(r[0].tipo, "sem_sugestao");
});
