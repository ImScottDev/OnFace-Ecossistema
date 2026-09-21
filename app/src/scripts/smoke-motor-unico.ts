/**
 * Smoke do motor único de automação (SPEC §18).
 *
 * O SPEC proíbe manter motores duplicados depois do cutover. Havia dois:
 * `cadencia/cadence-engine.ts`, que executa fluxo com espera e ramificação, e
 * `crm/automacao-engine.ts`, que executava regra simples com implementação
 * PRÓPRIA de cada ação.
 *
 * As duas cópias já tinham divergido, e a divergência era perigosa: o adapter
 * do motor de fluxo recusa mover para Ganho ("Won exige o gate comercial de
 * pagamento/assinatura"), e a cópia do motor de regras fazia
 * `update negocios set status = 'ganho'` direto. Uma regra de automação podia
 * fechar venda por fora da política da oferta inteira.
 *
 * Este smoke prova, contra o banco real, que a regra simples agora passa pelos
 * mesmos adapters — inclusive pelo gate.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { dispararAutomacoes } from "@/lib/crm/automacao-engine";
import { adaptersRegistrados } from "@/lib/cadencia/cadence-engine";

const um = async <T extends Record<string, unknown>>(q: unknown): Promise<T> =>
  (await db.execute<T>(q as never))[0] as T;

async function main() {
  const org = await um<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);
  const lead = await um<{ id: string }>(sql`SELECT id FROM leads LIMIT 1`);
  const marca = `smoke-motor-${Date.now()}`;
  const criadas: string[] = [];
  let saida = 1;

  try {
    console.log(`\n  adapters registrados: ${adaptersRegistrados().length}\n`);

    // 1. regra que tenta fechar a venda por fora da política
    const negocio = await um<{ id: string; status: string }>(sql`
      INSERT INTO negocios (organizacao_id, lead_id, titulo, status)
      VALUES (${org.id}::uuid, ${lead.id}::uuid, ${marca}, 'aberto')
      RETURNING id, status`);

    const regraGanho = await um<{ id: string }>(sql`
      INSERT INTO automacoes (organizacao_id, nome, gatilho, acao, acao_config, ativo)
      VALUES (${org.id}::uuid, ${marca + "-ganho"}, 'mudanca_status', 'mudar_status',
              ${JSON.stringify({ novoStatus: "ganho" })}::jsonb, true)
      RETURNING id`);
    criadas.push(regraGanho.id);

    await dispararAutomacoes("mudanca_status", {
      entityType: "negocio", entityId: negocio.id, organizacaoId: org.id, campos: {},
    });
    const aposGanho = await um<{ status: string }>(sql`SELECT status FROM negocios WHERE id = ${negocio.id}::uuid`);
    console.log(`  1. regra tentando mover para 'ganho'  → status ficou '${aposGanho.status}'`);

    // 2. a mesma regra, para uma etapa legítima, passa
    const regraEtapa = await um<{ id: string }>(sql`
      INSERT INTO automacoes (organizacao_id, nome, gatilho, acao, acao_config, ativo)
      VALUES (${org.id}::uuid, ${marca + "-etapa"}, 'novo_negocio', 'mudar_status',
              ${JSON.stringify({ novoStatus: "negociacao" })}::jsonb, true)
      RETURNING id`);
    criadas.push(regraEtapa.id);

    await dispararAutomacoes("novo_negocio", {
      entityType: "negocio", entityId: negocio.id, organizacaoId: org.id, campos: {},
    });
    const aposEtapa = await um<{ status: string }>(sql`SELECT status FROM negocios WHERE id = ${negocio.id}::uuid`);
    console.log(`  2. regra movendo para 'negociacao'    → status ficou '${aposEtapa.status}'`);

    // 3. a tarefa criada pela regra tem idempotência e vínculo
    const regraTarefa = await um<{ id: string }>(sql`
      INSERT INTO automacoes (organizacao_id, nome, gatilho, acao, acao_config, ativo)
      VALUES (${org.id}::uuid, ${marca + "-tarefa"}, 'novo_lead', 'criar_tarefa',
              ${JSON.stringify({ tituloTarefa: marca })}::jsonb, true)
      RETURNING id`);
    criadas.push(regraTarefa.id);

    for (let i = 0; i < 2; i++) {
      await dispararAutomacoes("novo_lead", {
        entityType: "lead", entityId: lead.id, organizacaoId: org.id, campos: {},
      });
    }
    const t = await um<{ n: number; origem: string | null; com_chave: number }>(sql`
      SELECT count(*)::int AS n, min(origem) AS origem,
             count(chave_idempotencia)::int AS com_chave
        FROM tarefas WHERE titulo = ${marca}`);
    console.log(`  3. regra disparada 2x criou ${t.n} tarefa(s), origem=${t.origem}, com chave=${t.com_chave}`);

    console.log("\n  RESULTADO");
    const checagens: [string, boolean, string][] = [
      ["gate do ganho", aposGanho.status !== "ganho", "regra de automação não fecha venda por fora da política"],
      ["etapa legítima", aposEtapa.status === "negociacao", "o que é permitido continua passando"],
      ["idempotente", t.n === 1, "disparo repetido não duplica a tarefa"],
      ["rastreável", t.origem === "AUTOMACAO" && t.com_chave === 1, "a tarefa diz que veio de automação"],
    ];
    let ok = true;
    for (const [nome, passou, desc] of checagens) {
      if (!passou) ok = false;
      console.log(`    ${nome.padEnd(16)} ${passou ? "ok" : "FALHOU"}  (${desc})`);
    }
    console.log(`\n  ${ok ? "SMOKE PASSOU: regra simples e fluxo usam os mesmos adapters" : "SMOKE FALHOU"}\n`);
    saida = ok ? 0 : 1;

    await db.execute(sql`DELETE FROM tarefas WHERE titulo = ${marca}`);
    await db.execute(sql`DELETE FROM negocios WHERE id = ${negocio.id}::uuid`);
  } finally {
    for (const id of criadas) {
      await db.execute(sql`DELETE FROM automacao_execucoes WHERE automacao_id = ${id}::uuid`);
      await db.execute(sql`DELETE FROM automacoes WHERE id = ${id}::uuid`);
    }
    await db.execute(sql`DELETE FROM domain_events WHERE idempotency_key LIKE ${marca + "%"}`);
    await db.execute(sql`DELETE FROM event_outbox WHERE idempotency_key LIKE ${marca + "%"}`);
    console.log("  banco limpo (só o que este smoke criou).\n");
  }
  process.exit(saida);
}
main().catch((e) => { console.error(e); process.exit(1); });
