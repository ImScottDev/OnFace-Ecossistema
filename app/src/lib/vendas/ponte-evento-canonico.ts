/**
 * Ponte do evento de vendas para o evento de domínio (SPEC §15, §24).
 *
 * Havia DOIS modelos de evento no sistema:
 *
 *   `vendas_eventos`   o do módulo Vendas — rico, com ator e contexto, mas que
 *                      não alimenta nada além da linha do tempo;
 *   `domain_events`    o canônico, que alimenta o outbox, a automação e a
 *                      entrega de conversão à Meta.
 *
 * Qualificar um lead escrevia só no primeiro. Consequência concreta: o evento
 * **mais importante para a otimização de campanha** — `AcquisitionQualified`,
 * que vira `QualifiedLead` na Meta — nunca era publicado. A Meta continuava
 * otimizando por volume de formulário, que é exatamente o problema que a fase
 * 20 existe para resolver.
 *
 * Os nomes também divergiam: o módulo fala `LeadQualified`, a política fala
 * `AcquisitionQualified`. Deixar os dois vocabulários soltos garante que um dia
 * alguém mapeie errado.
 *
 * Esta ponte sai na fase 26, quando `registrarEvento` publicar direto no
 * canônico e `vendas_eventos` for contraída.
 */
import { sql } from "drizzle-orm";
import { publicarEvento } from "@onface/platform-events";
import type { ExecutorDb } from "./executor";
import { carimbarPayload } from "@/lib/automacoes/contexto";

/**
 * Tradução do vocabulário do módulo para o canônico.
 *
 * Só o que tem significado canônico atravessa. `StageChanged`,
 * `QualificationStarted` e afins descrevem passo interno de tela e não são
 * fato de domínio — publicá-los encheria o outbox de ruído que nenhum
 * consumidor sabe usar.
 */
const TRADUCAO: Record<string, { tipo: string; agregado: string }> = {
  LeadCreated: { tipo: "AcquisitionCreated", agregado: "aquisicao" },
  LeadQualified: { tipo: "AcquisitionQualified", agregado: "aquisicao" },
  LeadDisqualified: { tipo: "AcquisitionDisqualified", agregado: "aquisicao" },
  MeetingScheduled: { tipo: "MeetingScheduled", agregado: "reuniao" },
  OpportunityCreated: { tipo: "OpportunityCreated", agregado: "oportunidade" },
  OpportunityWon: { tipo: "OpportunityWon", agregado: "oportunidade" },
  OpportunityLost: { tipo: "OpportunityLost", agregado: "oportunidade" },
  // Mover no board /pipeline grava OpportunityStageChanged e parava aqui; sem
  // ele, o gatilho "Negócio mudou de etapa" dos fluxos não via o board.
  OpportunityStageChanged: { tipo: "OpportunityStageChanged", agregado: "oportunidade" },
  ProposalSent: { tipo: "ProposalSent", agregado: "proposta" },
  ProposalAccepted: { tipo: "ProposalAccepted", agregado: "proposta" },
  ContractSigned: { tipo: "ContractSigned", agregado: "contrato" },
  PaymentConfirmed: { tipo: "PaymentConfirmed", agregado: "pagamento" },
};

export interface EventoParaCanonico {
  organizacaoId: string;
  tipo: string;
  leadId?: string | null;
  negocioId?: string | null;
  empresaId?: string | null;
  pessoaId?: string | null;
  propostaId?: string | null;
  atorTipo: string;
  contexto?: Record<string, unknown> | null;
  ocorridoEm: Date;
  /** Id do evento legado, para a chave de idempotência não depender de tempo. */
  origemId?: string | null;
}

/**
 * Publica o equivalente canônico, quando existe.
 *
 * Roda na MESMA transação do evento legado: os dois descrevem um fato só, e um
 * sobrevivendo ao rollback do outro passaria a descrever algo que não
 * aconteceu.
 */
export async function publicarEquivalenteCanonico(
  tx: ExecutorDb, evento: EventoParaCanonico,
): Promise<void> {
  const traducao = TRADUCAO[evento.tipo];
  if (!traducao) return;

  // A entrega à Meta e a automação precisam da identidade canônica, não do id
  // legado. Resolver aqui evita que cada consumidor faça a própria tradução —
  // e que cada um a faça de um jeito.
  const linhas = await tx.execute<{ pessoa_id: string | null; empresa_id: string | null; aquisicao_id: string | null; oportunidade_id: string | null }>(sql`
    SELECT
      COALESCE(${evento.pessoaId ?? null}::uuid,
               (SELECT p.id FROM pessoas p WHERE p.lead_id_legado = ${evento.leadId ?? null}::uuid)) AS pessoa_id,
      COALESCE(${evento.empresaId ?? null}::uuid,
               (SELECT l.empresa_id FROM leads l WHERE l.id = ${evento.leadId ?? null}::uuid)) AS empresa_id,
      (SELECT a.id FROM aquisicoes a WHERE a.lead_legado_id = ${evento.leadId ?? null}::uuid) AS aquisicao_id,
      (SELECT o.id FROM oportunidades o WHERE o.negocio_id_legado = ${evento.negocioId ?? null}::uuid) AS oportunidade_id`);
  const ids = (linhas as unknown as Array<Record<string, string | null>>)[0] ?? {};

  const agregadoId =
    traducao.agregado === "aquisicao" ? ids.aquisicao_id
      : traducao.agregado === "oportunidade" ? ids.oportunidade_id
      : traducao.agregado === "proposta" ? evento.propostaId ?? null
      : null;

  // Sem agregado canônico não há o que publicar: acontece com lead que ainda
  // não virou aquisição. Publicar com id nulo criaria evento órfão, que é pior
  // que evento nenhum porque parece que funcionou.
  if (!agregadoId) return;

  await publicarEvento(tx as never, sql as never, {
    organizacaoId: evento.organizacaoId,
    eventType: traducao.tipo,
    aggregateType: traducao.agregado,
    aggregateId: agregadoId,
    // O módulo fala HUMAN; o canônico fala USER. AI_AGENT e AUTOMATION são os
    // mesmos nos dois, e o resto vira SYSTEM.
    actorType: evento.atorTipo === "HUMAN" ? "USER"
      : evento.atorTipo === "AI_AGENT" ? "AI_AGENT"
      : evento.atorTipo === "AUTOMATION" ? "AUTOMATION"
      : "SYSTEM",
    source: "vendas",
    // A chave sai do evento legado, que já é único: retry e reprocessamento
    // geram a mesma, e nem o outbox nem a Meta contam duas vezes.
    idempotencyKey: evento.origemId ? `vendas:${evento.origemId}` : `vendas:${traducao.tipo}:${agregadoId}`,
    payload: carimbarPayload({
      pessoa_id: ids.pessoa_id,
      empresa_id: ids.empresa_id,
      aquisicao_id: ids.aquisicao_id,
      oportunidade_id: ids.oportunidade_id,
      lead_legado_id: evento.leadId ?? null,
      negocio_legado_id: evento.negocioId ?? null,
      // O evento canônico é datado pela transação, que é quando o fato
      // aconteceu. `ocorrido_em` vai junto para o caso do evento retroativo,
      // em que os dois diferem e alguém vai precisar saber qual é qual.
      ocorrido_em: evento.ocorridoEm.toISOString(),
      ...(evento.contexto ?? {}),
    }),
    entregarExternamente: true,
  });
}
