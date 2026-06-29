import { db } from "@/lib/db";
import { organizacoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildPipelineConfig, type PipelineConfig } from "./pipeline";

/**
 * Server-side: fetch pipeline config for an organization from DB.
 * Use this in server components / API routes.
 * For client components, use usePipelineConfig() hook instead.
 */
export async function getPipelineConfig(organizacaoId: string): Promise<PipelineConfig> {
  const [org] = await db
    .select({ pipelineConfig: organizacoes.pipelineConfig })
    .from(organizacoes)
    .where(eq(organizacoes.id, organizacaoId))
    .limit(1);

  return buildPipelineConfig(org?.pipelineConfig as Partial<PipelineConfig> | null);
}
