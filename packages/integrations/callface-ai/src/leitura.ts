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
 * HIERARQUIA. `organizations.parent_organization_id` está nulo em 1.779 de 1.779
 * organizações, e por isso este arquivo afirmou até 13/10/2026 que white label
 * não era representável. ESTAVA ERRADO: a hierarquia existe, mas em
 * `organizations.partner_id` (a organização pertence a um registro de `partners`).
 * Descoberto em 13/10/2026, lendo o modelo de White Label do SaaS: `partners`
 * (preço por licença, dia de faturamento, prazo, domínio), o bloco reservado em
 * `license` com `reason = 'PARTNER_WHITE_LABEL'` e a cobrança em
 * `partner_invoices` + `partner_invoice_items`. As leituras de parceiro estão no
 * fim deste arquivo. A regra de atribuição de chamadas acima NÃO muda por isso:
 * as 41 mil chamadas divergentes continuam sem dono até alguém decidir a regra.
 *
 * MINUTO. O SaaS tarifa `calls.billed_time`, não `calls.duration`. Em 30 dias,
 * 19,4 milhões de segundos de duração contra 9,4 milhões tarifados: ler duração
 * mostrava o dobro do que o cliente consome e paga. `duration` ficou como
 * "tempo de chamada" (campo à parte); `billed_time` é o minuto cobrado.
 */
import type { Sql } from "postgres";
import { licencaAtivaEm, resumirTarifacao } from "./regras";

export { licencaAtivaEm, resumirTarifacao };

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
  /** Segundos TARIFADOS (`billed_time`): o minuto que o SaaS cobra. */
  segundosTarifados: number;
  /** Segundos de DURAÇÃO (`duration`): tempo de chamada, não o cobrado. */
  segundosDuracao: number;
  /** Chamadas sem `billed_time`: ficam fora dos tarifados e NÃO viram zero. */
  chamadasSemTarifa: number;
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
      SELECT c.id, c.status, c.duration, c.billed_time, c.user_id, c.created_at,
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
      SELECT candidatas[1] AS organization_id, id, status, duration, billed_time, user_id, created_at,
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
             coalesce(sum(least(coalesce(duration, 0), ${TETO_SEGUNDOS_POR_CHAMADA})), 0) AS segundos_duracao,
             -- FILTER é obrigatório: least(NULL, 7200) é 7200 no Postgres (ignora NULL),
             -- então chamada sem billed_time viraria 2 horas tarifadas.
             coalesce(sum(least(billed_time, ${TETO_SEGUNDOS_POR_CHAMADA})) FILTER (WHERE billed_time IS NOT NULL), 0) AS segundos_tarifados,
             count(billed_time) AS chamadas_com_tarifa,
             count(DISTINCT user_id) AS usuarios_com_atividade,
             max(created_at) AS ultima_chamada
        FROM resolvido WHERE unica GROUP BY organization_id
    )
    SELECT o.id AS organization_id,
           coalesce(u.chamadas_total, 0) AS chamadas_total,
           coalesce(u.chamadas_finalizadas, 0) AS chamadas_finalizadas,
           coalesce((SELECT count(*) FROM ambiguas a WHERE a.organization_id = o.id), 0) AS chamadas_ambiguas,
           coalesce(u.segundos_duracao, 0) AS segundos_duracao,
           coalesce(u.segundos_tarifados, 0) AS segundos_tarifados,
           coalesce(u.chamadas_com_tarifa, 0) AS chamadas_com_tarifa,
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
    ...resumirTarifacao({
      chamadas: Number(l.chamadas_total ?? 0),
      chamadasComTarifa: Number(l.chamadas_com_tarifa ?? 0),
      segundosDuracao: Number(l.segundos_duracao ?? 0),
      segundosTarifados: Number(l.segundos_tarifados ?? 0),
    }),
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
    // Literal de array em UM parâmetro: a conexão tem fetch_types:false, então
    // sql.array() não tem serializador e mandaria "a,b,c" sem as chaves.
    const linhas = await sql<Array<Record<string, unknown>>>`
      SELECT uid AS user_id,
             (SELECT c.created_at AT TIME ZONE 'UTC' FROM calls c WHERE c.user_id = uid
               ORDER BY c.created_at DESC LIMIT 1) AS ultima,
             (SELECT count(*) FROM calls c WHERE c.user_id = uid
                AND c.created_at >= (now() AT TIME ZONE 'UTC') - interval '7 days')::int AS c7,
             (SELECT count(*) FROM calls c WHERE c.user_id = uid
                AND c.created_at >= (now() AT TIME ZONE 'UTC') - interval '30 days')::int AS c30
        FROM unnest(${`{${userIds.join(",")}}`}::text[]) AS uid`;
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
  organizationId: string; dia: string; chamadas: number; finalizadas: number;
  /** Minutos TARIFADOS (`billed_time`). */
  minutos: number;
  /** Minutos de DURAÇÃO (`duration`): tempo de chamada, não o cobrado. */
  minutosDuracao: number;
  /** Chamadas do dia sem `billed_time`: fora de `minutos`, e não valem zero. */
  chamadasSemTarifa: number;
  usuariosAtivos: number;
}

export async function lerUsoDiario(
  sql: Sql, organizationIds: string[], diaIni: string, diaFim: string,
): Promise<UsoDiarioCallfaceAi[]> {
  if (!organizationIds.length) return [];
  const linhas = await sql<Array<Record<string, unknown>>>`
    WITH atribuicao AS (
      SELECT c.status, c.duration, c.billed_time, c.user_id, c.created_at,
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
           round(coalesce(sum(least(billed_time, ${TETO_SEGUNDOS_POR_CHAMADA})) FILTER (WHERE billed_time IS NOT NULL), 0)::numeric / 60, 2) AS minutos,
           round(sum(least(coalesce(duration, 0), ${TETO_SEGUNDOS_POR_CHAMADA}))::numeric / 60, 2) AS minutos_duracao,
           (count(*) - count(billed_time))::int AS chamadas_sem_tarifa,
           count(DISTINCT user_id)::int AS usuarios_ativos
      FROM atribuicao
     WHERE array_length(candidatas, 1) = 1 AND candidatas[1] IN ${sql(organizationIds)}
     GROUP BY 1, 2`;
  return linhas.map((l) => ({
    organizationId: String(l.organization_id),
    dia: l.dia instanceof Date ? l.dia.toISOString().slice(0, 10) : String(l.dia),
    chamadas: Number(l.chamadas), finalizadas: Number(l.finalizadas),
    minutos: Number(l.minutos ?? 0), minutosDuracao: Number(l.minutos_duracao ?? 0),
    chamadasSemTarifa: Number(l.chamadas_sem_tarifa ?? 0), usuariosAtivos: Number(l.usuarios_ativos),
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

// ───────────────────────────────────────────────────────────────────────────
// White Label: parceiros, o bloco reservado de licenças e a fatura do parceiro.
//
// SOMENTE SELECT, como o resto. Nenhuma credencial, nenhum dado de usuário.
//
// `partners`, `partner_invoices` e `partner_invoice_items` são lidas com
// `to_jsonb(linha)`: (1) timestamp WITHOUT time zone sai como texto ISO sem
// offset e é lido como UTC aqui, sem a armadilha de fuso do driver descrita em
// `lerUso`; (2) os nomes de coluna que NÃO foram confirmados contra o schema
// (total, ciclo, vencimento, a chave que liga item a fatura) são procurados por
// uma lista de nomes. Os que identificam a linha são OBRIGATÓRIOS: se faltarem,
// a leitura FALHA dizendo qual coluna, em vez de devolver parceiro sem preço.
// ───────────────────────────────────────────────────────────────────────────

type Linha = Record<string, unknown>;

function achar(l: Linha, nomes: string[]): unknown {
  for (const n of nomes) if (l[n] !== undefined && l[n] !== null) return l[n];
  return null;
}

function obrigatorio(l: Linha, nomes: string[], tabela: string): unknown {
  const v = achar(l, nomes);
  if (v === null) {
    throw new Error(`${tabela}: nenhuma das colunas [${nomes.join(", ")}] existe ou tem valor. Colunas lidas: ${Object.keys(l).sort().join(", ")}`);
  }
  return v;
}

const texto = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const booleano = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

/** Texto ISO do `to_jsonb`. Sem offset = UTC (é como o SaaS grava). */
function instante(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(v) || /^\d{4}-\d\d-\d\d$/.test(v) ? v : `${v}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Dia civil `YYYY-MM-DD`. */
function dia(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d\d-\d\d/.test(v) ? v.slice(0, 10) : null;
}

export interface ParceiroCallfaceAi {
  partnerId: string;
  nome: string | null;
  precoPorLicenca: number | null;
  diaFaturamento: number | null;
  prazoPagamentoDias: number | null;
  dominio: string | null;
  dnsVerificado: boolean | null;
  ativo: boolean | null;
  /** Organização do SaaS que é o próprio parceiro e documento (CNPJ), quando o SaaS os guarda: chaves de vínculo com o CRM. */
  organizationId: string | null;
  documento: string | null;
}

export async function lerParceiros(sql: Sql): Promise<ParceiroCallfaceAi[]> {
  const linhas = await sql<Array<{ r: Linha }>>`
    SELECT to_jsonb(p) AS r FROM partners p ORDER BY 1`;
  return linhas.map(({ r }) => {
    const ativoBruto = achar(r, ["is_active", "active", "enabled"]);
    const status = texto(achar(r, ["status"]));
    return {
      partnerId: String(obrigatorio(r, ["id"], "partners")),
      nome: texto(achar(r, ["name", "company_name", "trade_name", "slug"])),
      precoPorLicenca: numero(obrigatorio(r, ["wholesale_price_per_license"], "partners")),
      diaFaturamento: numero(achar(r, ["billing_day"])),
      prazoPagamentoDias: numero(achar(r, ["payment_terms_days"])),
      dominio: texto(achar(r, ["custom_domain"])),
      dnsVerificado: booleano(achar(r, ["dns_verified"])),
      ativo: booleano(ativoBruto) ?? (status ? !/^(inactive|disabled|suspended|canceled|cancelled)$/i.test(status) : null),
      organizationId: texto(achar(r, ["organization_id", "owner_organization_id"])),
      documento: texto(achar(r, ["document_number", "cnpj", "document"])),
    };
  });
}

export interface LicencaWhiteLabelCallfaceAi {
  licenseId: string;
  organizationId: string;
  orgNome: string | null;
  partnerId: string | null;
  inicioEm: Date | null;
  revogadaEm: Date | null;
  expiraEm: Date | null;
  /** Calculado no SaaS pelo predicado único: não revogada e não expirada. */
  ativaHoje: boolean;
}

/**
 * O bloco reservado: licença `PARTNER_WHITE_LABEL`, slot da organização (sem
 * `user_id`). O parceiro vem de `organizations.partner_id`. Traz as revogadas
 * também, porque a fatura proporcional depende de quando o slot deixou de existir.
 */
export async function lerLicencasWhiteLabel(sql: Sql): Promise<LicencaWhiteLabelCallfaceAi[]> {
  const linhas = await sql<Array<Record<string, unknown>>>`
    SELECT l.id, l.organization_id, o.name AS org_nome, o.partner_id,
           l.start_at AT TIME ZONE 'UTC' AS inicio,
           l.revoked_at AT TIME ZONE 'UTC' AS revogada,
           l.expires_at AT TIME ZONE 'UTC' AS expira,
           (l.revoked_at IS NULL AND (l.expires_at IS NULL OR l.expires_at > (now() AT TIME ZONE 'UTC'))) AS ativa_hoje
      FROM license l
      JOIN organizations o ON o.id = l.organization_id
     WHERE l.reason::text = 'PARTNER_WHITE_LABEL'
     ORDER BY l.start_at, l.id`;
  return linhas.map((l) => ({
    licenseId: String(l.id),
    organizationId: String(l.organization_id),
    orgNome: (l.org_nome as string) ?? null,
    partnerId: l.partner_id == null ? null : String(l.partner_id),
    inicioEm: (l.inicio as Date) ?? null,
    revogadaEm: (l.revogada as Date) ?? null,
    expiraEm: (l.expira as Date) ?? null,
    ativaHoje: Boolean(l.ativa_hoje),
  }));
}

export interface ItemFaturaParceiroCallfaceAi {
  itemId: string;
  invoiceId: string;
  licenseId: string | null;
  organizationId: string | null;
  diasAtivos: number;
  diasNoCiclo: number;
  proporcional: boolean;
  precoUnitario: number;
  totalLinha: number;
  licencaInicioEm: Date | null;
  licencaRevogadaEm: Date | null;
}

export interface FaturaParceiroCallfaceAi {
  invoiceId: string;
  partnerId: string;
  /** Como a plataforma grava (ex.: OVERDUE). */
  status: string;
  competencia: string | null;
  cicloInicio: string | null;
  cicloFim: string | null;
  vencimento: Date | null;
  pagaEm: Date | null;
  /** null = a plataforma não informa o total (a conferência soma os itens). */
  total: number | null;
  moeda: string | null;
  itens: ItemFaturaParceiroCallfaceAi[];
}

export async function lerFaturasDeParceiro(sql: Sql): Promise<FaturaParceiroCallfaceAi[]> {
  const [faturas, itens] = await Promise.all([
    sql<Array<{ r: Linha }>>`SELECT to_jsonb(f) AS r FROM partner_invoices f`,
    sql<Array<{ r: Linha }>>`SELECT to_jsonb(i) AS r FROM partner_invoice_items i`,
  ]);
  const itensPor = new Map<string, ItemFaturaParceiroCallfaceAi[]>();
  for (const { r } of itens) {
    const faturaId = String(obrigatorio(r, ["partner_invoice_id", "invoice_id"], "partner_invoice_items"));
    const item: ItemFaturaParceiroCallfaceAi = {
      itemId: String(obrigatorio(r, ["id"], "partner_invoice_items")),
      invoiceId: faturaId,
      licenseId: texto(achar(r, ["license_id"])),
      organizationId: texto(achar(r, ["organization_id"])),
      diasAtivos: Number(obrigatorio(r, ["days_active"], "partner_invoice_items")),
      diasNoCiclo: Number(obrigatorio(r, ["days_in_cycle"], "partner_invoice_items")),
      proporcional: Boolean(obrigatorio(r, ["is_prorated"], "partner_invoice_items")),
      precoUnitario: Number(obrigatorio(r, ["unit_price"], "partner_invoice_items")),
      totalLinha: Number(obrigatorio(r, ["line_total"], "partner_invoice_items")),
      licencaInicioEm: instante(achar(r, ["license_start_at"])),
      licencaRevogadaEm: instante(achar(r, ["license_revoked_at"])),
    };
    itensPor.set(faturaId, [...(itensPor.get(faturaId) ?? []), item]);
  }
  return faturas.map(({ r }) => {
    const id = String(obrigatorio(r, ["id"], "partner_invoices"));
    const cicloInicio = dia(achar(r, ["cycle_start", "period_start", "reference_start", "start_date"]));
    return {
      invoiceId: id,
      partnerId: String(obrigatorio(r, ["partner_id"], "partner_invoices")),
      status: String(obrigatorio(r, ["status"], "partner_invoices")),
      competencia: dia(achar(r, ["reference_month", "competence", "billing_month", "period"])) ?? cicloInicio,
      cicloInicio,
      cicloFim: dia(achar(r, ["cycle_end", "period_end", "reference_end", "end_date"])),
      vencimento: instante(achar(r, ["due_date", "due_at", "due_on"])),
      pagaEm: instante(achar(r, ["paid_at"])),
      total: numero(achar(r, ["total_amount", "total", "amount", "total_value"])),
      moeda: texto(achar(r, ["currency"])),
      itens: itensPor.get(id) ?? [],
    };
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Retrato do cliente na plataforma (Fase 6): plano, Stripe, licenças por tipo,
// usuários por papel e estado, workspaces, equipes e receptivos.
//
// SOMENTE SELECT. Nenhuma credencial, nenhum e-mail, nenhum nome de pessoa.
//
// O que foi confirmado pelo dono do schema: `plans` (stripe_price_id e preço),
// `organizations.stripe_customer_id` / `has_stripe_migrated`, `users_organizations`
// (kind, acceptance_status, invite_status, deactivated_at, crm_user_id),
// `license.reason` / `expires_at` / `plan_id`.
// O que NÃO foi confirmado: o nome da coluna de preço e de intervalo de `plans`,
// as colunas de `workspaces` além de id/organization_id/status, e a existência e o
// nome das tabelas de equipes e de receptivos (DIDs). Esses blocos leem a linha
// inteira com `to_jsonb`, exigem só o que identifica a linha e, se a tabela ou a
// coluna obrigatória não existir, FALHAM dizendo o que existe. Cada bloco falha
// sozinho (`Bloco`): o erro viaja até o estado do sync, nunca vira lista vazia.
// ───────────────────────────────────────────────────────────────────────────

export type Bloco<T> = { ok: true; dados: T } | { ok: false; erro: string };

export interface PlanoCallfaceAi {
  planId: string;
  nome: string | null;
  /** Preço de tabela do plano, em reais. null = nenhuma coluna de preço reconhecida. */
  preco: number | null;
  /** Coluna de onde o preço saiu (a conferência humana do primeiro sync). */
  precoColuna: string | null;
  stripePriceId: string | null;
  intervalo: string | null;
}

const PRECO_DIRETO = ["price", "amount", "unit_amount", "monthly_price", "value"];
const PRECO_EM_CENTAVOS = ["price_in_cents", "amount_in_cents", "price_cents", "unit_amount_cents"];

export async function lerPlanos(sql: Sql): Promise<PlanoCallfaceAi[]> {
  const linhas = await sql<Array<{ r: Linha }>>`SELECT to_jsonb(p) AS r FROM plans p`;
  return linhas.map(({ r }) => {
    const centavosCol = PRECO_EM_CENTAVOS.find((c) => numero(r[c]) !== null) ?? null;
    const diretoCol = PRECO_DIRETO.find((c) => numero(r[c]) !== null) ?? null;
    const col = diretoCol ?? centavosCol;
    const bruto = col ? numero(r[col]) : null;
    return {
      planId: String(obrigatorio(r, ["id"], "plans")),
      nome: texto(achar(r, ["name", "title", "slug"])),
      preco: bruto === null ? null : col === diretoCol ? bruto : bruto / 100,
      precoColuna: col,
      stripePriceId: texto(achar(r, ["stripe_price_id"])),
      intervalo: texto(achar(r, ["interval", "billing_interval", "billing_period", "period", "recurrence"])),
    };
  });
}

export interface StripeOrgCallfaceAi {
  organizationId: string;
  stripeCustomerId: string | null;
  /** has_stripe_migrated. null = a coluna veio nula. */
  migrado: boolean | null;
}

export async function lerStripeDasOrganizacoes(sql: Sql, organizationIds: string[]): Promise<StripeOrgCallfaceAi[]> {
  if (!organizationIds.length) return [];
  const linhas = await sql<Array<Record<string, unknown>>>`
    SELECT id, stripe_customer_id, has_stripe_migrated
      FROM organizations WHERE id IN ${sql(organizationIds)}`;
  return linhas.map((l) => ({
    organizationId: String(l.id),
    stripeCustomerId: l.stripe_customer_id ? String(l.stripe_customer_id).trim() || null : null,
    migrado: booleano(l.has_stripe_migrated),
  }));
}

export interface LicencaOrgCallfaceAi {
  licenseId: string;
  organizationId: string;
  planId: string | null;
  /** license.reason: TRIAL, SUBSCRIPTION_PAID, INTERNAL, PARTNER_WHITE_LABEL... */
  motivo: string;
  inicioEm: Date | null;
  revogadaEm: Date | null;
  expiraEm: Date | null;
  /** Tem usuário (direto ou pela assinatura). Slot de organização = false. */
  atribuida: boolean;
}

export async function lerLicencasDasOrganizacoes(sql: Sql, organizationIds: string[]): Promise<LicencaOrgCallfaceAi[]> {
  if (!organizationIds.length) return [];
  const linhas = await sql<Array<Record<string, unknown>>>`
    SELECT l.id, l.organization_id, l.plan_id, l.reason::text AS motivo,
           l.start_at AT TIME ZONE 'UTC' AS inicio,
           l.revoked_at AT TIME ZONE 'UTC' AS revogada,
           l.expires_at AT TIME ZONE 'UTC' AS expira,
           (coalesce(l.user_id, uo.user_id) IS NOT NULL) AS atribuida
      FROM license l
      LEFT JOIN user_subscriptions us ON us.id = l.user_subscription_id
      LEFT JOIN users_organizations uo ON uo.id = us.user_organization_id
     WHERE l.organization_id IN ${sql(organizationIds)}
     ORDER BY l.organization_id, l.start_at, l.id`;
  return linhas.map((l) => ({
    licenseId: String(l.id),
    organizationId: String(l.organization_id),
    planId: l.plan_id == null ? null : String(l.plan_id),
    motivo: String(l.motivo ?? ""),
    inicioEm: (l.inicio as Date) ?? null,
    revogadaEm: (l.revogada as Date) ?? null,
    expiraEm: (l.expira as Date) ?? null,
    atribuida: Boolean(l.atribuida),
  }));
}

export interface UsuarioOrgCallfaceAi {
  vinculoId: string;
  organizationId: string;
  /** CREATOR, ADMIN, MANAGER, EMPLOYEE */
  papel: string;
  aceite: string | null;
  convite: string | null;
  desativadoEm: Date | null;
  /** users.active */
  usuarioAtivo: boolean;
  /** O vínculo direto com o usuário do ONFACE, quando existe. */
  crmUserId: string | null;
}

export async function lerUsuariosDasOrganizacoes(sql: Sql, organizationIds: string[]): Promise<UsuarioOrgCallfaceAi[]> {
  if (!organizationIds.length) return [];
  const linhas = await sql<Array<Record<string, unknown>>>`
    SELECT uo.id, uo.organization_id, uo.kind::text AS papel,
           uo.acceptance_status::text AS aceite, uo.invite_status::text AS convite,
           uo.deactivated_at AT TIME ZONE 'UTC' AS desativado,
           u.active AS usuario_ativo, uo.crm_user_id::text AS crm_user_id
      FROM users_organizations uo JOIN users u ON u.id = uo.user_id
     WHERE uo.organization_id IN ${sql(organizationIds)}`;
  return linhas.map((l) => ({
    vinculoId: String(l.id),
    organizationId: String(l.organization_id),
    papel: String(l.papel ?? ""),
    aceite: texto(l.aceite),
    convite: texto(l.convite),
    desativadoEm: (l.desativado as Date) ?? null,
    usuarioAtivo: Boolean(l.usuario_ativo),
    crmUserId: texto(l.crm_user_id),
  }));
}

export interface EquipeCallfaceAi {
  tipo: "workspace" | "equipe";
  refId: string;
  organizationId: string;
  nome: string | null;
  status: string | null;
}

/**
 * Primeira tabela da lista que existe, ou null quando NENHUMA existe — junto do
 * motivo, com as de nome parecido, para quem for decidir.
 *
 * Devolver null em vez de lançar: tabela que não existe na plataforma é AUSÊNCIA,
 * não falha de leitura, e as duas coisas não podem ter o mesmo efeito. Era por
 * lançar aqui que o bloco de equipes derrubava com ele os workspaces, que existem
 * e já estavam lidos.
 */
async function tabelaExistente(sql: Sql, candidatas: string[], parecidas: string, rotulo: string): Promise<{ tabela: string } | { ausente: string }> {
  const achadas = await sql<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_name IN ${sql(candidatas)}`;
  const nomes = new Set(achadas.map((a) => a.table_name));
  const escolhida = candidatas.find((c) => nomes.has(c));
  if (escolhida) return { tabela: escolhida };
  const similares = await sql<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_name ~ ${parecidas} ORDER BY 1`;
  return { ausente: `${rotulo}: nenhuma das tabelas [${candidatas.join(", ")}] existe. Tabelas de nome parecido: ${similares.map((s) => s.table_name).join(", ") || "(nenhuma)"}` };
}

/**
 * Mesma busca, mas AUSÊNCIA é falha. Para conceito que a plataforma certamente tem
 * (receptivo): não achar nenhum nome candidato significa que erramos o nome, e isso
 * tem de aparecer alto, não virar bloco vazio.
 */
async function tabelaExistenteOuFalha(sql: Sql, candidatas: string[], parecidas: string, rotulo: string): Promise<string> {
  const r = await tabelaExistente(sql, candidatas, parecidas, rotulo);
  if ("ausente" in r) throw new Error(r.ausente);
  return r.tabela;
}

/**
 * Workspaces (tabela confirmada) e equipes (tabela NÃO confirmada: descoberta).
 *
 * `ausenteEquipes` fica preenchido quando a plataforma não tem tabela de equipe
 * nenhuma. Isso não é falha: é a plataforma não ter o conceito com esse nome, e
 * quem chama registra como aviso em vez de marcar o retrato como incompleto para
 * sempre. Tabela que EXISTE e não se lê continua falhando alto.
 */
export async function lerEquipes(sql: Sql, organizationIds: string[]): Promise<{ dados: EquipeCallfaceAi[]; ausenteEquipes: string | null }> {
  if (!organizationIds.length) return { dados: [], ausenteEquipes: null };
  const ids = new Set(organizationIds);
  const ws = await sql<Array<{ r: Linha }>>`
    SELECT to_jsonb(w) AS r FROM workspaces w WHERE w.organization_id IN ${sql(organizationIds)}`;
  const saida: EquipeCallfaceAi[] = ws.map(({ r }) => ({
    tipo: "workspace" as const,
    refId: String(obrigatorio(r, ["id"], "workspaces")),
    organizationId: String(obrigatorio(r, ["organization_id"], "workspaces")),
    nome: texto(achar(r, ["name", "title"])),
    status: texto(achar(r, ["status"])),
  }));
  const orgDoWorkspace = new Map(saida.map((w) => [w.refId, w.organizationId]));

  const achada = await tabelaExistente(sql, ["teams", "organization_teams", "workspace_teams", "equipes"], "team|equipe", "equipes");
  // Sem tabela de equipe na plataforma: devolve os workspaces, que são reais, e diz
  // por que não há equipe. Antes isto lançava e os workspaces iam embora com ele.
  if ("ausente" in achada) return { dados: saida, ausenteEquipes: achada.ausente };
  const tabela = achada.tabela;
  const times = await sql<Array<{ r: Linha }>>`SELECT to_jsonb(t) AS r FROM ${sql(tabela)} t`;
  for (const { r } of times) {
    const viaWs = achar(r, ["workspace_id"]);
    const org = texto(achar(r, ["organization_id"])) ?? (viaWs !== null ? orgDoWorkspace.get(String(viaWs)) ?? null : null);
    if (org === null && achar(r, ["organization_id", "workspace_id"]) === null) {
      obrigatorio(r, ["organization_id", "workspace_id"], tabela); // sem como saber de quem é: falha alto
    }
    if (!org || !ids.has(org)) continue;
    saida.push({
      tipo: "equipe", refId: String(obrigatorio(r, ["id"], tabela)), organizationId: org,
      nome: texto(achar(r, ["name", "title"])), status: texto(achar(r, ["status"])),
    });
  }
  return { dados: saida, ausenteEquipes: null };
}

export interface ReceptivoCallfaceAi {
  didId: string;
  organizationId: string;
  numero: string;
  /** usuario | ura | workspace | outro | null (sem destino) */
  destinoTipo: string | null;
  destinoId: string | null;
  /** null = a plataforma não informa de forma reconhecível. */
  disponivel: boolean | null;
  status: string | null;
}

const DESTINOS: Array<[string, string[]]> = [
  ["usuario", ["user_id"]], ["ura", ["ivr_id", "ura_id", "menu_id"]], ["workspace", ["workspace_id"]],
];

/** Números receptivos (DIDs) e para onde tocam. Tabela não confirmada: descoberta, ou falha alto. */
export async function lerReceptivos(sql: Sql, organizationIds: string[]): Promise<ReceptivoCallfaceAi[]> {
  if (!organizationIds.length) return [];
  const ids = new Set(organizationIds);
  const tabela = await tabelaExistenteOuFalha(
    sql, ["inbound_numbers", "inbound_dids", "dids", "did_numbers", "receptive_numbers", "receptivos"],
    "did|inbound|receptiv|ura|ivr", "receptivos");
  const linhas = await sql<Array<{ r: Linha }>>`SELECT to_jsonb(d) AS r FROM ${sql(tabela)} d`;
  const saida: ReceptivoCallfaceAi[] = [];
  for (const { r } of linhas) {
    const org = String(obrigatorio(r, ["organization_id"], tabela));
    if (!ids.has(org)) continue;
    const genericoTipo = texto(achar(r, ["destination_type", "target_type"]));
    const genericoId = texto(achar(r, ["destination_id", "target_id"]));
    let destinoTipo: string | null = genericoTipo ? genericoTipo.toLowerCase() : null;
    let destinoId: string | null = genericoId;
    if (!destinoTipo) {
      for (const [tipo, colunas] of DESTINOS) {
        const v = achar(r, colunas);
        if (v !== null) { destinoTipo = tipo; destinoId = String(v); break; }
      }
    }
    const status = texto(achar(r, ["status"]));
    const flag = booleano(achar(r, ["is_available", "available", "is_active", "active", "enabled"]));
    const disponivel = flag ?? (status
      ? /^(unavailable|inactive|blocked|released|deleted|disabled)$/i.test(status) ? false
        : /^(available|active|free|enabled|assigned)$/i.test(status) ? true : null
      : null);
    saida.push({
      didId: String(obrigatorio(r, ["id"], tabela)),
      organizationId: org,
      numero: String(obrigatorio(r, ["number", "phone_number", "did", "e164", "phone", "msisdn"], tabela)),
      destinoTipo, destinoId, disponivel, status,
    });
  }
  return saida;
}

export interface RetratoBrutoCallfaceAi {
  planos: Bloco<PlanoCallfaceAi[]>;
  stripe: Bloco<StripeOrgCallfaceAi[]>;
  licencas: Bloco<LicencaOrgCallfaceAi[]>;
  usuarios: Bloco<UsuarioOrgCallfaceAi[]>;
  equipes: Bloco<{ dados: EquipeCallfaceAi[]; ausenteEquipes: string | null }>;
  receptivos: Bloco<ReceptivoCallfaceAi[]>;
}

async function bloco<T>(f: () => Promise<T>): Promise<Bloco<T>> {
  try {
    return { ok: true, dados: await f() };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/** Todos os blocos, cada um isolado: o que não deu para ler vem com o motivo, nunca vazio. */
export async function lerRetratoBruto(sql: Sql, organizationIds: string[]): Promise<RetratoBrutoCallfaceAi> {
  return {
    planos: await bloco(() => lerPlanos(sql)),
    stripe: await bloco(() => lerStripeDasOrganizacoes(sql, organizationIds)),
    licencas: await bloco(() => lerLicencasDasOrganizacoes(sql, organizationIds)),
    usuarios: await bloco(() => lerUsuariosDasOrganizacoes(sql, organizationIds)),
    equipes: await bloco(() => lerEquipes(sql, organizationIds)),
    receptivos: await bloco(() => lerReceptivos(sql, organizationIds)),
  };
}
