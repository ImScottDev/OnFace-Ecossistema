import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailSequencias, emailSequenciaPassos } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const passoSchema = z.object({
  ordem: z.number().int().min(0),
  tipo: z.enum(["email", "espera", "condicao"]),
  templateId: z.string().uuid().optional(),
  delayMinutos: z.number().int().min(0).default(0),
  condicao: z.record(z.string(), z.unknown()).optional(),
});

const createSchema = z.object({
  nome: z.string().min(1).max(100),
  descricao: z.string().optional(),
  gatilho: z.enum(["manual", "novo_lead", "mudanca_status"]).default("manual"),
  gatilhoConfig: z.record(z.string(), z.unknown()).optional(),
  passos: z.array(passoSchema).min(1),
});

// GET /api/email/sequencias — list sequences with step count
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const sequencias = await db.select()
    .from(emailSequencias)
    .where(eq(emailSequencias.organizacaoId, ctx.organizacaoId))
    .orderBy(desc(emailSequencias.updatedAt));

  // Fetch steps for each sequence
  const result = await Promise.all(
    sequencias.map(async (seq) => {
      const passos = await db.select()
        .from(emailSequenciaPassos)
        .where(eq(emailSequenciaPassos.sequenciaId, seq.id))
        .orderBy(emailSequenciaPassos.ordem);
      return { ...seq, passos };
    })
  );

  return NextResponse.json(result);
}

// POST /api/email/sequencias — create sequence with steps
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const [sequencia] = await db.insert(emailSequencias).values({
      organizacaoId: ctx.organizacaoId,
      nome: data.nome,
      descricao: data.descricao || null,
      gatilho: data.gatilho,
      gatilhoConfig: data.gatilhoConfig || null,
    }).returning();

    // Insert steps
    for (const passo of data.passos) {
      await db.insert(emailSequenciaPassos).values({
        sequenciaId: sequencia.id,
        ordem: passo.ordem,
        tipo: passo.tipo,
        templateId: passo.templateId || null,
        delayMinutos: passo.delayMinutos,
        condicao: passo.condicao || null,
      });
    }

    const passos = await db.select()
      .from(emailSequenciaPassos)
      .where(eq(emailSequenciaPassos.sequenciaId, sequencia.id))
      .orderBy(emailSequenciaPassos.ordem);

    return NextResponse.json({ ...sequencia, passos }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    console.error("[Sequencias] Create error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
