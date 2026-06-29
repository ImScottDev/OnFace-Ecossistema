import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarios, organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSuperAdminContext, forbiddenResponse } from "@/lib/auth/tenant";
import bcrypt from "bcryptjs";

// GET /api/admin/usuarios — list all users (cross-org)
export async function GET(request: NextRequest) {
  const ctx = await getSuperAdminContext();
  if (!ctx) return forbiddenResponse();

  const orgFilter = request.nextUrl.searchParams.get("organizacaoId");

  const query = db.select({
    id: usuarios.id,
    nome: usuarios.nome,
    email: usuarios.email,
    role: usuarios.role,
    ativo: usuarios.ativo,
    organizacaoId: usuarios.organizacaoId,
    orgNome: organizacoes.nome,
    orgSlug: organizacoes.slug,
    createdAt: usuarios.createdAt,
  })
    .from(usuarios)
    .innerJoin(organizacoes, eq(organizacoes.id, usuarios.organizacaoId));

  const result = orgFilter
    ? await query.where(eq(usuarios.organizacaoId, orgFilter))
    : await query;

  return NextResponse.json(result);
}

// POST /api/admin/usuarios — create user
export async function POST(request: NextRequest) {
  const ctx = await getSuperAdminContext();
  if (!ctx) return forbiddenResponse();

  const body = await request.json();
  const { nome, email, senha, role, organizacaoId } = body;

  if (!nome || !email || !senha || !organizacaoId) {
    return NextResponse.json({ error: "nome, email, senha, organizacaoId are required" }, { status: 400 });
  }

  // Check email uniqueness
  const [existing] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, email)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  // Verify org exists
  const [org] = await db.select({ id: organizacoes.id }).from(organizacoes).where(eq(organizacoes.id, organizacaoId)).limit(1);
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const senhaHash = await bcrypt.hash(senha, 10);

  const [user] = await db.insert(usuarios).values({
    nome,
    email,
    senhaHash,
    role: role || "vendedor",
    organizacaoId,
  }).returning({
    id: usuarios.id, nome: usuarios.nome, email: usuarios.email,
    role: usuarios.role, organizacaoId: usuarios.organizacaoId,
  });

  return NextResponse.json(user, { status: 201 });
}
