import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { whatsappSessao, whatsappMensagens } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { reactToMessage, markRead, setPresence, deleteMessage, sessionToConfig } from "@/lib/whatsapp/client";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("react"),
    phone: z.string().min(1),
    messageId: z.string().min(1),
    emoji: z.string().min(1),
    sessaoId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("markread"),
    messageIds: z.array(z.string().min(1)),
    chatPhone: z.string().min(1),
    sessaoId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("presence"),
    phone: z.string().min(1),
    state: z.enum(["composing", "paused"]),
    media: z.enum(["audio"]).optional(),
    sessaoId: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("delete"),
    phone: z.string().min(1),
    messageId: z.string().min(1),
    sessaoId: z.string().uuid().optional(),
  }),
]);

export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const body = await request.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados invalidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Resolve session config
  const sessaoId = "sessaoId" in data ? data.sessaoId : undefined;
  let config = undefined;
  if (sessaoId) {
    const [sessao] = await db.select({ apiToken: whatsappSessao.apiToken })
      .from(whatsappSessao)
      .where(and(eq(whatsappSessao.id, sessaoId), eq(whatsappSessao.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (sessao) config = sessionToConfig(sessao);
  } else {
    const [sessao] = await db.select({ apiToken: whatsappSessao.apiToken })
      .from(whatsappSessao)
      .where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId))
      .limit(1);
    if (sessao) config = sessionToConfig(sessao);
  }

  try {
    switch (data.action) {
      case "react":
        await reactToMessage(data.phone, data.messageId, data.emoji, config);
        // Save our reaction to DB
        await db.execute(sql`
          UPDATE whatsapp_mensagens
          SET reactions = (
            SELECT jsonb_agg(r)
            FROM (
              SELECT * FROM jsonb_array_elements(COALESCE(reactions, '[]'::jsonb)) r
              WHERE r->>'sender' != 'me'
              UNION ALL
              SELECT ${JSON.stringify({ emoji: data.emoji, sender: "me" })}::jsonb
            ) sub
          )
          WHERE uazapi_message_id = ${data.messageId}
        `);
        return NextResponse.json({ ok: true, emoji: data.emoji });
      case "markread":
        await markRead(data.messageIds, data.chatPhone, config);
        return NextResponse.json({ ok: true });
      case "presence":
        await setPresence(data.phone, data.state, data.media, config);
        return NextResponse.json({ ok: true });
      case "delete":
        await deleteMessage(data.phone, data.messageId, config);
        return NextResponse.json({ ok: true });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
