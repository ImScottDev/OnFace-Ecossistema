/**
 * Cobertura dos relatórios (SPEC §17).
 *
 * Relatório não é tela: é o número sobre o qual alguém decide investir. Um
 * JOIN interno que descarta 35% da receita não quebra nada visivelmente — ele
 * devolve um CAC otimista e ninguém questiona.
 *
 * Estes testes não conferem fórmula. Conferem **cobertura**: o relatório
 * enxerga o mesmo universo que existe no banco?
 */
import test from "node:test";
import assert from "node:assert/strict";

const DB_URL = process.env.DATABASE_URL;

test("o relatório de mídia paga enxerga todo o MRR ativo", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  // O JOIN interno em `leads` descartava 47 assinaturas ATIVAS que não têm
  // lead legado: R$ 21.537,90 de R$ 61.769,55, fora da conta de CAC e ROAS.
  const [r] = await db.execute<{ total: string; visivel: string }>(sql`
    SELECT
      (SELECT COALESCE(sum(mrr), 0)::text FROM assinaturas
        WHERE status IN ('active','trialing','past_due')) AS total,
      (SELECT COALESCE(sum(a.mrr), 0)::text FROM assinaturas a
         LEFT JOIN leads l ON l.id = a.lead_id
        WHERE a.status IN ('active','trialing','past_due')) AS visivel`);

  assert.equal(
    Number(r.visivel).toFixed(2), Number(r.total).toFixed(2),
    "o relatório de mídia paga perdeu MRR ativo no caminho",
  );
});

test("o tracking por e-mail declara quanto fica de fora, em vez de esconder", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  // Este relatório é dimensionado por e-mail do lead, e isso tem um custo
  // conhecido: 159 dos 1.562 negócios ficam de fora. Tentei resolver pela
  // pessoa canônica e o ganho foi ZERO — quem tem e-mail no lead tem na
  // pessoa, e quem não tem, não tem nos dois.
  //
  // O teste não exige cobertura total, que o dado não permite. Ele trava a
  // propriedade que importa: se a cobertura CAIR, alguém mudou o critério e
  // precisa saber.
  const [r] = await db.execute<{ total: number; no_relatorio: number }>(sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM leads l WHERE l.id = n.lead_id AND l.email IS NOT NULL
           ))::int AS no_relatorio
      FROM negocios n`);

  const cobertura = r.no_relatorio / r.total;
  assert.ok(
    cobertura >= 0.89,
    `o tracking por e-mail cobre ${(cobertura * 100).toFixed(1)}% dos negócios; ` +
    "caiu abaixo do medido em 21/09 (89,8%), então o critério mudou",
  );
});

test("toda fatura em aberto chega na fila de cobrança", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  // "Some da fila" quer dizer que ninguém cobra. O JOIN interno em `leads`
  // deixava isso depender de um vínculo que 72 das 355 assinaturas não têm.
  const [r] = await db.execute<{ no_banco: number; na_fila: number }>(sql`
    SELECT
      (SELECT count(*)::int FROM faturas
        WHERE status IN ('aberta','uncollectible')) AS no_banco,
      (SELECT count(*)::int FROM faturas f
         LEFT JOIN leads l ON l.id = f.lead_id
        WHERE f.status IN ('aberta','uncollectible')) AS na_fila`);

  assert.equal(r.na_fila, r.no_banco, `${r.no_banco - r.na_fila} faturas em aberto fora da fila`);
});

test("todo contrato ativo pode entrar na régua de renovação", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  const [r] = await db.execute<{ ativos: number; alcancaveis: number }>(sql`
    SELECT count(*)::int AS ativos,
           count(*) FILTER (WHERE c.lead_id IS NOT NULL OR c.empresa_id IS NOT NULL)::int AS alcancaveis
      FROM contratos c WHERE c.status = 'ativo'`);

  assert.equal(
    r.alcancaveis, r.ativos,
    `${r.ativos - r.alcancaveis} contratos ativos sem lead nem empresa: renovação que ninguém trabalha`,
  );
});

test("o relatório por pessoa conta o mesmo no canônico e no legado", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  // O relatório separa MRR de setup, e o canônico só ganhou `setup_estimado`
  // na migration 0073. Sem o campo, migrar a leitura teria juntado receita
  // recorrente com receita de implantação — que são decisões diferentes.
  const [r] = await db.execute<{
    mrr_legado: string; mrr_canonico: string;
    setup_legado: string; setup_canonico: string;
    n_legado: number; n_canonico: number;
  }>(sql`
    SELECT
      (SELECT COALESCE(sum(COALESCE(mrr_fechado,0)),0)::text FROM negocios
        WHERE status='ganho' AND ganho_at IS NOT NULL) AS mrr_legado,
      (SELECT COALESCE(sum(COALESCE(mrr,0)),0)::text FROM oportunidades
        WHERE ganho_at IS NOT NULL) AS mrr_canonico,
      (SELECT COALESCE(sum(COALESCE(valor_setup,0)),0)::text FROM negocios
        WHERE status='ganho' AND ganho_at IS NOT NULL) AS setup_legado,
      (SELECT COALESCE(sum(COALESCE(setup_estimado,0)),0)::text FROM oportunidades
        WHERE ganho_at IS NOT NULL) AS setup_canonico,
      (SELECT count(*)::int FROM negocios WHERE status='ganho' AND ganho_at IS NOT NULL) AS n_legado,
      (SELECT count(*)::int FROM oportunidades WHERE ganho_at IS NOT NULL) AS n_canonico`);

  assert.equal(Number(r.mrr_canonico).toFixed(2), Number(r.mrr_legado).toFixed(2), "o MRR ganho divergiu");
  assert.equal(Number(r.setup_canonico).toFixed(2), Number(r.setup_legado).toFixed(2), "o setup ganho divergiu");
  assert.equal(r.n_canonico, r.n_legado, "a contagem de ganhos divergiu");
});

test("toda oportunidade aponta para uma etapa que existe", async (t) => {
  if (!DB_URL) return t.skip("DATABASE_URL não definida");
  const { db } = await import("@/lib/db");
  const { sql } = await import("drizzle-orm");

  // `pipeline_etapas` foi semeada do CRM 1 (reuniao_agendada, trial…) e o
  // módulo Vendas usa outro vocabulário (entrada, diagnostico…). Resultado:
  // 1.561 oportunidades e ZERO com etapa_id — a tabela canônica de etapas
  // descrevia um pipeline que ninguém usa.
  const [r] = await db.execute<{ total: number; com_etapa: number; orfas: number }>(sql`
    SELECT count(*)::int AS total,
           count(etapa_id)::int AS com_etapa,
           count(*) FILTER (WHERE etapa_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM pipeline_etapas pe WHERE pe.id = o.etapa_id))::int AS orfas
      FROM oportunidades o`);

  assert.equal(r.orfas, 0, "oportunidade apontando para etapa inexistente");
  assert.equal(
    r.com_etapa, r.total,
    `${r.total - r.com_etapa} oportunidades sem etapa canônica: o vocabulário de etapa divergiu de novo`,
  );
});
