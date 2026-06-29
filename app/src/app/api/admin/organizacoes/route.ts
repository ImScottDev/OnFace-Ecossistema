import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizacoes, usuarios, whatsappSessao } from "@/lib/db/schema";
import { eq, sql as rawSql } from "drizzle-orm";
import { getSuperAdminContext, forbiddenResponse, unauthorizedResponse } from "@/lib/auth/tenant";

// GET /api/admin/organizacoes — list all organizations
export async function GET() {
  const ctx = await getSuperAdminContext();
  if (!ctx) return forbiddenResponse();

  const orgs = await db.select({
    id: organizacoes.id,
    nome: organizacoes.nome,
    slug: organizacoes.slug,
    dominio: organizacoes.dominio,
    corPrimaria: organizacoes.corPrimaria,
    whatsappEnabled: organizacoes.whatsappEnabled,
    maxUsuarios: organizacoes.maxUsuarios,
    maxLeads: organizacoes.maxLeads,
    ativo: organizacoes.ativo,
    createdAt: organizacoes.createdAt,
  }).from(organizacoes).orderBy(organizacoes.nome);

  // Get user counts and session counts per org
  const userCounts = await db.select({
    organizacaoId: usuarios.organizacaoId,
    count: rawSql<number>`count(*)::int`,
  }).from(usuarios).groupBy(usuarios.organizacaoId);

  const sessionCounts = await db.select({
    organizacaoId: whatsappSessao.organizacaoId,
    count: rawSql<number>`count(*)::int`,
  }).from(whatsappSessao).groupBy(whatsappSessao.organizacaoId);

  const ucMap = Object.fromEntries(userCounts.map(u => [u.organizacaoId, u.count]));
  const scMap = Object.fromEntries(sessionCounts.map(s => [s.organizacaoId, s.count]));

  const result = orgs.map(org => ({
    ...org,
    totalUsuarios: ucMap[org.id] || 0,
    totalSessoes: scMap[org.id] || 0,
  }));

  return NextResponse.json(result);
}

// POST /api/admin/organizacoes — create organization
export async function POST(request: NextRequest) {
  const ctx = await getSuperAdminContext();
  if (!ctx) return forbiddenResponse();

  const body = await request.json();
  const { nome, slug, dominio, corPrimaria, whatsappEnabled, maxUsuarios, maxLeads } = body;

  if (!nome || !slug) {
    return NextResponse.json({ error: "nome and slug are required" }, { status: 400 });
  }

  // Check slug uniqueness
  const [existing] = await db.select({ id: organizacoes.id }).from(organizacoes).where(eq(organizacoes.slug, slug)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
  }

  const [org] = await db.insert(organizacoes).values({
    nome,
    slug,
    dominio: dominio || null,
    corPrimaria: corPrimaria || "#1E3A5F",
    whatsappEnabled: whatsappEnabled ?? false,
    maxUsuarios: maxUsuarios ?? 10,
    maxLeads: maxLeads ?? 5000,
  }).returning();

  return NextResponse.json(org, { status: 201 });
}
