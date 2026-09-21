/**
 * Fase 07 do refactor — pipeline normalizado e oportunidades (SPEC §8.2 e §42).
 *
 * Duas coisas, na ordem:
 *
 * 1. As etapas de pipeline saem do JSON em `pipelines.stages` e viram linhas em
 *    `pipeline_etapas`, com `tipo_fechamento` explícito (SPEC §8.2).
 *
 * 2. Cada `negocios` vira uma `oportunidades`.
 *
 * A regra difícil aqui é a do SPEC §42: a família do produto NÃO pode ser
 * chutada. `negocios.service_family` está vazio em quase tudo, e o SPEC diz
 * textualmente que isso "must not be blindly filled with guesses". Então a
 * família é buscada numa cadeia de evidência, em ordem de confiança:
 *
 *    1. o próprio negócio           (2 casos)
 *    2. item de proposta            (0)
 *    3. catálogo do item da proposta (256)
 *    4. item de contrato            (144)
 *    5. serviço canônico do lead    (138)
 *
 * O que não resolver por nenhuma dessas fica com família NULA e ganha caso em
 * `reconciliacao_casos`. Medido antes de rodar: 477 resolvíveis, 1.085 não.
 *
 * Uso:
 *   pnpm tsx --env-file=.env src/scripts/backfill/07-pipeline-oportunidade.ts [--aplicar]
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const APLICAR = process.argv.includes("--aplicar");

/** Status legado do negócio → fechamento canônico do SPEC §8.2.
 *  `outra_data`, `sem_retorno` e `no_show` são estados de tentativa, não de
 *  fechamento: a oportunidade segue aberta. Tratá-los como perda inflaria a
 *  taxa de perda em 246 linhas. */
const FECHAMENTO: Record<string, "OPEN" | "WON" | "LOST"> = {
  ganho: "WON", won: "WON",
  perdido: "LOST", perda: "LOST", lost: "LOST", churn: "LOST",
};
const fechamentoDe = (status: string | null) => FECHAMENTO[(status ?? "").toLowerCase()] ?? "OPEN";

async function migrarEtapas() {
  const pipelines = await db.execute<{ id: string; organizacao_id: string; nome: string; stages: unknown }>(
    sql`SELECT id, organizacao_id, nome, stages FROM pipelines`
  );
  let criadas = 0;
  for (const p of pipelines) {
    const stages = Array.isArray(p.stages) ? (p.stages as Record<string, unknown>[]) : [];
    for (const [i, st] of stages.entries()) {
      const codigo = String(st.key ?? st.codigo ?? `etapa_${i}`);
      const nome = String(st.label ?? st.nome ?? codigo);
      const fech = fechamentoDe(codigo);
      if (!APLICAR) { criadas++; continue; }
      const r = await db.execute<{ id: string }>(sql`
        INSERT INTO pipeline_etapas (organizacao_id, pipeline_id, codigo, nome, ordem, tipo_fechamento)
        VALUES (${p.organizacao_id}::uuid, ${p.id}::uuid, ${codigo}, ${nome}, ${i}, ${fech})
        ON CONFLICT (pipeline_id, codigo) DO NOTHING
        RETURNING id`);
      if (r[0]) criadas++;
    }
  }
  return { pipelines: pipelines.length, etapas: criadas };
}

type N = Record<string, any>;

async function main() {
  const t0 = Date.now();
  console.log(`\nBackfill de pipeline e oportunidade — ${APLICAR ? "APLICANDO" : "SIMULAÇÃO (use --aplicar)"}\n`);

  const et = await migrarEtapas();
  console.log(`  etapas de pipeline: ${et.etapas} criadas em ${et.pipelines} pipelines\n`);

  // Traz o negócio já com a família resolvida pela cadeia de evidência e com a
  // pessoa canônica vinda do provenance da fase 05.
  const negocios = await db.execute<N>(sql`
    SELECT n.*,
      bp.id_canonico AS pessoa_id,
      coalesce(
        nullif(n.service_family,'UNKNOWN'),
        (SELECT nullif(pi.service_family,'UNKNOWN') FROM propostas p JOIN proposta_itens pi ON pi.proposta_id = p.id
          WHERE p.negocio_id = n.id AND pi.service_family IS NOT NULL AND pi.service_family <> 'UNKNOWN' LIMIT 1),
        (SELECT nullif(sc.service_family,'UNKNOWN') FROM propostas p JOIN proposta_itens pi ON pi.proposta_id = p.id
           JOIN servicos_catalogo sc ON sc.id = pi.servico_catalogo_id
          WHERE p.negocio_id = n.id AND sc.service_family IS NOT NULL AND sc.service_family <> 'UNKNOWN' LIMIT 1),
        (SELECT nullif(ci.service_family,'UNKNOWN') FROM contratos c JOIN contrato_itens ci ON ci.contrato_id = c.id
          WHERE c.negocio_id = n.id AND ci.service_family IS NOT NULL AND ci.service_family <> 'UNKNOWN' LIMIT 1),
        (SELECT nullif(s.service_family,'UNKNOWN') FROM servicos_canonicos s
          WHERE s.lead_id = n.lead_id AND s.service_family IS NOT NULL AND s.service_family <> 'UNKNOWN' LIMIT 1)
      ) AS familia_resolvida,
      CASE
        WHEN nullif(n.service_family,'UNKNOWN') IS NOT NULL THEN 'PROPRIO'
        WHEN EXISTS (SELECT 1 FROM propostas p JOIN proposta_itens pi ON pi.proposta_id = p.id
                      WHERE p.negocio_id = n.id AND pi.service_family IS NOT NULL AND pi.service_family <> 'UNKNOWN') THEN 'ITEM_PROPOSTA'
        WHEN EXISTS (SELECT 1 FROM propostas p JOIN proposta_itens pi ON pi.proposta_id = p.id
                       JOIN servicos_catalogo sc ON sc.id = pi.servico_catalogo_id
                      WHERE p.negocio_id = n.id AND sc.service_family IS NOT NULL AND sc.service_family <> 'UNKNOWN') THEN 'CATALOGO'
        WHEN EXISTS (SELECT 1 FROM contratos c JOIN contrato_itens ci ON ci.contrato_id = c.id
                      WHERE c.negocio_id = n.id AND ci.service_family IS NOT NULL AND ci.service_family <> 'UNKNOWN') THEN 'ITEM_CONTRATO'
        WHEN EXISTS (SELECT 1 FROM servicos_canonicos s
                      WHERE s.lead_id = n.lead_id AND s.service_family IS NOT NULL AND s.service_family <> 'UNKNOWN') THEN 'SERVICO_CANONICO'
        ELSE 'NAO_RESOLVIDO'
      END AS metodo_familia
    FROM negocios n
    LEFT JOIN backfill_provenance bp
      ON bp.entidade_canonica = 'pessoa' AND bp.tabela_origem = 'leads' AND bp.id_origem = n.lead_id::text
    ORDER BY n.created_at ASC, n.id ASC
  `);

  let criadas = 0, jaExistiam = 0, semIdentidade = 0, casos = 0;
  const porMetodo = new Map<string, number>();
  const porFechamento = new Map<string, number>();

  for (const n of negocios) {
    if (!n.pessoa_id && !n.empresa_id) { semIdentidade++; continue; }

    porMetodo.set(n.metodo_familia, (porMetodo.get(n.metodo_familia) ?? 0) + 1);
    const fech = fechamentoDe(n.status);
    porFechamento.set(fech, (porFechamento.get(fech) ?? 0) + 1);

    if (!APLICAR) { criadas++; if (n.metodo_familia === "NAO_RESOLVIDO") casos++; continue; }

    const r = await db.execute<{ id: string; criada: boolean }>(sql`
      WITH ja AS (
        SELECT id_canonico AS id FROM backfill_provenance
        WHERE entidade_canonica = 'oportunidade' AND tabela_origem = 'negocios' AND id_origem = ${n.id}::text
      ), nova AS (
        INSERT INTO oportunidades (
          organizacao_id, empresa_id, pessoa_id, pipeline_id, stage, etapa, responsavel_id,
          titulo, valor, mrr, service_family, commercial_motion, source_process,
          ganho_at, perdido_at, motivo_perda, negocio_id_legado, lead_id, created_at, updated_at
        )
        SELECT ${n.organizacao_id}::uuid, ${n.empresa_id}::uuid, ${n.pessoa_id}::uuid,
               ${n.pipeline_id}::uuid, ${n.status ?? "aberto"}, ${n.etapa}, ${n.responsavel_id}::uuid,
               ${n.titulo}, ${n.valor_total ?? n.valor_projeto}, ${n.mrr_fechado ?? n.mrr_estimado}, ${n.familia_resolvida},
               ${n.commercial_motion ?? "NEW_BUSINESS"}, 'BACKFILL_07',
               ${fech === "WON" ? (n.ganho_at ?? n.updated_at) : null},
               ${fech === "LOST" ? n.updated_at : null},
               ${fech === "LOST" ? n.motivo_perda : null},
               ${n.id}::uuid, ${n.lead_id}::uuid, ${n.created_at}, ${n.updated_at ?? n.created_at}
        WHERE NOT EXISTS (SELECT 1 FROM ja)
        RETURNING id
      )
      SELECT id, true AS criada FROM nova UNION ALL SELECT id, false FROM ja LIMIT 1
    `);
    const opId = r[0]?.id;
    if (!opId) continue;
    if (r[0].criada) criadas++; else jaExistiam++;

    await db.execute(sql`
      INSERT INTO backfill_provenance (organizacao_id, fase, entidade_canonica, id_canonico, tabela_origem, id_origem, chave_identidade, metodo)
      VALUES (${n.organizacao_id}::uuid, '07', 'oportunidade', ${opId}::uuid, 'negocios', ${n.id}::text, ${`negocio:${n.id}`}, ${n.metodo_familia})
      ON CONFLICT (entidade_canonica, tabela_origem, id_origem) DO NOTHING
    `);

    // SPEC §42: produto não resolvível vira fila de reconciliação, nunca palpite.
    if (n.metodo_familia === "NAO_RESOLVIDO") {
      await db.execute(sql`
        INSERT INTO reconciliacao_casos (organizacao_id, fase, tipo, entidade_alvo, origens, evidencia, sugestao)
        VALUES (${n.organizacao_id}::uuid, '07', 'FAMILIA_NAO_RESOLVIDA', ${`oportunidade:${opId}`},
                ${JSON.stringify([{ tabela: "negocios", id: n.id }])}::jsonb,
                ${JSON.stringify({ titulo: n.titulo, status: n.status, valor: n.valor, sem_proposta_com_familia: true })}::jsonb,
                ${JSON.stringify({ acao: "definir service_family a partir do que foi de fato vendido; nenhuma evidência no banco permite deduzir" })}::jsonb)
        ON CONFLICT (fase, tipo, entidade_alvo, status) DO NOTHING
      `);
      casos++;
    }
  }

  console.log("RELATÓRIO DE RECONCILIAÇÃO — fase 07, oportunidade\n");
  console.log(`  linhas de origem (negocios)   ${negocios.length}`);
  console.log(`  oportunidades criadas         ${criadas}`);
  console.log(`  já existiam                   ${jaExistiam}`);
  console.log(`  sem identidade                ${semIdentidade}`);
  console.log(`\n  família resolvida por:`);
  for (const [k, v] of [...porMetodo].sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(20)}${v}`);
  console.log(`\n  fechamento:`);
  for (const [k, v] of [...porFechamento].sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(20)}${v}`);
  console.log(`\n  casos de reconciliação        ${casos}  (família não dedutível: NÃO foi chutada)`);
  console.log(`\n  ${Math.round((Date.now() - t0) / 100) / 10}s\n`);
  if (!APLICAR) console.log("  Nada foi gravado.\n");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
