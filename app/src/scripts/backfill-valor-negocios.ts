/**
 * Backfill da composição de valor dos negócios ganhos (09/09/2026).
 *
 * Contexto: a meta de `faturamento_fechado` soma `mrr_fechado + valor_setup`,
 * e não `valor_total` — que diverge da composição em 174 dos 309 negócios
 * ganhos. Sem este backfill, 130 negócios com valor_total preenchido e
 * componentes zerados entrariam na meta como R$ 0.
 *
 * A única correção SEGURA é a de negócio `tipo_receita = 'recorrente'` com os
 * dois componentes vazios e `valor_total > 0`: em receita recorrente pura o
 * total é a mensalidade, por definição. Tudo o mais fica intocado e é
 * reportado pra correção humana:
 *
 * - `hibrido` sem decomposição: não dá pra saber quanto do total é setup.
 * - `valor_total` negativo: parece estorno/downgrade lançado como ganho.
 * - negócio ganho sem valor nenhum: não há o que inferir.
 *
 * 13/10/2026: passou a usar `valoresDoGanhoAntigo` (lib/crm/regras-pos-ganho): negócio com
 * `mrr_estimado`/`valor_projeto` é decomposto como o Ganho decompõe (o total misturaria setup na
 * mensalidade); só o recorrente sem estimativa cai na regra do total. Um script só para os dois casos.
 *
 * Idempotente: só toca em linha cujos dois componentes continuam nulos.
 * Rodar com `--aplicar`; sem a flag faz simulação.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { valoresDoGanhoAntigo } from "@/lib/crm/regras-pos-ganho";

type Linha = {
  id: string; organizacao_id: string; empresa: string | null; tipo_receita: string | null;
  valor_total: string | null; mrr_estimado: string | null; valor_projeto: string | null;
  mrr_fechado: string | null; valor_setup: string | null;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function main() {
  const aplicar = process.argv.includes("--aplicar");

  // Todo ganho com os dois componentes vazios. A decisão do que gravar é da regra pura
  // (`valoresDoGanhoAntigo`, a mesma do Ganho + o degrau do legado), testada no portão.
  const candidatos = await db.execute<Linha>(sql`
    SELECT n.id::text AS id, n.organizacao_id::text AS organizacao_id, l.empresa, n.tipo_receita,
           n.valor_total::text AS valor_total, n.mrr_estimado::text AS mrr_estimado,
           n.valor_projeto::text AS valor_projeto, n.mrr_fechado::text AS mrr_fechado, n.valor_setup::text AS valor_setup
      FROM negocios n
      LEFT JOIN leads l ON l.id = n.lead_id
     WHERE n.status = 'ganho' AND n.mrr_fechado IS NULL AND n.valor_setup IS NULL`);

  const plano = candidatos.flatMap((r) => {
    const v = valoresDoGanhoAntigo({
      mrrFechado: r.mrr_fechado, mrrEstimado: r.mrr_estimado, valorSetup: r.valor_setup,
      valorProjeto: r.valor_projeto, valorTotal: r.valor_total, tipoReceita: r.tipo_receita,
    });
    return v.regra === "nenhuma" ? [] : [{ r, v }];
  });
  const alvo = plano;
  const somaMrr = plano.reduce((s, p) => s + Number(p.v.mrrFechado ?? 0), 0);
  const somaSetup = plano.reduce((s, p) => s + Number(p.v.valorSetup ?? 0), 0);
  const total = somaMrr + somaSetup;
  const porRegra = (k: string) => plano.filter((p) => p.v.regra === k);
  console.log(`\n── ganhos sem composição que a regra resolve: ${alvo.length} negócios, ${brl(total)} (mensalidade ${brl(somaMrr)} + setup ${brl(somaSetup)}) ──`);
  console.log(`  decomposto a partir da estimativa: ${porRegra("decomposto").length}`);
  console.log(`  recorrente só com o total (legado): ${porRegra("total_recorrente").length} (${brl(porRegra("total_recorrente").reduce((s, p) => s + Number(p.v.mrrFechado ?? 0), 0))})`);
  for (const p of alvo.slice(0, 8)) {
    console.log(`  ${(p.r.empresa || p.r.id).slice(0, 40).padEnd(42)} mrr ${p.v.mrrFechado ?? "-"}  setup ${p.v.valorSetup ?? "-"}  [${p.v.regra}]`);
  }
  if (alvo.length > 8) console.log(`  … e mais ${alvo.length - 8}`);

  const suspeitos = await db.execute<{ caso: string; qtd: string; soma: string }>(sql`
    SELECT caso, COUNT(*)::text AS qtd, COALESCE(SUM(valor_total), 0)::text AS soma
      FROM (
        SELECT CASE
                 WHEN valor_total < 0 THEN 'valor_total negativo (estorno lançado como ganho?)'
                 WHEN tipo_receita = 'hibrido' AND mrr_fechado IS NULL AND valor_setup IS NULL
                   THEN 'híbrido sem decomposição (quanto é setup?)'
                 WHEN valor_total IS NULL AND mrr_fechado IS NULL AND valor_setup IS NULL
                   THEN 'ganho sem valor nenhum'
               END AS caso, valor_total
          FROM negocios WHERE status = 'ganho'
      ) t
     WHERE caso IS NOT NULL
     GROUP BY caso ORDER BY 2 DESC`);

  console.log("\n── deixados pra correção humana ──");
  for (const s of suspeitos) console.log(`  ${String(s.qtd).padStart(4)}  ${s.caso}`);

  if (!aplicar) {
    console.log("\nSimulação. Rode com --aplicar pra gravar.\n");
    return;
  }

  let gravados = 0;
  for (const { r, v } of plano) {
    // organizacao_id explícito e guarda de idempotência no próprio UPDATE: se alguém preencheu no meio, não toca.
    const res = await db.execute(sql`
      UPDATE negocios
         SET mrr_fechado = COALESCE(${v.mrrFechado ?? null}::numeric, mrr_fechado),
             valor_setup = COALESCE(${v.valorSetup ?? null}::numeric, valor_setup),
             updated_at = updated_at  -- preencher composição é enriquecimento: ninguém trabalhou o negócio
       WHERE id = ${r.id}::uuid AND organizacao_id = ${r.organizacao_id}::uuid
         AND status = 'ganho' AND mrr_fechado IS NULL AND valor_setup IS NULL
       RETURNING id`);
    gravados += res.length;
  }
  console.log(`\n${gravados} negócios atualizados (${brl(total)} passam a contar na meta).\n`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
