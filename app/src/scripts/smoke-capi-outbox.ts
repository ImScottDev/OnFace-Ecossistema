/**
 * Smoke da cadeia real: fato → outbox → worker → Meta (SPEC §20).
 *
 * Os outros smokes provam as peças. Este prova a **junta**: um fato de negócio
 * acontece, o evento nasce na mesma transação, o consumidor do worker pega, e a
 * conversão chega na Meta com auditoria.
 *
 * É o que distingue "o adapter funciona" de "a integração funciona" — e a
 * diferença entre os dois foi o defeito que a revisão da fase 20 encontrou.
 *
 * Prova também a regra que mais importa para não mentir o CAC da Meta: um fato
 * IDÊNTICO, sem touchpoint dela, NÃO é entregue.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { publicarEvento } from "@onface/platform-events";
import { processarEventosPendentes } from "@/lib/events/consumer";

const um = async <T extends Record<string, unknown>>(q: unknown): Promise<T> =>
  (await db.execute<T>(q as never))[0] as T;

async function main() {
  const org = await um<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);
  const marca = `smoke-capi-${Date.now()}`;
  const criados: { pessoa?: string; aquisicao?: string; touchpoint?: string }[] = [];
  let saida = 1;

  /**
   * Monta uma identidade com ou sem touchpoint da Meta.
   *
   * Cada objeto é registrado para limpeza ASSIM QUE criado, não ao fim da
   * função. Registrar no fim deixa órfão tudo que foi criado antes do passo que
   * falhou — aconteceu aqui na primeira execução, e o teste de reconciliação da
   * fase 05 é que apareceria depois cobrando a pessoa sem provenance.
   */
  async function cenario(comMeta: boolean, sufixo: string) {
    const registro: { pessoa?: string; aquisicao?: string; touchpoint?: string } = {};
    criados.push(registro);

    const pessoa = await um<{ id: string }>(sql`
      INSERT INTO pessoas (organizacao_id, nome, email, telefone)
      VALUES (${org.id}::uuid, ${`${marca}-${sufixo}`}, ${`${marca}-${sufixo}@teste.local`}, '11955551111')
      RETURNING id`);
    registro.pessoa = pessoa.id;

    const aquisicao = await um<{ id: string }>(sql`
      INSERT INTO aquisicoes (organizacao_id, pessoa_id, tipo, origem)
      VALUES (${org.id}::uuid, ${pessoa.id}::uuid, 'INBOUND', ${comMeta ? "Mídia Paga" : "Outbound"})
      RETURNING id`);
    registro.aquisicao = aquisicao.id;

    const touchpoint = await um<{ id: string }>(sql`
      INSERT INTO pontos_contato (organizacao_id, pessoa_id, aquisicao_id, source, medium,
                                  tipo_origem, meta_lead_id, campaign_id, is_first_touch, ocorrido_em)
      VALUES (${org.id}::uuid, ${pessoa.id}::uuid, ${aquisicao.id}::uuid,
              ${comMeta ? "meta" : "apollo"}, ${comMeta ? "paid_social" : "outbound"},
              ${comMeta ? "paga" : "organica"},
              ${comMeta ? `lead-${marca}` : null}, ${comMeta ? `camp-${marca}` : null},
              true, now())
      RETURNING id`);
    registro.touchpoint = touchpoint.id;
    return { pessoaId: pessoa.id, aquisicaoId: aquisicao.id };
  }

  try {
    console.log("");
    // CENÁRIO 1: veio da Meta.
    const daMeta = await cenario(true, "meta");
    await db.transaction(async (tx) => {
      await publicarEvento(tx as never, sql as never, {
        organizacaoId: org.id,
        eventType: "AcquisitionCreated",
        aggregateType: "aquisicao",
        aggregateId: daMeta.aquisicaoId,
        actorType: "INTEGRATION",
        source: "smoke",
        idempotencyKey: `${marca}:meta`,
        payload: { pessoa_id: daMeta.pessoaId, aquisicao_id: daMeta.aquisicaoId },
        entregarExternamente: true,
      });
    });

    // CENÁRIO 2: o MESMO fato, sem touchpoint da Meta.
    const semMeta = await cenario(false, "outbound");
    await db.transaction(async (tx) => {
      await publicarEvento(tx as never, sql as never, {
        organizacaoId: org.id,
        eventType: "AcquisitionCreated",
        aggregateType: "aquisicao",
        aggregateId: semMeta.aquisicaoId,
        actorType: "INTEGRATION",
        source: "smoke",
        idempotencyKey: `${marca}:outbound`,
        payload: { pessoa_id: semMeta.pessoaId, aquisicao_id: semMeta.aquisicaoId },
        entregarExternamente: true,
      });
    });

    const antes = await um<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM event_outbox WHERE idempotency_key LIKE ${marca + "%"}`);
    console.log(`  1. dois fatos no outbox                ${antes.n} pendentes`);

    // O worker processa — é ele que dispara a entrega.
    const proc = await processarEventosPendentes(20);
    console.log(`  2. consumidor rodou                    processados=${proc.processados} falhados=${proc.falhados}`);

    const entregas = await um<{ total: number; entregues: number; sem_touchpoint: number; event_ids: string }>(sql`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE e.entregue)::int AS entregues,
             count(*) FILTER (WHERE e.motivo = 'sem_touchpoint_meta')::int AS sem_touchpoint,
             COALESCE(string_agg(e.event_id, ' | '), '') AS event_ids
        FROM meta_capi_entregas e
        JOIN event_outbox o ON o.id = e.outbox_id
       WHERE o.idempotency_key LIKE ${marca + "%"}`);
    console.log(`  3. entregas registradas                ${entregas.total} (${entregas.entregues} com sucesso)`);
    if (entregas.event_ids) console.log(`     event_id: ${entregas.event_ids}`);

    // O fato sem touchpoint Meta não vira linha de auditoria nem entrega: ele é
    // descartado antes, e isso é o comportamento certo.
    const outboundEntregue = await um<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM meta_capi_entregas e
        JOIN event_outbox o ON o.id = e.outbox_id
       WHERE o.idempotency_key = ${marca + ":outbound"} AND e.entregue`);
    console.log(`  4. o fato SEM touchpoint Meta          entregue=${outboundEntregue.n > 0}`);

    console.log("\n  RESULTADO");
    const checagens: [string, boolean, string][] = [
      ["a cadeia fecha", entregas.entregues === 1, "o fato virou conversão na Meta, passando pelo worker"],
      ["só o que veio", outboundEntregue.n === 0, "outbound puro não é devolvido como conversão da Meta"],
      ["auditado", entregas.total >= 1, "existe resposta para 'esse evento chegou na Meta?'"],
      ["id determinístico", entregas.event_ids.includes("onface:Lead:"), "o event_id sai do evento de domínio, e a Meta deduplica por ele"],
      ["worker não travou", proc.falhados === 0, "a entrega à Meta não derruba o processamento do evento"],
    ];
    let ok = true;
    for (const [nome, passou, desc] of checagens) {
      if (!passou) ok = false;
      console.log(`    ${nome.padEnd(20)} ${passou ? "ok" : "FALHOU"}  (${desc})`);
    }
    console.log(`\n  ${ok ? "SMOKE PASSOU: o fato chega na Meta pelo caminho de verdade" : "SMOKE FALHOU"}\n`);
    saida = ok ? 0 : 1;
  } finally {
    await db.execute(sql`
      DELETE FROM meta_capi_entregas WHERE outbox_id IN
        (SELECT id FROM event_outbox WHERE idempotency_key LIKE ${marca + "%"})`);
    await db.execute(sql`DELETE FROM event_outbox WHERE idempotency_key LIKE ${marca + "%"}`);
    await db.execute(sql`DELETE FROM domain_events WHERE idempotency_key LIKE ${marca + "%"}`);
    // A ordem é a inversa da criação, e cada passo tolera o registro parcial de
    // uma execução que morreu no meio.
    for (const c of criados) {
      if (c.touchpoint) await db.execute(sql`DELETE FROM pontos_contato WHERE id = ${c.touchpoint}::uuid`);
      if (c.aquisicao) await db.execute(sql`DELETE FROM aquisicoes WHERE id = ${c.aquisicao}::uuid`);
      if (c.pessoa) {
        await db.execute(sql`DELETE FROM pontos_contato WHERE pessoa_id = ${c.pessoa}::uuid`);
        await db.execute(sql`DELETE FROM aquisicoes WHERE pessoa_id = ${c.pessoa}::uuid`);
        await db.execute(sql`DELETE FROM pessoa_empresa_vinculos WHERE pessoa_id = ${c.pessoa}::uuid`);
        await db.execute(sql`DELETE FROM pessoas WHERE id = ${c.pessoa}::uuid`);
      }
    }
    console.log("  banco limpo (só o que este smoke criou).\n");
  }
  process.exit(saida);
}
main().catch((e) => { console.error(e); process.exit(1); });
