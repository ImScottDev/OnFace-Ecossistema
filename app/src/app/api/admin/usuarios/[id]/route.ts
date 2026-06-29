import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSuperAdminContext, forbiddenResponse } from "@/lib/auth/tenant";
import bcrypt from "bcryptjs";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/usuarios/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await getSuperAdminContext();
  if (!ctx) return forbiddenResponse();
  const { id } = await params;

  const [user] = await db.select({
    id: usuarios.id, nome: usuarios.nome, email: usuarios.email,
    role: usuarios.role, ativo: usuarios.ativo, organizacaoId: usuarios.organizacaoId,
    createdAt: usuarios.createdAt,
  }).from(usuarios).where(eq(usuarios.id, id)).limit(1);

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

// PUT /api/admin/usuarios/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const ctx = await getSuperAdminContext();
  if (!ctx) return forbiddenResponse();
  const { id } = await params;

  const body = await request.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.nome !== undefined) updates.nome = body.nome;
  if (body.email !== undefined) updates.email = body.email;
  if (body.role !== undefined) updates.role = body.role;
  if (body.ativo !== undefined) updates.ativo = body.ativo;
  if (body.organizacaoId !== undefined) updates.organizacaoId = body.organizacaoId;
  if (body.senha) updates.senhaHash = await bcrypt.hash(body.senha, 10);

  const [updated] = await db.update(usuarios).set(updates).where(eq(usuarios.id, id)).returning({
    id: usuarios.id, nome: usuarios.nome, email: usuarios.email,
    role: usuarios.role, ativo: usuarios.ativo,
  });

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE /api/admin/usuarios/[id] — soft delete
export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await getSuperAdminContext();
  if (!ctx) return forbiddenResponse();
  const { id } = await params;

  const [updated] = await db.update(usuarios).set({ ativo: false, updatedAt: new Date() }).where(eq(usuarios.id, id)).returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
