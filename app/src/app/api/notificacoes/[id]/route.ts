import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificacoes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// PATCH /api/notificacoes/:id — mark as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  // Only allow marking own notifications as read
  const [updated] = await db
    .update(notificacoes)
    .set({ lida: true })
    .where(and(eq(notificacoes.id, id), eq(notificacoes.usuarioId, ctx.userId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Notificacao nao encontrada" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
