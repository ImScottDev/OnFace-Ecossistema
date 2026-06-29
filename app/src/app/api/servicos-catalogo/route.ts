import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { servicosCatalogo } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const createSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  tipo: z.enum(["recorrente", "avulso", "setup"]),
  valorSugerido: z.string().optional(),
  unidade: z.enum(["mensal", "hora", "unidade", "projeto"]).default("mensal"),
  ordem: z.number().int().optional(),
});

export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const showAll = request.nextUrl.searchParams.get("all") === "true";

  const conditions = [eq(servicosCatalogo.organizacaoId, ctx.organizacaoId)];
  if (!showAll) {
    conditions.push(eq(servicosCatalogo.ativo, true));
  }

  const items = await db
    .select()
    .from(servicosCatalogo)
    .where(and(...conditions))
    .orderBy(asc(servicosCatalogo.ordem), asc(servicosCatalogo.nome));

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const [item] = await db
    .insert(servicosCatalogo)
    .values({
      organizacaoId: ctx.organizacaoId,
      nome: parsed.data.nome,
      descricao: parsed.data.descricao,
      tipo: parsed.data.tipo,
      valorSugerido: parsed.data.valorSugerido,
      unidade: parsed.data.unidade,
      ordem: parsed.data.ordem ?? 0,
    })
    .returning();

  return NextResponse.json(item, { status: 201 });
}
