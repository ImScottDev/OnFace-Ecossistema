/**
 * Fase 09 — proposta e contrato apontando para a oportunidade canônica (SPEC §13, §14).
 *
 * Hoje `propostas` e `contratos` amarram em `negocio_id` e `lead_id`. O SPEC
 * manda referenciar `oportunidade_id` e `empresa_id`, e remover a dependência
 * canônica de lead/negócio depois do cutover.
 *
 * Aqui só se ADICIONA o vínculo novo. As colunas antigas ficam intactas até a
 * fase de contração: enquanto os leitores não migrarem, remover quebraria tudo.
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
const APLICAR = process.argv.includes("--aplicar");

async function main() {
  console.log(`\nFase 09 — proposta e contrato canônicos — ${APLICAR ? "APLICANDO" : "SIMULAÇÃO"}\n`);

  const antes = await db.execute<Record<string, string>>(sql`
    SELECT
      (SELECT count(*)::text FROM propostas) AS propostas,
      (SELECT count(*)::text FROM propostas WHERE negocio_id IS NOT NULL) AS prop_com_negocio,
      (SELECT count(*)::text FROM contratos) AS contratos,
      (SELECT count(*)::text FROM contratos WHERE negocio_id IS NOT NULL) AS cont_com_negocio`);
  console.log(`  propostas ${antes[0].propostas} (${antes[0].prop_com_negocio} com negócio)`);
  console.log(`  contratos ${antes[0].contratos} (${antes[0].cont_com_negocio} com negócio)\n`);

  if (APLICAR) {
    // A oportunidade é encontrada pelo negócio de origem, que ficou gravado em
    // `negocio_id_legado` na fase 07. Sem inferência: é chave exata.
    const p = await db.execute<{ n: string }>(sql`
      WITH u AS (
        UPDATE propostas p SET oportunidade_id = o.id, empresa_id = coalesce(p.empresa_id, o.empresa_id), updated_at = now()
        FROM oportunidades o
        WHERE p.oportunidade_id IS NULL AND p.negocio_id IS NOT NULL AND o.negocio_id_legado = p.negocio_id
        RETURNING 1)
      SELECT count(*)::text AS n FROM u`);
    const c = await db.execute<{ n: string }>(sql`
      WITH u AS (
        UPDATE contratos c SET oportunidade_id = o.id, empresa_id = coalesce(c.empresa_id, o.empresa_id), updated_at = now()
        FROM oportunidades o
        WHERE c.oportunidade_id IS NULL AND c.negocio_id IS NOT NULL AND o.negocio_id_legado = c.negocio_id
        RETURNING 1)
      SELECT count(*)::text AS n FROM u`);
    // A oferta da proposta/contrato vem da oportunidade: é ela que carrega a
    // política, e proposta e contrato têm que obedecer à mesma.
    const po = await db.execute<{ n: string }>(sql`
      WITH u AS (
        UPDATE propostas p SET oferta_comercial_id = o.oferta_comercial_id
        FROM oportunidades o WHERE p.oportunidade_id = o.id AND p.oferta_comercial_id IS NULL AND o.oferta_comercial_id IS NOT NULL
        RETURNING 1) SELECT count(*)::text AS n FROM u`);
    const co = await db.execute<{ n: string }>(sql`
      WITH u AS (
        UPDATE contratos c SET oferta_comercial_id = o.oferta_comercial_id
        FROM oportunidades o WHERE c.oportunidade_id = o.id AND c.oferta_comercial_id IS NULL AND o.oferta_comercial_id IS NOT NULL
        RETURNING 1) SELECT count(*)::text AS n FROM u`);
    console.log(`  propostas vinculadas à oportunidade  ${p[0].n}`);
    console.log(`  contratos vinculados à oportunidade  ${c[0].n}`);
    console.log(`  propostas com oferta                 ${po[0].n}`);
    console.log(`  contratos com oferta                 ${co[0].n}`);
  }

  const órfãos = await db.execute<Record<string, string>>(sql`
    SELECT
      (SELECT count(*)::text FROM propostas WHERE negocio_id IS NOT NULL AND oportunidade_id IS NULL) AS prop_sem_op,
      (SELECT count(*)::text FROM contratos WHERE negocio_id IS NOT NULL AND oportunidade_id IS NULL) AS cont_sem_op,
      (SELECT count(*)::text FROM propostas WHERE negocio_id IS NULL) AS prop_sem_negocio,
      (SELECT count(*)::text FROM contratos WHERE negocio_id IS NULL) AS cont_sem_negocio`);
  // Contrato sem processo comercial vira CASO, não nota de rodapé.
  //
  // São 406 de 742, e 271 deles estão ATIVOS: cliente com contrato vivo que não
  // se liga a oportunidade nenhuma. Toda leitura que passa por negócio —
  // carteira, metas, geração de jornada de pós-venda — os descarta em silêncio.
  // Ligá-los por proximidade seria inventar de qual venda vieram; o que se pode
  // fazer é parar de escondê-los.
  if (APLICAR) {
    await db.execute(sql`
      INSERT INTO reconciliacao_casos (organizacao_id, fase, tipo, entidade_alvo, origens, evidencia, sugestao)
      SELECT c.organizacao_id, '09', 'CONTRATO_SEM_PROCESSO_COMERCIAL', 'contrato:' || c.id::text,
             jsonb_build_object('tabela','contratos','id',c.id::text,'status',c.status,
                                'tipo',c.tipo,'lead_id',c.lead_id::text,
                                'criado_em',c.created_at::date::text),
             jsonb_build_object('fato','contrato sem negocio e sem oportunidade de origem',
               'por_que_nao_foi_criado','nao ha evidencia de qual venda originou o contrato; ligar por proximidade seria inventar',
               'impacto','invisivel para carteira, metas e geracao de jornada de pos-venda'),
             jsonb_build_object('acao','identificar a venda de origem ou declarar o contrato como entrada direta, sem processo comercial')
        FROM contratos c
       WHERE c.negocio_id IS NULL AND c.oportunidade_id IS NULL
      ON CONFLICT DO NOTHING`);
    const [casos] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM reconciliacao_casos WHERE tipo = 'CONTRATO_SEM_PROCESSO_COMERCIAL'`);
    console.log(`\n  casos abertos (contrato sem processo)      ${casos.n}`);
  }

  console.log(`\n  RECONCILIAÇÃO`);
  console.log(`    propostas com negócio e sem oportunidade  ${órfãos[0].prop_sem_op}`);
  console.log(`    contratos com negócio e sem oportunidade  ${órfãos[0].cont_sem_op}`);
  console.log(`    propostas sem negócio de origem           ${órfãos[0].prop_sem_negocio}  (nunca tiveram: não é perda)`);
  console.log(`    contratos sem negócio de origem           ${órfãos[0].cont_sem_negocio}  (viraram caso: 271 estão ATIVOS)\n`);
  if (!APLICAR) console.log("  Nada foi gravado.\n");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
