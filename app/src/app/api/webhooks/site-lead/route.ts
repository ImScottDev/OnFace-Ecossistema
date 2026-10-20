import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolverResponsavelInbound } from "@/lib/vendas/pre-vendas";
import { abrirEntrega, chavePorMinuto } from "@/lib/captacao/entregas";
import { clean, lerFormularioSite, processarFormularioSite } from "@/lib/captacao/processar-site";

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

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get("origin"));

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400, headers: cors });
  }

  // Honeypot, validação e nome/sobrenome (lib/captacao/processar-site.ts).
  const lido = lerFormularioSite(body);
  if (!lido.ok) return NextResponse.json(lido.resposta.corpo, { status: lido.resposta.status, headers: cors });
  const { campos } = lido;

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

  /* A MESMA dedup das outras portas de entrada (`meta-leads`, `rd-lead`).
   *
   * Aqui a busca era por igualdade exata (`email = ?`, `telefone = ?`), e era
   * por isso que a mesma pessoa entrava duas vezes: a Meta grava
   * "5511963194410" e o formulário do site grava "(11) 96319-4410" — mesmo
   * telefone, comparação diferente, dedup não casava. E-mail com maiúscula ou
   * espaço sobrando dava no mesmo. `acharLeadPorContato` compara pela chave
   * normalizada (E.164 sem o "+", e-mail em minúscula sem espaço) e olha
   * também o WhatsApp.
   *
   * `travarEntrada` fecha a corrida: duas submissões ao mesmo tempo (clique
   * duplo, retry do integrador) esperam uma pela outra em vez de cada uma
   * concluir que o lead não existe. */
  // Caixa de entrada (0131): a submissão fica guardada como chegou. Clique
  // duplo no mesmo minuto é a mesma entrega e não processa duas vezes.
  const entrega = await abrirEntrega({ organizacaoId: org.id, canal: "site", chave: chavePorMinuto(body), payload: body });
  if (entrega.duplicada) {
    return NextResponse.json(
      { ok: true, status: "duplicate", leadId: entrega.leadId },
      { status: 200, headers: cors }
    );
  }

  // O processamento é o mesmo do reprocessamento manual (lib/captacao/processar-site.ts).
  const r = await processarFormularioSite({
    organizacaoId: org.id, body, campos, entregaId: entrega.id, responsavelInboundId, ipAddress, userAgent, landingPage,
  });
  return NextResponse.json(r.corpo, { status: r.status, headers: cors });
}
