import { Hono } from "hono";
import fs from "fs";
import path from "path";

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

// GET /api/uploads/* — serve uploaded media files
app.get("/uploads/*", async (c) => {
  const reqPath = c.req.path;
  // Extract everything after /uploads/ (or after /api/uploads/ depending on mount point)
  const uploadsIndex = reqPath.indexOf("/uploads/");
  const filename = uploadsIndex !== -1 ? reqPath.slice(uploadsIndex + "/uploads/".length) : "";

  // Prevent path traversal
  if (!filename || filename.includes("..") || filename.startsWith("/")) {
    return c.json({ error: "Invalid path" }, 400);
  }

  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return c.json({ error: "Not found" }, 404);
  }

  const ext = path.extname(filename).slice(1).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const fileBuffer = fs.readFileSync(filePath);

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileBuffer.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

export const uploadsRoutes = app;
