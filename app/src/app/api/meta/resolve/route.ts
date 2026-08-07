import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

/**
 * Resolve IDs de campanha/anúncio/conjunto do Meta para nomes legíveis.
 * Os anúncios da campanha de LP mandam os UTMs com {{campaign.id}}/{{ad.id}}/{{adset.id}}
 * (números). Este endpoint troca o número pelo nome via Marketing API, com cache em memória
 * (os nomes mudam raramente). Falha graciosa: se não resolver, o front mostra o próprio id.
 *
 * GET /api/meta/resolve?ids=120...,120...  ->  { names: { "120...": "TRT | LP | Leads" } }
 */
const cache = new Map<string, { name: string; at: number }>();
const TTL = 1000 * 60 * 60 * 12; // 12h
const TOKEN = process.env.META_ACCESS_TOKEN || "";
const VERSION = process.env.META_API_VERSION || "v21.0";

const isMetaId = (s: string) => /^\d{8,}$/.test(s);

export async function GET(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const idsParam = req.nextUrl.searchParams.get("ids") || "";
  const ids = [
    ...new Set(idsParam.split(",").map((s) => s.trim()).filter(isMetaId)),
  ].slice(0, 30);

  const names: Record<string, string> = {};
  const now = Date.now();
  const toFetch: string[] = [];

  for (const id of ids) {
    const c = cache.get(id);
    if (c && now - c.at < TTL) names[id] = c.name;
    else toFetch.push(id);
  }

  if (toFetch.length && TOKEN) {
    await Promise.all(
      toFetch.map(async (id) => {
        try {
          const r = await fetch(
            `https://graph.facebook.com/${VERSION}/${id}?fields=name&access_token=${encodeURIComponent(TOKEN)}`
          );
          const d = await r.json();
          if (d && typeof d.name === "string" && d.name) {
            cache.set(id, { name: d.name, at: now });
            names[id] = d.name;
          }
        } catch {
          /* ignora: o front cai no fallback (mostra o id) */
        }
      })
    );
  }

  return NextResponse.json({ names });
}
