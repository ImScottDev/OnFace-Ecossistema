import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tarefas, leads } from "@/lib/db/schema";
import { desc, eq, and, lte, SQL, asc, isNull } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const createTarefaSchema = z.object({
  leadId: z.string().uuid().optional().nullable(),
  titulo: z.string().min(1),
  descricao: z.string().optional().nullable(),
  tipo: z.enum(["follow_up", "ligar", "enviar_proposta", "diagnostico", "renovacao", "nps", "upsell", "geral"]),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]).optional(),
  dataVencimento: z.string().optional().nullable(),
});

// GET /api/tarefas
export async function GET(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const concluida = searchParams.get("concluida");
  const leadId = searchParams.get("leadId");
  const tipo = searchParams.get("tipo");
  const data = searchParams.get("data") || "all";

  const conditions: SQL[] = [eq(tarefas.usuarioId, ctx.userId)];

  if (concluida !== null && concluida !== "") {
    conditions.push(eq(tarefas.concluida, concluida === "true"));
  } else {
    // Default: pending
    conditions.push(eq(tarefas.concluida, false));
  }

  if (leadId) {
    conditions.push(eq(tarefas.leadId, leadId));
  }

  if (tipo) {
    conditions.push(eq(tarefas.tipo, tipo));
  }

  if (data === "today") {
    const today = new Date().toISOString().split("T")[0];
    conditions.push(lte(tarefas.dataVencimento, today));
  } else if (data === "overdue") {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    conditions.push(lte(tarefas.dataVencimento, yesterday));
  }

  const where = and(...conditions);

  const prioridadeOrder = [
    { value: "urgente", rank: 0 },
    { value: "alta", rank: 1 },
    { value: "media", rank: 2 },
    { value: "baixa", rank: 3 },
  ];

  const result = await db
    .select()
    .from(tarefas)
    .where(where)
    .orderBy(asc(tarefas.dataVencimento), asc(tarefas.createdAt));

  // Sort by prioridade in JS since drizzle doesn't have CASE easily
  result.sort((a, b) => {
    // First by dataVencimento
    if (a.dataVencimento && b.dataVencimento) {
      if (a.dataVencimento < b.dataVencimento) return -1;
      if (a.dataVencimento > b.dataVencimento) return 1;
    } else if (a.dataVencimento && !b.dataVencimento) return -1;
    else if (!a.dataVencimento && b.dataVencimento) return 1;

    // Then by prioridade
    const rankA = prioridadeOrder.find((p) => p.value === a.prioridade)?.rank ?? 2;
    const rankB = prioridadeOrder.find((p) => p.value === b.prioridade)?.rank ?? 2;
    return rankA - rankB;
  });

  return NextResponse.json({ tarefas: result });
}

// POST /api/tarefas
export async function POST(request: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const body = await request.json();
  const parsed = createTarefaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // If leadId provided, verify it belongs to org
  if (parsed.data.leadId) {
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, parsed.data.leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: "Lead nao encontrado" }, { status: 404 });
    }
  }

  const [tarefa] = await db
    .insert(tarefas)
    .values({
      leadId: parsed.data.leadId,
      usuarioId: ctx.userId,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      tipo: parsed.data.tipo,
      prioridade: parsed.data.prioridade || "media",
      dataVencimento: parsed.data.dataVencimento,
    })
    .returning();

  return NextResponse.json(tarefa, { status: 201 });
}
