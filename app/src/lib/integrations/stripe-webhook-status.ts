/**
 * Vocabulário de status do inbox de webhooks (`stripe_webhook_events.status`).
 *
 * O banco de produção foi criado à mão com MAIÚSCULAS (PENDING/PROCESSED) e o
 * código novo grava minúsculas. A migration 0112 normaliza o dado, mas esta
 * comparação NÃO depende dela: qualquer carga que volte com caixa diferente
 * continua sendo reconhecida.
 */
export const STATUS_INBOX = ["pending", "processing", "processed", "failed", "unresolved"] as const;
export type StatusInbox = (typeof STATUS_INBOX)[number];

/** Normaliza (trim + minúsculo) e devolve o status canônico, ou `null` se desconhecido. */
export function normalizarStatusInbox(valor: unknown): StatusInbox | null {
  const v = String(valor ?? "").trim().toLowerCase();
  return (STATUS_INBOX as readonly string[]).includes(v) ? (v as StatusInbox) : null;
}

/** Comparação sem diferenciar caixa. Status desconhecido nunca é igual a nada. */
export function statusIgual(a: unknown, b: unknown): boolean {
  const na = normalizarStatusInbox(a);
  return na !== null && na === normalizarStatusInbox(b);
}

/** Estados dos quais um evento pode ser (re)processado. */
export const STATUS_REPROCESSAVEIS: readonly StatusInbox[] = ["pending", "failed", "unresolved", "processing"];
