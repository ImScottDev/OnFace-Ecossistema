import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../lib/db";
import { sdrMemory } from "../../lib/db/schema";
import { getCtx } from "../compat";

const router = new Hono();

// GET /api/sdr/memory/:phone — get conversation history
router.get("/memory/:phone", async (c) => {
  const phone = c.req.param("phone");
  const ctx = await getCtx(c);
  const organizacaoId = ctx.organizacaoId;
  const limit = parseInt(c.req.query("limit") || "20");

  const messages = await db
    .select()
    .from(sdrMemory)
    .where(and(eq(sdrMemory.phone, phone), eq(sdrMemory.organizacaoId, organizacaoId)))
    .orderBy(desc(sdrMemory.createdAt))
    .limit(limit);

  return c.json({ messages: messages.reverse() });
});

// POST /api/sdr/memory/:phone — append message
router.post("/memory/:phone", async (c) => {
  const phone = c.req.param("phone");
  const ctx = await getCtx(c);
  const organizacaoId = ctx.organizacaoId;
  const body = await c.req.json();
  const { role, content, metadata } = body;

  if (!role || !content) {
    return c.json({ error: "role and content are required" }, 400);
  }

  const [msg] = await db
    .insert(sdrMemory)
    .values({ organizacaoId, phone, role, content, metadata: metadata || {} })
    .returning();

  return c.json({ message: msg });
});

// DELETE /api/sdr/memory/:phone — clear memory
router.delete("/memory/:phone", async (c) => {
  const phone = c.req.param("phone");
  const ctx = await getCtx(c);
  const organizacaoId = ctx.organizacaoId;

  await db
    .delete(sdrMemory)
    .where(and(eq(sdrMemory.phone, phone), eq(sdrMemory.organizacaoId, organizacaoId)));

  return c.json({ ok: true });
});

export default router;
