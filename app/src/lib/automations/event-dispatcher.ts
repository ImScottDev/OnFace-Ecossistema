import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cadenceDefinitions, cadenceDefinitionPointers, cadenceVersions, eventOutbox } from "@/lib/db/schema";
import { iniciarCadencia } from "@/lib/cadencia/cadence-engine";
import { followupGraphSchema } from "@/lib/ai-platform/followup/graph";

type EventRow = typeof eventOutbox.$inferSelect;

const EVENT_ALIASES: Record<string, string[]> = {
  LeadCreated: ["lead.created", "novo_lead"],
  /* O MESMO fato com o nome canônico — e o que a captação paga de fato publica.
   *
   * `LeadCreated` só sai na rota legada `POST /api/leads`. Meta, RD, site,
   * Pré-vendas e prospecção publicam `AcquisitionCreated` (a ponte canônica, em
   * `lib/vendas/ponte-canonica.ts`, na mesma transação em que a aquisição
   * nasce). Os fluxos já ouviam os dois nomes (`fontes.outbox` em
   * automacoes/grafo.ts); a cadência não, então cadência com gatilho "Lead
   * criado" casava só o lead criado na mão pela API e ignorava as duas maiores
   * fontes da empresa — sem erro e sem aviso.
   *
   * Inscrever duas vezes quando a rota legada publica os dois nomes não
   * acontece: `iniciarCadencia` já devolve a inscrição ativa do mesmo registro
   * na mesma cadência em vez de abrir uma segunda. */
  AcquisitionCreated: ["lead.created", "novo_lead", "LeadCreated"],
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

export function entityIdFor(definitionType: string, event: EventRow, payload: Record<string, unknown>): string | null {
  if (definitionType === event.aggregateType) return event.aggregateId;
  const keys: Record<string, string[]> = {
    // `*_legado_id` não é sinônimo de luxo: é como a PONTE canônica nomeia o
    // registro (ponte-evento-canonico.ts). Sem essas duas chaves, cadência com
    // gatilho de Proposta enviada/aceita casava o evento, não resolvia registro
    // nenhum e saía calada — os 12 ProposalSent perdidos de 15/10 bateram aqui
    // depois que o LEFT JOIN foi consertado. Os fluxos já traduziam (CHAVES em
    // automacoes/disparo.ts); só a cadência não.
    lead: ["leadId", "lead_id", "lead_legado_id"],
    negocio: ["negocioId", "negocio_id", "dealId", "deal_id", "negocio_legado_id"],
    contato: ["contatoId", "contato_id", "contactId"],
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
  /* LEFT JOIN, não INNER.
   *
   * Exigir a versão pinada matava a entrada por evento inteira: medido em
   * 15/10/2026, as 4 cadências de produção tinham `published_version_id` nulo
   * no ponteiro e TODAS as 8 versões em `draft`, então este JOIN devolvia zero
   * linhas para qualquer evento. Doze `ProposalSent` passaram ao lado da
   * cadência "Follow-up pós-proposta" — publicada, ativa, com esse gatilho — e
   * nenhuma inscrição nasceu. A tela mostrava tudo certo.
   *
   * Sem versão, o gatilho vem de `cadence_definitions.trigger_config`, que o
   * publish já grava e que até aqui só servia de rótulo na tela. É a mesma
   * decisão que `iniciarCadencia` toma ao cair nos `steps` da definição quando
   * não há versão: a cadência publicada funciona, pinada ou não. */
  const rows = await db.select({ definition: cadenceDefinitions, version: cadenceVersions })
    .from(cadenceDefinitions)
    .leftJoin(cadenceDefinitionPointers, eq(cadenceDefinitionPointers.cadenceDefinitionId, cadenceDefinitions.id))
    .leftJoin(cadenceVersions, eq(cadenceVersions.id, cadenceDefinitionPointers.publishedVersionId))
    // Evento de sistema não tem um usuário dono para autorizar uma cadência
    // pessoal. Ela só entra por uma rota autenticada do proprietário; nunca
    // vaza para um disparo global.
    .where(and(eq(cadenceDefinitions.organizacaoId, event.organizacaoId), eq(cadenceDefinitions.visibility, "shared"), eq(cadenceDefinitions.ativo, true), eq(cadenceDefinitions.status, "published")));

  let matched = 0;
  let enrolled = 0;
  for (const row of rows) {
    /* O gatilho sai do grafo da versão pinada quando ela existe; senão, da
       coluna `trigger_config` da definição, que guarda {event, filters}. */
    const grafo = row.version ? followupGraphSchema.safeParse(row.version.graph) : null;
    const doGrafo = grafo?.success
      ? grafo.data.nodes.find((node) => node.type === "trigger")?.config
      : undefined;
    const cfg = (row.definition.triggerConfig ?? {}) as { event?: string; filters?: unknown };
    const trigger = doGrafo
      ?? (cfg.event ? { event: cfg.event, filters: (cfg.filters ?? {}) as Record<string, unknown> } : null);
    if (!trigger || !eventMatches(trigger.event, event.eventType)) continue;
    const entityId = entityIdFor(row.definition.entityType, event, payload);
    if (!entityId) continue;
    const facts = { ...payload, event_type: event.eventType, aggregate_type: event.aggregateType, aggregate_id: event.aggregateId };
    if (!triggerFiltersMatch(trigger.filters, facts)) continue;
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
