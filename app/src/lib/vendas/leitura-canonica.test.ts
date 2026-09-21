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

test("o pipeline canônico tem paridade com o legado, e a diferença é um caso registrado", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");
  const { boardPipeline } = await import("./consultas.js");

  const [org] = await db.execute<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);

  // Contagem pelo caminho LEGADO, direto na tabela que a tela lia antes.
  const legado = await db.execute<{ etapa: string; n: number }>(sql`
    SELECT etapa, count(*)::int AS n FROM negocios
     WHERE organizacao_id = ${org.id}::uuid AND etapa IS NOT NULL GROUP BY etapa`);
  const porEtapaLegado = new Map(legado.map((l) => [l.etapa, l.n]));

  const abas = [
    ["abertas", ["entrada", "diagnostico", "proposta", "negociacao"]],
    ["ganhas", ["ganho"]],
    ["perdidas", ["perdido"]],
  ] as const;

  const divergencias: string[] = [];
  for (const [aba, etapas] of abas) {
    const board = await boardPipeline(org.id, { aba });
    for (const etapa of etapas) {
      const canonico = board.colunas.find((c) => c.chave === etapa)?.total ?? 0;
      const doLegado = porEtapaLegado.get(etapa) ?? 0;
      if (canonico !== doLegado) divergencias.push(`${etapa}: canônico ${canonico}, legado ${doLegado}`);
    }
  }

  // Toda divergência precisa estar explicada por um caso de reconciliação. Não
  // é sobre os números serem iguais — é sobre nenhuma linha sumir sem registro.
  const [casos] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM reconciliacao_casos
     WHERE tipo = 'OPORTUNIDADE_SEM_IDENTIDADE'`);
  const [semOportunidade] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM negocios n
     WHERE n.organizacao_id = ${org.id}::uuid
       AND NOT EXISTS (SELECT 1 FROM oportunidades o WHERE o.negocio_id_legado = n.id)`);

  assert.equal(
    semOportunidade.n, casos.n,
    `${semOportunidade.n} negócios sem oportunidade e ${casos.n} casos registrados: ` +
    "negócio que não virou oportunidade tem que virar caso, nunca sumir",
  );

  const totalDivergente = divergencias.length ? divergencias.join("; ") : "";
  const diferencaTotal = divergencias.reduce((soma, d) => {
    const [, c, l] = d.match(/canônico (\d+), legado (\d+)/) ?? [];
    return soma + Math.abs(Number(l ?? 0) - Number(c ?? 0));
  }, 0);
  assert.ok(
    diferencaTotal <= semOportunidade.n,
    `divergência de ${diferencaTotal} linhas com apenas ${semOportunidade.n} caso(s) registrado(s): ${totalDivergente}`,
  );
});

test("contrato sem processo comercial ainda resolve dono, e o que sobra vira caso", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  // 406 dos 742 contratos não têm negócio nem oportunidade — e 271 deles estão
  // ATIVOS. A cadeia antiga (contrato → negócio → responsável) resolvia ZERO
  // deles, e sem responsável o onboarding nasce órfão e a notificação não sai.
  const [r] = await db.execute<{ orfaos: number; resolvem: number; casos: number }>(sql`
    SELECT
      (SELECT count(*)::int FROM contratos
        WHERE negocio_id IS NULL AND oportunidade_id IS NULL) AS orfaos,
      (SELECT count(*)::int FROM contratos c
        WHERE c.negocio_id IS NULL AND c.oportunidade_id IS NULL
          AND EXISTS (SELECT 1 FROM aquisicoes a
                       WHERE a.lead_legado_id = c.lead_id AND a.responsavel_id IS NOT NULL)) AS resolvem,
      (SELECT count(*)::int FROM reconciliacao_casos
        WHERE tipo = 'CONTRATO_SEM_PROCESSO_COMERCIAL') AS casos`);

  if (r.orfaos === 0) return; // base sem o problema: nada a provar

  assert.equal(
    r.casos, r.orfaos,
    `${r.orfaos} contratos sem processo comercial e ${r.casos} casos registrados: ` +
    "contrato que não se liga a venda nenhuma tem que estar registrado, não escondido",
  );
  assert.ok(
    r.resolvem > 0,
    "nenhum contrato órfão resolve dono pela identidade: a cadeia de responsável regrediu",
  );
});
