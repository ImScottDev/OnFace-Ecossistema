import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { propostas, propostaItens, leads, negocios, usuarios } from "@/lib/db/schema";
import { eq, and, desc, sql, ilike, inArray } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";

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

function calcSubtotal(qty: number, unit: number, desc: number, descTipo: string = "percentual") {
  if (descTipo === "valor") return Math.round((qty * unit - desc) * 100) / 100;
  return Math.round(qty * unit * (1 - desc / 100) * 100) / 100;
}

// GET /api/propostas
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const url = request.nextUrl.searchParams;
  const statusFilter = url.get("status");
  const leadId = url.get("leadId");
  const search = url.get("q");

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

  const limitParam = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "100") || 100, 2000);
  const results = await query.limit(limitParam);
  return NextResponse.json(results);
}

// POST /api/propostas
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
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
    if (!neg) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });
    resolvedLeadId = neg.leadId || undefined;
  }

  if (!resolvedLeadId) {
    return NextResponse.json({ error: "leadId ou negocioId é obrigatório" }, { status: 400 });
  }

  // Verify lead belongs to org
  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, resolvedLeadId), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

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

  return NextResponse.json({ ...proposta, numero: `#P-${String(numero).padStart(3, "0")}-v1` }, { status: 201 });
}
