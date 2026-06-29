import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reunioes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const updateSchema = z.object({
  titulo: z.string().min(1).optional(),
  data: z.string().optional(),
  duracao: z.number().int().positive().optional().nullable(),
  tipo: z.enum(["call", "presencial", "video"]).optional(),
  status: z.enum(["agendada", "realizada", "cancelada", "no_show"]).optional(),
  participantes: z.array(z.string()).optional().nullable(),
  notas: z.string().optional().nullable(),
  transcript: z.string().optional().nullable(),
  resumoTranscript: z.string().optional().nullable(),
});

// GET /api/reunioes/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [reuniao] = await db
    .select()
    .from(reunioes)
    .where(and(eq(reunioes.id, id), eq(reunioes.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!reuniao) {
    return NextResponse.json({ error: "Reunião não encontrada" }, { status: 404 });
  }

  return NextResponse.json(reuniao);
}

// PATCH /api/reunioes/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.titulo !== undefined) updates.titulo = data.titulo;
    if (data.data !== undefined) updates.data = new Date(data.data);
    if (data.duracao !== undefined) updates.duracao = data.duracao;
    if (data.tipo !== undefined) updates.tipo = data.tipo;
    if (data.status !== undefined) updates.status = data.status;
    if (data.participantes !== undefined) updates.participantes = data.participantes;
    if (data.notas !== undefined) updates.notas = data.notas;
    if (data.transcript !== undefined) updates.transcript = data.transcript;
    if (data.resumoTranscript !== undefined) updates.resumoTranscript = data.resumoTranscript;

    const [updated] = await db
      .update(reunioes)
      .set(updates)
      .where(and(eq(reunioes.id, id), eq(reunioes.organizacaoId, ctx.organizacaoId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Reunião não encontrada" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    throw err;
  }
}

// DELETE /api/reunioes/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [deleted] = await db
    .delete(reunioes)
    .where(and(eq(reunioes.id, id), eq(reunioes.organizacaoId, ctx.organizacaoId)))
    .returning({ id: reunioes.id });

  if (!deleted) {
    return NextResponse.json({ error: "Reunião não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
