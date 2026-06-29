import { NextRequest, NextResponse } from "next/server";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { usuarios, organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

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

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const body = await req.json();
  const { nome, senhaAtual, novaSenha } = body;

  const updates: Record<string, unknown> = {};

  // Name update
  if (nome !== undefined) {
    if (!nome || typeof nome !== "string" || nome.trim().length === 0) {
      return NextResponse.json({ error: "Nome não pode ser vazio" }, { status: 400 });
    }
    updates.nome = nome.trim();
  }

  // Password change
  if (senhaAtual || novaSenha) {
    if (!senhaAtual || !novaSenha) {
      return NextResponse.json(
        { error: "Informe a senha atual e a nova senha" },
        { status: 400 }
      );
    }

    if (typeof novaSenha !== "string" || novaSenha.length < 8) {
      return NextResponse.json(
        { error: "A nova senha deve ter pelo menos 8 caracteres" },
        { status: 400 }
      );
    }

    // Verify current password
    const [user] = await db
      .select({ senhaHash: usuarios.senhaHash })
      .from(usuarios)
      .where(eq(usuarios.id, ctx.userId))
      .limit(1);

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const valid = await bcrypt.compare(senhaAtual, user.senhaHash);
    if (!valid) {
      return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
    }

    updates.senhaHash = await bcrypt.hash(novaSenha, 10);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  updates.updatedAt = new Date();

  await db.update(usuarios).set(updates).where(eq(usuarios.id, ctx.userId));

  return NextResponse.json({ ok: true });
}

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// POST /api/perfil — upload avatar
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const formData = await req.formData();
  const file = formData.get("avatar") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Formato inválido. Use JPG, PNG, WebP ou GIF" }, { status: 400 });
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 5MB" }, { status: 400 });
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

  return NextResponse.json({ avatarUrl });
}
