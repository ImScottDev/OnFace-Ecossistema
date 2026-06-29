import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { propostas, propostaItens, leads, usuarios } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";

const itemSchema = z.object({
  servicoCatalogoId: z.string().uuid().optional().nullable(),
  nome: z.string().min(1),
  descricao: z.string().optional().nullable(),
  tipo: z.enum(["recorrente", "avulso", "setup"]),
  quantidade: z.coerce.number().positive().default(1),
  valorUnitario: z.coerce.number().min(0).default(0),
  desconto: z.coerce.number().min(0).default(0),
  descontoTipo: z.enum(["percentual", "valor"]).default("percentual"),
  ordem: z.coerce.number().int().optional(),
});

const updateSchema = z.object({
  moeda: z.enum(["BRL", "USD", "EUR", "CAD"]).optional(),
  observacoes: z.string().optional().nullable(),
  condicoesPagamento: z.string().optional().nullable(),
  dataValidade: z.string().optional().nullable(),
  itens: z.array(itemSchema).min(1).optional(),
});

function calcSubtotal(qty: number, unit: number, desc: number, descTipo: string = "percentual") {
  if (descTipo === "valor") return Math.round((qty * unit - desc) * 100) / 100;
  return Math.round(qty * unit * (1 - desc / 100) * 100) / 100;
}

// GET /api/propostas/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

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

  if (!proposta) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const itens = await db
    .select()
    .from(propostaItens)
    .where(eq(propostaItens.propostaId, id))
    .orderBy(asc(propostaItens.ordem));

  return NextResponse.json({ ...proposta, itens });
}

// PATCH /api/propostas/:id (only rascunho)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  const [existing] = await db
    .select({ status: propostas.status, negocioId: propostas.negocioId })
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  if (existing.status !== "rascunho") {
    return NextResponse.json({ error: "Só é possível editar propostas em rascunho" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
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

  return NextResponse.json(updated);
}

// DELETE /api/propostas/:id (only rascunho)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  const [existing] = await db
    .select({ status: propostas.status, negocioId: propostas.negocioId })
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  if (existing.status !== "rascunho") {
    return NextResponse.json({ error: "Só é possível excluir propostas em rascunho" }, { status: 400 });
  }

  const negocioId = existing.negocioId;
  await db.delete(propostas).where(eq(propostas.id, id));

  // Sync negocio values from propostas
  if (negocioId) {
    await syncNegocioValoresFromPropostas(negocioId);
  }

  return NextResponse.json({ ok: true });
}
