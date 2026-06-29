import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contratos, leads, usuarios } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// GET /api/carteira — active contracts (what the UI renders)
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const includeEx = request.nextUrl.searchParams.get("ex") === "true";

  const statusFilter = includeEx
    ? sql`${contratos.status} IN ('concluido', 'churned', 'cancelado')`
    : eq(contratos.status, "ativo");

  const result = await db
    .select({
      contratoId: contratos.id,
      negocioId: contratos.negocioId,
      tipo: contratos.tipo,
      descricao: contratos.descricao,
      mrr: contratos.mrr,
      valorSetup: contratos.valorSetup,
      servicos: contratos.servicos,
      inicio: contratos.inicio,
      vencimento: contratos.vencimento,
      renovacaoAuto: contratos.renovacaoAuto,
      status: contratos.status,
      motivoChurn: contratos.motivoChurn,
      finalizadoAt: contratos.finalizadoAt,
      createdAt: contratos.createdAt,
      leadId: contratos.leadId,
      leadNome: leads.nome,
      leadEmpresa: leads.empresa,
      leadTelefone: leads.telefone,
      leadEmail: leads.email,
      responsavelId: leads.responsavelId,
    })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(eq(leads.organizacaoId, ctx.organizacaoId), statusFilter))
    .orderBy(desc(contratos.mrr));

  // Get responsavel names
  const respIds = [...new Set(result.filter(r => r.responsavelId).map(r => r.responsavelId!))];
  let respMap: Record<string, string> = {};
  if (respIds.length > 0) {
    const resps = await db
      .select({ id: usuarios.id, nome: usuarios.nome })
      .from(usuarios)
      .where(sql`${usuarios.id} IN (${sql.join(respIds.map(id => sql`${id}::uuid`), sql`, `)})`);
    for (const r of resps) {
      respMap[r.id] = r.nome;
    }
  }

  const clients = result.map((c) => ({
    contratoId: c.contratoId,
    negocioId: c.negocioId,
    tipo: c.tipo,
    descricao: c.descricao,
    mrr: c.mrr,
    valorSetup: c.valorSetup,
    servicos: c.servicos,
    inicio: c.inicio,
    vencimento: c.vencimento,
    renovacaoAuto: c.renovacaoAuto,
    status: c.status,
    motivoChurn: c.motivoChurn,
    finalizadoAt: c.finalizadoAt,
    createdAt: c.createdAt,
    leadId: c.leadId,
    leadNome: c.leadNome,
    leadEmpresa: c.leadEmpresa,
    responsavelNome: c.responsavelId ? respMap[c.responsavelId] || null : null,
  }));

  // Calculate totals
  const activeOnly = includeEx ? [] : clients;
  const totalMrr = activeOnly.reduce((sum, c) => sum + (parseFloat(c.mrr || "0") || 0), 0);
  const totalClients = new Set(activeOnly.map(c => c.leadId)).size;
  const avgTicket = totalClients > 0 ? Math.round(totalMrr / totalClients) : 0;

  // Count ex-clientes
  const [exCount] = await db
    .select({ count: sql<number>`count(DISTINCT ${contratos.leadId})::int` })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(
      eq(leads.organizacaoId, ctx.organizacaoId),
      sql`${contratos.status} IN ('concluido', 'churned', 'cancelado')`,
      sql`${contratos.leadId} NOT IN (
        SELECT lead_id FROM contratos WHERE status = 'ativo'
      )`
    ));

  return NextResponse.json({
    clients,
    totals: {
      totalClients,
      totalMrr,
      avgTicket,
      totalContratos: clients.length,
      exClientes: exCount?.count || 0,
    },
  });
}
