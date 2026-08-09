/**
 * F4 (Commercial) — relatório SÓ LEITURA dos pares de contrato duplicado
 * já existentes (achado confirmado 08/08: 36 pares, R$17.449,30/mês).
 *
 * NÃO aplica nenhuma correção. Isso é checkpoint humano explícito por
 * decisão do Kauã — o script só classifica e reporta (usando o mesmo
 * helper real que o código de produção usa), quem decide o que fazer com
 * cada grupo é ele.
 *
 * Uso: npm run db:relatorio-duplicidade-contratos
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { contratos, organizacoes } from "./schema";
import { avaliarContratosAtivosDuplicados } from "../crm/contrato-duplicidade";
import { sql } from "drizzle-orm";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function main() {
  console.log("=== Relatório de Duplicidade de Contratos (F4, só leitura) ===\n");

  const orgs = await db.select({ id: organizacoes.id, nome: organizacoes.nome }).from(organizacoes);

  const grupos = await db.execute<{ lead_id: string; produto: string | null; qtd: number }>(sql`
    select lead_id, produto, count(*)::int as qtd
    from contratos
    where status = 'ativo'
    group by lead_id, produto
    having count(*) > 1
  `);

  console.log(`Organizações: ${orgs.length}. Grupos com 2+ contrato ativo do mesmo lead+produto: ${grupos.length}\n`);

  let totalUpsell = 0, totalObsoleto = 0, totalAmbiguo = 0;
  const linhasAmbiguo: string[] = [];
  const linhasObsoleto: string[] = [];

  for (const org of orgs) {
    for (const grupo of grupos) {
      const avaliados = await avaliarContratosAtivosDuplicados(grupo.lead_id, grupo.produto, org.id);
      for (const { contrato, classificacao } of avaliados) {
        const linha = `  contrato ${contrato.id} | lead ${contrato.leadId} | mrr R$${contrato.mrr} | criado ${contrato.createdAt?.toISOString().slice(0, 10)} | stripeSubId=${contrato.stripeSubscriptionId || "(nenhum)"}`;
        if (classificacao === "upsell_confirmado") totalUpsell++;
        else if (classificacao === "obsoleto_confirmado") { totalObsoleto++; linhasObsoleto.push(linha); }
        else { totalAmbiguo++; linhasAmbiguo.push(linha); }
      }
    }
  }

  console.log(`Classificação (via avaliarContratosAtivosDuplicados, o mesmo helper que o código de produção usa):`);
  console.log(`  upsell_confirmado (NÃO TOCAR, venda real em paralelo): ${totalUpsell}`);
  console.log(`  obsoleto_confirmado (seguro marcar renovado):          ${totalObsoleto}`);
  console.log(`  ambiguo (precisa revisão humana, SEM assinatura):      ${totalAmbiguo}`);

  if (linhasObsoleto.length > 0) {
    console.log(`\n--- obsoleto_confirmado (candidatos a marcar 'renovado', NADA APLICADO) ---`);
    console.log(linhasObsoleto.join("\n"));
  }
  if (linhasAmbiguo.length > 0) {
    console.log(`\n--- ambiguo (precisa decisão do Kauã, NADA APLICADO) ---`);
    console.log(linhasAmbiguo.join("\n"));
  }

  // "Excesso" = a cópia mais recente de cada par duplicado (por created_at,
  // não por id — UUID de gen_random_uuid() não é sortable por ordem de
  // criação). Mesmo critério já usado na verificação original do achado.
  const [totalMrrDuplicado] = await db.execute<{ total: string }>(sql`
    with ranked as (
      select id, mrr, stripe_subscription_id,
             row_number() over (partition by stripe_subscription_id order by created_at asc) as rn
      from contratos
      where status = 'ativo' and stripe_subscription_id is not null
    )
    select coalesce(sum(mrr), 0)::text as total
    from ranked
    where rn > 1
  `);
  console.log(`\nMRR em excesso (linhas duplicadas por stripe_subscription_id, mesmo critério da auditoria original): R$${totalMrrDuplicado.total}`);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
