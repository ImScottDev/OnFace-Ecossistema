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
