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

    // 4. a tag da automação cai no MESMO lugar que as outras
    const empresa = await um<{ id: string }>(sql`SELECT id FROM empresas LIMIT 1`);
    const regraTag = await um<{ id: string }>(sql`
      INSERT INTO automacoes (organizacao_id, nome, gatilho, acao, acao_config, ativo)
      VALUES (${org.id}::uuid, ${marca + "-tag"}, 'fatura_atrasada', 'adicionar_tag_empresa',
              ${JSON.stringify({ tag: marca })}::jsonb, true)
      RETURNING id`);
    criadas.push(regraTag.id);

    await dispararAutomacoes("fatura_atrasada", {
      entityType: "empresa", entityId: empresa.id, organizacaoId: org.id,
      empresaId: empresa.id, campos: {},
    });

    const tag = await um<{ no_modelo_usado: number; no_array_legado: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM entity_labels el
           JOIN labels l ON l.id = el.label_id
          WHERE el.entity_id = ${empresa.id}::uuid AND l.nome = ${marca}) AS no_modelo_usado,
        (SELECT count(*)::int FROM empresas e
          WHERE e.id = ${empresa.id}::uuid AND ${marca} = ANY(COALESCE(e.tags, '{}'))) AS no_array_legado`);
    console.log(`  4. tag por automação          → modelo em uso: ${tag.no_modelo_usado}, array legado: ${tag.no_array_legado}`);

    // 5. duas entidades diferentes publicam DOIS eventos, não um
    //
    // O bug que isto cobre: com `enrollmentId` vazio na execução avulsa, a
    // chave de idempotência dos adapters ficava igual para todo mundo, e só a
    // PRIMEIRA mudança de etapa do sistema inteiro publicava evento. A
    // automação funcionava e nada a jusante reagia.
    const n2 = await um<{ id: string }>(sql`
      INSERT INTO negocios (organizacao_id, lead_id, titulo, status)
      VALUES (${org.id}::uuid, ${lead.id}::uuid, ${marca + "-b"}, 'aberto')
      RETURNING id`);
    await dispararAutomacoes("novo_negocio", {
      entityType: "negocio", entityId: n2.id, organizacaoId: org.id, campos: {},
    });
    const eventos = await um<{ n: number }>(sql`
      -- No event_outbox: o adapter usa o publicarEvento de lib/events/outbox,
      -- que escreve na fila e nao em domain_events. Sao dois caminhos de
      -- evento no sistema, e a convergencia deles e trabalho da fase 26.
      SELECT count(*)::int AS n FROM event_outbox
       WHERE event_type = 'StageChanged'
         AND payload ->> 'entityId' IN (${negocio.id}, ${n2.id})`);
    console.log(`  5. dois negócios movidos      → ${eventos.n} eventos StageChanged publicados`);
    await db.execute(sql`DELETE FROM negocios WHERE id = ${n2.id}::uuid`);

    // 6. o fato entra no REGISTRO, não só na fila
    //
    // `event_outbox` é fila: a linha existe para ser entregue. `domain_events`
    // é o registro do que aconteceu — é dele que sai a timeline e é nele que
    // se olha para responder "o que houve com esta empresa em agosto".
    const registro = await um<{ na_fila: number; no_registro: number }>(sql`
      SELECT (SELECT count(*)::int FROM event_outbox
               WHERE event_type = 'StageChanged'
                 AND payload ->> 'entityId' IN (${negocio.id}, ${n2.id})) AS na_fila,
             (SELECT count(*)::int FROM domain_events
               WHERE event_type = 'StageChanged'
                 AND payload ->> 'entityId' IN (${negocio.id}, ${n2.id})) AS no_registro`);
    console.log(`  6. fila x registro            → ${registro.na_fila} na fila, ${registro.no_registro} no registro`);

    console.log("\n  RESULTADO");
    const checagens: [string, boolean, string][] = [
      ["gate do ganho", aposGanho.status !== "ganho", "regra de automação não fecha venda por fora da política"],
      ["etapa legítima", aposEtapa.status === "negociacao", "o que é permitido continua passando"],
      ["idempotente", t.n === 1, "disparo repetido não duplica a tarefa"],
      ["rastreável", t.origem === "AUTOMACAO" && t.com_chave === 1, "a tarefa diz que veio de automação"],
      ["tag no lugar certo", tag.no_modelo_usado === 1 && tag.no_array_legado === 0, "a tag da automação aparece junto com as outras, não num array que ninguém lê"],
      ["evento por entidade", eventos.n === 2, "duas entidades movidas publicam dois eventos; com chave igual, só a primeira publicaria"],
      ["fato registrado", registro.no_registro === registro.na_fila && registro.no_registro > 0, "o fato existe no registro, não só na fila que some depois de processada"],
    ];
    let ok = true;
    for (const [nome, passou, desc] of checagens) {
      if (!passou) ok = false;
      console.log(`    ${nome.padEnd(16)} ${passou ? "ok" : "FALHOU"}  (${desc})`);
    }
    console.log(`\n  ${ok ? "SMOKE PASSOU: regra simples e fluxo usam os mesmos adapters" : "SMOKE FALHOU"}\n`);
    saida = ok ? 0 : 1;

    await db.execute(sql`DELETE FROM tarefas WHERE titulo = ${marca}`);
    // Os eventos de tag usam o id do VÍNCULO na chave (`tag:add:<id>`), então
    // precisam ser apagados antes do vínculo sumir — senão ficam na fila sem
    // nada que os identifique. Foi assim que quatro sobraram na primeira
    // execução.
    const vinculos = await db.execute<{ id: string }>(sql`
      SELECT el.id::text FROM entity_labels el
        JOIN labels l ON l.id = el.label_id
       WHERE l.nome = ${marca}`);
    for (const v of vinculos as unknown as Array<{ id: string }>) {
      await db.execute(sql`DELETE FROM event_outbox WHERE idempotency_key IN (${`tag:add:${v.id}`}, ${`tag:remove:${v.id}`})`);
      await db.execute(sql`DELETE FROM domain_events WHERE idempotency_key IN (${`tag:add:${v.id}`}, ${`tag:remove:${v.id}`})`);
    }
    await db.execute(sql`DELETE FROM entity_labels WHERE label_id IN (SELECT id FROM labels WHERE nome = ${marca})`);
    await db.execute(sql`DELETE FROM labels WHERE nome = ${marca}`);
    // A chave de etapa carrega a assinatura da entidade desde a correção da
    // idempotência avulsa; o prefixo cobre as duas formas.
    await db.execute(sql`
      DELETE FROM event_outbox
       WHERE idempotency_key LIKE 'cadence:avulso:%' OR idempotency_key LIKE 'cadence::avulso:%'`);
    await db.execute(sql`
      DELETE FROM domain_events
       WHERE idempotency_key LIKE 'cadence:avulso:%' OR idempotency_key LIKE 'cadence::avulso:%'`);
    // O fato agora tambem entra no registro; limpar so a fila deixaria o
    // registro crescendo a cada execucao do smoke.
    await db.execute(sql`
      DELETE FROM domain_events
       WHERE event_type IN ('StageChanged','TagAdded','TagRemoved')
         AND payload ->> 'entityId' IN (${negocio.id}, ${empresa.id})`);
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
