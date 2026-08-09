/**
 * F4 (Commercial) — relatório SÓ LEITURA dos pares de contrato duplicado
 * já existentes (achado confirmado 08/08: 36 pares, R$17.449,30/mês).
 *
 * NÃO aplica nenhuma correção. Isso é checkpoint humano explícito por
 * decisão do Kauã — o script só classifica e reporta (usando o mesmo
 * helper real que o código de produção usa), quem decide o que fazer com
 * cada grupo é ele. Lógica extraída pra `gerarRelatorioDuplicidade()`
 * (lib/crm/contrato-duplicidade.ts) — reusada pela UI em
 * /admin/duplicidade-contratos, não duplicada.
 *
 * Uso: npm run db:relatorio-duplicidade-contratos
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { organizacoes } from "./schema";
import { gerarRelatorioDuplicidade } from "../crm/contrato-duplicidade";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function main() {
  console.log("=== Relatório de Duplicidade de Contratos (F4, só leitura) ===\n");

  const orgs = await db.select({ id: organizacoes.id, nome: organizacoes.nome }).from(organizacoes);

  for (const org of orgs) {
    const rel = await gerarRelatorioDuplicidade(org.id);
    if (rel.grupos.length === 0) continue;

    console.log(`\n--- ${org.nome} ---`);
    console.log(`Grupos com 2+ contrato ativo do mesmo lead+produto: ${rel.grupos.length}`);
    console.log(`  upsell_confirmado (NÃO TOCAR, venda real em paralelo): ${rel.totalUpsell}`);
    console.log(`  obsoleto_confirmado (seguro marcar renovado):          ${rel.totalObsoleto}`);
    console.log(`  ambiguo (SEM assinatura, ver sub-classificação abaixo): ${rel.totalAmbiguo}`);
    console.log(`    ├─ duplicata_provavel (mesmo valor+dia):    ${rel.totalAmbiguoDuplicataProvavel}`);
    console.log(`    ├─ legitimo_provavel (valor/tempo distinto): ${rel.totalAmbiguoLegitimoProvavel}`);
    console.log(`    └─ revisao_necessaria (só isso precisa de humano): ${rel.totalAmbiguoRevisaoNecessaria}`);
    console.log(`  MRR em excesso (linhas duplicadas por assinatura Stripe): R$${rel.mrrExcesso}`);

    for (const grupo of rel.grupos) {
      const subPorContratoId = new Map(grupo.ambiguosClassificados.map((a) => [a.contrato.id, a]));
      for (const { contrato, classificacao } of grupo.avaliados) {
        if (classificacao === "upsell_confirmado") continue;
        const sub = subPorContratoId.get(contrato.id);
        const tag = sub ? `ambiguo/${sub.subClassificacao}` : classificacao;
        console.log(`  [${tag}] contrato ${contrato.id} | lead ${contrato.leadId} | mrr R$${contrato.mrr} | criado ${contrato.createdAt?.toISOString().slice(0, 10)} | stripeSubId=${contrato.stripeSubscriptionId || "(nenhum)"}`);
      }
    }
  }

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
