import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { propostas, atividades } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { syncNegocioValoresFromPropostas } from "@/lib/crm/sync-negocio-valores";

const bodySchema = z.object({
  motivo: z.string().optional(),
});

// POST /api/propostas/:id/recusar — enviada → recusada
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  const motivo = parsed.success ? parsed.data.motivo : undefined;

  const [proposta] = await db
    .select()
    .from(propostas)
    .where(and(eq(propostas.id, id), eq(propostas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!proposta) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  if (proposta.status !== "enviada") {
    return NextResponse.json({ error: "Só é possível recusar propostas enviadas" }, { status: 400 });
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

  return NextResponse.json(updated);
}
