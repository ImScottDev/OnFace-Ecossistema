/**
 * Aceite MANUAL de proposta (vendedor, quando o cliente já topou em reunião
 * ou por telefone) — endpoint interno `POST /propostas/:id/aceitar`.
 *
 * Commercial Core v2 (ADR-EXEC-021): delega inteiramente pro núcleo
 * compartilhado (lib/crm/proposta-aceite.ts), o MESMO usado pelo aceite
 * público — não existem mais dois caminhos de aceite divergentes. O
 * pagamento via Stripe (webhook) NÃO passa mais por aqui: ele confirma o
 * pagamento de um CHECKOUT específico (já vinculado a um grupo comercial
 * criado no momento do aceite), não "aceita a proposta" de novo — ver
 * lib/crm/checkout.ts e o handler do webhook.
 */
import { db } from "@/lib/db";
import { propostas } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { processarAceiteDaProposta, type ResultadoGrupoAceite } from "@/lib/crm/proposta-aceite";

type PropostaRow = typeof propostas.$inferSelect;

export async function marcarPropostaAceita(opts: {
  proposta: PropostaRow;
  organizacaoId: string;
  userId: string | null;
}): Promise<{ grupos: ResultadoGrupoAceite[] }> {
  const result = await processarAceiteDaProposta({ propostaId: opts.proposta.id, organizacaoId: opts.organizacaoId, origem: "manual" });
  if (!result.ok) throw new Error(result.error);
  return { grupos: result.grupos };
}

export async function buscarPropostaPorId(propostaId: string): Promise<PropostaRow | undefined> {
  const [p] = await db.select().from(propostas).where(eq(propostas.id, propostaId)).limit(1);
  return p;
}
