import { and, eq, isNotNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";

/** Nomes dos agentes de IA da organização — a casca entrega às telas que só têm o nome da pessoa. */
export async function nomesDeAgentesDaOrg(organizacaoId: string): Promise<string[]> {
  const l = await db.select({ nome: usuarios.nome }).from(usuarios)
    .where(and(eq(usuarios.organizacaoId, organizacaoId), or(eq(usuarios.tipo, "agente"), isNotNull(usuarios.agenteId))));
  return l.map((u) => u.nome);
}
