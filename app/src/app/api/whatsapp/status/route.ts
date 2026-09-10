import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { whatsappSessao, whatsappMensagens } from "@/lib/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { veTodasAsConversas } from "@/lib/whatsapp/acesso";
import { getStatus, createSession, disconnectSession, sessionToConfig, wuzapiCreateUser, wuzapiDeleteUser, wuzapiFindUser } from "@/lib/whatsapp/client";
import { randomBytes } from "crypto";

// GET /api/whatsapp/status?sessionId=...&viewAs=... — get status for one or all sessions
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const viewAs = request.nextUrl.searchParams.get("viewAs");

  // Determine the effective user ID for filtering
  // Só super_admin: mesma regra do inbox (sessões são WhatsApps pessoais).
  const isAdmin = veTodasAsConversas(ctx);
  let effectiveUserId: string | null = null;

  if (viewAs && isAdmin) {
    // Admin viewing as another user
    effectiveUserId = viewAs;
  } else if (!isAdmin) {
    // Non-admin: always filter to own sessions + shared
    effectiveUserId = ctx.userId;
  }
  // else: admin without viewAs → show ALL org sessions (effectiveUserId stays null)

  if (sessionId) {
    // Single session status
    const [sessao] = await db.select()
      .from(whatsappSessao)
      .where(and(eq(whatsappSessao.id, sessionId), eq(whatsappSessao.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!sessao) return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });

    // If filtering by user, verify access
    if (effectiveUserId && sessao.usuarioId !== null && sessao.usuarioId !== effectiveUserId) {
      return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
    }

    const config = sessionToConfig(sessao);
    let live = { connected: false, phone: "", status: "disconnected", qrCode: "" };
    try {
      live = await getStatus(config);
    } catch { /* wuzapi unreachable */ }

    // Sync status to DB
    if (live.connected && sessao.status !== "connected") {
      await db.update(whatsappSessao).set({
        status: "connected", phoneNumber: live.phone || null,
        qrCode: null, lastConnectedAt: new Date(), updatedAt: new Date(),
      }).where(eq(whatsappSessao.id, sessao.id));
    } else if (!live.connected && sessao.status === "connected") {
      await db.update(whatsappSessao).set({
        status: live.status, qrCode: live.qrCode || null, updatedAt: new Date(),
      }).where(eq(whatsappSessao.id, sessao.id));
    }

    return NextResponse.json({
      id: sessao.id,
      sessionName: sessao.sessionName,
      label: sessao.label,
      isDefault: sessao.isDefault,
      usuarioId: sessao.usuarioId,
      status: live.connected ? "connected" : live.status,
      phoneNumber: live.connected ? live.phone : sessao.phoneNumber,
      qrCode: live.connected ? null : live.qrCode || sessao.qrCode,
    });
  }

  // All sessions — filtered by effective user
  let sessions;
  if (effectiveUserId) {
    // Show user's own sessions + legacy shared sessions (usuarioId IS NULL)
    sessions = await db.select()
      .from(whatsappSessao)
      .where(and(
        eq(whatsappSessao.organizacaoId, ctx.organizacaoId),
        or(eq(whatsappSessao.usuarioId, effectiveUserId), isNull(whatsappSessao.usuarioId)),
      ));
  } else {
    // Admin without viewAs: show ALL org sessions
    sessions = await db.select()
      .from(whatsappSessao)
      .where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId));
  }

  // Check live status for each (in parallel)
  const results = await Promise.all(sessions.map(async (sessao) => {
    const config = sessionToConfig(sessao);
    let live = { connected: false, phone: "", status: "disconnected", qrCode: "" };
    try {
      live = await getStatus(config);
    } catch { /* */ }

    // Sync status to DB
    if (live.connected && sessao.status !== "connected") {
      await db.update(whatsappSessao).set({
        status: "connected", phoneNumber: live.phone || null,
        qrCode: null, lastConnectedAt: new Date(), updatedAt: new Date(),
      }).where(eq(whatsappSessao.id, sessao.id));
    } else if (!live.connected && sessao.status === "connected") {
      await db.update(whatsappSessao).set({
        status: live.status, qrCode: live.qrCode || null, updatedAt: new Date(),
      }).where(eq(whatsappSessao.id, sessao.id));
    }

    return {
      id: sessao.id,
      sessionName: sessao.sessionName,
      label: sessao.label,
      isDefault: sessao.isDefault,
      usuarioId: sessao.usuarioId,
      status: live.connected ? "connected" : live.status,
      phoneNumber: live.connected ? live.phone : sessao.phoneNumber,
      qrCode: live.connected ? null : live.qrCode || sessao.qrCode,
    };
  }));

  return NextResponse.json({ sessions: results });
}

// POST /api/whatsapp/status — connect/disconnect/create/delete/set-default
export async function POST(request: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const body = await request.json();
  const { action, sessionId, sessionName, label } = body as {
    action: string;
    sessionId?: string;
    sessionName?: string;
    label?: string;
  };

  // Create a new session
  if (action === "create") {
    if (!sessionName) return NextResponse.json({ error: "sessionName required" }, { status: 400 });

    // Generate unique token for this session
    const token = randomBytes(24).toString("hex");
    const webhookUrl = `${process.env.NEXTAUTH_URL || "http://mcrm-production:3000"}/api/whatsapp/webhook`;

    // Create user in wuzapi first
    try {
      await wuzapiCreateUser(sessionName, token, webhookUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create wuzapi session";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // Check if this is the first session for this org
    const existing = await db.select({ id: whatsappSessao.id })
      .from(whatsappSessao)
      .where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId))
      .limit(1);

    const [created] = await db.insert(whatsappSessao).values({
      organizacaoId: ctx.organizacaoId,
      usuarioId: ctx.userId, // assign session to creating user
      sessionName,
      label: label || sessionName,
      apiToken: token,
      isDefault: existing.length === 0, // first session becomes default
    }).returning();

    return NextResponse.json(created, { status: 201 });
  }

  // Actions that require a sessionId
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const [sessao] = await db.select()
    .from(whatsappSessao)
    .where(and(eq(whatsappSessao.id, sessionId), eq(whatsappSessao.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!sessao) return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });

  const config = sessionToConfig(sessao);

  if (action === "connect") {
    await createSession(config);
    return NextResponse.json({ status: "connecting" });
  }

  if (action === "disconnect") {
    await disconnectSession(config);
    await db.update(whatsappSessao).set({ status: "disconnected", updatedAt: new Date() }).where(eq(whatsappSessao.id, sessao.id));
    return NextResponse.json({ status: "disconnected" });
  }

  if (action === "set-default") {
    // Unset all defaults for this org, then set this one
    await db.update(whatsappSessao).set({ isDefault: false }).where(eq(whatsappSessao.organizacaoId, ctx.organizacaoId));
    await db.update(whatsappSessao).set({ isDefault: true, updatedAt: new Date() }).where(eq(whatsappSessao.id, sessao.id));
    return NextResponse.json({ ok: true });
  }

  if (action === "update") {
    await db.update(whatsappSessao).set({
      ...(label !== undefined && { label }),
      updatedAt: new Date(),
    }).where(eq(whatsappSessao.id, sessao.id));
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    // Disconnect from wuzapi first
    try { await disconnectSession(config); } catch { /* ok */ }
    // Delete from wuzapi
    try {
      const wuzUser = await wuzapiFindUser(sessao.sessionName);
      if (wuzUser) await wuzapiDeleteUser(wuzUser.id);
    } catch { /* ok */ }
    // Delete message history for this session
    await db.delete(whatsappMensagens).where(eq(whatsappMensagens.sessaoId, sessao.id));
    // Delete session record
    await db.delete(whatsappSessao).where(eq(whatsappSessao.id, sessao.id));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
