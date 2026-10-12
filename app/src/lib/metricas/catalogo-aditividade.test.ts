/**
 * Card = soma do detalhe = soma por dimensão, para o MESMO recorte.
 *
 * O oráculo do MRR é calculado à parte, com duas consultas simples e outra
 * forma de escrever a regra, para o teste não repetir a consulta que valida.
 * Roda contra o banco local (cópia de produção); sem DATABASE_URL não há o que provar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { CATALOGO, medir, detalhar, FiltroNaoSuportado } from "./catalogo";
import { FAMILIAS } from "./recorte";

const centavos = (n: unknown) => Math.round(Number(n) * 100);

async function organizacao(): Promise<string> {
  const [o] = await db.execute<{ id: string }>(sql`SELECT organizacao_id::text AS id FROM cliente_receita_mensal LIMIT 1`);
  return o.id;
}

test("MRR: o card é a soma do detalhe inteiro, em centavos", async () => {
  const org = await organizacao();
  const valor = await medir(org, "mrr_atual", { incluirTestes: true });
  const linhas = await detalhar(org, "mrr_atual", { incluirTestes: true }, 1_000_000);
  const soma = linhas.reduce((a, l) => a + centavos(l.valor), 0);
  assert.equal(centavos(valor.valor), soma, "agregado e detalhe divergem");
  assert.ok(linhas.length > 100, "o detalhe veio vazio: o teste não provaria nada");
});

test("MRR: bate com um oráculo independente (fechamento + assinaturas ainda sem fechamento)", async () => {
  const org = await organizacao();
  const [fech] = await db.execute<{ v: string }>(sql`
    SELECT COALESCE(sum(valor),0)::text AS v FROM cliente_receita_mensal
     WHERE organizacao_id = ${org}::uuid AND revenue_nature = 'MRR'
       AND competencia = (SELECT max(competencia) FROM cliente_receita_mensal WHERE organizacao_id = ${org}::uuid)`);
  // Assinatura ativa de cliente cujo fechamento da última competência não tem MRR.
  const [ass] = await db.execute<{ v: string }>(sql`
    SELECT COALESCE(sum(a.mrr),0)::text AS v
      FROM assinaturas a
      JOIN clientes c ON c.empresa_id = a.empresa_id AND c.organizacao_id = a.organizacao_id
     WHERE a.organizacao_id = ${org}::uuid AND a.status = 'active'
       AND a.empresa_id NOT IN (
         SELECT empresa_id FROM cliente_receita_mensal
          WHERE organizacao_id = ${org}::uuid AND revenue_nature = 'MRR' AND empresa_id IS NOT NULL
            AND competencia = (SELECT max(competencia) FROM cliente_receita_mensal WHERE organizacao_id = ${org}::uuid))`);
  const esperado = centavos(fech.v) + centavos(ass.v);
  const v = await medir(org, "mrr_atual", { incluirTestes: true });
  // O oráculo junta clientes por empresa; se uma empresa tiver 2 linhas em `clientes` ele a conta 2x.
  // Por isso compara só quando não há duplicidade (e o teste de duplicidade abaixo diz quando há).
  const [dup] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM (SELECT empresa_id FROM clientes WHERE organizacao_id = ${org}::uuid AND empresa_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1) x`);
  if (dup.n === 0) assert.equal(centavos(v.valor), esperado);
  else assert.ok(centavos(v.valor) <= esperado, "o catálogo não pode passar do oráculo");
});

test("MRR: a soma por família fecha o total (cada empresa+família cai numa família só)", async () => {
  const org = await organizacao();
  const total = await medir(org, "mrr_atual", { incluirTestes: true });
  let somaFamilias = 0;
  for (const familia of FAMILIAS) somaFamilias += centavos((await medir(org, "mrr_atual", { familia, incluirTestes: true })).valor);
  const [semFamilia] = await db.execute<{ v: string }>(sql`
    SELECT COALESCE(sum(t.valor),0)::text AS v FROM (SELECT valor, familia FROM (
      SELECT sum(r.valor) AS valor, COALESCE(r.service_family,'UNKNOWN') AS familia
        FROM cliente_receita_mensal r
       WHERE r.organizacao_id = ${org}::uuid AND r.revenue_nature = 'MRR'
         AND r.competencia = (SELECT max(competencia) FROM cliente_receita_mensal WHERE organizacao_id = ${org}::uuid)
       GROUP BY 2) z WHERE familia = 'UNKNOWN') t`);
  // As assinaturas sem família conhecida entram no total mas em nenhuma das três famílias: é a lacuna declarada.
  const naoFamilia = centavos(total.valor) - somaFamilias;
  assert.ok(naoFamilia >= centavos(semFamilia.v), `total - famílias = ${naoFamilia / 100} deveria cobrir o 'sem família' ${semFamilia.v}`);
});

test("testes marcados saem do total por padrão e voltam com incluirTestes; nada é apagado", async () => {
  const org = await organizacao();
  const [e] = await db.execute<{ id: string }>(sql`
    INSERT INTO empresas (organizacao_id, nome) VALUES (${org}::uuid, ${"[QA] aditividade " + Date.now()}) RETURNING id::text`);
  try {
    await db.execute(sql`INSERT INTO cliente_receita_mensal (organizacao_id, empresa_id, customer_key, cliente_nome, competencia, valor, revenue_nature, service_family, source, source_hash)
      VALUES (${org}::uuid, ${e.id}::uuid, 'qa-aditividade', '[QA] aditividade', (SELECT max(competencia) FROM cliente_receita_mensal), 1234.56, 'MRR', 'PABX', 'teste', ${"qa-" + Date.now()})`);
    const padrao = await medir(org, "mrr_atual", {});
    const comTestes = await medir(org, "mrr_atual", { incluirTestes: true });
    assert.equal(centavos(comTestes.valor) - centavos(padrao.valor), 123456);
    const linhasPadrao = await detalhar(org, "mrr_atual", {}, 1_000_000);
    assert.equal(linhasPadrao.some((l) => l.id === e.id), false);
  } finally {
    await db.execute(sql`DELETE FROM cliente_receita_mensal WHERE empresa_id = ${e.id}::uuid`);
    await db.execute(sql`DELETE FROM empresas WHERE id = ${e.id}::uuid`);
  }
});

test("toda métrica aditiva: card = soma do detalhe; filtro sem suporte avisa em vez de ignorar", async () => {
  const org = await organizacao();
  const de = new Date("2026-09-01T03:00:00Z"), ate = new Date("2026-10-01T03:00:00Z");
  for (const m of CATALOGO) {
    const p = { de, ate, incluirTestes: true };
    const v = await medir(org, m.codigo, p);
    const linhas = await detalhar(org, m.codigo, p, 1_000_000);
    const soma = m.agregacao === "soma" ? linhas.reduce((a, l) => a + centavos(l.valor), 0) : linhas.length * 100;
    assert.equal(centavos(v.valor), soma, `${m.codigo}: card diverge do detalhe`);
    if (!m.filtros.familia) {
      await assert.rejects(() => medir(org, m.codigo, { ...p, familia: "PABX" }), FiltroNaoSuportado, `${m.codigo} aceitou um filtro que não aplica`);
    }
  }
});
