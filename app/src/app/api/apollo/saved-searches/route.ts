import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buscasSalvas } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// GET /api/apollo/saved-searches — list saved searches
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const searches = await db
    .select()
    .from(buscasSalvas)
    .where(eq(buscasSalvas.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(buscasSalvas.updatedAt));

  return NextResponse.json(searches);
}

// POST /api/apollo/saved-searches — create saved search
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { nome, filtros } = await request.json();
  if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const [search] = await db
    .insert(buscasSalvas)
    .values({
      organizacaoId: ctx.organizacaoId,
      nome,
      filtros: filtros || {},
    })
    .returning();

  return NextResponse.json(search);
}

// DELETE /api/apollo/saved-searches — delete by id (passed as query param)
export async function DELETE(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  await db
    .delete(buscasSalvas)
    .where(and(eq(buscasSalvas.id, id), eq(buscasSalvas.organizacaoId, ctx.organizacaoId)));

  return NextResponse.json({ ok: true });
}
