import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { empresas } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { enrichmentQueue } from "@/lib/queue";

// POST /api/empresas/enrich-bulk — enqueue bulk empresa enrichment
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  if (ctx.userRole !== "admin" && ctx.userRole !== "super_admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const { filter, ids } = body as { filter?: "all" | "pending" | "selected"; ids?: string[] };

  let targetIds: string[];

  if (filter === "selected" && ids?.length) {
    targetIds = ids;
  } else {
    const conditions = [eq(empresas.organizacaoId, ctx.organizacaoId)];
    if (filter === "pending") {
      conditions.push(inArray(empresas.enrichStatus, ["pending", "error"]));
    }

    const rows = await db
      .select({ id: empresas.id })
      .from(empresas)
      .where(and(...conditions));

    targetIds = rows.map((r) => r.id);
  }

  if (targetIds.length === 0) {
    return NextResponse.json({ error: "Nenhuma empresa para enriquecer" }, { status: 400 });
  }

  const job = await enrichmentQueue.add("enrich-empresas", {
    type: "empresas",
    ids: targetIds,
    organizacaoId: ctx.organizacaoId,
  });

  return NextResponse.json({ jobId: job.id, total: targetIds.length });
}
