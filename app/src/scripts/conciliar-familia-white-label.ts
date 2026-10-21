/**
 * Classifica como WHITE_LABEL os negócios ganhos que são revenda de licença
 * Callface AI, para que a regra de receita saiba que ali não houve recorrência.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * A proposta de White Label tem duas linhas: "Recorrente" (licenças × preço) e
 * "Setup" (implantação). Quem aceita a proposta paga SÓ o setup — o parceiro vai
 * ativando licenças conforme revende, e isso é cobrado depois, por fatura
 * avulsa. Mas `aceitar-proposta.ts` grava a linha Recorrente inteira em
 * `negocios.mrr_fechado` no aceite, tratando um máximo teórico como mensalidade
 * garantida (achado do Kauã em 31/08/2026, reconfirmado pelo Scott em 21/10).
 *
 * Não existe discriminador estrutural de White Label hoje: `proposta_itens.
 * service_family` está 100% vazio e estes negócios não têm serviço canônico.
 * Casar por NOME em tempo de consulta foi proibido pelo Kauã, e com razão — o
 * nome é inconsistente ("WHITE LABEL", "CALLFACE AI - WHITE LABEL", "Casdev -
 * Novo negócio").
 *
 * A saída é classificar uma vez, por decisão humana, com evidência e trilha:
 * grava o FATO de que o negócio é White Label em `negocios.service_family`.
 * NENHUM valor é alterado — `mrr_fechado`, `valor_setup` e `valor_total` ficam
 * exatamente como estão. Quem decide o que é MRR é a regra de receita, lendo a
 * família.
 *
 * Reversível: cada mudança vai para `billing_correction_ledger` com before/after
 * e `rule_applied`, ligada a um `billing_audit_runs`.
 *
 * USO
 * ---
 *   npx tsx --env-file=.env src/scripts/conciliar-familia-white-label.ts            # simula
 *   npx tsx --env-file=.env src/scripts/conciliar-familia-white-label.ts --aplicar  # aplica
 *   npx tsx --env-file=.env src/scripts/conciliar-familia-white-label.ts --reverter <run-id>
 *
 * Idempotente: negócio já classificado não é tocado nem gera linha no ledger.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

const OPERADOR = "conciliar-familia-white-label (decisão do Scott, 21/10/2026)";
const REGRA = "white_label_sem_recorrencia_na_venda";

/**
 * Lista CURADA. Cada entrada é uma decisão humana com a evidência que a
 * sustenta — não é saída de heurística. Para acrescentar um negócio aqui é
 * preciso olhar a proposta e confirmar que é revenda de licença.
 */
const NEGOCIOS: Array<{ id: string; titulo: string; evidencia: string }> = [
  {
    id: "5faed84e-46d4-4896-8bd6-817280ef8545",
    titulo: "Helbor - White Label",
    evidencia: "Título declara White Label; híbrido com mrr_fechado 38.970,00 e setup 29.990,00; ganho em 23/09/2026.",
  },
  {
    id: "acec14dd-47ed-4a08-a1b1-295fe860996b",
    titulo: "Casdev - Novo negócio",
    evidencia: "Confirmado como White Label em produção pelo Kauã em 31/08/2026 (mrr_fechado 12.990,00 = setup 12.990,00, a linha Recorrente duplicou o setup).",
  },
  {
    id: "0f59b25d-65ad-4bf3-9077-1f3dc7ee41b1",
    titulo: "Elev Ads Estrategia em Vendas - White Label",
    evidencia: "Título declara White Label; confirmado pelo Kauã em 31/08/2026; mrr_fechado 11.990,00 contra setup 11.900,00.",
  },
  {
    id: "a2c891cb-6798-455b-90ac-2f5a16608c98",
    titulo: "VENDA NA VEIA | WHITE LABEL | CALLFACE | MAYARA",
    evidencia: "Título declara White Label; confirmado pelo Kauã em 31/08/2026; já estava classificado — entra na lista para o conjunto ficar completo e auditável.",
  },
];

type Linha = {
  id: string;
  titulo: string;
  service_family: string | null;
  mrr_fechado: string | null;
  valor_setup: string | null;
  valor_total: string | null;
  organizacao_id: string | null;
  ganho_at: string | null;
};

const brl = (v: string | null) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function reverter(runId: string) {
  const linhas = await db.execute<{ entity_id: string; before: { service_family: string | null } }>(sql`
    SELECT entity_id::text, before FROM billing_correction_ledger
     WHERE audit_run_id = ${runId}::uuid AND entity_type = 'negocio'
       AND rule_applied = ${REGRA} AND reverted_at IS NULL`);
  if (linhas.length === 0) {
    console.log(`Nada a reverter na run ${runId}.`);
    return;
  }
  for (const l of linhas) {
    await db.execute(sql`
      UPDATE negocios SET service_family = ${l.before.service_family}, updated_at = now()
       WHERE id = ${l.entity_id}::uuid`);
    console.log(`  revertido ${l.entity_id} -> ${l.before.service_family ?? "NULL"}`);
  }
  await db.execute(sql`
    UPDATE billing_correction_ledger SET reverted_at = now()
     WHERE audit_run_id = ${runId}::uuid AND rule_applied = ${REGRA} AND reverted_at IS NULL`);
  await db.execute(sql`
    UPDATE billing_audit_runs SET status = 'COMPLETED', finished_at = now() WHERE id = ${runId}::uuid`);
  console.log(`\n${linhas.length} negócio(s) revertido(s). Run ${runId} marcada REVERTED.`);
}

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const iRev = process.argv.indexOf("--reverter");
  if (iRev >= 0) {
    const runId = process.argv[iRev + 1];
    if (!runId) throw new Error("--reverter exige o id da run");
    await reverter(runId);
    return;
  }

  const ids = NEGOCIOS.map((n) => n.id);
  const linhas = await db.execute<Linha>(sql`
    SELECT id::text, titulo, service_family, mrr_fechado::text, valor_setup::text, valor_total::text,
           organizacao_id::text, ganho_at::text
      FROM negocios WHERE id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`,`)})`);

  const porId = new Map(linhas.map((l) => [l.id, l]));
  const faltando = ids.filter((i) => !porId.has(i));
  if (faltando.length > 0) {
    console.error(`ATENÇÃO: ${faltando.length} negócio(s) da lista não existe(m) neste banco:`);
    for (const f of faltando) console.error(`  ${f}`);
  }

  const aMudar = NEGOCIOS.filter((n) => {
    const l = porId.get(n.id);
    return l && l.service_family !== "WHITE_LABEL";
  });

  console.log(`\n=== Família White Label: ${NEGOCIOS.length} negócio(s) na lista curada ===\n`);
  let mrrAfetado = 0;
  let setupPreservado = 0;
  for (const n of NEGOCIOS) {
    const l = porId.get(n.id);
    if (!l) continue;
    const ja = l.service_family === "WHITE_LABEL";
    mrrAfetado += Number(l.mrr_fechado ?? 0);
    setupPreservado += Number(l.valor_setup ?? 0);
    console.log(`${ja ? "·" : "→"} ${l.titulo}`);
    console.log(`    família: ${l.service_family ?? "NULL"}${ja ? " (já classificado, não será tocado)" : " -> WHITE_LABEL"}`);
    console.log(`    mrr_fechado ${brl(l.mrr_fechado)} · setup ${brl(l.valor_setup)} · total ${brl(l.valor_total)}  (nenhum valor é alterado)`);
    console.log(`    evidência: ${n.evidencia}`);
  }

  console.log(`\nMRR vendido que deixa de ser contado como recorrência: ${brl(String(mrrAfetado))}`);
  console.log(`Setup que continua contando como receita da venda:      ${brl(String(setupPreservado))}`);
  console.log(`A classificar agora: ${aMudar.length} de ${NEGOCIOS.length}.`);

  if (!aplicar) {
    console.log(`\nSimulação. Para aplicar: --aplicar\n`);
    return;
  }
  if (aMudar.length === 0) {
    console.log(`\nNada a fazer: todos já estão classificados.\n`);
    return;
  }

  const orgId = linhas.find((l) => l.organizacao_id)?.organizacao_id ?? null;
  const [run] = await db.execute<{ id: string }>(sql`
    INSERT INTO billing_audit_runs (organizacao_id, scope, status)
    VALUES (${orgId}::uuid,
            ${JSON.stringify({ regra: REGRA, entidade: "negocios", negocios: aMudar.map((n) => n.id) })}::jsonb,
            'RUNNING')
    RETURNING id::text`);

  for (const n of aMudar) {
    const l = porId.get(n.id)!;
    await db.execute(sql`
      INSERT INTO billing_correction_ledger
        (audit_run_id, organizacao_id, entity_type, entity_id, action, before, after, evidence, rule_applied, operator, reversible)
      VALUES (${run.id}::uuid, ${l.organizacao_id}::uuid, 'negocio', ${l.id}::uuid, 'classificar_familia',
              ${JSON.stringify({ service_family: l.service_family })}::jsonb,
              ${JSON.stringify({ service_family: "WHITE_LABEL" })}::jsonb,
              ${JSON.stringify({
                titulo: l.titulo,
                evidencia: n.evidencia,
                ganho_at: l.ganho_at,
                valores_preservados: {
                  mrr_fechado: l.mrr_fechado,
                  valor_setup: l.valor_setup,
                  valor_total: l.valor_total,
                },
              })}::jsonb,
              ${REGRA}, ${OPERADOR}, true)`);
    await db.execute(sql`
      UPDATE negocios SET service_family = 'WHITE_LABEL', updated_at = now() WHERE id = ${l.id}::uuid`);
    console.log(`  classificado: ${l.titulo}`);
  }

  await db.execute(sql`
    UPDATE billing_audit_runs
       SET status = 'COMPLETED', finished_at = now(),
           summary = ${JSON.stringify({ classificados: aMudar.length, mrr_afetado: mrrAfetado, setup_preservado: setupPreservado })}::jsonb
     WHERE id = ${run.id}::uuid`);

  console.log(`\n${aMudar.length} negócio(s) classificado(s). Run: ${run.id}`);
  console.log(`Reverter: npx tsx --env-file=.env src/scripts/conciliar-familia-white-label.ts --reverter ${run.id}\n`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
