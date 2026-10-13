/**
 * Reconciliação Stripe ↔ ONFACE: lista as divergências por tipo.
 *
 *   # PADRÃO: só lê (Stripe em GET, banco em SELECT) e imprime. Não altera nada.
 *   npx tsx --env-file=.env src/scripts/reconciliar-stripe-onface.ts --simular
 *
 *   # com saída completa em JSON
 *   npx tsx --env-file=.env src/scripts/reconciliar-stripe-onface.ts --simular --json /tmp/reconciliacao.json --limite-lista 200
 *
 *   # CORRIGE: roda o sync da organização e abre caso (billing_resolution_cases) para o que sobrar.
 *   npx tsx --env-file=.env src/scripts/reconciliar-stripe-onface.ts --aplicar
 *
 * Opções: --org <uuid> (obrigatório se houver mais de uma organização), --json <arquivo>, --limite-lista N.
 * Objetos do SaaS Callface (conta Stripe compartilhada) ficam de fora e só são contados.
 * Exige STRIPE_API_KEY (chave restrita de LEITURA) e DATABASE_URL.
 */
import { writeFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { formatarRelatorio } from "@/lib/integrations/stripe-reconciliacao";
import { reconciliarOrganizacao } from "@/lib/integrations/stripe-reconciliacao-db";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const tem = (n: string) => process.argv.includes(`--${n}`);

async function main() {
  const aplicar = tem("aplicar");
  if (aplicar && tem("simular")) throw new Error("--simular e --aplicar são excludentes");

  let org = arg("org");
  if (!org) {
    const orgs = (await db.execute(sql`SELECT id::text FROM organizacoes LIMIT 2`)) as unknown as { id: string }[];
    if (orgs.length !== 1) throw new Error("Há mais de uma organização: use --org <uuid>");
    org = orgs[0].id;
  }
  console.log(`Organização ${org} — ${aplicar ? "APLICAR (escreve no banco do .env)" : "SIMULAÇÃO (nada é alterado)"}`);

  const r = await reconciliarOrganizacao(org, { aplicar });
  const limite = Number(arg("limite-lista")) || 40;
  console.log("\n== Antes ==\n" + formatarRelatorio(r.antes, limite));
  if (r.depois) {
    console.log("\n== Depois do sync ==\n" + formatarRelatorio(r.depois, limite));
    console.log(`\nExecução ${r.execucaoId}; ${r.casosAbertos} caso(s) novo(s) em billing_resolution_cases (fila REVIEW, motivo RECONCILIACAO_STRIPE).`);
  } else {
    console.log("\n(simulação: nada foi alterado. Acrescente --aplicar para rodar o sync e abrir os casos.)");
  }
  const arquivo = arg("json");
  if (arquivo) await writeFile(arquivo, JSON.stringify(r, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => process.exit(process.exitCode ?? 0));
