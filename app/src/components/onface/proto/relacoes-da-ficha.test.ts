import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { aquisicaoDaFicha, corrigirVazio, montarRelacoes, paraALiga, type FatosDasRelacoes } from "./relacoes-da-ficha";

const E = "3714f498-de84-47ae-9366-ae671eeab1f5";
const L = "135dc5f9-a317-4f2b-bc80-6b690b55703d";
const O1 = "f1896da5-ae42-49ab-8f9a-cec69c54fced";
const O2 = "a1896da5-ae42-49ab-8f9a-cec69c54fced";
const ganho = { id: O1, titulo: "PABX", etapa: "ganho", etapaRotulo: "Ganho", familia: "pabx" };
const aberta = { id: O2, titulo: "Callpilot", etapa: "proposta", etapaRotulo: "Proposta", familia: null };
const lead = { id: L, etapa: "em_contato", etapaRotulo: "Em contato", titulo: "Lead em Pré-vendas", sub: "Meta" };
const base: FatosDasRelacoes = {
  empresaId: E, leadId: L, aquisicoes: [], oportunidades: [], propostas: [], vazioPrefixo: "Nenhuma aquisição. Por enquanto só existe na base.",
  conta: { nome: "Tio Pedro", ativo: false, jaTeveServico: false, ficha: false },
};
const com = (o: Partial<FatosDasRelacoes>, c: Partial<FatosDasRelacoes["conta"]> = {}) =>
  montarRelacoes({ ...base, ...o, conta: { ...base.conta, ...c } });

describe("relações da ficha", () => {
  it("lead em Pré-vendas aparece como Aquisição e abre o destino que existe hoje", () => {
    const r = com({ aquisicoes: [lead] });
    assert.equal(r.vazio, false);
    assert.equal(r.itens[0].k, "aquisicao");
    assert.equal(r.itens[0].tipo, "Pré-vendas");
    assert.equal(r.itens[0].status, "Em contato");
    assert.equal(r.itens[0].href, `/pre-vendas/${L}`);
  });

  it("desqualificado não é em andamento, mas também não é ausência", () => {
    const r = com({ aquisicoes: [{ ...lead, etapa: "desqualificado", etapaRotulo: "Desqualificado" }] });
    assert.equal(r.itens.length, 0);
    assert.equal(r.vazio, false);
    assert.doesNotMatch(r.vazioTxt, /só existe na base/);
  });

  it("vazio só quando todas as fontes vieram vazias", () => {
    const v = com({});
    assert.equal(v.vazio, true);
    assert.match(v.vazioTxt, /só existe na base/);
    assert.equal(com({ aquisicoes: [lead] }).vazio, false);
    assert.equal(com({ oportunidades: [aberta] }).vazio, false);
    assert.equal(com({ propostas: [{ id: O1, numero: 1, versao: 1, status: "enviada" }] }).vazio, false);
    assert.equal(com({}, { jaTeveServico: true }).vazio, false);
    assert.equal(com({ oportunidades: [{ ...aberta, etapa: "perdido" }] }).vazio, false);
  });

  it("antes de hidratar a Liga não afirma vazio", () => {
    const rel: any = { vazio: true, vazioTxt: "x" };
    corrigirVazio(rel, com({}), false);
    assert.equal(rel.vazio, false);
    corrigirVazio(rel, com({}), true);
    assert.equal(rel.vazio, true);
  });

  it("ganho sem serviço ativo não vira Cliente ativo", () => {
    const r = com({ oportunidades: [ganho] });
    assert.equal(r.itens.some((i) => i.status === "Cliente ativo" || i.k === "cliente"), false);
    assert.equal(r.itens[0].status, "Ganho, sem serviço ativo");
    assert.equal(r.itens[0].href, `/pipeline/${O1}`);
  });

  it("Cliente ativo só com serviço ativo, e leva ao 360", () => {
    const r = com({ oportunidades: [ganho] }, { ativo: true, jaTeveServico: true, ficha: true });
    const c = r.itens.find((i) => i.k === "cliente")!;
    assert.equal(c.status, "Cliente ativo");
    assert.equal(c.href, `/clientes/${E}`);
    assert.equal(r.itens.find((i) => i.k === "opp")!.status, "Ganho");
  });

  it("ex-cliente: histórico no 360, sem rótulo de ativo", () => {
    const c = com({}, { jaTeveServico: true, ficha: true }).itens[0];
    assert.equal(c.status, "Ex-cliente");
    assert.equal(c.tom, "cinza");
  });

  it("sem ficha de Cliente 360 não oferece o link", () => {
    const r = com({}, { ativo: true, ficha: false });
    assert.equal(r.itens.some((i) => i.k === "cliente"), false);
    assert.equal(r.vazio, false);
  });

  it("empresa: aquisição de outro contato não vaza para a pessoa", () => {
    const outra = { ...lead, id: O2 };
    assert.deepEqual(com({ aquisicoes: [lead, outra] }).itens.map((i) => i.id), [L]);
    assert.deepEqual(com({ leadId: null, aquisicoes: [lead, outra] }).itens.map((i) => i.id), [L, O2]);
  });

  it("paraALiga entrega ir() e rótulo de ação", () => {
    const vis: string[] = [];
    const l = paraALiga(com({ aquisicoes: [lead] }, { ativo: true, ficha: true }), (r) => vis.push(r));
    l.itens.forEach((i: any) => i.ir());
    assert.deepEqual(vis, [`/clientes/${E}`, `/pre-vendas/${L}`]);
  });

  it("a PESSOA vê TODAS as aquisições dela, em qualquer etapa em andamento", () => {
    const duplicada = { ...lead, id: O2, etapa: "qualificacao", etapaRotulo: "Qualificação" };
    const nutri = { ...lead, id: "c1896da5-ae42-49ab-8f9a-cec69c54fced", etapa: "nutricao", etapaRotulo: "Nutrição" };
    const r = com({ leadId: null, aquisicoes: [lead, duplicada, nutri, { ...lead, id: "d1896da5-ae42-49ab-8f9a-cec69c54fced", etapa: "desqualificado", etapaRotulo: "Desqualificado" }] });
    assert.deepEqual(r.itens.map((i) => i.id), [L, O2, "c1896da5-ae42-49ab-8f9a-cec69c54fced"], "desqualificada é história, não andamento");
    assert.equal(r.vazio, false);
    assert.ok(r.itens.every((i) => i.href === `/pre-vendas/${i.id}`));
  });

  it("nutrição é relação em andamento, com tom próprio", () => {
    const r = com({ aquisicoes: [{ ...lead, etapa: "nutricao", etapaRotulo: "Nutrição" }] });
    assert.equal(r.itens[0].status, "Nutrição");
    assert.equal(r.itens[0].tom, "azul");
  });
});

describe("linha da aquisição", () => {
  const base = { id: L, etapa: "em_contato", etapaRotulo: "Em contato", origem: "Meta Ads", criadoEm: "2026-05-17T14:00:00Z", responsavel: "Ana" };

  it("nutrição mostra o MOTIVO, QUANDO entrou e a retomada", () => {
    const a = aquisicaoDaFicha({ ...base, etapa: "nutricao", etapaRotulo: "Nutrição", nutricao: { motivo: "sem_orcamento", desde: "2026-10-07T12:00:00Z", retomarEm: "2026-11-15" } });
    assert.equal(a.titulo, "Em nutrição: Sem orçamento agora");
    assert.equal(a.sub, "desde 07/10/2026 · retomar em 15/11/2026 · Meta Ads");
  });

  it("nutrição de carga antiga não inventa data nem motivo", () => {
    const a = aquisicaoDaFicha({ ...base, etapa: "nutricao", etapaRotulo: "Nutrição", nutricao: { motivo: "em_nutricao", desde: null, retomarEm: null } });
    assert.equal(a.titulo, "Em nutrição: motivo não registrado");
    assert.match(a.sub, /entrada sem data registrada/);
    assert.match(a.sub, /sem data de retomada/);
  });

  it("as demais mostram quando entraram (é o que separa duas aquisições da mesma pessoa)", () => {
    const a = aquisicaoDaFicha(base);
    assert.equal(a.titulo, "Lead em Pré-vendas");
    assert.equal(a.sub, "Meta Ads · Ana · entrou em 17/05/2026");
    assert.equal(aquisicaoDaFicha({ ...base, pessoa: "Bia Lima", origem: null, responsavel: null, criadoEm: null }).titulo, "Lead de Bia Lima");
    assert.equal(aquisicaoDaFicha({ ...base, origem: null, responsavel: null, criadoEm: null }).sub, "Origem não informada");
  });
});
