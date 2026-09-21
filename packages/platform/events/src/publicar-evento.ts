/**
 * Publicação transacional de evento de domínio (SPEC §24.2).
 *
 * A regra que este módulo existe para garantir:
 *
 *   estado canônico + domain_event + outbox  →  MESMA transação
 *
 * Se qualquer um dos três falhar, nenhum acontece. É isso que impede o cenário
 * que o levantamento AS-IS mediu: 569 negócios marcados como ganho contra 33
 * eventos `DealWon` gravados. O estado mudou e o evento não, então nada a
 * jusante (automação, CAPI, timeline) soube.
 *
 * Recebe o executor da transação em curso, nunca abre conexão própria. É assim
 * que o chamador garante que está tudo no mesmo `BEGIN`.
 */

/** Só o que este módulo precisa saber sobre o executor: rodar SQL. Mantém o
 *  pacote livre de dependência de ORM, como exige a fronteira do SPEC §35. */
export interface ExecutorSql {
  execute<T = unknown>(query: unknown): Promise<T[]>;
}

export type TipoAtor = "USER" | "AI_AGENT" | "AUTOMATION" | "SYSTEM" | "INTEGRATION";

export interface EventoDominio {
  organizacaoId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  actorType?: TipoAtor;
  actorId?: string | null;
  /** Chave estável do fato. Duas tentativas do mesmo fato têm a mesma chave, e
   *  a segunda não cria evento novo. Sem isso, retry de webhook duplica. */
  idempotencyKey?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
  source?: string | null;
  payload?: Record<string, unknown>;
  /** Quando true, além do evento grava mensagem no outbox para o worker
   *  entregar consequências externas (CAPI, webhook de cliente, e-mail). */
  entregarExternamente?: boolean;
}

export interface ResultadoPublicacao {
  eventId: string | null;
  jaExistia: boolean;
  outboxId: string | null;
}

/**
 * Grava o evento e, se pedido, a mensagem de outbox — dentro da transação que
 * o chamador já abriu.
 *
 * `sqlTag` é a função de template do driver (o `sql` do Drizzle, por exemplo).
 * Recebê-la por parâmetro mantém este pacote sem importar ORM nenhum.
 */
export async function publicarEvento(
  tx: ExecutorSql,
  sqlTag: (strings: TemplateStringsArray, ...values: unknown[]) => unknown,
  evento: EventoDominio,
): Promise<ResultadoPublicacao> {
  const {
    organizacaoId, eventType, aggregateType, aggregateId,
    actorType = "SYSTEM", actorId = null, idempotencyKey = null,
    correlationId = null, causationId = null, source = null,
    payload = {}, entregarExternamente = false,
  } = evento;

  const linhas = await tx.execute<{ id: string; ja: boolean }>(sqlTag`
    WITH ja AS (
      SELECT id FROM domain_events
      WHERE organizacao_id = ${organizacaoId}::uuid
        AND idempotency_key IS NOT NULL AND idempotency_key = ${idempotencyKey}
    ), nova AS (
      INSERT INTO domain_events (
        organizacao_id, event_type, aggregate_type, aggregate_id,
        actor_type, actor_id, correlation_id, causation_id,
        idempotency_key, source, payload
      )
      SELECT ${organizacaoId}::uuid, ${eventType}, ${aggregateType}, ${aggregateId}::uuid,
             ${actorType}, ${actorId}::uuid, ${correlationId}::uuid, ${causationId}::uuid,
             ${idempotencyKey}, ${source}, ${JSON.stringify(payload)}::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM ja)
      RETURNING id
    )
    SELECT id, false AS ja FROM nova
    UNION ALL SELECT id, true AS ja FROM ja
    LIMIT 1
  `);

  const linha = linhas[0];
  if (!linha) return { eventId: null, jaExistia: false, outboxId: null };

  // Evento repetido não vira segunda entrega: é o ponto da idempotência.
  if (linha.ja || !entregarExternamente) {
    return { eventId: linha.id, jaExistia: linha.ja, outboxId: null };
  }

  const out = await tx.execute<{ id: string }>(sqlTag`
    INSERT INTO event_outbox (
      organizacao_id, event_type, aggregate_type, aggregate_id,
      payload, correlation_id, idempotency_key, status
    )
    VALUES (${organizacaoId}::uuid, ${eventType}, ${aggregateType}, ${aggregateId}::uuid,
            ${JSON.stringify({ ...payload, domain_event_id: linha.id })}::jsonb,
            ${correlationId}::uuid, ${idempotencyKey}, 'pending')
    ON CONFLICT DO NOTHING
    RETURNING id
  `);

  return { eventId: linha.id, jaExistia: false, outboxId: out[0]?.id ?? null };
}

/**
 * Projeta um item de timeline a partir de um evento já gravado.
 *
 * Fica separado de propósito: a timeline é modelo de leitura e pode ser
 * reconstruída. Se a projeção falhar, o fato de negócio continua registrado.
 */
export async function projetarTimeline(
  tx: ExecutorSql,
  sqlTag: (strings: TemplateStringsArray, ...values: unknown[]) => unknown,
  item: {
    organizacaoId: string; domainEventId?: string | null;
    empresaId?: string | null; pessoaId?: string | null;
    aquisicaoId?: string | null; oportunidadeId?: string | null; servicoCanonicoId?: string | null;
    tipo: string; titulo: string; descricao?: string | null;
    actorType?: TipoAtor; actorId?: string | null; ocorridoEm?: Date | string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<string | null> {
  // postgres.js quebra com `Date` cru dentro do template: ele tenta medir o
  // byteLength do objeto e estoura com "The string argument must be of type
  // string". Gotcha conhecido deste projeto, e a proteção mora aqui para que
  // nenhum chamador precise lembrar.
  const ocorridoEm = item.ocorridoEm instanceof Date
    ? item.ocorridoEm.toISOString()
    : item.ocorridoEm ?? null;

  const r = await tx.execute<{ id: string }>(sqlTag`
    INSERT INTO timeline_events (
      organizacao_id, domain_event_id, empresa_id, pessoa_id, aquisicao_id,
      oportunidade_id, servico_canonico_id, tipo, titulo, descricao,
      actor_type, actor_id, occurred_at, metadata
    )
    VALUES (${item.organizacaoId}::uuid, ${item.domainEventId ?? null}::uuid,
            ${item.empresaId ?? null}::uuid, ${item.pessoaId ?? null}::uuid, ${item.aquisicaoId ?? null}::uuid,
            ${item.oportunidadeId ?? null}::uuid, ${item.servicoCanonicoId ?? null}::uuid,
            ${item.tipo}, ${item.titulo}, ${item.descricao ?? null},
            ${item.actorType ?? "SYSTEM"}, ${item.actorId ?? null}::uuid,
            coalesce(${ocorridoEm}::timestamptz, now()),
            ${JSON.stringify(item.metadata ?? {})}::jsonb)
    RETURNING id
  `);
  return r[0]?.id ?? null;
}
