import { Hono } from "hono";
import { db } from "@/lib/db";
import { usuarios, organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { getCtx } from "../compat.js";

const app = new Hono();

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// GET /perfil
app.get("/", async (c) => {
  const ctx = await getCtx(c);

  const [user] = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      role: usuarios.role,
      avatarUrl: usuarios.avatarUrl,
      orgNome: organizacoes.nome,
      orgSlug: organizacoes.slug,
    })
    .from(usuarios)
    .innerJoin(organizacoes, eq(usuarios.organizacaoId, organizacoes.id))
    .where(eq(usuarios.id, ctx.userId))
    .limit(1);

  if (!user) return c.json({ error: "User not found" }, 404);

  return c.json(user);
});

// PATCH /perfil
app.patch("/", async (c) => {
  const ctx = await getCtx(c);

  const body = await c.req.json();
  const { nome, senhaAtual, novaSenha } = body;

  const updates: Record<string, unknown> = {};

  // Name update
  if (nome !== undefined) {
    if (!nome || typeof nome !== "string" || nome.trim().length === 0) {
      return c.json({ error: "Nome não pode ser vazio" }, 400);
    }
    updates.nome = nome.trim();
  }

  // Password change
  if (senhaAtual || novaSenha) {
    if (!senhaAtual || !novaSenha) {
      return c.json(
        { error: "Informe a senha atual e a nova senha" },
        400
      );
    }

    if (typeof novaSenha !== "string" || novaSenha.length < 8) {
      return c.json(
        { error: "A nova senha deve ter pelo menos 8 caracteres" },
        400
      );
    }

    // Verify current password
    const [user] = await db
      .select({ senhaHash: usuarios.senhaHash })
      .from(usuarios)
      .where(eq(usuarios.id, ctx.userId))
      .limit(1);

    if (!user) return c.json({ error: "User not found" }, 404);

    const valid = await bcrypt.compare(senhaAtual, user.senhaHash);
    if (!valid) {
      return c.json({ error: "Senha atual incorreta" }, 400);
    }

    updates.senhaHash = await bcrypt.hash(novaSenha, 10);
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "Nenhum campo para atualizar" }, 400);
  }

  updates.updatedAt = new Date();

  await db.update(usuarios).set(updates).where(eq(usuarios.id, ctx.userId));

  return c.json({ ok: true });
});

// POST /perfil — upload avatar
app.post("/", async (c) => {
  const ctx = await getCtx(c);

  const formData = await c.req.formData();
  const file = formData.get("avatar") as File | null;

  if (!file) {
    return c.json({ error: "Nenhum arquivo enviado" }, 400);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ error: "Formato inválido. Use JPG, PNG, WebP ou GIF" }, 400);
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return c.json({ error: "Arquivo muito grande. Máximo 5MB" }, 400);
  }

  // Save file
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `avatars/${ctx.userId}.${ext}`;
  const avatarsDir = path.join(UPLOADS_DIR, "avatars");

  if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
  }

  // Delete old avatar if different extension
  const oldFiles = fs.readdirSync(avatarsDir).filter(f => f.startsWith(ctx.userId));
  for (const old of oldFiles) {
    fs.unlinkSync(path.join(avatarsDir, old));
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);

  const avatarUrl = `/api/uploads/${filename}`;

  await db
    .update(usuarios)
    .set({ avatarUrl, updatedAt: new Date() })
    .where(eq(usuarios.id, ctx.userId));

  return c.json({ avatarUrl });
});

export const perfilRoutes = app;
