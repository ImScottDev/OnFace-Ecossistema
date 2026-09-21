/**
 * As duas leituras de meta não podem discordar.
 *
 * `getMetaComercialAgregada` e `getMetasPorVendedor` leem a MESMA tabela para
 * o MESMO mês. Em 21/09 a agregada devolvia R$ 50.000,00 para duas closers e a
 * por-vendedor devolvia **zero** para as mesmas duas.
 *
 * A causa: `metaTipoPorPapel("closer")` devolve `faturamento_fechado`, e as 9
 * metas cadastradas são do tipo aposentado `mrr_fechado`. A agregada já tinha
 * o fallback de tipo legado, com comentário explicando; a por-vendedor não.
 * Correção aplicada numa leitura e não na irmã.
 *
 * O efeito visível era o Insight Engine não gerar nada: ele recebe
 * `valorAlvo` de `getMetasPorVendedor`, e com tudo zerado não havia insight.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { db, fecharConexao } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { getMetaComercialAgregada, getMetasPorVendedor } from "@/lib/metas";

test("a soma das metas por vendedor bate com a meta agregada", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  try {
    const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
    if (!org) return t.skip("nenhuma organização no banco");

    const hoje = new Date();
    const mes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const [agregada, porVendedor] = await Promise.all([
      getMetaComercialAgregada(org.id, mes),
      getMetasPorVendedor(org.id),
    ]);
    if (!agregada || agregada.valorAlvo === 0) return t.skip("nenhuma meta no mês corrente");

    // A agregada soma só closers; a por-vendedor traz closer, sdr e vendedor.
    const somaClosers = porVendedor
      .filter((v) => v.role === "closer" && v.valorAlvo > 0)
      .reduce((s, v) => s + v.valorAlvo, 0);

    assert.equal(somaClosers, agregada.valorAlvo,
      `soma por vendedor (${somaClosers}) e meta agregada (${agregada.valorAlvo}) discordam: ` +
      `uma das duas leituras perdeu o fallback de tipo legado`);
  } finally {
    await fecharConexao();
  }
});

test("meta cadastrada no mês vira alvo maior que zero", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  try {
    const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
    if (!org) return t.skip("nenhuma organização no banco");

    const { sql } = await import("drizzle-orm");
    const [m] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM metas
       WHERE organizacao_id = ${org.id}::uuid
         AND periodo = date_trunc('month', now())::date`);
    if (!m || m.n === 0) return t.skip("nenhuma meta cadastrada no mês corrente");

    const comAlvo = (await getMetasPorVendedor(org.id)).filter((v) => v.valorAlvo > 0);
    assert.ok(comAlvo.length > 0,
      `há ${m.n} metas cadastradas no mês e nenhum vendedor com alvo: o tipo da meta ` +
      `no banco não casa com o que a leitura procura`);
  } finally {
    await fecharConexao();
  }
});
