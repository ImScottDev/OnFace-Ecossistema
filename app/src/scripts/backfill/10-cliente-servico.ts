/**
 * Fase 10 — perfil de cliente e serviço do cliente (SPEC §16, §17).
 *
 * Dois vínculos canônicos:
 *
 * 1. `clientes` vira perfil 1:1 de CS da EMPRESA (SPEC §16.2). Hoje amarra em
 *    `lead_id_legado` e `oportunidade_origem_id` como ponte de identidade, e o
 *    SPEC manda remover essa dependência: a origem já está nos eventos.
 *
 * 2. `servicos_canonicos` deixa de depender de `lead_id` e passa a apontar para
 *    `empresa_id` e para a oportunidade que o originou (SPEC §17).
 *
 * Só ADICIONA vínculo. Colunas antigas intactas até a contração.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
const APLICAR = process.argv.includes("--aplicar");

async function main() {
  console.log(`\nFase 10 — cliente e serviço canônico — ${APLICAR ? "APLICANDO" : "SIMULAÇÃO"}\n`);

  const a = await db.execute<Record<string, string>>(sql`
    SELECT (SELECT count(*)::text FROM clientes) AS clientes,
           (SELECT count(*)::text FROM clientes WHERE empresa_id IS NOT NULL) AS cli_com_empresa,
           (SELECT count(*)::text FROM servicos_canonicos) AS servicos,
           (SELECT count(*)::text FROM servicos_canonicos WHERE empresa_id IS NOT NULL) AS srv_com_empresa,
           (SELECT count(*)::text FROM servicos_canonicos WHERE lead_id IS NOT NULL) AS srv_com_lead`);
  console.log(`  clientes ${a[0].clientes} (${a[0].cli_com_empresa} já com empresa)`);
  console.log(`  serviços ${a[0].servicos} (${a[0].srv_com_empresa} com empresa, ${a[0].srv_com_lead} ainda por lead)\n`);

  if (APLICAR) {
    // Empresa do cliente pela ponte de lead legado, quando faltar. Chave exata.
    const c1 = await db.execute<{ n: string }>(sql`
      WITH u AS (
        UPDATE clientes c SET empresa_id = l.empresa_id, updated_at = now()
        FROM leads l WHERE c.empresa_id IS NULL AND c.lead_id_legado = l.id AND l.empresa_id IS NOT NULL
        RETURNING 1) SELECT count(*)::text AS n FROM u`);
    // Serviço: empresa pelo lead de origem.
    const s1 = await db.execute<{ n: string }>(sql`
      WITH u AS (
        UPDATE servicos_canonicos s SET empresa_id = l.empresa_id, updated_at = now()
        FROM leads l WHERE s.empresa_id IS NULL AND s.lead_id = l.id AND l.empresa_id IS NOT NULL
        RETURNING 1) SELECT count(*)::text AS n FROM u`);
    // Serviço → oportunidade de origem: pelo contrato, que é a ligação real.
    const s2 = await db.execute<{ n: string }>(sql`
      WITH u AS (
        UPDATE servicos_canonicos s SET oportunidade_origem_id = o.id, updated_at = now()
        FROM contratos ct JOIN oportunidades o ON o.id = ct.oportunidade_id
        WHERE s.oportunidade_origem_id IS NULL AND s.contrato_id = ct.id
        RETURNING 1) SELECT count(*)::text AS n FROM u`);
    console.log(`  clientes com empresa resolvida       ${c1[0].n}`);
    console.log(`  serviços com empresa resolvida       ${s1[0].n}`);
    console.log(`  serviços ligados à oportunidade      ${s2[0].n}`);
  }

  const r = await db.execute<Record<string, string>>(sql`
    SELECT (SELECT count(*)::text FROM clientes WHERE empresa_id IS NULL) AS cli_sem_empresa,
           (SELECT count(*)::text FROM servicos_canonicos WHERE empresa_id IS NULL) AS srv_sem_empresa,
           (SELECT count(*)::text FROM servicos_canonicos WHERE oportunidade_origem_id IS NULL) AS srv_sem_op,
           (SELECT count(*)::text FROM (SELECT empresa_id FROM clientes WHERE empresa_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1) x) AS empresas_com_2_clientes`);
  console.log(`\n  RECONCILIAÇÃO`);
  console.log(`    clientes sem empresa                  ${r[0].cli_sem_empresa}`);
  console.log(`    serviços sem empresa                  ${r[0].srv_sem_empresa}`);
  console.log(`    serviços sem oportunidade de origem   ${r[0].srv_sem_op}`);
  console.log(`    empresas com MAIS DE UM cliente       ${r[0].empresas_com_2_clientes}  (SPEC §16.2 exige 1:1)\n`);
  if (!APLICAR) console.log("  Nada foi gravado.\n");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
