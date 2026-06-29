import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contatoListas, leadListas } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

// GET /api/contatos-unified/listas — list all listas with member count
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const listas = await db
    .select({
      id: contatoListas.id,
      nome: contatoListas.nome,
      cor: contatoListas.cor,
      descricao: contatoListas.descricao,
      createdAt: contatoListas.createdAt,
      count: sql<number>`(SELECT count(*) FROM lead_listas WHERE lista_id = ${contatoListas.id})`,
    })
    .from(contatoListas)
    .where(eq(contatoListas.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(contatoListas.createdAt));

  return NextResponse.json(listas);
}

// POST /api/contatos-unified/listas — create lista OR add/remove members
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const body = await request.json();

  // If action is provided, it's an add/remove operation
  if (body.action === "add" && body.listaId && body.leadIds?.length) {
    for (const leadId of body.leadIds) {
      await db.insert(leadListas).values({ leadId, listaId: body.listaId }).onConflictDoNothing();
    }
    return NextResponse.json({ ok: true, added: body.leadIds.length });
  }

  if (body.action === "remove" && body.listaId && body.leadIds?.length) {
    for (const leadId of body.leadIds) {
      await db.delete(leadListas).where(and(eq(leadListas.leadId, leadId), eq(leadListas.listaId, body.listaId)));
    }
    return NextResponse.json({ ok: true, removed: body.leadIds.length });
  }

  // Create new lista
  const { nome, cor, descricao } = body;
  if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const [lista] = await db
    .insert(contatoListas)
    .values({
      organizacaoId: ctx.organizacaoId,
      nome,
      cor: cor || "#e23752",
      descricao: descricao || null,
    })
    .returning();

  return NextResponse.json(lista);
}

// DELETE /api/contatos-unified/listas?id=xxx — delete lista
export async function DELETE(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  await db.delete(contatoListas).where(and(eq(contatoListas.id, id), eq(contatoListas.organizacaoId, ctx.organizacaoId)));

  return NextResponse.json({ ok: true });
}
