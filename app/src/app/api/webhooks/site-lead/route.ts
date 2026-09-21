import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, organizacoes } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { syncPessoaFromLead } from "@/lib/crm/sync-domain-model";
import { criarLead, garantirAtividadePrimeiroContato, resolverResponsavelInbound } from "@/lib/vendas/pre-vendas";
import { ATOR_SISTEMA } from "@/lib/vendas/dominio";
import { dominioDoEmail } from "@/lib/vendas/identidade";
import { telefoneUsavel } from "@/lib/whatsapp/phone-utils";
import { garantirEntradaCanonica } from "@/lib/vendas/ponte-canonica";
import { resolverEmpresaId, dominioCorporativo } from "@/lib/crm/resolver-empresa";

/**
 * Webhook do FORMULÁRIO do site institucional (site.callface.io).
 *
 * POST /api/webhooks/site-lead
 *   body: { nome, email, telefone, cargo, empresa, utm*?, landingPage?, website? (honeypot) }
 *
 * Entra pelo motor de Vendas (`lib/vendas/pre-vendas.criarLead`), que executa a
 * entrada canônica da SpecDrive: resolve ou cria a Empresa, resolve ou cria a
 * Pessoa, associa as duas, grava o ponto de contato com a origem e só então
 * cria o Lead em NOVO.
 *
 * **Não cria oportunidade**, e isso é regra, não omissão: Bloco 01 §3 e §29 da
 * SpecDrive proíbem formulário inbound abrir oportunidade automaticamente.
 *
 * Dedup por e-mail/telefone dentro da org continua valendo para não criar dois
 * leads da mesma captura.
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

  // A política de Pré-vendas escolhe quem recebe a fila. Sem configuração,
  // o lead continua na fila sem dono, mas jamais sem atividade de contato.
  const responsavelInboundId = await resolverResponsavelInbound(org.id);
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;
  const landingPage = clean(body.landingPage) || req.headers.get("referer") || null;

  // Dedup por email, depois telefone: a mesma captura não pode virar dois leads.
  let existing: { id: string; tipo: string; responsavelId: string | null; empresaId: string | null } | undefined;
  if (email) {
    [existing] = await db
      .select({ id: leads.id, tipo: leads.tipo, responsavelId: leads.responsavelId, empresaId: leads.empresaId })
      .from(leads)
      .where(and(eq(leads.organizacaoId, org.id), eq(leads.email, email)))
      .limit(1);
  }
  if (!existing && telefone) {
    [existing] = await db
      .select({ id: leads.id, tipo: leads.tipo, responsavelId: leads.responsavelId, empresaId: leads.empresaId })
      .from(leads)
      .where(and(eq(leads.organizacaoId, org.id), eq(leads.telefone, telefone)))
      .limit(1);
  }

  // Empresa como entidade, não só texto (senão o lead entra sem vínculo no drawer).
  const empresaIdResolvida = await resolverEmpresaId({
    organizacaoId: org.id,
    nome: empresa,
    website: dominioCorporativo(email),
  });

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
        // Não sobrescreve vínculo já existente.
        ...(empresaIdResolvida
          ? { empresaId: sql`COALESCE(${leads.empresaId}, ${empresaIdResolvida}::uuid)` }
          : {}),
        cargo: cargo ?? undefined,
        telefone: telefone ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, existing.id));
    await syncPessoaFromLead(existing.id); // F1/dual-write, best-effort
    await garantirAtividadePrimeiroContato({
      organizacaoId: org.id,
      leadId: existing.id,
      empresaId: existing.empresaId,
      responsavelId: existing.responsavelId ?? responsavelInboundId,
    });
    return NextResponse.json(
      { ok: true, status: "updated", leadId: existing.id },
      { status: 200, headers: cors }
    );
  }

  // O formulário publicado ainda não pergunta a empresa. Quando ela não vem, o
  // domínio corporativo do e-mail é o único identificador confiável disponível;
  // e-mail pessoal não identifica empresa nenhuma, então o lead entra sem ela e
  // a tela pede a associação antes de qualquer passo que exija Empresa.
  // Registrado como dependência em docs/reconstruction/MODULO-01-VENDAS.md.
  const dominio = dominioDoEmail(email);
  const nomeEmpresa = empresa ?? (dominio ? dominio.split(".")[0] : null);

  const criado = await criarLead({
    organizacaoId: org.id,
    empresa: nomeEmpresa ? { nome: nomeEmpresa, dominio, email } : null,
    pessoa: { nome: primeiro, sobrenome, email, telefone, cargo },
    touchpoint: {
      tipoOrigem: "organica",
      source: clean(body.utmSource) ?? "site",
      medium: clean(body.utmMedium),
      campaign: clean(body.utmCampaign),
      term: clean(body.utmTerm),
      content: clean(body.utmContent),
      landingPage,
      raw: { ipAddress, userAgent },
    },
    origem: "Site",
    // A política é resolvida dentro do motor, que também cria a atividade de
    // primeiro contato ligada ao responsável escolhido.
    responsavelId: null,
  }, ATOR_SISTEMA);

  // CUTOVER (fase 16): o mesmo fato no modelo canônico. `criarLead` acima já é
  // o motor canônico do CRM atual; esta chamada acrescenta aquisição, touchpoint
  // e evento de domínio, que ele não produz. Sai na fase 25.
  await garantirEntradaCanonica({
    organizacaoId: org.id,
    tipo: "INBOUND",
    origem: "Site",
    provider: "site",
    pessoa: { nome: primeiro, sobrenome, email, telefone, cargo },
    empresa: nomeEmpresa ? { nome: nomeEmpresa, dominio } : null,
    atribuicao: {
      utmSource: clean(body.utmSource), utmMedium: clean(body.utmMedium),
      utmCampaign: clean(body.utmCampaign), utmTerm: clean(body.utmTerm),
      utmContent: clean(body.utmContent), landingPage,
    },
    idempotencyKey: email ? `site:${org.id}:${email}` : null,
  }, criado.leadId);

  return NextResponse.json(
    { ok: true, status: "created", leadId: criado.leadId, empresaId: criado.empresaId },
    { status: 201, headers: cors }
  );
}
