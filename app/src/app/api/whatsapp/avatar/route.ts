import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { whatsappSessao, contatos } from "@/lib/db/schema";
import { eq, and, like } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { downloadAndSaveAvatar, sessionToConfig } from "@/lib/whatsapp/client";

// Simple in-memory cache: phone -> { url, timestamp }
const avatarCache = new Map<string, { url: string; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes (persisted avatars don't expire)

// GET /api/whatsapp/avatar?phone=5511999999999
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ url: "" });
  }

  // Check cache
  const cached = avatarCache.get(phone);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(
      { url: cached.url },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  }

  // Find the default (or first) connected session for this org
  const sessions = await db
    .select()
    .from(whatsappSessao)
    .where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId));

  const session =
    sessions.find((s) => s.isDefault && s.status === "connected") ||
    sessions.find((s) => s.status === "connected") ||
    sessions[0];

  if (!session) {
    return NextResponse.json({ url: "" });
  }

  const config = sessionToConfig(session);
  let url = await downloadAndSaveAvatar(phone, config);

  // If download failed, try DB fallback (contatos.avatarUrl)
  if (!url) {
    const cleanPhone = phone.replace(/\D/g, "");
    const last8 = cleanPhone.slice(-8);
    const [contato] = await db
      .select({ avatarUrl: contatos.avatarUrl })
      .from(contatos)
      .where(and(
        eq(contatos.organizacaoId, ctx.organizacaoId),
        like(contatos.telefone, `%${last8}`),
      ))
      .limit(1);
    if (contato?.avatarUrl) url = contato.avatarUrl;
  }

  // Store in cache
  avatarCache.set(phone, { url, ts: Date.now() });

  // Evict old entries if cache grows too large
  if (avatarCache.size > 500) {
    const now = Date.now();
    for (const [key, val] of avatarCache) {
      if (now - val.ts > CACHE_TTL) avatarCache.delete(key);
    }
  }

  return NextResponse.json(
    { url },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
