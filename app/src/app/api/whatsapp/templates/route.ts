import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { whatsappTemplates } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const createTemplateSchema = z.object({
  nome: z.string().min(1),
  categoria: z.enum([
    "primeiro_contato",
    "follow_up",
    "proposta",
    "pos_venda",
    "geral",
  ]),
  conteudo: z.string().min(1),
  botoes: z.any().optional(),
});

// GET /api/whatsapp/templates — list all active templates
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const templates = await db
    .select()
    .from(whatsappTemplates)
    .where(and(eq(whatsappTemplates.ativo, true), eq(whatsappTemplates.organizacaoId, ctx.organizacaoId)))
    .orderBy(asc(whatsappTemplates.categoria), asc(whatsappTemplates.nome));

  return NextResponse.json({ templates });
}

// POST /api/whatsapp/templates — create a new template
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const body = await request.json();
  const parsed = createTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [template] = await db
    .insert(whatsappTemplates)
    .values({
      ...parsed.data,
      organizacaoId: ctx.organizacaoId,
    })
    .returning();

  return NextResponse.json(template, { status: 201 });
}
