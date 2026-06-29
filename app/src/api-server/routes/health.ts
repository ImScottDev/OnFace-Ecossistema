import { Hono } from "hono";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const app = new Hono();

app.get("/health", async (c) => {
  try {
    await db.execute(sql`SELECT 1`);
    return c.json({ status: "ok", timestamp: new Date().toISOString(), db: "connected" });
  } catch (error) {
    return c.json({ status: "degraded", timestamp: new Date().toISOString(), db: "error", error: error instanceof Error ? error.message : "unknown" }, 503);
  }
});

export const healthRoutes = app;
