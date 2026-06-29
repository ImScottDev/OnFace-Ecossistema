import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contratos, leads, npsRespostas } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const updateContratoSchema = z.object({
  tipo: z.enum(["safety_everywhere", "fwaas", "projeto", "consultoria", "resposta_incidente"]).optional(),
  descricao: z.string().optional().nullable(),
  moeda: z.enum(["BRL", "USD", "EUR", "CAD"]).optional(),
  mrr: z.string().optional().nullable(),
  valorSetup: z.string().optional().nullable(),
  servicos: z.array(z.string()).optional().nullable(),
  inicio: z.string().optional().nullable(),
  vencimento: z.string().optional().nullable(),
  renovacaoAuto: z.boolean().optional(),
  status: z.enum(["ativo", "pausado", "cancelado", "renovado"]).optional(),
  notas: z.string().optional().nullable(),
});

// GET /api/contratos/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  const [contrato] = await db
    .select({
      id: contratos.id,
      leadId: contratos.leadId,
      tipo: contratos.tipo,
      descricao: contratos.descricao,
      moeda: contratos.moeda,
      mrr: contratos.mrr,
      valorSetup: contratos.valorSetup,
      servicos: contratos.servicos,
      inicio: contratos.inicio,
      vencimento: contratos.vencimento,
      renovacaoAuto: contratos.renovacaoAuto,
      status: contratos.status,
      notas: contratos.notas,
      createdAt: contratos.createdAt,
      updatedAt: contratos.updatedAt,
      leadNome: leads.nome,
      leadEmpresa: leads.empresa,
      leadEmail: leads.email,
      leadTelefone: leads.telefone,
    })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(eq(contratos.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!contrato) {
    return NextResponse.json({ error: "Contrato nao encontrado" }, { status: 404 });
  }

  const npsHistory = await db
    .select()
    .from(npsRespostas)
    .where(eq(npsRespostas.contratoId, id))
    .orderBy(desc(npsRespostas.createdAt));

  return NextResponse.json({ contrato, npsRespostas: npsHistory });
}

// PATCH /api/contratos/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { id } = await params;

  // Verify contrato belongs to org via lead
  const [existing] = await db
    .select({ id: contratos.id })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(and(eq(contratos.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Contrato nao encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateContratoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(contratos)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(contratos.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Contrato nao encontrado" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
