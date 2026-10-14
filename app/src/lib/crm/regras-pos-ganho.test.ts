/**
 * Regras do que o Ganho grava: valor fechado, chave do serviço e quantidade.
 * Puro e rápido (entra no portão). A cadeia completa contra o banco está em
 * `cadeia-pos-ganho.db.test.ts`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { valoresFechadosDoGanho, chaveCanonicaDoItem, valoresDoServico, valoresDoGanhoAntigo } from "./regras-pos-ganho";

const neg = (o: Partial<Parameters<typeof valoresFechadosDoGanho>[0]> = {}) => ({ mrrFechado: null, mrrEstimado: null, valorSetup: null, valorProjeto: null, ...o });

test("ganho automático preenche mrr_fechado e valor_setup a partir do que as propostas somaram", () => {
  assert.deepEqual(valoresFechadosDoGanho(neg({ mrrEstimado: "304.90", valorProjeto: "129.90" })), { mrrFechado: "304.90", valorSetup: "129.90" });
});

test("valor já digitado (PATCH manual) nunca é sobrescrito", () => {
  assert.deepEqual(valoresFechadosDoGanho(neg({ mrrFechado: "1000.00", mrrEstimado: "304.90", valorSetup: "50.00", valorProjeto: "129.90" })), {});
});

test("zero conta como vazio e estimativa zero não grava nada", () => {
  assert.deepEqual(valoresFechadosDoGanho(neg({ mrrFechado: "0.00", mrrEstimado: "489.70" })), { mrrFechado: "489.70" });
  assert.deepEqual(valoresFechadosDoGanho(neg({ mrrEstimado: "0.00", valorProjeto: "0" })), {});
});

test("venda sem setup não inventa setup", () => {
  assert.deepEqual(valoresFechadosDoGanho(neg({ mrrEstimado: "259.90" })), { mrrFechado: "259.90" });
});

test("chave canônica: um item recorrente na assinatura mantém a convenção STRIPE:<sub>", () => {
  assert.equal(chaveCanonicaDoItem({ itemId: "i1", ehMrr: true, stripeSubscriptionId: "sub_1", itensMrrNoLote: 1 }), "STRIPE:sub_1");
});

test("chave canônica: vários itens recorrentes na mesma assinatura NÃO colapsam numa linha só", () => {
  const chaves = ["i1", "i2", "i3"].map((itemId) => chaveCanonicaDoItem({ itemId, ehMrr: true, stripeSubscriptionId: "sub_1", itensMrrNoLote: 3 }));
  assert.equal(new Set(chaves).size, 3);
});

test("chave canônica: o que não é MRR (setup, uso) ou não tem assinatura usa CRM2:<item>", () => {
  assert.equal(chaveCanonicaDoItem({ itemId: "i9", ehMrr: false, stripeSubscriptionId: "sub_1", itensMrrNoLote: 2 }), "CRM2:i9");
  assert.equal(chaveCanonicaDoItem({ itemId: "i9", ehMrr: true, stripeSubscriptionId: null, itensMrrNoLote: 2 }), "CRM2:i9");
});

test("quantidade é informativa: 10 x R$ 5,00 com desconto vale R$ 45,00 (o total da linha), nunca 450", () => {
  const v = valoresDoServico({ revenueNature: "MRR", valorTotal: "45.00", quantidade: "10" });
  assert.equal(v.valorRecorrente, "45.00");
  assert.equal(v.quantidade, "10");
});

test("só MRR vale no MRR: setup e uso gravam 0 e guardam a quantidade", () => {
  for (const revenueNature of ["SETUP", "USAGE", "ONE_TIME", "PROJECT", "HARDWARE", "UNKNOWN"]) {
    assert.equal(valoresDoServico({ revenueNature, valorTotal: "99.90", quantidade: "3" }).valorRecorrente, "0.00", revenueNature);
  }
});

test("quantidade ausente ou inválida vira 1", () => {
  assert.equal(valoresDoServico({ revenueNature: "MRR", valorTotal: "10", quantidade: null }).quantidade, "1");
  assert.equal(valoresDoServico({ revenueNature: "MRR", valorTotal: "10", quantidade: "0" }).quantidade, "1");
});

/* ── Componente não soma receita ─────────────────────────────────────────────
 * Decisão: a venda de N unidades é UMA linha com quantidade = N. Não existe linha-filha por
 * unidade/componente. Se existisse, "SUM(current_recurring_value)" (seis leituras de MRR) somaria
 * pai + filhos em dobro. As duas travas abaixo impedem as duas maneiras de reintroduzir isso. */
test("o serviço canônico nunca multiplica o valor pela quantidade nem se desdobra em componentes", () => {
  const SRC = path.join(process.cwd(), "src");
  const fonte = fs.readFileSync(path.join(SRC, "lib/crm/servico-canonico.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/valorTotal\s*\)?\s*\*\s*\(?\s*item\.quantidade|quantidade\s*\)?\s*\*\s*\(?\s*item\.valorTotal/.test(fonte), "valor × quantidade: o valor já é o total da linha");
  assert.ok(!/servicoPaiId|servico_pai_id|componente/i.test(fonte), "componente de serviço: dobraria o MRR nas leituras que somam current_recurring_value");
  // Uma linha por item: o resultado de materializar N itens são N serviços, não N × quantidade.
  assert.match(fonte, /for \(const item of aMaterializar\) feitos\.push\(\{ item, servicoId: await materializarItem/);
});

test("o Ganho automático grava o valor fechado: marcarNegocioGanhoSeAindaNao usa a regra no mesmo UPDATE do status", () => {
  const SRC = path.join(process.cwd(), "src");
  const fonte = fs.readFileSync(path.join(SRC, "lib/crm/won-evidence.ts"), "utf8");
  const corpo = fonte.slice(fonte.indexOf("export async function marcarNegocioGanhoSeAindaNao"), fonte.indexOf("export async function aplicarEfeitosPosGanho"));
  assert.match(corpo, /valoresFechadosDoGanho\(negocio\)/);
  assert.match(corpo, /status: "ganho"[^\n]*\.\.\.valoresFechados/);
});

/* ── Backfill do histórico de ganhos sem composição ──────────────────────────
 * Um ÚNICO script (`backfill-valor-negocios.ts`) cobre os dois grupos de ganho vazio: os que têm
 * estimativa (decompõe como o Ganho faz) e os do legado que só têm o total (recorrente puro). */
const antigo = (o: Partial<Parameters<typeof valoresDoGanhoAntigo>[0]> = {}) =>
  ({ mrrFechado: null, mrrEstimado: null, valorSetup: null, valorProjeto: null, valorTotal: null, tipoReceita: "recorrente", ...o });

test("ganho antigo com estimativa decompõe em mensalidade e setup, sem usar o total (não conta o setup como mensalidade)", () => {
  // JOAO PABX: total 305,90 = mensalidade 304,90 + setup 1,00. Gravar o total como mensalidade erraria os dois.
  assert.deepEqual(valoresDoGanhoAntigo(antigo({ valorTotal: "305.90", mrrEstimado: "304.90", valorProjeto: "1.00" })),
    { mrrFechado: "304.90", valorSetup: "1.00", regra: "decomposto" });
});

test("ganho antigo do legado, recorrente e só com o total, vira mensalidade", () => {
  assert.deepEqual(valoresDoGanhoAntigo(antigo({ valorTotal: "1290.50" })), { mrrFechado: "1290.50", regra: "total_recorrente" });
});

test("ganho antigo híbrido/projeto sem decomposição não é adivinhado", () => {
  assert.deepEqual(valoresDoGanhoAntigo(antigo({ tipoReceita: "hibrido", valorTotal: "5000" })), { regra: "nenhuma" });
  assert.deepEqual(valoresDoGanhoAntigo(antigo({ tipoReceita: "recorrente", valorTotal: "-50" })), { regra: "nenhuma" });
  assert.deepEqual(valoresDoGanhoAntigo(antigo()), { regra: "nenhuma" });
});

test("ganho antigo já preenchido não é tocado (idempotência)", () => {
  assert.deepEqual(valoresDoGanhoAntigo(antigo({ mrrFechado: "100.00", valorTotal: "100" })), { regra: "nenhuma" });
  assert.deepEqual(valoresDoGanhoAntigo(antigo({ valorSetup: "50.00", valorTotal: "50", mrrEstimado: "10" })), { regra: "nenhuma" });
});
