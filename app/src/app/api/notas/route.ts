import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notas, usuarios } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const createSchema = z.object({
  conteudo: z.string().min(1),
  leadId: z.string().uuid().optional().nullable(),
  negocioId: z.string().uuid().optional().nullable(),
  empresaId: z.string().uuid().optional().nullable(),
});

// GET /api/notas — list notes for the org
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");
  const negocioId = searchParams.get("negocioId");
  const empresaId = searchParams.get("empresaId");

  const conditions = [eq(notas.organizacaoId, ctx.organizacaoId)];

  if (leadId) conditions.push(eq(notas.leadId, leadId));
  if (negocioId) conditions.push(eq(notas.negocioId, negocioId));
  if (empresaId) conditions.push(eq(notas.empresaId, empresaId));

  const result = await db.select({
    id: notas.id,
    conteudo: notas.conteudo,
    leadId: notas.leadId,
    negocioId: notas.negocioId,
    empresaId: notas.empresaId,
    autorId: notas.autorId,
    autorNome: usuarios.nome,
    createdAt: notas.createdAt,
    updatedAt: notas.updatedAt,
  }).from(notas)
    .leftJoin(usuarios, eq(notas.autorId, usuarios.id))
    .where(and(...conditions))
    .orderBy(desc(notas.createdAt));

  return NextResponse.json(result);
}

// POST /api/notas — create note
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const [nota] = await db.insert(notas).values({
      organizacaoId: ctx.organizacaoId,
      conteudo: data.conteudo,
      leadId: data.leadId || null,
      negocioId: data.negocioId || null,
      empresaId: data.empresaId || null,
      autorId: ctx.userId,
    }).returning();

    return NextResponse.json(nota, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
