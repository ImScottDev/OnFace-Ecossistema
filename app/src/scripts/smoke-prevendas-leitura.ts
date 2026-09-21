/**
 * Smoke das ações de pré-vendas contra a leitura canônica (SPEC §17).
 *
 * Mesmo risco do pipeline, em oito ações: o board passou a LER `aquisicoes` e
 * as ações continuam ESCREVENDO em `leads`. Se a propagação não cobrir o que a
 * leitura usa, o usuário qualifica, salva, e o card não sai do lugar.
 *
 * Este smoke exercita as ações de verdade, pelo módulo de domínio, e consulta o
 * BOARD para ver em qual coluna o card aparece depois de cada uma.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { qualificar, nutrir, desqualificar, atribuirResponsavel } from "@/lib/vendas/pre-vendas";
import { garantirEntradaCanonica } from "@/lib/vendas/ponte-canonica";
import { boardPreVendas } from "@/lib/vendas/consultas";

const um = async <T extends Record<string, unknown>>(q: unknown): Promise<T> =>
  (await db.execute<T>(q as never))[0] as T;

async function main() {
  const org = await um<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);
  const usuario = await um<{ id: string }>(sql`SELECT id FROM usuarios WHERE ativo = true LIMIT 1`);
  const marca = `smoke-pv-${Date.now()}`;
  const ator = { tipo: "HUMAN" as const, usuarioId: usuario.id };
  let leadId: string | null = null;
  let aquisicaoId: string | null = null;
  let pessoaId: string | null = null;
  let saida = 1;

  /** Em qual coluna o board mostra este lead, se mostrar. */
  async function colunaDoCard(aba: "ativos" | "nutricao" | "desqualificados") {
    const b = await boardPreVendas(org.id, { aba });
    for (const c of b.colunas) if (c.cards.some((x) => x.leadId === leadId)) return c.chave;
    return null;
  }

  try {
    const lead = await um<{ id: string }>(sql`
      INSERT INTO leads (organizacao_id, nome, email, telefone, origem, status, tipo, estagio_pre_vendas)
      VALUES (${org.id}::uuid, ${marca}, ${marca + "@teste.local"}, '11955554444',
              'Mídia Paga', 'novo', 'contato', 'novo')
      RETURNING id`);
    leadId = lead.id;

    const entrada = await garantirEntradaCanonica({
      organizacaoId: org.id, tipo: "INBOUND", origem: "Mídia Paga", provider: "smoke",
      pessoa: { nome: marca, email: `${marca}@teste.local`, telefone: "11955554444" },
      idempotencyKey: marca,
    }, lead.id);
    aquisicaoId = entrada.aquisicaoId ?? null;
    // A pessoa criada pela porta canônica NÃO tem `lead_id_legado` (só o
    // backfill preenche esse campo), então limpar por ele deixaria uma pessoa
    // órfã. O teste de reconciliação da fase 05 pegou isso na primeira
    // execução: "1 pessoas sem provenance: apareceram do nada".
    pessoaId = entrada.pessoaId ?? null;
    await db.execute(sql`UPDATE aquisicoes SET lead_legado_id = ${lead.id}::uuid WHERE id = ${aquisicaoId}::uuid`);

    console.log(`\n  0. entrada criada             → board: ${await colunaDoCard("ativos")}`);

    await atribuirResponsavel({ organizacaoId: org.id, leadId: lead.id, responsavelId: usuario.id, ator });
    const dono = await um<{ r: string | null }>(sql`SELECT responsavel_id::text AS r FROM aquisicoes WHERE id = ${aquisicaoId}::uuid`);
    console.log(`  1. atribuir responsável       → aquisição tem dono: ${Boolean(dono.r)}`);

    await qualificar({ organizacaoId: org.id, leadId: lead.id, ator });
    const aposQualificar = await colunaDoCard("ativos");
    console.log(`  2. qualificar                 → board: ${aposQualificar}`);

    // A nutrição exige data de retomada: sem ela o lead sairia da operação sem
    // volta marcada, e a regra de negócio barra isso.
    const retomar = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    await nutrir({ organizacaoId: org.id, leadId: lead.id, motivo: "sem_orcamento", retomarEm: retomar, ator });
    const aposNutrir = await colunaDoCard("nutricao");
    console.log(`  3. nutrir                     → board (aba nutrição): ${aposNutrir}`);

    await desqualificar({ organizacaoId: org.id, leadId: lead.id, motivo: "sem_fit", ator });
    const aposDesq = await colunaDoCard("desqualificados");
    const aindaEmAtivos = await colunaDoCard("ativos");
    console.log(`  4. desqualificar              → board (aba desq.): ${aposDesq}, ainda em ativos: ${aindaEmAtivos}`);

    // 5. o fato comercial virou evento canônico e chegou ao outbox
    const canonico = await um<{ dominio: number; outbox: number; tipos: string }>(sql`
      SELECT (SELECT count(*)::int FROM domain_events d
                WHERE d.payload ->> 'lead_legado_id' = ${leadId}) AS dominio,
             (SELECT count(*)::int FROM event_outbox o
                WHERE o.payload ->> 'lead_legado_id' = ${leadId}) AS outbox,
             (SELECT COALESCE(string_agg(DISTINCT d.event_type, ', '), '') FROM domain_events d
                WHERE d.payload ->> 'lead_legado_id' = ${leadId}) AS tipos`);
    console.log(`  5. eventos canônicos gerados  → ${canonico.dominio} em domain_events, ${canonico.outbox} no outbox`);
    console.log(`     tipos: ${canonico.tipos || "(nenhum)"}`);

    console.log("\n  RESULTADO");
    const checagens: [string, boolean, string][] = [
      ["dono propaga", Boolean(dono.r), "atribuir responsável aparece na aquisição"],
      ["qualificar move", aposQualificar === "qualificado", "o card sai de Novo ao qualificar"],
      ["nutrir move", aposNutrir === "nutricao", "o card aparece na aba de nutrição"],
      ["desqualificar move", aposDesq === "desqualificado", "o card aparece na aba de desqualificados"],
      ["sai de ativos", aindaEmAtivos === null, "lead desqualificado não fica no board ativo"],
      ["evento canônico", canonico.dominio > 0, "o fato comercial alimenta automação e integração, não só a linha do tempo"],
      ["qualificação sai", canonico.tipos.includes("AcquisitionQualified"), "AcquisitionQualified é o que vira QualifiedLead na Meta — sem ele, otimiza-se por volume de formulário"],
    ];
    let ok = true;
    for (const [nome, passou, desc] of checagens) {
      if (!passou) ok = false;
      console.log(`    ${nome.padEnd(20)} ${passou ? "ok" : "FALHOU"}  (${desc})`);
    }
    console.log(`\n  ${ok ? "SMOKE PASSOU: cada ação de pré-vendas move o card de verdade" : "SMOKE FALHOU"}\n`);
    saida = ok ? 0 : 1;
  } finally {
    if (leadId) {
      await db.execute(sql`DELETE FROM vendas_eventos WHERE lead_id = ${leadId}::uuid`);
      await db.execute(sql`DELETE FROM atividades WHERE lead_id = ${leadId}::uuid`);
      await db.execute(sql`DELETE FROM status_changes WHERE lead_id = ${leadId}::uuid`);
      await db.execute(sql`DELETE FROM tarefas WHERE lead_id = ${leadId}::uuid`);
      await db.execute(sql`DELETE FROM pontos_contato WHERE lead_id_legado = ${leadId}::uuid`);
      if (aquisicaoId) await db.execute(sql`DELETE FROM aquisicoes WHERE id = ${aquisicaoId}::uuid`);
      if (pessoaId) {
        await db.execute(sql`DELETE FROM pessoa_empresa_vinculos WHERE pessoa_id = ${pessoaId}::uuid`);
        await db.execute(sql`DELETE FROM pessoas WHERE id = ${pessoaId}::uuid`);
      }
      await db.execute(sql`DELETE FROM pessoas WHERE lead_id_legado = ${leadId}::uuid`);
      await db.execute(sql`
        DELETE FROM meta_capi_entregas WHERE outbox_id IN
          (SELECT id FROM event_outbox WHERE payload ->> 'lead_legado_id' = ${leadId})`);
      await db.execute(sql`DELETE FROM event_outbox WHERE payload ->> 'lead_legado_id' = ${leadId} OR idempotency_key LIKE ${marca + "%"}`);
      await db.execute(sql`DELETE FROM domain_events WHERE payload ->> 'lead_legado_id' = ${leadId} OR idempotency_key LIKE ${marca + "%"}`);
      await db.execute(sql`DELETE FROM leads WHERE id = ${leadId}::uuid`);
    }
    console.log("  banco limpo (só o que este smoke criou).\n");
  }
  process.exit(saida);
}
main().catch((e) => { console.error(e); process.exit(1); });
