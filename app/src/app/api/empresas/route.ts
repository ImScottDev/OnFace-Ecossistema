import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { empresas, leads, negocios } from "@/lib/db/schema";
import { eq, and, ilike, or, desc, count, SQL } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const createEmpresaSchema = z.object({
  nome: z.string().min(1),
  cnpj: z.string().optional().nullable(),
  setor: z.string().optional().nullable(),
  porte: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  numUsuariosTi: z.number().int().optional().nullable(),
  numFiliais: z.number().int().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

// GET /api/empresas — list companies
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const search = searchParams.get("search");
  const setor = searchParams.get("setor");

  const conditions: SQL[] = [eq(empresas.organizacaoId, ctx.organizacaoId)];
  if (setor) conditions.push(eq(empresas.setor, setor));
  if (search) {
    const pat = `%${search}%`;
    conditions.push(or(ilike(empresas.nome, pat), ilike(empresas.cnpj, pat))!);
  }

  const where = and(...conditions);

  const [data, totalResult] = await Promise.all([
    db.select().from(empresas).where(where).orderBy(desc(empresas.updatedAt)).limit(limit).offset((page - 1) * limit),
    db.select({ count: count() }).from(empresas).where(where),
  ]);

  return NextResponse.json({
    empresas: data,
    total: Number(totalResult[0].count),
    page,
    totalPages: Math.ceil(Number(totalResult[0].count) / limit),
  });
}

// POST /api/empresas — create company
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const body = await request.json();
  const parsed = createEmpresaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const [empresa] = await db
    .insert(empresas)
    .values({ ...parsed.data, organizacaoId: ctx.organizacaoId })
    .returning();

  return NextResponse.json(empresa, { status: 201 });
}
