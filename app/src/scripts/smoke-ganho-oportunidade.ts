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

  // O Won cria UMA jornada: o onboarding. A implantação de PABX/White Label
  // nasce no handoff (Documento Mestre v0.13 §06.1) — o bloco abaixo prova
  // isso, e prova que ela não nasce antes do gate.
  const esperado = { servicos: "1", jornadas: "1", timeline: "1" };
  console.log(`\n  RESULTADO`);
  let ok = true;
  for (const [k, esp] of Object.entries(esperado)) {
    const bateu = v[0][k] === esp;
    if (!bateu) ok = false;
    console.log(`    ${k.padEnd(12)} ${v[0][k]}  (esperado ${esp})  ${bateu ? "ok" : "FALHOU"}`);
  }
  // ── A implantação nasce no handoff, não no ganho ────────────────────────
  const [onb] = await db.execute<{ id: string; tipo: string }>(sql`
    SELECT f.id::text, f.tipo FROM fulfillments f
      JOIN servicos_canonicos s ON s.id = f.servico_canonico_id
     WHERE s.oportunidade_origem_id = ${op.id}::uuid`);
  const soOnboarding = onb?.tipo === "ONBOARDING";
  console.log(`    ${"tipo".padEnd(12)} ${onb?.tipo}  (esperado ONBOARDING)  ${soOnboarding ? "ok" : "FALHOU"}`);

  const { verificarHandoff, entregarParaImplantacao } = await import("@/lib/pos-venda/handoff-implantacao");
  const antes = onb ? await verificarHandoff(String(org.id), onb.id) : null;
  const bloqueiaSemGate = antes ? !antes.pronto && antes.falta.length > 0 : false;
  console.log(`    ${"gate".padEnd(12)} ${antes?.falta.join(", ") || "-"}  ${bloqueiaSemGate ? "ok" : "FALHOU"}  (handoff exige kickoff, material e implantador)`);

  const recusado = onb ? await entregarParaImplantacao({ organizacaoId: String(org.id), fulfillmentId: onb.id }) : { ok: true };
  const naoCriouSemGate = !recusado.ok;
  console.log(`    ${"recusa".padEnd(12)} ${naoCriouSemGate ? "ok" : "FALHOU"}  (sem o gate, não cria implantação)`);

  // Agora satisfaz o gate e prova que a implantação NASCE.
  let criouComGate = false, fechouOnboarding = false, idemHandoff = false;
  if (onb) {
    const [u] = await db.execute<{ id: string }>(sql`SELECT id FROM usuarios WHERE ativo = true LIMIT 1`);
    await db.execute(sql`
      INSERT INTO fulfillment_itens (organizacao_id, fulfillment_id, workstream, titulo, status, ordem, completed_at)
      VALUES (${org.id}::uuid, ${onb.id}::uuid, 'kickoff', 'Reunião de kickoff', 'DONE', 0, now()),
             (${org.id}::uuid, ${onb.id}::uuid, 'kickoff', 'Material enviado ao cliente', 'DONE', 1, now())`);
    await db.execute(sql`UPDATE fulfillments SET responsavel_id = ${u.id}::uuid WHERE id = ${onb.id}::uuid`);

    const r1 = await entregarParaImplantacao({ organizacaoId: String(org.id), fulfillmentId: onb.id, atorId: String(u.id) });
    criouComGate = r1.ok && Boolean(r1.implantacaoId) && !r1.jaExistia;
    console.log(`    ${"handoff".padEnd(12)} ${criouComGate ? "ok" : "FALHOU"}  (com kickoff, material e implantador, a implantação nasce)`);

    const [depois] = await db.execute<{ status: string }>(sql`SELECT status FROM fulfillments WHERE id = ${onb.id}::uuid`);
    fechouOnboarding = depois?.status === "COMPLETED";
    console.log(`    ${"onboarding".padEnd(12)} ${depois?.status}  ${fechouOnboarding ? "ok" : "FALHOU"}  (o onboarding de transição fecha ao entregar)`);

    const r2 = await entregarParaImplantacao({ organizacaoId: String(org.id), fulfillmentId: onb.id, atorId: String(u.id) });
    const [n] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM fulfillments f JOIN servicos_canonicos s ON s.id = f.servico_canonico_id
       WHERE s.oportunidade_origem_id = ${op.id}::uuid AND f.tipo = 'IMPLEMENTATION'`);
    idemHandoff = r2.ok && Boolean(r2.jaExistia) && n.n === 1;
    console.log(`    ${"idem-handoff".padEnd(12)} ${n.n} implantação(ões)  ${idemHandoff ? "ok" : "FALHOU"}  (reexecutar não duplica)`);
  }

  const bloqueou = !semNada.ok && (semNada as { codigo: string }).codigo === "CONDICAO_NAO_ATENDIDA";
  const idem = denovo.ok && denovo.dados.motivo === "já estava ganha";
  console.log(`    ${"bloqueio".padEnd(12)} ${bloqueou ? "ok" : "FALHOU"}  (contrato não assinado não ganha)`);
  console.log(`    ${"idempotente".padEnd(12)} ${idem ? "ok" : "FALHOU"}  (retry não duplica serviço nem jornada)`);
  ok = ok && bloqueou && idem && soOnboarding && bloqueiaSemGate && naoCriouSemGate
    && criouComGate && fechouOnboarding && idemHandoff;
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
