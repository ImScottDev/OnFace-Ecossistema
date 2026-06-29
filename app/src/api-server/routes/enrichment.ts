import { Hono } from "hono";
import { getCtx } from "../compat.js";
import { enrichmentQueue } from "@/lib/queue";

const app = new Hono();

// GET /enrichment/status?jobId=123
app.get("/status", async (c) => {
  await getCtx(c);

  const jobId = c.req.query("jobId") ?? null;
  if (!jobId) {
    return c.json({ error: "jobId required" }, 400);
  }

  const job = await enrichmentQueue.getJob(jobId);

  if (!job) {
    return c.json({ error: "Job not found" }, 404);
  }

  const state = await job.getState();
  const progress = job.progress as number;
  const data = job.data as Record<string, unknown>;
  const result = job.returnvalue as Record<string, unknown> | null;

  return c.json({
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
});

export const enrichmentRoutes = app;
