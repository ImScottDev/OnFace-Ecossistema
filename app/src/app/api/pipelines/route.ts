import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pipelines } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const createPipelineSchema = z.object({
  nome: z.string().min(1),
  slug: z.string().min(1),
  ordem: z.number().int().optional(),
  stages: z.array(z.object({
    key: z.string(),
    label: z.string(),
    color: z.string(),
    slaHours: z.number().optional(),
  })).optional(),
  closedStages: z.array(z.object({
    key: z.string(),
    label: z.string(),
    color: z.string(),
  })).optional(),
  isDefault: z.boolean().optional(),
});

// GET /api/pipelines — list pipelines for org
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const data = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.organizacaoId, ctx.organizacaoId))
    .orderBy(asc(pipelines.ordem));

  return NextResponse.json({ pipelines: data });
}

// POST /api/pipelines — create pipeline
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  if (!["admin", "super_admin"].includes(ctx.userRole)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createPipelineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const [pipeline] = await db
    .insert(pipelines)
    .values({
      organizacaoId: ctx.organizacaoId,
      nome: parsed.data.nome,
      slug: parsed.data.slug,
      ordem: parsed.data.ordem ?? 0,
      stages: parsed.data.stages ?? [],
      closedStages: parsed.data.closedStages ?? [],
      isDefault: parsed.data.isDefault ?? false,
    })
    .returning();

  return NextResponse.json(pipeline, { status: 201 });
}
