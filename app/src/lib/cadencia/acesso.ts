import { isAdminView } from "@/lib/auth/roles";

export const CADENCE_VISIBILITIES = ["personal", "shared"] as const;
export type CadenceVisibility = (typeof CADENCE_VISIBILITIES)[number];

export type CadenceAccessRecord = {
  visibility: string | null | undefined;
  ownerId: string | null | undefined;
};

export type CadenceActor = {
  userId: string;
  role?: string | null;
  canManage: boolean;
};

export function dadosDeCriacaoDaCadencia(userId: string, visibility: CadenceVisibility) {
  return { ownerId: userId, visibility } as const;
}

/**
 * Cadências anteriores à propriedade nasceram sem owner. Elas continuam
 * compartilhadas para não sumirem nem ficarem privadas por inferência.
 */
export function visibilidadeDaCadencia(record: CadenceAccessRecord): CadenceVisibility {
  return record.visibility === "personal" ? "personal" : "shared";
}

export function podeVerCadencia(record: CadenceAccessRecord, actor: Pick<CadenceActor, "userId">): boolean {
  return visibilidadeDaCadencia(record) === "shared" || record.ownerId === actor.userId;
}

/** A permissão existente continua sendo o gate de escrita; ownership é o segundo gate. */
export function podeGerenciarCadencia(record: CadenceAccessRecord, actor: CadenceActor): boolean {
  if (!actor.canManage) return false;
  if (visibilidadeDaCadencia(record) === "personal") return record.ownerId === actor.userId;
  // Mantém a política atual de automation.manage, inclusive admin/gerente e RBAC.
  return true;
}

/** Admin/gerente não ganham uma exceção nova: são reconhecidos pelo RBAC atual. */
export function papelDeGestao(role: string | null | undefined): boolean {
  return isAdminView(role);
}

export function podeUsarCadencia(record: CadenceAccessRecord, actor: CadenceActor): boolean {
  return podeVerCadencia(record, actor) && actor.canManage;
}
