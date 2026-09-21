import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { telefoneUsavel } from "@/lib/whatsapp/phone-utils";
import { leads, organizacoes, statusChanges } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Webhook do FORMULÁRIO do site institucional (site.callface.io).
 *
 * POST /api/webhooks/site-lead
 *   body: { nome, email, telefone, cargo, empresa, utm*?, landingPage?, website? (honeypot) }
 *
 * Cria o lead direto no board de pré-vendas (tipo='lead', status='novo',
 * sdrStatus='pending'), atribuído à Jenifer (SDR, porta de entrada). NÃO cria
 * negócio — a oportunidade só nasce quando a SDR qualifica (mesma regra do
 * rd-lead). origem='Site'. Dedup por email/telefone dentro da org.
 *
 * É público (chamado do browser), então: CORS restrito ao site, honeypot
 * anti-bot e validação de campos. Sem segredo (estaria exposto no JS de qualquer
 * forma); a proteção real é o honeypot + dedup + validação.
 */

const ORG_SLUG = "scott-studio"; // slug interno da org Callface
const ALLOWED_ORIGINS = [
  "https://site.callface.io",
  "https://callface.io",
  "https://www.callface.io",
];

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t.slice(0, 300) : null;
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get("origin"));

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400, headers: cors });
  }

  // Honeypot: bots preenchem o campo oculto "website" → finge sucesso e ignora
  if (clean(body.website)) {
    return NextResponse.json({ ok: true, skipped: "honeypot" }, { status: 200, headers: cors });
  }

  const nome = clean(body.nome);
  const email = clean(body.email)?.toLowerCase() ?? null;
  // Mesmo lixo do RD pode chegar por aqui (bug de template no form manda "undefined").
  const telefone = telefoneUsavel(clean(body.telefone));
  const cargo = clean(body.cargo);
  const empresa = clean(body.empresa);

  if (!nome) {
    return NextResponse.json(
      { ok: false, error: "nome é obrigatório" },
      { status: 422, headers: cors }
    );
  }
  if (!email && !telefone) {
    return NextResponse.json(
      { ok: false, error: "informe email ou telefone" },
      { status: 422, headers: cors }
    );
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "email inválido" },
      { status: 422, headers: cors }
    );
  }

  // Bloqueia o feed de "descoberta"/scraping: essas fontes mandam o e-mail como
  // se fosse o nome (nome = "fulano@dominio.com"), sem nome real de pessoa. O
  // formulário legítimo do site sempre tem nome. Finge sucesso (não retenta) e ignora.
  if (/^[^\s]+@[^\s]+\.[^\s]+$/.test(nome) || (email && nome.trim().toLowerCase() === email)) {
    return NextResponse.json({ ok: true, skipped: "sem-nome-real" }, { status: 200, headers: cors });
  }

  // separa nome / sobrenome
  const partes = nome.split(/\s+/);
  const primeiro = partes.shift() || nome;
  const sobrenome = partes.length ? partes.join(" ") : null;

  // Resolve org Callface
  const [org] = await db
    .select({ id: organizacoes.id })
    .from(organizacoes)
    .where(eq(organizacoes.slug, ORG_SLUG))
    .limit(1);
  if (!org) {
    return NextResponse.json({ ok: false, error: "org not found" }, { status: 500, headers: cors });
  }

  // Lead inbound novo nasce SEM DONO (Scott, jul/26). As meninas pegam no "Novo"
  // e movem pra "Em Contato"; a Jenifer só assume quando o lead entra em "Follow up".
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;
  const landingPage = clean(body.landingPage) || req.headers.get("referer") || null;

  // Dedup por email, depois telefone
  let existing: { id: string; tipo: string } | undefined;
  if (email) {
    [existing] = await db
      .select({ id: leads.id, tipo: leads.tipo })
      .from(leads)
      .where(and(eq(leads.organizacaoId, org.id), eq(leads.email, email)))
      .limit(1);
  }
  if (!existing && telefone) {
    [existing] = await db
      .select({ id: leads.id, tipo: leads.tipo })
      .from(leads)
      .where(and(eq(leads.organizacaoId, org.id), eq(leads.telefone, telefone)))
      .limit(1);
  }

  if (existing) {
    if (existing.tipo === "cliente") {
      return NextResponse.json(
        { ok: true, status: "already-client", leadId: existing.id },
        { status: 200, headers: cors }
      );
    }
    await db
      .update(leads)
      .set({
        empresa: empresa ?? undefined,
        cargo: cargo ?? undefined,
        telefone: telefone ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, existing.id));
    return NextResponse.json(
      { ok: true, status: "updated", leadId: existing.id },
      { status: 200, headers: cors }
    );
  }

  const [newLead] = await db
    .insert(leads)
    .values({
      organizacaoId: org.id,
      nome: primeiro,
      sobrenome,
      email,
      telefone,
      empresa,
      cargo,
      origem: "Site",
      utmSource: clean(body.utmSource),
      utmMedium: clean(body.utmMedium),
      utmCampaign: clean(body.utmCampaign),
      utmTerm: clean(body.utmTerm),
      utmContent: clean(body.utmContent),
      landingPage,
      ipAddress,
      userAgent,
      tipo: "lead",
      status: "novo",
      sdrStatus: "pending",
      responsavelId: null,
    })
    .returning({ id: leads.id });

  await db.insert(statusChanges).values({
    leadId: newLead.id,
    negocioId: null,
    deStatus: null,
    paraStatus: "novo",
    motivo: "Lead capturado pelo formulário do site",
  });

  return NextResponse.json(
    { ok: true, status: "created", leadId: newLead.id },
    { status: 201, headers: cors }
  );
}

// Healthcheck
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "site-lead webhook", method: "POST" });
}
