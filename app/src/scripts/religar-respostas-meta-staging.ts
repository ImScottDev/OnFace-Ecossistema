/**
 * Religa as RESPOSTAS DO FORMULÁRIO dos leads que entraram pelo caminho
 * Meta → n8n → RD Station, usando o `fb_lead_id` que ficou em
 * `meta_lead_staging`.
 *
 * Por que existe: o webhook do RD (`/api/webhooks/rd-lead`) lia o staging só
 * para pegar ad/adset/campaign e DESCARTAVA o `fb_lead_id` — a única chave que
 * permite buscar na Graph o que a pessoa respondeu. Esses leads ficaram com
 * `campos_custom` vazio e a ficha mostra "Sem formulário" (caso relatado:
 * WEVERTON GALVÃO, 07/10/2026, `fb_lead_id` 1825749208778073 no staging).
 * A porta já foi corrigida; isto religa o histórico.
 *
 * Diferente de `enriquecer-respostas-meta.ts`, que paginava os formulários da
 * Página numa janela de datas e casava por e-mail/telefone: aqui o casamento é
 * pelo ID do lead na Meta que nós mesmos guardamos, sem janela e sem palpite.
 *
 * Só ENRIQUECE lead existente: não cria lead, pessoa, aquisição, tarefa nem
 * evento, não dispara CAPI/WhatsApp/e-mail e NÃO toca `updated_at` (bumpar
 * updated_at num backfill faz o board de pré-vendas mostrar "há 1min" em lead
 * parado há semanas). O que já está em `campos_custom` vence.
 *
 *   pnpm tsx --env-file=.env src/scripts/religar-respostas-meta-staging.ts            # simula (default)
 *   pnpm tsx --env-file=.env src/scripts/religar-respostas-meta-staging.ts --aplicar  # grava
 */
import { db, fecharConexao } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  buscarLeadNaGraph, normalizarLeadAds, camposRastreioMeta, credenciaisLeadAds,
} from "@onface/integrations-meta";

const APLICAR = process.argv.includes("--aplicar");
const TABELA = "_religacao_respostas_meta_20261014";
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Par = { leadId: string; organizacaoId: string; fbLeadId: string; nome: string };

/** Leads sem nenhuma resposta de formulário que têm `fb_lead_id` no staging.
 *  Casamento por e-mail ou pelos últimos 10 dígitos do telefone. Lead com mais
 *  de um `fb_lead_id` candidato, ou `fb_lead_id` disputado por mais de um lead,
 *  fica de fora: no backfill, ambíguo é o mesmo que errado. */
async function pares(): Promise<Par[]> {
  return [...await db.execute<Par>(sql`
    WITH sem_resposta AS (
      SELECT l.id, l.organizacao_id, l.email, l.telefone,
             trim(concat_ws(' ', l.nome, l.sobrenome)) AS nome
        FROM leads l
       WHERE NOT EXISTS (
         SELECT 1 FROM jsonb_object_keys(coalesce(l.campos_custom, '{}'::jsonb)) k
          WHERE k !~* '^(zoho|crm2_|fonte_dado|nome_derivado_do_email|recuperacao|qualificacaoSdr|observacaoContato|cidadeContato|meta_)'
            AND k !~* '^motivo$'
            AND coalesce(trim(l.campos_custom->>k), '') <> ''
       )
    ), casados AS (
      SELECT DISTINCT sr.id AS lead_id, sr.organizacao_id, sr.nome, s.fb_lead_id
        FROM sem_resposta sr
        JOIN meta_lead_staging s
          ON s.fb_lead_id IS NOT NULL AND s.fb_lead_id <> ''
         AND ( (sr.email IS NOT NULL AND s.email IS NOT NULL AND lower(sr.email) = lower(s.email))
            OR (sr.telefone IS NOT NULL AND s.telefone IS NOT NULL
                AND length(regexp_replace(sr.telefone, '\D', '', 'g')) >= 10
                AND right(regexp_replace(sr.telefone, '\D', '', 'g'), 10)
                  = right(regexp_replace(s.telefone, '\D', '', 'g'), 10)) )
    )
    SELECT lead_id::text AS "leadId", organizacao_id::text AS "organizacaoId",
           fb_lead_id AS "fbLeadId", nome
      FROM casados c
     WHERE (SELECT count(*) FROM casados x WHERE x.lead_id = c.lead_id) = 1
       AND (SELECT count(*) FROM casados y WHERE y.fb_lead_id = c.fb_lead_id) = 1
     ORDER BY lead_id`)];
}

async function main() {
  console.log(`\n  RELIGAR respostas Meta pelo staging ${APLICAR ? "(APLICANDO)" : "(simulação)"}\n`);
  const { accessToken } = credenciaisLeadAds();
  if (!accessToken) { console.error("  META_LEADS_ACCESS_TOKEN ausente: sem ele a Meta não entrega as respostas."); process.exit(1); }

  const alvos = await pares();
  console.log(`  leads sem resposta com fb_lead_id no staging: ${alvos.length}\n`);

  if (APLICAR) {
    await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS ${TABELA} (
      lead_id uuid PRIMARY KEY, fb_lead_id text, antes jsonb, gravado_em timestamptz DEFAULT now())`));
  }

  let gravados = 0, semResposta = 0, falhas = 0;
  for (const a of alvos) {
    const busca = await buscarLeadNaGraph(a.fbLeadId, accessToken);
    await pausa(300); // limite de taxa da Graph
    if (!busca.ok || !busca.lead) {
      falhas++;
      console.warn(`  falha  ${a.nome || a.leadId} (${a.fbLeadId}): ${busca.erro}`);
      continue;
    }
    const { respostas } = normalizarLeadAds(busca.lead);
    const novas = { ...respostas, ...camposRastreioMeta(busca.lead) };
    if (Object.keys(respostas).length === 0) {
      semResposta++;
      continue; // formulário só de identidade: nada a mostrar na lista
    }
    console.log(`  ${APLICAR ? "grava " : "mostra"} ${a.nome || a.leadId}: ${Object.keys(novas).join(", ")}`);
    if (!APLICAR) continue;

    // `novas || campos_custom` deixa o que já existe VENCER (operando da direita
    // manda no jsonb). `updated_at` fica como está, de propósito.
    await db.execute(sql`
      INSERT INTO ${sql.identifier(TABELA)} (lead_id, fb_lead_id, antes)
      SELECT id, ${a.fbLeadId}, campos_custom FROM leads
       WHERE id = ${a.leadId}::uuid AND organizacao_id = ${a.organizacaoId}::uuid
      ON CONFLICT (lead_id) DO NOTHING`);
    await db.execute(sql`
      UPDATE leads
         SET campos_custom = ${JSON.stringify(novas)}::jsonb || coalesce(campos_custom, '{}'::jsonb)
       WHERE id = ${a.leadId}::uuid AND organizacao_id = ${a.organizacaoId}::uuid`);
    gravados++;
  }

  console.log(`\n  ${APLICAR ? "gravados" : "a gravar"}: ${APLICAR ? gravados : alvos.length - semResposta - falhas}`);
  console.log(`  formulário só de identidade (nada a gravar): ${semResposta}`);
  console.log(`  não vieram da Graph: ${falhas}`);
  if (!APLICAR) console.log(`\n  nada foi gravado. Repita com --aplicar.\n`);
  await fecharConexao();
}

main().catch(async (e) => { console.error(e); await fecharConexao(); process.exit(1); });
