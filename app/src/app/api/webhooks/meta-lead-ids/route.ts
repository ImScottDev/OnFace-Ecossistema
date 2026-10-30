import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { telefoneUsavel } from "@/lib/whatsapp/phone-utils";
import { leads, organizacoes, metaLeadStaging } from "@/lib/db/schema";
import { and, eq, or, sql } from "drizzle-orm";

/**
 * Webhook de IDs reais da Meta (ad_id/adset_id/campaign_id) por lead de Lead Ads.
 *
 * POST /api/webhooks/meta-lead-ids?token=<secret>
 *   body: { fbLeadId?, adId?, adsetId?, campaignId?, adName?, adsetName?, campaignName?, email?, personalPhone? }
 *
 * Chamado pelo MESMO workflow n8n que já manda a conversão pro RD Station
 * (Callface | Conversão no Meta Lead Ads Cria Lead na RD Station), logo depois
 * de buscar os dados da campanha na Graph API — antes disso, esses IDs eram
 * jogados fora (só o NOME do anúncio/conjunto ia pro RD, via traffic_value).
 * Sem isso, criativo/conjunto com o MESMO nome em pais diferentes ficam
 * ambíguos no relatório (achado real 22/07, ver callface/relatorio-midia-paga-proposta.md §10.2).
 *
 * RACE CONDITION: esse webhook chega ANTES do lead em si existir no CRM (a
 * criação do lead depende do fluxo assíncrono RD Station → automação de
 * marketing → /api/webhooks/rd-lead, que roda em paralelo, sem ordem garantida).
 * Por isso: tenta casar com um lead JÁ existente agora; se não achar, grava em
 * `meta_lead_staging` pra o rd-lead pegar depois na hora de criar/atualizar o lead.
 */

const ORG_SLUG = "scott-studio";
// FAIL-CLOSED (14/09): o default era um secret literal escrito neste
// arquivo — público pra quem tem o repositório, ou seja, sem proteção
// nenhuma quando a variável não estava setada. Mesmo padrão do webhook
// de Stripe e do de Callface: sem segredo configurado, não processa.
const SECRET = process.env.META_LEADIDS_WEBHOOK_SECRET || "";

interface MetaLeadIdsPayload {
  fbLeadId?: string;
  adId?: string;
  adsetId?: string;
  campaignId?: string;
  adName?: string;
  adsetName?: string;
  campaignName?: string;
  email?: string;
  personalPhone?: string;
}

export async function POST(req: NextRequest) {
  const token =
    req.nextUrl.searchParams.get("token") ||
    req.headers.get("x-webhook-secret");
  if (!SECRET) {
    console.error("[MetaLeadIdsWebhook] META_LEADIDS_WEBHOOK_SECRET não configurado — recusando evento (fail-closed)");
    return NextResponse.json({ ok: false, error: "webhook secret not configured" }, { status: 503 });
  }
  if (token !== SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: MetaLeadIdsPayload;
  try {
    body = (await req.json()) as MetaLeadIdsPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() || undefined;
  const telefone = telefoneUsavel(body.personalPhone) || undefined;
  if (!email && !telefone) {
    return NextResponse.json({ ok: false, error: "sem email nem telefone" }, { status: 400 });
  }
  if (!body.adId && !body.adsetId && !body.campaignId) {
    return NextResponse.json({ ok: false, error: "sem nenhum id da meta" }, { status: 400 });
  }

  const [org] = await db
    .select({ id: organizacoes.id })
    .from(organizacoes)
    .where(eq(organizacoes.slug, ORG_SLUG))
    .limit(1);
  if (!org) {
    return NextResponse.json({ ok: false, error: "org not found" }, { status: 500 });
  }

  // Tenta casar com lead JÁ existente (email primeiro, telefone depois).
  let existing: { id: string } | undefined;
  if (email) {
    [existing] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.organizacaoId, org.id), eq(leads.email, email)))
      .limit(1);
  }
  if (!existing && telefone) {
    [existing] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.organizacaoId, org.id), eq(leads.telefone, telefone)))
      .limit(1);
  }

  if (existing) {
    // Não sobrescreve (mesmo padrão first-touch dos outros campos de tracking).
    // NÃO toca updated_at: isso é enriquecimento passivo em segundo plano, não
    // atividade real no lead — bumpar updated_at aqui faz o board de pré-vendas
    // mostrar "há Xmin" em leads parados há semanas (bug real, achado 22/07 pelo
    // Kauã: um backfill de 216 leads fez o board inteiro mostrar "17min").
    await db
      .update(leads)
      .set({
        metaAdId: sql`COALESCE(NULLIF(${leads.metaAdId}, ''), ${body.adId ?? null})`,
        metaAdsetId: sql`COALESCE(NULLIF(${leads.metaAdsetId}, ''), ${body.adsetId ?? null})`,
        metaCampaignId: sql`COALESCE(NULLIF(${leads.metaCampaignId}, ''), ${body.campaignId ?? null})`,
        // Telefone só PREENCHE, nunca sobrescreve: quando a ponte Meta→RD erra o
        // campo do formulário, o lead nasce sem telefone e a SDR fica sem pra quem
        // ligar. A Meta manda o número certo aqui. Mesmo padrão first-touch acima,
        // e igualmente sem tocar updated_at.
        telefone: sql`COALESCE(NULLIF(${leads.telefone}, ''), ${telefone ?? null})`,
      })
      .where(eq(leads.id, existing.id));
    return NextResponse.json({ ok: true, status: "matched-existing-lead", leadId: existing.id });
  }

  // Lead ainda não existe no CRM (RD ainda não processou) — fica no staging pro
  // rd-lead casar na hora de criar/atualizar.
  // IDEMPOTENTE por `fbLeadId`. A Meta reentrega o webhook quando não recebe
  // 200 a tempo, e sem isto cada reentrega criava uma linha nova: a migration
  // 0090 removeu 18 duplicatas reais ao criar o índice único.
  //
  // `onConflictDoNothing` e não `DoUpdate`: o payload da reentrega é o MESMO
  // evento, então não há o que atualizar — e sem o `onConflict`, o índice novo
  // faria o webhook responder erro, o que só provocaria mais reentrega.
  await db.insert(metaLeadStaging).values({
    fbLeadId: body.fbLeadId,
    email,
    telefone,
    adId: body.adId,
    adsetId: body.adsetId,
    campaignId: body.campaignId,
    adName: body.adName,
    adsetName: body.adsetName,
    campaignName: body.campaignName,
  }).onConflictDoNothing();

  return NextResponse.json({ ok: true, status: "staged" });
}

// Healthcheck simples (GET) pra validar que o endpoint está no ar
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "meta-lead-ids webhook", method: "POST" });
}
