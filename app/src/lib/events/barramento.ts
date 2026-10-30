/**
 * Publicação dos fatos comerciais no barramento do n8n
 * (workflow "ONFACE | Barramento comercial", POST /webhook/onface/eventos).
 *
 * Chamado pelo sweep do outbox (`consumer.ts`), uma vez por tentativa. O
 * `id_evento` é o id da linha do outbox: estável entre tentativas, que é o que
 * a trava de idempotência do n8n espera. Nunca gerar id novo aqui.
 *
 * Sem ONFACE_BARRAMENTO_URL e ONFACE_BARRAMENTO_TOKEN não faz nada. Falha
 * (rede, timeout, não-2xx) lança erro: quem chama decide que isso reenfileira o
 * evento sem desfazer o fato comercial.
 */
import type { eventOutbox } from "@/lib/db/schema";

type EventoOutbox = typeof eventOutbox.$inferSelect;

const TIMEOUT_MS = 4000;

/** Evento de domínio -> nome legível `area.fato`. Fora daqui não é publicado. */
export const NOMES_BARRAMENTO: Record<string, string> = {
  DealCreated: "negocio.criado",
  StageChanged: "negocio.etapa_alterada",
  /*
   * DE FORA DE PROPÓSITO, e o log do sweep vai chamá-los de "não mapeado":
   *
   * - `OpportunityStageChanged` sai JUNTO com `StageChanged` na mesma mudança de etapa
   *   (medido em produção 14/10, mesmo instante). Mapear os dois entregaria o MESMO fato
   *   duas vezes ao n8n, com nomes diferentes — e a idempotência por `id_evento` não pega,
   *   porque são linhas distintas do outbox.
   * - `ConversationMessageReceived` é mensagem de WhatsApp, o evento mais numeroso de todos
   *   (366 de 637). Publicar conversa no barramento jogaria para fora a privacidade que a
   *   regra de 14/10 acabou de fechar, número pessoal incluído.
   *
   * Se um dia forem publicados, tem de ser por decisão escrita, não para calar o aviso.
   */
  DealWon: "negocio.ganho",
  DealLost: "negocio.perdido",
  CustomerCreated: "cliente.criado",
  ProposalSent: "proposta.enviada",
  ProposalViewed: "proposta.visualizada",
  ProposalOpened: "proposta.aberta",
  ProposalAccepted: "proposta.aceita",
  ProposalRejected: "proposta.recusada",
  ProposalAdjustmentRequested: "proposta.ajuste_solicitado",
  CheckoutCreated: "checkout.criado",
  CheckoutOpened: "checkout.aberto",
  CheckoutExpired: "checkout.expirado",
  PaymentStarted: "cobranca.iniciada",
  PaymentPending: "cobranca.pendente",
  PaymentCompleted: "cobranca.paga",
  PaymentFailed: "cobranca.falhou",
  PaymentRefunded: "cobranca.reembolsada",
  SubscriptionCanceled: "assinatura.cancelada",
  ContractRequired: "contrato.exigido",
  ContractGenerated: "contrato.gerado",
  ContractPreparationFailed: "contrato.preparo_falhou",
  SignatureRequested: "contrato.assinatura_solicitada",
  SignerViewed: "contrato.visualizado",
  SignerSigned: "contrato.assinante_assinou",
  ContractSigned: "contrato.assinado",
  ContractCompleted: "contrato.concluido",
  FinalDocumentGenerated: "contrato.documento_final_gerado",
  ContractDeclined: "contrato.recusado",
  ContractExpired: "contrato.expirado",
  FulfillmentGroupCompleted: "entrega.grupo_concluido",
  FulfillmentCreated: "entrega.criada",
  CanonicalServiceActivated: "servico.ativado",
  ManualValidationRequired: "validacao.manual_exigida",
};

const FAMILIAS = new Set(["PABX", "CALLFACE_AI", "WHITE_LABEL"]);

/** Só as três famílias reais; qualquer outra coisa (UNKNOWN, null) vira DESCONHECIDA. Nunca inventa. */
export function normalizarFamilia(v: unknown): string {
  return typeof v === "string" && FAMILIAS.has(v) ? v : "DESCONHECIDA";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dados mínimos: ids do agregado e ids soltos do payload. Nada de nome, e-mail, telefone ou valor. */
function dadosMinimos(evento: EventoOutbox): Record<string, unknown> {
  const dados: Record<string, unknown> = {
    aggregate_type: evento.aggregateType,
    aggregate_id: evento.aggregateId,
    correlation_id: evento.correlationId,
  };
  const payload = (evento.payload ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(payload)) {
    if (/Id$/.test(k) && typeof v === "string" && UUID.test(v)) dados[k] = v;
  }
  return dados;
}

export function montarEventoBarramento(evento: EventoOutbox, familia: string) {
  return {
    evento: NOMES_BARRAMENTO[evento.eventType],
    familia,
    id_evento: evento.id,
    ocorrido_em: new Date(evento.createdAt).toISOString(),
    organizacao_id: evento.organizacaoId,
    // De onde o fato veio. Sem isto, evento de homologação chega ao n8n
    // indistinguível de venda real — e viraria e-mail e WhatsApp de verdade para
    // o cliente. O n8n filtra por aqui.
    ambiente: ambienteDoBarramento(),
    dados: dadosMinimos(evento),
  };
}

/** `producao` só na URL pública de produção; qualquer outra coisa é `homologacao`. */
export function ambienteDoBarramento(): "producao" | "homologacao" {
  const url = (process.env.NEXTAUTH_URL || process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "").toLowerCase();
  return url.includes("//crm.callface.io") ? "producao" : "homologacao";
}

/** Família: payload primeiro; senão a da entidade (sempre filtrando pela organização da linha). */
async function familiaDoEvento(evento: EventoOutbox): Promise<string> {
  const payload = (evento.payload ?? {}) as Record<string, unknown>;
  const doPayload = normalizarFamilia(payload.serviceFamily ?? payload.familia);
  if (doPayload !== "DESCONHECIDA") return doPayload;

  const { db } = await import("@/lib/db");
  const s = await import("@/lib/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const org = evento.organizacaoId;
  const id = evento.aggregateId;

  const porTabela = {
    negocio: s.negocios, oportunidade: s.oportunidades, contrato: s.contratos,
    proposta: s.propostas, servico: s.servicosCanonicos, grupo_comercial: s.propostaGrupoComercial,
  } as const;
  const t = porTabela[evento.aggregateType as keyof typeof porTabela];
  if (t) {
    const [r] = await db.select({ f: t.serviceFamily }).from(t).where(and(eq(t.id, id), eq(t.organizacaoId, org))).limit(1);
    return normalizarFamilia(r?.f);
  }
  if (evento.aggregateType === "checkout") {
    const [r] = await db.select({ f: s.propostaGrupoComercial.serviceFamily })
      .from(s.checkouts)
      .innerJoin(s.propostaGrupoComercial, eq(s.propostaGrupoComercial.id, s.checkouts.grupoComercialId))
      .where(and(eq(s.checkouts.id, id), eq(s.checkouts.organizacaoId, org)))
      .limit(1);
    return normalizarFamilia(r?.f);
  }
  return "DESCONHECIDA";
}

export type ResultadoBarramento =
  | { publicado: false; motivo: "sem_configuracao" | "evento_nao_mapeado" }
  | { publicado: true };

export async function publicarNoBarramento(
  evento: EventoOutbox,
  deps: { fetch?: typeof fetch; familia?: (e: EventoOutbox) => Promise<string> } = {},
): Promise<ResultadoBarramento> {
  const url = process.env.ONFACE_BARRAMENTO_URL;
  const token = process.env.ONFACE_BARRAMENTO_TOKEN;
  if (!url || !token) return { publicado: false, motivo: "sem_configuracao" };
  if (!NOMES_BARRAMENTO[evento.eventType]) return { publicado: false, motivo: "evento_nao_mapeado" };

  const familia = await (deps.familia ?? familiaDoEvento)(evento);
  const res = await (deps.fetch ?? fetch)(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-onface-token": token },
    body: JSON.stringify(montarEventoBarramento(evento, familia)),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`[barramento] n8n respondeu ${res.status} para ${evento.eventType} (${evento.id})`);
  return { publicado: true };
}
