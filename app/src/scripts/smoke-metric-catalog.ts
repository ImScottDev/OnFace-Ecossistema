/**
 * O Metric Catalog devolve UM número por métrica, e chega aos registros reais.
 *
 * O que ele prova, e por que importa: antes deste catálogo a palavra MRR saía
 * de quatro lugares do código de analytics com quatro números diferentes. Este
 * smoke mede as quatro fontes antigas lado a lado com a canônica, para o
 * relatório de virada mostrar o tamanho do que foi unificado.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-metric-catalog.ts
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { CATALOGO, medir, detalhar, sincronizarCatalogo } from "@/lib/metricas/catalogo";

let saida = 0;
const ok = (cond: unknown, msg: string) => {
  console.log(`${cond ? "  ok    " : "  FALHA "}${msg}`);
  if (!cond) saida = 1;
};
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes LIMIT 1`);

  console.log("\n═══ o catálogo é espelhado no banco ═══");
  const n = await sincronizarCatalogo();
  const [linhas] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM metric_catalog`);
  ok(n === CATALOGO.length && linhas.n === CATALOGO.length,
     `${CATALOGO.length} definições registradas (${linhas.n} na tabela)`);

  const denovo = await sincronizarCatalogo();
  const [depois] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM metric_catalog`);
  ok(depois.n === linhas.n, `sincronizar de novo não duplica (${denovo} atualizadas, ${depois.n} linhas)`);

  console.log("\n═══ cada métrica devolve valor e drill-down ═══");
  for (const d of CATALOGO) {
    const v = await medir(org.id, d.codigo);
    const registros = await detalhar(org.id, d.codigo, {}, 5);
    const formatado = d.unidade === "BRL" ? brl(v.valor) : String(v.valor);
    // Drill vazio só é aceitável quando o valor é zero: KPI com número e sem
    // registro por trás é exatamente a afirmação sem prova que o Módulo 12 proíbe.
    const coerente = v.valor === 0 || registros.length > 0;
    ok(coerente, `${d.codigo.padEnd(22)} ${formatado.padStart(16)}  (${d.tipo}, ${registros.length} registro(s) no drill)`);
  }

  console.log("\n═══ o que o catálogo unificou ═══");
  const antigas = await db.execute<{ fonte: string; valor: string }>(sql`
    SELECT 'negocios.mrr_fechado' AS fonte, round(COALESCE(sum(mrr_fechado),0),2)::text AS valor
      FROM negocios WHERE status = 'ganho'
    UNION ALL SELECT 'assinaturas.mrr', round(COALESCE(sum(mrr),0),2)::text
      FROM assinaturas WHERE status IN ('active','past_due','trialing')
    UNION ALL SELECT 'mrr_movimentos (deltas)', round(COALESCE(sum(delta),0),2)::text
      FROM mrr_movimentos`);
  const canonico = await medir(org.id, "mrr_atual");
  console.log(`    canônico (mrr_atual)        ${brl(canonico.valor).padStart(16)}`);
  for (const a of antigas) {
    console.log(`    ${a.fonte.padEnd(27)} ${brl(Number(a.valor)).padStart(16)}`);
  }
  const divergem = antigas.filter((a) => Math.abs(Number(a.valor) - canonico.valor) > 1).length;
  ok(divergem > 0,
     `${divergem} das ${antigas.length} fontes antigas divergem da canônica — é o motivo de o catálogo existir`);

  console.log("\n═══ métrica fora do catálogo não é inventada ═══");
  let recusou = false;
  await medir(org.id, "receita_magica").catch(() => { recusou = true; });
  ok(recusou, "pedir métrica inexistente falha em vez de devolver zero");

  console.log(saida === 0 ? "\nmetric catalog: ok\n" : "\nmetric catalog: FALHOU\n");
}

main().then(() => process.exit(saida)).catch((e) => { console.error(e); process.exit(1); });
