import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contatos } from "@/lib/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// GET /api/whatsapp/unread-count — total unread WhatsApp messages for the current user
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const viewAs = request.nextUrl.searchParams.get("viewAs");
  const isAdmin = ctx.userRole === "admin" || ctx.userRole === "super_admin";

  // Determine which user's unread to count
  const targetUserId = (viewAs && isAdmin) ? viewAs : ctx.userId;

  const [result] = await db
    .select({
      count: sql<number>`COALESCE(SUM(${contatos.naoLidas}), 0)`,
    })
    .from(contatos)
    .where(and(
      eq(contatos.organizacaoId, ctx.organizacaoId),
      eq(contatos.responsavelId, targetUserId),
      eq(contatos.canal, "whatsapp"),
    ));

  return NextResponse.json({ count: Number(result.count) });
}
