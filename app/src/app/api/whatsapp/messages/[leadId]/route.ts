import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, contatos, whatsappMensagens, whatsappSessao, usuarios, leadUserUnread } from "@/lib/db/schema";
import { eq, desc, count, and, inArray, sql, or } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// GET /api/whatsapp/messages/:id — list messages for a contato OR lead
// The :id param can be either a contatoId or a leadId (backward compat)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { leadId: idParam } = await params;

  // Try to find as contato first, then as lead
  let contatoId: string | null = null;
  let leadId: string | null = null;

  const [contatoRow] = await db
    .select({ id: contatos.id, leadId: contatos.leadId })
    .from(contatos)
    .where(and(eq(contatos.id, idParam), eq(contatos.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (contatoRow) {
    contatoId = contatoRow.id;
    leadId = contatoRow.leadId;
  } else {
    // Fallback: try as leadId
    const [leadRow] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, idParam), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!leadRow) {
      return NextResponse.json({ error: "Contato ou lead nao encontrado" }, { status: 404 });
    }
    leadId = leadRow.id;
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  // Build where condition: by contatoId if available, otherwise by leadId
  // If we have a leadId (from lead detail page), fetch ALL messages from all contatos linked to this lead
  const whereCondition = contatoId
    ? eq(whatsappMensagens.contatoId, contatoId)
    : leadId
      ? or(
          eq(whatsappMensagens.leadId, leadId),
          // Also include messages from contatos linked to this lead
          sql`${whatsappMensagens.contatoId} IN (SELECT id FROM contatos WHERE lead_id = ${leadId})`
        )!
      : eq(whatsappMensagens.leadId, idParam); // shouldn't happen

  const [messages, totalResult] = await Promise.all([
    db
      .select()
      .from(whatsappMensagens)
      .where(whereCondition)
      .orderBy(desc(whatsappMensagens.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: count() })
      .from(whatsappMensagens)
      .where(whereCondition),
  ]);

  // Enrich with session/sender names
  const sessaoIds = [...new Set(messages.map(m => m.sessaoId).filter(Boolean))] as string[];
  const senderIds = [...new Set(messages.map(m => m.enviadoPorId).filter(Boolean))] as string[];

  const sessaoMap = new Map<string, { usuarioId: string | null; usuarioNome: string | null }>();
  if (sessaoIds.length > 0) {
    const sessoes = await db
      .select({ id: whatsappSessao.id, usuarioId: whatsappSessao.usuarioId })
      .from(whatsappSessao)
      .where(inArray(whatsappSessao.id, sessaoIds));

    const sessaoUserIds = [...new Set(sessoes.map(s => s.usuarioId).filter(Boolean))] as string[];
    const userNameMap = new Map<string, string>();
    if (sessaoUserIds.length > 0) {
      const userRows = await db
        .select({ id: usuarios.id, nome: usuarios.nome })
        .from(usuarios)
        .where(inArray(usuarios.id, sessaoUserIds));
      for (const u of userRows) userNameMap.set(u.id, u.nome);
    }
    for (const s of sessoes) {
      sessaoMap.set(s.id, {
        usuarioId: s.usuarioId,
        usuarioNome: s.usuarioId ? (userNameMap.get(s.usuarioId) || null) : null,
      });
    }
  }

  const senderNameMap = new Map<string, string>();
  if (senderIds.length > 0) {
    const senderRows = await db
      .select({ id: usuarios.id, nome: usuarios.nome })
      .from(usuarios)
      .where(inArray(usuarios.id, senderIds));
    for (const u of senderRows) senderNameMap.set(u.id, u.nome);
  }

  const enrichedMessages = messages.map(m => {
    const sessaoInfo = m.sessaoId ? sessaoMap.get(m.sessaoId) : null;
    return {
      ...m,
      sessaoUsuarioId: sessaoInfo?.usuarioId || null,
      sessaoUsuarioNome: sessaoInfo?.usuarioNome || null,
      enviadoPorNome: m.enviadoPorId ? (senderNameMap.get(m.enviadoPorId) || null) : null,
    };
  });

  // Reset unread count
  if (contatoId) {
    await db.update(contatos).set({ naoLidas: 0, updatedAt: new Date() }).where(eq(contatos.id, contatoId));
  }
  if (leadId) {
    await Promise.all([
      db.update(leads).set({ whatsappNaoLidas: 0, updatedAt: new Date() }).where(eq(leads.id, leadId)),
      db.execute(sql`
        INSERT INTO lead_user_unread (id, lead_id, usuario_id, whatsapp_nao_lidas, email_nao_lidos)
        VALUES (gen_random_uuid(), ${leadId}, ${ctx.userId}, 0, 0)
        ON CONFLICT (lead_id, usuario_id)
        DO UPDATE SET whatsapp_nao_lidas = 0
      `),
    ]);
  }

  return NextResponse.json({
    messages: enrichedMessages,
    total: Number(totalResult[0].count),
    page,
    limit,
  });
}
