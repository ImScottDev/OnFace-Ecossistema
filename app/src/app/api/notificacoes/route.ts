import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificacoes } from "@/lib/db/schema";
import { desc, eq, and, SQL } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// GET /api/notificacoes
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const lida = searchParams.get("lida");

  const conditions: SQL[] = [eq(notificacoes.usuarioId, ctx.userId)];

  if (lida !== null && lida !== "") {
    conditions.push(eq(notificacoes.lida, lida === "true"));
  }

  const where = and(...conditions);

  const result = await db
    .select()
    .from(notificacoes)
    .where(where)
    .orderBy(desc(notificacoes.createdAt))
    .limit(100);

  return NextResponse.json({ notificacoes: result });
}
