import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailSequencias, emailSequenciaPassos, emailSequenciaExecucoes, emailContas, leads } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const executeSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1),
  contaId: z.string().uuid(),
});

// POST /api/email/sequencias/:id/executar — start sequence for leads
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  try {
    const body = await request.json();
    const data = executeSchema.parse(body);

    // Verify sequence exists and is active
    const [sequencia] = await db.select()
      .from(emailSequencias)
      .where(and(eq(emailSequencias.id, id), eq(emailSequencias.organizacaoId, ctx.organizacaoId), eq(emailSequencias.ativo, true)))
      .limit(1);
    if (!sequencia) return NextResponse.json({ error: "Sequência não encontrada ou inativa" }, { status: 404 });

    // Verify account
    const [conta] = await db.select({ id: emailContas.id })
      .from(emailContas)
      .where(and(eq(emailContas.id, data.contaId), eq(emailContas.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!conta) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

    // Get first step to calculate initial delay
    const [firstStep] = await db.select()
      .from(emailSequenciaPassos)
      .where(eq(emailSequenciaPassos.sequenciaId, id))
      .orderBy(emailSequenciaPassos.ordem)
      .limit(1);

    const now = new Date();
    const delayMs = (firstStep?.delayMinutos || 0) * 60 * 1000;
    const nextExecution = new Date(now.getTime() + delayMs);

    const execucoes = [];
    for (const leadId of data.leadIds) {
      // Verify lead
      const [lead] = await db.select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
        .limit(1);
      if (!lead) continue;

      const [exec] = await db.insert(emailSequenciaExecucoes).values({
        sequenciaId: id,
        leadId,
        contaId: data.contaId,
        passoAtual: 0,
        status: "ativo",
        proximaExecucaoAt: nextExecution,
        iniciadoAt: now,
      }).returning();

      execucoes.push(exec);
    }

    return NextResponse.json({ execucoes, count: execucoes.length }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
