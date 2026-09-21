/**
 * Fase 13 — backfill de conversas e comunicações (SPEC §22, §43).
 *
 * Três tabelas legadas viram uma abstração canônica:
 *
 *   whatsapp_mensagens  25.363
 *   ligacoes             4.938
 *   emails               4.460
 *   ──────────────────────────
 *                       34.761 linhas
 *
 * Trabalha em lote (INSERT ... SELECT), não linha a linha: 34 mil round-trips
 * levariam minutos e não trariam nenhuma garantia a mais.
 *
 * A identidade segue o caminho canônico: lead legado → `backfill_provenance` →
 * pessoa. Onde o lead não resolve pessoa, a comunicação entra sem pessoa em vez
 * de ser descartada: o registro do que aconteceu é fato, mesmo sem saber com quem.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
const APLICAR = process.argv.includes("--aplicar");

async function main() {
  const t0 = Date.now();
  console.log(`\nFase 13 — conversas e comunicações — ${APLICAR ? "APLICANDO" : "SIMULAÇÃO"}\n`);

  const origem = await db.execute<Record<string, string>>(sql`
    SELECT (SELECT count(*)::text FROM whatsapp_mensagens) AS wa,
           (SELECT count(*)::text FROM ligacoes) AS lig,
           (SELECT count(*)::text FROM emails) AS em`);
  const total = Number(origem[0].wa) + Number(origem[0].lig) + Number(origem[0].em);
  console.log(`  origem: WhatsApp ${origem[0].wa} · ligações ${origem[0].lig} · e-mails ${origem[0].em}  =  ${total}\n`);

  if (APLICAR) {
    // ─── Conversas ────────────────────────────────────────────────────────
    // WhatsApp: uma conversa por telefone dentro da organização. O telefone é a
    // thread real do canal, não o lead: a mesma pessoa pode trocar de lead.
    const cWa = await db.execute<{ n: string }>(sql`
      WITH ins AS (
        INSERT INTO conversas (organizacao_id, pessoa_id, empresa_id, canal, external_thread_id, last_message_at, metadata)
        SELECT DISTINCT ON (ct.organizacao_id, w.telefone)
               ct.organizacao_id, bp.id_canonico::uuid, l.empresa_id, 'whatsapp', w.telefone,
               max(w.created_at) OVER (PARTITION BY ct.organizacao_id, w.telefone),
               jsonb_build_object('backfill', jsonb_build_object('fase','13','origem','whatsapp_mensagens'))
        FROM whatsapp_mensagens w
        -- 24.380 de 25.363 mensagens NAO tem lead_id, so contato_id. Um JOIN
        -- interno em leads descartaria 96% do historico de WhatsApp. A
        -- identidade e a organizacao vem do contato quando o lead falta.
        JOIN contatos ct ON ct.id = w.contato_id
        LEFT JOIN leads l ON l.id = coalesce(w.lead_id, ct.lead_id)
        LEFT JOIN backfill_provenance bp ON bp.entidade_canonica='pessoa' AND bp.tabela_origem='leads'
                                        AND bp.id_origem = coalesce(w.lead_id, ct.lead_id)::text
        WHERE w.telefone IS NOT NULL AND trim(w.telefone) <> ''
        ORDER BY ct.organizacao_id, w.telefone, w.created_at DESC
        ON CONFLICT DO NOTHING
        RETURNING 1) SELECT count(*)::text AS n FROM ins`);
    // E-mail: a thread é a conversa.
    const cEm = await db.execute<{ n: string }>(sql`
      WITH ins AS (
        INSERT INTO conversas (organizacao_id, pessoa_id, empresa_id, canal, external_thread_id, last_message_at, metadata)
        SELECT DISTINCT ON (e.organizacao_id, coalesce(e.thread_id, e.id::text))
               e.organizacao_id, bp.id_canonico::uuid, l.empresa_id, 'email', coalesce(e.thread_id, e.id::text),
               max(e.created_at) OVER (PARTITION BY e.organizacao_id, coalesce(e.thread_id, e.id::text)),
               jsonb_build_object('backfill', jsonb_build_object('fase','13','origem','emails'))
        FROM emails e
        LEFT JOIN leads l ON l.id = e.lead_id
        LEFT JOIN backfill_provenance bp ON bp.entidade_canonica='pessoa' AND bp.tabela_origem='leads' AND bp.id_origem = e.lead_id::text
        ORDER BY e.organizacao_id, coalesce(e.thread_id, e.id::text), e.created_at DESC
        ON CONFLICT DO NOTHING
        RETURNING 1) SELECT count(*)::text AS n FROM ins`);
    console.log(`  conversas de WhatsApp  ${cWa[0].n}`);
    console.log(`  conversas de e-mail    ${cEm[0].n}`);

    // ─── Comunicações ─────────────────────────────────────────────────────
    const mWa = await db.execute<{ n: string }>(sql`
      WITH ins AS (
        INSERT INTO communications (organizacao_id, conversa_id, pessoa_id, empresa_id, canal, tipo, direcao,
                                    conteudo, external_id, provider, status, ocorrido_em,
                                    origem_legado_id, origem_tabela, metadata)
        SELECT ct.organizacao_id, cv.id, bp.id_canonico::uuid, l.empresa_id, 'whatsapp', coalesce(w.tipo,'texto'),
               coalesce(w.direcao,'desconhecida'), w.conteudo, w.uazapi_message_id, 'wuzapi', w.status, w.created_at,
               w.id, 'whatsapp_mensagens',
               jsonb_build_object('media_url', w.media_url, 'media_type', w.media_type, 'contato_id', ct.id)
        FROM whatsapp_mensagens w
        JOIN contatos ct ON ct.id = w.contato_id
        LEFT JOIN leads l ON l.id = coalesce(w.lead_id, ct.lead_id)
        LEFT JOIN backfill_provenance bp ON bp.entidade_canonica='pessoa' AND bp.tabela_origem='leads'
                                        AND bp.id_origem = coalesce(w.lead_id, ct.lead_id)::text
        LEFT JOIN conversas cv ON cv.canal='whatsapp' AND cv.organizacao_id = ct.organizacao_id AND cv.external_thread_id = w.telefone
        WHERE NOT EXISTS (SELECT 1 FROM communications c WHERE c.origem_tabela='whatsapp_mensagens' AND c.origem_legado_id = w.id)
        RETURNING 1) SELECT count(*)::text AS n FROM ins`);
    const mLig = await db.execute<{ n: string }>(sql`
      WITH ins AS (
        INSERT INTO communications (organizacao_id, pessoa_id, empresa_id, canal, tipo, direcao,
                                    duracao_segundos, external_id, provider, status, ocorrido_em, usuario_id,
                                    summary, transcript, origem_legado_id, origem_tabela, metadata)
        SELECT g.organizacao_id, bp.id_canonico::uuid, l.empresa_id, 'ligacao', 'chamada',
               'desconhecida', g.duracao_segundos, g.callface_call_id, 'callface',
               g.call_status, coalesce(g.call_date, g.created_at), g.usuario_id,
               g.resumo, g.transcricao, g.id, 'ligacoes', jsonb_build_object('destino', g.destination_number, 'resumo', g.resumo)
        FROM ligacoes g
        LEFT JOIN leads l ON l.id = g.lead_id
        LEFT JOIN backfill_provenance bp ON bp.entidade_canonica='pessoa' AND bp.tabela_origem='leads' AND bp.id_origem = g.lead_id::text
        WHERE NOT EXISTS (SELECT 1 FROM communications c WHERE c.origem_tabela='ligacoes' AND c.origem_legado_id = g.id)
        RETURNING 1) SELECT count(*)::text AS n FROM ins`);
    const mEm = await db.execute<{ n: string }>(sql`
      WITH ins AS (
        INSERT INTO communications (organizacao_id, conversa_id, pessoa_id, empresa_id, canal, tipo, direcao,
                                    subject, conteudo, external_id, provider, status, ocorrido_em, usuario_id,
                                    origem_legado_id, origem_tabela, metadata)
        SELECT e.organizacao_id, cv.id, bp.id_canonico::uuid, l.empresa_id, 'email', 'mensagem',
               coalesce(e.direcao,'desconhecida'), e.assunto, coalesce(e.corpo_texto, e.corpo), e.message_id, 'email',
               e.status, e.created_at, e.enviado_por_id,
               e.id, 'emails', jsonb_build_object('de', e.de, 'para', e.para, 'thread_id', e.thread_id)
        FROM (
          -- A tabela emails tem 1.185 message_id repetidos em 2.941 linhas: a
          -- mesma mensagem foi gravada mais de uma vez. A tabela communications
          -- ja tem UNIQUE(canal, external_id) justamente para impedir isso,
          -- entao a primeira ocorrencia de cada message_id e a que migra.
          -- Nao e perda: e deduplicacao de dado que ja nascia duplicado.
          SELECT DISTINCT ON (organizacao_id, message_id) *
          FROM emails ORDER BY organizacao_id, message_id, created_at ASC, id ASC
        ) e
        LEFT JOIN leads l ON l.id = e.lead_id
        LEFT JOIN backfill_provenance bp ON bp.entidade_canonica='pessoa' AND bp.tabela_origem='leads' AND bp.id_origem = e.lead_id::text
        LEFT JOIN conversas cv ON cv.canal='email' AND cv.organizacao_id = e.organizacao_id AND cv.external_thread_id = coalesce(e.thread_id, e.id::text)
        WHERE NOT EXISTS (SELECT 1 FROM communications c WHERE c.origem_tabela='emails' AND c.origem_legado_id = e.id)
        RETURNING 1) SELECT count(*)::text AS n FROM ins`);
    console.log(`  comunicações de WhatsApp  ${mWa[0].n}`);
    console.log(`  comunicações de ligação   ${mLig[0].n}`);
    console.log(`  comunicações de e-mail    ${mEm[0].n}`);
  }

  const r = await db.execute<Record<string, string>>(sql`
    SELECT (SELECT count(*)::text FROM conversas) AS conversas,
           (SELECT count(*)::text FROM communications) AS comms,
           (SELECT count(*)::text FROM communications WHERE pessoa_id IS NULL) AS sem_pessoa,
           (SELECT count(*)::text FROM communications WHERE conversa_id IS NULL AND canal <> 'ligacao') AS sem_conversa,
           (SELECT count(*)::text FROM whatsapp_mensagens w WHERE NOT EXISTS (SELECT 1 FROM communications c WHERE c.origem_tabela='whatsapp_mensagens' AND c.origem_legado_id=w.id)) AS wa_perdidas,
           (SELECT count(*)::text FROM ligacoes g WHERE NOT EXISTS (SELECT 1 FROM communications c WHERE c.origem_tabela='ligacoes' AND c.origem_legado_id=g.id)) AS lig_perdidas,
           (SELECT count(*)::text FROM emails e WHERE NOT EXISTS (SELECT 1 FROM communications c WHERE c.origem_tabela='emails' AND c.origem_legado_id=e.id)) AS em_perdidas`);
  console.log(`\n  RECONCILIAÇÃO`);
  console.log(`    conversas criadas             ${r[0].conversas}`);
  console.log(`    comunicações                  ${r[0].comms} de ${total} de origem`);
  console.log(`    sem pessoa resolvida          ${r[0].sem_pessoa}  (fato registrado mesmo sem saber com quem)`);
  console.log(`    sem conversa (fora ligação)   ${r[0].sem_conversa}`);
  console.log(`    NÃO migradas: WhatsApp ${r[0].wa_perdidas} · ligações ${r[0].lig_perdidas} · e-mails ${r[0].em_perdidas}`);
  console.log(`\n  ${Math.round((Date.now() - t0) / 100) / 10}s\n`);
  if (!APLICAR) console.log("  Nada foi gravado.\n");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
