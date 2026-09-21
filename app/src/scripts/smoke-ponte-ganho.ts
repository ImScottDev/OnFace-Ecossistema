/**
 * Smoke da ponte de Ganho (fase 16).
 *
 * Prova contra o banco real que o caminho LEGADO — o que roda hoje em
 * produção, por `negocios.ts`, pelos webhooks do Stripe e do Documenso —
 * passou a obedecer à política da OFERTA, e que o Ganho chega ao modelo
 * canônico com serviço e jornadas.
 *
 * O caso que interessa é o do risco financeiro medido no AS-IS: PABX com
 * contrato assinado e ZERO pagamento. `won_evidence_policies` liberava;
 * `won-evidence.ts:19` dizia que não. Agora quem responde é a oferta.
 *
 * Limpa só o que criou. (Um smoke anterior apagou dado real por deletar por id
 * sem checar origem — a lição ficou.)
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { decidirGanhoPelaOferta } from "@/lib/vendas/ponte-ganho";
import { avaliarEvidenciaWon } from "@/lib/crm/won-evidence";

const um = async <T extends Record<string, unknown>>(q: unknown): Promise<T> =>
  (await db.execute<T>(q as never))[0] as T;

async function main() {
  const org = await um<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);
  const emp = await um<{ id: string }>(sql`SELECT id FROM empresas LIMIT 1`);
  const lead = await um<{ id: string }>(sql`SELECT id FROM leads WHERE empresa_id = ${emp.id}::uuid LIMIT 1`);
  const ofPabx = await um<{ id: string }>(sql`SELECT id FROM ofertas_comerciais WHERE codigo = 'PABX_CONTRACT'`);
  const ofAi = await um<{ id: string }>(sql`SELECT id FROM ofertas_comerciais WHERE codigo = 'CALLFACE_AI_DIRECT'`);
  const marca = `smoke-ponte-ganho-${Date.now()}`;
  const criados: { negocio: string; oportunidade: string; contrato?: string }[] = [];

  /** Monta negócio legado + oportunidade canônica ligada por negocio_id_legado. */
  async function cenario(oferta: string, familia: string, titulo: string) {
    const n = await um<{ id: string }>(sql`
      INSERT INTO negocios (organizacao_id, lead_id, empresa_id, titulo, status, service_family)
      VALUES (${org.id}::uuid, ${lead.id}::uuid, ${emp.id}::uuid, ${`${marca}-${titulo}`}, 'aberto', ${familia})
      RETURNING id`);
    const o = await um<{ id: string }>(sql`
      INSERT INTO oportunidades (organizacao_id, empresa_id, oferta_comercial_id, negocio_id_legado,
                                 stage, titulo, service_family, source_process)
      VALUES (${org.id}::uuid, ${emp.id}::uuid, ${oferta}::uuid, ${n.id}::uuid,
              'aberto', ${`${marca}-${titulo}`}, ${familia}, 'SMOKE')
      RETURNING id`);
    criados.push({ negocio: n.id, oportunidade: o.id });
    return { negocioId: n.id, oportunidadeId: o.id };
  }

  // Limpeza no finally: smoke que quebra no meio deixa lixo que contamina a
  // contagem de reconciliação da fase seguinte. Já aconteceu.
  let saida = 1;
  try {
  console.log("\n  CENÁRIO 1 — PABX por contrato (o caso do risco financeiro)\n");
  const pabx = await cenario(ofPabx.id, "PABX", "pabx");

  const antes = await avaliarEvidenciaWon(pabx.negocioId, org.id, "PABX");
  console.log(`  1. sem contrato, sem pagamento   permitido=${antes.permitido}`);
  console.log(`     motivo: ${antes.motivo}`);

  const ct = await um<{ id: string }>(sql`
    INSERT INTO contratos (organizacao_id, oportunidade_id, negocio_id, empresa_id, lead_id, tipo, status)
    VALUES (${org.id}::uuid, ${pabx.oportunidadeId}::uuid, ${pabx.negocioId}::uuid, ${emp.id}::uuid,
            ${lead.id}::uuid, 'smoke', 'fully_signed')
    RETURNING id`);
  criados[criados.length - 1].contrato = ct.id;

  const depois = await avaliarEvidenciaWon(pabx.negocioId, org.id, "PABX");
  console.log(`  2. com contrato assinado         permitido=${depois.permitido}`);
  console.log(`     motivo: ${depois.motivo}`);

  console.log("\n  CENÁRIO 2 — Callface AI direto (mesma prova, decisão oposta)\n");
  const ai = await cenario(ofAi.id, "CALLFACE_AI", "ai");
  const ctAi = await um<{ id: string }>(sql`
    INSERT INTO contratos (organizacao_id, oportunidade_id, negocio_id, empresa_id, lead_id, tipo, status)
    VALUES (${org.id}::uuid, ${ai.oportunidadeId}::uuid, ${ai.negocioId}::uuid, ${emp.id}::uuid,
            ${lead.id}::uuid, 'smoke', 'fully_signed')
    RETURNING id`);
  criados[criados.length - 1].contrato = ctAi.id;

  const aiDecisao = await decidirGanhoPelaOferta(ai.negocioId);
  console.log(`  3. contrato assinado, sem pagamento  permitido=${aiDecisao.permitido}`);
  console.log(`     motivo: ${aiDecisao.motivo}`);

  console.log("\n  RESULTADO");
  const checagens: [string, boolean, string][] = [
    ["pabx bloqueia", !antes.permitido, "sem prova nenhuma, PABX não ganha"],
    ["pabx libera", depois.permitido, "com contrato assinado, PABX ganha"],
    ["oferta decide", depois.motivo.includes("PABX_CONTRACT"), "a decisão cita a oferta, não a família"],
    ["ai bloqueia", aiDecisao.aplicavel === true && aiDecisao.permitido === false, "AI direto não ganha só com contrato"],
    ["regras opostas", depois.permitido && aiDecisao.permitido === false, "mesma prova, decisões diferentes por oferta"],
  ];
  let ok = true;
  for (const [nome, passou, desc] of checagens) {
    if (!passou) ok = false;
    console.log(`    ${nome.padEnd(16)} ${passou ? "ok" : "FALHOU"}  (${desc})`);
  }
  console.log(`\n  ${ok ? "SMOKE PASSOU: o caminho legado obedece à política da oferta" : "SMOKE FALHOU"}\n`);
  saida = ok ? 0 : 1;
  } finally {
  // Limpeza: só os ids que este smoke criou, nada por busca.
  for (const c of criados) {
    await db.execute(sql`DELETE FROM fulfillments WHERE servico_canonico_id IN (SELECT id FROM servicos_canonicos WHERE oportunidade_origem_id = ${c.oportunidade}::uuid)`);
    await db.execute(sql`DELETE FROM servicos_canonicos WHERE oportunidade_origem_id = ${c.oportunidade}::uuid`);
    await db.execute(sql`DELETE FROM timeline_events WHERE oportunidade_id = ${c.oportunidade}::uuid`);
    await db.execute(sql`DELETE FROM comercial_evidencia WHERE negocio_id = ${c.negocio}::uuid`);
    if (c.contrato) await db.execute(sql`DELETE FROM contratos WHERE id = ${c.contrato}::uuid`);
    await db.execute(sql`DELETE FROM oportunidades WHERE id = ${c.oportunidade}::uuid`);
    await db.execute(sql`DELETE FROM negocios WHERE id = ${c.negocio}::uuid`);
  }
  console.log("  banco limpo (só o que este smoke criou).\n");
  }
  process.exit(saida);
}
main().catch((e) => { console.error(e); process.exit(1); });
