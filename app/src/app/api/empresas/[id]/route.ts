import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { empresas, leads, negocios, negocioLeads, notas, usuarios } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const updateEmpresaSchema = z.object({
  nome: z.string().min(1).optional(),
  cnpj: z.string().optional().nullable(),
  setor: z.string().optional().nullable(),
  porte: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  numUsuariosTi: z.number().int().optional().nullable(),
  numFiliais: z.number().int().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  camposCustom: z.record(z.string(), z.unknown()).optional(),
});

// GET /api/empresas/:id — company detail with leads and negocios
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [empresa] = await db
    .select()
    .from(empresas)
    .where(and(eq(empresas.id, id), eq(empresas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!empresa) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const [empresaLeads, empresaNegocios, empresaNotas] = await Promise.all([
    db.select().from(leads).where(eq(leads.empresaId, id)).orderBy(desc(leads.updatedAt)),
    db.select().from(negocios).where(eq(negocios.empresaId, id)).orderBy(desc(negocios.createdAt)),
    db.select({
      id: notas.id,
      conteudo: notas.conteudo,
      autorNome: usuarios.nome,
      createdAt: notas.createdAt,
    }).from(notas)
      .leftJoin(usuarios, eq(notas.autorId, usuarios.id))
      .where(eq(notas.empresaId, id))
      .orderBy(desc(notas.createdAt)),
  ]);

  return NextResponse.json({ empresa, leads: empresaLeads, negocios: empresaNegocios, notas: empresaNotas });
}

// PATCH /api/empresas/:id — update company
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const parsed = updateEmpresaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(empresas)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(empresas.id, id), eq(empresas.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/empresas/:id — delete company (only if no leads/negocios linked)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [empresa] = await db
    .select({ id: empresas.id })
    .from(empresas)
    .where(and(eq(empresas.id, id), eq(empresas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!empresa) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  // Check for linked leads or negocios
  const [linkedLeads] = await db.select({ id: leads.id }).from(leads).where(eq(leads.empresaId, id)).limit(1);
  const [linkedNegocios] = await db.select({ id: negocios.id }).from(negocios).where(eq(negocios.empresaId, id)).limit(1);

  if (linkedLeads || linkedNegocios) {
    return NextResponse.json(
      { error: "Não é possível excluir empresa com leads ou negócios vinculados. Desvincule-os primeiro." },
      { status: 400 }
    );
  }

  await db.delete(empresas).where(eq(empresas.id, id));
  return NextResponse.json({ ok: true });
}
