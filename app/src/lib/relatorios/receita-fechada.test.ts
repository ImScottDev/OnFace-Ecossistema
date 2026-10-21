/**
 * A política de receita vendida existe em duas formas (TS e SQL) de propósito.
 * Estes testes provam a regra em TS e que a tradução em SQL concorda com ela
 * linha por linha, no banco real — é isso que autoriza as duas a coexistirem.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { decomporVenda, valorVendido } from "./receita-fechada-shared";
import {
  VALOR_MRR_VENDIDO,
  VALOR_SETUP_VENDIDO,
  VALOR_AVULSO_VENDIDO,
  VALOR_BOOKING_VENDIDO,
  VALOR_TOTAL_VENDIDO,
} from "./receita-fechada";

test("venda recorrente: mensalidade e setup são grandezas separadas, e o booking soma as duas", () => {
  assert.deepEqual(
    decomporVenda({ tipoReceita: "recorrente", mrrFechado: 900, valorSetup: 400, valorTotal: 1300 }),
    { recorrente: 900, setup: 400, avulso: 0, booking: 1300, total: 1300 },
  );
});

test("híbrido recorre: entra como recorrente + setup, não como avulso", () => {
  assert.deepEqual(
    decomporVenda({ tipoReceita: "hibrido", mrrFechado: 1000, valorSetup: 2500, valorTotal: 3500 }),
    { recorrente: 1000, setup: 2500, avulso: 0, booking: 3500, total: 3500 },
  );
});

test("projeto avulso usa o valor cheio uma só vez e fica FORA do booking", () => {
  assert.deepEqual(
    decomporVenda({ tipoReceita: "projeto", mrrFechado: 0, valorSetup: 200, valorTotal: 1800 }),
    { recorrente: 0, setup: 0, avulso: 1800, booking: 0, total: 1800 },
  );
});

test("projeto sem valor total cai no setup: é onde a migração gravou o projeto", () => {
  assert.deepEqual(
    decomporVenda({ tipoReceita: "avulso", mrrFechado: 0, valorSetup: 300, valorTotal: 0 }),
    { recorrente: 0, setup: 0, avulso: 300, booking: 0, total: 300 },
  );
});

test("ausência de campos não transforma mensalidade em receita duplicada", () => {
  assert.deepEqual(
    decomporVenda({ tipoReceita: null, mrrFechado: 250, valorSetup: null, valorTotal: 5000 }),
    { recorrente: 250, setup: 0, avulso: 0, booking: 250, total: 250 },
  );
});

test("White Label: a linha Recorrente da proposta não vira MRR; só o setup foi vendido", () => {
  // Elev Ads, caso real: mrr_fechado 11.990 e setup 11.900, híbrido.
  assert.deepEqual(
    decomporVenda({ tipoReceita: "hibrido", mrrFechado: 11990, valorSetup: 11900, valorTotal: 23890, serviceFamily: "WHITE_LABEL" }),
    { recorrente: 0, setup: 11900, avulso: 0, booking: 11900, total: 11900 },
  );
  // E não cai no bucket de avulso por engano: WL não é projeto.
  assert.equal(
    decomporVenda({ tipoReceita: "hibrido", mrrFechado: 38970, valorSetup: 29990, valorTotal: 68960, serviceFamily: "WHITE_LABEL" }).avulso,
    0,
  );
});

test("sem família, a venda recorrente segue contando a mensalidade", () => {
  // A exceção é SÓ do White Label: família ausente ou outra não muda nada.
  const base = { tipoReceita: "hibrido", mrrFechado: 1000, valorSetup: 2500, valorTotal: 3500 };
  assert.equal(decomporVenda(base).recorrente, 1000);
  assert.equal(decomporVenda({ ...base, serviceFamily: null }).recorrente, 1000);
  assert.equal(decomporVenda({ ...base, serviceFamily: "PABX" }).recorrente, 1000);
  assert.equal(decomporVenda({ ...base, serviceFamily: "CALLFACE_AI" }).recorrente, 1000);
});

test("valorVendido é o booking, nunca o total com avulso", () => {
  assert.equal(valorVendido({ tipoReceita: "recorrente", mrrFechado: 900, valorSetup: 400, valorTotal: 1300 }), 1300);
  assert.equal(valorVendido({ tipoReceita: "projeto", mrrFechado: 0, valorSetup: 0, valorTotal: 1800 }), 0);
});

test("o SQL concorda com o TS em toda venda ganha do banco", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("sem DATABASE_URL");
  const linhas = await db.execute<{
    tipo_receita: string | null; mrr_fechado: string | null; valor_setup: string | null; valor_total: string | null;
    service_family: string | null;
    s_mrr: string; s_setup: string; s_avulso: string; s_booking: string; s_total: string;
  }>(sql`
    SELECT tipo_receita, mrr_fechado, valor_setup, valor_total, service_family,
           ${VALOR_MRR_VENDIDO}::text     AS s_mrr,
           ${VALOR_SETUP_VENDIDO}::text   AS s_setup,
           ${VALOR_AVULSO_VENDIDO}::text  AS s_avulso,
           ${VALOR_BOOKING_VENDIDO}::text AS s_booking,
           ${VALOR_TOTAL_VENDIDO}::text   AS s_total
      FROM negocios WHERE ganho_at IS NOT NULL`);

  assert.ok(linhas.length > 0, "nenhuma venda ganha: o teste não provaria nada");
  const cent = (n: unknown) => Math.round(Number(n ?? 0) * 100);
  for (const l of linhas) {
    const ts = decomporVenda({
      tipoReceita: l.tipo_receita,
      mrrFechado: l.mrr_fechado === null ? null : Number(l.mrr_fechado),
      valorSetup: l.valor_setup === null ? null : Number(l.valor_setup),
      valorTotal: l.valor_total === null ? null : Number(l.valor_total),
      serviceFamily: l.service_family,
    });
    const onde = `tipo=${l.tipo_receita} familia=${l.service_family} mrr=${l.mrr_fechado} setup=${l.valor_setup} total=${l.valor_total}`;
    assert.equal(cent(ts.recorrente), cent(l.s_mrr), `recorrente divergiu (${onde})`);
    assert.equal(cent(ts.setup), cent(l.s_setup), `setup divergiu (${onde})`);
    assert.equal(cent(ts.avulso), cent(l.s_avulso), `avulso divergiu (${onde})`);
    assert.equal(cent(ts.booking), cent(l.s_booking), `booking divergiu (${onde})`);
    assert.equal(cent(ts.total), cent(l.s_total), `total divergiu (${onde})`);
  }
});

test("booking + avulso fecha o total, no agregado do banco", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("sem DATABASE_URL");
  const [r] = await db.execute<{ booking: string; avulso: string; total: string }>(sql`
    SELECT COALESCE(sum(${VALOR_BOOKING_VENDIDO}),0)::text AS booking,
           COALESCE(sum(${VALOR_AVULSO_VENDIDO}),0)::text  AS avulso,
           COALESCE(sum(${VALOR_TOTAL_VENDIDO}),0)::text   AS total
      FROM negocios WHERE ganho_at IS NOT NULL`);
  const cent = (n: unknown) => Math.round(Number(n ?? 0) * 100);
  assert.equal(cent(r.booking) + cent(r.avulso), cent(r.total), "booking + avulso não fecha o total vendido");
});
