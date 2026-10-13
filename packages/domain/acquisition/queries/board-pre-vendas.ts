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
  | "novo" | "em_contato" | "qualificacao" | "qualificado" | "oportunidade"
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
  /**
   * Próxima ação — a tarefa aberta mais próxima de vencer.
   *
   * NÃO é um campo de texto do card. É a Task real, e por isso ela tem `id`:
   * o card linka para a tarefa, e "sem próxima ação" é a ausência de linha
   * aqui, não uma string vazia que alguém esqueceu de preencher.
   */
  proximaAcao: { id: string; titulo: string; venceEm: string | null } | null;
}

export interface FiltrosBoard {
  etapas?: EstagioAquisicao[];
  responsavelId?: string | null;
  /** Recorta o board para as aquisições sem dono.
   *
   * O card já expunha `semDono` e o resumo já contava quantas eram, mas não
   * havia como VER quais: o operador lia "223 sem responsável" e não tinha
   * caminho a partir dali. O número virava enfeite, que é justamente o que a
   * spec proíbe (§23.4, "não mostre KPI sobre o qual não se pode agir"). */
  semDono?: boolean;
  origem?: string | null;
  campanha?: string | null;
  busca?: string | null;
  desde?: string | null;
  incluirEncerradas?: boolean;
  limite?: number;
  /**
   * Quantos cartões por coluna.
   *
   * Era derivado — `ceil(limite / 6)` sobre um limite global de 400, o que dava
   * 67 fixos em TODA coluna. O cabeçalho dizia "2.919" e a coluna mostrava 67:
   * o número e a lista discordavam na mesma tela, e não havia como chegar no
   * resto. Agora é explícito e a tela decide, com "ver mais" por cima.
   */
  porColuna?: number;

  /* ── Views operacionais ────────────────────────────────────────────────
   *
   * Resolvidas em SQL, nunca filtrando o array depois. O limite é POR COLUNA
   * (67 de 2.919), então recortar em memória mostraria "12 atrasados" quando
   * há 400: o contador da coluna vem de `count()` sobre a tabela e passaria a
   * discordar dos cards logo abaixo dele. Foi exatamente esse o bug que a
   * consulta de totais existe para não repetir.
   * ──────────────────────────────────────────────────────────────────── */

  /** Sem nenhuma tarefa aberta. É a ausência da Task, não um campo vazio. */
  semProximaAcao?: boolean;
  /** Próxima ação vence até este instante (ISO). Cobre "Hoje" e "vencidas". */
  proximaAcaoAte?: string | null;
  /**
   * Recorte "atrasados": próxima ação vencida OU parado além do SLA.
   *
   * Os dois critérios vêm juntos porque atraso é um só conceito para quem
   * opera — "está passando da hora" —, e separá-los em dois filtros obrigaria
   * a tela a saber montar o OU. O limiar em horas chega de fora: política de
   * SLA é da camada de produto, não deste pacote.
   */
  atrasado?: { agora: string; semToqueHa: number } | null;
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

/**
 * A etapa do card e o total da coluna precisam sair da MESMA expressão. Eram
 * duas cópias do mesmo CASE em consultas diferentes, e duas cópias da mesma
 * regra divergem em silêncio — é o bug que este refactor existe para acabar.
 *
 * `pe.codigo` é a etapa gravada (SPEC §8.2) e manda. O CASE é o fallback para
 * aquisição sem etapa própria: deixou de ser a verdade, não deixou de existir.
 */
function expressaoDeEtapa(sql: SqlTag): unknown {
  return sql`COALESCE(pe.codigo, CASE
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
           END)`;
}

/**
 * Prospecção NÃO é Pré-vendas, e o board não pode contar as duas.
 *
 * O board de Pré-vendas abria com 62 cards em "Novo" e 37 deles eram leads
 * `origem='outbound'` que em produção estavam parados na coluna "Outbound" do
 * board legado — nunca entraram no funil de pré-vendas. O de/para do backfill
 * 06b manda a coluna `outbound` para a etapa `novo`, e o board, que lê
 * `aquisicoes` sem olhar o estado de prospecção, os misturava com os 25 leads
 * de inbound que são Novo de verdade.
 *
 * O recorte é o contrato que o próprio módulo de Prospecção já declara
 * (`lib/vendas/prospeccao.ts`), e por isso vale em runtime, não só na carga:
 *
 *   novo, em_cadencia, respondeu, sem_resposta → prospect em trabalho, está
 *     em Prospecção e em lugar nenhum do Kanban.
 *   descartado  → `descartar()`: "Desqualificado fica reservado a Pré-vendas",
 *     ou seja, o descarte do outbound não é uma coluna daqui.
 *   oportunidade → `oportunidadeDireta()`: "o prospect NÃO vira Lead de
 *     Pré-vendas", vai direto para o Pipeline.
 *   pre_qualificado → `preQualificar()`: "Entrou em Pré-vendas na etapa Novo".
 *     É a ÚNICA saída do outbound que entra neste board.
 *   NULL → nunca foi prospect. Todo o inbound.
 *
 * Fora daqui o conserto seria `closed_at` na aquisição, e seria mentira: o
 * processo de aquisição do prospect está aberto, só não está em pré-vendas.
 * Pior, `preQualificar` reabriria o buraco — `registrarEntrada` só reaproveita
 * aquisição ABERTA, então uma fechada faria a pré-qualificação tentar criar a
 * segunda e bater no índice único `uq_aquisicoes_lead_legado`.
 *
 * Depende do alias `lg` (a tabela `leads`) estar no FROM de quem chama.
 */
export function somenteDePreVendas(sql: SqlTag): unknown {
  // `canonical_lead_id` preenchido = o lead foi mesclado em outro; quem conta é o canônico.
  return sql`((lg.prospeccao_estado IS NULL OR lg.prospeccao_estado = 'pre_qualificado') AND lg.canonical_lead_id IS NULL)`;
}

/**
 * A tarefa aberta mais próxima de vencer, por aquisição.
 *
 * `LATERAL` e não `JOIN`: só a primeira linha interessa, e um join comum
 * multiplicaria a aquisição por quantas tarefas ela tenha. `lead_legado_id` é
 * a ponte enquanto Task continuar pendurada no lead — quando ela passar a
 * apontar para a aquisição, muda só esta função.
 *
 * `NULLS LAST` é regra de negócio, não detalhe: tarefa sem prazo não é a mais
 * urgente, é a que não tem hora marcada. Ela só vira próxima ação quando não
 * existe nenhuma com data.
 */
function proximaAcaoLateral(sql: SqlTag): unknown {
  return sql`LEFT JOIN LATERAL (
        SELECT t.id::text AS id, t.titulo,
               COALESCE(t.vence_em, t.data_vencimento::timestamptz) AS vence_em
          FROM tarefas t
         WHERE t.lead_id = a.lead_legado_id
           AND t.organizacao_id = a.organizacao_id
           AND t.concluida = false
         ORDER BY COALESCE(t.vence_em, t.data_vencimento::timestamptz) ASC NULLS LAST
         LIMIT 1
      ) px ON TRUE`;
}

/**
 * As condições das views rápidas, iguais nas duas consultas.
 *
 * Estão aqui numa função só porque cards e totais PRECISAM concordar: duas
 * cópias da mesma condição divergem em silêncio, e o board passa a anunciar um
 * número que os cartões desmentem.
 */
function condicoesDeView(sql: SqlTag, f: FiltrosBoard): unknown {
  return sql`
       AND (${f.semProximaAcao ? sql`px.id IS NULL` : sql`TRUE`})
       AND (${f.proximaAcaoAte ?? null}::timestamptz IS NULL
            OR px.vence_em <= ${f.proximaAcaoAte ?? null}::timestamptz)
       AND (${f.atrasado ? sql`(
              px.vence_em < ${f.atrasado.agora}::timestamptz
              OR COALESCE(a.last_touch_at, a.first_touch_at, a.created_at)
                 < ${f.atrasado.agora}::timestamptz - make_interval(hours => ${f.atrasado.semToqueHa})
            )` : sql`TRUE`})`;
}

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
           -- O nome da empresa segue a MESMA precedência do board legado
           -- (api-server/routes/leads.ts:439): o texto que a pessoa preencheu
           -- vem primeiro, a entidade depois.
           --
           -- Ler só e.nome fazia 467 dos 1.620 cards ativos dizerem "Empresa
           -- nao informada" com o nome gravado em leads.empresa, medido em
           -- 23/09. A entidade nao existe para eles porque o texto veio de
           -- formulario e nunca virou uma linha em empresas; descartar o texto
           -- e perder dado que o sistema antigo mostrava, nao e ausencia.
           COALESCE(NULLIF(trim(lg.empresa), ''), e.nome) AS empresa, a.empresa_id::text,
           NULLIF(trim((CASE WHEN COALESCE(trim(p.sobrenome),'')='' THEN trim(p.nome) WHEN lower(trim(p.sobrenome))=lower(trim(p.nome)) OR lower(trim(p.sobrenome)) LIKE lower(trim(p.nome))||' %' THEN trim(p.sobrenome) WHEN lower(trim(p.nome)) LIKE '% '||lower(trim(p.sobrenome)) THEN trim(p.nome) ELSE trim(p.nome)||' '||trim(p.sobrenome) END)), '') AS pessoa,
           a.pessoa_id::text, p.cargo,
           ${expressaoDeEtapa(sql)} AS etapa,
           a.origem, a.canal, pc.campaign AS campanha,
           u.nome AS responsavel, a.responsavel_id::text,
           a.qualificado, p.email, p.telefone,
           a.first_touch_at::text AS primeiro_toque,
           a.last_touch_at::text AS ultimo_toque,
           a.created_at::text AS criado_em,
           a.retomar_em::text, a.motivo_desqualificacao,
           px.id AS proxima_acao_id, px.titulo AS proxima_acao_titulo,
           px.vence_em::text AS proxima_acao_vence_em,
           a.updated_at AS ordenacao
      FROM aquisicoes a
      LEFT JOIN empresas e ON e.id = a.empresa_id
      LEFT JOIN leads    lg ON lg.id = a.lead_legado_id
      LEFT JOIN pessoas  p ON p.id = a.pessoa_id
      LEFT JOIN usuarios u ON u.id = a.responsavel_id
      LEFT JOIN pipeline_etapas pe ON pe.id = a.etapa_id
      -- Atribuição vem do primeiro toque, que é o que originou a aquisição.
      LEFT JOIN LATERAL (
        SELECT campaign FROM pontos_contato t
         WHERE t.aquisicao_id = a.id
         ORDER BY t.is_first_touch DESC, t.ocorrido_em ASC LIMIT 1
      ) pc ON TRUE
      ${proximaAcaoLateral(sql)}
     WHERE a.organizacao_id = ${organizacaoId}::uuid
       AND (${filtros.incluirEncerradas
              ? sql`(a.closed_at IS NULL OR a.desqualificado_em IS NOT NULL
                     OR COALESCE(a.nutricao_status, '') <> '')`
              : sql`a.closed_at IS NULL`})
       AND ${somenteDePreVendas(sql)}
       AND (${filtros.responsavelId ?? null}::uuid IS NULL OR a.responsavel_id = ${filtros.responsavelId ?? null}::uuid)
       AND (${filtros.semDono ? sql`a.responsavel_id IS NULL` : sql`TRUE`})
       AND (${filtros.origem ?? null}::text IS NULL OR a.origem = ${filtros.origem ?? null})
       AND (${filtros.campanha ?? null}::text IS NULL OR pc.campaign = ${filtros.campanha ?? null})
       AND (${filtros.desde ?? null}::date IS NULL OR a.created_at >= ${filtros.desde ?? null}::date)
       ${condicoesDeView(sql, filtros)}
       AND (${busca}::text IS NULL OR
            lower(COALESCE(NULLIF(trim(lg.empresa), ''), e.nome, '')) LIKE ${busca} OR
            lower(concat_ws(' ', p.nome, p.sobrenome)) LIKE ${busca} OR
            lower(COALESCE(p.email, '')) LIKE ${busca})
    )
    SELECT * FROM (
      SELECT base.*, row_number() OVER (PARTITION BY etapa ORDER BY ordenacao DESC) AS pos
        FROM base
    ) q
     WHERE pos <= ${Math.max(1, filtros.porColuna ?? Math.ceil(limite / 6))}
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
      proximaAcao: l.proxima_acao_id
        ? {
            id: String(l.proxima_acao_id),
            titulo: String(l.proxima_acao_titulo ?? "Tarefa"),
            venceEm: (l.proxima_acao_vence_em as string) ?? null,
          }
        : null,
    }))
    .filter((c) => !etapas || etapas.includes(c.etapa));

  // O contador NUNCA sai da lista truncada: com limite de 400, contar o array
  // faria a coluna dizer 400 onde há 2.392. Vem de count() sobre a tabela.
  const totais = await db.execute<{ etapa: string; n: number }>(sql`
    SELECT ${expressaoDeEtapa(sql)} AS etapa, count(*)::int AS n
      FROM aquisicoes a
      LEFT JOIN pipeline_etapas pe ON pe.id = a.etapa_id
      -- lg só existe aqui por causa de somenteDePreVendas(). O total e os
      -- cards precisam do MESMO recorte: duas cópias da regra divergem calado.
      LEFT JOIN leads lg ON lg.id = a.lead_legado_id
      LEFT JOIN LATERAL (
        SELECT campaign FROM pontos_contato t
         WHERE t.aquisicao_id = a.id
         ORDER BY t.is_first_touch DESC, t.ocorrido_em ASC LIMIT 1
      ) pc ON TRUE
      ${proximaAcaoLateral(sql)}
     WHERE a.organizacao_id = ${organizacaoId}::uuid
       AND (${filtros.incluirEncerradas
              ? sql`(a.closed_at IS NULL OR a.desqualificado_em IS NOT NULL
                     OR COALESCE(a.nutricao_status, '') <> '')`
              : sql`a.closed_at IS NULL`})
       AND ${somenteDePreVendas(sql)}
       AND (${filtros.responsavelId ?? null}::uuid IS NULL OR a.responsavel_id = ${filtros.responsavelId ?? null}::uuid)
       AND (${filtros.semDono ? sql`a.responsavel_id IS NULL` : sql`TRUE`})
       AND (${filtros.origem ?? null}::text IS NULL OR a.origem = ${filtros.origem ?? null})
       AND (${filtros.campanha ?? null}::text IS NULL OR pc.campaign = ${filtros.campanha ?? null})
       AND (${filtros.desde ?? null}::date IS NULL OR a.created_at >= ${filtros.desde ?? null}::date)
       ${condicoesDeView(sql, filtros)}
     GROUP BY 1`);

  const totaisPorEtapa: Record<string, number> = {};
  for (const t of totais) totaisPorEtapa[t.etapa] = Number(t.n);
  const total = Object.values(totaisPorEtapa).reduce((s, n) => s + n, 0);

  return { cards, totaisPorEtapa, total };
}
