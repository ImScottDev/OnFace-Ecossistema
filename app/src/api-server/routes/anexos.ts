// Anexos com upload real (25/08, pedido do Kauã: anexar arquivo/imagem em
// nota e em negócio/documentos, sem depender de link externo). Mesmo
// mecanismo já provado de src/api-server/routes/perfil.ts (upload de
// avatar) — formData + fs.writeFileSync em UPLOADS_DIR, servido de volta
// via /api/uploads/*. Diferente de anexos_legado (histórico Zoho, read-only).
import { Hono } from "hono";
import { db } from "@/lib/db";
import { anexos, negocios } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { getCtx } from "../compat.js";

const app = new Hono();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
const MAX_ANEXO_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv", "application/zip",
]);

// GET /anexos?negocioId=X — lista anexos de um negócio (inclui os
// vinculados a uma nota — a nota é só a origem, o anexo pertence ao negócio)
app.get("/anexos", async (c) => {
  const ctx = await getCtx(c);
  const negocioId = c.req.query("negocioId") ?? null;
  if (!negocioId || !UUID_RE.test(negocioId)) return c.json({ error: "negocioId inválido" }, 400);

  const result = await db
    .select()
    .from(anexos)
    .where(and(eq(anexos.negocioId, negocioId), eq(anexos.organizacaoId, ctx.organizacaoId)))
    .orderBy(desc(anexos.createdAt));

  return c.json({ anexos: result });
});

// POST /anexos — multipart/form-data: file, negocioId, notaId? (opcional)
app.post("/anexos", async (c) => {
  const ctx = await getCtx(c);

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const negocioId = String(formData.get("negocioId") || "");
  const notaId = formData.get("notaId") ? String(formData.get("notaId")) : null;

  if (!file) return c.json({ error: "Nenhum arquivo enviado" }, 400);
  if (!UUID_RE.test(negocioId)) return c.json({ error: "negocioId inválido" }, 400);
  if (!ALLOWED_TYPES.has(file.type)) return c.json({ error: "Formato não suportado" }, 400);
  if (file.size > MAX_ANEXO_SIZE) return c.json({ error: "Arquivo muito grande. Máximo 20MB" }, 400);

  const [negocio] = await db.select({ id: negocios.id }).from(negocios).where(and(eq(negocios.id, negocioId), eq(negocios.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!negocio) return c.json({ error: "Negócio não encontrado" }, 404);

  const anexosDir = path.join(UPLOADS_DIR, "anexos", negocioId);
  if (!fs.existsSync(anexosDir)) fs.mkdirSync(anexosDir, { recursive: true });

  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(anexosDir, filename), buffer);

  const url = `/api/uploads/anexos/${negocioId}/${filename}`;
  const [anexo] = await db.insert(anexos).values({
    organizacaoId: ctx.organizacaoId,
    negocioId,
    notaId,
    nomeArquivo: file.name,
    url,
    tipoMime: file.type,
    tamanhoBytes: file.size,
    criadoPorId: ctx.userId,
  }).returning();

  return c.json(anexo, 201);
});

// DELETE /anexos/:id
app.delete("/anexos/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "ID inválido" }, 400);

  const [anexo] = await db.select().from(anexos).where(and(eq(anexos.id, id), eq(anexos.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!anexo) return c.json({ error: "Anexo não encontrado" }, 404);

  const filePath = path.join(UPLOADS_DIR, anexo.url.replace(/^\/api\/uploads\//, ""));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await db.delete(anexos).where(eq(anexos.id, id));

  return c.json({ success: true });
});

export const anexosRoutes = app;
