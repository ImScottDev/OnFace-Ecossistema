/**
 * Reconciliação de billing_status da carteira contra as assinaturas.
 *
 * O PROBLEMA QUE ISTO MEDE, achado em 23/09 com dump fresco de produção:
 *
 * servicos_canonicos.billing_status é escrito UMA vez, no momento do Won
 * (lib/crm/servico-canonico.ts:51, "isMrr ? ACTIVE : BILLED"), e nenhuma rotina
 * o atualiza depois. A assinatura continua evoluindo no Stripe e o espelho da
 * carteira fica parado no dia da venda.
 *
 * Dos 135 serviços marcados ACTIVE:
 *
 *     83  assinatura de fato active
 *     22  assinatura CANCELED
 *     21  assinatura UNPAID
 *      8  past_due
 *      1  trialing
 *
 * São 52 serviços anunciando receita ativa sobre assinatura cancelada ou não
 * paga. Não é erro de leitura da tela: o valor gravado é que está velho.
 *
 * NÃO escreve por padrão. A carteira é número de receita, e mudar 52 linhas
 * dela é decisão do Kauã, não de script. Use --aplicar quando ele aprovar.
 *
 *   pnpm tsx --env-file=.env src/scripts/reconciliar-billing-carteira.ts
 *   pnpm tsx --env-file=.env src/scripts/reconciliar-billing-carteira.ts --aplicar
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const APLICAR = process.argv.includes("--aplicar");

/**
 * Status do Stripe para o vocabulário da carteira.
 *
 * `unpaid` vai para PAST_DUE e não para CANCELED de propósito: o Stripe ainda
 * não encerrou a assinatura, e tratar como cancelada apagaria da carteira uma
 * cobrança que ainda pode ser recuperada. `incomplete` fica UNKNOWN porque a
 * assinatura nunca chegou a valer.
 */
const DE_STRIPE_PARA_CARTEIRA: Record<string, string> = {
  active: "ACTIVE",
  trialing: "ACTIVE",
  past_due: "PAST_DUE",
  unpaid: "PAST_DUE",
  canceled: "CANCELED",
  incomplete_expired: "CANCELED",
  incomplete: "UNKNOWN",
};

async function main() {
  console.log(`\n  RECONCILIAÇÃO billing_status da carteira ${APLICAR ? "(APLICANDO)" : "(dry-run)"}\n`);

  const linhas = await db.execute<{
    id: string; atual: string | null; stripe: string | null; fonte: string | null; valor: string | null;
  }>(sql`
    SELECT s.id::text, s.billing_status AS atual, a.status AS stripe,
           s.billing_source AS fonte, s.current_recurring_value::text AS valor
      FROM servicos_canonicos s
      JOIN assinaturas a
        ON a.id::text = s.current_subscription_id
        OR a.stripe_subscription_id = s.current_subscription_id
     WHERE s.current_subscription_id IS NOT NULL`);

  const transicoes = new Map<string, { n: number; valor: number }>();
  const aplicar: { id: string; novo: string }[] = [];
  let semMapa = 0;

  for (const l of linhas) {
    const novo = l.stripe ? DE_STRIPE_PARA_CARTEIRA[l.stripe] : undefined;
    // Status novo do Stripe é para relatar, nunca para adivinhar.
    if (!novo) { semMapa++; continue; }
    if (novo === l.atual) continue;
    const chave = `${l.atual ?? "NULL"} -> ${novo}  (stripe: ${l.stripe})`;
    const acc = transicoes.get(chave) ?? { n: 0, valor: 0 };
    acc.n++; acc.valor += Number(l.valor ?? 0);
    transicoes.set(chave, acc);
    aplicar.push({ id: l.id, novo });
  }

  console.log(`  serviços com assinatura vinculada: ${linhas.length}`);
  console.log(`  divergentes: ${aplicar.length}\n`);
  for (const [chave, v] of [...transicoes.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`    ${String(v.n).padStart(4)}  ${chave.padEnd(46)} MRR ${v.valor.toFixed(2)}`);
  }
  if (semMapa > 0) console.log(`\n  ${semMapa} com status do Stripe fora do mapa — não tocados.`);

  if (!APLICAR) {
    console.log(`\n  dry-run. Nada escrito. A carteira é número de receita:\n  rode com --aplicar só depois do aval do Kauã.\n`);
    return;
  }

  for (const a of aplicar) {
    await db.execute(sql`
      UPDATE servicos_canonicos SET billing_status = ${a.novo}, updated_at = updated_at
       WHERE id = ${a.id}::uuid`);
  }
  console.log(`\n  ✓ ${aplicar.length} serviços reconciliados\n`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
