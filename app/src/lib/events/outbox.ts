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

/** `db` ou um client de transação (`db.transaction(async (tx) => ...)`) — o insert funciona igual nos dois. */
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  | "ProposalRejected"
  // Commercial Core (ADR-EXEC-020) — fechamento ponta a ponta
  // Oportunidade -> Proposta -> Aceite -> Contrato -> Won -> Serviço Canônico.
  | "PaymentStarted"
  | "PaymentCompleted"
  | "ContractRequired"
  | "ContractGenerated"
  | "ContractPreparationFailed"
  | "SignatureRequested"
  | "SignerViewed"
  | "SignerSigned"
  | "ContractCompleted"
  | "FinalDocumentGenerated"
  | "ContractDeclined"
  | "ContractExpired"
  | "ContractSigned"
  | "CanonicalServiceActivated"
  // Commercial Core v2 (ADR-EXEC-021) — proposta pública rica + checkout
  // como entidade própria + fulfillment por grupo comercial independente.
  | "ProposalOpened"
  | "ProposalAdjustmentRequested"
  | "CheckoutCreated"
  | "CheckoutOpened"
  | "PaymentFailed"
  | "CheckoutExpired"
  | "FulfillmentGroupCompleted"
  | "ConversationClaimed"
  | "ConversationTransferred"
  | "ConversationReleased"
  | "ConversationSnoozed"
  | "ConversationClosed"
  | "ConversationReopened";

export interface PublicarEventoOpts {
  organizacaoId: string;
  eventType: EventoDominio;
  aggregateType: "lead" | "negocio" | "contrato" | "proposta" | "servico" | "checkout" | "grupo_comercial" | "contato";
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  /** Evita duplicar o mesmo evento se o call site puder rodar 2x (retry de rota, etc). */
  idempotencyKey?: string;
}

/**
 * Best-effort por padrão (dual-write) — MAS aceita um client de transação
 * opcional (`dbClient`) pra quando a publicação precisa estar na MESMA
 * transação da mudança de domínio (ADR-EXEC-021, resiliência da
 * materialização): se a transação falhar/reverter, nem o status muda nem o
 * evento é publicado — nunca um sem o outro.
 */
export async function publicarEvento(opts: PublicarEventoOpts, dbClient: DbClient = db): Promise<void> {
  try {
    await dbClient.insert(eventOutbox).values({
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
