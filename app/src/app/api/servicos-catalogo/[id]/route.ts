import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { servicosCatalogo } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const updateSchema = z.object({
  nome: z.string().min(1).optional(),
  descricao: z.string().optional().nullable(),
  tipo: z.enum(["recorrente", "avulso", "setup"]).optional(),
  valorSugerido: z.string().optional().nullable(),
  unidade: z.enum(["mensal", "hora", "unidade", "projeto"]).optional(),
  ativo: z.boolean().optional(),
  ordem: z.number().int().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const [updated] = await db
    .update(servicosCatalogo)
    .set(parsed.data)
    .where(and(eq(servicosCatalogo.id, id), eq(servicosCatalogo.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  // Soft delete
  const [updated] = await db
    .update(servicosCatalogo)
    .set({ ativo: false })
    .where(and(eq(servicosCatalogo.id, id), eq(servicosCatalogo.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
