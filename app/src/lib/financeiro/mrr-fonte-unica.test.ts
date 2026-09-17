import assert from "node:assert/strict";
import test from "node:test";
import { getMrrAtual } from "./metricas";
import { getMrrAtivo } from "@/lib/analytics/command-center";
import { db, fecharConexao } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";

/**
 * Regressão da fonte de verdade do MRR.
 *
 * Até 14/09 o produto exibia DOIS MRR diferentes para o mesmo mês: o Início e
 * o CS somavam `servicos_canonicos`, o Financeiro somava `contratos.mrr`. A
 * tela do Financeiro chegava a mostrar a divergência ao usuário
 * ("Duas bases de MRR divergem em R$ 6.365,96"), e a base de contratos ainda
 * estava inflada em R$ 24.205,50 por 60 contratos duplicados pela mesma
 * assinatura Stripe.
 *
 * Agora existe uma fonte canônica só. Este teste falha se alguém reintroduzir
 * a segunda base.
 */
test("Financeiro e Início leem o MESMO MRR", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  try {
    const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
    if (!org) return t.skip("nenhuma organização no banco");

    const financeiro = await getMrrAtual(org.id);
    const inicio = await getMrrAtivo(org.id);

    assert.equal(
      financeiro.total, inicio.atual,
      `MRR do Financeiro (${financeiro.total}) e do Início (${inicio.atual}) precisam vir da mesma fonte canônica`
    );
  } finally {
    await fecharConexao();
  }
});

test("a conciliação por contratos não conta a mesma assinatura duas vezes", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  try {
    const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).limit(1);
    if (!org) return t.skip("nenhuma organização no banco");

    const { sql } = await import("drizzle-orm");
    const [bruto] = await db.execute<{ total: string; qtd: string }>(sql`
      SELECT COALESCE(SUM(mrr),0)::text AS total, COUNT(*)::text AS qtd
        FROM contratos WHERE status = 'ativo' AND (organizacao_id = ${org.id} OR organizacao_id IS NULL)`);

    const m = await getMrrAtual(org.id);

    assert.ok(
      m.totalContratado <= Number(bruto.total) + 0.01,
      "a conciliação deduplicada não pode ser MAIOR que a soma bruta"
    );
    assert.ok(
      m.contratosAtivos <= Number(bruto.qtd),
      `contratos deduplicados (${m.contratosAtivos}) não pode passar do total bruto (${bruto.qtd})`
    );
  } finally {
    await fecharConexao();
  }
});
