import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isCallfaceLead } from "@/lib/integrations/rd-station";
import { abrirEntrega, chaveDoRd, fecharEntrega } from "@/lib/captacao/entregas";
import { processarLeadRd } from "@/lib/captacao/processar-rd";

/**
 * Webhook de ingestão de leads do RD Station.
 *
 * POST /api/webhooks/rd-lead?token=<secret>
 *
 * Recebe o payload do RD (`body.leads[]`), filtra os que são da Callface,
 * parseia (nome, contato, origem, UTMs) e cria o lead direto no board de
 * pré-vendas (tipo='lead', status='novo', sdrStatus='pending'). NÃO cria
 * negócio: a oportunidade só nasce quando a SDR qualifica e converte (decisão
 * do fluxo Callface, ver callface/crm-callface-status.md).
 *
 * Dedup por email (e telefone) dentro da org. Quem já é cliente é preservado.
 */

const ORG_SLUG = "scott-studio"; // slug interno da org Callface
// FAIL-CLOSED (14/09): o default era um secret literal escrito neste
// arquivo — público pra quem tem o repositório, ou seja, sem proteção
// nenhuma quando a variável não estava setada. Mesmo padrão do webhook
// de Stripe e do de Callface: sem segredo configurado, não processa.
const SECRET = process.env.RD_WEBHOOK_SECRET || "";

interface RdPayloadLead {
  email?: string;
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  // Auth simples por token (query ?token= ou header x-webhook-secret)
  const token =
    req.nextUrl.searchParams.get("token") ||
    req.headers.get("x-webhook-secret");
  if (!SECRET) {
    console.error("[RdLeadWebhook] RD_WEBHOOK_SECRET não configurado — recusando evento (fail-closed)");
    return NextResponse.json({ ok: false, error: "webhook secret not configured" }, { status: 503 });
  }
  if (token !== SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  // Aceita body.leads[] (formato RD), body.lead, array cru ou objeto único
  const b = body as { leads?: RdPayloadLead[]; lead?: RdPayloadLead };
  const rdLeads: RdPayloadLead[] = Array.isArray(b?.leads)
    ? b.leads
    : b?.lead
    ? [b.lead]
    : Array.isArray(body)
    ? (body as RdPayloadLead[])
    : body
    ? [body as RdPayloadLead]
    : [];

  if (rdLeads.length === 0) {
    return NextResponse.json({ ok: true, message: "no leads in payload" });
  }

  // Resolve org Callface
  const [org] = await db
    .select({ id: organizacoes.id })
    .from(organizacoes)
    .where(eq(organizacoes.slug, ORG_SLUG))
    .limit(1);
  if (!org) {
    return NextResponse.json(
      { ok: false, error: "org not found" },
      { status: 500 }
    );
  }

  // O dono vem da regra de distribuição (Ajustes > Leads) ou da política da
  // organização; não existe nome de pessoa gravado no webhook. É decidido POR
  // LEAD e só para o lead que nasce (lib/captacao/distribuir.ts): antes era
  // resolvido uma vez aqui e o lote inteiro ia para a mesma pessoa, com o
  // lead repetido gastando vez de rodízio.
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;

  const results: Array<{ status: string; leadId?: string; email?: string }> = [];

  for (const rd of rdLeads) {
    let entregaId: string | null = null;
    try {
      if (!isCallfaceLead(rd)) {
        results.push({ status: "skipped:not-callface", email: rd.email });
        continue;
      }

      // Caixa de entrada (0131), antes de tocar no staging da Meta: reentrega
      // do mesmo fato não consome o staging, não cria lead e não gasta rodízio.
      const entrega = await abrirEntrega({ organizacaoId: org.id, canal: "rd", chave: chaveDoRd(rd), payload: rd });
      entregaId = entrega.id;
      if (entrega.duplicada) {
        results.push({ status: "skipped:duplicate", leadId: entrega.leadId ?? undefined, email: rd.email });
        continue;
      }
    } catch (err) {
      console.error("rd-lead webhook error for lead:", err);
      await fecharEntrega(entregaId, { status: "falhou", erro: err });
      results.push({ status: "error:" + String(err), email: rd.email });
      continue;
    }

    // O processamento do lead é o mesmo do reprocessamento manual (lib/captacao/processar-rd.ts).
    results.push(await processarLeadRd({ organizacaoId: org.id, rd, entregaId, ipAddress, userAgent }));
  }

  const created = results.filter((r) => r.status === "created").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const skipped = results.filter((r) => r.status.startsWith("skipped")).length;

  return NextResponse.json({
    ok: true,
    received: rdLeads.length,
    created,
    updated,
    skipped,
    results,
  });
}

// Healthcheck simples (GET) pra validar que o endpoint está no ar
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "rd-lead webhook", method: "POST" });
}
