/**
 * Fase 3: o MRR sai de UMA consulta (mrr-oficial.ts) e as telas só a embrulham.
 * Os testes de banco rodam contra a cópia local; sem DATABASE_URL, pulam.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { db, fecharConexao } from "@/lib/db";
import { medir } from "@/lib/metricas/catalogo";
import { mrrOficialLinhas } from "@/lib/metricas/mrr-oficial";
import { getMrrAtual } from "@/lib/financeiro/metricas";
import { carteiraParaODesenho } from "@/lib/clientes/carteira-desenho";
import { dadosTelaCs } from "@/lib/cs/tela-cs";
import { carteiraEmRisco } from "@/lib/cs/carteira-em-risco";

const centavos = (n: unknown) => Math.round(Number(n) * 100);
after(() => fecharConexao());
const ORG_FICTICIA = "00000000-0000-0000-0000-000000000000";

async function organizacao(): Promise<string> {
  const [o] = await db.execute<{ id: string }>(sql`SELECT organizacao_id::text AS id FROM cliente_receita_mensal LIMIT 1`);
  return o.id;
}

test("setup e uso não entram no MRR: o recorte só aceita natureza MRR (sem banco)", () => {
  const { sql: texto } = new PgDialect().sqlToQuery(mrrOficialLinhas(ORG_FICTICIA));
  assert.match(texto, /revenue_nature = 'MRR'/);
  for (const natureza of ["SETUP", "USAGE", "ONE_TIME", "DEBITO_RECUPERADO"]) {
    assert.ok(!texto.includes(natureza), `o MRR oficial não pode citar ${natureza}`);
  }
});

test("as seis leituras devolvem o mesmo número", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
    const org = await organizacao();
    const linhas = await db.execute<{ empresa_id: string | null; valor: string }>(sql`
      SELECT empresa_id::text, valor FROM (${mrrOficialLinhas(org)}) m`);
    const total = linhas.reduce((a, l) => a + centavos(l.valor), 0);
    const porEmpresa = new Map<string, number>();
    for (const l of linhas) if (l.empresa_id) porEmpresa.set(l.empresa_id, (porEmpresa.get(l.empresa_id) ?? 0) + centavos(l.valor));
    assert.ok(linhas.length > 100, "a consulta veio vazia: o teste não provaria nada");

    // 1 (catálogo) e 2 (Financeiro): o total global.
    assert.equal(centavos((await medir(org, "mrr_atual")).valor), total, "catálogo diverge da fonte única");
    assert.equal(centavos((await getMrrAtual(org)).total), total, "Financeiro diverge da fonte única");

    // 3 (Carteira), 4 (tela de CS), 5 (carteira em risco): o valor de CADA empresa.
    const confere = (tela: string, id: string, mrr: unknown) =>
      assert.equal(centavos(mrr), porEmpresa.get(id) ?? 0, `${tela}: MRR da empresa ${id} diverge da fonte única`);
    const carteira = await carteiraParaODesenho(org);
    assert.ok(carteira.clientes.length > 0);
    for (const c of carteira.clientes) confere("Carteira", c.id, c.mrr);
    const cs = await dadosTelaCs(org);
    for (const c of cs.clientes) confere("tela de CS", c.id, c.mrr);
    for (const c of (await carteiraEmRisco(org)).contas) confere("carteira em risco", c.empresaId, c.mrr);

    // 6 (Cliente 360) consome o mesmo recorte por empresa+família: a soma das famílias fecha o total da empresa.
    const [amostra] = [...porEmpresa.keys()];
    const [fam] = await db.execute<{ v: string }>(sql`
      SELECT COALESCE(sum(valor), 0)::text AS v FROM (${mrrOficialLinhas(org, { empresaId: amostra })}) m`);
    assert.equal(centavos(fam.v), porEmpresa.get(amostra));
});

test("setup e receita de uso não entram no MRR (contra o banco)", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
    const org = await organizacao();
    const [c] = await db.execute<{ de: string; ate: string }>(sql`
      SELECT max(competencia)::text AS de, (max(competencia) + interval '1 month')::date::text AS ate
        FROM cliente_receita_mensal WHERE organizacao_id = ${org}::uuid`);
    const janela = { de: new Date(`${c.de}T00:00:00-03:00`), ate: new Date(`${c.ate}T00:00:00-03:00`), incluirTestes: true };
    const [r] = await db.execute<{ mrr: string; setup: string; uso: string; pontual: string; resto: string }>(sql`
      SELECT COALESCE(sum(valor) FILTER (WHERE revenue_nature = 'MRR'), 0)::text AS mrr,
             COALESCE(sum(valor) FILTER (WHERE revenue_nature = 'SETUP'), 0)::text AS setup,
             COALESCE(sum(valor) FILTER (WHERE revenue_nature = 'USAGE'), 0)::text AS uso,
             COALESCE(sum(valor) FILTER (WHERE revenue_nature = 'ONE_TIME'), 0)::text AS pontual,
             COALESCE(sum(valor) FILTER (WHERE revenue_nature IS DISTINCT FROM 'MRR'), 0)::text AS resto
        FROM cliente_receita_mensal
       WHERE organizacao_id = ${org}::uuid AND competencia = ${c.de}::date`);

    // O MRR faturável da última competência é exatamente a soma das linhas MRR: nada de outra natureza.
    const faturavel = await medir(org, "mrr_faturavel", { incluirTestes: true });
    assert.equal(centavos(faturavel.valor), centavos(r.mrr));
    // E cada natureza aparece na sua própria métrica, com o valor da própria natureza.
    assert.equal(centavos((await medir(org, "receita_setup", janela)).valor), centavos(r.setup));
    assert.equal(centavos((await medir(org, "receita_uso", janela)).valor), centavos(r.uso));
    assert.equal(centavos((await medir(org, "receita_avulsa", janela)).valor), centavos(r.pontual));
    // Se o mês tem outra natureza, ela existe e ficou de fora do MRR (senão o teste seria vazio).
    if (centavos(r.resto) > 0) assert.ok(centavos(r.setup) + centavos(r.uso) + centavos(r.pontual) <= centavos(r.resto));
});
