/**
 * AssignOwner/ChangeOwner (19/08, correção de escopo — Responsável precisa
 * ser operacional). A capability de TROCAR responsável já existia — os
 * PATCH genéricos de /leads/:id e /negocios/:id sempre aceitaram
 * `responsavelId` no body. O gap real era duplo: (1) ninguém na UI chamava
 * isso (Responsável aparecia só como texto), e (2) a troca não deixava
 * rastro (sem audit_log, sem actor/timestamp/before/after).
 *
 * Esta função é o ÚNICO lugar que registra a troca — não recria a lógica
 * de update por entidade (cada tabela continua com seu próprio PATCH), só
 * centraliza o rastro de auditoria pra não duplicar isso em N endpoints.
 */
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

export type OwnerEntityType = "lead" | "negocio" | "pessoa" | "fulfillment" | "cliente" | "fulfillment_item";

export async function registrarMudancaResponsavel(opts: {
  organizacaoId: string;
  entityType: OwnerEntityType;
  entityId: string;
  previousOwnerId: string | null;
  newOwnerId: string | null;
  actorId: string;
}): Promise<void> {
  if (opts.previousOwnerId === opts.newOwnerId) return; // sem mudança real, sem ruído no audit
  await db.insert(auditLog).values({
    organizacaoId: opts.organizacaoId,
    actorId: opts.actorId,
    action: `${opts.entityType}.responsavel_alterado`,
    entityType: opts.entityType,
    entityId: opts.entityId,
    before: { responsavelId: opts.previousOwnerId },
    after: { responsavelId: opts.newOwnerId },
    source: "api",
  });
}
