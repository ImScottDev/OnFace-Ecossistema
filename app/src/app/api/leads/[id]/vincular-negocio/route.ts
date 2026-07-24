import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, negocios } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const vincularNegocioSchema = z.object({
  negocioId: z.string().uuid().optional(),
  criar: z.boolean().optional(),
  titulo: z.string().optional(),
}).refine(
  (data) => data.negocioId || data.criar,
  { message: "Informe negocioId ou criar=true" }
);

// POST /api/leads/:id/vincular-negocio — link or create negocio for lead
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const parsed = vincularNegocioSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  // Fetch lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  let negocioId: string;

  if (parsed.data.negocioId) {
    // Validate negocio exists and belongs to org
    const [negocio] = await db
      .select()
      .from(negocios)
      .where(and(eq(negocios.id, parsed.data.negocioId), eq(negocios.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!negocio) {
      return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });
    }

    negocioId = negocio.id;
  } else {
    // Create new negocio
    const [newNegocio] = await db
      .insert(negocios)
      .values({
        organizacaoId: ctx.organizacaoId,
        leadId: id,
        empresaId: lead.empresaId,
        titulo: parsed.data.titulo || `Negócio - ${lead.nome}`,
        origemQualificacao: "direta", // vínculo manual de negócio, sem fluxo de reunião
        responsavelId: lead.responsavelId || ctx.userId,
      })
      .returning();

    negocioId = newNegocio.id;
  }

  // Set as active negocio on lead
  const [updatedLead] = await db
    .update(leads)
    .set({ negocioAtivoId: negocioId, updatedAt: new Date() })
    .where(eq(leads.id, id))
    .returning();

  return NextResponse.json({ lead: updatedLead, negocioId }, { status: parsed.data.criar ? 201 : 200 });
}
