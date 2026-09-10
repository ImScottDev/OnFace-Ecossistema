import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contatos, leads, empresas, negocios, leadLabels } from "@/lib/db/schema";
import { eq, and, sql, isNull, ilike, or, inArray, SQL } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { veTodasAsConversas } from "@/lib/whatsapp/acesso";

/**
 * GET /api/whatsapp/conversations
 *
 * Lists WhatsApp conversations from the `contatos` table (canal='whatsapp'),
 * with LEFT JOINs to leads, empresas, negocios for enriched data.
 *
 * Params:
 *   cursor    - "timestamp|uuid" for pagination
 *   limit     - number (default 30, max 100)
 *   search    - search nome/telefone
 *   unread    - "1" to filter only unread
 *   labelIds  - comma-separated label IDs (filters via linked lead's labels)
 *   view      - "meus" (default) | "nao_atribuidos" | "todos" (admin only)
 *   viewAs    - admin: view another user's inbox
 */
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
  const search = searchParams.get("search");
  const unread = searchParams.get("unread");
  const labelIds = searchParams.get("labelIds");
  const view = searchParams.get("view") || "meus";
  const viewAs = searchParams.get("viewAs");

  // Só super_admin vê conversa alheia: as sessões são WhatsApps pessoais do
  // time. Admin/gerente ficam com a própria caixa, como closer e sdr.
  const isAdmin = veTodasAsConversas(ctx);
  const effectiveUserId = (isAdmin && viewAs) ? viewAs : ctx.userId;

  // --- Build conditions ---
  const conditions: SQL[] = [
    eq(contatos.organizacaoId, ctx.organizacaoId),
    eq(contatos.canal, "whatsapp"),
  ];

  // View filter
  if (view === "nao_atribuidos") {
    conditions.push(isNull(contatos.responsavelId));
  } else if (view === "todos") {
    if (!isAdmin) {
      // Non-admins fall back to "meus"
      conditions.push(
        or(
          eq(contatos.responsavelId, effectiveUserId),
          isNull(contatos.responsavelId),
        )!
      );
    }
    // Admins see everything — no extra filter
  } else {
    // "meus" (default): assigned to me OR unassigned
    conditions.push(
      or(
        eq(contatos.responsavelId, effectiveUserId),
        isNull(contatos.responsavelId),
      )!
    );
  }

  // Search filter (nome/telefone on contato)
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(contatos.nome, pattern),
        ilike(contatos.telefone, pattern),
      )!
    );
  }

  // Label filter (via linked lead's labels)
  if (labelIds) {
    const ids = labelIds.split(",").map(id => id.trim()).filter(Boolean);
    if (ids.length > 0) {
      const labelMatches = await db
        .select({ leadId: leadLabels.leadId })
        .from(leadLabels)
        .where(inArray(leadLabels.labelId, ids))
        .groupBy(leadLabels.leadId);
      const matchedLeadIds = labelMatches.filter(m => m.leadId).map(m => m.leadId!);
      if (matchedLeadIds.length === 0) {
        return NextResponse.json({ conversations: [], nextCursor: null, totalUnread: 0 });
      }
      conditions.push(inArray(contatos.leadId, matchedLeadIds));
    }
  }

  // Cursor pagination: (ultimaMsgAt, id) < (cursorTs, cursorId)
  if (cursor) {
    const [cursorTs, cursorId] = cursor.split("|");
    if (cursorTs && cursorId) {
      conditions.push(
        sql`(${contatos.ultimaMsgAt}, ${contatos.id}) < (${cursorTs}::timestamptz, ${cursorId}::uuid)`
      );
    }
  }

  const where = and(...conditions);

  // --- Query with LEFT JOINs ---
  const rows = await db
    .select({
      // Contato fields
      id: contatos.id,
      nome: contatos.nome,
      telefone: contatos.telefone,
      email: contatos.email,
      canal: contatos.canal,
      avatarUrl: contatos.avatarUrl,
      leadId: contatos.leadId,
      ultimaMsg: contatos.ultimaMsg,
      ultimaMsgAt: contatos.ultimaMsgAt,
      naoLidas: contatos.naoLidas,
      responsavelId: contatos.responsavelId,
      createdAt: contatos.createdAt,
      // Lead fields (nullable)
      leadNome: leads.nome,
      leadStatus: leads.status,
      empresaId: leads.empresaId,
      negocioAtivoId: leads.negocioAtivoId,
      // Empresa fields (nullable)
      empresaNome: empresas.nome,
      // Negocio fields (nullable)
      negocioTitulo: negocios.titulo,
      negocioStatus: negocios.status,
    })
    .from(contatos)
    .leftJoin(leads, eq(contatos.leadId, leads.id))
    .leftJoin(empresas, eq(leads.empresaId, empresas.id))
    .leftJoin(negocios, eq(leads.negocioAtivoId, negocios.id))
    .where(where)
    .orderBy(sql`${contatos.ultimaMsgAt} DESC NULLS LAST, ${contatos.id} DESC`)
    .limit(limit + 1);

  // Map rows to response shape
  let filtered = rows.map(r => ({
    id: r.id,
    nome: r.nome,
    telefone: r.telefone,
    email: r.email,
    canal: r.canal,
    avatarUrl: r.avatarUrl,
    leadId: r.leadId,
    leadNome: r.leadNome ?? null,
    leadStatus: r.leadStatus ?? null,
    empresaId: r.empresaId ?? null,
    empresaNome: r.empresaNome ?? null,
    negocioAtivoId: r.negocioAtivoId ?? null,
    negocioTitulo: r.negocioTitulo ?? null,
    negocioStatus: r.negocioStatus ?? null,
    ultimaMsg: r.ultimaMsg,
    ultimaMsgAt: r.ultimaMsgAt,
    naoLidas: r.naoLidas ?? 0,
    responsavelId: r.responsavelId,
    createdAt: r.createdAt,
  }));

  // Unread filter (post-query)
  if (unread === "1") {
    filtered = filtered.filter(r => r.naoLidas > 0);
  }

  // Pagination
  const hasMore = filtered.length > limit;
  const conversations = filtered.slice(0, limit);
  let nextCursor: string | null = null;
  if (hasMore && conversations.length > 0) {
    const last = conversations[conversations.length - 1];
    nextCursor = `${last.ultimaMsgAt}|${last.id}`;
  }

  // Total unread (across all whatsapp contatos for this org + view)
  const unreadConditions: SQL[] = [
    eq(contatos.organizacaoId, ctx.organizacaoId),
    eq(contatos.canal, "whatsapp"),
  ];

  // Apply same view filter for unread total
  if (view === "nao_atribuidos") {
    unreadConditions.push(isNull(contatos.responsavelId));
  } else if (view === "todos" && isAdmin) {
    // No extra filter
  } else {
    unreadConditions.push(
      or(
        eq(contatos.responsavelId, effectiveUserId),
        isNull(contatos.responsavelId),
      )!
    );
  }

  const [unreadResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${contatos.naoLidas}), 0)`,
    })
    .from(contatos)
    .where(and(...unreadConditions));

  return NextResponse.json({
    conversations,
    nextCursor,
    totalUnread: Number(unreadResult?.total ?? 0),
  });
}
