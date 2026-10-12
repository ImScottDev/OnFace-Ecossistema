/**
 * O recorte explorado é um só: card, composição por dimensão, filtro cruzado,
 * paginação e exportação precisam concordar, em centavos.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { explorar, recorteCompleto } from "./explorar";
import { FiltroNaoSuportado } from "./catalogo";
import { janelaDoPeriodo } from "./janela";

const c = (n: number) => Math.round(n * 100);
async function organizacao() {
  const [o] = await db.execute<{ id: string }>(sql`SELECT organizacao_id::text AS id FROM cliente_receita_mensal LIMIT 1`);
  return o.id;
}

test("MRR: composição por família + outros = total, e clicar numa família filtra para exatamente o valor dela", async () => {
  const org = await organizacao();
  const e = (await explorar(org, "mrr_atual", { incluirTestes: true }))!;
  const fam = e.dimensoes.find((x) => x.chave === "familia")!;
  const soma = fam.itens.reduce((a, i) => a + c(i.valor), 0) + c(fam.outros?.valor ?? 0);
  assert.equal(soma, c(e.total), "as fatias não somam o card");
  for (const item of fam.itens) {
    const f = (await explorar(org, "mrr_atual", { incluirTestes: true }, { dim: "familia", valorDim: item.chave }))!;
    assert.equal(c(f.selecionado.valor), c(item.valor), `filtro por ${item.chave} diverge da fatia`);
    assert.equal(f.selecionado.registros, item.registros);
    const exp = (await recorteCompleto(org, "mrr_atual", { incluirTestes: true }, { dim: "familia", valorDim: item.chave }))!;
    assert.equal(exp.linhas.length, item.registros, "a exportação não tem as mesmas linhas da fatia");
    assert.equal(exp.linhas.reduce((a, l) => a + c(Number(l.valor)), 0), c(item.valor));
  }
});

test("paginação: todas as páginas juntas reproduzem o recorte, sem repetir nem perder linha", async () => {
  const org = await organizacao();
  const p = { incluirTestes: true };
  const primeira = (await explorar(org, "mrr_atual", p, {}, 1, 50))!;
  const ids = new Set<string>();
  let soma = 0;
  for (let pg = 1; pg <= primeira.paginas; pg++) {
    const r = (await explorar(org, "mrr_atual", p, { ordem: "valor", sentido: "desc" }, pg, 50))!;
    for (const l of r.linhas) { ids.add(`${l.id}|${l.familia}|${l.origem}`); soma += c(Number(l.valor)); }
  }
  assert.equal(ids.size, primeira.registrosTotal);
  assert.equal(soma, c(primeira.total));
});

test("busca por empresa e coluna fora da lista de permissão não vira SQL", async () => {
  const org = await organizacao();
  const r = (await explorar(org, "mrr_atual", { incluirTestes: true }, { q: "zzzz-nao-existe" }))!;
  assert.equal(r.selecionado.registros, 0);
  assert.equal(c(r.total) > 0, true, "o card não pode mudar com a busca");
  // coluna maliciosa na ordenação é ignorada (cai na ordem padrão) em vez de entrar no SQL
  const ok = await explorar(org, "mrr_atual", { incluirTestes: true }, { ordem: "valor; DROP TABLE usuarios" });
  assert.ok(ok && ok.linhas.length > 0);
  await assert.rejects(() => explorar(org, "mrr_atual", { incluirTestes: true }, { dim: "empresa_id; --", valorDim: "x" }), FiltroNaoSuportado);
});

test("evento: série mensal soma o card; clicar num ponto filtra para o valor do ponto", async () => {
  const org = await organizacao();
  const j = janelaDoPeriodo("tudo");
  const p = { de: j.de, ate: j.ate, incluirTestes: true };
  const [com] = await db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM pagamentos WHERE organizacao_id = ${org}::uuid AND paid_at IS NOT NULL`);
  const e = (await explorar(org, "recebido", p))!;
  assert.ok(e.serie, "evento sem série");
  assert.equal(e.serie!.pontos.reduce((a, x) => a + c(x.valor), 0), c(e.total));
  if (com.n === 0) return; // base local sem pagamentos: a igualdade acima já vale (0 = 0)
  const ponto = e.serie!.pontos[0];
  const de = new Date(`${ponto.inicio}T00:00:00-03:00`);
  const ate = e.serie!.granularidade === "mes"
    ? new Date(Date.UTC(de.getUTCFullYear(), de.getUTCMonth() + 1, 1, 3))
    : new Date(de.getTime() + 86_400_000);
  const f = (await explorar(org, "recebido", p, { de, ate }))!;
  assert.equal(c(f.selecionado.valor), c(ponto.valor));
});

test("faturamento por competência: set/2026 fecha no rodapé da planilha original e a série mensal soma o card", async () => {
  const org = await organizacao();
  // Rodapés das planilhas originais (arquivos preservados em db-export/.../fontes): independentes do banco.
  const RODAPE = { "2026-07": 44537574, "2026-08": 43562664, "2026-09": 51240449 };
  const j = janelaDoPeriodo("custom:2026-07-01:2026-09-30");
  const e = (await explorar(org, "faturamento_competencia", { de: j.de, ate: j.ate, incluirTestes: true }))!;
  assert.equal(e.serie!.granularidade, "mes");
  for (const [mes, esperado] of Object.entries(RODAPE)) {
    const ponto = e.serie!.pontos.find((p) => p.inicio === `${mes}-01`);
    assert.ok(ponto, `competência ${mes} ausente da série`);
    assert.equal(c(ponto!.valor), esperado, `${mes}: a série não bate com o rodapé da planilha`);
  }
  assert.equal(e.serie!.pontos.reduce((a, x) => a + c(x.valor), 0), c(e.total));
  const dim = e.dimensoes.find((d) => d.chave === "familia")!;
  assert.equal(dim.itens.reduce((a, i) => a + c(i.valor), 0) + c(dim.outros?.valor ?? 0), c(e.total));
});

test("faturamento histórico: o card de todo o histórico é a soma dos 67 meses e cada mês aparece", async () => {
  const org = await organizacao();
  const j = janelaDoPeriodo("tudo");
  const e = (await explorar(org, "faturamento_competencia", { de: j.de, ate: j.ate, incluirTestes: true }))!;
  const [oraculo] = await db.execute<{ v: string; n: string }>(sql`SELECT COALESCE(sum(valor),0)::text v, count(DISTINCT competencia)::text n FROM cliente_receita_mensal WHERE organizacao_id = ${org}::uuid`);
  assert.equal(c(e.total), c(Number(oraculo.v)));
  assert.equal(e.serie!.pontos.length, Number(oraculo.n));
  // Clicar num mês filtra para o valor do mês.
  const ponto = e.serie!.pontos[10];
  const f = (await explorar(org, "faturamento_competencia", { de: j.de, ate: j.ate, incluirTestes: true }, { de: new Date(`${ponto.inicio}T00:00:00-03:00`), ate: new Date(`${ponto.inicio.slice(0, 7)}-15T00:00:00-03:00`) }))!;
  assert.equal(c(f.selecionado.valor), c(ponto.valor));
});

test("clientes faturados conta documentos distintos, não linhas", async () => {
  const org = await organizacao();
  const j = janelaDoPeriodo("custom:2026-09-01:2026-09-30");
  const e = (await explorar(org, "clientes_faturados", { de: j.de, ate: j.ate, incluirTestes: true }))!;
  const [o] = await db.execute<{ n: string }>(sql`SELECT count(DISTINCT COALESCE(documento, customer_key))::text n FROM cliente_receita_mensal WHERE organizacao_id = ${org}::uuid AND competencia = '2026-09-01' AND valor > 0`);
  assert.equal(e.selecionado.registros, Number(o.n));
  assert.equal(e.total, Number(o.n));
});
