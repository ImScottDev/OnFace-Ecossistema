import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { organizacoes } from "@/lib/db/schema";
import { normalizarSignatariosCallface, padraoDoPapel, PAPEL_REPRESENTANTE, type SignatarioCallface } from "@/lib/crm/proposta-signatarios";

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
  /** Quem pode assinar pela Callface (ordem e papel). O representante padrão continua espelhado em representanteNome/Email. */
  signatarios?: SignatarioCallface[];
}
export async function politicaContratual(organizacaoId: string): Promise<PoliticaContratual> {
  const [org] = await db.select({ settings: organizacoes.settings }).from(organizacoes).where(eq(organizacoes.id, organizacaoId)).limit(1);
  const c = ((org?.settings as Record<string, unknown> | null)?.contrato ?? {}) as Record<string, unknown>;
  const pct = Number(c.multaRescisoriaPct);
  const signatarios = normalizarSignatariosCallface(c.signatarios);
  // Lista cadastrada manda; sem ela, valem os dois campos antigos (organização que nunca abriu a lista).
  const rep = padraoDoPapel(signatarios, PAPEL_REPRESENTANTE);
  return {
    signatarios,
    multaRescisoriaPct: Number.isFinite(pct) && pct > 0 ? pct : null,
    limiteGravacoes: typeof c.limiteGravacoes === "string" && c.limiteGravacoes.trim() ? c.limiteGravacoes.trim() : null,
    representanteNome: rep?.nome ?? (typeof c.representanteNome === "string" && c.representanteNome.trim() ? c.representanteNome.trim() : null),
    representanteEmail: rep?.email ?? (typeof c.representanteEmail === "string" && c.representanteEmail.trim() ? c.representanteEmail.trim() : null),
  };
}

