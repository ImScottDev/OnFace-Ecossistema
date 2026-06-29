import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunioes, usuarios } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const createSchema = z.object({
  negocioId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  titulo: z.string().min(1),
  data: z.string().min(1), // ISO string
  duracao: z.number().int().positive().optional().nullable(),
  tipo: z.enum(["call", "presencial", "video"]).optional(),
  status: z.enum(["agendada", "realizada", "cancelada", "no_show"]).optional(),
  participantes: z.array(z.string()).optional().nullable(),
  notas: z.string().optional().nullable(),
  transcript: z.string().optional().nullable(),
  resumoTranscript: z.string().optional().nullable(),
});

// GET /api/reunioes
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const negocioId = searchParams.get("negocioId");
  const leadId = searchParams.get("leadId");
  const status = searchParams.get("status");

  const conditions = [eq(reunioes.organizacaoId, ctx.organizacaoId)];
  if (negocioId) conditions.push(eq(reunioes.negocioId, negocioId));
  if (leadId) conditions.push(eq(reunioes.leadId, leadId));
  if (status) conditions.push(eq(reunioes.status, status));

  const result = await db
    .select({
      id: reunioes.id,
      negocioId: reunioes.negocioId,
      leadId: reunioes.leadId,
      titulo: reunioes.titulo,
      data: reunioes.data,
      duracao: reunioes.duracao,
      tipo: reunioes.tipo,
      status: reunioes.status,
      participantes: reunioes.participantes,
      notas: reunioes.notas,
      transcript: reunioes.transcript,
      resumoTranscript: reunioes.resumoTranscript,
      responsavelNome: usuarios.nome,
      createdAt: reunioes.createdAt,
    })
    .from(reunioes)
    .leftJoin(usuarios, eq(reunioes.responsavelId, usuarios.id))
    .where(and(...conditions))
    .orderBy(desc(reunioes.data));

  return NextResponse.json(result);
}

// POST /api/reunioes
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const [reuniao] = await db
      .insert(reunioes)
      .values({
        organizacaoId: ctx.organizacaoId,
        negocioId: data.negocioId || null,
        leadId: data.leadId || null,
        titulo: data.titulo,
        data: new Date(data.data),
        duracao: data.duracao || null,
        tipo: data.tipo || "call",
        status: data.status || "agendada",
        participantes: data.participantes || null,
        notas: data.notas || null,
        transcript: data.transcript || null,
        resumoTranscript: data.resumoTranscript || null,
        responsavelId: ctx.userId,
      })
      .returning();

    return NextResponse.json(reuniao, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    throw err;
  }
}
