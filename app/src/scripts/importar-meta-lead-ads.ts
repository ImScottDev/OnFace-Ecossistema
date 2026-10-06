/**
 * Importação histórica de Lead Ads da Meta (SPEC §20).
 *
 * O caminho de hoje é reativo: o webhook avisa de um lead por vez, e só a
 * partir do momento em que passou a existir. Tudo que entrou antes disso mora
 * na Meta e em lugar nenhum nosso — em 23/09 eram 877 leads em 4 formulários,
 * enquanto o RD Station seguia sendo a fonte de fato dos leads pagos.
 *
 * Este script varre os formulários da Página e traz a janela histórica pela
 * MESMA porta que o webhook usa: `garantirEntradaCanonica`. Nada de INSERT
 * direto — o que vale para o lead que chega agora vale para o que chegou em
 * julho.
 *
 * ## Idempotente por desenho
 *
 * A chave é `chaveDeIdempotencia(n)`, derivada do `leadgen_id` da Meta, a mesma
 * que o webhook grava. Rodar duas vezes, ou rodar depois que o webhook já
 * trouxe o lead, devolve a aquisição existente em vez de criar outra. Por isso
 * a janela pode ser generosa sem medo.
 *
 * ## O que NÃO faz
 *
 * Não inventa identidade. Lead sem e-mail e sem telefone é contado e relatado,
 * nunca forçado para dentro: a porta canônica recusa de propósito, e um
 * registro que ninguém consegue contatar é pior que um lead ausente.
 *
 *   pnpm tsx --env-file=.env src/scripts/importar-meta-lead-ads.ts
 *   pnpm tsx --env-file=.env src/scripts/importar-meta-lead-ads.ts --aplicar
 *   pnpm tsx --env-file=.env src/scripts/importar-meta-lead-ads.ts --aplicar --dias=180
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  credenciaisLeadAds, metaGraphUrl, normalizarLeadAds, chaveDeIdempotencia,
  type LeadAdsBruto,
} from "@onface/integrations-meta";
import { garantirEntradaCanonica } from "@/lib/vendas/ponte-canonica";

const APLICAR = process.argv.includes("--aplicar");
const DIAS = Number(process.argv.find((a) => a.startsWith("--dias="))?.slice("--dias=".length) ?? 90);

interface Formulario { id: string; name?: string; status?: string; leads_count?: number }

async function graph<T>(caminho: string, token: string): Promise<{ ok: true; dados: T } | { ok: false; erro: string }> {
  try {
    const r = await fetch(metaGraphUrl(caminho), { headers: { Authorization: `Bearer ${token}` } });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = (corpo as { error?: { message?: string } }).error;
      return { ok: false, erro: e?.message ?? `HTTP ${r.status}` };
    }
    return { ok: true, dados: corpo as T };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Páginas de leads de um formulário, seguindo o cursor até o fim.
 *
 * O filtro de data é feito aqui e não na Graph: `filtering` no endpoint de
 * leads é recusado em algumas versões, e paginar tudo para descartar depois é
 * barato num volume de centenas. Se a base crescer para dezenas de milhares,
 * trocar por `filtering` com `time_created` é a otimização óbvia.
 */
async function leadsDoFormulario(formId: string, token: string, desde: Date): Promise<LeadAdsBruto[]> {
  const campos = "id,created_time,ad_id,adset_id,campaign_id,ad_name,adset_name,campaign_name,form_id,platform,field_data";
  let caminho: string | null = `${formId}/leads?fields=${campos}&limit=100`;
  const todos: LeadAdsBruto[] = [];

  while (caminho) {
    const r: { ok: true; dados: { data?: LeadAdsBruto[]; paging?: { next?: string } } } | { ok: false; erro: string } =
      await graph<{ data?: LeadAdsBruto[]; paging?: { next?: string } }>(caminho, token);
    if (!r.ok) {
      console.error(`    ✘ falha ao paginar ${formId}: ${r.erro}`);
      break;
    }
    for (const bruto of r.dados.data ?? []) {
      const quando = bruto.created_time ? new Date(bruto.created_time) : null;
      if (quando && quando < desde) return todos; // A Meta devolve do mais novo para o mais antigo.
      // `id` é o leadgen_id no endpoint de listagem; o normalizador espera
      // `leadgen_id`, que é como o webhook entrega.
      todos.push({ ...bruto, leadgen_id: String(bruto.leadgen_id ?? bruto.id ?? "") });
    }
    const proxima: string | undefined = r.dados.paging?.next;
    caminho = proxima ? proxima.replace(/^https:\/\/graph\.facebook\.com\/v[0-9.]+\//, "") : null;
  }
  return todos;
}

/**
 * Lead legado correspondente, criando quando não existe.
 *
 * Por que é obrigatório e não enfeite de migração: `registrar-entrada.ts` diz,
 * em comentário próprio, que aquisição sem `lead_legado_id` "nasce órfã — o
 * card não abre e nada do lead volta a propagar para ela". A leitura canônica
 * do board devolve esse id COMO o id do card.
 *
 * Medido em 23/09: a primeira versão deste script (e o webhook de leadgen, que
 * tem o mesmo buraco) criou 54 aquisições sem o vínculo, e o board passou a
 * divergir da conferência independente em exatamente 54 — "sem 1o contato"
 * dizia 1016 contra 962.
 *
 * A busca é por e-mail e telefone, os mesmos identificadores que a porta
 * canônica usa para decidir identidade. Sem isso, reimportar criaria um lead
 * legado novo a cada rodada e a idempotência da aquisição não salvaria a tabela
 * `leads` de duplicar.
 */
async function garantirLeadLegado(
  organizacaoId: string,
  n: ReturnType<typeof normalizarLeadAds>,
): Promise<string | null> {
  const email = n.email?.trim().toLowerCase() || null;
  const telefone = n.telefone?.replace(/\D/g, "") || null;
  if (!email && !telefone) return null;

  /* As respostas das perguntas EXTRAS do formulário (tudo que não virou nome/
     e-mail/telefone/empresa/cargo) são o que o operador pediu para ver na ficha.
     `normalizarLeadAds` já as separa em `respostas`; aqui elas finalmente são
     persistidas em `campos_custom`, junto do id do anúncio para o link do
     criativo. Antes nada disso era gravado e a ficha nascia muda. */
  const extra: Record<string, unknown> = { ...(n.respostas ?? {}) };
  if (n.atribuicao.adId) extra.meta_ad_id = n.atribuicao.adId;
  const camposJson = Object.keys(extra).length ? JSON.stringify(extra) : null;

  const [ja] = await db.execute<{ id: string }>(sql`
    SELECT id::text FROM leads
     WHERE organizacao_id = ${organizacaoId}::uuid
       AND ((${email}::text IS NOT NULL AND lower(email) = ${email})
         OR (${telefone}::text IS NOT NULL AND regexp_replace(coalesce(telefone,''), '\D', '', 'g') = ${telefone}))
     ORDER BY created_at ASC LIMIT 1`);
  if (ja) {
    /* Enriquecimento NÃO toca `updated_at`: o board ordena por ele e um backfill
       em massa faria todos os leads parecerem "tocados agora". Mescla por `||`
       para não apagar respostas já gravadas em rodadas anteriores. */
    if (camposJson) await db.execute(sql`
      UPDATE leads SET campos_custom = coalesce(campos_custom, '{}'::jsonb) || ${camposJson}::jsonb
       WHERE id = ${ja.id}::uuid`);
    return ja.id;
  }

  const partes = (n.nome ?? "").trim().split(/\s+/);
  const [novo] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, sobrenome, email, telefone, empresa, cargo,
                       origem, tipo, sdr_status, utm_source, utm_medium, utm_campaign,
                       utm_term, utm_content, meta_ad_id, meta_adset_id, meta_campaign_id,
                       campos_custom, created_at, updated_at)
    VALUES (${organizacaoId}::uuid, ${partes[0] || null}, ${partes.slice(1).join(" ") || null},
            ${n.email}, ${n.telefone}, ${n.empresa}, ${n.cargo},
            'Mídia Paga', 'lead', 'pending',
            ${n.atribuicao.utmSource}, ${n.atribuicao.utmMedium}, ${n.atribuicao.utmCampaign},
            ${n.atribuicao.utmTerm}, ${n.atribuicao.utmContent},
            ${n.atribuicao.adId}, ${n.atribuicao.adsetId}, ${n.atribuicao.campaignId},
            coalesce(${camposJson}::jsonb, '{}'::jsonb),
            ${n.ocorridoEm ?? new Date()}, ${n.ocorridoEm ?? new Date()})
    RETURNING id::text`);
  return novo?.id ?? null;
}

async function main() {
  console.log(`\n  IMPORTAÇÃO Meta Lead Ads — últimos ${DIAS} dias ${APLICAR ? "(APLICANDO)" : "(dry-run)"}\n`);

  const cred = credenciaisLeadAds();
  if (!cred.accessToken || !cred.pageId) {
    console.error("  ✘ META_LEADS_ACCESS_TOKEN ou META_PAGE_ID ausente neste ambiente.");
    console.error("    A importação não roda sem as duas. Nada foi escrito.");
    process.exit(1);
  }

  const [org] = await db.execute<{ id: string; nome: string }>(sql`SELECT id, nome FROM organizacoes LIMIT 1`);
  if (!org) { console.error("  ✘ nenhuma organização no banco."); process.exit(1); }
  console.log(`  organização: ${org.nome}`);

  // Listar formulários exige Page Access Token; o retrieval do lead aceita o de
  // System User. A troca é feita aqui uma vez.
  const troca = await graph<{ access_token?: string }>(`${cred.pageId}?fields=access_token`, cred.accessToken);
  const tokenPagina = troca.ok ? (troca.dados.access_token ?? cred.accessToken) : cred.accessToken;

  const forms = await graph<{ data?: Formulario[] }>(
    `${cred.pageId}/leadgen_forms?fields=id,name,status,leads_count&limit=50`, tokenPagina);
  if (!forms.ok) { console.error(`  ✘ não listou formulários: ${forms.erro}`); process.exit(1); }

  const lista = (forms.dados.data ?? []).filter((f) => (f.leads_count ?? 0) > 0);
  console.log(`  formulários com lead: ${lista.length}\n`);

  const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000);
  let vistos = 0, criados = 0, jaExistiam = 0, semIdentidade = 0, falhas = 0;

  for (const form of lista) {
    const leads = await leadsDoFormulario(form.id, tokenPagina, desde);
    console.log(`  ── ${form.name ?? form.id} — ${leads.length} lead(s) na janela`);
    vistos += leads.length;

    for (const bruto of leads) {
      const n = normalizarLeadAds(bruto);
      if (!n.email && !n.telefone) { semIdentidade++; continue; }
      if (!APLICAR) { criados++; continue; }

      const leadLegadoId = APLICAR ? await garantirLeadLegado(org.id, n) : null;
      const r = await garantirEntradaCanonica({
        organizacaoId: org.id,
        tipo: "INBOUND",
        origem: "Mídia Paga",
        provider: "meta",
        pessoa: { nome: n.nome, email: n.email, telefone: n.telefone, cargo: n.cargo },
        empresa: n.empresa ? { nome: n.empresa } : null,
        atribuicao: {
          utmSource: n.atribuicao.utmSource,
          utmMedium: n.atribuicao.utmMedium,
          utmCampaign: n.atribuicao.utmCampaign,
          utmContent: n.atribuicao.utmContent,
          utmTerm: n.atribuicao.utmTerm,
          metaLeadId: n.atribuicao.metaLeadId,
          adId: n.atribuicao.adId,
          adsetId: n.atribuicao.adsetId,
          campaignId: n.atribuicao.campaignId,
        },
        idempotencyKey: chaveDeIdempotencia(n),
        ocorridoEm: n.ocorridoEm,
      }, leadLegadoId);

      if (!r.ok) { falhas++; console.error(`     ✘ ${n.metaLeadId}: ${r.erro ?? "recusado"}`); continue; }
      if (r.criada) criados++; else jaExistiam++;
    }
  }

  console.log(`\n  leads na janela           ${vistos}`);
  console.log(`  ${APLICAR ? "aquisições criadas      " : "entrariam (dry-run)     "}  ${criados}`);
  if (APLICAR) console.log(`  já existiam (idempotência) ${jaExistiam}`);
  console.log(`  sem e-mail e sem telefone ${semIdentidade}`);
  if (falhas) console.log(`  falhas                    ${falhas}`);
  if (!APLICAR) console.log(`\n  dry-run — nada escrito. Use --aplicar.\n`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
