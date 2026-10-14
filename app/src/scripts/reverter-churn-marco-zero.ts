/**
 * Reverte o churn que a carga do marco zero marcou em serviço com assinatura Stripe VIVA.
 *
 * O que aconteceu (medido em produção em 14/10/2026): o passo 6b de
 * `scripts/carga-marco-zero/08_carteira.sql` marcou `commercial_lifecycle = 'CHURNED'` e
 * `portfolio_included = false` em todo serviço cuja empresa não aparecia no fechamento de set/26 —
 * sem consultar o Stripe. Resultado: **37 serviços CHURNED com assinatura ativa, 19 empresas,
 * R$ 15.936,10/mês cobrados de fato e fora do MRR**. Cliente ganho em set/out nasceu e churnou no
 * mesmo lote.
 *
 * A guarda já está na carga (assinatura viva e serviço criado depois do corte não churnam mais).
 * Este script conserta o que a carga anterior deixou gravado.
 *
 * Regra:
 *  - Só serviço churnado PELA CARGA: `evidence.marco_zero_p12.commercial_lifecycle_antes = 'ACTIVE'`
 *    e hoje `commercial_lifecycle = 'CHURNED'`. Churn de verdade (Stripe, CS) não é tocado.
 *  - Só com assinatura viva no espelho: `active | trialing | past_due`, e do CRM
 *    (`fora_do_espelho_em IS NULL` — objeto do SaaS Callface não é carteira).
 *  - Restaura o que estava ANTES, do próprio `evidence.marco_zero_p12` (inclusive
 *    `portfolio_included_antes = false`: serviço que prod tinha desligado não volta ligado).
 *
 * Garantias:
 *  - `--simular` é o padrão e não escreve nada.
 *  - `--aplicar` faz tudo numa ÚNICA transação, depois de criar a tabela de backup
 *    `servicos_canonicos_bkp_mz_churn_<aaaammddhhmmss>` (estado completo das linhas afetadas).
 *  - Idempotente: depois de aplicado o serviço não está mais CHURNED, então uma segunda execução
 *    acha 0 e não cria backup. O rastro fica em `evidence.marco_zero_p12_revertido_em`.
 *  - Não toca `updated_at` (M10): quem olha a ficha não vê "mexido agora" por causa da correção.
 *
 * Uso (da pasta app/):
 *   npx tsx --env-file=.env src/scripts/reverter-churn-marco-zero.ts             # simula (padrão)
 *   npx tsx --env-file=.env src/scripts/reverter-churn-marco-zero.ts --aplicar   # ESCREVE no banco
 */
export {}; // módulo próprio: sem isto o `main` cai no escopo global e colide com o de outro script.

const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");

type Alvo = {
  id: string;
  organizacao_id: string;
  empresa: string | null;
  canonical_key: string;
  lifecycle_antes: string;
  portfolio_antes: boolean;
  valor_servico: string | null;
  mrr_assinatura: string | null;
  subscription: string;
  status_assinatura: string;
};

async function main() {
  if (aplicar && args.includes("--simular")) { console.error("Use --simular OU --aplicar, não os dois."); process.exit(2); }
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");

  console.log(aplicar ? "MODO: APLICAR (escreve no banco, com backup)" : "MODO: SIMULAR (nada é escrito)");

  const alvos = await db.execute<Alvo>(sql`
    SELECT sc.id::text, sc.organizacao_id::text, e.nome AS empresa, sc.canonical_key,
           sc.evidence -> 'marco_zero_p12' ->> 'commercial_lifecycle_antes' AS lifecycle_antes,
           (sc.evidence -> 'marco_zero_p12' ->> 'portfolio_included_antes')::boolean AS portfolio_antes,
           sc.current_recurring_value::text AS valor_servico,
           a.mrr::text AS mrr_assinatura, a.stripe_subscription_id AS subscription, a.status AS status_assinatura
      FROM servicos_canonicos sc
      LEFT JOIN empresas e ON e.id = sc.empresa_id
      JOIN LATERAL (
        SELECT a.stripe_subscription_id, a.status, a.mrr FROM assinaturas a
         WHERE a.status IN ('active', 'trialing', 'past_due') AND a.fora_do_espelho_em IS NULL
           AND (a.servico_id = sc.id OR a.stripe_subscription_id = sc.current_subscription_id)
         ORDER BY a.mrr DESC NULLS LAST LIMIT 1) a ON true
     WHERE sc.commercial_lifecycle = 'CHURNED'
       AND sc.evidence -> 'marco_zero_p12' ->> 'commercial_lifecycle_antes' = 'ACTIVE'
     ORDER BY a.mrr DESC NULLS LAST`);

  const soma = (valores: (string | null)[]) => valores.reduce((t, v) => t + (Number(v) || 0), 0);
  const empresas = new Set(alvos.map((a) => a.empresa ?? a.id)).size;
  console.log(`Serviços a reverter: ${alvos.length} (${empresas} empresas). ` +
    `MRR das assinaturas vivas: R$ ${soma(alvos.map((a) => a.mrr_assinatura)).toFixed(2)}. ` +
    `Valor recorrente nos serviços: R$ ${soma(alvos.map((a) => a.valor_servico)).toFixed(2)}.`);
  console.table(alvos.map((a) => ({
    empresa: a.empresa, chave: a.canonical_key, assinatura: a.status_assinatura,
    mrr: a.mrr_assinatura, volta_pro_portfolio: a.portfolio_antes,
  })));

  if (!aplicar || alvos.length === 0) {
    if (!aplicar) console.log("Nada foi escrito. Use --aplicar para gravar.");
    return;
  }

  const lote = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const tabela = `servicos_canonicos_bkp_mz_churn_${lote}`; // só dígitos no sufixo: seguro como identificador
  const ids = `{${alvos.map((a) => a.id).join(",")}}`;      // array nunca vai direto ao Postgres: literal text[]
  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`CREATE TABLE ${tabela} AS SELECT * FROM servicos_canonicos WHERE id = ANY('${ids}'::uuid[])`));
    for (const a of alvos) {
      await tx.execute(sql`
        UPDATE servicos_canonicos
           SET commercial_lifecycle = ${a.lifecycle_antes},
               portfolio_included = ${a.portfolio_antes},
               evidence = evidence || jsonb_build_object('marco_zero_p12_revertido_em', now(),
                            'marco_zero_p12_revertido_por', 'reverter-churn-marco-zero'),
               updated_at = updated_at
         WHERE id = ${a.id}::uuid AND organizacao_id = ${a.organizacao_id}::uuid
           AND commercial_lifecycle = 'CHURNED'
           AND evidence -> 'marco_zero_p12' ->> 'commercial_lifecycle_antes' = 'ACTIVE'`);
    }
  });
  console.log(`Revertido em ${alvos.length} serviços. Backup: ${tabela}`);
  console.log("O cliente (status_financeiro) volta a 'ativo' no próximo sync do Stripe (reconciliação de estado).");
}

void main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
