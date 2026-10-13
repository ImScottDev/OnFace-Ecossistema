import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getTenantContext, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/tenant";
import { temPermissao } from "@/lib/auth/permissoes";
import { reprocessarSelecionados, selecionarEventos } from "@/lib/integrations/stripe-webhook-inbox-db";
import { STATUS_INBOX } from "@/lib/integrations/stripe-webhook-status";

export const dynamic = "force-dynamic";

async function autorizar() {
  const ctx = await getTenantContext();
  if (!ctx) return { erro: unauthorizedResponse() };
  const ok = await temPermissao({ usuarioId: ctx.userId, organizacaoId: ctx.organizacaoId, role: ctx.userRole, tipo: "HUMAN" }, "finance.manage");
  return ok ? { ctx } : { erro: forbiddenResponse() };
}

/** GET — quanto há por status e tipo, e as últimas falhas. Leitura. */
export async function GET() {
  const a = await autorizar();
  if (a.erro) return a.erro;
  const org = a.ctx.organizacaoId;
  const resumo = await db.execute(sql`
    SELECT lower(status) AS status, event_type AS tipo, count(*)::int AS total, min(received_at) AS mais_antigo
      FROM stripe_webhook_events WHERE organizacao_id = ${org}::uuid GROUP BY 1, 2 ORDER BY 1, 2`);
  const falhas = await selecionarEventos({ organizacaoId: org, status: ["failed", "pending", "unresolved"], limite: 50 });
  return NextResponse.json({
    resumo,
    pendentes: falhas.map(({ payload: _p, ...r }) => r),
  });
}

/**
 * POST — reprocessa em lote. Corpo: { status?: string[], tipos?: string[], eventId?: string, limite?: number, modo?: "fila"|"inline" }.
 * Padrão: status failed+pending, modo "fila" (o worker processa com retry). Reprocessar é idempotente.
 */
export async function POST(request: NextRequest) {
  const a = await autorizar();
  if (a.erro) return a.erro;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const status = Array.isArray(body.status) ? body.status.map(String).map((s) => s.toLowerCase()) : ["failed", "pending"];
  if (status.some((s) => !(STATUS_INBOX as readonly string[]).includes(s))) return NextResponse.json({ error: "status inválido" }, { status: 400 });
  const tipos = Array.isArray(body.tipos) ? body.tipos.map(String) : [];
  if (tipos.some((t) => !/^[a-z_.]+$/.test(t))) return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  const eventId = typeof body.eventId === "string" ? body.eventId : null;
  if (eventId && !/^evt_[A-Za-z0-9]+$/.test(eventId)) return NextResponse.json({ error: "eventId inválido" }, { status: 400 });
  const modo = body.modo === "inline" ? "inline" : "fila";
  const limite = Math.max(1, Math.min(Number(body.limite) || 50, modo === "inline" ? 20 : 500));

  const rows = await selecionarEventos({
    organizacaoId: a.ctx.organizacaoId, status: eventId ? undefined : status, tipos, eventId, limite, incluirSemOrganizacao: !!eventId,
  });
  const resultados = await reprocessarSelecionados(rows, { modo, organizacaoId: a.ctx.organizacaoId, usuarioId: a.ctx.userId });
  return NextResponse.json({ selecionados: rows.length, modo, resultados });
}
