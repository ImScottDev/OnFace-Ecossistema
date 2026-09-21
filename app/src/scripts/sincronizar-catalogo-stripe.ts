/**
 * Sincroniza o catálogo comercial a partir do Stripe AO VIVO.
 *
 * Substitui `importar-catalogo-oficial.ts`, que lia um snapshot commitado. O
 * motivo está medido: aquele snapshot veio de uma planilha de 02/09 e, em
 * 21/09, **171 dos seus 213 preços já não existiam no Stripe** e 13 novos
 * tinham sido criados. Rodá-lo teria criado 171 preços fantasmas.
 *
 *     pnpm tsx --env-file=.env src/scripts/sincronizar-catalogo-stripe.ts --dry-run
 *     pnpm tsx --env-file=.env src/scripts/sincronizar-catalogo-stripe.ts
 *
 * `--dry-run` lê o Stripe e mostra o que mudaria, sem gravar. É o passo que se
 * roda antes de aplicar em produção.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { lerCatalogoDoStripe } from "@/lib/integrations/stripe-catalogo";
import { sincronizarCatalogoStripe, classificarProduto } from "@/lib/catalogo/sincronizar-stripe";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`\n  ${dryRun ? "SIMULAÇÃO (nada será gravado)" : "SINCRONIZAÇÃO"}\n`);

  const catalogo = await lerCatalogoDoStripe();
  console.log(`  Stripe: ${catalogo.produtos.length} produtos de catálogo, ${catalogo.precos.length} preços`);
  const inativos = catalogo.precos.filter((p) => !p.ativo).length;
  if (inativos) console.log(`          (${inativos} preço(s) inativo(s), que serão desativados aqui também)`);

  const pendencias = catalogo.produtos
    .map((p) => ({ p, c: classificarProduto(p) }))
    .filter((x) => x.c.faltando.length);

  if (pendencias.length) {
    console.log(`\n  PENDÊNCIAS DE METADATA NO STRIPE (${pendencias.length}):\n`);
    for (const { p, c } of pendencias) {
      console.log(`    ${p.nome}`);
      console.log(`      ${p.id}`);
      for (const f of c.faltando) console.log(`      falta: ${f}`);
    }
    console.log("\n  Elas não impedem a sincronização: a família vem do prefixo do nome.");
    console.log("  Mas categoria ausente faz o produto cair fora do agrupamento da tela.\n");
  }

  if (dryRun) {
    const orgs = await db.execute<{ id: string; nome: string }>(sql`
      SELECT id::text, nome FROM organizacoes ORDER BY created_at LIMIT 5`);
    for (const org of orgs) {
      const [atual] = await db.execute<{ n: number }>(sql`
        SELECT count(*)::int AS n FROM servicos_catalogo
         WHERE organizacao_id = ${org.id}::uuid AND origem_catalogo = 'oficial_stripe'`);
      console.log(`  ${org.nome}: tem ${atual.n} produto(s) oficiais hoje, teria ${catalogo.produtos.length}`);
    }
    console.log("\n  Nada foi gravado.\n");
    return;
  }

  const orgs = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM organizacoes ORDER BY created_at`);

  for (const org of orgs) {
    const r = await sincronizarCatalogoStripe(org.id, catalogo);
    console.log(
      `\n  ${org.nome}\n` +
      `    produtos: ${r.produtosCriados} criados, ${r.produtosAtualizados} atualizados\n` +
      `    preços  : ${r.precosCriados} criados, ${r.precosAtualizados} atualizados, ${r.precosDesativados} desativados`,
    );
  }
  console.log("\n  Catálogo sincronizado.\n");
}

main().catch((e) => {
  console.error(`\n  FALHOU: ${e instanceof Error ? e.message : e}\n`);
  process.exitCode = 1;
}).finally(() => process.exit(process.exitCode ?? 0));
