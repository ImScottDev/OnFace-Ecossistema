/**
 * Classificação do catálogo LEGADO — script idempotente, 100% não-destrutivo.
 *
 * O que faz: varre os nomes de produto que existem no histórico (contratos,
 * faturas, catálogo legado, propostas), classifica cada um por família /
 * natureza de receita / categoria / produto canônico sugerido, e faz upsert em
 * `catalogo_mapeamentos_legacy` — a camada de mapeamento que JÁ EXISTIA (193
 * linhas), só estava mal preenchida.
 *
 * O que NÃO faz, por regra explícita do briefing:
 *   - não apaga nem renomeia produto legado;
 *   - não altera contrato, assinatura, fatura ou serviço canônico;
 *   - não migra assinatura ativa nem troca produto antigo por novo;
 *   - não torna item legado vendável (`active_selectable` fica false).
 *
 * Idempotente: chave (organizacao_id, legacy_product_id = nome normalizado).
 * Rodar de novo reconverge. `reviewed_status='revisado'` é PRESERVADO — uma
 * decisão humana nunca é sobrescrita por reprocessamento automático.
 *
 *   npx tsx --env-file=.env src/scripts/classificar-catalogo-legado.ts [--dry-run]
 */
import { db } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";
import { organizacoes, catalogoMapeamentosLegacy, servicosCatalogo } from "@/lib/db/schema";
import { classificarLegado, normalizar, totalNomesLegadoIndexados } from "@/lib/crm/classificar-legado";

const dryRun = process.argv.includes("--dry-run");

type NomeLegado = { nome: string; fontes: string; ocorrencias: number };

async function main() {
  const [org] = await db.select({ id: organizacoes.id, nome: organizacoes.nome }).from(organizacoes).limit(1);
  if (!org) throw new Error("nenhuma organização no banco");

  console.log(`Organização: ${org.nome}`);
  console.log(`Nomes legados indexados da planilha oficial: ${totalNomesLegadoIndexados()}`);
  if (dryRun) console.log("\n[DRY RUN] nada será gravado.\n");

  // Todas as fontes reais onde um nome de produto legado aparece. Agregado por
  // nome, com as fontes e a contagem — a contagem é o que ordena a fila de
  // revisão humana (revisar primeiro o que impacta mais linhas).
  const nomes = await db.execute<NomeLegado>(sql`
    WITH nomes AS (
      SELECT nome, 'contrato_itens' AS fonte FROM contrato_itens WHERE nome IS NOT NULL AND btrim(nome) <> ''
      UNION ALL SELECT descricao, 'fatura_itens' FROM fatura_itens WHERE descricao IS NOT NULL AND btrim(descricao) <> ''
      UNION ALL SELECT nome, 'servicos_catalogo' FROM servicos_catalogo WHERE origem_catalogo = 'legado' AND nome IS NOT NULL
      UNION ALL SELECT nome, 'proposta_itens' FROM proposta_itens WHERE nome IS NOT NULL AND btrim(nome) <> ''
    )
    SELECT nome, string_agg(DISTINCT fonte, ',' ORDER BY fonte) AS fontes, COUNT(*)::int AS ocorrencias
    FROM nomes GROUP BY nome ORDER BY COUNT(*) DESC
  `);
  console.log(`Nomes distintos no histórico: ${nomes.length}`);

  /**
   * Agrupa por nome NORMALIZADO antes de gravar: "SETUP", "Setup " e "setup"
   * são o mesmo item legado, gravados com caixa/espaço diferentes no Zoho.
   * Sem isso a mesma linha de mapeamento seria escrita várias vezes e a
   * contagem de ocorrências (que ordena a fila de revisão) ficaria errada.
   */
  const agrupados = new Map<string, { nome: string; fontes: Set<string>; ocorrencias: number; variantes: number }>();
  for (const n of nomes) {
    const chave = normalizar(n.nome);
    if (!chave) continue;
    const atual = agrupados.get(chave);
    if (atual) {
      atual.ocorrencias += n.ocorrencias;
      atual.variantes += 1;
      for (const f of n.fontes.split(",")) atual.fontes.add(f);
    } else {
      agrupados.set(chave, { nome: n.nome, fontes: new Set(n.fontes.split(",")), ocorrencias: n.ocorrencias, variantes: 1 });
    }
  }
  const variantesColapsadas = nomes.length - agrupados.size;
  console.log(`Itens legados únicos (nome normalizado): ${agrupados.size}${variantesColapsadas > 0 ? ` — ${variantesColapsadas} variante(s) de caixa/espaço colapsada(s)` : ""}`);

  // Produto oficial por stripe_product_id — pra apontar canonical_product_id
  // real quando a planilha declara o vínculo.
  const oficiais = await db
    .select({ id: servicosCatalogo.id, stripeProductId: servicosCatalogo.stripeProductId })
    .from(servicosCatalogo)
    .where(and(eq(servicosCatalogo.organizacaoId, org.id), eq(servicosCatalogo.origemCatalogo, "oficial_stripe")));
  const idPorProduct = new Map(oficiais.filter((o) => o.stripeProductId).map((o) => [o.stripeProductId!, o.id]));

  /**
   * As 193 linhas que já existiam usam o ID REAL do produto no Zoho como
   * `legacy_product_id` (ex: 5938068000001434202) — rastreabilidade melhor que
   * qualquer chave derivada de nome, e que não pode ser perdida. Então o match
   * é feito pelo NOME normalizado, e a linha existente é ATUALIZADA mantendo o
   * id do Zoho. Só nome sem linha correspondente gera registro novo, aí com a
   * chave `nome:<normalizado>` — prefixada pra nunca ser confundida com um id
   * do Zoho.
   */
  const existentes = await db
    .select({
      id: catalogoMapeamentosLegacy.id,
      legacyProductId: catalogoMapeamentosLegacy.legacyProductId,
      legacyName: catalogoMapeamentosLegacy.legacyName,
      reviewedStatus: catalogoMapeamentosLegacy.reviewedStatus,
    })
    .from(catalogoMapeamentosLegacy)
    .where(eq(catalogoMapeamentosLegacy.organizacaoId, org.id));
  const porNomeNormalizado = new Map<string, (typeof existentes)[number]>();
  for (const e of existentes) {
    const k = normalizar(e.legacyName || "");
    if (k && !porNomeNormalizado.has(k)) porNomeNormalizado.set(k, e);
  }
  console.log(`Mapeamentos que já existiam: ${existentes.length} (${porNomeNormalizado.size} com nome único, chave = id do Zoho)`);

  const agora = new Date();
  let criados = 0, atualizados = 0, preservados = 0;
  const porConfianca = new Map<string, number>();
  const porFamilia = new Map<string, number>();

  for (const [chave, n] of agrupados) {
    const c = classificarLegado(n.nome);
    porConfianca.set(c.confidence, (porConfianca.get(c.confidence) ?? 0) + 1);
    porFamilia.set(c.serviceFamily, (porFamilia.get(c.serviceFamily) ?? 0) + 1);

    const existente = porNomeNormalizado.get(chave);

    // Decisão humana nunca é sobrescrita por reprocessamento.
    if (existente?.reviewedStatus === "revisado") { preservados++; continue; }

    const dados = {
      legacyName: n.nome,
      legacySource: [...n.fontes].sort().join(","),
      ocorrencias: n.ocorrencias,
      serviceFamily: c.serviceFamily,
      defaultRevenueNature: c.revenueNature,
      categoriaCrm: c.categoriaCrm,
      canonicalName: c.canonicalName,
      canonicalProductId: c.canonicalStripeProductId ? idPorProduct.get(c.canonicalStripeProductId) ?? null : null,
      confidence: c.confidence,
      ruleSource: c.ruleSource,
      evidence: c.evidencia,
      notes: c.revenueNature === "ADJUSTMENT" ? "Lançamento financeiro — não vendável, não conta no portfólio." : null,
      // Legado NUNCA é vendável: proposta nova usa só o catálogo oficial.
      activeSelectable: false,
      historicalOnly: true,
      classificadoEm: agora,
      updatedAt: agora,
    };

    if (existente) {
      if (!dryRun) await db.update(catalogoMapeamentosLegacy).set(dados).where(eq(catalogoMapeamentosLegacy.id, existente.id));
      atualizados++;
    } else {
      if (!dryRun) await db.insert(catalogoMapeamentosLegacy).values({ organizacaoId: org.id, legacyProductId: `nome:${chave}`, ...dados });
      criados++;
    }
  }

  console.log(`\nmapeamentos: ${criados} criados, ${atualizados} atualizados, ${preservados} preservados (já revisados por humano)`);
  console.log("\npor confiança:");
  for (const c of ["CONFIRMED", "PROBABLE", "AMBIGUOUS", "UNRESOLVED"]) {
    const v = porConfianca.get(c) ?? 0;
    console.log(`  ${String(v).padStart(4)}  ${c}${v > 0 ? ` (${((v / agrupados.size) * 100).toFixed(1)}%)` : ""}`);
  }
  console.log("por família:");
  for (const [k, v] of [...porFamilia.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);

  if (dryRun) { console.log("\n[DRY RUN] nada foi gravado."); return; }
  await relatorio(org.id);
}

/**
 * Visão agregada pedida no briefing. Tudo vem de `servicos_canonicos`, que é a
 * fonte da verdade fechada do portfólio — nunca de SUM(contratos.mrr), que é o
 * bug conhecido do /api/carteira legado.
 */
async function relatorio(organizacaoId: string) {
  console.log("\n══════ VISÃO AGREGADA POR FAMÍLIA (serviços canônicos, portfólio) ══════\n");
  const porFamilia = await db.execute<{ familia: string; servicos: number; clientes: number; mrr: string; nao_recorrente: string }>(sql`
    SELECT sc.service_family AS familia,
           COUNT(*)::int AS servicos,
           COUNT(DISTINCT sc.empresa_id)::int AS clientes,
           COALESCE(SUM(CASE WHEN sc.revenue_nature = 'MRR' THEN sc.current_recurring_value ELSE 0 END), 0)::text AS mrr,
           COALESCE(SUM(CASE WHEN sc.revenue_nature <> 'MRR' THEN sc.current_recurring_value ELSE 0 END), 0)::text AS nao_recorrente
    FROM servicos_canonicos sc
    WHERE sc.organizacao_id = ${organizacaoId} AND sc.portfolio_included = true
    GROUP BY 1 ORDER BY 4 DESC
  `);
  const brl = (v: string) => `R$ ${parseFloat(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  console.log(`${"FAMÍLIA".padEnd(14)}${"SERVIÇOS".padStart(9)}${"CLIENTES".padStart(10)}${"MRR".padStart(18)}`);
  let totalMrr = 0;
  for (const r of porFamilia) {
    totalMrr += parseFloat(r.mrr);
    console.log(`${r.familia.padEnd(14)}${String(r.servicos).padStart(9)}${String(r.clientes).padStart(10)}${brl(r.mrr).padStart(18)}`);
  }
  console.log(`${"TOTAL".padEnd(14)}${"".padStart(19)}${brl(String(totalMrr)).padStart(18)}`);

  // Setup/avulso por família vem do HISTÓRICO classificado (contratos e
  // faturas), não de servicos_canonicos: hoje 100% dos serviços canônicos são
  // MRR — setup e avulso nunca foram materializados como serviço.
  console.log("\n── Setup / avulso / hardware por família (histórico classificado)\n");
  const naoRecorrente = await db.execute<{ familia: string; natureza: string; itens: number; valor: string }>(sql`
    SELECT m.service_family AS familia, m.default_revenue_nature AS natureza,
           COUNT(*)::int AS itens, COALESCE(SUM(ci.subtotal), 0)::text AS valor
    FROM contrato_itens ci
    JOIN catalogo_mapeamentos_legacy m
      ON m.organizacao_id = ${organizacaoId}
     AND m.nome_normalizado = normalizar_nome_produto(ci.nome)
    WHERE m.default_revenue_nature IN ('SETUP','ONE_TIME','HARDWARE','USAGE','ADJUSTMENT')
    GROUP BY 1, 2 ORDER BY 1, 2
  `);
  if (naoRecorrente.length === 0) console.log("  (nenhum item de contrato casou com a classificação)");
  else {
    console.log(`${"FAMÍLIA".padEnd(14)}${"NATUREZA".padEnd(12)}${"ITENS".padStart(7)}${"VALOR".padStart(16)}`);
    for (const r of naoRecorrente) console.log(`${r.familia.padEnd(14)}${r.natureza.padEnd(12)}${String(r.itens).padStart(7)}${brl(r.valor).padStart(16)}`);
  }

  // Cobertura: quantos itens do histórico passam a ter família consultável.
  console.log("\n── Cobertura da classificação sobre o histórico\n");
  const cobertura = await db.execute<{ fonte: string; total: number; classificados: number; confirmados: number }>(sql`
    WITH itens AS (
      SELECT 'contrato_itens' AS fonte, nome FROM contrato_itens WHERE nome IS NOT NULL
      UNION ALL SELECT 'fatura_itens', descricao FROM fatura_itens WHERE descricao IS NOT NULL
      UNION ALL SELECT 'proposta_itens', nome FROM proposta_itens WHERE nome IS NOT NULL
    )
    SELECT i.fonte, COUNT(*)::int AS total,
           COUNT(m.id) FILTER (WHERE m.service_family <> 'UNKNOWN')::int AS classificados,
           COUNT(m.id) FILTER (WHERE m.confidence = 'CONFIRMED')::int AS confirmados
    FROM itens i
    LEFT JOIN catalogo_mapeamentos_legacy m
      ON m.organizacao_id = ${organizacaoId}
     AND m.nome_normalizado = normalizar_nome_produto(i.nome)
    GROUP BY 1 ORDER BY 1
  `);
  console.log(`${"FONTE".padEnd(18)}${"LINHAS".padStart(8)}${"COM FAMÍLIA".padStart(13)}${"CONFIRMADAS".padStart(13)}`);
  for (const r of cobertura) {
    const pct = r.total > 0 ? ((r.classificados / r.total) * 100).toFixed(0) : "0";
    console.log(`${r.fonte.padEnd(18)}${String(r.total).padStart(8)}${`${r.classificados} (${pct}%)`.padStart(13)}${String(r.confirmados).padStart(13)}`);
  }

  console.log("\n── Fila de revisão humana (baixa confiança, mais impacto primeiro)\n");
  const revisar = await db
    .select({
      nome: catalogoMapeamentosLegacy.legacyName,
      familia: catalogoMapeamentosLegacy.serviceFamily,
      categoria: catalogoMapeamentosLegacy.categoriaCrm,
      confianca: catalogoMapeamentosLegacy.confidence,
      ocorrencias: catalogoMapeamentosLegacy.ocorrencias,
      fontes: catalogoMapeamentosLegacy.legacySource,
    })
    .from(catalogoMapeamentosLegacy)
    .where(and(
      eq(catalogoMapeamentosLegacy.organizacaoId, organizacaoId),
      eq(catalogoMapeamentosLegacy.reviewedStatus, "pendente"),
      sql`${catalogoMapeamentosLegacy.confidence} IN ('AMBIGUOUS','UNRESOLVED')`,
    ))
    .orderBy(sql`${catalogoMapeamentosLegacy.ocorrencias} DESC`)
    .limit(30);
  const [{ n: totalRevisar }] = await db.select({ n: sql<number>`count(*)::int` })
    .from(catalogoMapeamentosLegacy)
    .where(and(
      eq(catalogoMapeamentosLegacy.organizacaoId, organizacaoId),
      eq(catalogoMapeamentosLegacy.reviewedStatus, "pendente"),
      sql`${catalogoMapeamentosLegacy.confidence} IN ('AMBIGUOUS','UNRESOLVED')`,
    ));
  console.log(`${totalRevisar} item(ns) pedindo olho humano. Top ${revisar.length}:`);
  for (const r of revisar) {
    console.log(`  ${String(r.ocorrencias).padStart(4)}x  [${r.confianca.padEnd(10)}] ${(r.nome || "").slice(0, 46).padEnd(46)} ${r.categoria ?? "—"}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
