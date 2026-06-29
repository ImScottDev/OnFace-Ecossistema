import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { negocios } from "@/lib/db/schema";
import { eq, count, and, notInArray } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// GET /api/negocios/count — count by status
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const orgFilter = eq(negocios.organizacaoId, ctx.organizacaoId);

  const [byStatus, totalActive] = await Promise.all([
    db
      .select({ status: negocios.status, count: count() })
      .from(negocios)
      .where(orgFilter)
      .groupBy(negocios.status),
    db
      .select({ count: count() })
      .from(negocios)
      .where(and(orgFilter, notInArray(negocios.status, ["ganho", "perdido", "ativo", "churned"]))),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of byStatus) {
    statusCounts[row.status] = Number(row.count);
  }

  return NextResponse.json({
    byStatus: statusCounts,
    pipeline: Number(totalActive[0].count), // active in pipeline (not won/lost/active/churned)
    total: byStatus.reduce((sum, r) => sum + Number(r.count), 0),
  });
}
