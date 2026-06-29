import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizacoes, usuarios, whatsappSessao } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSuperAdminContext, forbiddenResponse } from "@/lib/auth/tenant";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/organizacoes/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await getSuperAdminContext();
  if (!ctx) return forbiddenResponse();
  const { id } = await params;

  const [org] = await db.select().from(organizacoes).where(eq(organizacoes.id, id)).limit(1);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgUsers = await db.select({
    id: usuarios.id, nome: usuarios.nome, email: usuarios.email,
    role: usuarios.role, ativo: usuarios.ativo,
  }).from(usuarios).where(eq(usuarios.organizacaoId, id));

  const sessions = await db.select({
    id: whatsappSessao.id, sessionName: whatsappSessao.sessionName,
    label: whatsappSessao.label, isDefault: whatsappSessao.isDefault,
    status: whatsappSessao.status, phoneNumber: whatsappSessao.phoneNumber,
  }).from(whatsappSessao).where(eq(whatsappSessao.organizacaoId, id));

  return NextResponse.json({ ...org, usuarios: orgUsers, sessoes: sessions });
}

// PUT /api/admin/organizacoes/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const ctx = await getSuperAdminContext();
  if (!ctx) return forbiddenResponse();
  const { id } = await params;

  const body = await request.json();
  const allowedFields = ["nome", "slug", "dominio", "corPrimaria", "whatsappEnabled", "maxUsuarios", "maxLeads", "ativo", "logoUrl", "pipelineConfig", "apolloApiKey"] as const;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  const [updated] = await db.update(organizacoes).set(updates).where(eq(organizacoes.id, id)).returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(updated);
}

// DELETE /api/admin/organizacoes/[id] — soft delete
export async function DELETE(_req: NextRequest, { params }: Params) {
  const ctx = await getSuperAdminContext();
  if (!ctx) return forbiddenResponse();
  const { id } = await params;

  const [updated] = await db.update(organizacoes).set({ ativo: false, updatedAt: new Date() }).where(eq(organizacoes.id, id)).returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
