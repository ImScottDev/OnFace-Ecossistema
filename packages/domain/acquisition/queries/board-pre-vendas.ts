/**
 * Leitura canônica do board de pré-vendas (SPEC §8, §17).
 *
 * O que isto corrige, concretamente: a consulta legada filtra
 * `WHERE estagio_pre_vendas = ANY(...)`, e 2.392 dos 3.989 leads têm esse
 * campo NULO. Eles existem, têm dono, têm origem, e simplesmente não aparecem
 * em tela nenhuma. Foi o sintoma que abriu este refactor.
 *
 * No modelo canônico o estado não é um campo opcional preenchido por quem
 * lembrou: é derivado do que a aquisição de fato é. Aquisição aberta e não
 * qualificada é "novo" — não é ausência de estado, é o estado inicial.
 *
 * Pacote de domínio: sem ORM e sem SDK. Recebe um executor e a tag de SQL.
 */

export type EstagioAquisicao =
  | "novo" | "em_contato" | "qualificado" | "oportunidade"
  | "nutricao" | "desqualificado";

export interface CardAquisicao {
  aquisicaoId: string;
  /** Lead legado, enquanto as telas de detalhe ainda abrirem por ele. */
  leadId: string | null;
  empresa: string | null;
  empresaId: string | null;
  pessoa: string | null;
  pessoaId: string | null;
  cargo: string | null;
  etapa: EstagioAquisicao;
  origem: string | null;
  canal: string | null;
  campanha: string | null;
  responsavel: string | null;
  responsavelId: string | null;
  qualificado: boolean;
  email: string | null;
  telefone: string | null;
  primeiroToque: string | null;
  ultimoToque: string | null;
  criadoEm: string;
  retomarEm: string | null;
  motivoDesqualificacao: string | null;
  /** Aquisição sem dono é fato a mostrar, não erro a esconder. */
  semDono: boolean;
}

export interface FiltrosBoard {
  etapas?: EstagioAquisicao[];
  responsavelId?: string | null;
  origem?: string | null;
  campanha?: string | null;
  busca?: string | null;
  desde?: string | null;
  incluirEncerradas?: boolean;
  limite?: number;
}

export interface Executor {
  execute<T = unknown>(query: unknown): Promise<T[]>;
}
type SqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => unknown;

/**
 * O estágio vem derivado do estado real da aquisição, escrito inteiro nas duas
 * consultas abaixo:
 *
 *   desqualificado_em      → desqualificado
 *   nutricao_status        → nutricao
 *   tem oportunidade aberta → oportunidade
 *   qualificado            → qualificado
 *   houve toque depois da entrada → em_contato
 *   resto                  → novo
 *
 * A ordem é a precedência: desqualificação e nutrição são decisões explícitas
 * e vencem; oportunidade aberta é fato mais forte que qualificação; o resto é
 * novo, que é um estado, não um vazio. Está repetido nas duas consultas de
 * propósito — extrair para uma constante interpolada exigiria um truque com a
 * tag de SQL, e truque em consulta é onde bug se esconde.
 */

export async function boardDeAquisicoes(
  db: Executor, sql: SqlTag, organizacaoId: string, filtros: FiltrosBoard = {},
): Promise<{ cards: CardAquisicao[]; totaisPorEtapa: Record<string, number>; total: number }> {
  const etapas = filtros.etapas?.length ? filtros.etapas : null;
  const busca = filtros.busca?.trim() ? `%${filtros.busca.trim().toLowerCase()}%` : null;
  const limite = filtros.limite ?? 400;

  // O limite é POR COLUNA, não global.
  //
  // Com limite global e ordenação por data, as 400 vagas iam todas para a
  // coluna mais cheia: o board mostrava "Em contato 531" com zero cards
  // dentro. Um board que anuncia um número e não mostra nenhum item é pior
  // que um board vazio, porque parece bug do produto e não é.
  const linhas = await db.execute<Record<string, unknown>>(sql`
    WITH base AS (
    SELECT a.id::text AS aquisicao_id,
           a.lead_legado_id::text AS lead_id,
           e.nome AS empresa, a.empresa_id::text,
           NULLIF(trim(concat_ws(' ', p.nome, p.sobrenome)), '') AS pessoa,
           a.pessoa_id::text, p.cargo,
           CASE
             WHEN a.desqualificado_em IS NOT NULL THEN 'desqualificado'
             WHEN a.nutricao_status IS NOT NULL AND a.nutricao_status <> '' THEN 'nutricao'
             WHEN EXISTS (SELECT 1 FROM oportunidades o
                           WHERE o.organizacao_id = a.organizacao_id
                             AND (o.pessoa_id = a.pessoa_id OR o.empresa_id = a.empresa_id)
                             AND o.ganho_at IS NULL AND o.perdido_at IS NULL) THEN 'oportunidade'
             WHEN a.qualificado THEN 'qualificado'
             WHEN a.last_touch_at IS NOT NULL AND a.first_touch_at IS NOT NULL
                  AND a.last_touch_at > a.first_touch_at THEN 'em_contato'
             ELSE 'novo'
           END AS etapa,
           a.origem, a.canal, pc.campaign AS campanha,
           u.nome AS responsavel, a.responsavel_id::text,
           a.qualificado, p.email, p.telefone,
           a.first_touch_at::text AS primeiro_toque,
           a.last_touch_at::text AS ultimo_toque,
           a.created_at::text AS criado_em,
           a.retomar_em::text, a.motivo_desqualificacao,
           a.updated_at AS ordenacao
      FROM aquisicoes a
      LEFT JOIN empresas e ON e.id = a.empresa_id
      LEFT JOIN pessoas  p ON p.id = a.pessoa_id
      LEFT JOIN usuarios u ON u.id = a.responsavel_id
      -- Atribuição vem do primeiro toque, que é o que originou a aquisição.
      LEFT JOIN LATERAL (
        SELECT campaign FROM pontos_contato t
         WHERE t.aquisicao_id = a.id
         ORDER BY t.is_first_touch DESC, t.ocorrido_em ASC LIMIT 1
      ) pc ON TRUE
     WHERE a.organizacao_id = ${organizacaoId}::uuid
       AND (${filtros.incluirEncerradas ? sql`TRUE` : sql`a.closed_at IS NULL`})
       AND (${filtros.responsavelId ?? null}::uuid IS NULL OR a.responsavel_id = ${filtros.responsavelId ?? null}::uuid)
       AND (${filtros.origem ?? null}::text IS NULL OR a.origem = ${filtros.origem ?? null})
       AND (${filtros.campanha ?? null}::text IS NULL OR pc.campaign = ${filtros.campanha ?? null})
       AND (${filtros.desde ?? null}::date IS NULL OR a.created_at >= ${filtros.desde ?? null}::date)
       AND (${busca}::text IS NULL OR
            lower(COALESCE(e.nome, '')) LIKE ${busca} OR
            lower(concat_ws(' ', p.nome, p.sobrenome)) LIKE ${busca} OR
            lower(COALESCE(p.email, '')) LIKE ${busca})
    )
    SELECT * FROM (
      SELECT base.*, row_number() OVER (PARTITION BY etapa ORDER BY ordenacao DESC) AS pos
        FROM base
    ) q
     WHERE pos <= ${Math.max(1, Math.ceil(limite / 6))}
     ORDER BY etapa, ordenacao DESC`);

  const cards = linhas
    .map((l) => ({
      aquisicaoId: String(l.aquisicao_id),
      leadId: (l.lead_id as string) ?? null,
      empresa: (l.empresa as string) ?? null,
      empresaId: (l.empresa_id as string) ?? null,
      pessoa: (l.pessoa as string) ?? null,
      pessoaId: (l.pessoa_id as string) ?? null,
      cargo: (l.cargo as string) ?? null,
      etapa: l.etapa as EstagioAquisicao,
      origem: (l.origem as string) ?? null,
      canal: (l.canal as string) ?? null,
      campanha: (l.campanha as string) ?? null,
      responsavel: (l.responsavel as string) ?? null,
      responsavelId: (l.responsavel_id as string) ?? null,
      qualificado: Boolean(l.qualificado),
      email: (l.email as string) ?? null,
      telefone: (l.telefone as string) ?? null,
      primeiroToque: (l.primeiro_toque as string) ?? null,
      ultimoToque: (l.ultimo_toque as string) ?? null,
      criadoEm: String(l.criado_em),
      retomarEm: (l.retomar_em as string) ?? null,
      motivoDesqualificacao: (l.motivo_desqualificacao as string) ?? null,
      semDono: !l.responsavel_id,
    }))
    .filter((c) => !etapas || etapas.includes(c.etapa));

  // O contador NUNCA sai da lista truncada: com limite de 400, contar o array
  // faria a coluna dizer 400 onde há 2.392. Vem de count() sobre a tabela.
  const totais = await db.execute<{ etapa: string; n: number }>(sql`
    SELECT CASE
             WHEN a.desqualificado_em IS NOT NULL THEN 'desqualificado'
             WHEN a.nutricao_status IS NOT NULL AND a.nutricao_status <> '' THEN 'nutricao'
             WHEN EXISTS (SELECT 1 FROM oportunidades o
                           WHERE o.organizacao_id = a.organizacao_id
                             AND (o.pessoa_id = a.pessoa_id OR o.empresa_id = a.empresa_id)
                             AND o.ganho_at IS NULL AND o.perdido_at IS NULL) THEN 'oportunidade'
             WHEN a.qualificado THEN 'qualificado'
             WHEN a.last_touch_at IS NOT NULL AND a.first_touch_at IS NOT NULL
                  AND a.last_touch_at > a.first_touch_at THEN 'em_contato'
             ELSE 'novo'
           END AS etapa, count(*)::int AS n
      FROM aquisicoes a
      LEFT JOIN LATERAL (
        SELECT campaign FROM pontos_contato t
         WHERE t.aquisicao_id = a.id
         ORDER BY t.is_first_touch DESC, t.ocorrido_em ASC LIMIT 1
      ) pc ON TRUE
     WHERE a.organizacao_id = ${organizacaoId}::uuid
       AND (${filtros.incluirEncerradas ? sql`TRUE` : sql`a.closed_at IS NULL`})
       AND (${filtros.responsavelId ?? null}::uuid IS NULL OR a.responsavel_id = ${filtros.responsavelId ?? null}::uuid)
       AND (${filtros.origem ?? null}::text IS NULL OR a.origem = ${filtros.origem ?? null})
       AND (${filtros.campanha ?? null}::text IS NULL OR pc.campaign = ${filtros.campanha ?? null})
       AND (${filtros.desde ?? null}::date IS NULL OR a.created_at >= ${filtros.desde ?? null}::date)
     GROUP BY 1`);

  const totaisPorEtapa: Record<string, number> = {};
  for (const t of totais) totaisPorEtapa[t.etapa] = Number(t.n);
  const total = Object.values(totaisPorEtapa).reduce((s, n) => s + n, 0);

  return { cards, totaisPorEtapa, total };
}
