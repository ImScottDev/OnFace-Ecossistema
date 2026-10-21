/**
 * Invariantes CRUZADAS entre fontes que hoje ninguém confere. Roda contra o banco local (cópia de produção).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { medir } from "./catalogo";
import { calcularRazao, medirRazao, RAZOES } from "./derivadas";
import { diaSP } from "./janela";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function organizacao(): Promise<string> {
  const [o] = await db.execute<{ id: string }>(sql`SELECT organizacao_id::text AS id FROM cliente_receita_mensal LIMIT 1`);
  return o.id;
}

test("mrr_atual >= metricas_diarias.mrr_stripe: o snapshot do Stripe é SUBCONJUNTO do MRR oficial", async () => {
  const org = await organizacao();
  const [snap] = await db.execute<{ data: string; mrr_stripe: string }>(sql`
    SELECT data::text, mrr_stripe::text FROM metricas_diarias WHERE organizacao_id = ${org}::uuid ORDER BY data DESC LIMIT 1`);
  assert.ok(snap, "metricas_diarias está vazia: o teste não provaria nada");
  const oficial = (await medir(org, "mrr_atual", { incluirTestes: true })).valor;
  const stripe = Number(snap.mrr_stripe);
  assert.ok(
    oficial >= stripe,
    `mrr_atual (${brl(oficial)}) ficou ABAIXO do mrr_stripe do snapshot de ${snap.data} (${brl(stripe)}). O snapshot soma só assinaturas Stripe ` +
    `(active + trialing + past_due); o MRR oficial soma o faturado de TODAS as fontes (inclui boleto e nota fiscal do PABX). ` +
    `Se o oficial é menor que um subconjunto dele, uma das duas fontes perdeu cliente.`,
  );
});

test("movimento líquido de MRR (Stripe) x variação do MRR faturável: o gap é medido e tem teto", async (t) => {
  const org = await organizacao();
  const [ult] = await db.execute<{ c: string }>(sql`SELECT max(competencia)::text AS c FROM cliente_receita_mensal WHERE organizacao_id = ${org}::uuid`);
  const mrrDa = async (competencia: string) => Number((await db.execute<{ v: string }>(sql`
    SELECT COALESCE(sum(valor), 0)::text AS v FROM cliente_receita_mensal
     WHERE organizacao_id = ${org}::uuid AND revenue_nature = 'MRR' AND competencia = ${competencia}::date`))[0].v);

  // Âncora: o oráculo mensal bate com a métrica na última competência (se não bater, a comparação abaixo não vale).
  const faturavel = (await medir(org, "mrr_faturavel", { incluirTestes: true })).valor;
  assert.equal(Math.round(faturavel * 100), Math.round((await mrrDa(ult.c)) * 100), "mrr_faturavel não é o MRR da última competência");

  const [a, m] = ult.c.split("-").map(Number);
  const meses = [0, 1, 2].map((i) => ({ ano: m - i > 0 ? a : a - 1, mes: ((m - i - 1 + 12) % 12) + 1 }));
  const iso = (x: { ano: number; mes: number }) => `${x.ano}-${String(x.mes).padStart(2, "0")}-01`;
  const CETO = 50_000;
  for (const x of meses) {
    const ant = { ano: x.mes === 1 ? x.ano - 1 : x.ano, mes: x.mes === 1 ? 12 : x.mes - 1 };
    const variacao = (await mrrDa(iso(x))) - (await mrrDa(iso(ant)));
    const mov = (await medir(org, "mrr_movimento_liquido", { de: diaSP(x.ano, x.mes, 1), ate: diaSP(x.ano, x.mes + 1, 1), incluirTestes: true })).valor;
    const gap = variacao - mov;
    t.diagnostic(`${iso(x)}: variação do MRR faturável ${brl(variacao)}, movimento líquido ${brl(mov)}, gap ${brl(gap)}`);
    // As duas séries medem coisas diferentes (planilha de todas as fontes x eventos Stripe) e NÃO fecham. O que se
    // trava é a magnitude: um gap que passa do teto é regressão numa das duas fontes, não a divergência conhecida.
    assert.ok(Math.abs(gap) <= CETO, `${iso(x)}: gap de ${brl(gap)} passou do teto de ${brl(CETO)} (variação ${brl(variacao)}, movimento ${brl(mov)})`);
  }
});

test("razão com denominador zero devolve null com motivo, em organização sintética vazia", async () => {
  const [o] = await db.execute<{ id: string }>(sql`
    INSERT INTO organizacoes (nome, slug) VALUES (${"[QA] cruzadas org"}, ${"qa-cruzadas-" + Date.now().toString(36)}) RETURNING id::text`);
  try {
    for (const def of RAZOES) {
      const r = await medirRazao(o.id, def.codigo, { periodo: "12m" });
      assert.equal(r.valor, null, `${def.codigo}: organização vazia devolveu ${r.valor} em vez de null`);
      assert.equal(r.motivo, "sem_denominador", def.codigo);
    }
  } finally {
    await db.execute(sql`DELETE FROM organizacoes WHERE id = ${o.id}::uuid`);
  }
});

test("calcularRazao: denominador 0 nunca vira 0%, amostra pequena não vira número, 0% verdadeiro continua 0", () => {
  const def = { escala: 100 as const, amostraMinima: 20 };
  assert.deepEqual(calcularRazao(def, 0, 0, 0), { valor: null, motivo: "sem_denominador" });
  assert.deepEqual(calcularRazao(def, 5, 0, 5), { valor: null, motivo: "sem_denominador" });
  assert.deepEqual(calcularRazao(def, 2, 2, 2), { valor: null, motivo: "amostra_pequena" });
  assert.deepEqual(calcularRazao(def, 0, 40, 40), { valor: 0, motivo: null }, "0 ganhos em 40 é 0% de verdade, e não ausência");
  assert.deepEqual(calcularRazao(def, 10, 40, 40), { valor: 25, motivo: null });
});

test("win rate no banco real: ganhas / (ganhas + perdidas) numa janela só, alinhada pelo piso de booking_ganho", async () => {
  const org = await organizacao();
  const r = await medirRazao(org, "win_rate", { periodo: "12m" });
  const ganhas = r.operandos.booking_ganho.medicao.registros;
  const perdidas = r.operandos.oportunidades_perdidas.medicao.valor;
  assert.equal(r.numerador, ganhas);
  assert.equal(r.denominador, ganhas + perdidas);
  // Sem alinhar, as perdidas pegariam os 12 meses inteiros e o denominador seria maior que o das ganhas (só pós-piso).
  const semAlinhar = (await medir(org, "oportunidades_perdidas", { de: diaSP(2025, 10, 1), ate: new Date(Date.now() + 86_400_000) })).valor;
  assert.ok(perdidas < semAlinhar, `perdidas alinhadas (${perdidas}) deveriam ser menos que as da janela inteira (${semAlinhar})`);
  assert.equal(r.operandos.oportunidades_perdidas.deComum?.toISOString(), "2026-07-01T03:00:00.000Z");
});
