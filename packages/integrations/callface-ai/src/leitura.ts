/**
 * As leituras do SaaS Callface AI. Só SELECT.
 *
 * A REGRA DE ATRIBUIÇÃO, que é o coração deste arquivo:
 *
 * A tabela de chamadas NÃO tem organization_id. A organização precisa vir por
 * cadeia, e as cadeias discordam entre si. Medido contra produção em
 * 21/09/2026, sobre 1.803.331 chamadas de 90 dias:
 *
 *     campanha  ->  organization_id   64,1% de cobertura
 *     contato   ->  organization_id   73,7%
 *     usuario   ->  users_organizations 96,8% (3 usuarios de 3.034 em 2 orgs)
 *
 *     uma so candidata ........ 1.758.723  97,53%
 *     candidatas DIVERGENTES ..    41.411   2,30%
 *     nenhuma candidata .......     3.197   0,18%
 *
 * Os 2,3% divergem de verdade: campanha de uma organização discando contato de
 * outra, sempre envolvendo conta de parceiro. Não dá para saber de quem é o uso
 * sem conhecer a regra comercial de white label, então esses NÃO são atribuídos
 * a ninguém. Eles são contados e devolvidos como ambiguidade, que é o que
 * permite alguém decidir depois em vez de o número mentir agora.
 *
 * A hierarquia pai/filho que a auditoria de agosto sugeriu usar NÃO existe:
 * parent_organization_id está nulo em 1.779 de 1.779 organizações.
 */
import type { Sql } from "postgres";

/** Fatos do tenant que saem de tabelas com organization_id direto. */
export interface TenantCallfaceAi {
  organizationId: string;
  nome: string;
  documentNumber: string | null;
  email: string | null;
  stripeCustomerId: string | null;
  appClientId: string | null;
  criadoEm: Date;
  usuariosTotal: number;
  usuariosAceitos: number;
  usuariosAtivos: number;
  usuariosPendentes: number;
  licencasAtivas: number;
  workspacesAtivos: number;
  agentesProntos: number;
  appsAtivos: number;
  webhooksAtivos: number;
  contatosBase: number;
}

/** Uso medido numa janela, já com a organização resolvida. */
export interface UsoCallfaceAi {
  organizationId: string;
  chamadasTotal: number;
  chamadasFinalizadas: number;
  chamadasAmbiguas: number;
  segundosUso: number;
  usuariosComAtividade: number;
  campanhasAtivas: number;
  campanhasConcluidas: number;
  sessoesCopilot: number;
  reunioes: number;
  ultimaAtividadeEm: Date | null;
}

/** Chamadas cuja organização não pôde ser decidida, agregadas por janela. */
export interface AmbiguidadeGlobal {
  chamadasAmbiguas: number;
  chamadasSemAtribuicao: number;
  chamadasTotal: number;
}

export async function lerTenants(sql: Sql, organizationIds?: string[]): Promise<TenantCallfaceAi[]> {
  const filtro = organizationIds?.length
    ? sql`WHERE o.id IN ${sql(organizationIds)}`
    : sql``;
  const linhas = await sql<Array<Record<string, unknown>>>`
    SELECT o.id, o.name, o.document_number, o.email, o.stripe_customer_id,
           o.app_client_id, o.created_at AT TIME ZONE 'UTC' AS created_at,
           (SELECT count(*) FROM users_organizations uo WHERE uo.organization_id = o.id) AS usuarios_total,
           (SELECT count(*) FROM users_organizations uo
             WHERE uo.organization_id = o.id AND uo.acceptance_status = 'ACCEPTED') AS usuarios_aceitos,
           (SELECT count(*) FROM users_organizations uo JOIN users u ON u.id = uo.user_id
             WHERE uo.organization_id = o.id AND uo.deactivated_at IS NULL AND u.active) AS usuarios_ativos,
           (SELECT count(*) FROM users_organizations uo
             WHERE uo.organization_id = o.id AND uo.acceptance_status = 'PENDING') AS usuarios_pendentes,
           (SELECT count(*) FROM license l WHERE l.organization_id = o.id
              AND l.revoked_at IS NULL AND (l.expires_at IS NULL OR l.expires_at > (now() AT TIME ZONE 'UTC'))) AS licencas_ativas,
           (SELECT count(*) FROM workspaces w WHERE w.organization_id = o.id AND w.status = 'active') AS workspaces_ativos,
           (SELECT count(*) FROM agents a WHERE a.organization_id = o.id AND a.status = 'COMPLETED') AS agentes_prontos,
           (SELECT count(*) FROM organizations_apps oa WHERE oa.organization_id = o.id AND oa.is_active) AS apps_ativos,
           (SELECT count(*) FROM organization_webhooks ow WHERE ow.organization_id = o.id AND ow.active) AS webhooks_ativos,
           (SELECT count(*) FROM contacts c WHERE c.organization_id = o.id) AS contatos_base
      FROM organizations o
      ${filtro}
     ORDER BY o.created_at`;
  return linhas.map((l) => ({
    organizationId: String(l.id),
    nome: String(l.name ?? ""),
    documentNumber: (l.document_number as string) ?? null,
    email: (l.email as string) ?? null,
    stripeCustomerId: (l.stripe_customer_id as string) ?? null,
    appClientId: (l.app_client_id as string) ?? null,
    criadoEm: l.created_at as Date,
    usuariosTotal: Number(l.usuarios_total ?? 0),
    usuariosAceitos: Number(l.usuarios_aceitos ?? 0),
    usuariosAtivos: Number(l.usuarios_ativos ?? 0),
    usuariosPendentes: Number(l.usuarios_pendentes ?? 0),
    licencasAtivas: Number(l.licencas_ativas ?? 0),
    workspacesAtivos: Number(l.workspaces_ativos ?? 0),
    agentesProntos: Number(l.agentes_prontos ?? 0),
    appsAtivos: Number(l.apps_ativos ?? 0),
    webhooksAtivos: Number(l.webhooks_ativos ?? 0),
    contatosBase: Number(l.contatos_base ?? 0),
  }));
}

/**
 * Chamada com duração absurda existe: 157 delas passam de 2 horas nos últimos
 * 90 dias. Não são conversas, são sessão que nunca fechou. Entram no total de
 * chamadas e ficam de fora dos minutos, senão uma única linha de 71 horas
 * inventa mais de mil minutos de uso para o cliente.
 */
const TETO_SEGUNDOS_POR_CHAMADA = 7200;

export async function lerUso(
  sql: Sql, janelaDias: number, organizationIds: string[],
): Promise<UsoCallfaceAi[]> {
  if (!organizationIds.length) return [];
  const linhas = await sql<Array<Record<string, unknown>>>`
    WITH janela AS (
      -- A janela na MESMA régua dos dados: UTC. now() do servidor do SaaS
      -- convertido para UTC antes de subtrair os dias.
      SELECT ((now() AT TIME ZONE 'UTC') - make_interval(days => ${janelaDias})) AS inicio
    ),
    atribuicao AS (
      SELECT c.id, c.status, c.duration, c.user_id, c.created_at,
             ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[
               cp.organization_id,
               ct.organization_id,
               CASE WHEN uo.n = 1 THEN uo.org END
             ]) x WHERE x IS NOT NULL) AS candidatas
        FROM calls c
        CROSS JOIN janela j
        LEFT JOIN campaigns cp ON cp.id = c.campaign_id
        LEFT JOIN contacts  ct ON ct.id = c.contact_id
        LEFT JOIN LATERAL (
          SELECT count(DISTINCT u.organization_id) AS n, min(u.organization_id) AS org
            FROM users_organizations u WHERE u.user_id = c.user_id
        ) uo ON TRUE
       WHERE c.created_at >= j.inicio
    ),
    resolvido AS (
      SELECT candidatas[1] AS organization_id, id, status, duration, user_id, created_at,
             (array_length(candidatas, 1) = 1) AS unica
        FROM atribuicao WHERE candidatas <> '{}'
    ),
    -- A ambígua conta para CADA candidata: o cliente precisa saber que existem
    -- N chamadas que podem ser dele, sem que elas entrem no total dele.
    ambiguas AS (
      SELECT unnest(candidatas) AS organization_id, count(*) OVER () AS _
        FROM atribuicao WHERE array_length(candidatas, 1) > 1
    ),
    uso AS (
      SELECT organization_id,
             count(*) AS chamadas_total,
             count(*) FILTER (WHERE status = 'FINISHED') AS chamadas_finalizadas,
             coalesce(sum(least(coalesce(duration, 0), ${TETO_SEGUNDOS_POR_CHAMADA})), 0) AS segundos_uso,
             count(DISTINCT user_id) AS usuarios_com_atividade,
             max(created_at) AS ultima_chamada
        FROM resolvido WHERE unica GROUP BY organization_id
    )
    SELECT o.id AS organization_id,
           coalesce(u.chamadas_total, 0) AS chamadas_total,
           coalesce(u.chamadas_finalizadas, 0) AS chamadas_finalizadas,
           coalesce((SELECT count(*) FROM ambiguas a WHERE a.organization_id = o.id), 0) AS chamadas_ambiguas,
           coalesce(u.segundos_uso, 0) AS segundos_uso,
           coalesce(u.usuarios_com_atividade, 0) AS usuarios_com_atividade,
           (SELECT count(*) FROM campaigns cp WHERE cp.organization_id = o.id
              AND cp.deleted_at IS NULL AND cp.status = 'ACTIVE') AS campanhas_ativas,
           (SELECT count(*) FROM campaigns cp CROSS JOIN janela j WHERE cp.organization_id = o.id
              AND cp.deleted_at IS NULL AND cp.completed_at >= j.inicio) AS campanhas_concluidas,
           (SELECT count(*) FROM sales_copilot_sessions s CROSS JOIN janela j
             WHERE s.organization_id = o.id AND s.created_at >= j.inicio) AS sessoes_copilot,
           -- Reunião não tem organization_id: chega pelo usuário, que é
           -- determinístico para 3.031 dos 3.034 usuários.
           (SELECT count(*) FROM meetings m
              JOIN users_organizations uo ON uo.user_id = m.user_id
              CROSS JOIN janela j
             WHERE uo.organization_id = o.id AND m.created_at >= j.inicio) AS reunioes,
           -- FUSO. O SaaS guarda timestamp WITHOUT time zone, em UTC. Lido cru,
           -- o driver o interpreta como hora local (UTC-3) e a "última
           -- atividade" sai 3 horas no FUTURO — medido: -02:48 de diferença na
           -- primeira coleta. Isso não quebra nada barulhento; só envenena todo
           -- cálculo de dias sem uso, que é o sinal central de CS.
           GREATEST(
             u.ultima_chamada,
             (SELECT max(s.created_at) FROM sales_copilot_sessions s WHERE s.organization_id = o.id),
             (SELECT max(cp.updated_at) FROM campaigns cp WHERE cp.organization_id = o.id AND cp.deleted_at IS NULL)
           ) AT TIME ZONE 'UTC' AS ultima_atividade_em
      FROM organizations o
      LEFT JOIN uso u ON u.organization_id = o.id
     WHERE o.id IN ${sql(organizationIds)}`;
  return linhas.map((l) => ({
    organizationId: String(l.organization_id),
    chamadasTotal: Number(l.chamadas_total ?? 0),
    chamadasFinalizadas: Number(l.chamadas_finalizadas ?? 0),
    chamadasAmbiguas: Number(l.chamadas_ambiguas ?? 0),
    segundosUso: Number(l.segundos_uso ?? 0),
    usuariosComAtividade: Number(l.usuarios_com_atividade ?? 0),
    campanhasAtivas: Number(l.campanhas_ativas ?? 0),
    campanhasConcluidas: Number(l.campanhas_concluidas ?? 0),
    sessoesCopilot: Number(l.sessoes_copilot ?? 0),
    reunioes: Number(l.reunioes ?? 0),
    ultimaAtividadeEm: (l.ultima_atividade_em as Date) ?? null,
  }));
}

/** O tamanho da ambiguidade na janela, para o relatório de qualidade. */
export async function medirAmbiguidade(sql: Sql, janelaDias: number): Promise<AmbiguidadeGlobal> {
  const [l] = await sql<Array<Record<string, unknown>>>`
    WITH a AS (
      SELECT ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[
               cp.organization_id, ct.organization_id,
               CASE WHEN uo.n = 1 THEN uo.org END]) x WHERE x IS NOT NULL) AS candidatas
        FROM calls c
        LEFT JOIN campaigns cp ON cp.id = c.campaign_id
        LEFT JOIN contacts  ct ON ct.id = c.contact_id
        LEFT JOIN LATERAL (
          SELECT count(DISTINCT u.organization_id) AS n, min(u.organization_id) AS org
            FROM users_organizations u WHERE u.user_id = c.user_id) uo ON TRUE
       WHERE c.created_at >= (now() AT TIME ZONE 'UTC') - make_interval(days => ${janelaDias})
    )
    SELECT count(*) AS total,
           count(*) FILTER (WHERE array_length(candidatas,1) > 1) AS ambiguas,
           count(*) FILTER (WHERE candidatas = '{}') AS sem_atribuicao
      FROM a`;
  return {
    chamadasTotal: Number(l?.total ?? 0),
    chamadasAmbiguas: Number(l?.ambiguas ?? 0),
    chamadasSemAtribuicao: Number(l?.sem_atribuicao ?? 0),
  };
}
