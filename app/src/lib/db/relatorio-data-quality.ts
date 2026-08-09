/**
 * F6 (Analytics) — relatório SÓ LEITURA do Data Quality Layer.
 * Uso: npm run db:relatorio-data-quality
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { organizacoes } from "./schema";
import { rodarDataQuality, calcularScoreSaude } from "../crm/data-quality";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function main() {
  console.log("=== Data Quality Layer — Relatório (F6, só leitura) ===\n");
  const orgs = await db.select({ id: organizacoes.id, nome: organizacoes.nome }).from(organizacoes);

  for (const org of orgs) {
    console.log(`--- Organização: ${org.nome} ---\n`);
    const resultados = await rodarDataQuality(org.id);
    const score = calcularScoreSaude(resultados);
    console.log(`CRM Data Health: ${score}%\n`);
    for (const r of resultados) {
      const marca = r.problemas > 0 ? "⚠" : "✅";
      console.log(`${marca} ${r.check}: ${r.problemas} — ${r.descricao}`);
      if (r.problemas > 0 && r.amostras.length > 0) {
        console.log(`   amostra: ${JSON.stringify(r.amostras[0])}`);
      }
    }
    console.log();
  }

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
