/**
 * Ciclo de vida de um evento no inbox: claim → processar → processed | failed (+ fila).
 *
 * Lógica pura, sem banco: o banco, a fila e a auditoria entram por `PortasInbox`
 * (a implementação real está em `stripe-webhook-inbox-db.ts`). É isto que o teste
 * exercita com portas em memória.
 *
 * Falha NUNCA é silenciosa: o evento vira `failed` com o erro, a auditoria
 * registra `stripe.webhook_falhou` e, quando pedido, o evento entra na fila
 * `stripe-webhook-events` do worker (retry com backoff).
 */
import { normalizarStatusInbox } from "./stripe-webhook-status";
import type { StripeEventPayload } from "./stripe-webhook-processor";

export interface LinhaInbox {
  id: string;
  eventId: string;
  eventType: string;
  status: string;
  organizacaoId: string | null;
  attempts: number;
  payload: StripeEventPayload;
}

export interface PortasInbox {
  /** Reivindica o evento (atômico). `null` se já processado ou outro executor está nele. */
  claim(id: string): Promise<LinhaInbox | null>;
  situacao(id: string): Promise<{ status: string } | null>;
  resolverOrganizacao(payload: StripeEventPayload): Promise<string | null>;
  definirOrganizacao(id: string, organizacaoId: string): Promise<void>;
  devolverUnresolved(id: string): Promise<void>;
  marcarProcessado(id: string): Promise<void>;
  marcarFalho(id: string, erro: string): Promise<void>;
  auditar(organizacaoId: string, acao: string, inboxId: string, depois: Record<string, unknown>): Promise<void>;
  /** `atrasoMs` padrão 15s (reprocesso de falha); a primeira entrega passa 0. */
  enfileirar(eventId: string, tentativa: number, atrasoMs?: number): Promise<void>;
  processar(payload: StripeEventPayload, ctx: { organizacaoId: string; inboxId: string }): Promise<{ passos: string[] }>;
}

export type ResultadoInbox =
  | { estado: "processado"; passos: string[] }
  | { estado: "falhou"; erro: string; enfileirado: boolean }
  | { estado: "ja_processado" }
  | { estado: "em_andamento" }
  | { estado: "sem_organizacao" }
  | { estado: "inexistente" };

export async function executarComPortas(
  portas: PortasInbox, inboxId: string, opcoes: { enfileirarSeFalhar: boolean },
): Promise<ResultadoInbox> {
  const linha = await portas.claim(inboxId);
  if (!linha) {
    const s = await portas.situacao(inboxId);
    if (!s) return { estado: "inexistente" };
    return normalizarStatusInbox(s.status) === "processed" ? { estado: "ja_processado" } : { estado: "em_andamento" };
  }

  let organizacaoId = linha.organizacaoId;
  if (!organizacaoId) {
    organizacaoId = await portas.resolverOrganizacao(linha.payload);
    if (!organizacaoId) { await portas.devolverUnresolved(linha.id); return { estado: "sem_organizacao" }; }
    await portas.definirOrganizacao(linha.id, organizacaoId);
  }

  try {
    const r = await portas.processar(linha.payload, { organizacaoId, inboxId: linha.id });
    await portas.marcarProcessado(linha.id);
    await portas.auditar(organizacaoId, "stripe.webhook_processado", linha.id, {
      status: "processed", eventId: linha.eventId, eventType: linha.eventType, tentativa: linha.attempts, passos: r.passos,
    });
    return { estado: "processado", passos: r.passos };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error(`[StripeWebhook] ${linha.eventType} ${linha.eventId} falhou (tentativa ${linha.attempts}):`, e);
    await portas.marcarFalho(linha.id, erro);
    await portas.auditar(organizacaoId, "stripe.webhook_falhou", linha.id, {
      status: "failed", eventId: linha.eventId, eventType: linha.eventType, tentativa: linha.attempts, error: erro.slice(0, 2000),
    });
    let enfileirado = false;
    if (opcoes.enfileirarSeFalhar) {
      try { await portas.enfileirar(linha.eventId, linha.attempts); enfileirado = true; }
      catch (qe) { console.error("[StripeWebhook] não consegui enfileirar o reprocesso:", qe); }
    }
    return { estado: "falhou", erro, enfileirado };
  }
}

export type ResultadoAceite =
  | { estado: "enfileirado" }
  | { estado: "ja_processado" }
  | { estado: "nao_enfileirado"; erro: string };

/**
 * Caminho da REQUISIÇÃO do webhook: o evento já está no inbox; aqui só se decide se
 * vai para a fila. NÃO processa nada (sync, recebíveis, ganho rodam no worker), para
 * responder ao Stripe em milissegundos. Idempotência: só `processed` é pulado; o resto
 * entra na fila e o `claim` do worker garante que um evento produz efeito uma vez só.
 * Se a fila recusar, o evento segue `pending` no inbox e o chamador responde 500
 * (o Stripe reentrega) — nunca um 2xx falso.
 */
export async function aceitarEvento(
  portas: Pick<PortasInbox, "situacao" | "enfileirar">, inboxId: string, eventId: string,
): Promise<ResultadoAceite> {
  const s = await portas.situacao(inboxId);
  if (s && normalizarStatusInbox(s.status) === "processed") return { estado: "ja_processado" };
  try {
    await portas.enfileirar(eventId, 0, 0);
    return { estado: "enfileirado" };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error(`[StripeWebhook] ${eventId}: fila recusou o evento (segue pending no inbox):`, e);
    return { estado: "nao_enfileirado", erro };
  }
}
