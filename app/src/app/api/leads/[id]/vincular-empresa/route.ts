import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, empresas } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const vincularEmpresaSchema = z.object({
  empresaId: z.string().uuid().optional(),
  criar: z.boolean().optional(),
  nome: z.string().optional(),
  cnpj: z.string().optional(),
  setor: z.string().optional(),
}).refine(
  (data) => data.empresaId || data.criar,
  { message: "Informe empresaId ou criar=true" }
).refine(
  (data) => !data.criar || data.nome,
  { message: "Nome é obrigatório ao criar empresa" }
);

// POST /api/leads/:id/vincular-empresa — link or create empresa for lead
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const parsed = vincularEmpresaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  // Fetch lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  let empresaId: string;

  if (parsed.data.empresaId) {
    // Validate empresa exists and belongs to org
    const [empresa] = await db
      .select()
      .from(empresas)
      .where(and(eq(empresas.id, parsed.data.empresaId), eq(empresas.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!empresa) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }

    empresaId = empresa.id;
  } else {
    // Create new empresa
    const [newEmpresa] = await db
      .insert(empresas)
      .values({
        organizacaoId: ctx.organizacaoId,
        nome: parsed.data.nome!,
        cnpj: parsed.data.cnpj || null,
        setor: parsed.data.setor || null,
      })
      .returning();

    empresaId = newEmpresa.id;
  }

  // Set empresa on lead
  const [updatedLead] = await db
    .update(leads)
    .set({ empresaId, updatedAt: new Date() })
    .where(eq(leads.id, id))
    .returning();

  return NextResponse.json({ lead: updatedLead, empresaId }, { status: parsed.data.criar ? 201 : 200 });
}
