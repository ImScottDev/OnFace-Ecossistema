/**
 * WhatsApp API client — wraps wuzapi (asternic/wuzapi) REST API.
 * Supports per-session config for multi-number setups.
 */

import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";

const execFileAsync = promisify(execFile);

export interface WuzapiSessionConfig {
  baseUrl: string;
  apiToken: string;
}

const DEFAULT_CONFIG: WuzapiSessionConfig = {
  baseUrl: process.env.UAZAPI_BASE_URL || "http://wuzapi:8080",
  apiToken: process.env.UAZAPI_API_KEY || "",
};

/** Build config from a whatsapp_sessao row */
export function sessionToConfig(sessao: { apiToken?: string | null }): WuzapiSessionConfig {
  return {
    baseUrl: process.env.UAZAPI_BASE_URL || "http://wuzapi:8080",
    apiToken: sessao.apiToken || process.env.UAZAPI_API_KEY || "",
  };
}

async function wuzapiFetch(path: string, options: RequestInit = {}, config = DEFAULT_CONFIG): Promise<Response> {
  const url = `${config.baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(10_000), // 10s timeout
    headers: {
      "Content-Type": "application/json",
      token: config.apiToken,
      ...options.headers,
    },
  });
  return res;
}

function extractId(data: Record<string, unknown>): string {
  const d = data.data as Record<string, string> | undefined;
  return d?.Id || d?.id || "";
}

export interface SendResult {
  messageId: string;
  status: string;
}

/** Optional reply context for quoting messages */
export interface ReplyContext {
  stanzaId: string;       // wuzapi message ID being replied to
  participant?: string;    // JID of original sender
}

function buildContextInfo(reply?: ReplyContext, phone?: string) {
  if (!reply) return {};
  // Participant is required by wuzapi — use the phone JID if not explicitly set
  const participant = reply.participant || (phone ? `${phone.replace(/\D/g, "")}@s.whatsapp.net` : undefined);
  return {
    ContextInfo: {
      StanzaId: reply.stanzaId,
      ...(participant && { Participant: participant }),
    },
  };
}

// ─── SEND ENDPOINTS ──────────────────────────────────────

/** Send a text message */
export async function sendText(phone: string, text: string, config?: WuzapiSessionConfig, reply?: ReplyContext): Promise<SendResult> {
  const res = await wuzapiFetch("/chat/send/text", {
    method: "POST",
    body: JSON.stringify({ Phone: phone, Body: text, ...buildContextInfo(reply, phone) }),
  }, config || DEFAULT_CONFIG);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Failed to send text");
  return { messageId: extractId(data), status: "sent" };
}

/** Send an image (base64 data URI) */
export async function sendImage(phone: string, base64Data: string, caption?: string, config?: WuzapiSessionConfig, reply?: ReplyContext): Promise<SendResult> {
  const res = await wuzapiFetch("/chat/send/image", {
    method: "POST",
    body: JSON.stringify({ Phone: phone, Image: base64Data, Caption: caption || "", ...buildContextInfo(reply, phone) }),
  }, config || DEFAULT_CONFIG);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Failed to send image");
  return { messageId: extractId(data), status: "sent" };
}

/** Strip data URI prefix from base64 audio, handling various browser MIME formats */
function stripAudioDataUri(dataUri: string): string {
  // Handle: data:audio/ogg;base64, data:audio/webm;codecs=opus;base64, data:audio/ogg; codecs=opus;base64, etc.
  return dataUri.replace(/^data:audio\/[^;]+;?\s*(?:codecs=[^;]+;?\s*)?base64,/, "");
}

export interface AudioConversionResult {
  dataUri: string;     // data:audio/ogg;base64,...
  durationSecs: number; // duration in seconds (for WhatsApp waveform)
}

/**
 * Convert audio base64 data URI to OGG Opus using ffmpeg.
 * WhatsApp mobile requires real OGG Opus — browsers often record WebM which
 * plays on WhatsApp Web but not on mobile.
 * Returns the converted data URI and duration in seconds.
 */
async function convertToOggOpus(base64Data: string): Promise<AudioConversionResult> {
  const match = base64Data.match(/^data:audio\/([^;,\s]+)/);
  const inputFormat = match?.[1] || "webm";

  const rawBase64 = stripAudioDataUri(base64Data);
  if (!rawBase64 || rawBase64.length < 100) {
    throw new Error("Audio data too small or empty after stripping prefix");
  }
  const inputBuf = Buffer.from(rawBase64, "base64");

  const tmpDir = os.tmpdir();
  const id = `wa_audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const inputPath = path.join(tmpDir, `${id}.${inputFormat}`);
  const outputPath = path.join(tmpDir, `${id}.ogg`);

  try {
    fs.writeFileSync(inputPath, inputBuf);

    // Convert to OGG Opus — the only format WhatsApp accepts for PTT voice notes
    // Key flags for WhatsApp compatibility:
    //   -map_metadata -1  → strips source metadata (language tags) that break playback
    //   -af aresample=async=1:first_pts=0 → resets start_pts to 0 (WebM CodecDelay causes negative offset that WhatsApp rejects)
    await execFileAsync("ffmpeg", [
      "-i", inputPath,
      "-af", "aresample=async=1:first_pts=0",
      "-c:a", "libopus",
      "-b:a", "48k",
      "-ar", "48000",
      "-ac", "1",
      "-application", "voip",
      "-vn",
      "-map_metadata", "-1",
      "-y", outputPath,
    ], { timeout: 30000 });

    const outputBuf = fs.readFileSync(outputPath);
    if (outputBuf.length < 100) {
      throw new Error("ffmpeg produced empty/tiny output file");
    }

    // Get duration via ffprobe
    let durationSecs = 0;
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        outputPath,
      ], { timeout: 5000 });
      durationSecs = Math.ceil(parseFloat(stdout.trim()) || 0);
    } catch {
      // Duration is optional — estimate from file size (~6KB/sec at 48kbps)
      durationSecs = Math.max(1, Math.round(outputBuf.length / 6000));
    }

    const dataUri = `data:audio/ogg;base64,${outputBuf.toString("base64")}`;
    console.log(`[WA] Audio converted: ${inputFormat} → ogg/opus, ${durationSecs}s, ${Math.round(outputBuf.length / 1024)}KB`);
    return { dataUri, durationSecs };
  } finally {
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
  }
}

/** Send an audio message (base64 data URI). Returns result + converted audio for local storage. */
export async function sendAudio(
  phone: string,
  base64Data: string,
  ptt = true,
  config?: WuzapiSessionConfig,
  reply?: ReplyContext,
): Promise<SendResult & { convertedAudio?: string }> {
  let audioData: string;
  let durationSecs = 0;

  try {
    const converted = await convertToOggOpus(base64Data);
    audioData = converted.dataUri;
    durationSecs = converted.durationSecs;
  } catch (err) {
    console.error("[WA] ffmpeg audio conversion failed:", (err as Error).message);
    // Fallback: send as-is — may not play on mobile but won't block sending
    audioData = base64Data;
  }

  const body: Record<string, unknown> = {
    Phone: phone,
    Audio: audioData,
    PTT: ptt,
    ...buildContextInfo(reply, phone),
  };
  if (durationSecs > 0) {
    body.Seconds = durationSecs;
  }

  const res = await wuzapiFetch("/chat/send/audio", {
    method: "POST",
    body: JSON.stringify(body),
  }, config || DEFAULT_CONFIG);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Failed to send audio");
  return { messageId: extractId(data), status: "sent", convertedAudio: audioData };
}

/** Send a video (base64 data URI, mp4 H.264+AAC) */
export async function sendVideo(phone: string, base64Data: string, caption?: string, config?: WuzapiSessionConfig, reply?: ReplyContext): Promise<SendResult> {
  const res = await wuzapiFetch("/chat/send/video", {
    method: "POST",
    body: JSON.stringify({ Phone: phone, Video: base64Data, Caption: caption || "", ...buildContextInfo(reply, phone) }),
  }, config || DEFAULT_CONFIG);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Failed to send video");
  return { messageId: extractId(data), status: "sent" };
}

/** Send a document (base64 data URI) */
export async function sendDocument(phone: string, base64Data: string, fileName: string, config?: WuzapiSessionConfig, reply?: ReplyContext): Promise<SendResult> {
  // wuzapi requires application/octet-stream MIME type for documents
  const docData = base64Data.startsWith("data:")
    ? base64Data.replace(/^data:[^;]+;/, "data:application/octet-stream;")
    : base64Data;
  const res = await wuzapiFetch("/chat/send/document", {
    method: "POST",
    body: JSON.stringify({ Phone: phone, Document: docData, FileName: fileName, ...buildContextInfo(reply, phone) }),
  }, config || DEFAULT_CONFIG);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Failed to send document");
  return { messageId: extractId(data), status: "sent" };
}

/** Send a sticker (base64 image/webp or video/mp4) */
export async function sendSticker(phone: string, base64Data: string, config?: WuzapiSessionConfig): Promise<SendResult> {
  const res = await wuzapiFetch("/chat/send/sticker", {
    method: "POST",
    body: JSON.stringify({ Phone: phone, Sticker: base64Data }),
  }, config || DEFAULT_CONFIG);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Failed to send sticker");
  return { messageId: extractId(data), status: "sent" };
}

/** Send a location */
export async function sendLocation(phone: string, lat: number, lng: number, name?: string, config?: WuzapiSessionConfig, reply?: ReplyContext): Promise<SendResult> {
  const res = await wuzapiFetch("/chat/send/location", {
    method: "POST",
    body: JSON.stringify({ Phone: phone, Latitude: lat, Longitude: lng, Name: name || "", ...buildContextInfo(reply, phone) }),
  }, config || DEFAULT_CONFIG);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Failed to send location");
  return { messageId: extractId(data), status: "sent" };
}

/** Send a contact card (vCard) */
export async function sendContact(phone: string, contactName: string, vcard: string, config?: WuzapiSessionConfig): Promise<SendResult> {
  const res = await wuzapiFetch("/chat/send/contact", {
    method: "POST",
    body: JSON.stringify({ Phone: phone, Name: contactName, Vcard: vcard }),
  }, config || DEFAULT_CONFIG);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Failed to send contact");
  return { messageId: extractId(data), status: "sent" };
}

// ─── MEDIA DOWNLOAD ─────────────────────────────────────

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");

/** Ensure uploads directory exists */
function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/** Map message type to wuzapi download endpoint */
function getDownloadEndpoint(tipo: string): string {
  switch (tipo) {
    case "image": return "/chat/downloadimage";
    case "audio": return "/chat/downloadaudio";
    case "video": return "/chat/downloadvideo";
    case "document": return "/chat/downloaddocument";
    case "sticker": return "/chat/downloadsticker";
    default: return "/chat/downloadimage";
  }
}

/** Get file extension from MIME type */
function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
    "video/mp4": "mp4", "video/3gpp": "3gp",
    "audio/ogg": "ogg", "audio/ogg; codecs=opus": "ogg", "audio/webm": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/msword": "doc", "application/vnd.ms-excel": "xls",
    "text/plain": "txt", "text/csv": "csv",
  };
  // Normalize: strip parameters like "; codecs=opus"
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return map[base] || map[mimeType.toLowerCase()] || "bin";
}

/** Get extension from data URI */
function dataUriToExt(dataUri: string): string {
  const match = dataUri.match(/^data:([^;]+);/);
  if (!match) return "bin";
  return mimeToExt(match[1]);
}

export interface MediaDownloadInfo {
  url: string;
  mediaKey: string;
  mimetype: string;
  fileSHA256: string;
  fileLength: number | string;
  directPath: string;
}

/**
 * Download media from WhatsApp via wuzapi's download endpoints.
 * Returns base64 data of the file.
 */
export async function downloadMedia(
  tipo: string,
  info: MediaDownloadInfo,
  config?: WuzapiSessionConfig,
): Promise<{ base64: string; mimetype: string }> {
  const endpoint = getDownloadEndpoint(tipo);
  const res = await wuzapiFetch(endpoint, {
    method: "POST",
    body: JSON.stringify({
      Url: info.url,
      MediaKey: info.mediaKey,
      Mimetype: info.mimetype,
      FileSHA256: info.fileSHA256,
      FileLength: typeof info.fileLength === "string" ? parseInt(info.fileLength) : info.fileLength,
      DirectPath: info.directPath,
    }),
  }, config || DEFAULT_CONFIG);

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || `Failed to download ${tipo}`);
  const b64 = data.data?.Data || data.data?.data || "";
  return { base64: b64, mimetype: info.mimetype };
}

/**
 * Download media from WhatsApp via wuzapi using only the MessageId.
 * Used as fallback when base64 was stripped from the BullMQ job payload.
 */
export async function downloadMediaByMessageId(
  tipo: string,
  messageId: string,
  config?: WuzapiSessionConfig,
): Promise<{ base64: string; mimetype: string } | null> {
  const endpoint = getDownloadEndpoint(tipo);
  try {
    const res = await wuzapiFetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ MessageId: messageId }),
    }, config || DEFAULT_CONFIG);

    const data = await res.json();
    if (!res.ok) {
      console.error(`[downloadMediaByMessageId] wuzapi error:`, data.message || data.error);
      return null;
    }
    const b64 = data.data?.Data || data.data?.data || "";
    if (!b64) return null;
    const mimetype = data.data?.Mimetype || data.data?.mimetype || `application/octet-stream`;
    return { base64: b64, mimetype };
  } catch (err) {
    console.error(`[downloadMediaByMessageId] Failed for ${tipo} ${messageId}:`, err);
    return null;
  }
}

/**
 * Save base64 data to disk in uploads folder.
 * Returns the public URL path (e.g., /uploads/abc123.jpg).
 */
export function saveBase64ToDisk(
  base64Data: string,
  fileId: string,
  tipo: string,
  fileName?: string,
  mimeType?: string,
): string {
  ensureUploadsDir();

  // Reject files larger than 100MB (base64 is ~33% overhead)
  const MAX_BASE64_SIZE = 133_000_000; // ~100MB decoded
  if (base64Data.length > MAX_BASE64_SIZE) {
    throw new Error(`File too large: ${Math.round(base64Data.length * 0.75 / 1024 / 1024)}MB exceeds 100MB limit`);
  }

  let ext: string;
  let rawBase64: string;

  if (base64Data.startsWith("data:")) {
    ext = dataUriToExt(base64Data);
    rawBase64 = base64Data.replace(/^data:[^;]+;(?:codecs=[^;]+;)?base64,/, "");
  } else {
    // Pure base64, determine ext from type/mime
    if (mimeType) {
      ext = mimeToExt(mimeType);
    } else if (tipo === "audio") {
      ext = "ogg";
    } else if (tipo === "video") {
      ext = "mp4";
    } else if (tipo === "image") {
      ext = "jpg";
    } else {
      ext = "bin";
    }
    rawBase64 = base64Data;
  }

  // For documents, prefer original filename extension
  if (tipo === "document" && fileName) {
    const dotIdx = fileName.lastIndexOf(".");
    if (dotIdx > 0) ext = fileName.substring(dotIdx + 1);
  }

  const filename = `${fileId}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(rawBase64, "base64"));
  console.log(`[Media] Saved ${tipo} to ${filePath} (${Math.round(rawBase64.length * 0.75 / 1024)}KB)`);

  return `/api/uploads/${filename}`;
}

// ─── CHAT ACTIONS ────────────────────────────────────────

/** React to a message with an emoji */
export async function reactToMessage(phone: string, messageId: string, emoji: string, config?: WuzapiSessionConfig): Promise<void> {
  const res = await wuzapiFetch("/chat/react", {
    method: "POST",
    body: JSON.stringify({ Phone: phone, Body: emoji, Id: messageId }),
  }, config || DEFAULT_CONFIG);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || data.error || "Failed to react");
  }
}

/** Mark messages as read */
export async function markRead(messageIds: string[], chatPhone: string, config?: WuzapiSessionConfig): Promise<void> {
  const res = await wuzapiFetch("/chat/markread", {
    method: "POST",
    body: JSON.stringify({ Id: messageIds, ChatPhone: chatPhone }),
  }, config || DEFAULT_CONFIG);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || data.error || "Failed to mark read");
  }
}

/** Set typing/recording indicator */
export async function setPresence(phone: string, state: "composing" | "paused", media?: "audio", config?: WuzapiSessionConfig): Promise<void> {
  const res = await wuzapiFetch("/chat/presence", {
    method: "POST",
    body: JSON.stringify({ Phone: phone, State: state, ...(media && { Media: media }) }),
  }, config || DEFAULT_CONFIG);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || data.error || "Failed to set presence");
  }
}

/** Delete a sent message */
export async function deleteMessage(phone: string, messageId: string, config?: WuzapiSessionConfig): Promise<void> {
  const res = await wuzapiFetch("/chat/delete", {
    method: "POST",
    body: JSON.stringify({ Phone: phone, Id: messageId }),
  }, config || DEFAULT_CONFIG);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || data.error || "Failed to delete message");
  }
}

// ─── USER ENDPOINTS ──────────────────────────────────────

/** Check if phone numbers have WhatsApp */
export async function checkWhatsApp(phones: string[], config?: WuzapiSessionConfig): Promise<Array<{ phone: string; isOnWhatsApp: boolean; jid: string }>> {
  const res = await wuzapiFetch("/user/check", {
    method: "POST",
    body: JSON.stringify({ Phone: phones }),
  }, config || DEFAULT_CONFIG);
  const data = await res.json();
  if (!res.ok) return phones.map(p => ({ phone: p, isOnWhatsApp: false, jid: "" }));
  // Wuzapi returns { data: { Users: [...] } } or { data: [...] }
  const rawResults = Array.isArray(data.data) ? data.data : (data.data?.Users || []);
  const results = rawResults as Array<{ IsInWhatsapp: boolean; JID: string; Query?: string; VerifiedName?: string | { Details?: { VerifiedName?: string } } }>;
  return results.map((r, i) => ({
    phone: phones[i] || "",
    isOnWhatsApp: r.IsInWhatsapp,
    jid: r.JID || "",
  }));
}

/** Get profile picture URL */
export async function getAvatar(phone: string, preview = true, config?: WuzapiSessionConfig): Promise<string> {
  try {
    const res = await wuzapiFetch("/user/avatar", {
      method: "POST",
      body: JSON.stringify({ Phone: phone, Preview: preview }),
    }, config || DEFAULT_CONFIG);
    const data = await res.json();
    return (data.data as Record<string, string>)?.URL || (data.data as Record<string, string>)?.url || "";
  } catch {
    return "";
  }
}

/**
 * Download WhatsApp avatar and save to disk.
 * Returns local URL path (e.g., /api/uploads/avatar_5511999999999.jpg) or "" on failure.
 */
export async function downloadAndSaveAvatar(phone: string, config?: WuzapiSessionConfig): Promise<string> {
  const cleanPhone = phone.replace(/\D/g, "");
  const filename = `avatar_${cleanPhone}.jpg`;
  const filePath = path.join(UPLOADS_DIR, filename);
  const localUrl = `/api/uploads/${filename}`;

  try {
    const remoteUrl = await getAvatar(phone, true, config);
    if (!remoteUrl) {
      // Fallback: if we already have a cached avatar on disk, return it
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) return localUrl;
      return "";
    }

    const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) {
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) return localUrl;
      return "";
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 100) {
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) return localUrl;
      return "";
    }

    ensureUploadsDir();
    fs.writeFileSync(filePath, buffer);

    return localUrl;
  } catch {
    // Fallback to existing file on disk
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) return localUrl;
    return "";
  }
}

// ─── SESSION ENDPOINTS ───────────────────────────────────

/** Get connection status */
export async function getStatus(config?: WuzapiSessionConfig): Promise<{
  connected: boolean;
  phone: string;
  status: string;
  qrCode: string;
}> {
  try {
    const res = await wuzapiFetch("/session/status", {}, config || DEFAULT_CONFIG);
    const data = await res.json();
    // /session/status retorna connected+loggedIn mas jid VAZIO (o jid só vem em /admin/users).
    // Por isso NÃO exigir jid — basta connected||loggedIn pra considerar conectado.
    const loggedIn = data.data?.loggedIn === true;
    const connectedFlag = data.data?.connected === true;
    const jid = data.data?.jid?.split("@")?.[0] || "";
    const isConnected = connectedFlag || loggedIn;
    const qrCode = data.data?.qrcode || "";
    return {
      connected: isConnected,
      phone: jid,
      status: isConnected ? "connected" : qrCode ? "waiting_qr" : "disconnected",
      qrCode,
    };
  } catch {
    return { connected: false, phone: "", status: "disconnected", qrCode: "" };
  }
}

/** Get QR code for session authentication */
export async function getQrCode(config?: WuzapiSessionConfig): Promise<{ qr: string }> {
  try {
    const res = await wuzapiFetch("/session/qr", {}, config || DEFAULT_CONFIG);
    const data = await res.json();
    return { qr: data.data?.QRCode || data.data?.qrcode || "" };
  } catch {
    return { qr: "" };
  }
}

/** Connect/create session */
export async function createSession(config?: WuzapiSessionConfig): Promise<void> {
  await wuzapiFetch("/session/connect", {
    method: "POST",
    body: JSON.stringify({ Subscribe: ["All"], Immediate: true }),
  }, config || DEFAULT_CONFIG);
}

/** Disconnect session */
export async function disconnectSession(config?: WuzapiSessionConfig): Promise<void> {
  await wuzapiFetch("/session/disconnect", {
    method: "POST",
  }, config || DEFAULT_CONFIG);
}

// ─── WUZAPI ADMIN API ──────────────────────────────────────

const WUZAPI_ADMIN_TOKEN = process.env.WUZAPI_ADMIN_TOKEN || "";
const WUZAPI_BASE_URL = process.env.UAZAPI_BASE_URL || "http://wuzapi:8080";

async function wuzapiAdminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${WUZAPI_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: WUZAPI_ADMIN_TOKEN,
      ...options.headers,
    },
  });
}

/** Create a new user/session in wuzapi. Returns { id, token } */
export async function wuzapiCreateUser(
  name: string,
  token: string,
  webhookUrl: string,
): Promise<{ id: string; token: string }> {
  const res = await wuzapiAdminFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify({ name, token, webhook: webhookUrl, events: "All" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.details || data.message || "Failed to create wuzapi user");
  return { id: data.data?.id || "", token: data.data?.token || token };
}

/** Delete a user/session from wuzapi by wuzapi user ID */
export async function wuzapiDeleteUser(wuzapiUserId: string): Promise<void> {
  await wuzapiAdminFetch(`/admin/users/${wuzapiUserId}`, { method: "DELETE" });
}

/** List all wuzapi users */
export async function wuzapiListUsers(): Promise<Array<{ id: string; name: string; token: string; connected: boolean }>> {
  const res = await wuzapiAdminFetch("/admin/users");
  const data = await res.json();
  return data.data || [];
}

/** Find wuzapi user by session name */
export async function wuzapiFindUser(sessionName: string): Promise<{ id: string; token: string } | null> {
  const users = await wuzapiListUsers();
  const user = users.find(u => u.name === sessionName);
  return user ? { id: user.id, token: user.token } : null;
}
