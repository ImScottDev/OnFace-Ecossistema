import { Hono } from "hono";

const app = new Hono();

// Auth is handled by Next.js via NextAuth (next-auth v5).
// NextAuth requires tight integration with Next.js internals (cookies, headers, redirects)
// that cannot be cleanly replicated in Hono. Auth routes (/api/auth/*) remain on Next.js.
// This stub exists so the route registry is complete.

app.all("/*", (c) => {
  return c.json(
    { error: "Auth routes are handled by Next.js. This endpoint should not be reached via the Hono server." },
    404
  );
});

export const authRoutes = app;
