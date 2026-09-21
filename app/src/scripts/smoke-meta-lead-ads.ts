/**
 * Smoke da entrada DIRETA de Lead Ads (SPEC §20), contra a Graph API REAL.
 *
 * O que ele prova, e por que cada passo existe:
 *
 *  1. O envelope que a Meta manda NÃO traz os dados da pessoa. Este smoke
 *     entrega exatamente esse envelope — `leadgen_id`, `page_id`, `form_id`,
 *     sem `field_data` — justamente para que o retrieval seja obrigatório.
 *     Se o retrieval quebrar, o lead entra vazio e o passo 3 falha.
 *  2. Assinatura errada é 401 e não escreve nada. Webhook é porta de escrita
 *     pública.
 *  3. Com o token válido, o lead REAL entra pela porta canônica, com o e-mail
 *     e o telefone que a Meta devolveu (nunca impressos aqui).
 *  4. Reentrega do MESMO `leadgen_id` não vira segunda aquisição nem segundo
 *     ponto de contato. A Meta reentrega sempre que não recebe 200 rápido.
 *  5. `leadgen_id` que a Graph não conhece NÃO vira registro: sem e-mail e sem
 *     telefone a porta recusa, e não se inventa identificador para passar.
 *
 * Roda contra o banco local, nunca produção. Limpa o que criou.
 *
 *     pnpm tsx --env-file=.env src/scripts/smoke-meta-lead-ads.ts
 */
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { credenciaisLeadAds, metaGraphUrl } from "@onface/integrations-meta";
import { POST as webhookMetaLeads } from "@/app/api/webhooks/meta-leads/route";
import { fecharFilas } from "@/lib/queue";

const TAG = "[SMOKE-META-LEADS]";
let passou = 0;
let falhou = 0;

function ok(nome: string, condicao: boolean, detalhe = "") {
  if (condicao) { passou++; console.log(`  OK    ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
  else { falhou++; console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
}

/** Entrega no endpoint REAL, assinado como a Meta assina. */
async function entregar(corpo: unknown, assinar = true) {
  const bruto = JSON.stringify(corpo);
  const { appSecret } = credenciaisLeadAds();
  const hmac = createHmac("sha256", appSecret ?? "").update(bruto).digest("hex");
  const req = new NextRequest("http://local/api/webhooks/meta-leads", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": assinar ? `sha256=${hmac}` : "sha256=0000",
    },
    body: bruto,
  });
  const res = await webhookMetaLeads(req);
  return { status: res.status, corpo: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/** Envelope idêntico ao que a Meta posta: avisa que existe um lead, e só. */
function envelope(leadgenId: string, pageId: string, formId: string) {
  return {
    object: "page",
    entry: [{
      id: pageId,
      time: Math.floor(Date.now() / 1000),
      changes: [{
        field: "leadgen",
        value: {
          leadgen_id: leadgenId,
          page_id: pageId,
          form_id: formId,
          adgroup_id: null,
          created_time: Math.floor(Date.now() / 1000),
        },
      }],
    }],
  };
}

async function graph<T>(caminho: string, token: string): Promise<T> {
  const r = await fetch(metaGraphUrl(caminho), { headers: { authorization: `Bearer ${token}` } });
  const j = await r.json();
  if (!r.ok) throw new Error(`Graph ${caminho}: ${JSON.stringify(j).slice(0, 200)}`);
  return j as T;
}

async function main() {
  const cred = credenciaisLeadAds();
  if (!cred.accessToken || !cred.appSecret || !cred.pageId) {
    console.log(`${TAG} PULADO: falta META_LEADS_ACCESS_TOKEN, META_APP_SECRET ou META_PAGE_ID no ambiente.`);
    return 0;
  }

  console.log(`${TAG} buscando um lead real na Graph API...`);

  // Listar formulários exige Page Access Token; ler o lead, não. O System User
  // troca por um na hora, então a integração não precisa guardar esse token.
  const pg = await graph<{ access_token: string }>(`${cred.pageId}?fields=access_token`, cred.accessToken);
  const forms = await graph<{ data: Array<{ id: string; name: string; leads_count: number }> }>(
    `${cred.pageId}/leadgen_forms?fields=id,name,leads_count&limit=25`, pg.access_token);
  const comLeads = forms.data.filter((f) => f.leads_count > 0).sort((a, b) => b.leads_count - a.leads_count);
  if (!comLeads.length) {
    console.log(`${TAG} PULADO: a Página não tem formulário com lead para exercitar a cadeia.`);
    return 0;
  }
  const form = comLeads[0];
  const leads = await graph<{ data: Array<{ id: string; created_time: string }> }>(
    `${form.id}/leads?limit=1`, pg.access_token);
  if (!leads.data?.length) {
    console.log(`${TAG} PULADO: formulário ${form.id} não devolveu lead.`);
    return 0;
  }
  const leadgenId = leads.data[0].id;
  console.log(`${TAG} formulário "${form.name}" (${form.leads_count} leads), leadgen_id ${leadgenId}`);

  const [org] = await db.execute<{ id: string }>(sql`
    SELECT id FROM organizacoes WHERE slug = ${process.env.META_WEBHOOK_ORG_SLUG || "scott-studio"} LIMIT 1`);
  const orgId = org.id;
  const chave = `meta:leadgen:${leadgenId}`;

  // Estado anterior, para devolver o banco ao que era.
  const [antes] = await db.execute<{ aquisicoes: string; pontos: string; pessoas: string }>(sql`
    SELECT (SELECT count(*) FROM aquisicoes WHERE organizacao_id = ${orgId}::uuid) AS aquisicoes,
           (SELECT count(*) FROM pontos_contato WHERE meta_lead_id = ${leadgenId}) AS pontos,
           (SELECT count(*) FROM pessoas WHERE organizacao_id = ${orgId}::uuid) AS pessoas`);

  console.log(`\n═══ 1. assinatura inválida não escreve ═══`);
  const ruim = await entregar(envelope(leadgenId, cred.pageId, form.id), false);
  ok("assinatura errada recusada", ruim.status === 401, `HTTP ${ruim.status}`);
  const [depoisRuim] = await db.execute<{ n: string }>(sql`
    SELECT count(*) AS n FROM pontos_contato WHERE meta_lead_id = ${leadgenId}`);
  ok("nada gravado com assinatura errada", depoisRuim.n === antes.pontos);

  console.log(`\n═══ 2. envelope sem field_data → retrieval → porta canônica ═══`);
  const r1 = await entregar(envelope(leadgenId, cred.pageId, form.id));
  const res1 = (r1.corpo.resultados as Array<{ ok: boolean; motivo?: string }> | undefined)?.[0];
  ok("webhook respondeu 200", r1.status === 200, `HTTP ${r1.status}`);
  ok("lead entrou pela porta canônica", res1?.ok === true, res1?.motivo ?? "");

  const [ponto] = await db.execute<{
    aquisicao_id: string; ad_id: string | null; campaign_id: string | null; n: string;
  }>(sql`
    SELECT aquisicao_id, ad_id, campaign_id, count(*) OVER () AS n
      FROM pontos_contato WHERE meta_lead_id = ${leadgenId} ORDER BY ocorrido_em DESC LIMIT 1`);
  ok("ponto de contato gravado com o leadgen_id", !!ponto);

  if (ponto) {
    const [p] = await db.execute<{ tem_email: boolean; tem_telefone: boolean; nome: string }>(sql`
      SELECT (p.email IS NOT NULL AND p.email <> '') AS tem_email,
             (p.telefone IS NOT NULL AND p.telefone <> '') AS tem_telefone,
             left(coalesce(p.nome, ''), 3) AS nome
        FROM aquisicoes a JOIN pessoas p ON p.id = a.pessoa_id
       WHERE a.id = ${ponto.aquisicao_id}::uuid`);
    // O envelope não levava nada disso: só pode ter vindo do retrieval.
    ok("pessoa tem identidade vinda da Graph", !!p && (p.tem_email || p.tem_telefone),
      p ? `email=${p.tem_email} telefone=${p.tem_telefone} nome=${p.nome}***` : "sem pessoa");
    ok("atribuição de anúncio preservada", !!ponto.ad_id || !!ponto.campaign_id,
      `ad_id=${ponto.ad_id ?? "-"} campaign=${ponto.campaign_id ?? "-"}`);
  }

  console.log(`\n═══ 3. reentrega do mesmo leadgen_id ═══`);
  const r2 = await entregar(envelope(leadgenId, cred.pageId, form.id));
  const res2 = (r2.corpo.resultados as Array<{ ok: boolean }> | undefined)?.[0];
  ok("reentrega respondeu 200", r2.status === 200 && res2?.ok === true);
  const [dupla] = await db.execute<{ aquisicoes: string; pontos: string }>(sql`
    SELECT (SELECT count(DISTINCT aquisicao_id) FROM pontos_contato WHERE meta_lead_id = ${leadgenId}) AS aquisicoes,
           (SELECT count(*) FROM pontos_contato WHERE meta_lead_id = ${leadgenId}) AS pontos`);
  ok("reentrega não abriu segunda aquisição", Number(dupla.aquisicoes) === 1, `${dupla.aquisicoes} aquisições`);
  ok("reentrega não duplicou ponto de contato",
    Number(dupla.pontos) === Number(antes.pontos) + 1,
    `${dupla.pontos} pontos (antes ${antes.pontos})`);
  const [prov] = await db.execute<{ n: string }>(sql`
    SELECT count(*) AS n FROM backfill_provenance
     WHERE entidade_canonica = 'aquisicao' AND chave_identidade = ${chave}`);
  ok("chave de idempotência do leadgen registrada", Number(prov.n) === 1, `${prov.n} registros`);

  console.log(`\n═══ 4. leadgen_id desconhecido não vira registro ═══`);
  const fantasma = "999999999999999";
  const r3 = await entregar(envelope(fantasma, cred.pageId, form.id));
  const res3 = (r3.corpo.resultados as Array<{ ok: boolean; motivo?: string }> | undefined)?.[0];
  ok("recusado por falta de identificador", res3?.ok === false && res3?.motivo === "sem identificador",
    res3?.motivo ?? "aceitou");
  const [nada] = await db.execute<{ n: string }>(sql`
    SELECT count(*) AS n FROM pontos_contato WHERE meta_lead_id = ${fantasma}`);
  ok("nada inventado para o lead sem dados", Number(nada.n) === 0);

  // ── limpeza: devolve o banco ao estado anterior ────────────────────────────
  const aquisicaoId = ponto?.aquisicao_id ?? null;
  if (aquisicaoId) {
    const [alvo] = await db.execute<{ pessoa_id: string | null }>(sql`
      SELECT pessoa_id FROM aquisicoes WHERE id = ${aquisicaoId}::uuid`);
    await db.execute(sql`DELETE FROM pontos_contato WHERE meta_lead_id = ${leadgenId}`);
    await db.execute(sql`DELETE FROM backfill_provenance WHERE entidade_canonica = 'aquisicao' AND chave_identidade = ${chave}`);
    await db.execute(sql`DELETE FROM event_outbox WHERE idempotency_key = ${chave}`);
    await db.execute(sql`DELETE FROM timeline_events WHERE aquisicao_id = ${aquisicaoId}::uuid AND created_at > now() - interval '1 hour'`);
    await db.execute(sql`DELETE FROM domain_events WHERE idempotency_key = ${chave}`);
    const [contaAgora] = await db.execute<{ n: string }>(sql`
      SELECT count(*) AS n FROM aquisicoes WHERE organizacao_id = ${orgId}::uuid`);
    // Só apaga a aquisição se ela nasceu aqui; se o webhook caiu numa aquisição
    // que já existia, apagá-la levaria junto histórico que não é meu.
    if (Number(contaAgora.n) > Number(antes.aquisicoes)) {
      await db.execute(sql`DELETE FROM aquisicoes WHERE id = ${aquisicaoId}::uuid`);
      if (alvo?.pessoa_id) {
        const [sobrou] = await db.execute<{ n: string }>(sql`
          SELECT count(*) AS n FROM pessoas WHERE organizacao_id = ${orgId}::uuid`);
        if (Number(sobrou.n) > Number(antes.pessoas)) {
          await db.execute(sql`DELETE FROM pessoa_empresa WHERE pessoa_id = ${alvo.pessoa_id}::uuid`);
          await db.execute(sql`DELETE FROM pessoas WHERE id = ${alvo.pessoa_id}::uuid`);
        }
      }
    }
  }
  const [final] = await db.execute<{ aquisicoes: string; pontos: string; pessoas: string }>(sql`
    SELECT (SELECT count(*) FROM aquisicoes WHERE organizacao_id = ${orgId}::uuid) AS aquisicoes,
           (SELECT count(*) FROM pontos_contato WHERE meta_lead_id = ${leadgenId}) AS pontos,
           (SELECT count(*) FROM pessoas WHERE organizacao_id = ${orgId}::uuid) AS pessoas`);
  ok("banco devolvido ao estado anterior",
    final.aquisicoes === antes.aquisicoes && final.pontos === antes.pontos && final.pessoas === antes.pessoas,
    `aquisicoes ${antes.aquisicoes}→${final.aquisicoes}, pontos ${antes.pontos}→${final.pontos}, pessoas ${antes.pessoas}→${final.pessoas}`);

  console.log(`\n${TAG} ${passou} ok, ${falhou} falhas`);
  return falhou;
}

main()
  .then(async (f) => { await fecharFilas().catch(() => {}); process.exit(f ? 1 : 0); })
  .catch(async (e) => { console.error(`${TAG} erro:`, e); await fecharFilas().catch(() => {}); process.exit(1); });
