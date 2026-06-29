import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { enrichmentQueue } from "@/lib/queue";

// GET /api/enrichment/status?jobId=123
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = await enrichmentQueue.getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const state = await job.getState();
  const progress = job.progress as number;
  const data = job.data as Record<string, unknown>;
  const result = job.returnvalue as Record<string, unknown> | null;

  return NextResponse.json({
    jobId: job.id,
    state,
    progress,
    total: data.ids ? (data.ids as string[]).length : 0,
    processed: data.processed || 0,
    enriched: result?.enriched ?? data.enriched ?? 0,
    notFound: result?.notFound ?? data.notFound ?? 0,
    errors: result?.errors ?? data.errors ?? 0,
    type: data.type,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason,
  });
}
