import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailSequenciaExecucoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getTenantContext, unauthorizedResponse } from "@/lib/auth/tenant";

const updateSchema = z.object({
  action: z.enum(["pausar", "retomar", "cancelar"]),
});

// PATCH /api/email/sequencias/execucoes/:id — pause/resume/cancel execution
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  const { id } = await params;

  try {
    const body = await request.json();
    const { action } = updateSchema.parse(body);

    const statusMap = {
      pausar: "pausado",
      retomar: "ativo",
      cancelar: "cancelado",
    };

    const updates: Record<string, unknown> = { status: statusMap[action] };
    if (action === "cancelar") updates.concluidoAt = new Date();

    const [updated] = await db.update(emailSequenciaExecucoes)
      .set(updates)
      .where(eq(emailSequenciaExecucoes.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Execução não encontrada" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
