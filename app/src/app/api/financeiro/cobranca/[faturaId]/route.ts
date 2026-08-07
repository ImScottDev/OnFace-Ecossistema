import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { faturas } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * PATCH /api/financeiro/cobranca/[faturaId]
 *
 * Marca/desmarca uma fatura da fila de cobrança como "acionada" (já trabalhada
 * por alguém do time). Controle manual — não infere a partir de tarefas ou
 * notas, é um check direto de quem está rodando a fila.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ faturaId: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { faturaId } = await params;
  const body = await request.json().catch(() => ({}));
  const acionado = body?.acionado === true;

  const [fatura] = await db
    .select({ id: faturas.id })
    .from(faturas)
    .where(and(eq(faturas.id, faturaId), eq(faturas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!fatura) {
    return NextResponse.json({ error: "Fatura não encontrada" }, { status: 404 });
  }

  const [updated] = await db
    .update(faturas)
    .set({
      acionadoCobranca: acionado,
      acionadoEm: acionado ? new Date() : null,
      acionadoPor: acionado ? ctx.userId : null,
    })
    .where(eq(faturas.id, faturaId))
    .returning();

  return NextResponse.json({ id: updated.id, acionado: updated.acionadoCobranca });
}
