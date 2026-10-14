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
    const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).orderBy(organizacoes.createdAt).limit(1);
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
    const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).orderBy(organizacoes.createdAt).limit(1);
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

/**
 * Booking, Billing, Cash e MRR são QUATRO números (Documento Mestre v0.13,
 * Módulo 06). Até 21/09 a tela do Financeiro juntava três deles:
 *
 *  - "receita prevista" somava `contratos.mrr`, a base não canônica;
 *  - o filtro de produto era `COALESCE(c.produto,'ai')` e NENHUM contrato tem
 *    `produto = 'pabx'`, então a aba PABX mostrava zero em tudo e a aba
 *    Callface AI mostrava os R$ 368.049,69 de PABX como receita própria;
 *  - "recebido" somava o valor de face de fatura com `status = 'paga'`, o que
 *    contava como caixa 10 faturas do Stripe sem pagamento nenhum.
 */
test("os segmentos de MRR somam exatamente o MRR canônico", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  try {
    const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).orderBy(organizacoes.createdAt).limit(1);
    if (!org) return t.skip("nenhuma organização no banco");

    const { getFluxoMes } = await import("./metricas");
    const [total, ai, pabx] = await Promise.all([
      getFluxoMes(org.id), getFluxoMes(org.id, "ai"), getFluxoMes(org.id, "pabx"),
    ]);
    const canonico = (await getMrrAtual(org.id)).total;

    assert.ok(Math.abs(total.receitaPrevista - canonico) < 0.02,
      `o fluxo sem filtro (${total.receitaPrevista}) precisa ser o MRR canônico (${canonico})`);
    assert.ok(Math.abs(ai.receitaPrevista + pabx.receitaPrevista - canonico) < 0.02,
      `ai (${ai.receitaPrevista}) + pabx (${pabx.receitaPrevista}) precisa fechar o canônico (${canonico}). ` +
      `Segmento que não soma significa receita reportada na linha errada.`);
    // O caso concreto que motivou a trava: PABX zerado é o sintoma.
    assert.ok(pabx.receitaPrevista > 0,
      "PABX com MRR zero significa que o filtro de produto voltou a olhar uma coluna vazia");
    // A contagem tem que contar o que o número soma, senão o rótulo mente
    // ("R$ 57.569,70 de 598 assinaturas ativas").
    assert.equal(ai.assinaturasAtivas + pabx.assinaturasAtivas, total.assinaturasAtivas,
      "as assinaturas dos segmentos precisam fechar o total");
    assert.ok(pabx.assinaturasAtivas > 0, "PABX com zero assinaturas repete o defeito do filtro");
  } finally {
    await fecharConexao();
  }
});

test("caixa é pagamento, e fatura paga sem pagamento fica visível", async (t) => {
  if (!process.env.DATABASE_URL) return t.skip("DATABASE_URL não definida");
  try {
    const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).orderBy(organizacoes.createdAt).limit(1);
    if (!org) return t.skip("nenhuma organização no banco");

    const { getFluxoMes } = await import("./metricas");
    const { medir } = await import("@/lib/metricas/catalogo");
    const f = await getFluxoMes(org.id);

    for (const [campo, codigo] of [["recebidoMes", "recebido"], ["faturadoMes", "faturado"]] as const) {
      const cat = await medir(org.id, codigo);
      assert.ok(Math.abs((f[campo] as number) - Number(cat?.valor ?? -1)) < 0.02,
        `${campo} (${f[campo]}) e a métrica "${codigo}" do catálogo (${cat?.valor}) precisam ser o MESMO número`);
    }

    // Reconciliação separada do caixa: somar as duas era o defeito.
    assert.ok(f.reconciliar.valor >= 0 && Number.isFinite(f.reconciliar.faturas),
      "a fatura marcada paga sem pagamento precisa ter casa própria");
  } finally {
    await fecharConexao();
  }
});
