/**
 * A etapa da aquisição passa a ter dono no canônico (SPEC §8.2).
 *
 * Antes disto a etapa era DERIVADA de fatos: `last_touch_at > first_touch_at`
 * virava "em contato", existir oportunidade aberta virava "oportunidade". Dava
 * certo para o que tem prova, e não dava para o que é decisão de quem opera:
 * mover o card para "Em contato" no board escrevia `leads.estagio_pre_vendas`,
 * o board relia `aquisicoes`, e o card voltava para Novo. Duas verdades dentro
 * da mesma tela.
 *
 * A etapa agora mora onde a SPEC mandou desde o começo — `pipeline_etapas`, com
 * `aquisicoes.etapa_id` apontando. A derivação continua viva como fallback para
 * aquisição sem etapa gravada; ela não some, deixa de ser a verdade.
 *
 * Pacote de domínio: sem ORM e sem SDK. Recebe um executor e a tag de SQL.
 */

export type EtapaAquisicaoCanonica =
  | "novo" | "em_contato" | "qualificacao" | "qualificado"
  | "oportunidade" | "nutricao" | "desqualificado";

interface Executor {
  execute<T = unknown>(query: unknown): Promise<T[]>;
}
type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => unknown;

export interface AlvoDaEtapa {
  organizacaoId: string;
  /** Um dos dois: a aquisição direto, ou o lead legado que aponta para ela. */
  aquisicaoId?: string | null;
  leadLegadoId?: string | null;
}

/**
 * Move a aquisição para a etapa canônica. Idempotente e silencioso quando a
 * aquisição não existe: a ponte legado→canônico é best-effort por desenho, e
 * derrubar a ação do usuário porque a aquisição espelho sumiu seria trocar um
 * board desatualizado por uma tela que não salva.
 */
export async function moverEtapaDaAquisicao(
  db: Executor, sql: SqlTag, alvo: AlvoDaEtapa, codigo: EtapaAquisicaoCanonica,
): Promise<{ movida: boolean }> {
  if (!alvo.aquisicaoId && !alvo.leadLegadoId) return { movida: false };

  const linhas = await db.execute<{ id: string }>(sql`
    UPDATE aquisicoes a
       SET etapa_id = pe.id,
           pipeline_id = p.id,
           updated_at = now()
      FROM pipelines p
      JOIN pipeline_etapas pe ON pe.pipeline_id = p.id AND pe.codigo = ${codigo}
     WHERE p.organizacao_id = ${alvo.organizacaoId}::uuid
       AND p.slug = 'aquisicao'
       AND a.organizacao_id = ${alvo.organizacaoId}::uuid
       AND (${alvo.aquisicaoId ?? null}::uuid IS NOT NULL AND a.id = ${alvo.aquisicaoId ?? null}::uuid
            OR ${alvo.leadLegadoId ?? null}::uuid IS NOT NULL AND a.lead_legado_id = ${alvo.leadLegadoId ?? null}::uuid)
       AND a.etapa_id IS DISTINCT FROM pe.id
    RETURNING a.id::text AS id`);

  return { movida: linhas.length > 0 };
}
