/**
 * Fase 08 — vincula oportunidade à oferta comercial (SPEC §12).
 *
 * A oferta é quem carrega a política de ganho, pagamento e contrato. Sem o
 * vínculo, `SalesService.evaluateWinCondition` não tem de onde ler a regra.
 *
 * Ambiguidade tratada: Callface AI tem DUAS ofertas com políticas opostas
 * (direta ganha no pagamento, por contrato ganha na assinatura). A escolha é
 * determinística, por evidência de contrato existente, nunca por default:
 *
 *   negócio tem contrato  → CALLFACE_AI_CONTRACT
 *   negócio sem contrato  → CALLFACE_AI_DIRECT
 *
 * PABX e White Label têm uma oferta só cada, então o vínculo é direto.
 * Oportunidade sem família continua sem oferta: já tem caso aberto da fase 07.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const APLICAR = process.argv.includes("--aplicar");

async function main() {
  console.log(`\nVínculo oportunidade → oferta comercial — ${APLICAR ? "APLICANDO" : "SIMULAÇÃO"}\n`);

  const plano = await db.execute<{ familia: string; tem_contrato: boolean; oferta: string; n: string }>(sql`
    SELECT o.service_family AS familia,
           EXISTS (SELECT 1 FROM contratos c WHERE c.negocio_id = o.negocio_id_legado) AS tem_contrato,
           CASE
             WHEN o.service_family = 'CALLFACE_AI' AND EXISTS (SELECT 1 FROM contratos c WHERE c.negocio_id = o.negocio_id_legado)
               THEN 'CALLFACE_AI_CONTRACT'
             WHEN o.service_family = 'CALLFACE_AI' THEN 'CALLFACE_AI_DIRECT'
             WHEN o.service_family = 'PABX' THEN 'PABX_CONTRACT'
             WHEN o.service_family = 'WHITE_LABEL' THEN 'WHITE_LABEL_CONTRACT'
           END AS oferta,
           count(*)::text AS n
    FROM oportunidades o
    WHERE o.service_family IS NOT NULL AND o.oferta_comercial_id IS NULL
    GROUP BY 1, 2, 3 ORDER BY 4 DESC
  `);

  console.log("  RELATÓRIO — vínculo por evidência\n");
  let total = 0, semOferta = 0;
  for (const p of plano) {
    total += Number(p.n);
    if (!p.oferta) { semOferta += Number(p.n); console.log(`    ${String(p.familia).padEnd(16)} SEM OFERTA CORRESPONDENTE      ${p.n}`); continue; }
    console.log(`    ${String(p.familia).padEnd(16)} ${p.oferta.padEnd(24)} ${p.n}  (contrato: ${p.tem_contrato ? "sim" : "não"})`);
  }

  if (APLICAR) {
    const r = await db.execute<{ n: string }>(sql`
      WITH vinculo AS (
        -- NAO bumpa updated_at. Vincular a oferta comercial e enriquecimento:
        -- ninguém trabalhou a oportunidade, só descobrimos qual é a política
        -- de ganho dela.
        --
        -- A coluna updated_at da oportunidade governa a ordem do board e a metrica de
        -- "parada há X dias" da fila de loops abertos. Medido em 21/09 neste
        -- banco de dev: as 401 oportunidades abertas SEM família têm datas
        -- espalhadas de 09/02 a 21/09, e as 126 COM família têm todas a mesma
        -- data — a do dia em que este backfill rodou. Elas perderam o histórico.
        --
        -- Na virada isso atingiria as 477 de uma vez, e a operação abriria o
        -- board no primeiro dia com tudo parecendo recém-trabalhado.
        UPDATE oportunidades o SET oferta_comercial_id = oc.id
        FROM ofertas_comerciais oc
        WHERE o.oferta_comercial_id IS NULL
          AND o.service_family IS NOT NULL
          AND oc.organizacao_id = o.organizacao_id
          AND oc.codigo = CASE
                WHEN o.service_family = 'CALLFACE_AI' AND EXISTS (SELECT 1 FROM contratos c WHERE c.negocio_id = o.negocio_id_legado)
                  THEN 'CALLFACE_AI_CONTRACT'
                WHEN o.service_family = 'CALLFACE_AI' THEN 'CALLFACE_AI_DIRECT'
                WHEN o.service_family = 'PABX' THEN 'PABX_CONTRACT'
                WHEN o.service_family = 'WHITE_LABEL' THEN 'WHITE_LABEL_CONTRACT'
              END
        RETURNING 1)
      SELECT count(*)::text AS n FROM vinculo`);
    console.log(`\n  oportunidades vinculadas      ${r[0]?.n ?? 0}`);
  }

  console.log(`\n  total com família             ${total}`);
  console.log(`  sem oferta correspondente     ${semOferta}`);
  const semFamilia = await db.execute<{ n: string }>(sql`SELECT count(*)::text AS n FROM oportunidades WHERE service_family IS NULL`);
  console.log(`  sem família (caso aberto)     ${semFamilia[0]?.n}\n`);
  if (!APLICAR) console.log("  Nada foi gravado.\n");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
