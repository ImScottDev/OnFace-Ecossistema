import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contatos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// POST /api/contatos/:id/desvincular — unlink contato from lead (no propagation)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  // Fetch contato
  const [contato] = await db
    .select()
    .from(contatos)
    .where(and(eq(contatos.id, id), eq(contatos.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!contato) {
    return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
  }

  // Unlink — set leadId to null
  const [updated] = await db
    .update(contatos)
    .set({ leadId: null, updatedAt: new Date() })
    .where(eq(contatos.id, id))
    .returning();

  return NextResponse.json({ contato: updated });
}
