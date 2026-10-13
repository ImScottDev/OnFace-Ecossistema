import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparPorCnpj, elegerCanonica, type PesoEmpresa } from "./vinculo-canonica";
import { decidirVinculos, cnpjNormalizado, type AlvoEmpresa } from "./vinculo-regra";
import type { OrganizacaoCallfaceAi } from "@onface/integrations-callface-ai";

const peso = (p: Partial<PesoEmpresa> = {}): PesoEmpresa => ({ servicosAi: 1, assinaturas: 0, oportunidades: 0, pessoas: 0, ...p });
const m = (empresaId: string, p?: Partial<PesoEmpresa>) => ({ empresaId, nome: `Emp ${empresaId}`, peso: peso(p) });

test("canônica: a que domina em assinaturas e não perde em nada", () => {
  const e = elegerCanonica([m("a", { assinaturas: 2, oportunidades: 1, pessoas: 3 }), m("b", { assinaturas: 0, pessoas: 1 })]);
  assert.equal(e.tipo, "canonica");
  if (e.tipo === "canonica") { assert.equal(e.canonicaId, "a"); assert.deepEqual(e.duplicadas, ["b"]); assert.match(e.criterio, /assinaturas/); }
});

test("empate total não elege (nada de desempate por idade ou ordem)", () => {
  const e = elegerCanonica([m("a", { assinaturas: 1 }), m("b", { assinaturas: 1 })]);
  assert.equal(e.tipo, "indecisa");
  if (e.tipo === "indecisa") assert.match(e.motivo, /nenhuma é claramente a principal/);
});

test("incomparáveis (uma tem assinatura, a outra oportunidade) não elege", () => {
  assert.equal(elegerCanonica([m("a", { assinaturas: 2 }), m("b", { oportunidades: 3 })]).tipo, "indecisa");
});

test("pessoas sozinhas não decidem", () => {
  assert.equal(elegerCanonica([m("a", { pessoas: 9 }), m("b", { pessoas: 0 })]).tipo, "indecisa");
});

test("três empresas: elege só se uma domina as duas outras", () => {
  const ok = elegerCanonica([m("a", { assinaturas: 3 }), m("b", { assinaturas: 1 }), m("c")]);
  assert.equal(ok.tipo === "canonica" && ok.canonicaId, "a");
  assert.equal(elegerCanonica([m("a", { assinaturas: 3 }), m("b", { assinaturas: 3 }), m("c")]).tipo, "indecisa");
});

test("sem peso informado = zeros = indecisa", () => {
  assert.equal(elegerCanonica([{ empresaId: "a", nome: "A" }, { empresaId: "b", nome: "B" }]).tipo, "indecisa");
});

test("agrupa só por CNPJ de 14 dígitos; CPF e vazio não formam grupo", () => {
  const g = agruparPorCnpj([
    { cnpj: "12.345.678/0001-90" }, { cnpj: "12345678000190" }, { cnpj: "123.456.789-09" }, { cnpj: "12345678909" }, { cnpj: null }, { cnpj: null },
  ], cnpjNormalizado);
  assert.deepEqual([...g.keys()], ["12345678000190"]);
});

// --- integração com a regra de vínculo ---
const org = (id: string, p: Partial<OrganizacaoCallfaceAi> = {}): OrganizacaoCallfaceAi => ({
  id, nome: `Org ${id}`, documentNumber: null, email: null, stripeCustomerId: null, desativadaEm: null, donos: [], ...p,
});
const emp = (empresaId: string, p: Partial<AlvoEmpresa> = {}): AlvoEmpresa => ({
  empresaId, nome: `Empresa ${empresaId}`, razaoSocial: null, cnpj: null, website: null, stripeIds: [], emails: [], ...p,
});
const CNPJ = "12.345.678/0001-90";
const rodar = (a: AlvoEmpresa[], o: OrganizacaoCallfaceAi[], ligadas = new Map<string, string>(), lig = new Map<string, { nome: string; cnpj: string | null }>()) =>
  decidirVinculos(a, o, ligadas, new Set(), new Date(), lig);

test("duplicata com canônica clara: a canônica liga com evidência; a duplicada fica pendente com motivo", () => {
  const r = rodar(
    [emp("e1", { cnpj: CNPJ, stripeIds: ["cus_1"], peso: peso({ assinaturas: 2 }) }), emp("e2", { cnpj: "12345678000190", stripeIds: ["cus_1"], peso: peso() })],
    [org("o1", { documentNumber: "12345678000190", stripeCustomerId: "cus_1" })],
  );
  const auto = r.filter((d) => d.tipo === "auto");
  assert.equal(auto.length, 1);
  const a = auto[0];
  if (a.tipo === "auto") {
    assert.equal(a.empresaId, "e1");
    assert.equal(a.evidencia.canonica?.duplicadas[0], "e2");
    assert.match(a.evidencia.regra, /canonica/);
  }
  const dup = r.find((d) => d.empresaId === "e2");
  assert.equal(dup?.tipo, "pendente");
  if (dup?.tipo === "pendente") { assert.equal(dup.sinal, "duplicada"); assert.match(dup.razao, /Empresa duplicada/); assert.match(dup.razao, /Empresa e1/); }
});

test("duplicata sem canônica: NINGUÉM liga e as duas ficam pendentes com a razão", () => {
  const r = rodar([emp("e1", { cnpj: CNPJ, peso: peso({ assinaturas: 1 }) }), emp("e2", { cnpj: CNPJ, peso: peso({ assinaturas: 1 }) })],
    [org("o1", { documentNumber: "12345678000190" })]);
  assert.ok(r.every((d) => d.tipo === "pendente" && d.sinal === "duplicada_indecisa"));
  assert.equal(r.length, 2);
});

test("duplicata de empresa que JÁ está vinculada: pendente 'duplicada', não 'disputada'", () => {
  const [d] = rodar([emp("e1", { cnpj: CNPJ })], [org("o1", { documentNumber: "12345678000190" })],
    new Map([["o1", "e9"]]), new Map([["e9", { nome: "Matriz", cnpj: "12345678000190" }]]));
  assert.equal(d.tipo, "pendente");
  if (d.tipo === "pendente") { assert.equal(d.sinal, "duplicada"); assert.match(d.razao, /Matriz/); }
});

test("organização já vinculada a empresa de OUTRO CNPJ continua 'disputada'", () => {
  const [d] = rodar([emp("e1", { cnpj: CNPJ })], [org("o1", { documentNumber: "12345678000190" })],
    new Map([["o1", "e9"]]), new Map([["e9", { nome: "Outra", cnpj: "99999999000199" }]]));
  assert.equal(d.tipo === "pendente" && d.sinal, "disputada");
});

test("CNPJ repetido em duas organizações do SaaS: pendente explícito 'ambigua', sem ligar", () => {
  const r = rodar([emp("e1", { cnpj: CNPJ })], [org("o1", { documentNumber: "12345678000190" }), org("o2", { documentNumber: "12345678000190" })]);
  assert.equal(r.length, 2);
  assert.ok(r.every((d) => d.tipo === "pendente" && d.sinal === "ambigua" && /2 organização/.test(d.razao)));
});

test("duplicata não atrapalha empresa de outro CNPJ", () => {
  const r = rodar(
    [emp("e1", { cnpj: CNPJ, peso: peso({ assinaturas: 1 }) }), emp("e2", { cnpj: CNPJ }), emp("e3", { cnpj: "11.222.333/0001-81" })],
    [org("o1", { documentNumber: "12345678000190" }), org("o3", { documentNumber: "11222333000181" })],
  );
  assert.deepEqual(r.filter((d) => d.tipo === "auto").map((d) => d.empresaId).sort(), ["e1", "e3"]);
});
