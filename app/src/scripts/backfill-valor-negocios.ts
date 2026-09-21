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
 * Idempotente: só toca em linha cujos dois componentes continuam nulos.
 * Rodar com `--aplicar`; sem a flag faz simulação.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

type Linha = { id: string; empresa: string | null; valor_total: string; tipo_receita: string | null };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function main() {
  const aplicar = process.argv.includes("--aplicar");

  const alvo = await db.execute<Linha>(sql`
    SELECT n.id, l.empresa, n.valor_total::text AS valor_total, n.tipo_receita
      FROM negocios n
      LEFT JOIN leads l ON l.id = n.lead_id
     WHERE n.status = 'ganho'
       AND n.tipo_receita = 'recorrente'
       AND n.mrr_fechado IS NULL
       AND n.valor_setup IS NULL
       AND n.valor_total > 0`);

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

  const total = alvo.reduce((s, r) => s + Number(r.valor_total), 0);
  console.log(`\n── recorrente sem decomposição: ${alvo.length} negócios, ${brl(total)} ──`);
  for (const r of alvo.slice(0, 8)) {
    console.log(`  ${(r.empresa || r.id).slice(0, 40).padEnd(42)} ${brl(Number(r.valor_total))} → mrr_fechado`);
  }
  if (alvo.length > 8) console.log(`  … e mais ${alvo.length - 8}`);

  console.log("\n── deixados pra correção humana ──");
  for (const s of suspeitos) console.log(`  ${String(s.qtd).padStart(4)}  ${s.caso}`);

  if (!aplicar) {
    console.log("\nSimulação. Rode com --aplicar pra gravar.\n");
    return;
  }

  const r = await db.execute(sql`
    UPDATE negocios
       -- Nao bumpa updated_at: preencher mrr_fechado e enriquecimento, ninguem
       -- trabalhou o negocio. Aqui o risco e menor (so toca status = ganho, que
       -- nao aparece no board de trabalho), mas a regra e a mesma do backfill 08.
       SET mrr_fechado = valor_total
     WHERE status = 'ganho'
       AND tipo_receita = 'recorrente'
       AND mrr_fechado IS NULL
       AND valor_setup IS NULL
       AND valor_total > 0`);
  console.log(`\n${alvo.length} negócios atualizados (${brl(total)} passam a contar na meta).\n`);
  return r;
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
