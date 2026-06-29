import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contatos, leads, whatsappSessao } from "@/lib/db/schema";
import { eq, and, isNull, ne, like } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { phoneLikePattern } from "@/lib/whatsapp/phone-utils";
import { downloadAndSaveAvatar, sessionToConfig } from "@/lib/whatsapp/client";

// POST /api/contatos/:id/criar-lead — create lead from contato + propagate
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

  if (contato.leadId) {
    return NextResponse.json({ error: "Contato já possui lead vinculado" }, { status: 400 });
  }

  // Fetch and persist WhatsApp avatar if available
  let avatarUrl: string | null = null;
  if (contato.canal === "whatsapp" && contato.telefone) {
    try {
      const sessions = await db
        .select()
        .from(whatsappSessao)
        .where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId));
      const session =
        sessions.find((s) => s.isDefault && s.status === "connected") ||
        sessions.find((s) => s.status === "connected");
      if (session) {
        const url = await downloadAndSaveAvatar(contato.telefone, sessionToConfig(session));
        if (url) avatarUrl = url;
      }
    } catch {
      // Avatar fetch is best-effort, don't block lead creation
    }
  }

  // Create lead from contato data
  const [newLead] = await db
    .insert(leads)
    .values({
      organizacaoId: ctx.organizacaoId,
      nome: contato.nome,
      telefone: contato.telefone,
      email: contato.email,
      origem: contato.canal === "whatsapp" ? "whatsapp" : "email",
      responsavelId: contato.responsavelId || ctx.userId,
      avatarUrl,
    })
    .returning();

  // Link this contato to the new lead (update name if lead was renamed, save avatar)
  await db
    .update(contatos)
    .set({
      leadId: newLead.id,
      ...(avatarUrl && !contato.avatarUrl ? { avatarUrl } : {}),
      ...(newLead.nome !== contato.nome ? { nome: newLead.nome } : {}),
      updatedAt: new Date(),
    })
    .where(eq(contatos.id, id));

  // Propagation: find other contatos in same org with same phone or email
  await propagateLeadId(ctx.organizacaoId, id, newLead.id, contato.telefone, contato.email);

  return NextResponse.json({ lead: newLead, contatoId: id }, { status: 201 });
}

async function propagateLeadId(
  organizacaoId: string,
  excludeContatoId: string,
  leadId: string,
  telefone: string | null,
  email: string | null,
) {
  // Propagate by phone (WhatsApp contatos with matching phone)
  if (telefone) {
    const pattern = phoneLikePattern(telefone);
    await db
      .update(contatos)
      .set({ leadId, updatedAt: new Date() })
      .where(
        and(
          eq(contatos.organizacaoId, organizacaoId),
          ne(contatos.id, excludeContatoId),
          isNull(contatos.leadId),
          like(contatos.telefone, pattern),
        )
      );
  }

  // Propagate by email (email contatos with matching email)
  if (email) {
    await db
      .update(contatos)
      .set({ leadId, updatedAt: new Date() })
      .where(
        and(
          eq(contatos.organizacaoId, organizacaoId),
          ne(contatos.id, excludeContatoId),
          isNull(contatos.leadId),
          eq(contatos.email, email),
        )
      );
  }
}
