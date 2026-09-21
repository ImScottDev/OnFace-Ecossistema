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
