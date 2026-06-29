import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { propostas, propostaItens } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// POST /api/propostas/:id/nova-versao — clone into new version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  const [original] = await db
    .select()
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!original) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

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

  return NextResponse.json(novaProposta, { status: 201 });
}
