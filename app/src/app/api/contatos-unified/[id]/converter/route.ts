import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, atividades } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// POST /api/contatos-unified/:id/converter — convert contato to lead
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  // Find the contato
  const [contato] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId), eq(leads.tipo, "contato")))
    .limit(1);

  if (!contato) {
    return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
  }

  // Convert: change tipo from 'contato' to 'lead'
  const [updated] = await db
    .update(leads)
    .set({
      tipo: "lead",
      status: "novo",
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id))
    .returning();

  // Log activity
  await db.insert(atividades).values({
    organizacaoId: ctx.organizacaoId,
    leadId: id,
    usuarioId: ctx.userId,
    tipo: "nota",
    descricao: `Contato convertido em lead`,
  });

  return NextResponse.json(updated);
}
