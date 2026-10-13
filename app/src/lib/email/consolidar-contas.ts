/**
 * Escolha da conta canônica quando a mesma caixa tem várias linhas em
 * `email_contas`. Função pura (sem banco): usada por
 * `scripts/consolidar-email-contas.ts` e coberta em `consolidar-contas.test.ts`.
 *
 * Prioridade:
 *  1. a conta referenciada por `reunioes.calendar_conta_id` (é onde os eventos
 *     do calendário VIVEM; trocar isso orfanaria o evento no Outlook). Com mais
 *     de uma referenciada, a de mais referências;
 *  2. senão, a de token válido com sync bem-sucedido mais recente;
 *  3. senão, a de sync mais recente;
 *  4. desempate sempre pela mais antiga (é a que `contaDoUsuario` já escolhia).
 */
export interface ContaCandidata {
  id: string;
  createdAt: Date;
  syncStatus: string;
  lastSyncAt: Date | null;
  lastError: string | null;
  temRefreshToken: boolean;
  tokenExpiry: Date | null;
  /** Quantas reuniões apontam para esta conta em `calendar_conta_id`. */
  refsCalendario: number;
}

export type MotivoCanonica = "referenciada_por_reuniao" | "token_valido_sync_recente" | "sync_mais_recente" | "mais_antiga";

const t = (d: Date | null) => (d ? d.getTime() : -Infinity);

function syncSaudavel(c: ContaCandidata): boolean {
  return c.syncStatus === "active" && c.temRefreshToken && !c.lastError && c.lastSyncAt !== null;
}

export function escolherCanonica(contas: ContaCandidata[]): { id: string; motivo: MotivoCanonica } {
  if (contas.length === 0) throw new Error("grupo vazio");
  const maisAntiga = (a: ContaCandidata, b: ContaCandidata) => t(a.createdAt) - t(b.createdAt) || a.id.localeCompare(b.id);

  const comReuniao = contas.filter((c) => c.refsCalendario > 0);
  if (comReuniao.length > 0) {
    const [melhor] = [...comReuniao].sort(
      (a, b) => b.refsCalendario - a.refsCalendario || t(b.lastSyncAt) - t(a.lastSyncAt) || maisAntiga(a, b),
    );
    return { id: melhor.id, motivo: "referenciada_por_reuniao" };
  }

  const saudaveis = contas.filter(syncSaudavel);
  if (saudaveis.length > 0) {
    const [melhor] = [...saudaveis].sort((a, b) => t(b.lastSyncAt) - t(a.lastSyncAt) || maisAntiga(a, b));
    return { id: melhor.id, motivo: "token_valido_sync_recente" };
  }

  const comSync = contas.filter((c) => c.lastSyncAt !== null);
  if (comSync.length > 0) {
    const [melhor] = [...comSync].sort((a, b) => t(b.lastSyncAt) - t(a.lastSyncAt) || maisAntiga(a, b));
    return { id: melhor.id, motivo: "sync_mais_recente" };
  }

  const [antiga] = [...contas].sort(maisAntiga);
  return { id: antiga.id, motivo: "mais_antiga" };
}
