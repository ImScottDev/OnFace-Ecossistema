import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { propostas } from "@/lib/db/schema";
import { eq, and, inArray, count } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// GET /api/propostas/count — open proposals count for sidebar badge
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const [result] = await db
    .select({ count: count() })
    .from(propostas)
    .where(
      and(
        eq(propostas.organizacaoId, ctx.organizacaoId),
        inArray(propostas.status, ["rascunho", "enviada"])
      )
    );

  return NextResponse.json({ count: result?.count ?? 0 });
}
