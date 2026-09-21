/**
 * Regressão do cutover de leitura (SPEC §17).
 *
 * O sintoma que abriu este refactor: 2.392 dos 3.989 leads não apareciam em
 * tela nenhuma porque a consulta filtrava `estagio_pre_vendas = ANY(...)` e o
 * campo estava NULO. Eles existiam, com dono e origem, e eram invisíveis.
 *
 * Estes testes travam a propriedade que impede isso de voltar: **o board conta
 * tudo que existe**. Não é sobre o número de hoje — é sobre nenhum registro
 * poder cair fora da leitura por causa de um campo opcional vazio.
 *
 * Precisa de DATABASE_URL: é validação contra o banco real, como o resto da
 * validação deste refactor. Sem ela, pula.
 */
import test from "node:test";
import assert from "node:assert/strict";

const DB_URL = process.env.DATABASE_URL;

test("o board de pré-vendas conta toda aquisição aberta, sem exigir campo opcional", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { boardPreVendas } = await import("./consultas.js");

  const [org] = await db.execute<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);
  const board = await boardPreVendas(org.id, { aba: "ativos" });

  const [real] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM aquisicoes
     WHERE organizacao_id = ${org.id}::uuid AND closed_at IS NULL`);

  const somaDasColunas = board.colunas.reduce((n, c) => n + c.total, 0);
  assert.equal(
    somaDasColunas, real.n,
    `o board mostra ${somaDasColunas} e existem ${real.n} aquisições abertas: ` +
    "alguma caiu fora da leitura",
  );
  assert.equal(board.resumo.ativos, real.n, "o resumo tem que contar o mesmo universo");
});

test("nenhuma coluna anuncia total sem conseguir mostrar card", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { boardPreVendas } = await import("./consultas.js");

  const [org] = await db.execute<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);
  const board = await boardPreVendas(org.id, { aba: "ativos" });

  // Coluna que diz "531" e mostra zero card parece bug do produto — e antes
  // era, porque o limite era global e as vagas iam todas para a coluna maior.
  const mudas = board.colunas.filter((c) => c.total > 0 && c.cards.length === 0);
  assert.deepEqual(
    mudas.map((c) => `${c.rotulo}: total ${c.total}, 0 cards`), [],
    "coluna com total e sem card",
  );
});

test("o card leva identidade suficiente para abrir o registro", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { boardPreVendas } = await import("./consultas.js");

  const [org] = await db.execute<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);
  const board = await boardPreVendas(org.id, { aba: "ativos" });
  const cards = board.colunas.flatMap((c) => c.cards);
  assert.ok(cards.length > 0, "o board de um banco com dado não pode vir vazio");

  const semId = cards.filter((c) => !c.leadId);
  assert.deepEqual(semId, [], "card sem identificador não abre em lugar nenhum");
  const semEmpresa = cards.filter((c) => !c.empresa);
  assert.deepEqual(semEmpresa, [], "o card é empresa-first: rótulo vazio quebra a leitura");
});
