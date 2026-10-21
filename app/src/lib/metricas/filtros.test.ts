/**
 * Filtro de dimensão: chega ao dado, ou avisa que não se aplica.
 *
 * O defeito que estes testes existem para matar é o filtro decorativo — o
 * controle que muda de cor, vai para a URL e não altera consulta nenhuma. Era
 * assim na camada pré-catálogo (a safra era enviada e o handler não lia), e é
 * o tipo de coisa que ninguém percebe porque o número continua "parecendo
 * certo".
 *
 * Por isso aqui não basta o filtro mudar o card: ele tem que mudar o card, o
 * detalhe, a composição e a exportação JUNTOS, pelo mesmo recorte.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { CATALOGO, definicao, medir, detalhar, FiltroNaoSuportado, type Periodo } from "./catalogo";
import { explorar, recorteCompleto } from "./explorar";
import { FILTROS_DIMENSAO } from "./recorte";
import { lerPedido } from "./consulta";

const DB = !!process.env.DATABASE_URL;
const centavos = (n: unknown) => Math.round(Number(n ?? 0) * 100);

async function organizacao(): Promise<string> {
  const [o] = await db.execute<{ id: string }>(sql`SELECT organizacao_id::text AS id FROM cliente_receita_mensal LIMIT 1`);
  return o.id;
}

/** Janela larga o bastante para a métrica ter linhas, respeitando o piso dela. */
function janelaAmpla(codigo: string): Periodo {
  const d = definicao(codigo)!;
  const de = d.explorar.piso ?? new Date("2021-01-01T00:00:00-03:00");
  return d.tipo === "SNAPSHOT" ? {} : { de, ate: new Date("2027-01-01T00:00:00-03:00") };
}

test("toda métrica declara os filtros que sabe aplicar, e a coluna existe no recorte", async (t) => {
  if (!DB) return t.skip("sem DATABASE_URL");
  const org = await organizacao();
  for (const m of CATALOGO) {
    const colunas = FILTROS_DIMENSAO.map((f) => [f, m.filtros[f]] as const).filter(([, c]) => c);
    if (colunas.length === 0) continue;
    // Se a métrica declara a coluna, ela precisa estar no SELECT do recorte —
    // senão o filtro quebra a consulta em vez de filtrar.
    const linhas = await detalhar(org, m.codigo, janelaAmpla(m.codigo), 1);
    if (linhas.length === 0) continue;
    for (const [filtro, coluna] of colunas) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(linhas[0], coluna!),
        `${m.codigo} declara o filtro ${filtro} na coluna "${coluna}", que o recorte não expõe`,
      );
    }
  }
});

test("filtro não declarado devolve FiltroNaoSuportado, nunca um número não filtrado", async (t) => {
  if (!DB) return t.skip("sem DATABASE_URL");
  const org = await organizacao();
  // `faturamento_competencia` vem da planilha e não tem responsável.
  await assert.rejects(
    () => medir(org, "faturamento_competencia", { ...janelaAmpla("faturamento_competencia"), dimensoes: { responsavel: "qualquer-um" } }),
    (e: unknown) => e instanceof FiltroNaoSuportado,
    "pedir responsável numa métrica que não tem deveria falhar alto",
  );
  // E o motivo tem que nomear o filtro, para a tela poder dizer o que não se aplica.
  try {
    await medir(org, "faturamento_competencia", { ...janelaAmpla("faturamento_competencia"), dimensoes: { responsavel: "x" } });
    assert.fail("não lançou");
  } catch (e) {
    assert.match((e as Error).message, /responsável/, "a mensagem precisa nomear o filtro");
  }
});

test("filtrar por responsável muda card, detalhe, composição e exportação pelo mesmo recorte", async (t) => {
  if (!DB) return t.skip("sem DATABASE_URL");
  const org = await organizacao();
  const p = janelaAmpla("oportunidades_criadas");

  const [dono] = await db.execute<{ id: string; n: number }>(sql`
    SELECT responsavel_id::text AS id, count(*)::int AS n
      FROM oportunidades WHERE organizacao_id = ${org}::uuid AND responsavel_id IS NOT NULL
     GROUP BY 1 ORDER BY 2 DESC LIMIT 1`);
  if (!dono) return t.skip("nenhuma oportunidade com responsável");

  const todos = await medir(org, "oportunidades_criadas", p);
  const comFiltro = { ...p, dimensoes: { responsavel: dono.id } };
  const so = await medir(org, "oportunidades_criadas", comFiltro);

  assert.ok(so.valor > 0, "o responsável escolhido tem oportunidades: o filtro não pode zerar");
  assert.ok(so.valor < todos.valor, "filtrar por uma pessoa tem que reduzir o total");

  // Detalhe: toda linha é dela, e a contagem bate com o card.
  const linhas = await detalhar(org, "oportunidades_criadas", comFiltro, 100000);
  assert.equal(linhas.length, Number(so.valor), "card e detalhe divergiram sob filtro");
  for (const l of linhas) assert.equal(String(l.responsavel_id), dono.id, "vazou linha de outro responsável");

  // Exploração: total, composição e exportação enxergam o MESMO recorte.
  const ex = await explorar(org, "oportunidades_criadas", comFiltro, {}, 1, 5);
  assert.ok(ex, "exploração vazia");
  assert.equal(centavos(ex!.total), centavos(so.valor), "o total da exploração divergiu do card");
  const somaDim = (ex!.dimensoes[0]?.itens ?? []).reduce((a, i) => a + i.valor, 0) + (ex!.dimensoes[0]?.outros?.valor ?? 0);
  if (ex!.dimensoes[0]) assert.equal(centavos(somaDim), centavos(so.valor), "a composição não fecha o card sob filtro");

  const csv = await recorteCompleto(org, "oportunidades_criadas", comFiltro, {});
  assert.equal(csv!.linhas.length, Number(so.valor), "a exportação não é o mesmo recorte do card");
});

test("filtro vazio na querystring é ausência de filtro, não filtro por string vazia", async (t) => {
  if (!DB) return t.skip("sem DATABASE_URL");
  const org = await organizacao();
  const semNada = lerPedido("oportunidades_criadas", new URLSearchParams("periodo=tudo"));
  const comVazio = lerPedido("oportunidades_criadas", new URLSearchParams("periodo=tudo&responsavel=&etapa=%20"));
  assert.ok(semNada && comVazio);
  const a = await medir(org, "oportunidades_criadas", semNada.p);
  const b = await medir(org, "oportunidades_criadas", comVazio.p);
  assert.equal(centavos(a.valor), centavos(b.valor), "parâmetro vazio virou filtro e sumiu com os dados");
});

test("a querystring leva o filtro até o recorte, e volta nos metadados da métrica", async (t) => {
  if (!DB) return t.skip("sem DATABASE_URL");
  const pedido = lerPedido("oportunidades_criadas", new URLSearchParams("periodo=tudo&responsavel=abc&etapa=proposta"));
  assert.ok(pedido);
  assert.equal(pedido!.p.dimensoes?.responsavel, "abc");
  assert.equal(pedido!.p.dimensoes?.etapa, "proposta");
  // A tela precisa saber o que esta métrica aceita para desenhar só os filtros certos.
  const d = definicao("oportunidades_criadas")!;
  assert.equal(d.filtros.responsavel, "responsavel_id");
  assert.equal(d.filtros.origem, undefined, "oportunidade não tem origem: a tela não deve oferecer o filtro");
});
