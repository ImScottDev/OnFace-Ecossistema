/**
 * Compatibility helpers for converting Next.js API routes to Hono.
 * Provides familiar patterns so route conversion is mechanical.
 */
import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { getTenantFromRequest, TenantContext } from "./auth.js";

// Get tenant context or throw (returns 401 via error handler)
export async function getCtx(c: Context): Promise<TenantContext> {
  const ctx = await getTenantFromRequest(c);
  if (!ctx) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  return ctx;
}

// Get super admin context or throw 403
export async function getSuperCtx(c: Context): Promise<TenantContext> {
  const ctx = await getCtx(c);
  if (ctx.userRole !== "super_admin") {
    throw new HTTPException(403, { message: "Forbidden" });
  }
  return ctx;
}

// Get query params from Hono context (replaces `new URL(request.url).searchParams`)
export function qp(c: Context, key: string): string | null {
  return c.req.query(key) ?? null;
}

// Parse JSON body safely
export async function parseBody<T = unknown>(c: Context): Promise<T> {
  try {
    return await c.req.json<T>();
  } catch {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }
}

// Custom HTTP error class
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Global error handler for Hono app
export function errorHandler(err: unknown, c: Context) {
  // Handle Hono HTTPException
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status as 400);
  }
  // Handle HttpError
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status as 400);
  }
  // Handle plain object throws { status, message }
  if (err && typeof err === "object" && "status" in err) {
    const e = err as { status: number; message: string };
    return c.json({ error: e.message }, e.status as 400);
  }
  console.error("[API Error]", err);
  return c.json({ error: "Internal server error" }, 500);
}
