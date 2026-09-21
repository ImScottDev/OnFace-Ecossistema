/**
 * Leitura canônica do pipeline de vendas (SPEC §11, §17).
 *
 * A fonte é `oportunidades`, não `negocios`. As duas contam a mesma história
 * hoje — 527 abertas dos dois lados, R$ 1.986.970,63 contra R$ 1.985.870,63,
 * diferença de um único negócio sem identidade que virou caso de reconciliação
 * — mas só uma delas é o modelo final. Enquanto a tela ler a legada, a legada
 * não morre.
 *
 * O identificador devolvido é o do NEGÓCIO legado, porque as ações de mover
 * etapa e abrir o detalhe ainda escrevem nele. Leitura canônica primeiro,
 * escrita depois: inverter a ordem quebraria a tela no meio do caminho.
 *
 * Pacote de domínio: sem ORM e sem SDK.
 */

export interface CardOportunidade {
  oportunidadeId: string;
  /** Negócio legado — é por ele que a tela abre e move a etapa, até a fase 25. */
  negocioId: string | null;
  empresa: string | null;
  empresaId: string | null;
  titulo: string;
  familia: string | null;
  etapa: string;
  valor: number | null;
  mrr: number | null;
  responsavel: string | null;
  responsavelId: string | null;
  bundleId: string | null;
  ganho: boolean;
  perdido: boolean;
  motivoPerda: string | null;
  criadoEm: string;
}

export interface FiltrosPipeline {
  etapas?: string[];
  responsavelId?: string | null;
  familia?: string | null;
  motion?: string | null;
  busca?: string | null;
  /** Só as que estão sem próximo passo combinado — o Next Step Invariant. */
  semProximaAcao?: boolean;
  limite?: number;
}

export interface Executor {
  execute<T = unknown>(query: unknown): Promise<T[]>;
}
type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => unknown;

export async function boardDeOportunidades(
  db: Executor, sql: SqlTag, organizacaoId: string, filtros: FiltrosPipeline = {},
): Promise<{
  cards: CardOportunidade[];
  totaisPorEtapa: Record<string, { n: number; valor: number }>;
}> {
  const etapas = filtros.etapas?.length ? filtros.etapas : null;
  const listaEtapas = etapas ? `{${etapas.join(",")}}` : null;
  const busca = filtros.busca?.trim() ? `%${filtros.busca.trim().toLowerCase()}%` : null;

  // As MESMAS condições nas duas queries (cards e totais). Estavam escritas
  // duas vezes, e filtro aplicado num lado só faz a coluna mostrar N cards
  // enquanto o cabeçalho dela anuncia outro número.
  const condicoes = sql`
        AND (${filtros.responsavelId ?? null}::uuid IS NULL OR o.responsavel_id = ${filtros.responsavelId ?? null}::uuid)
        AND (${filtros.familia ?? null}::text IS NULL OR o.service_family = ${filtros.familia ?? null})
        AND (${filtros.motion ?? null}::text IS NULL OR o.commercial_motion = ${filtros.motion ?? null})
        AND (${busca}::text IS NULL OR lower(COALESCE(o.titulo,'')) LIKE ${busca}
             OR lower(COALESCE(e.nome, '')) LIKE ${busca}
             -- Buscar pelo nome que o cartão EXIBE: sem isto, procurar a
             -- empresa que está escrita no cartão não acha nada.
             OR lower(COALESCE(l.empresa, l.nome, '')) LIKE ${busca})
        AND (${filtros.semProximaAcao ? true : null}::boolean IS NULL
             OR NOT EXISTS (SELECT 1 FROM negocios nx
                             WHERE nx.id = o.negocio_id_legado
                               AND nx.proxima_acao IS NOT NULL))`;
  const limite = filtros.limite ?? 400;
  // Limite POR COLUNA: com limite global as vagas vão todas para a etapa mais
  // cheia e as outras aparecem vazias mesmo tendo total.
  const porColuna = Math.max(1, Math.ceil(limite / Math.max(1, etapas?.length ?? 6)));

  const linhas = await db.execute<Record<string, unknown>>(sql`
    WITH base AS (
      SELECT o.id::text AS oportunidade_id, o.negocio_id_legado::text AS negocio_id,
             -- NULLIF antes do COALESCE: a coluna empresa do lead guarda string VAZIA,
             -- não NULL, e COALESCE não pula vazio. Sem isso um cartão com
             -- lead sem empresa continua anônimo.
             -- 284 das 527 oportunidades abertas não têm empresa canônica, e
             -- TODAS as 284 têm nome pelo lead. Sem o fallback o board mostra
             -- "Empresa não informada" em mais da metade dos cartões, e um
             -- cartão que não se identifica não é acionável.
             COALESCE(NULLIF(trim(e.nome), ''), NULLIF(trim(l.empresa), ''), NULLIF(trim(l.nome), '')) AS empresa,
             o.empresa_id::text, o.titulo, o.service_family AS familia,
             o.etapa, o.valor::text, o.mrr::text,
             u.nome AS responsavel, o.responsavel_id::text,
             o.bundle_id::text,
             (o.ganho_at IS NOT NULL) AS ganho,
             (o.perdido_at IS NOT NULL) AS perdido,
             o.motivo_perda, o.created_at::text AS criado_em,
             o.updated_at AS ordenacao
        FROM oportunidades o
        LEFT JOIN empresas e ON e.id = o.empresa_id
        LEFT JOIN negocios nb ON nb.id = o.negocio_id_legado
        LEFT JOIN leads l ON l.id = nb.lead_id
        LEFT JOIN usuarios u ON u.id = o.responsavel_id
       WHERE o.organizacao_id = ${organizacaoId}::uuid
         AND (${listaEtapas}::text[] IS NULL OR o.etapa = ANY(${listaEtapas}::text[]))
         ${condicoes}
    )
    SELECT * FROM (
      SELECT base.*, row_number() OVER (PARTITION BY etapa ORDER BY ordenacao DESC) AS pos
        FROM base
    ) q
     WHERE pos <= ${porColuna}
     ORDER BY etapa, ordenacao DESC`);

  const cards: CardOportunidade[] = linhas.map((l) => ({
    oportunidadeId: String(l.oportunidade_id),
    negocioId: (l.negocio_id as string) ?? null,
    empresa: (l.empresa as string) ?? null,
    empresaId: (l.empresa_id as string) ?? null,
    titulo: String(l.titulo ?? ""),
    familia: (l.familia as string) ?? null,
    etapa: String(l.etapa),
    valor: l.valor == null ? null : Number(l.valor),
    mrr: l.mrr == null ? null : Number(l.mrr),
    responsavel: (l.responsavel as string) ?? null,
    responsavelId: (l.responsavel_id as string) ?? null,
    bundleId: (l.bundle_id as string) ?? null,
    ganho: Boolean(l.ganho),
    perdido: Boolean(l.perdido),
    motivoPerda: (l.motivo_perda as string) ?? null,
    criadoEm: String(l.criado_em),
  }));

  // Total e valor da coluna vêm de agregação sobre a tabela inteira: somar os
  // cards carregados subestimaria o pipeline.
  const totais = await db.execute<{ etapa: string; n: number; valor: string | null }>(sql`
    SELECT o.etapa, count(*)::int AS n, COALESCE(SUM(o.valor), 0)::text AS valor
      FROM oportunidades o
      LEFT JOIN empresas e ON e.id = o.empresa_id
      -- Os MESMOS joins da query de cartoes: as condicoes sao compartilhadas
      -- e referenciam o lead. Sem este join aqui, a busca derruba os totais com
      -- "missing FROM-clause entry for table l", e o tsc não pega.
      LEFT JOIN negocios nb ON nb.id = o.negocio_id_legado
      LEFT JOIN leads l ON l.id = nb.lead_id
     WHERE o.organizacao_id = ${organizacaoId}::uuid
       AND (${listaEtapas}::text[] IS NULL OR o.etapa = ANY(${listaEtapas}::text[]))
       ${condicoes}
     GROUP BY o.etapa`);

  const totaisPorEtapa: Record<string, { n: number; valor: number }> = {};
  for (const t of totais) totaisPorEtapa[t.etapa] = { n: Number(t.n), valor: Number(t.valor ?? 0) };

  return { cards, totaisPorEtapa };
}
