import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customFields } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const createSchema = z.object({
  entidade: z.enum(["lead", "empresa", "negocio"]),
  nome: z.string().min(1),
  label: z.string().min(1),
  tipo: z.enum(["text", "number", "date", "daterange", "enum", "boolean", "url"]),
  opcoes: z.array(z.string()).optional().nullable(),
  obrigatorio: z.boolean().optional(),
  ordem: z.number().int().optional(),
});

// GET /api/custom-fields — list definitions for org
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const entidade = new URL(request.url).searchParams.get("entidade");

  const conditions = [eq(customFields.organizacaoId, ctx.organizacaoId), eq(customFields.ativo, true)];
  if (entidade) {
    conditions.push(eq(customFields.entidade, entidade));
  }

  const data = await db
    .select()
    .from(customFields)
    .where(and(...conditions))
    .orderBy(asc(customFields.ordem));

  return NextResponse.json(data);
}

// POST /api/custom-fields — create definition (admin only)
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  if (!["admin", "super_admin"].includes(ctx.userRole)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const [field] = await db
    .insert(customFields)
    .values({
      organizacaoId: ctx.organizacaoId,
      entidade: parsed.data.entidade,
      nome: parsed.data.nome,
      label: parsed.data.label,
      tipo: parsed.data.tipo,
      opcoes: parsed.data.opcoes || null,
      obrigatorio: parsed.data.obrigatorio ?? false,
      ordem: parsed.data.ordem ?? 0,
    })
    .returning();

  return NextResponse.json(field, { status: 201 });
}
