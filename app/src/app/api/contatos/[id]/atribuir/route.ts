import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contatos, usuarios, leads } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/tenant";

const atribuirSchema = z.object({
  usuarioId: z.string().uuid().optional(),
  naoLidas: z.number().int().min(0).optional(),
});

// POST /api/contatos/:id/atribuir — assign contato to user OR update unread count
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const parsed = atribuirSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  // Fetch contato
  const [contato] = await db
    .select()
    .from(contatos)
    .where(and(eq(contatos.id, id), eq(contatos.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!contato) {
    return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
  }

  // If only updating unread count (no user assignment)
  if (parsed.data.naoLidas !== undefined && !parsed.data.usuarioId) {
    const [updated] = await db
      .update(contatos)
      .set({ naoLidas: parsed.data.naoLidas, updatedAt: new Date() })
      .where(eq(contatos.id, id))
      .returning();

    // Also update lead unread count if linked
    if (contato.leadId) {
      await db
        .update(leads)
        .set({ whatsappNaoLidas: parsed.data.naoLidas, updatedAt: new Date() })
        .where(eq(leads.id, contato.leadId));
    }

    return NextResponse.json({ contato: updated });
  }

  // User assignment flow
  const targetUserId = parsed.data.usuarioId || ctx.userId;

  // Non-admin can only self-assign
  const isAdmin = ctx.userRole === "admin" || ctx.userRole === "super_admin" || ctx.userRole === "gerente";
  if (!isAdmin && targetUserId !== ctx.userId) {
    return forbiddenResponse();
  }

  // Validate target user exists and belongs to org
  const [targetUser] = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.id, targetUserId), eq(usuarios.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  // Update responsavelId (and naoLidas if provided)
  const [updated] = await db
    .update(contatos)
    .set({
      responsavelId: targetUserId,
      ...(parsed.data.naoLidas !== undefined && { naoLidas: parsed.data.naoLidas }),
      updatedAt: new Date(),
    })
    .where(eq(contatos.id, id))
    .returning();

  return NextResponse.json({ contato: updated });
}
