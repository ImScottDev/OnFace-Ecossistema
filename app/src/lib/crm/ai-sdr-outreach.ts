import { and, eq } from "drizzle-orm";
import { usuarios } from "../db/schema";

// Usuário pseudo que representa o Agente SDR (Natália) no CRM — aparece como
// responsável nos leads que ela está trabalhando e como autor nas timelines/logs
// de ações automáticas. Mesmo padrão do SDR_FOLLOWUP_EMAIL em sdr-escalation.ts.
export const AI_SDR_USER_EMAIL = "natalia.ia@callface.ai";

/** Resolve o id do usuário pseudo "Natália" numa org. Null se não achar (ainda não foi criado). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveAiSdrUserId(db: any, organizacaoId: string): Promise<string | null> {
  const [u] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.email, AI_SDR_USER_EMAIL)))
    .limit(1);
  return u?.id ?? null;
}
