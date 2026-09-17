/**
 * Catálogo Oficial Stripe -> CRM2, passo 2 de 2: aplica o snapshot no banco.
 *
 * Idempotente por construção (regra 10 do briefing):
 *   - produto: chave = (organizacao_id, stripe_product_id) -> UPDATE dos campos
 *     controlados pelo CRM, nunca INSERT duplicado;
 *   - price:   chave = (organizacao_id, stripe_price_id)   -> UPDATE ou INSERT;
 *   - rodar de novo N vezes converge pro mesmo estado.
 *
 * O que ele NÃO faz, de propósito:
 *   - não chama o Stripe (nenhuma leitura, nenhuma escrita — os IDs vêm do
 *     snapshot que a planilha preenchida gerou);
 *   - não apaga, arquiva nem reclassifica NENHUMA das 218 linhas de catálogo
 *     legado (regra 9). Elas seguem com origem_catalogo='legado';
 *   - não desativa price que saiu da planilha por padrão — isso mudaria
 *     silenciosamente o que o vendedor pode vender. Só com --desativar-ausentes.
 *
 *   npx tsx --env-file=.env src/scripts/importar-catalogo-oficial.ts [--dry-run] [--desativar-ausentes]
 */
import { db } from "@/lib/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { organizacoes, servicosCatalogo, catalogoPrecos } from "@/lib/db/schema";
import snapshot from "@/lib/db/catalogo/catalogo-oficial.json";

interface PrecoSnapshot {
  stripePriceId: string; sku: string | null; variacao: string; valor: string; moeda: string;
  tipo: string; recorrente: boolean; periodo: string | null; revenueNature: string;
  tipoReceitaPlanilha: string; modeloCobranca: string | null; modeloPrecoStripe: string | null;
  exigeContrato: boolean; descricaoPrice: string | null; lookupKey: string | null;
  observacao: string | null; ordem: number; skuOriginalPlanilha?: string;
}
interface ProdutoSnapshot {
  stripeProductId: string; nome: string; descricao: string | null; descricaoExtrato: string | null;
  etiquetaUnidade: string | null; serviceFamily: string; categoria: string; categoriaLabel: string;
  skuProduto: string; destinoPosVenda: string | null; observacaoOperacional: string | null;
  comoApareceNoCrm: string | null; quantityBehavior: string; ordem: number; precos: PrecoSnapshot[];
}

const dryRun = process.argv.includes("--dry-run");
const desativarAusentes = process.argv.includes("--desativar-ausentes");

/**
 * `commercial_model_padrao` do produto = o modelo mais exigente entre os
 * prices dele. Um produto cujo Setup exige contrato mas cuja Licença não
 * (White Label) nasce como CONTRATO_FIDELIDADE_OPCIONAL no nível do produto,
 * e a decisão fina fica no price — que é onde a regra realmente mora.
 */
function modeloComercialDoProduto(precos: PrecoSnapshot[]): string {
  const todosExigem = precos.every((p) => p.exigeContrato);
  const algumExige = precos.some((p) => p.exigeContrato);
  if (todosExigem && precos.length > 0) return "CONTRATO_OBRIGATORIO";
  if (algumExige) return "CONTRATO_FIDELIDADE_OPCIONAL";
  return "PAGAMENTO_DIRETO";
}

/** `tipo` e `revenue_nature` do produto = os do price principal (o primeiro na ordem comercial). */
function tipoDoProduto(precos: PrecoSnapshot[]): { tipo: string; revenueNature: string; valorSugerido: string | null } {
  const principal = precos[0];
  return {
    tipo: principal?.tipo ?? "recorrente",
    revenueNature: principal?.revenueNature ?? "UNKNOWN",
    // `valor_sugerido` fica sendo o price principal, só pra não deixar o campo
    // legado mentindo. A fonte da verdade do preço passa a ser catalogo_precos.
    valorSugerido: principal?.valor ?? null,
  };
}

/** Unidade legada (`servicos_catalogo.unidade`, enum antigo mensal|hora|unidade|projeto). */
function unidadeLegada(precos: PrecoSnapshot[]): string {
  const p = precos[0];
  if (!p) return "unidade";
  if (p.periodo === "mensal" || p.periodo === "anual") return "mensal";
  if (p.tipo === "setup") return "projeto";
  return "unidade";
}

async function main() {
  const produtos = snapshot.produtos as unknown as ProdutoSnapshot[];
  console.log(`Snapshot: ${snapshot.geradoDe}`);
  console.log(`  ${produtos.length} produtos, ${produtos.reduce((s, p) => s + p.precos.length, 0)} prices`);
  if ((snapshot.avisos as string[])?.length) {
    console.log(`  ${(snapshot.avisos as string[]).length} aviso(s) do snapshot:`);
    for (const a of snapshot.avisos as string[]) console.log(`   ! ${a}`);
  }
  if (dryRun) console.log("\n[DRY RUN] nada será gravado.\n");

  const orgs = await db.select({ id: organizacoes.id, nome: organizacoes.nome }).from(organizacoes);
  if (orgs.length === 0) throw new Error("nenhuma organização no banco");

  for (const org of orgs) {
    console.log(`\n=== ${org.nome} (${org.id})`);
    const agora = new Date();
    let prodNovos = 0, prodAtualizados = 0, precoNovos = 0, precoAtualizados = 0;
    const priceIdsDoSnapshot: string[] = [];

    for (const p of produtos) {
      const dadosProduto = {
        nome: p.nome,
        descricao: p.descricao,
        descricaoExtrato: p.descricaoExtrato,
        etiquetaUnidade: p.etiquetaUnidade,
        serviceFamily: p.serviceFamily,
        categoria: p.categoria,
        skuProduto: p.skuProduto,
        destinoPosVenda: p.destinoPosVenda,
        observacaoOperacional: p.observacaoOperacional,
        quantityBehavior: p.quantityBehavior,
        origemCatalogo: "oficial_stripe",
        commercialModelPadrao: modeloComercialDoProduto(p.precos),
        // `requer_contrato` (coluna legada) e `requires_signature` seguem o
        // mesmo critério: verdadeiro só se TODO price do produto exigir. Onde
        // varia por price (White Label), a decisão fina é do price.
        requerContrato: p.precos.every((x) => x.exigeContrato) && p.precos.length > 0,
        requiresSignature: p.precos.every((x) => x.exigeContrato) && p.precos.length > 0,
        // Toda venda do catálogo oficial gera serviço canônico; entrega é
        // decidida pela família em politica-familia.ts, não aqui.
        createsCanonicalService: true,
        createsFulfillment: true,
        unidade: unidadeLegada(p.precos),
        ...tipoDoProduto(p.precos),
        ativo: true,
        ordem: p.ordem,
        catalogoSincronizadoEm: agora,
        updatedAt: agora,
      };

      const [existente] = await db
        .select({ id: servicosCatalogo.id })
        .from(servicosCatalogo)
        .where(and(eq(servicosCatalogo.organizacaoId, org.id), eq(servicosCatalogo.stripeProductId, p.stripeProductId)))
        .limit(1);

      let produtoId: string;
      if (existente) {
        produtoId = existente.id;
        if (!dryRun) await db.update(servicosCatalogo).set(dadosProduto).where(eq(servicosCatalogo.id, produtoId));
        prodAtualizados++;
      } else if (dryRun) {
        produtoId = "(dry-run)";
        prodNovos++;
      } else {
        const [novo] = await db.insert(servicosCatalogo)
          .values({ organizacaoId: org.id, stripeProductId: p.stripeProductId, ...dadosProduto })
          .returning({ id: servicosCatalogo.id });
        produtoId = novo.id;
        prodNovos++;
      }

      for (const pr of p.precos) {
        priceIdsDoSnapshot.push(pr.stripePriceId);
        const dadosPreco = {
          servicoCatalogoId: produtoId,
          sku: pr.sku,
          lookupKey: pr.lookupKey,
          variacao: pr.variacao,
          descricao: pr.descricaoPrice,
          valor: pr.valor,
          moeda: pr.moeda,
          tipo: pr.tipo,
          recorrente: pr.recorrente,
          periodo: pr.periodo,
          revenueNature: pr.revenueNature,
          modeloCobranca: pr.modeloCobranca,
          modeloPrecoStripe: pr.modeloPrecoStripe,
          exigeContrato: pr.exigeContrato,
          observacao: pr.observacao,
          ativo: true,
          ordem: pr.ordem,
          updatedAt: agora,
        };

        const [precoExistente] = await db
          .select({ id: catalogoPrecos.id })
          .from(catalogoPrecos)
          .where(and(eq(catalogoPrecos.organizacaoId, org.id), eq(catalogoPrecos.stripePriceId, pr.stripePriceId)))
          .limit(1);

        if (precoExistente) {
          if (!dryRun) await db.update(catalogoPrecos).set(dadosPreco).where(eq(catalogoPrecos.id, precoExistente.id));
          precoAtualizados++;
        } else {
          if (!dryRun) {
            await db.insert(catalogoPrecos).values({ organizacaoId: org.id, stripePriceId: pr.stripePriceId, ...dadosPreco });
          }
          precoNovos++;
        }
      }
    }

    // Price que existe no CRM mas saiu da planilha. Desativar por padrão
    // mudaria em silêncio o que o vendedor pode vender, então só reporta —
    // a menos que a flag seja passada de propósito.
    const orfaos = await db
      .select({ id: catalogoPrecos.id, stripePriceId: catalogoPrecos.stripePriceId, variacao: catalogoPrecos.variacao })
      .from(catalogoPrecos)
      .where(and(
        eq(catalogoPrecos.organizacaoId, org.id),
        eq(catalogoPrecos.ativo, true),
        priceIdsDoSnapshot.length > 0 ? sql`${catalogoPrecos.stripePriceId} NOT IN ${priceIdsDoSnapshot}` : sql`true`,
      ));

    console.log(`  produtos: ${prodNovos} criados, ${prodAtualizados} atualizados`);
    console.log(`  prices  : ${precoNovos} criados, ${precoAtualizados} atualizados`);
    if (orfaos.length > 0) {
      console.log(`  ${orfaos.length} price(s) ativo(s) no CRM fora da planilha:`);
      for (const o of orfaos.slice(0, 10)) console.log(`    - ${o.stripePriceId} (${o.variacao})`);
      if (desativarAusentes && !dryRun) {
        await db.update(catalogoPrecos).set({ ativo: false, updatedAt: agora })
          .where(inArray(catalogoPrecos.id, orfaos.map((o) => o.id)));
        console.log(`    -> desativados (--desativar-ausentes)`);
      } else {
        console.log(`    -> mantidos ativos. Use --desativar-ausentes pra desativar.`);
      }
    }
  }

  if (dryRun) { console.log("\n[DRY RUN] nada foi gravado."); return; }

  // Conferência final: o que ficou de fato no banco.
  const resumo = await db.execute<{ familia: string; categoria: string; produtos: number; precos: number }>(sql`
    SELECT sc.service_family AS familia, sc.categoria,
           COUNT(DISTINCT sc.id)::int AS produtos,
           COUNT(cp.id)::int AS precos
    FROM servicos_catalogo sc
    LEFT JOIN catalogo_precos cp ON cp.servico_catalogo_id = sc.id AND cp.ativo
    WHERE sc.origem_catalogo = 'oficial_stripe'
    GROUP BY 1, 2 ORDER BY 1, 2
  `);
  console.log(`\n=== CATÁLOGO OFICIAL NO CRM`);
  console.log(`${"FAMÍLIA".padEnd(14)}${"CATEGORIA".padEnd(14)}${"PRODUTOS".padStart(9)}${"PRICES".padStart(8)}`);
  for (const r of resumo) {
    console.log(`${r.familia.padEnd(14)}${(r.categoria ?? "—").padEnd(14)}${String(r.produtos).padStart(9)}${String(r.precos).padStart(8)}`);
  }
  const [tot] = await db.execute<{ produtos: number; precos: number; legado: number }>(sql`
    SELECT (SELECT COUNT(*)::int FROM servicos_catalogo WHERE origem_catalogo='oficial_stripe') AS produtos,
           (SELECT COUNT(*)::int FROM catalogo_precos WHERE ativo) AS precos,
           (SELECT COUNT(*)::int FROM servicos_catalogo WHERE origem_catalogo='legado') AS legado
  `);
  console.log(`\ntotal oficial: ${tot.produtos} produtos, ${tot.precos} prices`);
  console.log(`legado intocado: ${tot.legado} linhas`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
