import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, negocios } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const converterSchema = z.object({
  titulo: z.string().min(1),
  mrrEstimado: z.string().optional().nullable(),
  valorProjeto: z.string().optional().nullable(),
  tipoReceita: z.enum(["recorrente", "projeto", "hibrido"]).optional(),
  servicosInteresse: z.array(z.string()).optional().nullable(),
  origemNegocio: z.enum(["novo", "carteira"]).optional(),
});

// POST /api/contatos/:id/converter — convert contato → lead + create negócio
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const parsed = converterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  // Verify contato belongs to org and is tipo=contato
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
  }

  if (lead.tipo !== "contato") {
    return NextResponse.json({ error: "Este contato já é um lead ou cliente" }, { status: 400 });
  }

  // Promote to lead
  await db.update(leads).set({
    tipo: "lead",
    updatedAt: new Date(),
  }).where(eq(leads.id, id));

  // Create negócio
  const [negocio] = await db
    .insert(negocios)
    .values({
      organizacaoId: ctx.organizacaoId,
      leadId: id,
      titulo: parsed.data.titulo,
      tipoReceita: parsed.data.tipoReceita,
      mrrEstimado: parsed.data.mrrEstimado,
      valorProjeto: parsed.data.valorProjeto,
      servicosInteresse: parsed.data.servicosInteresse,
      origemNegocio: parsed.data.origemNegocio || "novo",
      origemQualificacao: "direta", // conversão de contato: negócio nasce sem fluxo de reunião
      responsavelId: ctx.userId,
    })
    .returning();

  return NextResponse.json({ lead: { ...lead, tipo: "lead" }, negocio }, { status: 201 });
}
