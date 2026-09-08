import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTenantContext, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/tenant";
import { buildPipelineConfig, type PipelineConfig } from "@/lib/crm/pipeline";

// GET — return the current pipeline config for the org
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();

  const [org] = await db
    .select({ pipelineConfig: organizacoes.pipelineConfig })
    .from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId))
    .limit(1);

  const config = buildPipelineConfig(org?.pipelineConfig as Partial<PipelineConfig> | null);
  return NextResponse.json(config);
}

// PUT — update pipeline config (admin/super_admin only)
export async function PUT(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return unauthorizedResponse();
  if (!["admin", "super_admin"].includes(ctx.userRole)) return forbiddenResponse();

  const body = await req.json() as Partial<PipelineConfig>;

  // Validate stages have required fields
  if (body.stages) {
    for (const stage of body.stages) {
      if (!stage.key || !stage.label || !stage.color) {
        return NextResponse.json({ error: "Cada etapa precisa de key, label e color" }, { status: 400 });
      }
      // Sanitize key to slug format
      stage.key = stage.key.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    }
    // Check for duplicate keys
    const keys = body.stages.map((s) => s.key);
    if (new Set(keys).size !== keys.length) {
      return NextResponse.json({ error: "Chaves de etapa duplicadas" }, { status: 400 });
    }
  }

  if (body.closedStages) {
    for (const stage of body.closedStages) {
      if (!stage.key || !stage.label || !stage.color) {
        return NextResponse.json({ error: "Cada etapa de fechamento precisa de key, label e color" }, { status: 400 });
      }
      stage.key = stage.key.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    }
  }

  // Merge with existing config (so partial updates work)
  const [org] = await db
    .select({ pipelineConfig: organizacoes.pipelineConfig })
    .from(organizacoes)
    .where(eq(organizacoes.id, ctx.organizacaoId))
    .limit(1);

  const current = buildPipelineConfig(org?.pipelineConfig as Partial<PipelineConfig> | null);
  const updated: PipelineConfig = {
    stages: body.stages || current.stages,
    closedStages: body.closedStages || current.closedStages,
    lossReasons: body.lossReasons || current.lossReasons,
    disqualifyReasons: body.disqualifyReasons || current.disqualifyReasons,
    setores: body.setores || current.setores,
    origens: body.origens || current.origens,
    servicos: body.servicos || current.servicos,
  };

  await db
    .update(organizacoes)
    .set({ pipelineConfig: updated, updatedAt: new Date() })
    .where(eq(organizacoes.id, ctx.organizacaoId));

  return NextResponse.json(updated);
}
