import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { eq, and, inArray, isNull, isNotNull } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { enrichmentQueue } from "@/lib/queue";

// POST /api/leads/enrich-bulk — enqueue bulk lead enrichment
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  if (ctx.userRole !== "admin" && ctx.userRole !== "super_admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const { filter, ids } = body as { filter?: "all" | "pending" | "re-enrich" | "selected"; ids?: string[] };

  let targetIds: string[];

  if (filter === "selected" && ids?.length) {
    targetIds = ids;
  } else {
    const conditions = [eq(leads.organizacaoId, ctx.organizacaoId)];
    if (filter === "pending") {
      conditions.push(inArray(leads.enrichStatus, ["pending", "error"]));
    } else if (filter === "re-enrich") {
      // Re-enrich leads that were enriched but missing new fields (from old worker code)
      conditions.push(eq(leads.enrichStatus, "enriched"));
      conditions.push(isNotNull(leads.apolloId));
      conditions.push(isNull(leads.apolloCity));
    }

    const rows = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(...conditions));

    targetIds = rows.map((r) => r.id);
  }

  if (targetIds.length === 0) {
    return NextResponse.json({ error: "Nenhum lead para enriquecer" }, { status: 400 });
  }

  const job = await enrichmentQueue.add("enrich-leads", {
    type: "leads",
    ids: targetIds,
    organizacaoId: ctx.organizacaoId,
  });

  return NextResponse.json({ jobId: job.id, total: targetIds.length });
}
