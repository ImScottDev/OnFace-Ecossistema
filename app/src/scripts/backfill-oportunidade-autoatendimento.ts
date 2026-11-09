/**
 * As vendas de autoatendimento que nasceram de carga manual não têm oportunidade
 * no modelo canônico: foram escritas direto em `negocios`, sem passar pela porta.
 *
 * Quem nasce assim some das leituras canônicas (pipeline, relatórios por
 * oportunidade, política de Ganho). O caminho automático já chama
 * `syncOportunidadeFromNegocio`; isto alcança as 21 que vieram antes.
 *
 * Idempotente: `syncOportunidadeFromNegocio` atualiza quando já existe.
 *
 *   npx tsx src/scripts/backfill-oportunidade-autoatendimento.ts          # simula
 *   npx tsx src/scripts/backfill-oportunidade-autoatendimento.ts --aplicar
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { syncOportunidadeFromNegocio } from "@/lib/crm/sync-domain-model";

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const alvo = (await db.execute(sql`
    SELECT n.id::text, COALESCE(e.nome, n.titulo) AS nome
      FROM negocios n LEFT JOIN empresas e ON e.id = n.empresa_id
     WHERE n.origem_negocio = 'self_checkout'
       AND NOT EXISTS (SELECT 1 FROM oportunidades o WHERE o.negocio_id_legado = n.id)
     ORDER BY n.ganho_at
  `)) as unknown as Array<{ id: string; nome: string }>;

  console.log(`${alvo.length} venda(s) de autoatendimento sem oportunidade canônica`);
  if (!aplicar) { console.log("SIMULAÇÃO — use --aplicar"); process.exit(0); }

  let ok = 0;
  for (const n of alvo) {
    try { await syncOportunidadeFromNegocio(n.id); ok++; }
    catch (e) { console.error(`  falhou ${n.nome}:`, e instanceof Error ? e.message : e); }
  }
  const [r] = (await db.execute(sql`
    SELECT count(*)::int AS n FROM negocios n
     WHERE n.origem_negocio = 'self_checkout'
       AND NOT EXISTS (SELECT 1 FROM oportunidades o WHERE o.negocio_id_legado = n.id)
  `)) as unknown as Array<{ n: number }>;
  console.log(`${ok} sincronizada(s); ainda sem oportunidade: ${r?.n ?? "?"}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
