/**
 * Smoke do caminho único de ganho.
 *
 * Prova contra o banco real que a política da oferta decide, e que nenhum
 * caminho ganha por conta própria. Cria uma oportunidade de teste, exercita os
 * dois desfechos e limpa só o que criou.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { avaliarCondicaoDeGanho } from "@onface/sales";
import { criarRepositorioVendas } from "@onface/platform-database";

async function main() {
  let saida = 1;
  const repo = criarRepositorioVendas(db as never, sql as never);
  const [org] = await db.execute<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);
  const [emp] = await db.execute<{ id: string }>(sql`SELECT id FROM empresas LIMIT 1`);
  const [ofPabx] = await db.execute<{ id: string }>(sql`SELECT id FROM ofertas_comerciais WHERE codigo = 'PABX_CONTRACT'`);
  const marca = `smoke-ganho-${Date.now()}`;

  const [op] = await db.execute<{ id: string }>(sql`
    INSERT INTO oportunidades (organizacao_id, empresa_id, oferta_comercial_id, stage, titulo, service_family, source_process)
    VALUES (${org.id}::uuid, ${emp.id}::uuid, ${ofPabx.id}::uuid, 'aberto', ${marca}, 'PABX', 'SMOKE')
    RETURNING id`);

  console.log(`\n  oportunidade de teste: PABX por contrato\n`);

  // A limpeza roda no finally: quando este smoke quebrava no meio (foi assim
  // que a migration 0068 apareceu), a oportunidade de teste ficava no banco e
  // contaminava a contagem de reconciliação da fase seguinte.
  let ct: { id: string } | undefined;
  try {

  const semNada = await avaliarCondicaoDeGanho(repo, op.id);
  console.log(`  1. sem contrato assinado      ok=${semNada.ok}  ${!semNada.ok ? `(${semNada.codigo}: falta ${JSON.stringify((semNada as { falta?: string[] }).falta)})` : ""}`);

  // `contratos` ainda exige lead_id e tipo: são colunas legadas NOT NULL que
  // só saem na contração. Pega-se um lead qualquer da empresa para satisfazer
  // a restrição sem inventar vínculo.
  const [algumLead] = await db.execute<{ id: string }>(sql`SELECT id FROM leads WHERE empresa_id = ${emp.id}::uuid LIMIT 1`);
  [ct] = await db.execute<{ id: string }>(sql`
    INSERT INTO contratos (organizacao_id, oportunidade_id, empresa_id, lead_id, tipo, status)
    VALUES (${org.id}::uuid, ${op.id}::uuid, ${emp.id}::uuid, ${algumLead.id}::uuid, 'smoke', 'fully_signed')
    RETURNING id`);

  const comContrato = await avaliarCondicaoDeGanho(repo, op.id);
  console.log(`  2. com contrato assinado      ok=${comContrato.ok}  ${comContrato.ok ? `motivo: ${comContrato.dados.motivo}, jornadas: ${comContrato.dados.jornadas}` : ""}`);

  const denovo = await avaliarCondicaoDeGanho(repo, op.id);
  console.log(`  3. avaliando de novo (retry)  ok=${denovo.ok}  ${denovo.ok ? `motivo: ${denovo.dados.motivo}` : ""}`);

  const v = await db.execute<Record<string, string>>(sql`
    SELECT (SELECT count(*)::text FROM servicos_canonicos WHERE oportunidade_origem_id = ${op.id}::uuid) AS servicos,
           (SELECT count(*)::text FROM fulfillments f JOIN servicos_canonicos s ON s.id = f.servico_canonico_id
             WHERE s.oportunidade_origem_id = ${op.id}::uuid) AS jornadas,
           (SELECT count(*)::text FROM timeline_events WHERE oportunidade_id = ${op.id}::uuid) AS timeline`);

  const esperado = { servicos: "1", jornadas: "2", timeline: "1" };
  console.log(`\n  RESULTADO`);
  let ok = true;
  for (const [k, esp] of Object.entries(esperado)) {
    const bateu = v[0][k] === esp;
    if (!bateu) ok = false;
    console.log(`    ${k.padEnd(12)} ${v[0][k]}  (esperado ${esp})  ${bateu ? "ok" : "FALHOU"}`);
  }
  const bloqueou = !semNada.ok && (semNada as { codigo: string }).codigo === "CONDICAO_NAO_ATENDIDA";
  const idem = denovo.ok && denovo.dados.motivo === "já estava ganha";
  console.log(`    ${"bloqueio".padEnd(12)} ${bloqueou ? "ok" : "FALHOU"}  (contrato não assinado não ganha)`);
  console.log(`    ${"idempotente".padEnd(12)} ${idem ? "ok" : "FALHOU"}  (retry não duplica serviço nem jornada)`);
  ok = ok && bloqueou && idem;
  console.log(`\n  ${ok ? "SMOKE PASSOU: a política da oferta decide o ganho, e só ela" : "SMOKE FALHOU"}\n`);
  saida = ok ? 0 : 1;
  } finally {
    await db.execute(sql`DELETE FROM fulfillments WHERE servico_canonico_id IN (SELECT id FROM servicos_canonicos WHERE oportunidade_origem_id = ${op.id}::uuid)`);
    await db.execute(sql`DELETE FROM servicos_canonicos WHERE oportunidade_origem_id = ${op.id}::uuid`);
    await db.execute(sql`DELETE FROM timeline_events WHERE oportunidade_id = ${op.id}::uuid`);
    if (ct) await db.execute(sql`DELETE FROM contratos WHERE id = ${ct.id}::uuid`);
    await db.execute(sql`DELETE FROM oportunidades WHERE id = ${op.id}::uuid`);
    console.log("  banco limpo.\n");
  }
  process.exit(saida);
}
main().catch((e) => { console.error(e); process.exit(1); });
