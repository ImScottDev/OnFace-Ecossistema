import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contratos, leads } from "@/lib/db/schema";
import { desc, eq, and, SQL } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const createContratoSchema = z.object({
  leadId: z.string().uuid(),
  tipo: z.enum(["safety_everywhere", "fwaas", "projeto", "consultoria", "resposta_incidente"]),
  descricao: z.string().optional().nullable(),
  mrr: z.string().optional().nullable(),
  valorSetup: z.string().optional().nullable(),
  servicos: z.array(z.string()).optional().nullable(),
  inicio: z.string().optional().nullable(),
  vencimento: z.string().optional().nullable(),
  renovacaoAuto: z.boolean().optional(),
});

// GET /api/contratos
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const tipo = searchParams.get("tipo");

  const conditions: SQL[] = [eq(leads.organizacaoId, ctx.organizacaoId)];
  if (status) conditions.push(eq(contratos.status, status));
  if (tipo) conditions.push(eq(contratos.tipo, tipo));

  const where = and(...conditions);

  const result = await db
    .select({
      id: contratos.id,
      leadId: contratos.leadId,
      tipo: contratos.tipo,
      descricao: contratos.descricao,
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
    })
    .from(contratos)
    .innerJoin(leads, eq(contratos.leadId, leads.id))
    .where(where)
    .orderBy(desc(contratos.createdAt));

  return NextResponse.json({ contratos: result });
}

// POST /api/contratos
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const body = await request.json();
  const parsed = createContratoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify lead belongs to org
  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, parsed.data.leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "Lead nao encontrado" }, { status: 404 });
  }

  const [contrato] = await db
    .insert(contratos)
    .values({
      leadId: parsed.data.leadId,
      tipo: parsed.data.tipo,
      descricao: parsed.data.descricao,
      mrr: parsed.data.mrr,
      valorSetup: parsed.data.valorSetup,
      servicos: parsed.data.servicos,
      inicio: parsed.data.inicio,
      vencimento: parsed.data.vencimento,
      renovacaoAuto: parsed.data.renovacaoAuto,
    })
    .returning();

  return NextResponse.json(contrato, { status: 201 });
}
