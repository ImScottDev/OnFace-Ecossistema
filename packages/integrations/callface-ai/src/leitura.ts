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

// ───────────────────────────────────────────────────────────────────────────
// Vínculo: o que o ONFACE precisa saber de TODAS as organizações para ligar
// por evidência forte e sugerir candidatas. 1.779 linhas, leitura única.
// ───────────────────────────────────────────────────────────────────────────

export interface OrganizacaoCallfaceAi {
  id: string;
  nome: string;
  documentNumber: string | null;
  email: string | null;
  stripeCustomerId: string | null;
  desativadaEm: Date | null;
  /** E-mails (minúsculos) dos usuários CREATOR da organização: o dono. */
  donos: string[];
}

export async function lerOrganizacoes(sql: Sql): Promise<OrganizacaoCallfaceAi[]> {
  const orgs = await sql<Array<Record<string, unknown>>>`
    SELECT id, name, document_number, email, stripe_customer_id,
           deactivated_at AT TIME ZONE 'UTC' AS deactivated_at
      FROM organizations`;
  const donos = await sql<Array<{ organization_id: string; email: string }>>`
    SELECT uo.organization_id, lower(trim(u.email)) AS email
      FROM users_organizations uo JOIN users u ON u.id = uo.user_id
     WHERE uo.kind = 'CREATOR' AND u.email IS NOT NULL`;
  const porOrg = new Map<string, string[]>();
  for (const d of donos) porOrg.set(d.organization_id, [...(porOrg.get(d.organization_id) ?? []), d.email]);
  return orgs.map((o) => ({
    id: String(o.id),
    nome: String(o.name ?? ""),
    documentNumber: (o.document_number as string) ?? null,
    email: o.email ? String(o.email).trim().toLowerCase() : null,
    stripeCustomerId: (o.stripe_customer_id as string) ?? null,
    desativadaEm: (o.deactivated_at as Date) ?? null,
    donos: [...new Set(porOrg.get(String(o.id)) ?? [])],
  }));
}

// ───────────────────────────────────────────────────────────────────────────
// Detalhe por organização: plano/licenças, usuários, campanhas, agentes,
// integrações. NUNCA lê `credentials` de organizations_apps nem o conteúdo de
// `headers` dos webhooks: só o que o CS precisa ver.
// ───────────────────────────────────────────────────────────────────────────

export interface LicencaPorPlano { plano: string; motivo: string; qtd: number; atribuidas: number; minutos: number; semLimite: boolean }
export interface UsuarioCallfaceAi {
  nome: string | null; email: string | null; papel: string; aceite: string;
  ativo: boolean; ultimaChamadaEm: Date | null; chamadas7d: number; chamadas30d: number;
}
export interface DetalheCallfaceAi {
  organizationId: string;
  nome: string; criadaEm: Date | null; desativadaEm: Date | null;
  licencas: LicencaPorPlano[];
  usuarios: UsuarioCallfaceAi[];
  campanhas: { porStatus: Record<string, number>; recentes: Array<{ nome: string; status: string; total: number; discados: number; atualizadaEm: Date | null }> };
  agentes: { porStatus: Record<string, number>; lista: Array<{ nome: string; status: string; criadoEm: Date | null }> };
  integracoes: { apps: Array<{ nome: string; ativo: boolean }>; webhooksAtivos: number };
}

const LISTA_CURTA = 8;
const USUARIOS_NA_LISTA = 40;

export async function lerDetalhe(sql: Sql, organizationIds: string[]): Promise<DetalheCallfaceAi[]> {
  if (!organizationIds.length) return [];
  const ids = sql(organizationIds);
  const [orgs, lic, usu, camp, campRec, ag, apps, hooks] = await Promise.all([
    sql<Array<Record<string, unknown>>>`
      SELECT id, name, created_at AT TIME ZONE 'UTC' AS criada, deactivated_at AT TIME ZONE 'UTC' AS desativada
        FROM organizations WHERE id IN ${ids}`,
    sql<Array<Record<string, unknown>>>`
      SELECT l.organization_id, coalesce(p.name, '(sem plano)') AS plano, l.reason::text AS motivo,
             count(*)::int AS qtd,
             count(coalesce(l.user_id, uo.user_id))::int AS atribuidas,
             coalesce(sum(l.allowed_usage_in_minutes), 0)::int AS minutos,
             bool_or(l.allowed_usage_in_minutes IS NULL) AS sem_limite
        FROM license l
        LEFT JOIN plans p ON p.id = l.plan_id
        LEFT JOIN user_subscriptions us ON us.id = l.user_subscription_id
        LEFT JOIN users_organizations uo ON uo.id = us.user_organization_id
       WHERE l.organization_id IN ${ids} AND l.revoked_at IS NULL
         AND (l.expires_at IS NULL OR l.expires_at > (now() AT TIME ZONE 'UTC'))
       GROUP BY 1, 2, 3`,
    sql<Array<Record<string, unknown>>>`
      SELECT uo.organization_id, u.id AS user_id, u.name, u.email, uo.kind::text AS papel,
             uo.acceptance_status::text AS aceite, (uo.deactivated_at IS NULL AND u.active) AS ativo
        FROM users_organizations uo JOIN users u ON u.id = uo.user_id
       WHERE uo.organization_id IN ${ids}`,
    sql<Array<Record<string, unknown>>>`
      SELECT organization_id, status::text AS status, count(*)::int AS n
        FROM campaigns WHERE organization_id IN ${ids} AND deleted_at IS NULL GROUP BY 1, 2`,
    sql<Array<Record<string, unknown>>>`
      SELECT * FROM (
        SELECT organization_id, name, status::text AS status, total_numbers, dialed_numbers,
               updated_at AT TIME ZONE 'UTC' AS atualizada,
               row_number() OVER (PARTITION BY organization_id ORDER BY updated_at DESC) AS rn
          FROM campaigns WHERE organization_id IN ${ids} AND deleted_at IS NULL AND status <> 'DRAFT') x
       WHERE rn <= ${LISTA_CURTA}`,
    sql<Array<Record<string, unknown>>>`
      SELECT organization_id, name, status::text AS status, created_at AT TIME ZONE 'UTC' AS criado
        FROM agents WHERE organization_id IN ${ids}`,
    sql<Array<Record<string, unknown>>>`
      SELECT oa.organization_id, a.name, oa.is_active
        FROM organizations_apps oa JOIN apps a ON a.id = oa.app_id
       WHERE oa.organization_id IN ${ids}`,
    sql<Array<Record<string, unknown>>>`
      SELECT organization_id, count(*)::int AS n FROM organization_webhooks
       WHERE organization_id IN ${ids} AND active GROUP BY 1`,
  ]);

  // Atividade por usuário. A ÚLTIMA chamada vale SEM janela (o índice
  // (user_id, created_at) responde "a mais recente" com uma descida de índice
  // por usuário): antes ela era cortada em 90 dias e quem parou há mais tempo
  // aparecia como "nunca ligou", que é mentira. As contagens 7d/30d seguem
  // limitadas pela janela.
  const userIds = [...new Set(usu.map((u) => String(u.user_id)))];
  const atividade = new Map<string, { ultima: Date | null; c7: number; c30: number }>();
  if (userIds.length) {
    const linhas = await sql<Array<Record<string, unknown>>>`
      SELECT uid AS user_id,
             (SELECT c.created_at AT TIME ZONE 'UTC' FROM calls c WHERE c.user_id = uid
               ORDER BY c.created_at DESC LIMIT 1) AS ultima,
             (SELECT count(*) FROM calls c WHERE c.user_id = uid
                AND c.created_at >= (now() AT TIME ZONE 'UTC') - interval '7 days')::int AS c7,
             (SELECT count(*) FROM calls c WHERE c.user_id = uid
                AND c.created_at >= (now() AT TIME ZONE 'UTC') - interval '30 days')::int AS c30
        FROM unnest(${sql.array(userIds)}::text[]) AS uid`;
    for (const l of linhas) atividade.set(String(l.user_id), { ultima: (l.ultima as Date) ?? null, c7: Number(l.c7), c30: Number(l.c30) });
  }

  const por = <T extends Record<string, unknown>>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) { const k = String(r.organization_id); m.set(k, [...(m.get(k) ?? []), r]); }
    return m;
  };
  const licPor = por(lic), usuPor = por(usu), campPor = por(camp), campRecPor = por(campRec),
    agPor = por(ag), appsPor = por(apps), hooksPor = por(hooks);

  return orgs.map((o) => {
    const id = String(o.id);
    const contar = (rows: Array<Record<string, unknown>> | undefined) =>
      Object.fromEntries((rows ?? []).map((r) => [String(r.status), Number(r.n)]));
    const agentes = (agPor.get(id) ?? []);
    const agPorStatus: Record<string, number> = {};
    for (const a of agentes) agPorStatus[String(a.status)] = (agPorStatus[String(a.status)] ?? 0) + 1;
    const usuarios: UsuarioCallfaceAi[] = (usuPor.get(id) ?? []).map((u) => {
      const at = atividade.get(String(u.user_id));
      return {
        nome: (u.name as string) ?? null, email: (u.email as string) ?? null,
        papel: String(u.papel), aceite: String(u.aceite), ativo: Boolean(u.ativo),
        ultimaChamadaEm: at?.ultima ?? null, chamadas7d: at?.c7 ?? 0, chamadas30d: at?.c30 ?? 0,
      };
    }).sort((a, b) => (b.ultimaChamadaEm?.getTime() ?? 0) - (a.ultimaChamadaEm?.getTime() ?? 0))
      .slice(0, USUARIOS_NA_LISTA);
    return {
      organizationId: id, nome: String(o.name ?? ""),
      criadaEm: (o.criada as Date) ?? null, desativadaEm: (o.desativada as Date) ?? null,
      licencas: (licPor.get(id) ?? []).map((l) => ({
        plano: String(l.plano), motivo: String(l.motivo), qtd: Number(l.qtd),
        atribuidas: Number(l.atribuidas), minutos: Number(l.minutos), semLimite: Boolean(l.sem_limite),
      })),
      usuarios,
      campanhas: {
        porStatus: contar(campPor.get(id)),
        recentes: (campRecPor.get(id) ?? []).map((c) => ({
          nome: String(c.name ?? ""), status: String(c.status), total: Number(c.total_numbers ?? 0),
          discados: Number(c.dialed_numbers ?? 0), atualizadaEm: (c.atualizada as Date) ?? null,
        })),
      },
      agentes: {
        porStatus: agPorStatus,
        lista: agentes.filter((a) => a.status !== "DELETED")
          .sort((a, b) => (b.criado as Date).getTime() - (a.criado as Date).getTime())
          .slice(0, LISTA_CURTA)
          .map((a) => ({ nome: String(a.name ?? ""), status: String(a.status), criadoEm: (a.criado as Date) ?? null })),
      },
      integracoes: {
        apps: (appsPor.get(id) ?? []).map((a) => ({ nome: String(a.name), ativo: Boolean(a.is_active) })),
        webhooksAtivos: Number(hooksPor.get(id)?.[0]?.n ?? 0),
      },
    };
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Série diária (ligações e minutos por dia civil de São Paulo), com a mesma
// regra de atribuição de `lerUso`. Só conta chamada de uma candidata única.
// Pede-se um intervalo de DIAS CIVIS [diaIni, diaFim) em São Paulo (UTC-3, sem
// horário de verão): fatias alinhadas ao dia, para que reler um dia o
// SUBSTITUA inteiro em vez de sobrescrever com um dia cortado ao meio.
// ───────────────────────────────────────────────────────────────────────────

export interface UsoDiarioCallfaceAi {
  organizationId: string; dia: string; chamadas: number; finalizadas: number; minutos: number; usuariosAtivos: number;
}

export async function lerUsoDiario(
  sql: Sql, organizationIds: string[], diaIni: string, diaFim: string,
): Promise<UsoDiarioCallfaceAi[]> {
  if (!organizationIds.length) return [];
  const linhas = await sql<Array<Record<string, unknown>>>`
    WITH atribuicao AS (
      SELECT c.status, c.duration, c.user_id, c.created_at,
             ARRAY(SELECT DISTINCT x FROM unnest(ARRAY[
               cp.organization_id, ct.organization_id,
               CASE WHEN uo.n = 1 THEN uo.org END]) x WHERE x IS NOT NULL) AS candidatas
        FROM calls c
        LEFT JOIN campaigns cp ON cp.id = c.campaign_id
        LEFT JOIN contacts  ct ON ct.id = c.contact_id
        LEFT JOIN LATERAL (
          SELECT count(DISTINCT u.organization_id) AS n, min(u.organization_id) AS org
            FROM users_organizations u WHERE u.user_id = c.user_id) uo ON TRUE
       WHERE c.created_at >= ${diaIni}::date + interval '3 hours'
         AND c.created_at <  ${diaFim}::date + interval '3 hours'
    )
    SELECT candidatas[1] AS organization_id,
           ((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           count(*)::int AS chamadas,
           count(*) FILTER (WHERE status = 'FINISHED')::int AS finalizadas,
           round(sum(least(coalesce(duration, 0), ${TETO_SEGUNDOS_POR_CHAMADA}))::numeric / 60, 2) AS minutos,
           count(DISTINCT user_id)::int AS usuarios_ativos
      FROM atribuicao
     WHERE array_length(candidatas, 1) = 1 AND candidatas[1] IN ${sql(organizationIds)}
     GROUP BY 1, 2`;
  return linhas.map((l) => ({
    organizationId: String(l.organization_id),
    dia: l.dia instanceof Date ? l.dia.toISOString().slice(0, 10) : String(l.dia),
    chamadas: Number(l.chamadas), finalizadas: Number(l.finalizadas),
    minutos: Number(l.minutos ?? 0), usuariosAtivos: Number(l.usuarios_ativos),
  }));
}


// ───────────────────────────────────────────────────────────────────────────
// Saúde do cliente: o que SÓ o SaaS sabe e a tela precisa para o semáforo.
//
// "Última atividade" NÃO existe no SaaS (não há last_login nem last_access).
// Deriva-se do uso real e SEM janela: a mais recente entre a última chamada de
// qualquer usuário da organização, a última sessão do copiloto e a última
// reunião. Mede uso, não abertura de aba. Chamada de campanha entra pela
// cadeia do usuário: medido em 13/10, 1.213 de 1.213 chamadas de campanha do
// dia têm usuário que pertence à organização da campanha.
//
// Tudo por índice: (user_id, created_at) em calls, (organization_id,
// started_at) em sales_copilot_sessions. Medido: 1.846 organizações em ~3,7 s.
// ───────────────────────────────────────────────────────────────────────────

export interface SaudeRdsCallfaceAi {
  organizationId: string;
  ultimaChamadaEm: Date | null;
  ultimaCopilotoEm: Date | null;
  ultimaReuniaoEm: Date | null;
  /** O mais recente dos três. */
  ultimaAtividadeEm: Date | null;
  /** Primeira licença paga (ou a criação da organização, sem licença). */
  inicioEm: Date | null;
  licencasPagas: number;
  licencaVenceEm: Date | null;
  licencasVencendo30d: number;
  licencasVencendo60d: number;
  copilotoSessoes30d: number;
  copilotoSugestoes30d: number;
  copilotoUsadas30d: number;
  assinaturasTotal: number;
  assinaturasCanceladas: number;
  canceladaEm: Date | null;
  cancelamentoMotivo: string | null;
}

export async function lerSaude(sql: Sql, organizationIds: string[]): Promise<SaudeRdsCallfaceAi[]> {
  if (!organizationIds.length) return [];
  const ids = sql(organizationIds);
  const linhas = await sql<Array<Record<string, unknown>>>`
    SELECT o.id AS organization_id,
      (SELECT max(x.ult) FROM users_organizations uo
         CROSS JOIN LATERAL (SELECT c.created_at AS ult FROM calls c
                              WHERE c.user_id = uo.user_id ORDER BY c.created_at DESC LIMIT 1) x
        WHERE uo.organization_id = o.id) AT TIME ZONE 'UTC' AS ultima_chamada,
      (SELECT max(coalesce(s.started_at, s.created_at)) FROM sales_copilot_sessions s
        WHERE s.organization_id = o.id) AT TIME ZONE 'UTC' AS ultima_copiloto,
      -- Reunião agendada para o futuro ainda não é uso.
      (SELECT max(x.ult) FROM users_organizations uo
         CROSS JOIN LATERAL (SELECT m.start_at AS ult FROM meetings m
                              WHERE m.user_id = uo.user_id AND m.start_at <= (now() AT TIME ZONE 'UTC')
                              ORDER BY m.start_at DESC LIMIT 1) x
        WHERE uo.organization_id = o.id) AT TIME ZONE 'UTC' AS ultima_reuniao,
      coalesce(
        (SELECT min(l.start_at) FROM license l WHERE l.organization_id = o.id
            AND l.revoked_at IS NULL AND l.reason::text <> 'TRIAL'),
        o.created_at) AT TIME ZONE 'UTC' AS inicio,
      (SELECT count(*) FROM license l WHERE l.organization_id = o.id AND l.revoked_at IS NULL
          AND l.reason::text <> 'TRIAL'
          AND (l.expires_at IS NULL OR l.expires_at > (now() AT TIME ZONE 'UTC')))::int AS licencas_pagas,
      (SELECT min(l.expires_at) FROM license l WHERE l.organization_id = o.id AND l.revoked_at IS NULL
          AND l.reason::text <> 'TRIAL' AND l.expires_at > (now() AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC' AS vence_em,
      (SELECT count(*) FROM license l WHERE l.organization_id = o.id AND l.revoked_at IS NULL
          AND l.reason::text <> 'TRIAL' AND l.expires_at > (now() AT TIME ZONE 'UTC')
          AND l.expires_at <= (now() AT TIME ZONE 'UTC') + interval '30 days')::int AS vence_30,
      (SELECT count(*) FROM license l WHERE l.organization_id = o.id AND l.revoked_at IS NULL
          AND l.reason::text <> 'TRIAL' AND l.expires_at > (now() AT TIME ZONE 'UTC')
          AND l.expires_at <= (now() AT TIME ZONE 'UTC') + interval '60 days')::int AS vence_60,
      (SELECT count(*) FROM sales_copilot_sessions s WHERE s.organization_id = o.id
          AND s.created_at >= (now() AT TIME ZONE 'UTC') - interval '30 days')::int AS cop_sessoes,
      (SELECT coalesce(sum(s.suggestions_total), 0) FROM sales_copilot_sessions s WHERE s.organization_id = o.id
          AND s.created_at >= (now() AT TIME ZONE 'UTC') - interval '30 days')::int AS cop_sugestoes,
      (SELECT coalesce(sum(s.suggestions_used), 0) FROM sales_copilot_sessions s WHERE s.organization_id = o.id
          AND s.created_at >= (now() AT TIME ZONE 'UTC') - interval '30 days')::int AS cop_usadas,
      (SELECT count(*) FROM user_subscriptions us JOIN users_organizations uo ON uo.id = us.user_organization_id
        WHERE uo.organization_id = o.id)::int AS ass_total,
      (SELECT count(*) FROM user_subscriptions us JOIN users_organizations uo ON uo.id = us.user_organization_id
        WHERE uo.organization_id = o.id AND us.canceled_at IS NOT NULL)::int AS ass_canceladas,
      (SELECT max(us.canceled_at) FROM user_subscriptions us JOIN users_organizations uo ON uo.id = us.user_organization_id
        WHERE uo.organization_id = o.id AND us.canceled_at IS NOT NULL) AT TIME ZONE 'UTC' AS cancelada_em,
      (SELECT us.canceled_reason FROM user_subscriptions us JOIN users_organizations uo ON uo.id = us.user_organization_id
        WHERE uo.organization_id = o.id AND us.canceled_at IS NOT NULL
        ORDER BY us.canceled_at DESC LIMIT 1) AS cancelamento_motivo
    FROM organizations o
    WHERE o.id IN ${ids}`;
  const maisRecente = (...ds: Array<Date | null>): Date | null =>
    ds.filter((d): d is Date => d instanceof Date).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  return linhas.map((l) => {
    const chamada = (l.ultima_chamada as Date) ?? null;
    const copiloto = (l.ultima_copiloto as Date) ?? null;
    const reuniao = (l.ultima_reuniao as Date) ?? null;
    return {
      organizationId: String(l.organization_id),
      ultimaChamadaEm: chamada, ultimaCopilotoEm: copiloto, ultimaReuniaoEm: reuniao,
      ultimaAtividadeEm: maisRecente(chamada, copiloto, reuniao),
      inicioEm: (l.inicio as Date) ?? null,
      licencasPagas: Number(l.licencas_pagas ?? 0),
      licencaVenceEm: (l.vence_em as Date) ?? null,
      licencasVencendo30d: Number(l.vence_30 ?? 0),
      licencasVencendo60d: Number(l.vence_60 ?? 0),
      copilotoSessoes30d: Number(l.cop_sessoes ?? 0),
      copilotoSugestoes30d: Number(l.cop_sugestoes ?? 0),
      copilotoUsadas30d: Number(l.cop_usadas ?? 0),
      assinaturasTotal: Number(l.ass_total ?? 0),
      assinaturasCanceladas: Number(l.ass_canceladas ?? 0),
      canceladaEm: (l.cancelada_em as Date) ?? null,
      cancelamentoMotivo: (l.cancelamento_motivo as string) ?? null,
    };
  });
}
