import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contatos, leads, whatsappSessao } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { downloadAndSaveAvatar, sessionToConfig } from "@/lib/whatsapp/client";

// POST /api/leads/:id/iniciar-whatsapp
// Creates a WhatsApp contato for the lead if one doesn't exist, returns contatoId
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  // Fetch lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  if (!lead.telefone) {
    return NextResponse.json({ error: "Lead sem telefone cadastrado" }, { status: 400 });
  }

  // Check if contato already exists for this lead
  const [existing] = await db
    .select({ id: contatos.id })
    .from(contatos)
    .where(and(eq(contatos.leadId, id), eq(contatos.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (existing) {
    return NextResponse.json({ contatoId: existing.id });
  }

  // Find default WhatsApp session
  const sessions = await db
    .select()
    .from(whatsappSessao)
    .where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId));

  const session =
    sessions.find((s) => s.isDefault && s.status === "connected") ||
    sessions.find((s) => s.status === "connected");

  if (!session) {
    return NextResponse.json({ error: "Nenhuma sessão WhatsApp conectada" }, { status: 400 });
  }

  // Clean phone number (remove formatting)
  const phone = lead.telefone.replace(/\D/g, "");

  // Create contato immediately (don't block on avatar download)
  const [newContato] = await db
    .insert(contatos)
    .values({
      organizacaoId: ctx.organizacaoId,
      canal: "whatsapp",
      nome: lead.nome,
      telefone: phone,
      email: lead.email,
      sessaoId: session.id,
      responsavelId: lead.responsavelId || ctx.userId,
      leadId: lead.id,
    })
    .returning();

  // Download avatar in background (fire-and-forget, don't block response)
  const config = sessionToConfig(session);
  downloadAndSaveAvatar(phone, config)
    .then(async (avatarUrl) => {
      if (avatarUrl) {
        await Promise.all([
          db.update(contatos).set({ avatarUrl }).where(eq(contatos.id, newContato.id)),
          !lead.avatarUrl ? db.update(leads).set({ avatarUrl }).where(eq(leads.id, id)) : Promise.resolve(),
        ]);
      }
    })
    .catch(() => { /* best-effort */ });

  return NextResponse.json({ contatoId: newContato.id }, { status: 201 });
}
