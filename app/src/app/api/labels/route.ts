import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { labels } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const createLabelSchema = z.object({
  nome: z.string().min(1).max(50),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve ser hex válido (#RRGGBB)"),
});

// GET /api/labels — list all labels for current org
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const result = await db
    .select()
    .from(labels)
    .where(eq(labels.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(labels.createdAt));

  return NextResponse.json(result);
}

// POST /api/labels — create a new label
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createLabelSchema.parse(body);

    const [newLabel] = await db
      .insert(labels)
      .values({
        nome: data.nome,
        cor: data.cor,
        organizacaoId: ctx.organizacaoId,
      })
      .returning();

    return NextResponse.json(newLabel, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    console.error("Error creating label:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
