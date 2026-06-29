import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contatos, leads } from "@/lib/db/schema";
import { eq, and, isNull, ne, like } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { phoneLikePattern } from "@/lib/whatsapp/phone-utils";

const vincularSchema = z.object({
  leadId: z.string().uuid(),
});

// POST /api/contatos/:id/vincular-lead — link contato to existing lead + propagate
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const parsed = vincularSchema.safeParse(body);

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

  // Validate lead exists and belongs to org
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, parsed.data.leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  // Link contato to lead — also update name if contato name is just a phone number
  const isPhoneOnly = /^[\d+\s()-]+$/.test(contato.nome);
  const [updated] = await db
    .update(contatos)
    .set({
      leadId: lead.id,
      ...(isPhoneOnly && lead.nome ? { nome: lead.nome } : {}),
      updatedAt: new Date(),
    })
    .where(eq(contatos.id, id))
    .returning();

  // Propagation: find other contatos in same org with same phone or email
  if (contato.telefone) {
    const pattern = phoneLikePattern(contato.telefone);
    await db
      .update(contatos)
      .set({ leadId: lead.id, updatedAt: new Date() })
      .where(
        and(
          eq(contatos.organizacaoId, ctx.organizacaoId),
          ne(contatos.id, id),
          isNull(contatos.leadId),
          like(contatos.telefone, pattern),
        )
      );
  }

  if (contato.email) {
    await db
      .update(contatos)
      .set({ leadId: lead.id, updatedAt: new Date() })
      .where(
        and(
          eq(contatos.organizacaoId, ctx.organizacaoId),
          ne(contatos.id, id),
          isNull(contatos.leadId),
          eq(contatos.email, contato.email),
        )
      );
  }

  return NextResponse.json({ contato: updated });
}
