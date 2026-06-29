import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { npsRespostas, leads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const submitNpsSchema = z.object({
  score: z.number().int().min(0).max(10),
  comentario: z.string().optional().nullable(),
});

// GET /api/nps/:token — public, no auth
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [nps] = await db
    .select({
      id: npsRespostas.id,
      tipo: npsRespostas.tipo,
      respondidoEm: npsRespostas.respondidoEm,
      leadNome: leads.nome,
      leadEmpresa: leads.empresa,
    })
    .from(npsRespostas)
    .leftJoin(leads, eq(npsRespostas.leadId, leads.id))
    .where(eq(npsRespostas.token, token))
    .limit(1);

  if (!nps) {
    return NextResponse.json({ error: "Pesquisa nao encontrada" }, { status: 404 });
  }

  if (nps.respondidoEm) {
    return NextResponse.json({ error: "Pesquisa ja respondida" }, { status: 400 });
  }

  return NextResponse.json({
    leadNome: nps.leadNome,
    tipo: nps.tipo,
  });
}

// POST /api/nps/:token — public, no auth
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const body = await request.json();
  const parsed = submitNpsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Find the NPS record
  const [nps] = await db
    .select()
    .from(npsRespostas)
    .where(eq(npsRespostas.token, token))
    .limit(1);

  if (!nps) {
    return NextResponse.json({ error: "Pesquisa nao encontrada" }, { status: 404 });
  }

  if (nps.respondidoEm) {
    return NextResponse.json({ error: "Pesquisa ja respondida" }, { status: 400 });
  }

  const [updated] = await db
    .update(npsRespostas)
    .set({
      score: parsed.data.score,
      comentario: parsed.data.comentario,
      respondidoEm: new Date(),
    })
    .where(eq(npsRespostas.token, token))
    .returning();

  // Update lead npsScore
  await db
    .update(leads)
    .set({ npsScore: parsed.data.score })
    .where(eq(leads.id, nps.leadId));

  return NextResponse.json({ message: "Resposta registrada com sucesso" });
}
