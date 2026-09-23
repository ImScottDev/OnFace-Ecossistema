/**
 * Fase 06 do refactor — backfill de aquisição e atribuição (SPEC §41).
 *
 * Cada linha de `leads` vira uma `aquisicoes`: o processo comercial sai da
 * tabela de identidade e passa a ter vida própria, com estágio, qualificação,
 * dono e datas. Os identificadores de campanha vão para `pontos_contato`.
 *
 * Regra do SPEC §41 que exige cuidado: `leads.tipo = 'cliente'` NÃO significa
 * que a aquisição continua "cliente". Ser cliente é fato de pós-venda, vem de
 * serviço contratado, não do processo de aquisição. Uma aquisição de quem virou
 * cliente é uma aquisição ENCERRADA E QUALIFICADA, não uma aquisição "cliente".
 *
 * Idempotente por `backfill_provenance`. Só INSERE; nada de origem é alterado.
 *
 * Uso:
 *   pnpm tsx --env-file=.env src/scripts/backfill/06-aquisicao.ts            # simulação
 *   pnpm tsx --env-file=.env src/scripts/backfill/06-aquisicao.ts --aplicar
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const APLICAR = process.argv.includes("--aplicar");

/** `leads.origem` é texto livre preenchido por humano e por integração ao longo
 *  de anos. Mapeia para o vocabulário fechado do SPEC §8.1; o que não casar vira
 *  MANUAL e fica registrado no metadata, nunca descartado. */
function tipoAquisicao(origem: string | null): string {
  // Sem acento e em caixa baixa: o dado real tem "Mídia Paga" e "Orgânico",
  // e comparar com acento deixa 1.685 linhas caindo em MANUAL por engano.
  const o = (origem ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!o) return "MANUAL";
  // Importação vem primeiro: "ZohoDesk" e "stripe" são carga de sistema antigo,
  // não canal de aquisição. Classificar como INBOUND inflaria o funil pago.
  if (/zoho|import|planilha|migra|stripe|legado/.test(o)) return "IMPORT";
  if (/apollo|outbound|prospec|cold|lista/.test(o)) return "OUTBOUND";
  if (/indica|referr|parceir|webinar/.test(o)) return "REFERRAL";
  if (/midia paga|meta|facebook|instagram|google|ads|site|form|landing|inbound|organico|rd station|rd$/.test(o)) return "INBOUND";
  return "MANUAL";
}

type L = Record<string, any>;

async function main() {
  const t0 = Date.now();
  console.log(`\nBackfill de aquisição — ${APLICAR ? "APLICANDO" : "SIMULAÇÃO (use --aplicar)"}\n`);

  const leads = await db.execute<L>(sql`
    SELECT l.*, bp.id_canonico AS pessoa_id
    FROM leads l
    LEFT JOIN backfill_provenance bp
      ON bp.entidade_canonica = 'pessoa' AND bp.tabela_origem = 'leads' AND bp.id_origem = l.id::text
    ORDER BY l.created_at ASC, l.id ASC
  `);

  let criadas = 0, jaExistiam = 0, touchpoints = 0, semIdentidade = 0;
  const porTipo = new Map<string, number>();
  const porEstado = new Map<string, number>();

  for (const l of leads) {
    // SPEC §8.1: aquisição precisa de empresa OU pessoa. Sem nenhuma das duas o
    // registro não é representável e não vai ser inventado.
    if (!l.pessoa_id && !l.empresa_id) { semIdentidade++; continue; }

    const tipo = tipoAquisicao(l.origem);
    porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + 1);

    const qualificado = Boolean(l.qualificado) || l.qualificado_em != null;
    const desqualificado = l.desqualificado_em != null;
    // Encerrada quando desqualificou, ou quando o registro não está no funil de
    // pré-vendas. O board legado recorta `tipo = 'lead'`
    // (src/api-server/routes/leads.ts:252): contato de empresa importado do Zoho
    // e ex-cliente nunca passaram por aquisição, e cliente já cumpriu o papel
    // dela (o vínculo vive no pós-venda). Sem este recorte os 2.098 contatos e
    // os 9 ex-clientes entram abertos e a coluna Novo vai a 1.966 contra os 59
    // do board real — medido no ensaio de 23/09.
    //
    // Encerrar não apaga nada: a aquisição existe, com origem e datas, e sai só
    // do funil ativo.
    const foraDoFunil = l.tipo != null && l.tipo !== "lead";
    const encerrada = desqualificado || foraDoFunil;
    const estado = desqualificado ? "desqualificada" : qualificado ? "qualificada" : encerrada ? "encerrada" : "aberta";
    porEstado.set(estado, (porEstado.get(estado) ?? 0) + 1);

    const temAtribuicao =
      [l.utm_source, l.utm_medium, l.utm_campaign, l.utm_term, l.utm_content,
       l.gclid, l.fbclid, l.fbc, l.fbp, l.meta_campaign_id, l.meta_adset_id,
       l.meta_ad_id, l.landing_page].some((v) => v != null && String(v).trim() !== "");
    if (temAtribuicao) touchpoints++;

    if (!APLICAR) { criadas++; continue; }

    const r = await db.execute<{ id: string; criada: boolean }>(sql`
      WITH ja AS (
        SELECT id_canonico AS id FROM backfill_provenance
        WHERE entidade_canonica = 'aquisicao' AND tabela_origem = 'leads' AND id_origem = ${l.id}::text
      ), nova AS (
        INSERT INTO aquisicoes (
          organizacao_id, empresa_id, pessoa_id, tipo, origem, canal, source_provider,
          responsavel_id, qualificado, qualificado_em, desqualificado_em,
          motivo_desqualificacao, nutricao_status, retomar_em,
          first_touch_at, last_touch_at, created_at, updated_at, closed_at
        )
        SELECT ${l.organizacao_id}::uuid, ${l.empresa_id}::uuid, ${l.pessoa_id}::uuid,
               ${tipo}, ${l.origem}, ${l.utm_medium}, ${l.utm_source},
               ${l.responsavel_id}::uuid, ${qualificado}, ${l.qualificado_em}, ${l.desqualificado_em},
               ${l.desqualificacao_motivo}, ${l.nutricao_motivo}, ${l.nutricao_retomar_em},
               ${l.created_at}, ${l.last_contact_at ?? l.created_at}, ${l.created_at}, ${l.updated_at ?? l.created_at},
               ${encerrada ? (l.desqualificado_em ?? l.updated_at ?? l.created_at) : null}
        WHERE NOT EXISTS (SELECT 1 FROM ja)
        RETURNING id
      )
      SELECT id, true AS criada FROM nova UNION ALL SELECT id, false FROM ja LIMIT 1
    `);
    const aqId = r[0]?.id;
    if (!aqId) continue;
    if (r[0].criada) criadas++; else jaExistiam++;

    await db.execute(sql`
      INSERT INTO backfill_provenance (organizacao_id, fase, entidade_canonica, id_canonico, tabela_origem, id_origem, chave_identidade, metodo)
      VALUES (${l.organizacao_id}::uuid, '06', 'aquisicao', ${aqId}::uuid, 'leads', ${l.id}::text, ${`lead:${l.id}`}, ${tipo})
      ON CONFLICT (entidade_canonica, tabela_origem, id_origem) DO NOTHING
    `);

    if (temAtribuicao) {
      await db.execute(sql`
        INSERT INTO pontos_contato (
          organizacao_id, pessoa_id, empresa_id, aquisicao_id, tipo_origem,
          source, medium, campaign, term, content, landing_page,
          gclid, fbclid, fbc, fbp, campaign_id, adset_id, ad_id,
          provider, is_first_touch, is_last_touch, ocorrido_em, lead_id_legado, raw
        )
        SELECT ${l.organizacao_id}::uuid, ${l.pessoa_id}::uuid, ${l.empresa_id}::uuid, ${aqId}::uuid, ${tipo === "INBOUND" ? "paga" : "organica"},
               ${l.utm_source}, ${l.utm_medium}, ${l.utm_campaign}, ${l.utm_term}, ${l.utm_content}, ${l.landing_page},
               ${l.gclid}, ${l.fbclid}, ${l.fbc}, ${l.fbp}, ${l.meta_campaign_id}, ${l.meta_adset_id}, ${l.meta_ad_id},
               ${l.origem}, true, true, ${l.created_at}, ${l.id}::uuid,
               ${JSON.stringify({ backfill: { fase: "06", lead: l.id } })}::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM pontos_contato WHERE aquisicao_id = ${aqId}::uuid AND lead_id_legado = ${l.id}::uuid
        )
      `);
    }
  }

  console.log("RELATÓRIO DE RECONCILIAÇÃO — fase 06, aquisição\n");
  console.log(`  linhas de origem (leads)      ${leads.length}`);
  console.log(`  aquisições criadas            ${criadas}`);
  console.log(`  já existiam                   ${jaExistiam}`);
  console.log(`  sem identidade resolvível     ${semIdentidade}  (sem pessoa e sem empresa: NÃO migradas)`);
  console.log(`  touchpoints de atribuição     ${touchpoints}`);
  console.log(`\n  por tipo:`);
  for (const [k, v] of [...porTipo].sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(12)}${v}`);
  console.log(`  por estado:`);
  for (const [k, v] of [...porEstado].sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(16)}${v}`);
  // Fato da origem que precisa ficar explícito no relatório, não escondido:
  // as colunas de qualificação de `leads` estão inteiramente vazias em produção.
  const semQualif = await db.execute<{ n: string }>(sql`
    SELECT count(*) AS n FROM leads
    WHERE qualificado IS NOT TRUE AND qualificado_em IS NULL AND desqualificado_em IS NULL`);
  console.log(`\n  DADO AUSENTE NA ORIGEM`);
  console.log(`    leads sem nenhum sinal de qualificação   ${semQualif[0]?.n ?? "?"} de ${leads.length}`);
  console.log(`    (qualificado, qualificado_em e desqualificado_em estão vazios no banco`);
  console.log(`     de produção. A aquisição nasce 'aberta' porque é o que o dado diz,`);
  console.log(`     não porque o backfill perdeu informação.)`);
  console.log(`\n  ${Math.round((Date.now() - t0) / 100) / 10}s\n`);
  if (!APLICAR) console.log("  Nada foi gravado.\n");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
