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
import { eq, sql } from "drizzle-orm";

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
  // Frente 2C.1 — motor interno de fechamento por família comercial.
  // `PaymentPending` é o pagamento em aberto de um grupo cuja entrega já foi
  // liberada por contrato assinado (PABX/White Label). `FulfillmentCreated`
  // carrega a TRILHA no payload (onboarding | implantacao_pabx |
  // implantacao_white_label) em vez de virar 3 tipos de evento diferentes.
  | "PaymentPending"
  | "FulfillmentCreated"
  | "ManualValidationRequired"
  | "ConversationClaimed"
  | "ConversationTransferred"
  | "ConversationReleased"
  | "ConversationSnoozed"
  | "ConversationClosed"
  | "ConversationReopened"
  | "ConversationMessageReceived"
  | "TagAdded"
  | "TagRemoved"
  // Nota escrita por automação. É conteúdo que alguém lê na conta, e por isso
  // vira linha do tempo (ver `projecao-timeline`), não só linha em `atividades`.
  | "NoteAdded";

export interface PublicarEventoOpts {
  organizacaoId: string;
  eventType: EventoDominio;
  aggregateType: "lead" | "negocio" | "oportunidade" | "cliente" | "empresa" | "contrato" | "proposta" | "servico" | "checkout" | "grupo_comercial" | "contato";
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
export async function publicarEvento(opts: PublicarEventoOpts, dbClient: DbClient = db): Promise<string | null> {
  try {
    const [inserted] = await dbClient.insert(eventOutbox).values({
      organizacaoId: opts.organizacaoId,
      eventType: opts.eventType,
      aggregateType: opts.aggregateType,
      aggregateId: opts.aggregateId,
      payload: opts.payload,
      correlationId: opts.correlationId || null,
      idempotencyKey: opts.idempotencyKey || null,
    }).onConflictDoNothing().returning({ id: eventOutbox.id });

    // REGISTRO DE DOMÍNIO (SPEC §24.1), além da fila.
    //
    // Havia dois publicadores no sistema: este, que grava só a MENSAGEM no
    // outbox, e `@onface/platform-events`, que grava o FATO em `domain_events`
    // e a mensagem no outbox. Vinte arquivos usam este, quatro usam aquele.
    //
    // A diferença não é de estilo. `event_outbox` é fila: a linha existe para
    // ser entregue e some de vista depois de processada. `domain_events` é o
    // registro do que aconteceu — é dele que sai a timeline, e é nele que se
    // olha para responder "o que houve com esta empresa em agosto".
    //
    // Com vinte chamadores publicando só na fila, a maior parte dos fatos do
    // sistema não existia no registro. Publicar aqui, na mesma transação do
    // chamador, resolve sem tocar em nenhum dos vinte.
    if (inserted) {
      await registrarFatoDeDominio(opts, dbClient);
      return inserted.id;
    }

    if (opts.idempotencyKey) {
      const [existing] = await dbClient.select({ id: eventOutbox.id }).from(eventOutbox).where(eq(eventOutbox.idempotencyKey, opts.idempotencyKey)).limit(1);
      return existing?.id ?? null;
    }
    return null;
  } catch (err) {
    console.error(`[EventOutbox] falha ao publicar ${opts.eventType} (${opts.aggregateType}/${opts.aggregateId}):`, err);
    return null;
  }
}

/**
 * Grava o fato em `domain_events`.
 *
 * Usa a MESMA chave de idempotência do outbox: os dois descrevem o mesmo fato,
 * e o `ON CONFLICT DO NOTHING` garante que um replay não crie um segundo
 * registro nem em um nem em outro.
 *
 * Falha aqui não derruba a publicação: a mensagem já está na fila e a
 * consequência vai acontecer. Perder o registro é ruim; perder a entrega, pior.
 */
async function registrarFatoDeDominio(opts: PublicarEventoOpts, dbClient: DbClient): Promise<void> {
  try {
    await dbClient.execute(sql`
      INSERT INTO domain_events (organizacao_id, event_type, aggregate_type, aggregate_id,
                                 actor_type, source, idempotency_key, correlation_id, payload)
      VALUES (${opts.organizacaoId}::uuid, ${opts.eventType}, ${opts.aggregateType},
              ${opts.aggregateId}::uuid, 'SYSTEM', 'runtime',
              ${opts.idempotencyKey ?? null}, ${opts.correlationId ?? null}::uuid,
              ${JSON.stringify(opts.payload)}::jsonb)
      ON CONFLICT DO NOTHING`);
  } catch (err) {
    console.error(`[EventOutbox] fato ${opts.eventType} foi para a fila mas não para o registro:`, err);
  }
}
