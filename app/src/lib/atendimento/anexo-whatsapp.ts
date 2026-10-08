/**
 * Anexo do compositor do Atendimento: o que o navegador manda (data URI em
 * base64) vira bytes + MIME + nome para o acervo canônico (`file_objects`).
 * Pura de propósito: a rota de envio só orquestra.
 */

const EXTENSAO_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "audio/ogg": "ogg", "audio/webm": "webm", "audio/mpeg": "mp3", "audio/mp4": "m4a",
  "video/mp4": "mp4", "application/pdf": "pdf",
};

export type AnexoDecodificado = { bytes: Uint8Array; mime: string; nome: string };

/** `data:audio/webm;codecs=opus;base64,AAAA` → bytes, mime sem parâmetros e um nome. */
export function decodificarAnexo(dataUri: string, tipo: string, fileName?: string | null): AnexoDecodificado | null {
  const m = /^data:([^;,]*)((?:;[^;,]*)*?),([\s\S]*)$/.exec(dataUri.trim());
  if (!m || !/;base64/i.test(m[2])) return null;
  const mime = (m[1] || "application/octet-stream").toLowerCase();
  const bytes = Uint8Array.from(Buffer.from(m[3], "base64"));
  const ext = EXTENSAO_POR_MIME[mime] ?? "bin";
  const nome = (fileName && fileName.trim()) || `${tipo}-${Date.now()}.${ext}`;
  return { bytes, mime, nome };
}
