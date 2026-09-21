/**
 * O relatório e o board precisam falar do MESMO pipeline.
 *
 * Até 21/09 não falavam. `getPipelineAtual` contava `negocios.status` filtrando
 * pelos 5 estágios de `DEFAULT_STAGES`, e negócio aberto tem 11 status no
 * banco. Os 6 de fora eram 411 negócios e R$ 316.402,33: o relatório da
 * liderança mostrava R$ 160.789,35 de um pipeline de R$ 477.191,68, ou seja,
 * 22% do real, sem nada na tela indicando o recorte.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { db, fecharConexao } from "@/lib/db";
import { sql } from "drizzle-orm";
import { organizacoes } from "@/lib/db/schema";
import { getPipelineAtual, PIPELINE_ATIVO_STATUSES, STAGE_PROB, ETAPAS_DO_FUNIL } from "./comercial";

test("o relatório de pipeline bate com o board, no total e no valor", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  try {
    const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
    if (!org) return t.skip("nenhuma organização no banco");

    const { boardPipeline } = await import("@/lib/vendas/consultas");
    const [rel, board] = await Promise.all([getPipelineAtual(org.id), boardPipeline(org.id, {})]);
    const abertas = board.colunas.filter((c) => c.aceitaDrop);
    const totalBoard = abertas.reduce((n, c) => n + c.total, 0);
    const valorBoard = abertas.reduce((n, c) => n + c.valorTotal, 0);

    assert.equal(rel.negociosAbertos, totalBoard,
      `relatório diz ${rel.negociosAbertos} abertas e o board diz ${totalBoard}`);
    assert.ok(Math.abs(rel.total - valorBoard) < 0.02,
      `relatório diz R$ ${rel.total} e o board diz R$ ${valorBoard}`);
  } finally {
    await fecharConexao();
  }
});

test("a lista de status ativos cobre TODO negócio aberto", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  try {
    // Por exclusão e não por enumeração: um status novo que ninguém listar
    // some do relatório sem erro nenhum, que foi o defeito original.
    const faltando = await db.execute<{ status: string; n: number }>(sql`
      SELECT status, count(*)::int AS n FROM negocios
       WHERE status NOT IN ('ganho','perdido')
         AND status <> ALL(${`{${PIPELINE_ATIVO_STATUSES.join(",")}}`}::text[])
       GROUP BY 1`);
    assert.deepEqual(faltando.map((r) => `${r.status} (${r.n})`), [],
      "status de negócio aberto fora da lista: some do relatório em silêncio");
  } finally {
    await fecharConexao();
  }
});

test("as etapas do funil, a probabilidade e os rótulos da tela usam as mesmas chaves", () => {
  const chaves = ETAPAS_DO_FUNIL.map((e) => e.key).sort();
  assert.deepEqual(Object.keys(STAGE_PROB).sort(), chaves,
    "STAGE_PROB e ETAPAS_DO_FUNIL divergem: etapa sem probabilidade vira 0 no forecast");

  // A tela não pode importar daqui (este módulo puxa `db`), então a cópia dela
  // é conferida pelo texto. Rótulo faltando mostra o nome cru da etapa.
  const tela = fs.readFileSync(
    path.join(process.cwd(), "src", "components", "crm2", "relatorios", "TabComercial.tsx"), "utf8");
  const bloco = tela.slice(tela.indexOf("const STAGE_LABELS"), tela.indexOf("};", tela.indexOf("const STAGE_LABELS")));
  const naTela = [...bloco.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]).sort();
  assert.deepEqual(naTela, chaves,
    `a tela rotula [${naTela}] e o funil tem [${chaves}]`);
});
