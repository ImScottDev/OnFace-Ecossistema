/**
 * F0/Eventos — Event Outbox real, lado "consumir".
 *
 * `processarEventosPendentes()` é chamado pelo worker (job `event-outbox-
 * sweep`) — lê `event_outbox` em status pending, executa todo handler
 * registrado pro `eventType`, marca processed/failed com retry e
 * dead-letter (5 tentativas). Registro de handler é local a este processo
 * (mesmo padrão do registry de adapters do Cadence Engine em
 * `lib/cadencia/cadence-engine.ts`) — plugar um novo consumidor não exige
 * tocar em quem publica o evento.
 *
 * Consumidor real #1 (prova de que o barramento funciona de ponta a ponta,
 * não é só a tabela existindo): jornal de auditoria de domínio — toda
 * transição real de Lead/Deal grava em `audit_log` (F0), decoplado do
 * código que fez a transição. Ver ADR-EXEC-016.
 */
import { db } from "@/lib/db";
import { eventOutbox, auditLog, faturas } from "@/lib/db/schema";
import { eq, asc, and, or, lt, isNull } from "drizzle-orm";
import { materializarServicosCanonicosDoGrupo } from "@/lib/crm/servico-canonico";
import { criarFulfillmentsParaServicos } from "@/lib/crm/fulfillment";
import { dispatchAutomationEvent } from "@/lib/automations/event-dispatcher";

type EventoOutbox = typeof eventOutbox.$inferSelect;
type Handler = (evento: EventoOutbox) => Promise<void>;

const handlers = new Map<string, Handler[]>();

export function registrarConsumidorEvento(eventType: string, handler: Handler): void {
  const list = handlers.get(eventType) || [];
  list.push(handler);
  handlers.set(eventType, list);
}

const MAX_TENTATIVAS = 5;

export async function processarEventosPendentes(limite = 50): Promise<{ processados: number; falhados: number }> {
  // Claim atômico por evento: múltiplos workers podem listar o mesmo pending,
  // mas só um muda seu estado para processing. Eventos presos em processing
  // há mais de 15 minutos voltam a ser elegíveis para recuperação.
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
  const pendentes = await db
    .select()
    .from(eventOutbox)
    .where(or(
      eq(eventOutbox.status, "pending"),
      and(eq(eventOutbox.status, "processing"), or(isNull(eventOutbox.processingStartedAt), lt(eventOutbox.processingStartedAt, staleBefore))),
    ))
    .orderBy(asc(eventOutbox.createdAt))
    .limit(limite);

  let processados = 0;
  let falhados = 0;

  for (const evento of pendentes) {
    const [claimed] = await db.update(eventOutbox)
      .set({ status: "processing", processingStartedAt: new Date() })
      .where(and(
        eq(eventOutbox.id, evento.id),
        or(
          eq(eventOutbox.status, "pending"),
          and(eq(eventOutbox.status, "processing"), or(isNull(eventOutbox.processingStartedAt), lt(eventOutbox.processingStartedAt, staleBefore))),
        ),
      ))
      .returning({ id: eventOutbox.id });
    if (!claimed) continue;

    try {
      const list = handlers.get(evento.eventType) || [];
      for (const handler of list) await handler(evento);
      await dispatchAutomationEvent(evento);
      await db
        .update(eventOutbox)
        .set({ status: "processed", processedAt: new Date(), processingStartedAt: null })
        .where(eq(eventOutbox.id, evento.id));
      processados++;
    } catch (err) {
      const attempts = (evento.attempts || 0) + 1;
      await db
        .update(eventOutbox)
        .set({
          status: attempts >= MAX_TENTATIVAS ? "failed" : "pending",
          attempts,
          lastError: err instanceof Error ? err.message : String(err),
          processingStartedAt: null,
        })
        .where(eq(eventOutbox.id, evento.id));
      falhados++;
      console.error(`[EventOutbox] falha ao processar ${evento.eventType} (${evento.id}), tentativa ${attempts}:`, err);
    }
  }

  return { processados, falhados };
}

async function registrarNoAuditLog(evento: EventoOutbox): Promise<void> {
  await db.insert(auditLog).values({
    organizacaoId: evento.organizacaoId,
    actorId: null,
    action: `event.${evento.eventType}`,
    entityType: evento.aggregateType,
    entityId: evento.aggregateId,
    after: evento.payload as object,
    source: "worker",
  });
}

for (const eventType of [
  "LeadCreated", "DealCreated", "StageChanged", "DealWon", "DealLost", "CustomerCreated",
  "ProposalSent", "ProposalViewed", "ProposalAccepted", "ProposalRejected",
  // Commercial Core (ADR-EXEC-020)
  "PaymentStarted", "PaymentCompleted", "ContractRequired", "ContractGenerated", "ContractPreparationFailed", "SignatureRequested",
  "SignerViewed", "SignerSigned", "ContractCompleted", "FinalDocumentGenerated", "ContractDeclined",
  "ContractExpired", "ContractSigned", "CanonicalServiceActivated",
  // Commercial Core v2 (ADR-EXEC-021)
  "ProposalOpened", "ProposalAdjustmentRequested", "CheckoutCreated", "CheckoutOpened",
  "PaymentFailed", "CheckoutExpired", "FulfillmentGroupCompleted",
  // Frente 2C.1 — fechamento por família comercial
  "PaymentPending", "FulfillmentCreated", "ManualValidationRequired",
  "ConversationClaimed", "ConversationTransferred", "ConversationReleased",
  "ConversationSnoozed", "ConversationClosed", "ConversationReopened",
  "ConversationMessageReceived",
  "TagAdded", "TagRemoved",
]) {
  registrarConsumidorEvento(eventType, registrarNoAuditLog);
}

/**
 * Consumidor real #2 (ADR-EXEC-021, resiliência da materialização): a
 * confirmação de pagamento/assinatura só PERSISTE a intenção (grupo.status =
 * concluido + este evento) — quem de fato materializa/atualiza o serviço
 * canônico é este consumer, rodando no sweep do worker, com o retry/
 * dead-letter da infra acima. Se falhar (ex: Postgres momentaneamente fora),
 * o FATO comercial (grupo concluído) não se perde — só o evento fica
 * "pending" e tenta de novo no próximo sweep, até 5x, depois "failed"
 * (rastreável, nunca silencioso).
 */
registrarConsumidorEvento("FulfillmentGroupCompleted", async (evento) => {
  const grupoComercialId = evento.aggregateId;
  const { servicoIds } = await materializarServicosCanonicosDoGrupo(grupoComercialId);
  if (servicoIds.length === 0) {
    throw new Error(`materializarServicosCanonicosDoGrupo(${grupoComercialId}) não gerou nenhum serviço — grupo sem itens? investigar antes de aceitar como sucesso silencioso.`);
  }
  await criarFulfillmentsParaServicos(servicoIds, evento.organizacaoId);

  // Frente 2C.1 — amarra a pendência financeira (se existir) ao serviço que
  // acabou de nascer. Só dá pra fazer aqui: a pendência é criada na
  // assinatura, quando o serviço canônico ainda não existe (materialização é
  // assíncrona, via este consumer). Sem isso o Financeiro tem o recebível mas
  // não sabe QUAL serviço está em aberto.
  await db
    .update(faturas)
    .set({ servicoCanonicoId: servicoIds[0], updatedAt: new Date() })
    .where(and(eq(faturas.grupoComercialId, grupoComercialId), isNull(faturas.servicoCanonicoId)))
    .catch((err) => console.error(`[EventOutbox] falha ao vincular pendência ao serviço do grupo ${grupoComercialId} (best-effort):`, err));
});

/**
 * Consumidor de CS (08/09/2026) — o handoff automático do Won pro CS.
 *
 * `CanonicalServiceActivated` é o gatilho certo, não `DealWon`: é quando o
 * serviço existe de fato e a empresa passa a fazer parte da carteira. Won
 * sem serviço materializado ainda não tem o que acompanhar.
 *
 * Idempotente por dois motivos independentes: o outbox só processa cada
 * evento uma vez, e `iniciarJornadaCs` tem chave própria por marco.
 */
registrarConsumidorEvento("CanonicalServiceActivated", async (evento) => {
  const { garantirContaCs } = await import("@/lib/cs/handoff");
  await garantirContaCs(evento.organizacaoId, evento.aggregateId);
});

/**
 * Falha de pagamento vira sinal de CS na hora, sem esperar o sweep — é o
 * evento em que a diferença entre "agora" e "daqui a uma hora" importa.
 */
registrarConsumidorEvento("PaymentFailed", async (evento) => {
  const { registrarFalhaPagamento } = await import("@/lib/cs/handoff");
  await registrarFalhaPagamento(evento.organizacaoId, evento.payload as Record<string, unknown>);
});
