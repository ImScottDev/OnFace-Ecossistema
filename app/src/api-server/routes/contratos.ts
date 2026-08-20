import { Hono } from "hono";
import { db } from "@/lib/db";
import { contratos, leads, npsRespostas } from "@/lib/db/schema";
import { desc, eq, and, sql, SQL } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { contratoPdfHtml, renderContratoPdf } from "@/lib/crm/contrato-pdf";

const app = new Hono();

const TIPOS_CONTRATO = ["safety_everywhere", "fwaas", "projeto", "consultoria", "resposta_incidente", "servico", "recorrente", "avulso"] as const;

const createContratoSchema = z.object({
  leadId: z.string().uuid(),
  tipo: z.string().min(1),
  descricao: z.string().optional().nullable(),
  mrr: z.string().optional().nullable(),
  valorSetup: z.string().optional().nullable(),
  servicos: z.array(z.string()).optional().nullable(),
  inicio: z.string().optional().nullable(),
  vencimento: z.string().optional().nullable(),
  renovacaoAuto: z.boolean().optional(),
});

const updateContratoSchema = z.object({
  tipo: z.string().optional(),
  descricao: z.string().optional().nullable(),
  moeda: z.enum(["BRL", "USD", "EUR", "CAD"]).optional(),
  mrr: z.string().optional().nullable(),
  valorSetup: z.string().optional().nullable(),
  servicos: z.array(z.string()).optional().nullable(),
  inicio: z.string().optional().nullable(),
  vencimento: z.string().optional().nullable(),
  renovacaoAuto: z.boolean().optional(),
  status: z.enum(["ativo", "pausado", "cancelado", "renovado", "concluido", "churned"]).optional(),
  notas: z.string().optional().nullable(),
});

// GET /api/contratos
app.get("/contratos", async (c) => {
  const ctx = await getCtx(c);

  const status = c.req.query("status") ?? null;
  const tipo = c.req.query("tipo") ?? null;

  const conditions: SQL[] = [eq(leads.organizacaoId, ctx.organizacaoId)];
  if (status) conditions.push(eq(contratos.status, status));
  if (tipo) conditions.push(eq(contratos.tipo, tipo));

  const where = and(...conditions);

  const result = await db
    .select({
      id: contratos.id,
      leadId: contratos.leadId,
      tipo: contratos.tipo,
      descricao: contratos.descricao,
      mrr: contratos.mrr,
      valorSetup: contratos.valorSetup,
      servicos: contratos.servicos,
      inicio: contratos.inicio,
      vencimento: contratos.vencimento,
      renovacaoAuto: contratos.renovacaoAuto,
      status: contratos.status,
      notas: contratos.notas,
      createdAt: contratos.createdAt,
      updatedAt: contratos.updatedAt,
      leadNome: leads.nome,
      leadEmpresa: leads.empresa,
    })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(where)
    .orderBy(desc(contratos.createdAt));

  return c.json({ contratos: result });
});

// POST /api/contratos
app.post("/contratos", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const parsed = createContratoSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      400
    );
  }

  // Verify lead belongs to org
  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, parsed.data.leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return c.json({ error: "Lead nao encontrado" }, 404);
  }

  const [contrato] = await db
    .insert(contratos)
    .values({
      organizacaoId: ctx.organizacaoId,
      leadId: parsed.data.leadId,
      tipo: parsed.data.tipo,
      descricao: parsed.data.descricao,
      mrr: parsed.data.mrr,
      valorSetup: parsed.data.valorSetup,
      servicos: parsed.data.servicos,
      inicio: parsed.data.inicio,
      vencimento: parsed.data.vencimento,
      renovacaoAuto: parsed.data.renovacaoAuto,
      produto: "ai",
    })
    .returning();

  return c.json(contrato, 201);
});

// GET /api/contratos/:id
app.get("/contratos/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");

  const [contrato] = await db
    .select({
      id: contratos.id,
      leadId: contratos.leadId,
      negocioId: contratos.negocioId,
      tipo: contratos.tipo,
      descricao: contratos.descricao,
      moeda: contratos.moeda,
      mrr: contratos.mrr,
      valorSetup: contratos.valorSetup,
      servicos: contratos.servicos,
      inicio: contratos.inicio,
      vencimento: contratos.vencimento,
      renovacaoAuto: contratos.renovacaoAuto,
      status: contratos.status,
      notas: contratos.notas,
      motivoChurn: contratos.motivoChurn,
      finalizadoAt: contratos.finalizadoAt,
      createdAt: contratos.createdAt,
      updatedAt: contratos.updatedAt,
      leadNome: leads.nome,
      leadEmpresa: leads.empresa,
      leadEmail: leads.email,
      leadTelefone: leads.telefone,
    })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(eq(contratos.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!contrato) {
    return c.json({ error: "Contrato nao encontrado" }, 404);
  }

  const npsHistory = await db
    .select()
    .from(npsRespostas)
    .where(eq(npsRespostas.contratoId, id))
    .orderBy(desc(npsRespostas.createdAt));

  return c.json({ contrato, npsRespostas: npsHistory });
});

// GET /api/contratos/:id/pdf — correção 19/08 (visibilidade de contrato):
// mesma engine de render de proposta-pdf.ts, corpo já vem de
// contrato-template.ts (ou vazio, quando o contrato nasceu fora da engine —
// nesse caso o PDF já avisa isso, não finge um corpo que não existe).
app.get("/contratos/:id/pdf", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [ct] = await db
    .select({
      descricao: contratos.descricao,
      corpoGerado: contratos.corpoGerado,
      createdAt: contratos.createdAt,
      signatureStatus: contratos.signatureStatus,
      assinaturaStatus: contratos.assinaturaStatus,
      assinadoNome: contratos.assinadoNome,
      assinadoEm: contratos.assinadoEm,
      assinadoIp: contratos.assinadoIp,
      leadNome: leads.nome,
      leadEmpresa: leads.empresa,
    })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(eq(contratos.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!ct) return c.json({ error: "Contrato não encontrado" }, 404);

  const assinado = ct.signatureStatus === "signed" || ct.assinaturaStatus === "aceite_simples";
  const html = contratoPdfHtml({
    descricao: ct.descricao,
    corpoGerado: ct.corpoGerado,
    clienteNome: ct.leadEmpresa || ct.leadNome,
    createdAt: ct.createdAt,
    assinado,
    assinadoNome: ct.assinadoNome,
    assinadoEm: ct.assinadoEm,
    assinadoIp: ct.assinadoIp,
  });
  const pdf = await renderContratoPdf(html);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="contrato-${id.slice(0, 8)}.pdf"` },
  });
});

// PATCH /api/contratos/:id
app.patch("/contratos/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");

  // Verify contrato belongs to org via lead
  const [existing] = await db
    .select({ id: contratos.id })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(eq(contratos.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Contrato nao encontrado" }, 404);
  }

  const body = await c.req.json();
  const parsed = updateContratoSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      400
    );
  }

  const updatePayload: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };

  // If status is being changed to concluido or churned, set finalizadoAt
  if (parsed.data.status === "concluido" || parsed.data.status === "churned") {
    updatePayload.finalizadoAt = new Date();
  }

  const [updated] = await db
    .update(contratos)
    .set(updatePayload)
    .where(eq(contratos.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Contrato nao encontrado" }, 404);
  }

  // If contract is finalized/churned, check if lead still has active contracts
  if (parsed.data.status === "concluido" || parsed.data.status === "churned" || parsed.data.status === "cancelado") {
    const activeContracts = await db
      .select({ id: contratos.id })
      .from(contratos)
      .where(and(eq(contratos.leadId, updated.leadId), eq(contratos.status, "ativo")))
      .limit(1);

    // No more active contracts → lead becomes ex-cliente
    if (activeContracts.length === 0) {
      await db.update(leads).set({
        tipo: "ex-cliente",
        updatedAt: new Date(),
      }).where(eq(leads.id, updated.leadId));
    }
  }

  // If reactivated, promote lead back to cliente
  if (parsed.data.status === "ativo") {
    await db.update(leads).set({
      tipo: "cliente",
      updatedAt: new Date(),
    }).where(eq(leads.id, updated.leadId));
  }

  return c.json(updated);
});

// POST /api/contratos/:id/finalizar — finalizar ou registrar churn
app.post("/contratos/:id/finalizar", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json();
  const schema = z.object({
    tipo: z.enum(["concluido", "churned"]),
    motivo: z.string().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Dados inválidos" }, 400);

  // Verify
  const [existing] = await db
    .select({ id: contratos.id, leadId: contratos.leadId })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(eq(contratos.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) return c.json({ error: "Contrato não encontrado" }, 404);

  const [updated] = await db
    .update(contratos)
    .set({
      status: parsed.data.tipo,
      motivoChurn: parsed.data.motivo || null,
      finalizadoAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(contratos.id, id))
    .returning();

  // Check remaining active contracts for this lead
  const activeContracts = await db
    .select({ id: contratos.id })
    .from(contratos)
    .where(and(eq(contratos.leadId, existing.leadId), eq(contratos.status, "ativo")))
    .limit(1);

  if (activeContracts.length === 0) {
    await db.update(leads).set({
      tipo: "ex-cliente",
      updatedAt: new Date(),
    }).where(eq(leads.id, existing.leadId));
  }

  return c.json(updated);
});

export const contratosRoutes = app;
