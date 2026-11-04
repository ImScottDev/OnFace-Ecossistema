import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizacoes, usuarios } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { horariosLivres, agendarReuniao } from "@/lib/calendario/agendar-agente";
import { acharLeadPorContato } from "@/lib/vendas/ponte-canonica";

/**
 * Agendamento público das LPs de campanha (lp.callface.ai).
 *
 * GET  /api/webhooks/agendamento-lp              → horários livres da closer da LP
 * POST /api/webhooks/agendamento-lp              → marca a reunião
 *   body: { inicioISO, email?, telefone?, leadId?, nome?, empresa?, resumo?, website? (honeypot) }
 *
 * Diferença proposital para o `site-lead`: aqui a oportunidade É aberta.
 * Quem só preenche o formulário entra em Pré-vendas pelo `site-lead`; quem
 * ainda marca a reunião vira oportunidade, porque a reunião com a closer é o
 * ato comercial que a SpecDrive exige para abrir o negócio. Quem faz isso é
 * `agendarReuniao`, que chama `converterLeadEmOportunidade`, cria a reunião e
 * sincroniza com a agenda quando houver calendário conectado.
 *
 * A agenda externa NÃO é exigida (`exigirOutlook: false`): a grade de
 * `closer_disponibilidade` no ONFACE é a fonte da verdade, menos as reuniões e
 * bloqueios que já existem no CRM. Quando a closer conectar o calendário, o
 * ocupado real entra junto, sem mexer aqui.
 */

const ORG_SLUG = "scott-studio"; // slug interno da org Callface
const ALLOWED_ORIGINS = [
  "https://lp.callface.ai",
  "https://site.callface.io",
];
/** E-mail da closer que atende as LPs. `ONFACE_CLOSER_LP_EMAIL` sobrepõe sem deploy. */
const CLOSER_EMAIL = process.env.ONFACE_CLOSER_LP_EMAIL ?? "mayra.schincariol@callface.ai";
const DURACAO_MIN = 30;

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Org da Callface e a closer da LP, ou o erro já pronto para devolver. */
async function contexto(): Promise<
  { ok: true; organizacaoId: string; closerId: string } | { ok: false; status: number; erro: string }
> {
  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).where(eq(organizacoes.slug, ORG_SLUG)).limit(1);
  if (!org) return { ok: false, status: 500, erro: "org not found" };

  const [closer] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(
      eq(usuarios.organizacaoId, org.id),
      eq(usuarios.email, CLOSER_EMAIL),
      eq(usuarios.ativo, true),
      ne(usuarios.tipo, "agente"),
    ))
    .limit(1);
  if (!closer) return { ok: false, status: 500, erro: "closer da LP não encontrada" };

  return { ok: true, organizacaoId: org.id, closerId: closer.id };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: NextRequest) {
  const cors = corsHeaders(req.headers.get("origin"));
  const ctx = await contexto();
  if (!ctx.ok) return NextResponse.json({ ok: false, error: ctx.erro }, { status: ctx.status, headers: cors });

  const d = await horariosLivres({
    organizacaoId: ctx.organizacaoId,
    closerId: ctx.closerId,
    duracaoMin: DURACAO_MIN,
    dias: 10,
    maxSlots: 12,
    porDia: 4,
    exigirOutlook: false,
  });

  return NextResponse.json(
    { ok: true, duracaoMin: DURACAO_MIN, fuso: "America/Sao_Paulo", slots: d.slots },
    { status: 200, headers: { ...cors, "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get("origin"));

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400, headers: cors });
  }

  // Honeypot: mesmo campo oculto do formulário. Bot recebe sucesso e nada acontece.
  if (texto(body.website)) return NextResponse.json({ ok: true, status: "skipped" }, { status: 200, headers: cors });

  const inicioISO = texto(body.inicioISO);
  if (!inicioISO) return NextResponse.json({ ok: false, error: "inicioISO é obrigatório" }, { status: 422, headers: cors });

  const ctx = await contexto();
  if (!ctx.ok) return NextResponse.json({ ok: false, error: ctx.erro }, { status: ctx.status, headers: cors });

  /* O lead já existe: o formulário da LP passou pelo `site-lead` antes desta
     tela. O id vem de lá; e-mail e telefone são o reencontro quando a página
     perdeu o id (outra aba, sessão limpa). Sem lead, não há o que converter. */
  let leadId = texto(body.leadId);
  if (!leadId) {
    const achado = await acharLeadPorContato(ctx.organizacaoId, texto(body.email), texto(body.telefone));
    leadId = achado?.id ?? null;
  }
  if (!leadId) return NextResponse.json({ ok: false, error: "lead não encontrado" }, { status: 404, headers: cors });

  const nome = texto(body.nome);
  const empresa = texto(body.empresa);
  const resumo = texto(body.resumo);
  const r = await agendarReuniao({
    organizacaoId: ctx.organizacaoId,
    leadId,
    closerId: ctx.closerId,
    inicioISO,
    duracaoMin: DURACAO_MIN,
    titulo: `Reunião Black Friday${empresa ? ` · ${empresa}` : nome ? ` · ${nome}` : ""}`,
    resumoParaCloser: [
      "Agendada pela pessoa na página de obrigado da LP da Black Friday.",
      empresa && `Empresa: ${empresa}`,
      resumo,
    ].filter(Boolean).join("\n"),
    exigirOutlook: false,
    usuarioId: null,
  });

  if (!r.ok) {
    // Horário tomado entre a consulta e o clique é o caso comum: a página recarrega a lista.
    const status = r.codigo === "horario_indisponivel" ? 409 : r.codigo === "lead_invalido" ? 404 : 422;
    return NextResponse.json({ ok: false, error: r.erro, codigo: r.codigo }, { status, headers: cors });
  }

  return NextResponse.json(
    { ok: true, reuniaoId: r.reuniaoId, inicioISO: r.inicioISO, closer: r.closerNome, jaExistia: r.jaExistia },
    { status: 201, headers: cors },
  );
}
