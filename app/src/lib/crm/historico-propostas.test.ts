/**
 * De-para do histórico comercial: o que decide se o histórico fica certo ou errado.
 * Puro, sem banco. Rodar: `node --import tsx --test src/lib/crm/historico-propostas.test.ts` (da pasta app/).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { decidirFamiliaDaProposta, decidirVinculo, evidenciasDoGanho, type ItemEntrada } from "./historico-propostas";

let seq = 0;
const item = (nome: string, subtotal = 100, extra: Partial<ItemEntrada> = {}): ItemEntrada =>
  ({ id: `i${++seq}`, nome, subtotal, familiaDoItem: null, familiaDoCatalogo: null, ...extra });

test("o catálogo oficial vale mais que o nome, e família que o item já tem nunca é regravada", () => {
  const p = decidirFamiliaDaProposta([
    item("LINHA SIP", 100, { familiaDoCatalogo: "CALLFACE_AI" }), // catálogo diz outra coisa que o nome
    item("LINHA SIP", 100, { familiaDoItem: "WHITE_LABEL" }),
  ]);
  assert.equal(p.itens[0].familia, "CALLFACE_AI");
  assert.equal(p.itens[0].fonte, "catalogo_oficial");
  assert.equal(p.itens[0].gravar, true);
  assert.equal(p.itens[1].familia, "WHITE_LABEL");
  assert.equal(p.itens[1].fonte, "item");
  assert.equal(p.itens[1].gravar, false, "o que já tinha família não entra no plano de escrita");
});

test("UNKNOWN no catálogo ou no item não vale como resposta", () => {
  const [i] = decidirFamiliaDaProposta([item("LINHA SIP", 100, { familiaDoItem: "UNKNOWN", familiaDoCatalogo: "UNKNOWN" })]).itens;
  assert.equal(i.familia, "PABX");
  assert.equal(i.fonte, "planilha_oficial");
});

test("nome declarado na planilha oficial é CONFIRMED; termo no nome é só PROBABLE", () => {
  const [oficial, porNome] = decidirFamiliaDaProposta([item("LINHA SIP"), item("CALLFACE AI - COLD CALLING")]).itens;
  assert.deepEqual([oficial.familia, oficial.confianca, oficial.fonte], ["PABX", "CONFIRMED", "planilha_oficial"]);
  assert.deepEqual([porNome.familia, porNome.confianca, porNome.fonte], ["CALLFACE_AI", "PROBABLE", "regra_nome"]);
});

test("White Label ganha de Callface AI quando o nome tem os dois", () => {
  const [i] = decidirFamiliaDaProposta([item("WHITE LABEL - CALLFACE AI")]).itens;
  assert.equal(i.familia, "WHITE_LABEL");
});

test("ajuste financeiro não tem família e não pesa na da proposta", () => {
  const p = decidirFamiliaDaProposta([item("LINHA SIP", 500), item("DESCONTO EXECUTIVO - MENSAL", -50)]);
  assert.equal(p.itens[1].ajuste, true);
  assert.equal(p.itens[1].familia, null);
  assert.equal(p.itens[1].gravar, false);
  assert.equal(p.familia, "PABX");
  assert.equal(p.resultado, "unica");
});

test("genérico herda a família da proposta quando os demais itens são de uma só família", () => {
  const p = decidirFamiliaDaProposta([item("LINHA SIP"), item("SETUP", 50)]);
  const setup = p.itens[1];
  assert.deepEqual([setup.familia, setup.fonte, setup.confianca, setup.gravar], ["PABX", "contexto_da_proposta", "PROBABLE", true]);
  assert.equal(p.familia, "PABX");
  assert.equal(p.confianca, "PROBABLE", "a proposta só é CONFIRMED se todo item com família for");
});

test("proposta de mais de uma família é MISTA: nenhuma família é gravada nela e o genérico fica sem", () => {
  const p = decidirFamiliaDaProposta([item("LINHA SIP"), item("CALLFACE AI - COLD CALLING"), item("SETUP", 50)]);
  assert.equal(p.resultado, "mista");
  assert.equal(p.familia, null);
  assert.equal(p.itens[2].familia, null);
  assert.equal(p.itens[2].gravar, false);
  assert.equal(p.itens[0].familia, "PABX", "o item de nome claro leva a sua mesmo na proposta mista");
});

test("sem evidência não é chute: só genérico fica sem família, e só ajuste é outro caso", () => {
  assert.equal(decidirFamiliaDaProposta([item("SETUP"), item("SMALL")]).resultado, "sem_evidencia");
  assert.equal(decidirFamiliaDaProposta([item("DESCONTO EXECUTIVO - MENSAL", -10)]).resultado, "so_ajuste");
  assert.equal(decidirFamiliaDaProposta([]).resultado, "so_ajuste");
});

test("proposta com tudo CONFIRMED sai CONFIRMED", () => {
  const p = decidirFamiliaDaProposta([item("LINHA SIP"), item("RAMAL - FALE A VONTADE")]);
  assert.equal(p.confianca, "CONFIRMED");
});

/* ── vínculo ── */
const D = (s: string) => new Date(s);
const prop = { criadaEm: D("2026-03-10T12:00:00Z"), totalRecorrente: 299.9, totalGeral: 299.9 };
const neg = (extra: Record<string, unknown> = {}) => ({ id: "n1", criadoEm: D("2026-03-01T12:00:00Z"), mrrFechado: 299.9, mrrEstimado: 0, valorTotal: 0, ...extra });

test("vínculo FORTE exige lead com um só negócio, anterior à proposta, de mesmo valor", () => {
  const d = decidirVinculo(prop, [neg()]);
  assert.deepEqual([d.nivel, d.negocioId], ["FORTE", "n1"]);
});

test("vínculo: o valor pode bater pelo estimado ou pelo total, e a data aceita 1 dia de fuso", () => {
  assert.equal(decidirVinculo(prop, [neg({ mrrFechado: 0, mrrEstimado: 299.9 })]).nivel, "FORTE");
  assert.equal(decidirVinculo(prop, [neg({ mrrFechado: 0, valorTotal: 299.9 })]).nivel, "FORTE");
  assert.equal(decidirVinculo(prop, [neg({ criadoEm: D("2026-03-11T08:00:00Z") })]).nivel, "FORTE");
  assert.equal(decidirVinculo(prop, [neg({ criadoEm: D("2026-03-12T12:00:00Z") })]).nivel, "REVISAR");
});

test("vínculo: dois negócios, valor diferente ou negócio posterior viram revisão, nunca ligação", () => {
  assert.equal(decidirVinculo(prop, [neg(), neg({ id: "n2" })]).nivel, "REVISAR");
  const valor = decidirVinculo(prop, [neg({ mrrFechado: 100 })]);
  assert.deepEqual([valor.nivel, valor.negocioId], ["REVISAR", "n1"]);
  assert.equal(decidirVinculo(prop, [neg({ criadoEm: D("2026-06-01T12:00:00Z") })]).nivel, "REVISAR");
});

test("vínculo: proposta de valor zero não casa por 'zero igual a zero'", () => {
  const d = decidirVinculo({ ...prop, totalRecorrente: 0, totalGeral: 0 }, [neg({ mrrFechado: 0 })]);
  assert.equal(d.nivel, "REVISAR");
});

test("vínculo: lead sem negócio é caso à parte", () => {
  assert.equal(decidirVinculo(prop, []).nivel, "SEM_CANDIDATO");
});

/* ── evidência ── */
const fatos = { ganhoEm: D("2026-04-01T00:00:00Z"), contratos: [], assinaturasNoEspelho: [], faturasPagasNoStripe: [] };

test("evidência: aceite de proposta, por si, não vira evidência; sem documento a lista é vazia", () => {
  assert.deepEqual(evidenciasDoGanho(fatos), []);
});

test("evidência: contrato com assinatura viva no Stripe é stripe_subscription; sem a assinatura no espelho é só contrato registrado", () => {
  const c = (id: string, sub: string | null) => ({ id, stripeSubscriptionId: sub, criadoEm: D("2026-03-30T00:00:00Z") });
  const vivo = evidenciasDoGanho({ ...fatos, contratos: [c("c1", "sub_1")], assinaturasNoEspelho: ["sub_1"] });
  assert.deepEqual(vivo.map((e) => [e.tipo, e.sourceRef]), [["stripe_subscription", "sub_1"]]);
  const orfao = evidenciasDoGanho({ ...fatos, contratos: [c("c2", "sub_2")], assinaturasNoEspelho: [] });
  assert.deepEqual(orfao.map((e) => [e.tipo, e.sourceRef]), [["manual_contract", "c2"]]);
  const zoho = evidenciasDoGanho({ ...fatos, contratos: [c("c3", null)] });
  assert.deepEqual(zoho.map((e) => e.tipo), ["manual_contract"]);
});

test("evidência: fatura paga usa a data do pagamento, ou a do ganho quando o pagamento não tem data; chave repetida colapsa", () => {
  const f = evidenciasDoGanho({
    ...fatos,
    faturasPagasNoStripe: [
      { id: "f1", externalId: "in_1", pagaEm: D("2026-04-02T00:00:00Z") },
      { id: "f2", externalId: null, pagaEm: null },
      { id: "f1b", externalId: "in_1", pagaEm: D("2026-05-02T00:00:00Z") },
    ],
  });
  assert.deepEqual(f.map((e) => [e.tipo, e.sourceRef]), [["stripe_payment", "in_1"], ["stripe_payment", "f2"]]);
  assert.equal(f[0].verificadoEm?.toISOString(), "2026-04-02T00:00:00.000Z");
  assert.equal(f[1].verificadoEm?.toISOString(), "2026-04-01T00:00:00.000Z");
});

/* ── o script respeita as travas de arquitetura ── */
test("o script de backfill: simula por padrão, não bumpa o relógio e confere o tenant em todo UPDATE", () => {
  const bruto = fs.readFileSync(path.join(process.cwd(), "src", "scripts", "backfill-historico-propostas.ts"), "utf8");
  const src = bruto.replace(/\/\*[\s\S]*?\*\//g, ""); // o cabeçalho documenta o desfazer com UPDATE; não é código
  assert.match(src, /const aplicar = args\.includes\("--aplicar"\)/, "o padrão tem que ser simular");
  assert.doesNotMatch(src, /updated_at\s*=\s*now\(\)/i, "backfill não pode resetar o relógio");
  assert.doesNotMatch(src, /\.catch\(\s*\(\)\s*=>\s*(\[\]|null|\{\})/, "nada de catch que devolve vazio em silêncio");
  const updates = src.split(/\bUPDATE\s/).slice(1);
  assert.ok(updates.length >= 5, "o teste varreu poucos UPDATE: o script mudou de forma");
  for (const u of updates) {
    const trecho = u.slice(0, 900);
    if (!/\bSET\b/.test(trecho)) continue; // 'UPDATE' em comentário
    assert.match(trecho, /organizacao_id/, `UPDATE sem organizacao_id: ${trecho.slice(0, 80)}`);
    assert.match(trecho, /updated_at = (p\.)?updated_at|SET\s+service_family|semantic_confidence/, `UPDATE sem guardar o relógio: ${trecho.slice(0, 80)}`);
  }
});
