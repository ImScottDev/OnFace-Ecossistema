/**
 * F0/Eventos — Event Outbox real.
 *
 * Achado da revisão externa de 09/08: a tabela `event_outbox` existia desde
 * F0, mas nada nunca escrevia nela nem lia dela — era infraestrutura morta,
 * automação/cadência sempre dispararam por chamada direta de função
 * (`dispararAutomacoes`), não por evento. Este módulo é o lado "publicar" do
 * barramento de eventos de domínio real: qualquer bounded context futuro
 * (CS/Onboarding, Financeiro, Analytics, Business Hub) pode assinar um
 * `eventType` sem tocar no código que o publica.
 *
 * Escopo desta entrega: os eventos do núcleo real do domínio (Lead/Deal/
 * Won/Customer) nos pontos onde a transição de fato acontece — não é
 * migração de tudo, é a arquitetura provada com os eventos de maior valor
 * (ver ADR-EXEC-016).
 */
import { db } from "@/lib/db";
import { eventOutbox } from "@/lib/db/schema";

export type EventoDominio =
  | "LeadCreated"
  | "DealCreated"
  | "StageChanged"
  | "DealWon"
  | "DealLost"
  | "CustomerCreated"
  | "ProposalSent"
  | "ProposalViewed"
  | "ProposalAccepted"
  | "ProposalRejected";

export interface PublicarEventoOpts {
  organizacaoId: string;
  eventType: EventoDominio;
  aggregateType: "lead" | "negocio" | "contrato" | "proposta";
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  /** Evita duplicar o mesmo evento se o call site puder rodar 2x (retry de rota, etc). */
  idempotencyKey?: string;
}

/** Best-effort — igual ao precedente de dual-write: nunca bloqueia o fluxo real por falha de evento. */
export async function publicarEvento(opts: PublicarEventoOpts): Promise<void> {
  try {
    await db.insert(eventOutbox).values({
      organizacaoId: opts.organizacaoId,
      eventType: opts.eventType,
      aggregateType: opts.aggregateType,
      aggregateId: opts.aggregateId,
      payload: opts.payload,
      correlationId: opts.correlationId || null,
      idempotencyKey: opts.idempotencyKey || null,
    }).onConflictDoNothing();
  } catch (err) {
    console.error(`[EventOutbox] falha ao publicar ${opts.eventType} (${opts.aggregateType}/${opts.aggregateId}):`, err);
  }
}
