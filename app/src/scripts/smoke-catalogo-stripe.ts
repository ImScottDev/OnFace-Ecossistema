/**
 * Sincronização do catálogo do Stripe, contra o banco de verdade (SPEC §23).
 *
 * A fixture é o catálogo REAL lido da conta live em 21/09: 15 produtos e 55
 * preços. Não é dado inventado para o teste passar — é o que o Stripe tinha
 * naquele instante, e por isso ele exerce os casos chatos de verdade: preço
 * sem apelido, preço sem lookup_key, produto com metadata faltando e produto
 * com metadata trocada entre campos.
 *
 * O contraste que motivou tudo isto: o snapshot commitado (de uma planilha de
 * 02/09) tinha 213 preços, e **171 deles já não existiam no Stripe** 19 dias
 * depois.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-catalogo-stripe.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { sincronizarCatalogoStripe, familiaPeloNome, classificarProduto } from "@/lib/catalogo/sincronizar-stripe";
import type { CatalogoStripe } from "@/lib/integrations/stripe-catalogo";
import fixture from "@/lib/catalogo/__fixtures__/stripe-live-21set.json";

const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok  " : "  FALHA  "}${msg}`);
  if (!cond) process.exitCode = 1;
};

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);

  // A regra de família, que é do Kauã e não minha.
  ok(familiaPeloNome("Callface AI White Label - Setup") === "WHITE_LABEL",
     "White Label é testado ANTES de Callface AI (o nome dele começa igual)");
  ok(familiaPeloNome("Callface AI - Full") === "CALLFACE_AI", "Callface AI pelo prefixo");
  ok(familiaPeloNome("PABX - Ramal") === "PABX", "PABX pelo prefixo");
  ok(familiaPeloNome("SETUP") === null, "produto legado nao entra no catálogo novo");

  // Os dois produtos com metadata quebrada no Stripe têm que virar PENDÊNCIA.
  const starter = fixture.produtos.find((p) => p.nome === "Callface AI - Starter")!;
  const business = fixture.produtos.find((p) => p.nome === "Callface AI - Business")!;
  const cs = classificarProduto(starter as never);
  const cb = classificarProduto(business as never);
  ok(cs.familia === "CALLFACE_AI", "Starter ganha família pelo nome, mesmo sem metadata");
  ok(cs.faltando.length > 0, `e é reportado como pendente (${cs.faltando.length} item(ns))`);
  ok(cb.faltando.some((f) => f.includes("período")),
     "Business acusa categoria com valor de período (metadata deslocada)");

  const antes = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM catalogo_precos WHERE organizacao_id = ${org.id}::uuid`);

  const r = await sincronizarCatalogoStripe(org.id, { ...fixture, lidoEm: new Date() } as CatalogoStripe);

  console.log(`\n  produtos: ${r.produtosCriados} criados, ${r.produtosAtualizados} atualizados`);
  console.log(`  preços  : ${r.precosCriados} criados, ${r.precosAtualizados} atualizados, ${r.precosDesativados} desativados`);
  console.log(`  pendências: ${r.pendencias.length}\n`);
  for (const p of r.pendencias) console.log(`    ${p.produto}: ${p.oQueFalta}`);
  console.log();

  ok(r.produtosCriados + r.produtosAtualizados === 15, "os 15 produtos do catálogo entram");
  ok(r.precosCriados + r.precosAtualizados === 55, "os 55 preços entram");
  ok(r.pendencias.length === 2, `exatamente os 2 produtos com metadata quebrada (${r.pendencias.length})`);

  // O que o construtor de proposta enxerga é a pergunta que importa.
  const [visivel] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM servicos_catalogo s
     JOIN catalogo_precos p ON p.servico_catalogo_id = s.id
    WHERE s.organizacao_id = ${org.id}::uuid AND s.origem_catalogo = 'oficial_stripe'
      AND s.ativo AND p.ativo`);
  ok(visivel.n === 55, `o construtor de proposta passa a ver ${visivel.n} itens (era 0)`);

  const [semFamilia] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM servicos_catalogo
     WHERE organizacao_id = ${org.id}::uuid AND origem_catalogo = 'oficial_stripe'
       AND service_family IS NULL`);
  ok(semFamilia.n === 0, "nenhum produto fica sem família: o prefixo do nome cobre");

  // Idempotência: rodar de novo não duplica nada.
  const r2 = await sincronizarCatalogoStripe(org.id, { ...fixture, lidoEm: new Date() } as CatalogoStripe);
  ok(r2.produtosCriados === 0 && r2.precosCriados === 0,
     "rodar de novo não cria nada (idempotente por id do Stripe)");
  ok(r2.precosDesativados === 0, "e não desativa o que acabou de sincronizar");

  // O catálogo legado não pode PERDER linha. Pode perder classificação: dois
  // produtos (Full e Starter) já existiam lá com o MESMO stripe_product_id dos
  // novos, e a sincronização os reclassificou em vez de criar uma segunda
  // linha para o mesmo produto do Stripe. Deduplicar é o comportamento certo;
  // o que não pode é sumir.
  const [total] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM servicos_catalogo WHERE organizacao_id = ${org.id}::uuid`);
  const [reclassificados] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM servicos_catalogo
     WHERE organizacao_id = ${org.id}::uuid AND origem_catalogo = 'oficial_stripe'
       AND created_at < now() - interval '1 hour'`);
  const [oficiais] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM servicos_catalogo
     WHERE organizacao_id = ${org.id}::uuid AND origem_catalogo = 'oficial_stripe'`);

  ok(oficiais.n === 15, `os 15 produtos do Stripe estão no catálogo oficial (${oficiais.n})`);
  ok(reclassificados.n === 2,
     `${reclassificados.n} já existiam no legado com o mesmo id do Stripe e foram reclassificados, não duplicados`);
  ok(total.n === 220 + 15 - reclassificados.n,
     `nenhuma linha foi perdida: ${total.n} = 220 legadas + 15 do Stripe - ${reclassificados.n} que eram a mesma coisa`);

  const [duplicados] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM (
      SELECT stripe_product_id FROM servicos_catalogo
       WHERE organizacao_id = ${org.id}::uuid AND stripe_product_id IS NOT NULL
       GROUP BY 1 HAVING count(*) > 1) x`);
  ok(duplicados.n === 0, "nenhum produto do Stripe aparece duas vezes no catálogo");

  console.log(`\n  antes: ${antes[0].n} preços · depois: ${visivel.n}\n`);
  console.log(process.exitCode ? "smoke do catálogo: FALHOU\n" : "smoke do catálogo: ok\n");
}

main().catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => process.exit(process.exitCode ?? 0));
