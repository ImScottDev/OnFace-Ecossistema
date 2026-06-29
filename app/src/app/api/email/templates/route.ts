import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailTemplates } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";
import { extractVariables } from "@/lib/email/template-engine";

const createSchema = z.object({
  nome: z.string().min(1).max(100),
  assunto: z.string().min(1),
  corpo: z.string().min(1),
  categoria: z.string().optional(),
});

// GET /api/email/templates — list templates
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const templates = await db.select()
    .from(emailTemplates)
    .where(eq(emailTemplates.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(emailTemplates.updatedAt));

  return NextResponse.json(templates);
}

// POST /api/email/templates — create template
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    // Auto-extract variables from template
    const vars = extractVariables(data.assunto + " " + data.corpo);

    const [template] = await db.insert(emailTemplates).values({
      organizacaoId: ctx.organizacaoId,
      nome: data.nome,
      assunto: data.assunto,
      corpo: data.corpo,
      variaveis: vars,
      categoria: data.categoria || null,
    }).returning();

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
