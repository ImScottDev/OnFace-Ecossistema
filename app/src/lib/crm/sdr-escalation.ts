import { eq, and, lte, isNotNull } from "drizzle-orm";
import { leads, statusChanges, atividades, usuarios } from "../db/schema";
import { SDR_CONTATO_ESCALATION_HOURS } from "./pipeline";
import { registrarMudancaResponsavel } from "./owner";

// Import relativo (não "@/") de propósito: este módulo é usado pelo worker, que
// roda SEM o alias de path. Recebe `db` como parâmetro pra funcionar tanto com a
// instância do worker quanto com a do Next/Hono (@/lib/db).

// Email da SDR que assume o Follow up (Jenifer). Ao entrar em "Follow up" (manual
// ou pela automação de SDR_CONTATO_ESCALATION_HOURS), o lead passa a ser dela.
export const SDR_FOLLOWUP_EMAIL = "jenifer.matos@callface.ai";

/** Resolve o id da SDR dona do Follow up (Jenifer) numa org. Null se não achar. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveFollowupOwnerId(db: any, organizacaoId: string): Promise<string | null> {
  const [u] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.organizacaoId, organizacaoId), eq(usuarios.email, SDR_FOLLOWUP_EMAIL)))
    .limit(1);
  return u?.id ?? null;
}

/**
 * Escalação automática do board Pré-vendas: leads parados em "Em Contato" há mais
 * de SDR_CONTATO_ESCALATION_HOURS (48h/2 dias — janela do Agente SDR) sobem pra
 * "Follow up" e a Jenifer assume.
 * Base do relógio = `contatoDesdeAt` (setado quando o lead entra em Em Contato).
 * Idempotente: só pega quem ainda está em contacted e passou do limite.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runSdrFollowupEscalation(db: any): Promise<{ moved: number }> {
  const threshold = new Date(Date.now() - SDR_CONTATO_ESCALATION_HOURS * 60 * 60 * 1000);

  const pend = await db
    .select({ id: leads.id, organizacaoId: leads.organizacaoId, responsavelId: leads.responsavelId })
    .from(leads)
    .where(and(
      eq(leads.sdrStatus, "contacted"),
      eq(leads.tipo, "lead"),
      isNotNull(leads.contatoDesdeAt),
      lte(leads.contatoDesdeAt, threshold),
    ));

  let moved = 0;
  const ownerCache = new Map<string, string | null>();

  for (const l of pend) {
    let owner = ownerCache.get(l.organizacaoId);
    if (owner === undefined) {
      owner = await resolveFollowupOwnerId(db, l.organizacaoId);
      ownerCache.set(l.organizacaoId, owner);
    }

    await db
      .update(leads)
      .set({
        sdrStatus: "qualifying",
        // só reatribui se achou a Jenifer; senão mantém o dono atual
        ...(owner ? { responsavelId: owner } : {}),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, l.id));

    // A reatribuição em lote passa pela mesma porta da tela (21/09).
    //
    // Escrever só em `leads` deixava a aquisição canônica com o dono antigo, e
    // o board de pré-vendas conta "sem responsável" a partir dela: a escalação
    // dava um dono ao lead e a tela continuava dizendo que não tinha. Sem
    // rastro, também não havia como responder por que aquele lead apareceu na
    // carteira de alguém.
    if (owner && owner !== l.responsavelId) {
      await registrarMudancaResponsavel({
        organizacaoId: l.organizacaoId,
        entityType: "lead",
        entityId: l.id,
        previousOwnerId: l.responsavelId ?? null,
        newOwnerId: owner,
        actorId: null,
        source: "automation",
        // A instância que este módulo recebeu, não a da aplicação: o worker tem
        // a própria conexão, e é por isso que `db` chega aqui por parâmetro.
        db,
      });
    }

    await db.insert(statusChanges).values({
      leadId: l.id,
      deStatus: "contacted",
      paraStatus: "qualifying",
      usuarioId: owner ?? null,
      motivo: `Automático: ${SDR_CONTATO_ESCALATION_HOURS}h em Em Contato → Follow up`,
    });

    await db.insert(atividades).values({
      leadId: l.id,
      organizacaoId: l.organizacaoId,
      usuarioId: owner ?? null,
      tipo: "nota",
      titulo: "Etapa de pré-vendas",
      descricao: `Em Contato → Follow up (automático, ${SDR_CONTATO_ESCALATION_HOURS}h)`,
    });

    moved++;
  }

  return { moved };
}
