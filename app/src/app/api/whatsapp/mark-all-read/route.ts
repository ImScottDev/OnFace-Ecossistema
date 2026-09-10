import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, contatos } from "@/lib/db/schema";
import { eq, and, gte, or, isNull } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { veTodasAsConversas } from "@/lib/whatsapp/acesso";

// POST /api/whatsapp/mark-all-read — mark all conversations as read
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  // Zero unread count on both contatos and leads
  const [leadsResult, contatosResult] = await Promise.all([
    db
      .update(leads)
      .set({ whatsappNaoLidas: 0, updatedAt: new Date() })
      .where(and(
        eq(leads.organizacaoId, ctx.organizacaoId),
        gte(leads.whatsappNaoLidas, 1),
        ...(veTodasAsConversas(ctx)
          ? []
          : [or(eq(leads.responsavelId, ctx.userId), isNull(leads.responsavelId))!]),
      ))
      .returning({ id: leads.id }),
    db
      .update(contatos)
      .set({ naoLidas: 0, updatedAt: new Date() })
      // Escopo do próprio usuário: antes isto zerava o inbox da organização
      // inteira, apagando o "não lido" de todo mundo.
      .where(and(
        eq(contatos.organizacaoId, ctx.organizacaoId),
        gte(contatos.naoLidas, 1),
        ...(veTodasAsConversas(ctx)
          ? []
          : [or(eq(contatos.responsavelId, ctx.userId), isNull(contatos.responsavelId))!]),
      ))
      .returning({ id: contatos.id }),
  ]);

  return NextResponse.json({ updated: leadsResult.length + contatosResult.length });
}
