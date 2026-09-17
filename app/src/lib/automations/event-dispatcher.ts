import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cadenceDefinitions, cadenceDefinitionPointers, cadenceVersions, eventOutbox } from "@/lib/db/schema";
import { iniciarCadencia } from "@/lib/cadencia/cadence-engine";
import { followupGraphSchema } from "@/lib/ai-platform/followup/graph";

type EventRow = typeof eventOutbox.$inferSelect;

const EVENT_ALIASES: Record<string, string[]> = {
  LeadCreated: ["lead.created", "novo_lead"],
  DealCreated: ["deal.created", "novo_negocio"],
  StageChanged: ["stage.changed", "mudanca_status"],
  ProposalSent: ["proposal.sent", "proposta_enviada"],
  ProposalAccepted: ["proposal.accepted", "proposta_aceita"],
  ProposalRejected: ["proposal.rejected", "proposta_recusada"],
  DealWon: ["deal.won", "won"],
  PaymentFailed: ["payment.failed", "pagamento_falhou"],
  PaymentCompleted: ["payment.completed", "pagamento_confirmado"],
  CanonicalServiceActivated: ["service.activated", "servico_ativado"],
  ContractSigned: ["contract.signed", "contrato_assinado"],
  CustomerCreated: ["customer.created", "cliente_criado"],
  ConversationMessageReceived: ["conversation.message_received", "whatsapp_recebido"],
  TagAdded: ["tag.added", "tag_adicionada"],
  TagRemoved: ["tag.removed", "tag_removida"],
};

export function eventMatches(configured: string, actual: string): boolean {
  if (configured === actual || configured === "*") return true;
  return (EVENT_ALIASES[actual] ?? []).includes(configured);
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, source);
}

export function triggerFiltersMatch(filters: Record<string, unknown>, facts: Record<string, unknown>): boolean {
  return Object.entries(filters).every(([path, expected]) => {
    if (expected === null || expected === undefined || expected === "") return true;
    const actual = readPath(facts, path);
    if (Array.isArray(expected)) return expected.includes(actual as never) || (Array.isArray(actual) && expected.some((item) => actual.includes(item)));
    if (Array.isArray(actual)) return actual.includes(expected);
    return String(actual ?? "") === String(expected);
  });
}

function entityIdFor(definitionType: string, event: EventRow, payload: Record<string, unknown>): string | null {
  if (definitionType === event.aggregateType) return event.aggregateId;
  const keys: Record<string, string[]> = {
    lead: ["leadId", "lead_id"], negocio: ["negocioId", "negocio_id", "dealId", "deal_id"], contato: ["contatoId", "contato_id", "contactId"],
    oportunidade: ["oportunidadeId", "oportunidade_id"], cliente: ["clienteId", "cliente_id"], empresa: ["empresaId", "empresa_id"], servico: ["servicoId", "servico_id", "servicoCanonicoId"],
  };
  for (const key of keys[definitionType] ?? []) {
    const value = payload[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

/** Converte um fato persistido no outbox em inscrições do grafo publicado.
 * Replays são deduplicados em `iniciarCadencia` pela chave evento+definição. */
export async function dispatchAutomationEvent(event: EventRow): Promise<{ matched: number; enrolled: number }> {
  const payload = (event.payload && typeof event.payload === "object" ? event.payload : {}) as Record<string, unknown>;
  const rows = await db.select({ definition: cadenceDefinitions, pointer: cadenceDefinitionPointers, version: cadenceVersions })
    .from(cadenceDefinitions)
    .innerJoin(cadenceDefinitionPointers, eq(cadenceDefinitionPointers.cadenceDefinitionId, cadenceDefinitions.id))
    .innerJoin(cadenceVersions, eq(cadenceVersions.id, cadenceDefinitionPointers.publishedVersionId))
    .where(and(eq(cadenceDefinitions.organizacaoId, event.organizacaoId), eq(cadenceDefinitions.ativo, true), eq(cadenceDefinitions.status, "published")));

  let matched = 0;
  let enrolled = 0;
  for (const row of rows) {
    const graph = followupGraphSchema.safeParse(row.version.graph);
    if (!graph.success) continue;
    const trigger = graph.data.nodes.find((node) => node.type === "trigger");
    if (!trigger || !eventMatches(trigger.config.event, event.eventType)) continue;
    const entityId = entityIdFor(row.definition.entityType, event, payload);
    if (!entityId) continue;
    const facts = { ...payload, event_type: event.eventType, aggregate_type: event.aggregateType, aggregate_id: event.aggregateId };
    if (!triggerFiltersMatch(trigger.config.filters, facts)) continue;
    matched++;
    const id = await iniciarCadencia({
      cadenceDefinitionId: row.definition.id,
      organizacaoId: event.organizacaoId,
      entityType: row.definition.entityType,
      entityId,
      sourceEventId: event.id,
      idempotencyKey: `event:${row.definition.id}:${event.id}`,
      varsIniciais: { ...facts, correlation_id: event.correlationId ?? null, source_event_id: event.id },
    });
    if (id) enrolled++;
  }
  return { matched, enrolled };
}
