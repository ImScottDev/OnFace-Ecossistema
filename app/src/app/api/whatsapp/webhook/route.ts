import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { whatsappIncomingQueue } from "@/lib/queue";

const WEBHOOK_SECRET = process.env.UAZAPI_WEBHOOK_SECRET || "";
const WUZAPI_BASE = process.env.UAZAPI_BASE_URL || "http://wuzapi:8080";

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return true;
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

/** Download media from WuzAPI immediately while encryption keys are still valid */
async function downloadMediaNow(
  tipo: string,
  mediaInfo: Record<string, unknown>,
  token: string,
): Promise<{ base64: string; mimetype: string } | null> {
  const endpoints: Record<string, string> = {
    image: "/chat/downloadimage",
    audio: "/chat/downloadaudio",
    video: "/chat/downloadvideo",
    document: "/chat/downloaddocument",
    sticker: "/chat/downloadsticker",
  };
  const endpoint = endpoints[tipo] || endpoints.image;
  const downloadBody = {
    Url: String(mediaInfo.URL || mediaInfo.Url || mediaInfo.url || ""),
    MediaKey: String(mediaInfo.mediaKey || mediaInfo.MediaKey || ""),
    Mimetype: String(mediaInfo.mimetype || mediaInfo.Mimetype || ""),
    FileSHA256: String(mediaInfo.fileSHA256 || mediaInfo.FileSHA256 || ""),
    FileLength: typeof mediaInfo.fileLength === "string" ? parseInt(mediaInfo.fileLength as string) : Number(mediaInfo.fileLength || mediaInfo.FileLength || 0),
    DirectPath: String(mediaInfo.directPath || mediaInfo.DirectPath || ""),
  };
  try {
    console.log(`[Webhook] Download ${tipo}: URL=${downloadBody.Url.slice(0, 60)}... DirectPath=${downloadBody.DirectPath.slice(0, 60)}...`);
    const res = await fetch(`${WUZAPI_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify(downloadBody),
    });
    const data = await res.json();
    if (!res.ok) {
      console.log(`[Webhook] Download error: ${data.error || data.message || res.status}`);
      return null;
    }
    const b64 = data.data?.Data || data.data?.data || "";
    if (!b64 || b64.length < 100) {
      console.log(`[Webhook] Download returned empty base64`);
      return null;
    }
    return { base64: b64, mimetype: String(mediaInfo.Mimetype || mediaInfo.mimetype || "application/octet-stream") };
  } catch (err) {
    console.log(`[Webhook] Download exception: ${err}`);
    return null;
  }
}

/**
 * Webhook handler — downloads media immediately (keys expire fast),
 * then delegates processing to BullMQ worker.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify HMAC signature
    const signature = request.headers.get("x-hmac-signature") || "";
    if (WEBHOOK_SECRET && signature && !verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse the payload
    let payload: Record<string, unknown>;
    let instanceName = "";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const topLevel = JSON.parse(rawBody);
      instanceName = (topLevel.instanceName as string) || "";
      if (typeof topLevel.jsonData === "string") {
        payload = JSON.parse(topLevel.jsonData);
      } else if (topLevel.jsonData && typeof topLevel.jsonData === "object") {
        payload = topLevel.jsonData;
      } else {
        payload = topLevel;
      }
    } else {
      const params = new URLSearchParams(rawBody);
      instanceName = params.get("instanceName") || "";
      const jsonData = params.get("jsonData");
      if (!jsonData) {
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return NextResponse.json({ ok: true });
        }
      } else {
        payload = JSON.parse(jsonData);
      }
    }

    if (!instanceName) {
      instanceName = process.env.UAZAPI_SESSION_NAME || "mcrm-main";
    }

    const eventType = (payload.type as string) || "";

    // Skip noisy events that have no CRM value
    if (eventType === "ChatPresence" || eventType === "PairSuccess") {
      return NextResponse.json({ ok: true });
    }

    // For media messages: download IMMEDIATELY while encryption keys are valid
    // WuzAPI media keys expire within seconds — we must grab them now
    let mediaBase64: string | null = null;
    let mediaMimeType: string | null = null;
    if (eventType === "Message") {
      const eventData = (payload.event as Record<string, unknown>) || {};
      const message = (eventData.Message || eventData.message || payload.Message || {}) as Record<string, unknown>;
      const msg = message;
      const mediaTypes = ["imageMessage", "audioMessage", "videoMessage", "documentMessage", "stickerMessage"];
      const tipoMap: Record<string, string> = { imageMessage: "image", audioMessage: "audio", videoMessage: "video", documentMessage: "document", stickerMessage: "sticker" };

      for (const mt of mediaTypes) {
        const mediaMsg = msg[mt] as Record<string, unknown> | undefined;
        if (mediaMsg && (mediaMsg.MediaKey || mediaMsg.mediaKey)) {
          // Get session token from the instance name
          const token = request.headers.get("x-token") || "";
          // Try to get token from DB via instance name
          let sessionToken = token;
          if (!sessionToken) {
            try {
              const { db } = await import("@/lib/db");
              const { whatsappSessao } = await import("@/lib/db/schema");
              const { eq } = await import("drizzle-orm");
              const [sess] = await db.select({ apiToken: whatsappSessao.apiToken }).from(whatsappSessao).where(eq(whatsappSessao.sessionName, instanceName)).limit(1);
              if (sess) sessionToken = sess.apiToken;
            } catch { /* no DB access in edge */ }
          }

          if (sessionToken) {
            console.log(`[Webhook] Downloading ${tipoMap[mt]} with URL len=${String(mediaMsg.URL || mediaMsg.url || "").length}, mediaKey=${!!mediaMsg.mediaKey}`);
            const result = await downloadMediaNow(tipoMap[mt] || "image", mediaMsg, sessionToken);
            if (result) {
              mediaBase64 = result.base64;
              mediaMimeType = result.mimetype;
              console.log(`[Webhook] Media downloaded OK: ${tipoMap[mt]} (${Math.round(result.base64.length / 1024)}KB)`);
            } else {
              console.log(`[Webhook] Media download FAILED for ${tipoMap[mt]}`);
            }
          } else {
            console.log(`[Webhook] No session token found for ${instanceName}`);
          }
          break;
        }
      }
    }

    // Delegate to worker with media already downloaded
    await whatsappIncomingQueue.add("webhook-event", {
      instanceName,
      eventType,
      payload,
      receivedAt: Date.now(),
      ...(mediaBase64 ? { _mediaBase64: mediaBase64, _mediaMimeType: mediaMimeType } : {}),
    }, {
      removeOnComplete: 200,
      removeOnFail: 500,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Webhook] Parse error:", error);
    return NextResponse.json({ ok: true });
  }
}
