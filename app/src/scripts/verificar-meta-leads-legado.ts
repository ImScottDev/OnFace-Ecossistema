/**
 * Prova da rota /api/webhooks/meta-leads gravando o lead legado.
 *
 *   npx tsx --env-file=.env src/scripts/verificar-meta-leads-legado.ts
 *
 * Banco LOCAL, Graph mockada (fetch). Apaga o que criou no fim.
 */
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

process.env.META_APP_SECRET = "segredo-de-teste";
process.env.META_LEADS_ACCESS_TOKEN = "token-de-teste";

const TAG = process.env.TAG_TESTE || `vml${Date.now()}`; // TAG_TESTE=vml varre resíduo de rodadas interrompidas
const EMAIL = `${TAG}@teste-meta.invalid`;
const EMAIL_EXISTENTE = `${TAG}-ja@teste-meta.invalid`;
const FONE = `+5511${String(Date.now()).slice(-9)}`;
const GENS = [`${TAG}1`, `${TAG}2`];
let falhas = 0;
const ok = (c: unknown, m: string) => { console.log(`  ${c ? "ok   " : "FALHA"} ${m}`); if (!c) falhas++; };

// Graph: devolve o lead conforme o leadgen_id pedido.
const graph: Record<string, { email: string; nome: string; resposta: string }> = {
  [GENS[0]]: { email: EMAIL, nome: "Maria Teste Silva", resposta: "50 mil" },
  [GENS[1]]: { email: EMAIL_EXISTENTE, nome: "Joao Ja Existe", resposta: "10 mil" },
};
const fetchReal = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request) => {
  const u = String(url);
  const g = Object.entries(graph).find(([id]) => u.includes(`/${id}?`));
  if (!g) return fetchReal(url as never);
  const [id, d] = g;
  return new Response(JSON.stringify({
    id, created_time: new Date().toISOString(), ad_id: "ad1", adset_id: "as1", campaign_id: "cp1",
    field_data: [
      { name: "full_name", values: [d.nome] }, { name: "email", values: [d.email] },
      { name: "phone_number", values: [FONE] }, { name: "faturamento", values: [d.resposta] },
    ],
  }), { status: 200 });
}) as typeof fetch;

async function chamar(leadgenId: string) {
  const { POST } = await import("@/app/api/webhooks/meta-leads/route");
  const corpo = JSON.stringify({ entry: [{ changes: [{ field: "leadgen", value: { leadgen_id: leadgenId } }] }] });
  const sig = "sha256=" + createHmac("sha256", process.env.META_APP_SECRET!).update(corpo).digest("hex");
  const res = await POST(new NextRequest("http://localhost/api/webhooks/meta-leads", {
    method: "POST", body: corpo, headers: { "x-hub-signature-256": sig, "content-type": "application/json" },
  }));
  return { status: res.status, json: await res.json() };
}

const leadsPor = (email: string) => db.execute<{ id: string; camposCustom: Record<string, string>; origem: string; sdr: string; resp: string | null; meta_ad_id: string | null }>(sql`
  SELECT id::text, campos_custom AS "camposCustom", origem, sdr_status AS sdr, responsavel_id::text AS resp, meta_ad_id FROM leads WHERE email = ${email}`);
const aqPorLead = (id: string) => db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM aquisicoes WHERE lead_legado_id = ${id}::uuid`);

async function main() {
  console.log("1. Lead novo da Meta");
  const r1 = await chamar(GENS[0]);
  ok(r1.status === 200 && r1.json.ok, `POST 200 (${r1.status}) ${JSON.stringify(r1.json)}`);
  const [l1] = await leadsPor(EMAIL);
  ok(!!l1, "lead existe em `leads`");
  ok(l1?.origem === "Mídia Paga" && l1?.sdr === "pending" && l1?.meta_ad_id === "ad1", "origem, sdr_status e meta_ad_id gravados");
  ok(l1?.camposCustom?.faturamento === "50 mil", "campos_custom com a resposta do formulário");
  ok(l1 && (await aqPorLead(l1.id))[0].n === 1, "aquisição com lead_legado_id = id do lead");

  console.log("2. Reentrega do mesmo leadgen_id");
  const r2 = await chamar(GENS[0]);
  ok(r2.status === 200, "POST 200");
  ok((await leadsPor(EMAIL)).length === 1, "continua 1 lead");
  ok(l1 && (await aqPorLead(l1.id))[0].n === 1, "continua 1 aquisição vinculada");

  console.log("3. E-mail já existente atualiza, não duplica");
  const [org] = await db.execute<{ id: string }>(sql`SELECT id::text FROM organizacoes WHERE slug = 'scott-studio'`);
  const [ex] = await db.execute<{ id: string }>(sql`
    INSERT INTO leads (organizacao_id, nome, email, tipo, status, sdr_status, utm_source, campos_custom)
    VALUES (${org.id}::uuid, 'Joao', ${EMAIL_EXISTENTE}, 'lead', 'novo', 'pending', 'origem-original', '{"antigo":"fica"}'::jsonb)
    RETURNING id::text`);
  const r3 = await chamar(GENS[1]);
  ok(r3.status === 200, "POST 200");
  const l3 = await leadsPor(EMAIL_EXISTENTE);
  ok(l3.length === 1 && l3[0].id === ex.id, "continua 1 lead, o mesmo id");
  ok(l3[0]?.camposCustom?.antigo === "fica" && l3[0]?.camposCustom?.faturamento === "10 mil", "campos_custom mesclado");
  const [u] = await db.execute<{ utm_source: string }>(sql`SELECT utm_source FROM leads WHERE id = ${ex.id}::uuid`);
  ok(u.utm_source === "origem-original", "first-touch (utm_source) preservado");
  ok((await aqPorLead(ex.id))[0].n === 1, "aquisição vinculada ao lead existente");
}

main()
  .catch((e) => { console.error(e); falhas++; })
  .finally(async () => {
    try {
      // Apaga por coluna de vínculo (aquisicao_id / pessoa_id / lead_id), generico: não depende de saber cada tabela filha.
      const L = sql`(SELECT id FROM leads WHERE email LIKE ${TAG + "%"})`;
      const P = sql`(SELECT id FROM pessoas WHERE email LIKE ${TAG + "%"})`;
      const AQ = sql`(SELECT id FROM aquisicoes WHERE lead_legado_id IN ${L} OR pessoa_id IN ${P})`;
      const filhas = await db.execute<{ t: string; c: string }>(sql`
        SELECT table_name t, column_name c FROM information_schema.columns
         WHERE table_schema='public' AND column_name IN ('aquisicao_id','pessoa_id','lead_id') AND table_name NOT IN ('aquisicoes','pessoas','leads')`);
      const alvo = { aquisicao_id: AQ, pessoa_id: P, lead_id: L } as const;
      for (const f of filhas) {
        try { await db.execute(sql`DELETE FROM ${sql.raw(`"${f.t}"`)} WHERE ${sql.raw(`"${f.c}"`)} IN ${alvo[f.c as keyof typeof alvo]}`); } catch { /* tabela sem linha de teste ou FK; tenta de novo abaixo */ }
      }
      await db.execute(sql`DELETE FROM outbox_eventos WHERE source='meta' AND idempotency_key LIKE ${"%" + TAG + "%"}`).catch(() => {});
      await db.execute(sql`DELETE FROM backfill_provenance WHERE id_origem IN (SELECT id::text FROM leads WHERE email LIKE ${TAG + "%"})`).catch(() => {});
      await db.execute(sql`DELETE FROM aquisicoes WHERE id IN ${AQ}`);
      await db.execute(sql`DELETE FROM pessoas WHERE id IN ${P}`);
      await db.execute(sql`DELETE FROM leads WHERE email LIKE ${TAG + "%"}`);
      const [r] = await db.execute<{ n: number }>(sql`SELECT (SELECT count(*) FROM leads WHERE email LIKE ${TAG + "%"}) + (SELECT count(*) FROM pessoas WHERE email LIKE ${TAG + "%"}) AS n`);
      console.log(`limpeza: resíduo = ${r.n}`);
      if (Number(r.n)) falhas++;
    } finally {
      console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo verde");
      process.exit(falhas ? 1 : 0);
    }
  });
