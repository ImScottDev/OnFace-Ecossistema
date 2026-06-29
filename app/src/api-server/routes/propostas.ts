import { Hono } from "hono";
import { db } from "@/lib/db";
import { propostas, propostaItens, leads, negocios, usuarios, contratos, atividades, statusChanges } from "@/lib/db/schema";
import { eq, and, desc, asc, sql, ilike, inArray, count } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";
import { marcarPropostaAceita } from "@/lib/crm/aceitar-proposta";
import { enviarPropostaComCheckout } from "@/lib/crm/enviar-proposta";

const app = new Hono();

const itemSchema = z.object({
  servicoCatalogoId: z.string().uuid().optional().nullable(),
  nome: z.string().min(1),
  descricao: z.string().optional(),
  tipo: z.enum(["recorrente", "avulso", "setup"]),
  quantidade: z.number().positive().default(1),
  valorUnitario: z.number().min(0).default(0),
  desconto: z.number().min(0).default(0),
  descontoTipo: z.enum(["percentual", "valor"]).default("percentual"),
  ordem: z.number().int().optional(),
});

const createSchema = z.object({
  leadId: z.string().uuid().optional(),
  negocioId: z.string().uuid().optional(),
  moeda: z.enum(["BRL", "USD", "EUR", "CAD"]).default("BRL"),
  observacoes: z.string().optional(),
  condicoesPagamento: z.string().optional(),
  dataValidade: z.string().optional(),
  itens: z.array(itemSchema).default([]),
});

const updateSchema = z.object({
  moeda: z.enum(["BRL", "USD", "EUR", "CAD"]).optional(),
  observacoes: z.string().optional().nullable(),
  condicoesPagamento: z.string().optional().nullable(),
  dataValidade: z.string().optional().nullable(),
  itens: z.array(itemSchema).min(1).optional(),
});

const aceitarBodySchema = z.object({
  avancarLeadStatus: z.boolean().default(false),
});

const recusarBodySchema = z.object({
  motivo: z.string().optional(),
});

function calcSubtotal(qty: number, unit: number, desc: number, descTipo: string = "percentual") {
  if (descTipo === "valor") return Math.round((qty * unit - desc) * 100) / 100;
  return Math.round(qty * unit * (1 - desc / 100) * 100) / 100;
}

// GET /propostas
app.get("/propostas", async (c) => {
  const ctx = await getCtx(c);

  const statusFilter = c.req.query("status") ?? null;
  const leadId = c.req.query("leadId") ?? null;
  const search = c.req.query("q") ?? null;

  const conditions = [eq(propostas.organizacaoId, ctx.organizacaoId)];
  if (statusFilter) conditions.push(eq(propostas.status, statusFilter));
  if (leadId) conditions.push(eq(propostas.leadId, leadId));

  let query = db
    .select({
      id: propostas.id,
      numero: propostas.numero,
      versao: propostas.versao,
      status: propostas.status,
      leadId: propostas.leadId,
      leadNome: leads.nome,
      leadEmpresa: leads.empresa,
      moeda: propostas.moeda,
      totalRecorrente: propostas.totalRecorrente,
      totalAvulso: propostas.totalAvulso,
      totalGeral: propostas.totalGeral,
      dataEmissao: propostas.dataEmissao,
      dataValidade: propostas.dataValidade,
      criadoPorNome: usuarios.nome,
      createdAt: propostas.createdAt,
    })
    .from(propostas)
    .leftJoin(leads, eq(propostas.leadId, leads.id))
    .leftJoin(usuarios, eq(propostas.criadoPorId, usuarios.id))
    .where(and(...conditions))
    .orderBy(desc(propostas.createdAt))
    .$dynamic();

  if (search) {
    query = query.where(and(...conditions, ilike(leads.nome, `%${search}%`)));
  }

  const results = await query.limit(100);
  return c.json(results);
});

// GET /propostas/count — open proposals count for sidebar badge
app.get("/propostas/count", async (c) => {
  const ctx = await getCtx(c);

  const [result] = await db
    .select({ count: count() })
    .from(propostas)
    .where(
      and(
        eq(propostas.organizacaoId, ctx.organizacaoId),
        inArray(propostas.status, ["rascunho", "enviada"])
      )
    );

  return c.json({ count: result?.count ?? 0 });
});

// GET /propostas/:id
app.get("/propostas/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [proposta] = await db
    .select({
      id: propostas.id,
      organizacaoId: propostas.organizacaoId,
      leadId: propostas.leadId,
      numero: propostas.numero,
      versao: propostas.versao,
      propostaOriginalId: propostas.propostaOriginalId,
      status: propostas.status,
      dataEmissao: propostas.dataEmissao,
      dataValidade: propostas.dataValidade,
      observacoes: propostas.observacoes,
      condicoesPagamento: propostas.condicoesPagamento,
      moeda: propostas.moeda,
      totalRecorrente: propostas.totalRecorrente,
      totalAvulso: propostas.totalAvulso,
      totalGeral: propostas.totalGeral,
      contratoId: propostas.contratoId,
      checkoutUrl: propostas.checkoutUrl,
      stripeSessionId: propostas.stripeSessionId,
      enviadaEm: propostas.enviadaEm,
      criadoPorId: propostas.criadoPorId,
      criadoPorNome: usuarios.nome,
      leadNome: leads.nome,
      leadEmpresa: leads.empresa,
      leadTelefone: leads.telefone,
      leadEmail: leads.email,
      createdAt: propostas.createdAt,
      updatedAt: propostas.updatedAt,
    })
    .from(propostas)
    .leftJoin(leads, eq(propostas.leadId, leads.id))
    .leftJoin(usuarios, eq(propostas.criadoPorId, usuarios.id))
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!proposta) return c.json({ error: "Proposta não encontrada" }, 404);

  const itens = await db
    .select()
    .from(propostaItens)
    .where(eq(propostaItens.propostaId, id))
    .orderBy(asc(propostaItens.ordem));

  return c.json({ ...proposta, itens });
});

// POST /propostas
app.post("/propostas", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  // Resolve leadId from negocioId if provided
  let resolvedLeadId = parsed.data.leadId;
  let resolvedNegocioId = parsed.data.negocioId;

  if (resolvedNegocioId) {
    const [neg] = await db
      .select({ id: negocios.id, leadId: negocios.leadId })
      .from(negocios)
      .where(and(eq(negocios.id, resolvedNegocioId), eq(negocios.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!neg) return c.json({ error: "Negócio não encontrado" }, 404);
    resolvedLeadId = neg.leadId || undefined;
  }

  if (!resolvedLeadId) {
    return c.json({ error: "leadId ou negocioId é obrigatório" }, 400);
  }

  // Verify lead belongs to org
  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, resolvedLeadId), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!lead) return c.json({ error: "Lead não encontrado" }, 404);

  // Get next numero for org
  const [{ maxNum }] = await db
    .select({ maxNum: sql<number>`COALESCE(MAX(${propostas.numero}), 0)` })
    .from(propostas)
    .where(eq(propostas.organizacaoId, ctx.organizacaoId));

  const numero = (maxNum || 0) + 1;

  // Calculate totals
  let totalRecorrente = 0;
  let totalAvulso = 0;
  const moeda = parsed.data.moeda;
  const itensWithCalc = parsed.data.itens.map((item, idx) => {
    const subtotal = calcSubtotal(item.quantidade, item.valorUnitario, item.desconto, item.descontoTipo);
    if (item.tipo === "recorrente") totalRecorrente += subtotal;
    else totalAvulso += subtotal;
    return { ...item, subtotal, ordem: item.ordem ?? idx };
  });

  const today = new Date().toISOString().split("T")[0];

  // Create proposal
  const [proposta] = await db
    .insert(propostas)
    .values({
      organizacaoId: ctx.organizacaoId,
      leadId: resolvedLeadId,
      negocioId: resolvedNegocioId,
      numero,
      versao: 1,
      moeda,
      status: "rascunho",
      dataEmissao: today,
      dataValidade: parsed.data.dataValidade || undefined,
      observacoes: parsed.data.observacoes,
      condicoesPagamento: parsed.data.condicoesPagamento,
      totalRecorrente: totalRecorrente.toFixed(2),
      totalAvulso: totalAvulso.toFixed(2),
      totalGeral: (totalRecorrente + totalAvulso).toFixed(2),
      criadoPorId: ctx.userId,
    })
    .returning();

  // Insert items
  if (itensWithCalc.length > 0) {
    await db.insert(propostaItens).values(
      itensWithCalc.map((item) => ({
        propostaId: proposta.id,
        servicoCatalogoId: item.servicoCatalogoId || undefined,
        nome: item.nome,
        descricao: item.descricao,
        tipo: item.tipo,
        moeda,
        quantidade: item.quantidade.toString(),
        valorUnitario: item.valorUnitario.toFixed(2),
        desconto: item.desconto.toFixed(2),
        descontoTipo: item.descontoTipo,
        subtotal: item.subtotal.toFixed(2),
        ordem: item.ordem,
      }))
    );
  }

  // Sync negocio values from propostas
  if (resolvedNegocioId) {
    await syncNegocioValoresFromPropostas(resolvedNegocioId);
  }

  return c.json({ ...proposta, numero: `#P-${String(numero).padStart(3, "0")}-v1` }, 201);
});

// PATCH /propostas/:id (only rascunho)
app.patch("/propostas/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [existing] = await db
    .select({ status: propostas.status, negocioId: propostas.negocioId })
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) return c.json({ error: "Proposta não encontrada" }, 404);
  if (existing.status !== "rascunho") {
    return c.json({ error: "Só é possível editar propostas em rascunho" }, 400);
  }

  const body = await c.req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.moeda !== undefined) updateData.moeda = parsed.data.moeda;
  if (parsed.data.observacoes !== undefined) updateData.observacoes = parsed.data.observacoes;
  if (parsed.data.condicoesPagamento !== undefined) updateData.condicoesPagamento = parsed.data.condicoesPagamento;
  if (parsed.data.dataValidade !== undefined) updateData.dataValidade = parsed.data.dataValidade;

  // Replace items if provided
  if (parsed.data.itens) {
    // Delete existing items
    await db.delete(propostaItens).where(eq(propostaItens.propostaId, id));

    let totalRecorrente = 0;
    let totalAvulso = 0;
    const moeda = (parsed.data.moeda || "BRL") as string;
    const itensWithCalc = parsed.data.itens.map((item, idx) => {
      const subtotal = calcSubtotal(item.quantidade, item.valorUnitario, item.desconto, item.descontoTipo);
      if (item.tipo === "recorrente") totalRecorrente += subtotal;
      else totalAvulso += subtotal;
      return { ...item, subtotal, ordem: item.ordem ?? idx };
    });

    await db.insert(propostaItens).values(
      itensWithCalc.map((item) => ({
        propostaId: id,
        servicoCatalogoId: item.servicoCatalogoId || undefined,
        nome: item.nome,
        descricao: item.descricao,
        tipo: item.tipo,
        moeda,
        quantidade: item.quantidade.toString(),
        valorUnitario: item.valorUnitario.toFixed(2),
        desconto: item.desconto.toFixed(2),
        descontoTipo: item.descontoTipo,
        subtotal: item.subtotal.toFixed(2),
        ordem: item.ordem,
      }))
    );

    updateData.totalRecorrente = totalRecorrente.toFixed(2);
    updateData.totalAvulso = totalAvulso.toFixed(2);
    updateData.totalGeral = (totalRecorrente + totalAvulso).toFixed(2);
  }

  const [updated] = await db
    .update(propostas)
    .set(updateData)
    .where(eq(propostas.id, id))
    .returning();

  // Sync negocio values from propostas
  if (existing.negocioId) {
    await syncNegocioValoresFromPropostas(existing.negocioId);
  }

  return c.json(updated);
});

// DELETE /propostas/:id (only rascunho)
app.delete("/propostas/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [existing] = await db
    .select({ status: propostas.status, negocioId: propostas.negocioId })
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) return c.json({ error: "Proposta não encontrada" }, 404);
  if (existing.status !== "rascunho") {
    return c.json({ error: "Só é possível excluir propostas em rascunho" }, 400);
  }

  const negocioId = existing.negocioId;
  await db.delete(propostas).where(eq(propostas.id, id));

  // Sync negocio values from propostas
  if (negocioId) {
    await syncNegocioValoresFromPropostas(negocioId);
  }

  return c.json({ ok: true });
});

// POST /propostas/:id/enviar — gera checkout Stripe (assinatura) + envia email
// pro cliente com resumo da proposta + CTA de pagamento. rascunho/enviada → enviada.
app.post("/propostas/:id/enviar", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const result = await enviarPropostaComCheckout({
    propostaId: id,
    organizacaoId: ctx.organizacaoId,
    userId: ctx.userId,
    userName: ctx.userName,
  });

  if (!result.ok) return c.json({ error: result.error }, result.status as 400);
  return c.json({
    ...result.proposta,
    checkoutUrl: result.checkoutUrl,
    emailSent: result.emailSent,
    emailSkipped: result.emailSkipped,
    emailError: result.emailError,
  });
});

// POST /propostas/:id/aceitar — enviada → aceita + cria contrato
app.post("/propostas/:id/aceitar", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const parsed = aceitarBodySchema.safeParse(body);
  const avancarLead = parsed.success ? parsed.data.avancarLeadStatus : false;

  const [proposta] = await db
    .select()
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!proposta) return c.json({ error: "Proposta não encontrada" }, 404);
  if (proposta.status !== "enviada") {
    return c.json({ error: "Só é possível aceitar propostas enviadas" }, 400);
  }

  const { contratoId } = await marcarPropostaAceita({
    proposta,
    organizacaoId: ctx.organizacaoId,
    userId: ctx.userId,
    avancarLead,
  });

  return c.json({ proposta: { ...proposta, status: "aceita", contratoId }, contratoId });
});

// POST /propostas/:id/nova-versao — clone into new version
app.post("/propostas/:id/nova-versao", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [original] = await db
    .select()
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!original) return c.json({ error: "Proposta não encontrada" }, 404);

  const itens = await db
    .select()
    .from(propostaItens)
    .where(eq(propostaItens.propostaId, id))
    .orderBy(asc(propostaItens.ordem));

  const today = new Date().toISOString().split("T")[0];

  // Create new version with same numero
  const [novaProposta] = await db
    .insert(propostas)
    .values({
      organizacaoId: ctx.organizacaoId,
      leadId: original.leadId,
      numero: original.numero,
      versao: original.versao + 1,
      propostaOriginalId: original.propostaOriginalId || original.id,
      status: "rascunho",
      dataEmissao: today,
      dataValidade: original.dataValidade,
      observacoes: original.observacoes,
      condicoesPagamento: original.condicoesPagamento,
      totalRecorrente: original.totalRecorrente,
      totalAvulso: original.totalAvulso,
      totalGeral: original.totalGeral,
      criadoPorId: ctx.userId,
    })
    .returning();

  // Clone items
  if (itens.length > 0) {
    await db.insert(propostaItens).values(
      itens.map((item) => ({
        propostaId: novaProposta.id,
        servicoCatalogoId: item.servicoCatalogoId,
        nome: item.nome,
        descricao: item.descricao,
        tipo: item.tipo,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        desconto: item.desconto,
        subtotal: item.subtotal,
        ordem: item.ordem,
      }))
    );
  }

  return c.json(novaProposta, 201);
});

// POST /propostas/:id/recusar — enviada → recusada
app.post("/propostas/:id/recusar", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const parsed = recusarBodySchema.safeParse(body);
  const motivo = parsed.success ? parsed.data.motivo : undefined;

  const [proposta] = await db
    .select()
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!proposta) return c.json({ error: "Proposta não encontrada" }, 404);
  if (proposta.status !== "enviada") {
    return c.json({ error: "Só é possível recusar propostas enviadas" }, 400);
  }

  const [updated] = await db
    .update(propostas)
    .set({ status: "recusada", updatedAt: new Date() })
    .where(eq(propostas.id, id))
    .returning();

  await db.insert(atividades).values({
    organizacaoId: ctx.organizacaoId,
    leadId: proposta.leadId,
    usuarioId: ctx.userId,
    tipo: "proposta_enviada",
    titulo: `Proposta #P-${String(proposta.numero).padStart(3, "0")}-v${proposta.versao} recusada`,
    descricao: motivo || "Proposta recusada pelo cliente",
    dados: { propostaId: proposta.id, acao: "recusada", motivo },
  });

  // Sync negocio values from propostas
  if (proposta.negocioId) {
    await syncNegocioValoresFromPropostas(proposta.negocioId);
  }

  return c.json(updated);
});

export const propostasRoutes = app;
