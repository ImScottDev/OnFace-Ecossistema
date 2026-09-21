/**
 * Fase 12 — normalização financeira e criação de pagamentos (SPEC §21).
 *
 * Duas coisas:
 *
 * 1. `faturas` sem `empresa_id` resolvem a empresa pelo lead de origem. 177 de
 *    951 estão assim, e o SPEC §21.3 exige `empresa_id NOT NULL`.
 *
 * 2. Toda fatura PAGA vira um `pagamentos`. Hoje o fato "foi pago" só existe
 *    como `status='paga'` + `paga_em` na própria fatura. Sem entidade de
 *    pagamento, ganho e pagamento não podem ser fatos separados, que é o que o
 *    SPEC §15.2 exige para venda por contrato.
 *
 * O que NÃO é feito aqui, de propósito: inventar pagamento para fatura paga sem
 * data de pagamento. São 118 casos (725 pagas, 607 com `paga_em`). Esses viram
 * caso de reconciliação em vez de ganhar uma data fabricada.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
const APLICAR = process.argv.includes("--aplicar");

async function main() {
  console.log(`\nFase 12 — financeiro — ${APLICAR ? "APLICANDO" : "SIMULAÇÃO"}\n`);

  if (APLICAR) {
    const e = await db.execute<{ n: string }>(sql`
      WITH u AS (
        UPDATE faturas f SET empresa_id = l.empresa_id, updated_at = now()
        FROM leads l WHERE f.empresa_id IS NULL AND f.lead_id = l.id AND l.empresa_id IS NOT NULL
        RETURNING 1) SELECT count(*)::text AS n FROM u`);
    console.log(`  faturas com empresa resolvida pelo lead   ${e[0].n}`);

    // Pagamento só nasce de fatura paga COM data. Sem data não há fato datado,
    // e inventar uma corromperia qualquer relatório de receita por competência.
    const p = await db.execute<{ n: string }>(sql`
      WITH ins AS (
        INSERT INTO pagamentos (organizacao_id, fatura_id, empresa_id, servico_canonico_id,
                                provider, external_payment_id, amount, currency, status, paid_at,
                                idempotency_key, metadata, created_at)
        SELECT f.organizacao_id, f.id, f.empresa_id, f.servico_canonico_id,
               coalesce(f.origem, 'desconhecido'), f.external_id, f.valor, coalesce(f.moeda, 'BRL'),
               'PAID', f.paga_em,
               'backfill-12:' || f.id::text,
               jsonb_build_object('backfill', jsonb_build_object('fase','12','fatura', f.id, 'status_origem', f.status)),
               f.paga_em
        FROM faturas f
        WHERE f.status = 'paga' AND f.paga_em IS NOT NULL AND f.empresa_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM pagamentos pg WHERE pg.fatura_id = f.id)
        RETURNING 1) SELECT count(*)::text AS n FROM ins`);
    console.log(`  pagamentos criados de fatura paga         ${p[0].n}`);

    // Fatura paga sem data: caso, não palpite.
    await db.execute(sql`
      INSERT INTO reconciliacao_casos (organizacao_id, fase, tipo, entidade_alvo, origens, evidencia, sugestao)
      SELECT (SELECT id FROM organizacoes LIMIT 1), '12', 'FATURA_PAGA_SEM_DATA', 'agregado:faturas',
             jsonb_build_object('tabela','faturas','quantidade',
               (SELECT count(*) FROM faturas WHERE status='paga' AND paga_em IS NULL)),
             jsonb_build_object('fato','faturas marcadas como pagas sem data de pagamento',
               'por_que_nao_foi_criado','sem data não há fato datado; inventar uma corromperia receita por competência'),
             jsonb_build_object('acao','buscar a data no provedor de origem ou marcar como não conciliável')
      WHERE EXISTS (SELECT 1 FROM faturas WHERE status='paga' AND paga_em IS NULL)
      ON CONFLICT (fase, tipo, entidade_alvo, status) DO NOTHING`);
  }

  const r = await db.execute<Record<string, string>>(sql`
    SELECT (SELECT count(*)::text FROM faturas) AS faturas,
           (SELECT count(*)::text FROM faturas WHERE empresa_id IS NULL) AS sem_empresa,
           (SELECT count(*)::text FROM faturas WHERE status='paga') AS pagas,
           (SELECT count(*)::text FROM faturas WHERE status='paga' AND paga_em IS NULL) AS pagas_sem_data,
           (SELECT count(*)::text FROM pagamentos) AS pagamentos,
           (SELECT coalesce(sum(amount),0)::text FROM pagamentos) AS soma_paga,
           (SELECT coalesce(sum(valor),0)::text FROM faturas WHERE status='paga' AND paga_em IS NOT NULL AND empresa_id IS NOT NULL) AS soma_origem`);
  console.log(`\n  RECONCILIAÇÃO`);
  console.log(`    faturas                         ${r[0].faturas}`);
  console.log(`    sem empresa (SPEC exige NOT NULL) ${r[0].sem_empresa}`);
  console.log(`    pagas                           ${r[0].pagas}`);
  console.log(`    pagas SEM data (caso aberto)    ${r[0].pagas_sem_data}`);
  console.log(`    pagamentos criados              ${r[0].pagamentos}`);
  console.log(`    soma dos pagamentos             ${Number(r[0].soma_paga).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
  console.log(`    soma das faturas de origem      ${Number(r[0].soma_origem).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
  const bate = Math.abs(Number(r[0].soma_paga) - Number(r[0].soma_origem)) < 0.01;
  console.log(`    valores conferem                ${bate ? "sim" : "NÃO — investigar"}\n`);
  if (!APLICAR) console.log("  Nada foi gravado.\n");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
