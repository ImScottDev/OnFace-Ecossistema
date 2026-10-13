/**
 * Uso único (13/10/2026): preenche em `leads.campos_custom` as respostas do
 * formulário Meta Lead Ads dos leads de jul–set/2026 que entraram sem elas.
 *
 * Só ENRIQUECE lead existente. Não cria lead, pessoa, aquisição, tarefa nem
 * evento, e não dispara CAPI/WhatsApp/e-mail (não passa por
 * `garantirEntradaCanonica`, ao contrário de importar-meta-lead-ads.ts).
 * O que já existe em campos_custom vence; `updated_at` não é tocado.
 *
 * Casamento: meta_leadgen_id, e-mail normalizado ou telefone (últimos 10
 * dígitos), dentro da organização. Mais de um lead candidato = ambíguo, pula.
 * Antes de escrever, grava o estado anterior em `_enriquecimento_meta_20261013`.
 *
 *   pnpm tsx --env-file=.env src/scripts/enriquecer-respostas-meta.ts            # dry-run
 *   pnpm tsx --env-file=.env src/scripts/enriquecer-respostas-meta.ts --aplicar
 */
import { db, fecharConexao } from "@/lib/db";
import { sql } from "drizzle-orm";
import { credenciaisLeadAds, metaGraphUrl, normalizarLeadAds, camposRastreioMeta, type LeadAdsBruto } from "@onface/integrations-meta";

const APLICAR = process.argv.includes("--aplicar");
const TABELA = "_enriquecimento_meta_20261013";

async function graph<T>(caminho: string, token: string): Promise<{ ok: true; dados: T } | { ok: false; erro: string }> {
  try {
    const r = await fetch(metaGraphUrl(caminho), { headers: { Authorization: `Bearer ${token}` } });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, erro: (corpo as { error?: { message?: string } }).error?.message ?? `HTTP ${r.status}` };
    return { ok: true, dados: corpo as T };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Pagina = { data?: LeadAdsBruto[]; paging?: { next?: string } };
async function leadsDoFormulario(formId: string, token: string, desde: Date): Promise<LeadAdsBruto[]> {
  const campos = "id,created_time,ad_id,adset_id,campaign_id,ad_name,adset_name,campaign_name,form_id,platform,is_organic,field_data";
  let caminho: string | null = `${formId}/leads?fields=${campos}&limit=100`;
  const todos: LeadAdsBruto[] = [];
  while (caminho) {
    const r: Awaited<ReturnType<typeof graph<Pagina>>> = await graph<Pagina>(caminho, token);
    if (!r.ok) { console.error(`    falha ao paginar ${formId}: ${r.erro}`); break; }
    for (const b of r.dados.data ?? []) {
      if (b.created_time && new Date(b.created_time) < desde) return todos;
      todos.push({ ...b, leadgen_id: String(b.leadgen_id ?? b.id ?? "") });
    }
    const prox: string | undefined = r.dados.paging?.next;
    caminho = prox ? prox.replace(/^https:\/\/graph\.facebook\.com\/v[0-9.]+\//, "") : null;
    await pausa(400);
  }
  return todos;
}

interface Alvo { id: string; email: string | null; tel: string | null; leadgen: string | null; campos: Record<string, unknown> }
const tel10 = (t?: string | null) => { const d = (t ?? "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : null; };

async function main() {
  console.log(`\n  ENRIQUECER respostas Meta ${APLICAR ? "(APLICANDO)" : "(dry-run)"}\n`);
  const cred = credenciaisLeadAds();
  if (!cred.accessToken || !cred.pageId) { console.error("  META_LEADS_ACCESS_TOKEN ou META_PAGE_ID ausente."); process.exit(1); }

  const [org] = await db.execute<{ id: string }>(sql`SELECT id FROM organizacoes LIMIT 1`);

  // Alvos: leads Meta de jul–set sem nenhuma chave de resposta (todas as chaves começam com meta_).
  const alvosDb = await db.execute<{ id: string; email: string | null; telefone: string | null; campos_custom: Record<string, unknown> | null }>(sql`
    SELECT id::text, email, telefone, campos_custom FROM leads l
     WHERE organizacao_id = ${org.id}::uuid
       AND lower(coalesce(utm_source,'')) IN ('meta','ig','fb','facebook','instagram')
       AND created_at >= '2026-07-01' AND created_at < '2026-10-01'
       AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys(coalesce(l.campos_custom,'{}'::jsonb)) k WHERE k NOT LIKE 'meta\_%')`);
  const alvos: Alvo[] = alvosDb.map((r) => ({
    id: r.id, email: r.email?.trim().toLowerCase() || null, tel: tel10(r.telefone),
    leadgen: (r.campos_custom?.meta_leadgen_id as string | undefined) ?? null, campos: r.campos_custom ?? {},
  }));
  console.log(`  leads-alvo sem respostas: ${alvos.length}`);
  const porLeadgen = new Map<string, Alvo[]>(), porEmail = new Map<string, Alvo[]>(), porTel = new Map<string, Alvo[]>();
  const add = (m: Map<string, Alvo[]>, k: string | null, a: Alvo) => { if (k) (m.get(k) ?? m.set(k, []).get(k)!).push(a); };
  for (const a of alvos) { add(porLeadgen, a.leadgen, a); add(porEmail, a.email, a); add(porTel, a.tel, a); }

  const troca = await graph<{ access_token?: string }>(`${cred.pageId}?fields=access_token`, cred.accessToken);
  const token = troca.ok ? (troca.dados.access_token ?? cred.accessToken) : cred.accessToken;
  const forms = await graph<{ data?: { id: string; name?: string; leads_count?: number }[] }>(
    `${cred.pageId}/leadgen_forms?fields=id,name,status,leads_count&limit=50`, token);
  if (!forms.ok) { console.error(`  não listou formulários: ${forms.erro}`); process.exit(1); }

  const desde = new Date("2026-07-01T00:00:00Z");
  const graphLeads: { bruto: LeadAdsBruto; form: string | null }[] = [];
  for (const f of (forms.dados.data ?? []).filter((x) => (x.leads_count ?? 0) > 0)) {
    const l = await leadsDoFormulario(f.id, token, desde);
    const maisAntigo = l.length ? l[l.length - 1].created_time : null;
    console.log(`  form ${f.name ?? f.id}: ${l.length} lead(s) desde 01/07 (mais antigo: ${maisAntigo ? String(maisAntigo).slice(0, 10) : "-"})`);
    for (const bruto of l) graphLeads.push({ bruto, form: f.name ?? null });
  }

  // Casamento
  const plano = new Map<string, { novas: Record<string, string>; fonte: string }>();
  let semMatch = 0, ambiguos = 0, semResposta = 0, duplicadoGraph = 0;
  const vistosLead = new Set<string>();
  for (const { bruto, form } of graphLeads) {
    const n = normalizarLeadAds(bruto);
    const cand = new Map<string, Alvo>();
    let via = "";
    const porId = porLeadgen.get(String(bruto.leadgen_id)) ?? [];
    if (porId.length) { porId.forEach((a) => cand.set(a.id, a)); via = "leadgen_id"; }
    else {
      const e = n.email?.trim().toLowerCase(); const t = tel10(n.telefone);
      (e ? porEmail.get(e) ?? [] : []).forEach((a) => cand.set(a.id, a));
      (t ? porTel.get(t) ?? [] : []).forEach((a) => cand.set(a.id, a));
      via = "email/telefone";
    }
    if (cand.size === 0) { semMatch++; continue; }
    if (cand.size > 1) { ambiguos++; continue; }
    if (!Object.keys(n.respostas).length) { semResposta++; continue; }
    const [alvo] = [...cand.values()];
    if (vistosLead.has(alvo.id)) { duplicadoGraph++; plano.delete(alvo.id); continue; }
    vistosLead.add(alvo.id);
    plano.set(alvo.id, { novas: { ...n.respostas, ...camposRastreioMeta(bruto, { formNome: form }) }, fonte: `graph:${via}` });
  }
  console.log(`\n  leads na Graph (jul–hoje)     ${graphLeads.length}`);
  console.log(`  casam com lead-alvo e ganham  ${plano.size}`);
  console.log(`  ambíguos (pulados)            ${ambiguos}`);
  console.log(`  Graph sem lead-alvo           ${semMatch}`);
  console.log(`  Graph sem respostas           ${semResposta}`);
  console.log(`  lead-alvo com 2+ leads Graph  ${duplicadoGraph} (pulados)`);
  console.log(`  alvos que ficam sem respostas ${alvos.length - plano.size}`);

  if (!APLICAR) { console.log("\n  dry-run — nada escrito. Use --aplicar.\n"); return; }

  // Set-based: backup e UPDATE a partir do mesmo json, na mesma transação.
  const json = JSON.stringify([...plano].map(([id, p]) => ({ id, novas: p.novas, fonte: p.fonte })));
  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`CREATE TABLE IF NOT EXISTS ${TABELA} (lead_id uuid, campos_custom_antes jsonb, campos_custom_depois jsonb, fonte text)`));
    await tx.execute(sql`
      INSERT INTO ${sql.raw(TABELA)} (lead_id, campos_custom_antes, campos_custom_depois, fonte)
      SELECT l.id, l.campos_custom, p.novas || coalesce(l.campos_custom, '{}'::jsonb), p.fonte
        FROM leads l JOIN jsonb_to_recordset(${json}::jsonb) AS p(id uuid, novas jsonb, fonte text) ON p.id = l.id`);
    await tx.execute(sql`
      UPDATE leads l SET campos_custom = p.novas || coalesce(l.campos_custom, '{}'::jsonb)
        FROM jsonb_to_recordset(${json}::jsonb) AS p(id uuid, novas jsonb, fonte text) WHERE l.id = p.id`);
  });
  console.log(`\n  aplicado: ${plano.size} leads atualizados. Estado anterior em ${TABELA}.\n`);
}

main().then(() => fecharConexao()).then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
