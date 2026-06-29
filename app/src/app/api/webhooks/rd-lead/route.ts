import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, organizacoes, statusChanges, usuarios } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  parseRdLead,
  isCallfaceLead,
  type ParsedRdLead,
} from "@/lib/integrations/rd-station";

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
const SECRET = process.env.RD_WEBHOOK_SECRET || "callface-rd-2026";

interface RdPayloadLead {
  email?: string;
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  // Auth simples por token (query ?token= ou header x-webhook-secret)
  const token =
    req.nextUrl.searchParams.get("token") ||
    req.headers.get("x-webhook-secret");
  if (SECRET && token !== SECRET) {
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

  // Porta de entrada da pré-vendas: lead novo nasce atribuído à Jenifer (SDR).
  const [sdrPadrao] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.organizacaoId, org.id), eq(usuarios.email, "jenifer.matos@callface.ai")))
    .limit(1);

  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;

  const results: Array<{ status: string; leadId?: string; email?: string }> = [];

  for (const rd of rdLeads) {
    try {
      if (!isCallfaceLead(rd)) {
        results.push({ status: "skipped:not-callface", email: rd.email });
        continue;
      }

      const p: ParsedRdLead = parseRdLead(rd);

      // Dedup por email (depois telefone) dentro da org
      let existing:
        | { id: string; tipo: string }
        | undefined;
      if (p.email) {
        [existing] = await db
          .select({ id: leads.id, tipo: leads.tipo })
          .from(leads)
          .where(
            and(eq(leads.organizacaoId, org.id), eq(leads.email, p.email))
          )
          .limit(1);
      }
      if (!existing && p.telefone) {
        [existing] = await db
          .select({ id: leads.id, tipo: leads.tipo })
          .from(leads)
          .where(
            and(
              eq(leads.organizacaoId, org.id),
              eq(leads.telefone, p.telefone)
            )
          )
          .limit(1);
      }

      if (existing) {
        // Já é cliente: preserva, só registra que voltou a converter
        if (existing.tipo === "cliente") {
          results.push({ status: "skipped:already-client", leadId: existing.id });
          continue;
        }
        // Atualiza dados de tracking sem rebaixar quem já está em andamento
        await db
          .update(leads)
          .set({
            empresa: p.empresa,
            cargo: p.cargo,
            origem: p.origem,
            utmSource: p.utmSource,
            utmMedium: p.utmMedium,
            utmCampaign: p.utmCampaign,
            utmTerm: p.utmTerm,
            utmContent: p.utmContent,
            landingPage: p.landingPage,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, existing.id));
        results.push({ status: "updated", leadId: existing.id, email: p.email });
        continue;
      }

      // Cria lead novo direto no board de pré-vendas (sem negócio)
      const [newLead] = await db
        .insert(leads)
        .values({
          organizacaoId: org.id,
          nome: p.nome,
          sobrenome: p.sobrenome,
          email: p.email,
          telefone: p.telefone,
          empresa: p.empresa,
          cargo: p.cargo,
          origem: p.origem,
          utmSource: p.utmSource,
          utmMedium: p.utmMedium,
          utmCampaign: p.utmCampaign,
          utmTerm: p.utmTerm,
          utmContent: p.utmContent,
          landingPage: p.landingPage,
          ipAddress,
          userAgent,
          tipo: "lead",
          status: "novo",
          sdrStatus: "pending",
          responsavelId: sdrPadrao?.id ?? null,
        })
        .returning({ id: leads.id });

      // Timeline inicial (sem negócio vinculado)
      await db.insert(statusChanges).values({
        leadId: newLead.id,
        negocioId: null,
        deStatus: null,
        paraStatus: "novo",
      });

      results.push({ status: "created", leadId: newLead.id, email: p.email });
    } catch (err) {
      console.error("rd-lead webhook error for lead:", err);
      results.push({ status: "error:" + String(err), email: rd.email });
    }
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
