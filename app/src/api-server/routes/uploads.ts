import { Hono } from "hono";
import type { Context } from "hono";
import fs from "fs";
import path from "path";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { negocios, fulfillments } from "@/lib/db/schema";
import { getTenantFromRequest } from "../auth.js";

const app = new Hono();

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
};

/**
 * Prefixo público POR DESENHO: o formulário de implantação é preenchido pelo
 * CLIENTE, sem conta no CRM, e ele reabre o comprovante que acabou de anexar
 * (`<a href={anexoUrl}>` em FormularioImplantacaoPabx). Mesmo modelo de
 * confiança do resto do fluxo público (proposta `/p/:id`, checkout, NPS):
 * UUID não enumerável como fronteira.
 *
 * A validação aqui é mais forte que a do link público: o `fulfillmentId` do
 * caminho precisa existir de verdade.
 */
const PREFIXO_PUBLICO = "fulfillment-formularios/";

/**
 * Decide se a requisição pode ler o arquivo.
 *
 * Antes desta rodada NÃO havia decisão nenhuma: `/api/uploads/*` servia
 * qualquer arquivo do diretório, sem sessão e com `Cache-Control: public`
 * (achado 14/09). Quem tivesse ou adivinhasse um caminho baixava anexo de
 * contrato, documento de cliente e mídia de conversa de qualquer organização.
 */
async function autorizar(c: Context, caminho: string): Promise<{ ok: true } | { ok: false; status: 401 | 403 | 404 }> {
  // 1. Anexo de formulário público: valida que o fulfillment existe.
  if (caminho.startsWith(PREFIXO_PUBLICO)) {
    const fulfillmentId = caminho.slice(PREFIXO_PUBLICO.length).split("/")[0];
    if (!/^[0-9a-f-]{36}$/i.test(fulfillmentId)) return { ok: false, status: 404 };
    const [f] = await db.select({ id: fulfillments.id }).from(fulfillments).where(eq(fulfillments.id, fulfillmentId)).limit(1);
    return f ? { ok: true } : { ok: false, status: 404 };
  }

  // 2. Todo o resto exige sessão do CRM.
  const ctx = await getTenantFromRequest(c);
  if (!ctx) return { ok: false, status: 401 };

  // 3. Anexo de negócio: escopo por organização, não só "estar logado".
  if (caminho.startsWith("anexos/")) {
    const negocioId = caminho.slice("anexos/".length).split("/")[0];
    if (!/^[0-9a-f-]{36}$/i.test(negocioId)) return { ok: false, status: 404 };
    const [n] = await db
      .select({ id: negocios.id })
      .from(negocios)
      .where(and(eq(negocios.id, negocioId), eq(negocios.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    return n ? { ok: true } : { ok: false, status: 403 };
  }

  // 4. Avatar de usuário e mídia de WhatsApp ficam na raiz: sessão basta.
  return { ok: true };
}

// GET /api/uploads/* — serve arquivo enviado, com autorização
app.get("/uploads/*", async (c) => {
  const reqPath = c.req.path;
  // Extract everything after /uploads/ (or after /api/uploads/ depending on mount point)
  const uploadsIndex = reqPath.indexOf("/uploads/");
  const filename = uploadsIndex !== -1 ? decodeURIComponent(reqPath.slice(uploadsIndex + "/uploads/".length)) : "";

  // Prevent path traversal
  if (!filename || filename.includes("..") || filename.startsWith("/")) {
    return c.json({ error: "Invalid path" }, 400);
  }

  const permissao = await autorizar(c, filename);
  if (!permissao.ok) {
    return c.json({ error: permissao.status === 401 ? "Unauthorized" : permissao.status === 403 ? "Forbidden" : "Not found" }, permissao.status);
  }

  const filePath = path.join(UPLOADS_DIR, filename);

  // Cinto e suspensório do traversal: o caminho resolvido tem que ficar DENTRO
  // do diretório de uploads (symlink, encoding exótico, etc).
  const raizReal = path.resolve(UPLOADS_DIR);
  if (!path.resolve(filePath).startsWith(raizReal + path.sep)) {
    return c.json({ error: "Invalid path" }, 400);
  }

  if (!fs.existsSync(filePath)) {
    return c.json({ error: "Not found" }, 404);
  }

  const ext = path.extname(filename).slice(1).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const fileBuffer = fs.readFileSync(filePath);

  return new Response(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileBuffer.length),
      // `private`: é conteúdo de UMA organização, não pode ficar em cache
      // compartilhado de CDN/proxy. Era `public, max-age=31536000, immutable`.
      "Cache-Control": "private, max-age=3600",
    },
  });
});

export const uploadsRoutes = app;
