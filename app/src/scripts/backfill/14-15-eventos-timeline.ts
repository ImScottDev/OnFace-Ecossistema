/**
 * Fases 14 e 15 — separação de atividades e projeção de timeline (SPEC §23, §24).
 *
 * `atividades` tem 13.044 linhas e é o balde universal que o SPEC manda esvaziar.
 * Olhando os tipos, a maioria NÃO é a entidade em si: é o registro legível de
 * que algo aconteceu. Uma linha `tipo='ligacao'` em atividades não é a ligação
 * (essa vive em `ligacoes`, já migrada para `communications`), é a marca dela
 * na história do cliente.
 *
 * Por isso o destino principal é `timeline_events`, que é exatamente o que o
 * SPEC §24.3 define: modelo de leitura para humano, derivado.
 *
 * Classificação por tipo, com o que cada um realmente é:
 *
 *   ligacao, ligacao_legado, whatsapp, email_legado   → já existem como
 *       communication; a atividade vira só o item de timeline
 *   proposta_enviada, diagnostico, cadencia           → fato de negócio:
 *       vira domain_event E item de timeline
 *   nota                                              → nota, mas `notas` já
 *       tem 5.002 linhas; vira timeline e o texto fica no item
 *   reuniao, reuniao_legado, tarefa, tarefa_legado    → a entidade vive em
 *       `reunioes`/`tarefas`; a atividade vira timeline
 *
 * Nenhuma linha é descartada. O que não classifica vira timeline genérica com o
 * tipo original preservado, em vez de sumir.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
const APLICAR = process.argv.includes("--aplicar");

/** Tipos que representam um FATO DE NEGÓCIO e merecem domain_event além da
 *  timeline. Os demais são registro de algo que já tem entidade própria. */
const FATO_DE_NEGOCIO: Record<string, string> = {
  proposta_enviada: "ProposalSent",
  diagnostico: "DiagnosticCompleted",
  cadencia: "CadenceStepExecuted",
};

async function main() {
  const t0 = Date.now();
  console.log(`\nFases 14 e 15 — eventos e timeline — ${APLICAR ? "APLICANDO" : "SIMULAÇÃO"}\n`);

  const origem = await db.execute<{ tipo: string; n: string }>(sql`
    SELECT coalesce(tipo,'(sem tipo)') AS tipo, count(*)::text AS n FROM atividades GROUP BY 1 ORDER BY 2 DESC`);
  const total = origem.reduce((s, r) => s + Number(r.n), 0);
  console.log(`  atividades de origem: ${total} em ${origem.length} tipos\n`);

  if (APLICAR) {
    // ─── domain_events para os fatos de negócio ───────────────────────────
    let eventos = 0;
    for (const [tipo, eventType] of Object.entries(FATO_DE_NEGOCIO)) {
      const r = await db.execute<{ n: string }>(sql`
        WITH ins AS (
          INSERT INTO domain_events (organizacao_id, event_type, aggregate_type, aggregate_id,
                                     actor_type, actor_id, occurred_at, source, idempotency_key, payload)
          SELECT coalesce(a.organizacao_id, l.organizacao_id), ${eventType}, 'atividade', a.id,
                 CASE WHEN a.usuario_id IS NOT NULL THEN 'USER' ELSE 'SYSTEM' END,
                 a.usuario_id, a.created_at, 'backfill-14-15',
                 'atividade:' || a.id::text,
                 jsonb_build_object('titulo', a.titulo, 'descricao', a.descricao,
                                    'lead_id', a.lead_id, 'negocio_id', a.negocio_id, 'tipo_origem', a.tipo)
          FROM atividades a
          LEFT JOIN leads l ON l.id = a.lead_id
          WHERE a.tipo = ${tipo}
            AND coalesce(a.organizacao_id, l.organizacao_id) IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM domain_events d
                            WHERE d.idempotency_key = 'atividade:' || a.id::text)
          RETURNING 1) SELECT count(*)::text AS n FROM ins`);
      eventos += Number(r[0].n);
    }
    console.log(`  domain_events criados                ${eventos}`);

    // ─── timeline_events para TODAS as atividades ─────────────────────────
    // A empresa vem da atividade ou do lead; a oportunidade, do negócio de
    // origem via `negocio_id_legado`. Nada é inferido por aproximação.
    const tl = await db.execute<{ n: string }>(sql`
      WITH ins AS (
        INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, oportunidade_id,
                                     domain_event_id, tipo, titulo, descricao,
                                     actor_type, actor_id, occurred_at, metadata)
        SELECT coalesce(a.organizacao_id, l.organizacao_id),
               coalesce(a.empresa_id, l.empresa_id),
               bp.id_canonico::uuid,
               op.id,
               de.id,
               coalesce(a.tipo, 'atividade'),
               coalesce(nullif(a.titulo,''), coalesce(a.tipo,'atividade')),
               a.descricao,
               CASE WHEN a.usuario_id IS NOT NULL THEN 'USER' ELSE 'SYSTEM' END,
               a.usuario_id, a.created_at,
               jsonb_build_object('backfill', jsonb_build_object('fase','14-15','atividade', a.id),
                                  'usuario_nome', a.usuario_display_name)
        FROM atividades a
        LEFT JOIN leads l ON l.id = a.lead_id
        LEFT JOIN backfill_provenance bp ON bp.entidade_canonica='pessoa' AND bp.tabela_origem='leads' AND bp.id_origem = a.lead_id::text
        LEFT JOIN oportunidades op ON op.negocio_id_legado = a.negocio_id
        LEFT JOIN domain_events de ON de.idempotency_key = 'atividade:' || a.id::text
        WHERE coalesce(a.organizacao_id, l.organizacao_id) IS NOT NULL
          AND NOT EXISTS (
          SELECT 1 FROM timeline_events t
          WHERE t.metadata -> 'backfill' ->> 'atividade' = a.id::text)
        RETURNING 1) SELECT count(*)::text AS n FROM ins`);
    console.log(`  timeline_events de atividades        ${tl[0].n}`);

    // Timeline também para os marcos comerciais que já são canônicos: ganho e
    // perda de oportunidade. Sem isso a timeline conta a história pela metade.
    const tlOp = await db.execute<{ n: string }>(sql`
      WITH ins AS (
        INSERT INTO timeline_events (organizacao_id, empresa_id, pessoa_id, oportunidade_id,
                                     tipo, titulo, actor_type, occurred_at, metadata)
        SELECT o.organizacao_id, o.empresa_id, o.pessoa_id, o.id,
               CASE WHEN o.ganho_at IS NOT NULL THEN 'oportunidade_ganha' ELSE 'oportunidade_perdida' END,
               CASE WHEN o.ganho_at IS NOT NULL THEN 'Oportunidade ganha' ELSE 'Oportunidade perdida' END,
               'SYSTEM', coalesce(o.ganho_at, o.perdido_at),
               jsonb_build_object('backfill', jsonb_build_object('fase','14-15','oportunidade', o.id),
                                  'motivo_perda', o.motivo_perda, 'familia', o.service_family)
        FROM oportunidades o
        WHERE (o.ganho_at IS NOT NULL OR o.perdido_at IS NOT NULL)
          AND NOT EXISTS (SELECT 1 FROM timeline_events t
                          WHERE t.metadata -> 'backfill' ->> 'oportunidade' = o.id::text)
        RETURNING 1) SELECT count(*)::text AS n FROM ins`);
    console.log(`  timeline_events de ganho/perda       ${tlOp[0].n}`);
  }

  const r = await db.execute<Record<string, string>>(sql`
    SELECT (SELECT count(*)::text FROM domain_events) AS eventos,
           (SELECT count(*)::text FROM timeline_events) AS timeline,
           (SELECT count(*)::text FROM atividades a WHERE NOT EXISTS (
              SELECT 1 FROM timeline_events t WHERE t.metadata->'backfill'->>'atividade' = a.id::text)) AS ativ_fora,
           (SELECT count(*)::text FROM timeline_events WHERE empresa_id IS NULL AND pessoa_id IS NULL AND oportunidade_id IS NULL) AS tl_sem_ancora`);
  console.log(`\n  RECONCILIAÇÃO`);
  console.log(`    domain_events                 ${r[0].eventos}`);
  console.log(`    timeline_events               ${r[0].timeline}`);
  console.log(`    atividades SEM timeline       ${r[0].ativ_fora}  (deve ser 0: nada descartado)`);
  console.log(`    timeline sem nenhuma âncora   ${r[0].tl_sem_ancora}`);
  console.log(`\n  ${Math.round((Date.now() - t0) / 100) / 10}s\n`);
  if (!APLICAR) console.log("  Nada foi gravado.\n");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
