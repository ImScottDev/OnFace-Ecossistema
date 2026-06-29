import { Hono } from "hono";
import { db } from "@/lib/db";
import { contratos, leads, empresas, usuarios, negocios } from "@/lib/db/schema";
import { eq, and, desc, sql, ne } from "drizzle-orm";
import { getCtx } from "../compat.js";

const app = new Hono();

// GET /carteira — active contracts grouped by lead/empresa
app.get("/", async (c) => {
  const ctx = await getCtx(c);
  const includeEx = c.req.query("ex") === "true";

  // Active contracts with lead + empresa info
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
    .where(and(
      eq(leads.organizacaoId, ctx.organizacaoId),
      statusFilter,
      // RBAC: vendedor/closer vê só os clientes dele
      ctx.userRole === "vendedor" || ctx.userRole === "closer" ? eq(leads.responsavelId, ctx.userId) : undefined,
    ))
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
    leadTelefone: c.leadTelefone,
    leadEmail: c.leadEmail,
    responsavelNome: c.responsavelId ? respMap[c.responsavelId] || null : null,
  }));

  // Calculate totals
  const activeOnly = includeEx ? [] : clients;
  const totalMrr = activeOnly.reduce((sum, c) => sum + (parseFloat(c.mrr || "0") || 0), 0);
  const totalClients = new Set(activeOnly.map(c => c.leadId)).size;
  const avgTicket = totalClients > 0 ? Math.round(totalMrr / totalClients) : 0;

  // Count ex-clientes for the badge
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

  return c.json({
    clients,
    totals: {
      totalClients,
      totalMrr,
      avgTicket,
      totalContratos: clients.length,
      exClientes: exCount?.count || 0,
    },
  });
});

export const carteiraRoutes = app;
