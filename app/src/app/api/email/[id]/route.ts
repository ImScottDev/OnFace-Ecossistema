import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emails, leads, leadUserUnread } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const updateSchema = z.object({
  lido: z.boolean().optional(),
  leadId: z.string().uuid().nullable().optional(),
});

// GET /api/email/:id — get single email
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  const [email] = await db.select()
    .from(emails)
    .where(and(eq(emails.id, id), eq(emails.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!email) return NextResponse.json({ error: "Email não encontrado" }, { status: 404 });
  return NextResponse.json(email);
}

// PATCH /api/email/:id — update email (mark read/unread, assign lead)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const [updated] = await db.update(emails)
      .set(data)
      .where(and(eq(emails.id, id), eq(emails.organizacaoId, ctx.organizacaoId)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Email não encontrado" }, { status: 404 });

    // Update unread counts if marking read/unread
    if (data.lido !== undefined && updated.leadId) {
      // Update legacy leads.emailNaoLidos (backward compat)
      if (data.lido) {
        await db.update(leads).set({
          emailNaoLidos: sql`GREATEST(COALESCE(email_nao_lidos, 0) - 1, 0)`,
        }).where(eq(leads.id, updated.leadId));
      } else {
        await db.update(leads).set({
          emailNaoLidos: sql`COALESCE(email_nao_lidos, 0) + 1`,
        }).where(eq(leads.id, updated.leadId));
      }

      // Update per-user unread count in leadUserUnread
      if (data.lido) {
        // Marking as read: decrement for current user
        await db.execute(sql`
          INSERT INTO lead_user_unread (id, lead_id, usuario_id, whatsapp_nao_lidas, email_nao_lidos)
          VALUES (gen_random_uuid(), ${updated.leadId}, ${ctx.userId}, 0, 0)
          ON CONFLICT (lead_id, usuario_id)
          DO UPDATE SET email_nao_lidos = GREATEST(lead_user_unread.email_nao_lidos - 1, 0)
        `);
      } else {
        // Marking as unread: increment for current user
        await db.execute(sql`
          INSERT INTO lead_user_unread (id, lead_id, usuario_id, whatsapp_nao_lidas, email_nao_lidos)
          VALUES (gen_random_uuid(), ${updated.leadId}, ${ctx.userId}, 0, 1)
          ON CONFLICT (lead_id, usuario_id)
          DO UPDATE SET email_nao_lidos = lead_user_unread.email_nao_lidos + 1
        `);
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
