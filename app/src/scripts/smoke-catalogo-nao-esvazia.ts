/**
 * O sync do Stripe não pode esvaziar o catálogo comercial.
 *
 * `sincronizarCatalogoStripe` desativa todo preço cujo `stripe_price_id` não
 * veio na leitura. A regra está certa — preço que sai do Stripe não pode
 * continuar vendável — mas ela não tinha piso.
 *
 * Medido no banco em 22/09: com a lista vazia, o `NOT IN` é verdadeiro para
 * toda linha e o UPDATE desativaria **55 de 55** preços. E `lerCatalogoDoStripe`
 * devolve vazio SEM LANÇAR em pelo menos três caminhos: a conta responde 200 com
 * `data: []` (chave de outro ambiente, produtos arquivados); `ehProdutoDeCatalogo`
 * deixa de casar porque renomearam os produtos no Stripe; ou nenhum preço casa
 * um produto que passou no filtro. Nenhum é exceção.
 *
 * Com `catalogo-stripe-sync` rodando de hora em hora no worker, o desfecho é o
 * construtor de proposta abrir vazio e ninguém conseguir vender — o sintoma que
 * o passo 8 da virada nomeia.
 *
 * Este smoke exercita a função DE VERDADE contra o banco, com catálogos
 * fabricados, e confere que o catálogo real continua de pé depois.
 *
 *     npx tsx --env-file=.env src/scripts/smoke-catalogo-nao-esvazia.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { sincronizarCatalogoStripe } from "@/lib/catalogo/sincronizar-stripe";
import type { CatalogoStripe } from "@/lib/integrations/stripe-catalogo";

let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};

const ativos = async (orgId: string) => {
  const [r] = await db.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM catalogo_precos
     WHERE organizacao_id = ${orgId}::uuid AND ativo = true AND stripe_price_id IS NOT NULL`);
  return r?.n ?? 0;
};

async function main() {
  const [org] = await db.execute<{ id: string; nome: string }>(sql`
    SELECT id::text, nome FROM organizacoes ORDER BY created_at LIMIT 1`);
  const antes = await ativos(org.id);
  console.log(`Organização: ${org.nome} · ${antes} preços ativos com id do Stripe\n`);
  if (antes === 0) {
    console.log("  (sem catálogo sincronizado neste ambiente — nada a proteger)");
    process.exit(0);
  }

  console.log("═══ catálogo vazio não desativa nada ═══");
  const vazio: CatalogoStripe = { produtos: [], precos: [], lidoEm: new Date() };
  const r1 = await sincronizarCatalogoStripe(org.id, vazio);
  ok(r1.precosDesativados === 0, `nenhum preço desativado (${r1.precosDesativados})`);
  ok(await ativos(org.id) === antes, `o catálogo continua com ${antes} preços ativos`);
  ok(r1.pendencias.some((p) => p.oQueFalta.includes("recusada")),
     `a recusa é reportada, não silenciosa: "${r1.pendencias[0]?.oQueFalta ?? "(nenhuma)"}"`);

  console.log("\n═══ leitura parcial (metade do catálogo) também é recusada ═══");
  // Metade dos ids reais: simula a página que faltou ou o filtro que passou a
  // casar só parte dos produtos.
  const reais = await db.execute<{ id: string }>(sql`
    SELECT stripe_price_id AS id FROM catalogo_precos
     WHERE organizacao_id = ${org.id}::uuid AND ativo = true AND stripe_price_id IS NOT NULL`);
  const metade = reais.slice(0, Math.floor(reais.length / 3));
  const parcial: CatalogoStripe = {
    produtos: [], lidoEm: new Date(),
    precos: metade.map((p) => ({
      id: p.id, produtoId: "prod_x", valorCentavos: 0, moeda: "BRL", recorrente: false,
      intervalo: null, intervaloContagem: null, apelido: null, lookupKey: null,
      ativo: true, divideQuantidadePor: null, metadata: {},
    })),
  };
  const r2 = await sincronizarCatalogoStripe(org.id, parcial);
  ok(r2.precosDesativados === 0, `nenhum preço desativado na leitura parcial (${r2.precosDesativados})`);
  ok(await ativos(org.id) === antes, `o catálogo continua com ${antes} preços ativos`);
  ok(r2.pendencias.some((p) => p.oQueFalta.includes("recusado")),
     `a recusa diz o número: "${r2.pendencias.find((p) => p.oQueFalta.includes("recusado"))?.oQueFalta ?? "(nenhuma)"}"`);

  console.log("\n═══ o catálogo real ficou intocado ═══");
  const depois = await ativos(org.id);
  ok(depois === antes, `${antes} antes, ${depois} depois — o smoke não mexeu no catálogo`);

  console.log(saida === 0 ? "\ncatálogo protegido: ok\n" : "\ncatálogo protegido: FALHOU\n");
}

main().then(() => process.exit(saida)).catch((e) => { console.error(e); process.exit(1); });
