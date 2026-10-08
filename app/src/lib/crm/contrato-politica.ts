import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { organizacoes } from "@/lib/db/schema";

/**
 * Parâmetros do contrato que não pertencem a uma proposta: valem para a
 * organização e se editam em Ajustes → Contratos (`organizacoes.settings.contrato`).
 * Sem o valor cadastrado a variável fica vazia e o envio é bloqueado dizendo o
 * que falta, em vez de inventar um percentual dentro de uma cláusula de multa.
 */
export interface PoliticaContratual {
  multaRescisoriaPct?: number | null;
  limiteGravacoes?: string | null;
  representanteNome?: string | null;
  representanteEmail?: string | null;
}
export async function politicaContratual(organizacaoId: string): Promise<PoliticaContratual> {
  const [org] = await db.select({ settings: organizacoes.settings }).from(organizacoes).where(eq(organizacoes.id, organizacaoId)).limit(1);
  const c = ((org?.settings as Record<string, unknown> | null)?.contrato ?? {}) as Record<string, unknown>;
  const pct = Number(c.multaRescisoriaPct);
  return {
    multaRescisoriaPct: Number.isFinite(pct) && pct > 0 ? pct : null,
    limiteGravacoes: typeof c.limiteGravacoes === "string" && c.limiteGravacoes.trim() ? c.limiteGravacoes.trim() : null,
    representanteNome: typeof c.representanteNome === "string" && c.representanteNome.trim() ? c.representanteNome.trim() : null,
    representanteEmail: typeof c.representanteEmail === "string" && c.representanteEmail.trim() ? c.representanteEmail.trim() : null,
  };
}

