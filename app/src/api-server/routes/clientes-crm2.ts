// Clientes / Carteira (CRM2, 19/08, correção de escopo — P0.4). Unidade é
// Empresa + Serviços, nunca Oportunidade. MRR SEMPRE de
// servicosCanonicos.currentRecurringValue (fonte da verdade fechada) —
// nunca somar contratos.mrr (isso é o bug que o /api/carteira legado
// carrega até hoje; não corrigido aqui de propósito, fora de escopo tocar
// legado que já está no ar — este é o substrato novo, correto desde o
// nascimento).
import { Hono } from "hono";
import { db } from "@/lib/db";
import {
  empresas, servicosCanonicos, contratos, contratoItens, leads, pessoas as pessoasTable, pontosContato, fulfillments, fulfillmentItens, notas, usuarios,
  clientes, faturas, assinaturas, propostas, tarefas, mrrMovimentos, atividades,
  negocios, negocioLeads, callfaceAiExternalIdentities, npsRespostas, oportunidades,
  labels, entityLabels,
} from "@/lib/db/schema";
import { eq, and, or, inArray, sql, desc, asc, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";
import { registrarMudancaResponsavel } from "@/lib/crm/owner";
import { publicarEvento } from "@/lib/events/outbox";

// CS — Health Check (24/08, achado real: NPS já existe como infra (tabela
// `nps_respostas`, rota pública de resposta em nps.ts) mas NUNCA é
// alimentada por código nenhum — 0 linhas no banco de produção. O que falta
// não é o dado, é o mecanismo de coleta ativa (o CS liga/manda WhatsApp e
// registra a resposta ao vivo, como o playbook real da Callface descreve).
// Classificação por faixa de NPS — mesma régua usada no playbook de CS
// (verde 7-10 / amarelo 5-6 / vermelho 0-4), não um score composto
// fabricado: é a resposta direta e real que o cliente deu.
export function faixaNps(score: number): "verde" | "amarelo" | "vermelho" {
  if (score >= 7) return "verde";
  if (score >= 5) return "amarelo";
  return "vermelho";
}

const app = new Hono();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Formatação de moeda só pro título do evento "pagamento" na timeline
// consolidada (item 2, 20/08) — mesmo padrão usado no frontend (brl()), sem
// depender de Intl com locale garantido no runtime do worker.
function brlServer(v: string | number): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Normaliza timestamp (Date do driver Postgres OU string) pra ISO string —
// os campos `quando`/`firstTouch`/`lastTouch` da timeline consolidada e do
// card de origem precisam de um tipo único; o wire (JSON) sempre manda
// string de qualquer jeito, isso só deixa o TS feliz sem `as unknown as`.
function isoServer(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

// GET /clientes-crm2/resumo — cards de topo da Carteira (referência de UX,
// 19/08, redefinido 18/08): MRR/clientes/serviços TOTAIS da base, não só
// da página atual (a lista principal pagina, isso aqui nunca deve). "Em
// risco" usava fatura atrasada OU sem próxima ação OU >14 dias sem
// atividade — os outros 2 sinais são ruído verificado no banco: "sem
// próxima ação" tem 0% de cobertura (272/272), e "sem atividade" continua
// flagrando 71% da base mesmo a 90 dias (atividades = comportamento de
// vendas, não cadência de pós-venda). Critério agora é SÓ fatura atrasada
// (real: 13 clientes hoje) — diverge de propósito de GET
// /clientes-crm2/sucesso (fila de CS, que ainda usa os 3 sinais — não
// toquei nela, é feature separada, fora do pedido desta sessão).
app.get("/clientes-crm2/resumo", async (c) => {
  const ctx = await getCtx(c);

  const [row] = await db.execute<{
    clientes_ativos: number; servicos_ativos: number; mrr_total: string; em_risco: number;
    mrr_delta_30d: string; clientes_novos_30d: number; familias: Record<string, number>;
    em_implantacao: number; onboarding: number; inadimplentes: number;
    aba_todos: number; aba_ativos: number; aba_onboarding: number; aba_implantacao: number;
    aba_em_risco: number; aba_inadimplentes: number; aba_cancelados: number;
  }>(sql`
    WITH clientes_ativos AS (
      SELECT sc.empresa_id, COUNT(*)::int AS n_servicos, SUM(sc.current_recurring_value) AS mrr
      FROM servicos_canonicos sc
      JOIN empresas e ON e.id = sc.empresa_id AND e.organizacao_id = ${ctx.organizacaoId}
      WHERE sc.portfolio_included = true
      GROUP BY sc.empresa_id
    ),
    faturas_atrasadas AS (
      SELECT COALESCE(f.empresa_id, a.empresa_id) AS empresa_id, COUNT(*)::int AS n
      FROM faturas f
      LEFT JOIN assinaturas a ON a.id = f.assinatura_id
      WHERE f.status = 'aberta' AND COALESCE(f.vencimento, f.emitida_em) < now()
      GROUP BY 1
    ),
    familias AS (
      SELECT sc.service_family AS familia, COUNT(*)::int AS n
      FROM servicos_canonicos sc
      JOIN empresas e ON e.id = sc.empresa_id AND e.organizacao_id = ${ctx.organizacaoId}
      WHERE sc.portfolio_included = true
      GROUP BY sc.service_family
    ),
    -- Variação real (não estimada) via mrr_movimentos: soma dos deltas nos
    -- últimos 30 dias reconstrói quanto o MRR cresceu/caiu no período,
    -- mesma fonte que já alimenta o gráfico de MRR mensal do Cliente 360.
    mrr_30d AS (
      SELECT COALESCE(SUM(mm.delta), 0) AS delta
      FROM mrr_movimentos mm
      WHERE mm.organizacao_id = ${ctx.organizacaoId} AND mm.ocorrido_em >= now() - interval '30 days'
    ),
    -- "Novos clientes" = empresas cujo primeiro serviço no portfólio nasceu
    -- nos últimos 30 dias. Não desconta churn do período (isso é líquido,
    -- não bruto) — rótulo no frontend deixa isso explícito.
    novos_30d AS (
      SELECT COUNT(DISTINCT sc.empresa_id)::int AS n
      FROM servicos_canonicos sc
      JOIN empresas e ON e.id = sc.empresa_id AND e.organizacao_id = ${ctx.organizacaoId}
      WHERE sc.portfolio_included = true AND sc.created_at >= now() - interval '30 days'
    ),
    -- Universo da Carteira (20/08, correção de escopo — mockup pediu aba
    -- "Cancelados"): até aqui só entrava empresa com pelo menos 1 serviço
    -- portfolio_included=true. Isso deixa de fora, pra sempre, toda empresa
    -- 100% CHURNED (nenhum serviço no portfólio) — 3 casos reais hoje
    -- (verificado no banco). Adiciona essas ao universo SÓ pra alimentar a
    -- aba/contagem de cancelados; elas nunca entram em "Clientes Ativos"
    -- (CTE clientes_ativos acima, intocada).
    universo AS (
      SELECT e.id AS empresa_id
      FROM empresas e
      WHERE e.organizacao_id = ${ctx.organizacaoId}
        AND (
          EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = e.id AND sc.portfolio_included = true)
          OR (
            EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = e.id AND sc.commercial_lifecycle = 'CHURNED')
            AND NOT EXISTS (SELECT 1 FROM servicos_canonicos sc2 WHERE sc2.empresa_id = e.id AND sc2.portfolio_included = true)
          )
        )
    ),
    -- Um sinal por empresa do universo — mesmos critérios já usados em
    -- cima (faturas_atrasadas) e na listagem principal (fulfillment ativo
    -- por família), nada novo fabricado. "cancelado" só é possível pra
    -- quem caiu no universo via o ramo CHURNED-sem-portfólio acima.
    sinais AS (
      SELECT u.empresa_id,
        NOT EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = u.empresa_id AND sc.portfolio_included = true) AS cancelado,
        -- clientes pode ter mais de 1 linha pro mesmo empresa_id (sem
        -- unique constraint, gap real já sinalizado no PATCH acima) -- pega
        -- sempre a mais recente por updated_at, nunca uma linha arbitraria.
        COALESCE((SELECT cli.status_financeiro FROM clientes cli WHERE cli.empresa_id = u.empresa_id ORDER BY cli.updated_at DESC NULLS LAST, cli.id DESC LIMIT 1), 'indefinido') = 'inadimplente' AS inadimplente,
        EXISTS (SELECT 1 FROM faturas_atrasadas fa WHERE fa.empresa_id = u.empresa_id AND fa.n > 0) AS em_risco,
        EXISTS (
          SELECT 1 FROM servicos_canonicos sc JOIN fulfillments f ON f.servico_canonico_id = sc.id
          WHERE sc.empresa_id = u.empresa_id AND sc.portfolio_included = true AND sc.service_family IN ('PABX', 'WHITE_LABEL')
            AND f.status NOT IN ('COMPLETED', 'CANCELED')
        ) AS implantacao,
        EXISTS (
          SELECT 1 FROM servicos_canonicos sc JOIN fulfillments f ON f.servico_canonico_id = sc.id
          WHERE sc.empresa_id = u.empresa_id AND sc.portfolio_included = true AND sc.service_family = 'CALLFACE_AI'
            AND f.status NOT IN ('COMPLETED', 'CANCELED')
        ) AS onboarding
      FROM universo u
    )
    SELECT
      (SELECT COUNT(*)::int FROM clientes_ativos) AS clientes_ativos,
      (SELECT COALESCE(SUM(n_servicos), 0)::int FROM clientes_ativos) AS servicos_ativos,
      (SELECT COALESCE(SUM(mrr), 0) FROM clientes_ativos) AS mrr_total,
      (SELECT COUNT(*)::int FROM clientes_ativos ca
        JOIN faturas_atrasadas fa ON fa.empresa_id = ca.empresa_id
        WHERE fa.n > 0
      ) AS em_risco,
      (SELECT delta FROM mrr_30d) AS mrr_delta_30d,
      (SELECT n FROM novos_30d) AS clientes_novos_30d,
      (SELECT COALESCE(jsonb_object_agg(familia, n), '{}'::jsonb) FROM familias) AS familias,
      -- Cards novos (20/08): contagens INDEPENDENTES (não mutuamente
      -- exclusivas entre si nem com "em_risco" acima — mesmo padrão que já
      -- existia entre "Clientes Ativos"/"Em Risco": cada card responde sua
      -- própria pergunta, uma empresa pode acender mais de um ao mesmo
      -- tempo). Nunca conta quem já é 100% cancelado.
      (SELECT COUNT(*)::int FROM sinais WHERE NOT cancelado AND implantacao) AS em_implantacao,
      (SELECT COUNT(*)::int FROM sinais WHERE NOT cancelado AND onboarding) AS onboarding,
      (SELECT COUNT(*)::int FROM sinais WHERE NOT cancelado AND inadimplente) AS inadimplentes,
      -- Contagens da BARRA DE ABAS (mutuamente exclusivas, somam o total do
      -- universo — cada empresa cai em exatamente 1 balde). Precedência
      -- fixa, documentada aqui e replicada IDÊNTICA no CASE WHEN da
      -- listagem principal (coluna status_geral) e no filtro ?aba=:
      -- cancelado > inadimplente > em_risco > implantação > onboarding >
      -- ativo. Risco financeiro sempre pesa mais que estágio de entrega —
      -- ex. real no banco: "Unresolved billing identity" tem fatura vencida
      -- em aberto E fulfillment de onboarding ativo ao mesmo tempo; cai em
      -- Em Risco, não em Onboarding.
      (SELECT COUNT(*)::int FROM sinais) AS aba_todos,
      (SELECT COUNT(*)::int FROM sinais WHERE cancelado) AS aba_cancelados,
      (SELECT COUNT(*)::int FROM sinais WHERE NOT cancelado AND inadimplente) AS aba_inadimplentes,
      (SELECT COUNT(*)::int FROM sinais WHERE NOT cancelado AND NOT inadimplente AND em_risco) AS aba_em_risco,
      (SELECT COUNT(*)::int FROM sinais WHERE NOT cancelado AND NOT inadimplente AND NOT em_risco AND implantacao) AS aba_implantacao,
      (SELECT COUNT(*)::int FROM sinais WHERE NOT cancelado AND NOT inadimplente AND NOT em_risco AND NOT implantacao AND onboarding) AS aba_onboarding,
      (SELECT COUNT(*)::int FROM sinais WHERE NOT cancelado AND NOT inadimplente AND NOT em_risco AND NOT implantacao AND NOT onboarding) AS aba_ativos
  `);

  return c.json({
    clientesAtivos: row?.clientes_ativos ?? 0,
    servicosAtivos: row?.servicos_ativos ?? 0,
    mrrTotal: row?.mrr_total ?? "0",
    emRisco: row?.em_risco ?? 0,
    mrrDelta30d: row?.mrr_delta_30d ?? "0",
    clientesNovos30d: row?.clientes_novos_30d ?? 0,
    familias: row?.familias ?? {},
    emImplantacao: row?.em_implantacao ?? 0,
    onboarding: row?.onboarding ?? 0,
    inadimplentes: row?.inadimplentes ?? 0,
    abaCounts: {
      todos: row?.aba_todos ?? 0,
      ativos: row?.aba_ativos ?? 0,
      onboarding: row?.aba_onboarding ?? 0,
      implantacao: row?.aba_implantacao ?? 0,
      emRisco: row?.aba_em_risco ?? 0,
      inadimplentes: row?.aba_inadimplentes ?? 0,
      cancelados: row?.aba_cancelados ?? 0,
    },
  });
});

// GET /clientes-crm2 — Carteira: Empresas com pelo menos 1 serviço no
// portfólio (current MRR real, nunca contrato/oportunidade) + empresas
// 100% CHURNED sem serviço no portfólio (só pra existir a aba "Cancelados",
// ver universoCte acima) — MRR/serviços dessas últimas ficam honestamente
// zerados via COALESCE, nunca fabricados.
app.get("/clientes-crm2", async (c) => {
  const ctx = await getCtx(c);
  const search = (c.req.query("search") ?? "").trim();
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);
  const offset = (page - 1) * limit;
  const buscaLike = `%${search}%`;
  const filtroBusca = search ? sql`AND e.nome ILIKE ${buscaLike}` : sql``;
  // Filtro de família (referência de UX, 19/08): "tem pelo menos 1 serviço
  // dessa família" — não esconde as OUTRAS famílias que a empresa também
  // tenha (o badge de família continua mostrando o portfólio completo).
  const familia = c.req.query("familia") ?? "";
  const FAMILIAS_VALIDAS = ["PABX", "CALLFACE_AI", "WHITE_LABEL", "UNKNOWN"];
  const filtroFamilia = FAMILIAS_VALIDAS.includes(familia)
    ? sql`AND EXISTS (SELECT 1 FROM servicos_canonicos sc2 WHERE sc2.empresa_id = e.id AND sc2.portfolio_included = true AND sc2.service_family = ${familia})`
    : sql``;

  // Lifecycle real (referência de UX, 18/08): `clientes.status_financeiro`
  // (ativo | inadimplente | churned) tem 100% de cobertura na base
  // (verificado direto no banco), diferente de "indefinido", que também é
  // um valor real gravado, não um placeholder — allowlist evita SQL livre.
  const status = c.req.query("status") ?? "";
  const STATUS_VALIDOS = ["ativo", "inadimplente", "churned", "indefinido"];
  const filtroStatus = STATUS_VALIDOS.includes(status)
    ? sql`AND COALESCE(cli.status_financeiro, 'indefinido') = ${status}`
    : sql``;

  // CS Owner (18/08) — `clientes.responsavel_id`, campo novo (antes não
  // existia dono de conta pós-venda no schema). "sem_dono" é um valor real
  // e útil de filtrar (maioria da base hoje, já que o campo é novo).
  const owner = c.req.query("owner") ?? "";
  const filtroOwner = owner === "sem_dono"
    ? sql`AND cli.responsavel_id IS NULL`
    : UUID_RE.test(owner)
      ? sql`AND cli.responsavel_id = ${owner}`
      : sql``;

  // Aba de status (20/08, barra de contagem pedida no mockup) — mutuamente
  // exclusiva, MESMA precedência documentada em GET /clientes-crm2/resumo
  // (cancelado > inadimplente > em_risco > implantação > onboarding >
  // ativo). Filtra sobre a coluna computada `status_geral` da CTE
  // `linhas` abaixo, nunca uma segunda fórmula solta.
  const aba = c.req.query("aba") ?? "";
  const ABAS_VALIDAS = ["ativos", "onboarding", "implantacao", "risco", "inadimplentes", "cancelados"];
  const ABA_PARA_STATUS_GERAL: Record<string, string> = {
    ativos: "ativo", onboarding: "onboarding", implantacao: "implantacao",
    risco: "em_risco", inadimplentes: "inadimplente", cancelados: "cancelado",
  };
  const filtroAba = ABAS_VALIDAS.includes(aba) ? sql`AND status_geral = ${ABA_PARA_STATUS_GERAL[aba]}` : sql``;

  // Universo da Carteira (20/08): empresa com pelo menos 1 serviço
  // portfolio_included=true (cliente ativo de fato) OU 100% CHURNED sem
  // nenhum serviço no portfólio (só pra existir a aba "Cancelados" — sem
  // isso essas 3 empresas reais nunca apareceriam em lugar nenhum da
  // Carteira). Mesmo critério usado em /clientes-crm2/resumo, não duplicar
  // lógica divergente.
  const universoCte = sql`
    universo AS (
      SELECT e.id AS empresa_id
      FROM empresas e
      WHERE e.organizacao_id = ${ctx.organizacaoId}
        AND (
          EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = e.id AND sc.portfolio_included = true)
          OR (
            EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = e.id AND sc.commercial_lifecycle = 'CHURNED')
            AND NOT EXISTS (SELECT 1 FROM servicos_canonicos sc2 WHERE sc2.empresa_id = e.id AND sc2.portfolio_included = true)
          )
        )
    )`;

  // `clientes` não tem constraint de unicidade em empresa_id (gap real, já
  // sinalizado no PATCH acima) — achado ao validar esta query contra o
  // Postgres real: 8 empresas têm 2-3 linhas em `clientes` pro mesmo
  // empresa_id, e um JOIN direto duplicava a linha da empresa na listagem
  // (bug pré-existente, não introduzido agora — o LEFT JOIN antigo tinha o
  // mesmo problema, só não validado). Fix: 1 linha por empresa, a mais
  // recente por updated_at.
  const clienteAtualCte = sql`
    cliente_atual AS (
      SELECT DISTINCT ON (empresa_id) *
      FROM clientes
      WHERE empresa_id IS NOT NULL
      ORDER BY empresa_id, updated_at DESC NULLS LAST, id DESC
    )`;

  const [totalRow] = await db.execute<{ n: number }>(sql`
    WITH ${universoCte}, ${clienteAtualCte},
    linhas AS (
      SELECT e.id,
        COALESCE(cli.status_financeiro, 'indefinido') AS status_financeiro_calc,
        (NOT EXISTS (SELECT 1 FROM servicos_canonicos sc WHERE sc.empresa_id = e.id AND sc.portfolio_included = true)) AS cancelado_calc,
        EXISTS (
          SELECT 1 FROM faturas f LEFT JOIN assinaturas a ON a.id = f.assinatura_id
          WHERE (f.empresa_id = e.id OR a.empresa_id = e.id) AND f.status = 'aberta' AND COALESCE(f.vencimento, f.emitida_em) < now()
        ) AS em_risco_calc,
        EXISTS (
          SELECT 1 FROM servicos_canonicos sc JOIN fulfillments f ON f.servico_canonico_id = sc.id
          WHERE sc.empresa_id = e.id AND sc.portfolio_included = true AND sc.service_family IN ('PABX', 'WHITE_LABEL') AND f.status NOT IN ('COMPLETED', 'CANCELED')
        ) AS implantacao_calc,
        EXISTS (
          SELECT 1 FROM servicos_canonicos sc JOIN fulfillments f ON f.servico_canonico_id = sc.id
          WHERE sc.empresa_id = e.id AND sc.portfolio_included = true AND sc.service_family = 'CALLFACE_AI' AND f.status NOT IN ('COMPLETED', 'CANCELED')
        ) AS onboarding_calc
      FROM universo u
      JOIN empresas e ON e.id = u.empresa_id
      LEFT JOIN cliente_atual cli ON cli.empresa_id = e.id
    ),
    linhas_status AS (
      SELECT *,
        CASE
          WHEN cancelado_calc THEN 'cancelado'
          WHEN status_financeiro_calc = 'inadimplente' THEN 'inadimplente'
          WHEN em_risco_calc THEN 'em_risco'
          WHEN implantacao_calc THEN 'implantacao'
          WHEN onboarding_calc THEN 'onboarding'
          ELSE 'ativo'
        END AS status_geral
      FROM linhas
    )
    SELECT COUNT(DISTINCT e.id)::int AS n
    FROM empresas e
    JOIN linhas_status ls ON ls.id = e.id
    LEFT JOIN cliente_atual cli ON cli.empresa_id = e.id
    WHERE e.organizacao_id = ${ctx.organizacaoId} ${filtroBusca} ${filtroFamilia} ${filtroStatus} ${filtroOwner} ${filtroAba}
  `);

  const rows = await db.execute(sql`
    WITH ${universoCte}, ${clienteAtualCte},
    servicos_agg AS (
      SELECT
        sc.empresa_id,
        COUNT(*)::int AS total_servicos,
        SUM(sc.current_recurring_value) AS current_mrr,
        to_jsonb(array_agg(DISTINCT sc.service_family)) AS familias
      FROM servicos_canonicos sc
      WHERE sc.portfolio_included = true
      GROUP BY sc.empresa_id
    ),
    fulfillment_agg AS (
      SELECT sc.empresa_id,
        COUNT(*) FILTER (WHERE f.status NOT IN ('COMPLETED', 'CANCELED'))::int AS entregas_em_andamento
      FROM servicos_canonicos sc
      JOIN fulfillments f ON f.servico_canonico_id = sc.id
      WHERE sc.portfolio_included = true
      GROUP BY sc.empresa_id
    ),
    -- Mesmo critério de "atrasada" de GET /clientes-crm2/sucesso — manter em
    -- sincronia se um dos dois mudar.
    faturas_agg AS (
      SELECT COALESCE(f.empresa_id, a.empresa_id) AS empresa_id,
        COUNT(*) FILTER (WHERE f.status = 'aberta' AND COALESCE(f.vencimento, f.emitida_em) < now())::int AS n_atrasadas,
        MIN(COALESCE(f.vencimento, f.emitida_em)) FILTER (WHERE f.status = 'aberta' AND COALESCE(f.vencimento, f.emitida_em) < now()) AS venceu_em
      FROM faturas f
      LEFT JOIN assinaturas a ON a.id = f.assinatura_id
      GROUP BY 1
    ),
    -- Última atividade real por empresa (referência de UX, 18/08): mesma
    -- fonte já usada em /resumo e /sucesso pro sinal de risco (atividades
    -- via leads.empresa_id) — cobertura real de 152/272 clientes ativos
    -- (verificado no banco), não fabricar pros outros 44%: fica "—".
    ultima_atividade_agg AS (
      SELECT DISTINCT ON (l.empresa_id) l.empresa_id, at.tipo, at.created_at AS ultima
      FROM atividades at
      JOIN leads l ON l.id = at.lead_id
      WHERE l.empresa_id IS NOT NULL
      ORDER BY l.empresa_id, at.created_at DESC
    ),
    -- Próxima ação real por empresa (item 2, 20/08) — mesmo padrão de
    -- ultima_atividade_agg acima (DISTINCT ON) aplicado à mesma lógica de
    -- tarefa aberta já usada em proxima_tarefa_agg (/sucesso, linha ~296) e
    -- proximasAcoes (GET /:empresaId, linha ~405): tarefa não concluída
    -- vinculada a um lead da empresa, priorizando a mais próxima de vencer
    -- (NULLS LAST — tarefa sem data ainda é real e aberta, só entra depois
    -- das que têm prazo definido).
    proxima_tarefa_agg AS (
      SELECT DISTINCT ON (l.empresa_id) l.empresa_id, t.titulo, t.vence_em AS proxima
      FROM tarefas t
      JOIN leads l ON l.id = t.lead_id
      WHERE l.empresa_id IS NOT NULL AND t.concluida = false
      ORDER BY l.empresa_id, t.vence_em ASC NULLS LAST, t.created_at ASC
    ),
    -- Sinal "Em Implantação" (PABX) / "Onboarding" (Callface AI) por
    -- empresa (20/08, coluna Status Geral + abas) — fulfillment ativo
    -- (NOT IN COMPLETED/CANCELED) de serviço no portfólio, mesma fonte já
    -- usada em fulfillment_agg acima, só separada por família porque
    -- Implantação e Onboarding são 2 módulos/páginas distintos no produto
    -- (Cf2EntregaWorkspace), nunca a mesma coisa. Frente 2C.1: White Label
    -- entrou em Implantação (trilha própria dele, ver lib/crm/politica-familia.ts)
    -- — antes não estava em bucket NENHUM e o cliente ficava invisível na
    -- barra de status da Carteira.
    implantacao_agg AS (
      SELECT DISTINCT sc.empresa_id
      FROM servicos_canonicos sc JOIN fulfillments f ON f.servico_canonico_id = sc.id
      WHERE sc.portfolio_included = true AND sc.service_family IN ('PABX', 'WHITE_LABEL') AND f.status NOT IN ('COMPLETED', 'CANCELED')
    ),
    onboarding_agg AS (
      SELECT DISTINCT sc.empresa_id
      FROM servicos_canonicos sc JOIN fulfillments f ON f.servico_canonico_id = sc.id
      WHERE sc.portfolio_included = true AND sc.service_family = 'CALLFACE_AI' AND f.status NOT IN ('COMPLETED', 'CANCELED')
    ),
    linhas_finais AS (
    SELECT e.id, e.nome, e.setor,
      COALESCE(sa.total_servicos, 0) AS total_servicos,
      COALESCE(sa.current_mrr, 0) AS current_mrr,
      COALESCE(sa.familias, '[]'::jsonb) AS familias,
      COALESCE(fa.entregas_em_andamento, 0) AS entregas_em_andamento,
      COALESCE(fat.n_atrasadas, 0) AS faturas_atrasadas,
      fat.venceu_em AS fatura_venceu_em,
      -- clientes.status_financeiro está nulo em 301 dos 309 registros: a
      -- coluna existe desde a reconciliação mas nunca foi populada, e a tabela
      -- mostrava "Indefinido" em 97% das linhas. O status de COBRANÇA, porém,
      -- é derivável do mesmo material que já alimenta os cards — daí o
      -- fallback abaixo, que nunca inventa 'inadimplente' (esse continua sendo
      -- decisão de negócio registrada à mão, e é o que o card INADIMPLENTES
      -- conta; fatura vencida é 'em_atraso', o balde de EM RISCO).
      CASE
        WHEN cli.status_financeiro IS NOT NULL THEN cli.status_financeiro
        WHEN sa.empresa_id IS NULL                THEN 'churned'
        WHEN COALESCE(fat.n_atrasadas, 0) > 0     THEN 'em_atraso'
        ELSE 'ativo'
      END AS status_financeiro,
      ua.tipo AS ultima_atividade_tipo,
      ua.ultima AS ultima_atividade_em,
      pta.titulo AS proxima_acao_titulo,
      pta.proxima AS proxima_acao_vence_em,
      cli.responsavel_id AS cs_owner_id,
      uo.nome AS cs_owner_nome,
      -- Risco por linha (18/08) — testei um nível "médio" baseado em >14/30/
      -- 60/90 dias sem atividade real e descartei: mesmo a 90 dias, 194 dos
      -- 273 clientes ativos (71%) caem nele, porque a tabela atividades registra
      -- comportamento de vendas (ligação/nota/whatsapp), não cadência de
      -- pós-venda — não é um sinal que discrimina, é ruído travestido de
      -- 3 níveis. Fica binário com o único sinal real e diferenciante que
      -- existe hoje: fatura atrasada (13/273 clientes, verificado no banco).
      CASE WHEN COALESCE(fat.n_atrasadas, 0) > 0 THEN 'alto' ELSE 'baixo' END AS risco,
      -- Status Geral (20/08, coluna nova do mockup, substitui Lifecycle +
      -- Billing + Entrega na tabela — as 3 mostravam sinal fraco/constante
      -- (Lifecycle era literal 'cliente' em toda linha, zero informação) ou
      -- redundante (Billing/Entrega já cabem aqui). MESMA precedência
      -- documentada em GET /clientes-crm2/resumo — nunca uma fórmula
      -- divergente entre listagem, cards e abas.
      CASE
        WHEN sa.empresa_id IS NULL THEN 'cancelado'
        WHEN COALESCE(cli.status_financeiro, 'indefinido') = 'inadimplente' THEN 'inadimplente'
        WHEN COALESCE(fat.n_atrasadas, 0) > 0 THEN 'em_risco'
        WHEN ia.empresa_id IS NOT NULL THEN 'implantacao'
        WHEN oa.empresa_id IS NOT NULL THEN 'onboarding'
        ELSE 'ativo'
      END AS status_geral
    FROM universo u
    JOIN empresas e ON e.id = u.empresa_id
    LEFT JOIN servicos_agg sa ON sa.empresa_id = e.id
    LEFT JOIN fulfillment_agg fa ON fa.empresa_id = e.id
    LEFT JOIN faturas_agg fat ON fat.empresa_id = e.id
    LEFT JOIN cliente_atual cli ON cli.empresa_id = e.id
    LEFT JOIN usuarios uo ON uo.id = cli.responsavel_id
    LEFT JOIN ultima_atividade_agg ua ON ua.empresa_id = e.id
    LEFT JOIN proxima_tarefa_agg pta ON pta.empresa_id = e.id
    LEFT JOIN implantacao_agg ia ON ia.empresa_id = e.id
    LEFT JOIN onboarding_agg oa ON oa.empresa_id = e.id
    WHERE 1=1 ${filtroBusca} ${filtroFamilia} ${filtroStatus} ${filtroOwner}
    )
    -- status_geral é coluna computada da CTE acima — Postgres não deixa
    -- referenciar alias do próprio SELECT no WHERE da mesma query (WHERE
    -- roda antes da lista de SELECT existir), só funciona filtrando por
    -- fora, contra a CTE já materializada. Mesmo motivo pelo qual ORDER BY
    -- current_mrr (linha abaixo) funciona direto: ORDER BY, sim, roda
    -- depois do SELECT.
    SELECT * FROM linhas_finais
    WHERE 1=1 ${filtroAba}
    ORDER BY current_mrr DESC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `);

  return c.json({ clientes: rows, total: Number(totalRow?.n ?? 0), page, totalPages: Math.ceil(Number(totalRow?.n ?? 0) / limit) });
});

// PATCH /clientes-crm2/:empresaId — troca de CS Owner (18/08). `clientes`
// pode não ter linha ainda pra essa empresa (upsert manual: sem unique
// constraint em empresa_id hoje, então UPDATE primeiro, INSERT só se não
// afetou nenhuma linha). Auditoria via lib/crm/owner.ts, mesmo padrão já
// usado em Lead/Negócio/Fulfillment.
app.patch("/clientes-crm2/:empresaId", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "ID inválido" }, 400);

  const body = await c.req.json<{ responsavelId?: string | null }>();
  if (!("responsavelId" in body)) return c.json({ error: "responsavelId é obrigatório" }, 400);
  const novoResponsavelId = body.responsavelId || null;

  const [empresa] = await db.select({ id: empresas.id }).from(empresas)
    .where(and(eq(empresas.id, empresaId), eq(empresas.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!empresa) return c.json({ error: "Empresa não encontrada" }, 404);

  const [existente] = await db.select({ id: clientes.id, responsavelId: clientes.responsavelId })
    .from(clientes).where(eq(clientes.empresaId, empresaId)).limit(1);

  const previousOwnerId = existente?.responsavelId ?? null;

  if (existente) {
    await db.update(clientes).set({ responsavelId: novoResponsavelId, updatedAt: new Date() }).where(eq(clientes.id, existente.id));
  } else {
    await db.insert(clientes).values({ organizacaoId: ctx.organizacaoId, empresaId, responsavelId: novoResponsavelId });
  }

  await registrarMudancaResponsavel({
    organizacaoId: ctx.organizacaoId,
    entityType: "cliente",
    entityId: empresaId,
    previousOwnerId,
    newOwnerId: novoResponsavelId,
    actorId: ctx.userId,
  });

  return c.json({ ok: true, responsavelId: novoResponsavelId });
});

// PATCH /clientes-crm2/:empresaId/tags — Tags do Cliente 360 (mockup 20/08,
// campo novo `empresas.tags`, aditivo). Substitui a lista inteira (mesmo
// padrão simples usado no resto do cf2 pra array de texto) — o frontend
// sempre manda o array completo já editado, nunca um "adicionar 1 item" no
// backend. Sem tag nenhuma populada automaticamente: nasce vazio, só muda
// por ação manual daqui.
app.patch("/clientes-crm2/:empresaId/tags", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "ID inválido" }, 400);

  const body = await c.req.json<{ tags?: unknown }>();
  if (!Array.isArray(body.tags) || !body.tags.every((t) => typeof t === "string")) {
    return c.json({ error: "tags deve ser um array de strings" }, 400);
  }
  const tags = [...new Set(body.tags.map((t) => t.trim()).filter(Boolean))];

  const [empresa] = await db.select({ id: empresas.id, tags: empresas.tags }).from(empresas)
    .where(and(eq(empresas.id, empresaId), eq(empresas.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!empresa) return c.json({ error: "Empresa não encontrada" }, 404);

  await db.update(empresas).set({ tags, updatedAt: new Date() }).where(eq(empresas.id, empresaId));

  const anteriores = new Set(empresa.tags ?? []);
  const atuais = new Set(tags);
  for (const nome of tags.filter((tag) => !anteriores.has(tag))) {
    let [label] = await db.select({ id: labels.id }).from(labels).where(and(eq(labels.organizacaoId, ctx.organizacaoId), eq(labels.nome, nome))).limit(1);
    if (!label) [label] = await db.insert(labels).values({ organizacaoId: ctx.organizacaoId, nome }).returning({ id: labels.id });
    const [assignment] = await db.insert(entityLabels).values({ organizacaoId: ctx.organizacaoId, entityType: "empresa", entityId: empresaId, labelId: label.id, createdById: ctx.userId }).onConflictDoNothing().returning({ id: entityLabels.id });
    if (assignment) await publicarEvento({ organizacaoId: ctx.organizacaoId, eventType: "TagAdded", aggregateType: "empresa", aggregateId: empresaId, payload: { entityType: "empresa", entityId: empresaId, labelId: label.id, tag: nome }, idempotencyKey: `tag:add:${assignment.id}` });
  }
  for (const nome of [...anteriores].filter((tag) => !atuais.has(tag))) {
    const [label] = await db.select({ id: labels.id }).from(labels).where(and(eq(labels.organizacaoId, ctx.organizacaoId), eq(labels.nome, nome))).limit(1);
    if (!label) continue;
    const [removed] = await db.delete(entityLabels).where(and(eq(entityLabels.organizacaoId, ctx.organizacaoId), eq(entityLabels.entityType, "empresa"), eq(entityLabels.entityId, empresaId), eq(entityLabels.labelId, label.id))).returning({ id: entityLabels.id });
    if (removed) await publicarEvento({ organizacaoId: ctx.organizacaoId, eventType: "TagRemoved", aggregateType: "empresa", aggregateId: empresaId, payload: { entityType: "empresa", entityId: empresaId, labelId: label.id, tag: nome }, idempotencyKey: `tag:remove:${removed.id}` });
  }

  return c.json({ ok: true, tags });
});

// GET /clientes-crm2/sucesso — fila de CS. Prioridade real do time (não
// Health Score inventado): recovery/cobrança visível + ausência de próxima
// ação + Health Check com NPS baixo. Motivo é sempre explicado em texto,
// nunca um score opaco — NPS entra como um motivo A MAIS na lista, não
// como um número composto escondendo os outros sinais.
// ?empresaId= (item "CS" embutido no Cliente 360, reestruturação 20/08) —
// MESMA query/critério acima, só trocando o filtro: em vez de "só quem
// precisa de atenção agora" (lista da fila), retorna o sinal real desta
// UMA empresa sempre, esteja ela flagrada ou não — a aba CS do Cliente 360
// precisa mostrar "sem sinal de atenção" honesto, não só aparecer quando
// o cliente já está na fila. Mesmo princípio de sempre, agora com 4 sinais
// reais (24/08: Health Check/NPS é o novo — infra já existia, coleta não).
app.get("/clientes-crm2/sucesso", async (c) => {
  const ctx = await getCtx(c);
  const empresaIdFiltro = c.req.query("empresaId") ?? "";
  const temFiltroEmpresa = UUID_RE.test(empresaIdFiltro);
  const filtroEmpresa = temFiltroEmpresa ? sql`AND e.id = ${empresaIdFiltro}` : sql``;

  const rows = await db.execute(sql`
    WITH clientes_ativos AS (
      SELECT DISTINCT sc.empresa_id
      FROM servicos_canonicos sc
      WHERE sc.portfolio_included = true AND sc.empresa_id IS NOT NULL
    ),
    faturas_atrasadas AS (
      SELECT COALESCE(f.empresa_id, a.empresa_id) AS empresa_id,
        COUNT(*)::int AS n, SUM(f.valor) AS valor
      FROM faturas f
      LEFT JOIN assinaturas a ON a.id = f.assinatura_id
      WHERE f.status = 'aberta' AND COALESCE(f.vencimento, f.emitida_em) < now()
      GROUP BY 1
    ),
    ultima_atividade_agg AS (
      SELECT l.empresa_id, MAX(at.created_at) AS ultima
      FROM atividades at
      JOIN leads l ON l.id = at.lead_id
      WHERE l.empresa_id IS NOT NULL
      GROUP BY 1
    ),
    proxima_tarefa_agg AS (
      SELECT l.empresa_id, MIN(t.vence_em) AS proxima
      FROM tarefas t
      JOIN leads l ON l.id = t.lead_id
      WHERE l.empresa_id IS NOT NULL AND t.concluida = false AND t.vence_em IS NOT NULL AND t.vence_em > now()
      GROUP BY 1
    ),
    health_check_agg AS (
      SELECT DISTINCT ON (l.empresa_id) l.empresa_id, np.score, np.respondido_em
      FROM nps_respostas np
      JOIN leads l ON l.id = np.lead_id
      WHERE np.tipo = 'health_check' AND l.empresa_id IS NOT NULL AND np.score IS NOT NULL
      ORDER BY l.empresa_id, np.respondido_em DESC
    )
    SELECT e.id, e.nome,
      COALESCE(fa.n, 0) AS faturas_atrasadas, COALESCE(fa.valor, 0) AS valor_atrasado,
      ua.ultima AS ultima_atividade,
      EXTRACT(DAY FROM now() - ua.ultima)::int AS dias_sem_atividade,
      (pt.proxima IS NULL) AS sem_proxima_acao,
      hc.score AS nps_score, hc.respondido_em AS nps_respondido_em
    FROM empresas e
    JOIN clientes_ativos ca ON ca.empresa_id = e.id
    LEFT JOIN faturas_atrasadas fa ON fa.empresa_id = e.id
    LEFT JOIN ultima_atividade_agg ua ON ua.empresa_id = e.id
    LEFT JOIN proxima_tarefa_agg pt ON pt.empresa_id = e.id
    LEFT JOIN health_check_agg hc ON hc.empresa_id = e.id
    WHERE e.organizacao_id = ${ctx.organizacaoId} ${filtroEmpresa}
      ${temFiltroEmpresa ? sql`` : sql`AND (fa.n > 0 OR pt.proxima IS NULL OR ua.ultima IS NULL OR ua.ultima < now() - interval '14 days' OR hc.score <= 6)`}
    ORDER BY COALESCE(fa.valor, 0) DESC, dias_sem_atividade DESC NULLS LAST
    LIMIT 100
  `);

  return c.json({ contas: rows });
});

// POST /clientes-crm2/:empresaId/health-check — registro ao vivo do CS
// (ligação/WhatsApp real, não survey automático). Escolhe o lead mais
// recentemente ativo da empresa como destinatário — mesma heurística de
// "contato principal por atividade" já usada em outros pontos do CRM2, não
// um campo novo de "contato CS" a manter.
const healthCheckSchema = z.object({
  score: z.number().int().min(0).max(10),
  comentario: z.string().trim().max(2000).optional(),
});

app.post("/clientes-crm2/:empresaId/health-check", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);

  const parsed = healthCheckSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.issues }, 400);

  const [empresa] = await db.select({ id: empresas.id }).from(empresas).where(and(eq(empresas.id, empresaId), eq(empresas.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!empresa) return c.json({ error: "Empresa não encontrada" }, 404);

  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.empresaId, empresaId), eq(leads.organizacaoId, ctx.organizacaoId)))
    .orderBy(desc(leads.updatedAt))
    .limit(1);
  if (!lead) return c.json({ error: "Nenhum contato encontrado pra esta empresa — não é possível registrar o Health Check" }, 400);

  const [registro] = await db.insert(npsRespostas).values({
    organizacaoId: ctx.organizacaoId,
    leadId: lead.id,
    score: parsed.data.score,
    comentario: parsed.data.comentario || null,
    tipo: "health_check",
    respondidoEm: new Date(),
  }).returning({ id: npsRespostas.id });

  return c.json({ id: registro.id, faixa: faixaNps(parsed.data.score) }, 201);
});

// GET /clientes-crm2/financeiro/operacional — visão operacional CRM2. O
// segundo segmento evita colisão com o handler legado `/:empresaId` em
// runtimes cuja resolução de rotas respeita ordem de registro.
// canônicas existentes: Services para MRR, assinaturas/faturas para billing e
// service ledger para o faturamento mensal externo. Não transforma o ledger em
// MRR nem classifica registros sem evidência como AI/PABX.
app.get("/clientes-crm2/financeiro/operacional", async (c) => {
  const ctx = await getCtx(c);

  const [mrrRow] = await db.execute<{
    mrr: string;
    services: number;
    active_services: number;
    implementing_services: number;
  }>(sql`
    SELECT COALESCE(SUM(sc.current_recurring_value) FILTER (WHERE sc.portfolio_included), 0)::numeric AS mrr,
      COUNT(*)::int AS services,
      COUNT(*) FILTER (WHERE sc.commercial_lifecycle = 'ACTIVE')::int AS active_services,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM fulfillments f WHERE f.servico_canonico_id = sc.id
          AND f.status NOT IN ('COMPLETED', 'CANCELED')
      ))::int AS implementing_services
    FROM servicos_canonicos sc
    WHERE sc.organizacao_id = ${ctx.organizacaoId}
  `);

  const stripeStatus = await db.execute<{
    status: string;
    subscriptions: number;
    mrr: string;
    linked_services: number;
  }>(sql`
    SELECT a.status, COUNT(*)::int AS subscriptions,
      COALESCE(SUM(a.mrr), 0)::numeric AS mrr,
      COUNT(*) FILTER (WHERE a.servico_id IS NOT NULL)::int AS linked_services
    FROM assinaturas a
    WHERE a.organizacao_id = ${ctx.organizacaoId}
    GROUP BY a.status
    ORDER BY a.status
  `);

  const invoiceStatus = await db.execute<{
    origem: string;
    status: string;
    invoices: number;
    total: string;
  }>(sql`
    SELECT f.origem, f.status, COUNT(*)::int AS invoices,
      COALESCE(SUM(f.valor), 0)::numeric AS total
    FROM faturas f
    WHERE f.organizacao_id = ${ctx.organizacaoId}
    GROUP BY f.origem, f.status
    ORDER BY f.origem, f.status
  `);

  const [latestLedgerBatch] = await db.execute<{
    id: string;
    competence: string;
    version: string;
    source_file: string;
    expected_total: string;
    imported_total: string;
    row_count: number;
    status: string;
    imported_at: string;
  }>(sql`
    SELECT b.id, b.competence::text, b.version, b.source_file,
      b.expected_total, b.imported_total, b.row_count, b.status, b.imported_at
    FROM service_ledger_batches b
    WHERE b.organizacao_id = ${ctx.organizacaoId}
    ORDER BY b.competence DESC, b.imported_at DESC
    LIMIT 1
  `);

  const ledgerFamilies = latestLedgerBatch
    ? await db.execute<{
        service_family: string;
        entries: number;
        billed_total: string;
        linked_services: number;
        unresolved: number;
      }>(sql`
        SELECT e.service_family, COUNT(*)::int AS entries,
          COALESCE(SUM(e.billed_value), 0)::numeric AS billed_total,
          COUNT(*) FILTER (WHERE e.service_id IS NOT NULL)::int AS linked_services,
          COUNT(*) FILTER (WHERE e.service_id IS NULL)::int AS unresolved
        FROM service_ledger_entries e
        WHERE e.batch_id = ${latestLedgerBatch.id}
        GROUP BY e.service_family
        ORDER BY e.service_family
      `)
    : [];

  const [ledgerQuality] = latestLedgerBatch
    ? await db.execute<{ entries: number; linked_services: number; unresolved: number }>(sql`
        SELECT COUNT(*)::int AS entries,
          COUNT(*) FILTER (WHERE service_id IS NOT NULL)::int AS linked_services,
          COUNT(*) FILTER (WHERE service_id IS NULL)::int AS unresolved
        FROM service_ledger_entries
        WHERE batch_id = ${latestLedgerBatch.id}
      `)
    : [{ entries: 0, linked_services: 0, unresolved: 0 }];

  return c.json({
    mrr: {
      atual: mrrRow?.mrr ?? "0",
      services: mrrRow?.services ?? 0,
      activeServices: mrrRow?.active_services ?? 0,
      implementingServices: mrrRow?.implementing_services ?? 0,
    },
    stripe: stripeStatus,
    invoices: invoiceStatus,
    ledger: {
      batch: latestLedgerBatch ?? null,
      families: ledgerFamilies,
      quality: ledgerQuality ?? { entries: 0, linked_services: 0, unresolved: 0 },
    },
  });
});

// GET /clientes-crm2/:empresaId — Customer 360.
app.get("/clientes-crm2/:empresaId", async (c) => {
  const ctx = await getCtx(c);
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "ID inválido" }, 400);

  const [empresa] = await db.select().from(empresas).where(and(eq(empresas.id, empresaId), eq(empresas.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!empresa) return c.json({ error: "Empresa não encontrada" }, 404);

  const servicos = await db.select().from(servicosCanonicos).where(eq(servicosCanonicos.empresaId, empresaId)).orderBy(desc(servicosCanonicos.portfolioIncluded), desc(servicosCanonicos.currentRecurringValue));

  const servicoIds = servicos.map((s) => s.id);
  const fulfillmentsPorServico = servicoIds.length > 0
    ? await db.select().from(fulfillments).where(inArray(fulfillments.servicoCanonicoId, servicoIds))
    : [];

  // Progresso real do checklist por fulfillment (fulfillment_itens) — mesma
  // agregação já usada em GET /fulfillments (progresso concluidos/total),
  // aqui só restrita aos fulfillments desta empresa. Alimenta o componente
  // "Onboarding" do card "Saúde do Cliente" (Resumo) com % real, nunca
  // fabricado — sem fulfillment, sem entrada no Map, frontend mostra "sem
  // onboarding/implantação vinculada".
  const fulfillmentIds = fulfillmentsPorServico.map((f) => f.id);
  const itensDosFulfillments = fulfillmentIds.length > 0
    ? await db.select({ fulfillmentId: fulfillmentItens.fulfillmentId, status: fulfillmentItens.status })
        .from(fulfillmentItens).where(inArray(fulfillmentItens.fulfillmentId, fulfillmentIds))
    : [];
  const progressoPorFulfillmentId = new Map<string, { totalItens: number; itensConcluidos: number }>();
  for (const it of itensDosFulfillments) {
    const atual = progressoPorFulfillmentId.get(it.fulfillmentId) ?? { totalItens: 0, itensConcluidos: 0 };
    atual.totalItens += 1;
    if (it.status === "DONE") atual.itensConcluidos += 1;
    progressoPorFulfillmentId.set(it.fulfillmentId, atual);
  }

  // Ledger mensal fechado: a competência mais recente de cada Service é a
  // evidência de faturamento operacional. Não somamos meses aqui, porque isso
  // transformaria histórico em MRR atual; mostramos apenas o último lote e
  // deixamos o MRR canônico continuar vindo de servicos_canonicos.
  const ledgerMaisRecentePorServico = servicoIds.length > 0
    ? await db.execute<{
        service_id: string;
        competence: string;
        billed_value: string;
        entries: number;
        source_file: string;
      }>(sql`
        WITH latest_batch AS (
          SELECT DISTINCT ON (e.service_id)
            e.service_id, b.id AS batch_id, b.competence, b.source_file
          FROM service_ledger_entries e
          JOIN service_ledger_batches b ON b.id = e.batch_id
          WHERE e.organizacao_id = ${ctx.organizacaoId}
            AND e.service_id IN (${sql.join(servicoIds.map((id) => sql`${id}`), sql`, `)})
            AND b.status <> 'SUPERSEDED'
          ORDER BY e.service_id, b.competence DESC, b.imported_at DESC
        )
        SELECT lb.service_id, lb.competence::text, lb.source_file,
          COALESCE(SUM(e.billed_value), 0)::numeric AS billed_value,
          COUNT(*)::int AS entries
        FROM latest_batch lb
        JOIN service_ledger_entries e ON e.service_id = lb.service_id AND e.batch_id = lb.batch_id
        GROUP BY lb.service_id, lb.competence, lb.source_file
      `)
    : [];
  const ledgerPorServico = new Map(ledgerMaisRecentePorServico.map((row) => [row.service_id, row]));

  const contratoIds = servicos.map((s) => s.contratoId).filter((id): id is string => !!id);
  const contratosDoServico = contratoIds.length > 0
    ? await db.select().from(contratos).where(inArray(contratos.id, contratoIds))
    : [];

  // Billing precisa aparecer por Service, não só no resumo financeiro da
  // empresa. O sync histórico deixou parte das assinaturas sem `servico_id`,
  // então reconciliamos pelos três vínculos reais disponíveis, nesta ordem:
  // Service direto, contrato e current_subscription_id. Não usamos nome de
  // produto para fazer matching.
  const [assinaturasPorServicoRows, assinaturasPorContratoRows] = await Promise.all([
    servicoIds.length > 0
      ? db.select({
          id: assinaturas.id, servicoId: assinaturas.servicoId, contratoId: assinaturas.contratoId,
          stripeSubscriptionId: assinaturas.stripeSubscriptionId, status: assinaturas.status,
          billingStatus: assinaturas.billingStatus, syncedAt: assinaturas.syncedAt,
        }).from(assinaturas).where(inArray(assinaturas.servicoId, servicoIds))
      : Promise.resolve([]),
    contratoIds.length > 0
      ? db.select({
          id: assinaturas.id, servicoId: assinaturas.servicoId, contratoId: assinaturas.contratoId,
          stripeSubscriptionId: assinaturas.stripeSubscriptionId, status: assinaturas.status,
          billingStatus: assinaturas.billingStatus, syncedAt: assinaturas.syncedAt,
        }).from(assinaturas).where(inArray(assinaturas.contratoId, contratoIds))
      : Promise.resolve([]),
  ]);
  const prioridadeBilling: Record<string, number> = {
    active: 5, trialing: 4, past_due: 3, unpaid: 2, incomplete: 1,
    ACTIVE: 5, ACTIVE_CANCEL_SCHEDULED: 4, PAST_DUE: 3, BILLED: 2, UNKNOWN: 0,
  };
  const assinaturasPorId = new Map<string, (typeof assinaturasPorServicoRows)[number]>();
  for (const assinatura of [...assinaturasPorServicoRows, ...assinaturasPorContratoRows]) {
    assinaturasPorId.set(assinatura.id, assinatura);
  }
  const assinaturaPorServico = new Map<string, (typeof assinaturasPorServicoRows)[number]>();
  const assinaturaPorServicoContrato = new Map<string, (typeof assinaturasPorServicoRows)[number]>();
  const assinaturaPorStripe = new Map<string, (typeof assinaturasPorServicoRows)[number]>();
  for (const assinatura of assinaturasPorId.values()) {
    const status = assinatura.billingStatus || assinatura.status;
    const substituir = (atual: (typeof assinatura) | undefined) => {
      if (!atual) return true;
      const atualStatus = atual.billingStatus || atual.status;
      return (prioridadeBilling[status] ?? 0) > (prioridadeBilling[atualStatus] ?? 0);
    };
    if (assinatura.servicoId && substituir(assinaturaPorServico.get(assinatura.servicoId))) assinaturaPorServico.set(assinatura.servicoId, assinatura);
    if (assinatura.contratoId && substituir(assinaturaPorServicoContrato.get(assinatura.contratoId))) assinaturaPorServicoContrato.set(assinatura.contratoId, assinatura);
    if (substituir(assinaturaPorStripe.get(assinatura.stripeSubscriptionId))) assinaturaPorStripe.set(assinatura.stripeSubscriptionId, assinatura);
  }

  // Pessoas vinculadas: Pessoa é a identidade canônica; Lead é apenas o
  // contexto de aquisição. O Cliente 360 ainda precisa dos leadIds para
  // preservar compatibilidade com propostas/atividades legadas, mas não pode
  // renderizar uma linha por reengajamento como se fosse uma pessoa diferente.
  const pessoasBase = await db.select({ id: leads.id, nome: leads.nome, cargo: leads.cargo, email: leads.email, telefone: leads.telefone, tipo: leads.tipo }).from(leads).where(and(eq(leads.empresaId, empresaId), eq(leads.organizacaoId, ctx.organizacaoId)));
  const leadIds = pessoasBase.map((p) => p.id);

  // pontos_contato é o bridge de identidade real para leads que não ficaram
  // como `pessoas.lead_id_legado` (inclusive reengajamentos). Não fazemos
  // matching heurístico por nome, telefone ou e-mail nesta leitura.
  const pontosDaEmpresa = leadIds.length > 0
    ? await db.select({ leadIdLegado: pontosContato.leadIdLegado, pessoaId: pontosContato.pessoaId })
        .from(pontosContato)
        .where(and(eq(pontosContato.organizacaoId, ctx.organizacaoId), inArray(pontosContato.leadIdLegado, leadIds)))
    : [];
  const pessoaIdsDosLeads = [...new Set(pontosDaEmpresa.map((p) => p.pessoaId).filter((id): id is string => !!id))];
  const pessoaScope = pessoaIdsDosLeads.length > 0 && leadIds.length > 0
    ? or(eq(pessoasTable.empresaId, empresaId), inArray(pessoasTable.id, pessoaIdsDosLeads), inArray(pessoasTable.leadIdLegado, leadIds))
    : leadIds.length > 0
      ? or(eq(pessoasTable.empresaId, empresaId), inArray(pessoasTable.leadIdLegado, leadIds))
      : eq(pessoasTable.empresaId, empresaId);
  const pessoasCanonicas = await db.select({
    id: pessoasTable.id, nome: pessoasTable.nome, sobrenome: pessoasTable.sobrenome, cargo: pessoasTable.cargo,
    email: pessoasTable.email, telefone: pessoasTable.telefone, leadIdLegado: pessoasTable.leadIdLegado,
  }).from(pessoasTable).where(and(eq(pessoasTable.organizacaoId, ctx.organizacaoId), pessoaScope));
  const leadPorId = new Map(pessoasBase.map((lead) => [lead.id, lead]));
  const pessoaPorLead = new Map<string, (typeof pessoasCanonicas)[number]>();
  const leadsPorPessoa = new Map<string, string[]>();
  for (const pessoa of pessoasCanonicas) {
    if (pessoa.leadIdLegado) {
      pessoaPorLead.set(pessoa.leadIdLegado, pessoa);
      leadsPorPessoa.set(pessoa.id, [pessoa.leadIdLegado]);
    }
  }
  for (const ponto of pontosDaEmpresa) {
    if (!ponto.pessoaId || !ponto.leadIdLegado) continue;
    const leadsDaPessoa = leadsPorPessoa.get(ponto.pessoaId) ?? [];
    if (!leadsDaPessoa.includes(ponto.leadIdLegado)) leadsDaPessoa.push(ponto.leadIdLegado);
    leadsPorPessoa.set(ponto.pessoaId, leadsDaPessoa);
    const pessoa = pessoasCanonicas.find((candidate) => candidate.id === ponto.pessoaId);
    if (pessoa) pessoaPorLead.set(ponto.leadIdLegado, pessoa);
  }

  // Papel real (item 3, 20/08): negocio_leads.papel, restrito a negócios
  // DESTA empresa (um lead pode ter negócios em outra empresa antes de ser
  // resolvido — não misturar papel de fora). Uma pessoa pode aparecer em mais
  // de um negócio da mesma empresa com papéis diferentes ao longo do tempo;
  // fica o papel do negócio mais recente, real (não fabricado — enum atual
  // não cobre "financeiro"/"usuário" pedidos pelo Kauã, gap conhecido).
  const papeisRows = leadIds.length > 0
    ? await db.select({ leadId: negocioLeads.leadId, papel: negocioLeads.papel, negocioCreatedAt: negocios.createdAt })
        .from(negocioLeads)
        .innerJoin(negocios, eq(negocios.id, negocioLeads.negocioId))
        .where(and(inArray(negocioLeads.leadId, leadIds), eq(negocios.empresaId, empresaId)))
        .orderBy(desc(negocios.createdAt))
    : [];
  const papelPorLead = new Map<string, string | null>();
  for (const row of papeisRows) {
    if (!papelPorLead.has(row.leadId)) papelPorLead.set(row.leadId, row.papel);
  }
  const pessoasResposta: Array<{
    id: string; pessoaId: string | null; leadId: string | null; leadIds: string[];
    nome: string; cargo: string | null; email: string | null; telefone: string | null;
    tipo: string; papel: string | null;
  }> = [];
  const pessoasIncluidas = new Set<string>();
  for (const pessoa of pessoasCanonicas) {
    const pessoaLeadIds = leadsPorPessoa.get(pessoa.id) ?? [];
    const leadRepresentativo = pessoaLeadIds.map((id) => leadPorId.get(id)).find(Boolean);
    const rowId = leadRepresentativo?.id ?? pessoa.id;
    pessoasResposta.push({
      id: rowId,
      pessoaId: pessoa.id,
      leadId: leadRepresentativo?.id ?? null,
      leadIds: pessoaLeadIds,
      nome: pessoa.nome || leadRepresentativo?.nome || "Pessoa sem nome",
      cargo: pessoa.cargo ?? leadRepresentativo?.cargo ?? null,
      email: pessoa.email ?? leadRepresentativo?.email ?? null,
      telefone: pessoa.telefone ?? leadRepresentativo?.telefone ?? null,
      tipo: leadRepresentativo?.tipo ?? "contato",
      papel: pessoaLeadIds.map((id) => papelPorLead.get(id)).find((papel) => !!papel) ?? null,
    });
    pessoasIncluidas.add(pessoa.id);
  }
  // Compatibilidade explícita para leads sem Pessoa canônica ou sem bridge
  // recuperável. Eles continuam visíveis, mas não são duplicados quando há
  // identidade persistente correspondente.
  for (const lead of pessoasBase) {
    const pessoa = pessoaPorLead.get(lead.id);
    if (pessoa && pessoasIncluidas.has(pessoa.id)) continue;
    pessoasResposta.push({
      id: lead.id, pessoaId: null, leadId: lead.id, leadIds: [lead.id],
      nome: lead.nome, cargo: lead.cargo, email: lead.email, telefone: lead.telefone,
      tipo: lead.tipo, papel: papelPorLead.get(lead.id) ?? null,
    });
  }
  const pessoas = pessoasResposta;

  const notasDiretas = await db.select({ id: notas.id, conteudo: notas.conteudo, autorNome: usuarios.nome, createdAt: notas.createdAt, pessoaNome: sql<string | null>`null` })
    .from(notas).leftJoin(usuarios, eq(notas.autorId, usuarios.id)).where(eq(notas.empresaId, empresaId));
  const notasDePessoas = leadIds.length > 0
    ? await db.select({ id: notas.id, conteudo: notas.conteudo, autorNome: usuarios.nome, createdAt: notas.createdAt, pessoaNome: leads.nome })
        .from(notas).leftJoin(usuarios, eq(notas.autorId, usuarios.id)).innerJoin(leads, eq(notas.leadId, leads.id)).where(inArray(notas.leadId, leadIds))
    : [];
  const timeline = [...notasDiretas, ...notasDePessoas].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const currentMrr = servicos.filter((s) => s.portfolioIncluded).reduce((sum, s) => sum + parseFloat(s.currentRecurringValue || "0"), 0);

  // Referência de UX (19/08, Cliente 360): "Cliente desde"/status financeiro
  // já existem em `clientes` (cache de leitura), "Próxima fatura" é real
  // (faturas.empresaId direto ou via assinatura), Propostas/Próximas ações
  // resolvem pelas mesmas Pessoas vinculadas já buscadas acima — sem
  // recriar nenhuma dessas queries em outro lugar.
  const [clienteInfo] = await db.select({ clienteDesde: clientes.clienteDesde, statusFinanceiro: clientes.statusFinanceiro, responsavelId: clientes.responsavelId })
    .from(clientes).where(eq(clientes.empresaId, empresaId)).limit(1);

  const [responsavel] = clienteInfo?.responsavelId
    ? await db.select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email }).from(usuarios).where(eq(usuarios.id, clienteInfo.responsavelId)).limit(1)
    : [null];

  const [proximaFatura] = await db.execute<{ valor: string; vencimento: string }>(sql`
    SELECT f.valor, COALESCE(f.vencimento, f.emitida_em) AS vencimento
    FROM faturas f
    LEFT JOIN assinaturas a ON a.id = f.assinatura_id
    WHERE f.status = 'aberta' AND COALESCE(f.vencimento, f.emitida_em) >= now()
      AND (f.empresa_id = ${empresaId} OR a.empresa_id = ${empresaId})
    ORDER BY COALESCE(f.vencimento, f.emitida_em) ASC
    LIMIT 1
  `);

  const [faturasAtrasadasRow] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n
    FROM faturas f
    LEFT JOIN assinaturas a ON a.id = f.assinatura_id
    WHERE f.status = 'aberta' AND COALESCE(f.vencimento, f.emitida_em) < now()
      AND (f.empresa_id = ${empresaId} OR a.empresa_id = ${empresaId})
  `);

  // Faturas em aberto (item 5, "Saúde do Cliente" → componente Financeiro; e
  // "Visão Geral" → Faturamento em Aberto, reestruturação 20/08) — total e
  // valor de faturas com status='aberta' (vencidas ou não), mesma junção de
  // sempre (faturas.empresa_id direto OU via assinatura). Distinto de
  // faturasAtrasadasRow acima (que já filtra só as vencidas) — aqui é o
  // total bruto em aberto, pro texto "X faturas em aberto" quando não há
  // atraso e pro card de Faturamento em Aberto.
  const [faturasAbertasRow] = await db.execute<{ n: number; valor: string }>(sql`
    SELECT COUNT(*)::int AS n, COALESCE(SUM(f.valor), 0) AS valor
    FROM faturas f
    LEFT JOIN assinaturas a ON a.id = f.assinatura_id
    WHERE f.status = 'aberta'
      AND (f.empresa_id = ${empresaId} OR a.empresa_id = ${empresaId})
  `);

  // Últimas atividades reais (18/08, referência de UX do drawer da
  // Carteira) — mesma fonte de `atividades` via leadIds já resolvidos
  // acima, nunca uma segunda query pra achar os leads da empresa.
  // 08/09: passou a incluir também as atividades escritas direto na empresa
  // (interações de CS, que não têm lead obrigatório). O INNER JOIN em `leads`
  // virou LEFT — mantê-lo excluiria justamente o registro novo, e o Cliente
  // 360 mostraria uma timeline sem o que o CS acabou de escrever nela.
  const atividadesRecentes = (leadIds.length > 0 || empresaId)
    ? await db.select({ id: atividades.id, tipo: atividades.tipo, titulo: atividades.titulo, createdAt: atividades.createdAt, autorNome: usuarios.nome, pessoaNome: leads.nome })
        .from(atividades)
        .leftJoin(usuarios, eq(usuarios.id, atividades.usuarioId))
        .leftJoin(leads, eq(leads.id, atividades.leadId))
        .where(or(
          eq(atividades.empresaId, empresaId),
          leadIds.length > 0 ? inArray(atividades.leadId, leadIds) : undefined,
        ))
        .orderBy(desc(atividades.createdAt))
        .limit(40)
    : [];

  const propostasCliente = leadIds.length > 0
    ? await db.select({ id: propostas.id, numero: propostas.numero, valorTotal: propostas.totalGeral, status: propostas.status, createdAt: propostas.createdAt })
        .from(propostas).where(inArray(propostas.leadId, leadIds)).orderBy(desc(propostas.createdAt)).limit(10)
    : [];

  const proximasAcoes = leadIds.length > 0
    ? await db.select({ id: tarefas.id, titulo: tarefas.titulo, venceEm: tarefas.venceEm, usuarioNome: usuarios.nome })
        .from(tarefas).leftJoin(usuarios, eq(usuarios.id, tarefas.usuarioId))
        .where(and(inArray(tarefas.leadId, leadIds), eq(tarefas.concluida, false)))
        .orderBy(asc(tarefas.venceEm)).limit(10)
    : [];

  // Desempenho mensal: usa a projeção histórica materializada a partir do
  // faturamento real do cliente. Current MRR continua vindo de
  // servicos_canonicos; esta série responde "quanto este cliente pagou por
  // mês", desde 2021 quando há histórico importado.
  const receitaMensalRows = await db.execute<{
    competencia: string;
    mes: string;
    valor: string;
    lancamentos: number;
  }>(sql`
    SELECT competencia::text,
      to_char(competencia, 'YYYY-MM') AS mes,
      COALESCE(SUM(valor), 0)::numeric AS valor,
      COALESCE(SUM(quantidade_lancamentos), 0)::int AS lancamentos
    FROM cliente_receita_mensal
    WHERE organizacao_id = ${ctx.organizacaoId}
      AND empresa_id = ${empresaId}
      AND revenue_nature IN ('MRR', 'UNKNOWN')
    GROUP BY competencia
    ORDER BY competencia
  `);
  const mrrMensal = receitaMensalRows.map((row) => ({
    mes: new Date(`${row.competencia}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
    valor: parseFloat(row.valor || "0"),
    competencia: row.competencia,
    lancamentos: row.lancamentos,
  }));

  const receitaMensalProdutos = await db.execute<{
    competencia: string;
    service_family: string;
    canonical_product: string | null;
    confidence: string;
    valor: string;
    lancamentos: number;
  }>(sql`
    SELECT competencia::text, service_family,
      COALESCE(canonical_product, NULLIF(service_family, 'UNKNOWN'), 'Produto em revisão') AS canonical_product,
      confidence,
      COALESCE(SUM(valor), 0)::numeric AS valor,
      COALESCE(SUM(quantidade_lancamentos), 0)::int AS lancamentos
    FROM cliente_receita_mensal
    WHERE organizacao_id = ${ctx.organizacaoId}
      AND empresa_id = ${empresaId}
      AND revenue_nature IN ('MRR', 'UNKNOWN')
    GROUP BY competencia, service_family, canonical_product, confidence
    ORDER BY competencia DESC, valor DESC
    LIMIT 240
  `);

  // Aba "Comercial" (reestruturação 20/08): histórico REAL de negócios desta
  // empresa (leads/oportunidades/vendedor/fechamento) — não existia painel
  // "Histórico Comercial" antes desta sessão (confirmado no código, só
  // existia a aba Propostas), então construído aqui do zero com dado real.
  // "SDR" da referência de UX não tem campo próprio no schema (só
  // responsavelId = vendedor/closer) — gap de produto, não fabricado.
  const negociosEmpresa = await db.select({
    id: negocios.id, titulo: negocios.titulo, status: negocios.status, temperatura: negocios.temperatura,
    valorTotal: negocios.valorTotal, mrrFechado: negocios.mrrFechado, leadId: negocios.leadId,
    commercialMotion: negocios.commercialMotion,
    responsavelId: negocios.responsavelId, createdAt: negocios.createdAt, ganhoAt: negocios.ganhoAt,
  }).from(negocios).where(eq(negocios.empresaId, empresaId)).orderBy(desc(negocios.createdAt));

  const responsavelIds = [...new Set(negociosEmpresa.map((n) => n.responsavelId).filter((id): id is string => !!id))];
  const responsaveisNegocios = responsavelIds.length > 0
    ? await db.select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email }).from(usuarios).where(inArray(usuarios.id, responsavelIds))
    : [];
  const nomeResponsavelPorId = new Map(responsaveisNegocios.map((r) => [r.id, r.nome]));
  const emailResponsavelPorId = new Map(responsaveisNegocios.map((r) => [r.id, r.email]));
  const negocioIdsEmpresa = negociosEmpresa.map((n) => n.id);
  const vinculosNegocio = negocioIdsEmpresa.length > 0
    ? await db.execute<{ negocio_id: string; contratos: number; propostas: number }>(sql`
        SELECT n.id AS negocio_id,
          COUNT(DISTINCT c.id)::int AS contratos,
          COUNT(DISTINCT p.id)::int AS propostas
        FROM negocios n
        LEFT JOIN contratos c ON c.negocio_id = n.id
        LEFT JOIN propostas p ON p.negocio_id = n.id
        WHERE n.id IN ${sql.raw(`(${negocioIdsEmpresa.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")})`)}
        GROUP BY n.id
      `)
    : [];
  const vinculoPorNegocioId = new Map(vinculosNegocio.map((v) => [v.negocio_id, v]));
  const negociosComVendedorBruto = negociosEmpresa.map((n) => ({
    ...n,
    vendedorNome: n.responsavelId ? nomeResponsavelPorId.get(n.responsavelId) ?? null : null,
    contratosVinculados: vinculoPorNegocioId.get(n.id)?.contratos ?? 0,
    propostasVinculadas: vinculoPorNegocioId.get(n.id)?.propostas ?? 0,
  }));
  const scoreNegocio = (n: typeof negociosComVendedorBruto[number]) =>
    (n.status === "ganho" ? 64 : 0) +
    ((n.propostasVinculadas ?? 0) > 0 ? 32 : 0) +
    ((n.contratosVinculados ?? 0) > 0 ? 16 : 0) +
    (n.ganhoAt ? 8 : 0) +
    (n.responsavelId ? 4 : 0);
  const negociosPorChave = new Map<string, typeof negociosComVendedorBruto[number]>();
  for (const negocio of negociosComVendedorBruto) {
    const tituloNormalizado = (negocio.titulo ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const valorChave = Number(negocio.mrrFechado ?? negocio.valorTotal ?? 0).toFixed(2);
    const chave = `${negocio.leadId ?? "sem-lead"}:${tituloNormalizado}:${valorChave}`;
    const atual = negociosPorChave.get(chave);
    if (!atual || scoreNegocio(negocio) > scoreNegocio(atual)) negociosPorChave.set(chave, negocio);
  }
  const negociosComVendedor = [...negociosPorChave.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // "Executivo" do header (mockup 20/08, distinto do CS Owner que já existe
  // em `clientes.responsavel_id`) — decisão fechada: vendedor/closer
  // (negocios.responsavel_id) do negócio GANHO mais antigo desta empresa,
  // MESMO critério (asc ganhoAt/createdAt) já usado acima pra achar o lead
  // de origem em "Origem e aquisição" — é o negócio que efetivamente gerou
  // o cliente, não o mais recente. Sem negócio ganho com responsável
  // atribuído, fica null (frontend mostra "—"), nunca cai pro vendedor de
  // um negócio perdido/em aberto.
  const primeiroGanhoComResponsavel = [...negociosComVendedor]
    .filter((n) => n.status === "ganho" && n.responsavelId)
    .sort((a, b) => {
      const da = a.ganhoAt ? new Date(a.ganhoAt).getTime() : new Date(a.createdAt).getTime();
      const db_ = b.ganhoAt ? new Date(b.ganhoAt).getTime() : new Date(b.createdAt).getTime();
      return da - db_;
    })[0] ?? null;
  const executivo = primeiroGanhoComResponsavel?.responsavelId
    ? {
        id: primeiroGanhoComResponsavel.responsavelId,
        nome: nomeResponsavelPorId.get(primeiroGanhoComResponsavel.responsavelId) ?? null,
        email: emailResponsavelPorId.get(primeiroGanhoComResponsavel.responsavelId) ?? null,
      }
    : null;

  // Aba "Contratos" (21/08): contrato não tem empresa_id direto no schema
  // (confirmado no banco: só lead_id/negocio_id) — resolvido POR LINHA, não
  // por união de conjuntos: pegadinha real encontrada no dado — numa venda
  // White Label/reseller, contratos.lead_id às vezes aponta pro parceiro
  // revendedor (ex.: empresa "FACILITA TELECOM" concentrando 62 contratos
  // via lead_id direto, verificado com psql), enquanto negocios.empresa_id
  // do MESMO contrato aponta pro cliente final correto (é o negócio que
  // fecha com o cliente real, ex. "MAIS TECNOLOGIA"). Testado com `OR
  // (leadId IN leadIds) OR (negocioId IN negocioIds)` primeiro e o resultado
  // ficou ERRADO (Facilita continuava com 62, deveria cair pra 43) — união
  // de conjuntos não respeita qual campo manda quando os dois apontam pra
  // empresas diferentes. Fix: resolver com COALESCE(negocio.empresa_id,
  // lead.empresa_id) por contrato, leadId só como fallback quando não há
  // negocioId (344/616 contratos no banco) ou o negócio não tem empresa
  // (84/616). Buscar só os IDs via SQL cru e depois os registros completos
  // via Drizzle (mantém tipos/Date corretos pro resto do handler).
  const idsContratoResolvidos = await db.execute<{ id: string }>(sql`
    SELECT c.id FROM contratos c
    LEFT JOIN negocios n ON n.id = c.negocio_id
    LEFT JOIN leads l ON l.id = c.lead_id
    WHERE COALESCE(n.empresa_id, l.empresa_id) = ${empresaId}
  `);
  const contratosPorLeadOuNegocio = idsContratoResolvidos.length > 0
    ? await db.select().from(contratos).where(inArray(contratos.id, idsContratoResolvidos.map((r) => r.id)))
    : [];

  const todosContratosMap = new Map<string, typeof contratosDoServico[number]>();
  for (const ct of contratosDoServico) todosContratosMap.set(ct.id, ct);
  for (const ct of contratosPorLeadOuNegocio) todosContratosMap.set(ct.id, ct);
  const todosContratos = [...todosContratosMap.values()];

  // Reconciliação comercial/financeira do contrato: contrato e assinatura são
  // entidades diferentes. O vínculo Stripe pode estar no próprio contrato
  // (fluxo legado/aceite) ou em `assinaturas.contrato_id` (sync atual). A tela
  // precisa mostrar os dois caminhos, sem transformar ausência de Stripe em
  // "erro" para contratos Zoho antigos.
  const contratoIdsParaConciliacao = todosContratos.map((ct) => ct.id);
  const assinaturasDosContratos = contratoIdsParaConciliacao.length > 0
    ? await db.select({
        id: assinaturas.id, contratoId: assinaturas.contratoId,
        stripeSubscriptionId: assinaturas.stripeSubscriptionId,
        status: assinaturas.status, mrr: assinaturas.mrr,
        currentPeriodEnd: assinaturas.currentPeriodEnd, syncedAt: assinaturas.syncedAt,
      }).from(assinaturas).where(inArray(assinaturas.contratoId, contratoIdsParaConciliacao))
    : [];
  const prioridadeStatusAssinatura: Record<string, number> = { active: 4, past_due: 3, trialing: 3, incomplete: 2, canceled: 1 };
  const assinaturaPorContrato = new Map<string, (typeof assinaturasDosContratos)[number]>();
  for (const assinatura of assinaturasDosContratos) {
    if (!assinatura.contratoId) continue;
    const atual = assinaturaPorContrato.get(assinatura.contratoId);
    if (!atual || (prioridadeStatusAssinatura[assinatura.status] ?? 0) > (prioridadeStatusAssinatura[atual.status] ?? 0)) {
      assinaturaPorContrato.set(assinatura.contratoId, assinatura);
    }
  }
  const faturasDosContratos = contratoIdsParaConciliacao.length > 0
    ? await db.execute<{ contrato_id: string; total: number; abertas: number; atrasadas: number; pagas: number }>(sql`
        SELECT COALESCE(f.contrato_id, a.contrato_id) AS contrato_id,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE f.status = 'aberta')::int AS abertas,
          COUNT(*) FILTER (WHERE f.status = 'aberta' AND COALESCE(f.vencimento, f.emitida_em) < now())::int AS atrasadas,
          COUNT(*) FILTER (WHERE f.status = 'paga')::int AS pagas
        FROM faturas f
        LEFT JOIN assinaturas a ON a.id = f.assinatura_id
        WHERE COALESCE(f.contrato_id, a.contrato_id) IN (${sql.join(contratoIdsParaConciliacao.map((id) => sql`${id}`), sql`, `)})
        GROUP BY COALESCE(f.contrato_id, a.contrato_id)
      `)
    : [];
  const faturasPorContrato = new Map(faturasDosContratos.map((f) => [f.contrato_id, f]));

  // Itens do contrato (24/08, Kauã: "preciso saber qual produto o cliente
  // contratou... produto por produto") — tabela `contrato_itens` já existe
  // com 487 linhas reais (nome, quantidade, valor unitário, subtotal,
  // classificação semântica com evidência), recuperada do Zoho junto com o
  // resto da migração — só nunca tinha rota nem tela lendo ela até hoje.
  const itensDosContratos = contratoIdsParaConciliacao.length > 0
    ? await db.select({
        contratoId: contratoItens.contratoId, nome: contratoItens.nome, descricao: contratoItens.descricao,
        quantidade: contratoItens.quantidade, valorUnitario: contratoItens.valorUnitario, subtotal: contratoItens.subtotal,
      }).from(contratoItens).where(inArray(contratoItens.contratoId, contratoIdsParaConciliacao))
    : [];
  const itensPorContrato = new Map<string, typeof itensDosContratos>();
  for (const item of itensDosContratos) {
    if (!item.contratoId) continue;
    const lista = itensPorContrato.get(item.contratoId) ?? [];
    lista.push(item);
    itensPorContrato.set(item.contratoId, lista);
  }

  // Proposta origem (regra fechada, sem FK direta contrato→proposta): entre
  // as propostas ACEITAS do MESMO negócio do contrato, a mais próxima em
  // data da assinatura do contrato (assinadoEm quando aceite_simples, senão
  // createdAt como aproximação). Contrato sem negocioId (344/616, real) não
  // tem como resolver por este critério — fica "—", não adivinha por lead.
  const negocioIdsDosContratos = [...new Set(todosContratos.map((c) => c.negocioId).filter((id): id is string => !!id))];
  const propostasAceitasPorNegocio = negocioIdsDosContratos.length > 0
    ? await db.select({ id: propostas.id, numero: propostas.numero, negocioId: propostas.negocioId, createdAt: propostas.createdAt })
        .from(propostas).where(and(inArray(propostas.negocioId, negocioIdsDosContratos), eq(propostas.status, "aceita")))
    : [];

  // Dias até vencimento (calendário puro, sem hora) — só tem sentido pra
  // contrato ativo com vencimento preenchido. Positivo = ainda vai vencer;
  // negativo = já venceu e não foi renovado/atualizado (não é o alerta
  // pedido aqui, que é só de vencimento futuro em 90/60/30 dias).
  function diasAteVencimento(vencimento: string | null): number | null {
    if (!vencimento) return null;
    const hoje = new Date();
    const hojeUTC = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const [y, m, d] = vencimento.split("-").map(Number);
    const vencUTC = Date.UTC(y, m - 1, d);
    return Math.round((vencUTC - hojeUTC) / 86400000);
  }

  const contratosParaRespostaBruta = todosContratos.map((c) => {
    const propostasDoNegocio = c.negocioId ? propostasAceitasPorNegocio.filter((p) => p.negocioId === c.negocioId) : [];
    const referenciaAssinatura = c.assinadoEm ?? c.createdAt;
    let propostaOrigem: { id: string; numero: number } | null = null;
    if (propostasDoNegocio.length > 0) {
      const maisProxima = propostasDoNegocio.reduce((melhor, p) => {
        const diffAtual = Math.abs(new Date(p.createdAt).getTime() - new Date(referenciaAssinatura).getTime());
        const diffMelhor = Math.abs(new Date(melhor.createdAt).getTime() - new Date(referenciaAssinatura).getTime());
        return diffAtual < diffMelhor ? p : melhor;
      });
      propostaOrigem = { id: maisProxima.id, numero: maisProxima.numero };
    }
    const assinaturaStripe = assinaturaPorContrato.get(c.id);
    const faturasContrato = faturasPorContrato.get(c.id);
    return {
      id: c.id, tipo: c.tipo, descricao: c.descricao, status: c.status, moeda: c.moeda,
      mrr: c.mrr, currentRecurringValue: c.currentRecurringValue, servicos: c.servicos,
      inicio: c.inicio, vencimento: c.vencimento, renovacaoAuto: c.renovacaoAuto,
      assinaturaStatus: c.assinaturaStatus, assinadoEm: isoServer(c.assinadoEm), createdAt: isoServer(c.createdAt)!,
      signatureStatus: c.signatureStatus,
      emailEntrega: c.emailEntrega,
      temCorpoGerado: !!c.corpoGerado, zohoId: c.zohoId, negocioId: c.negocioId, leadId: c.leadId,
      propostaOrigem, diasParaVencer: c.status === "ativo" ? diasAteVencimento(c.vencimento) : null,
      stripeSubscriptionId: c.stripeSubscriptionId || assinaturaStripe?.stripeSubscriptionId || null,
      billingStatus: assinaturaStripe?.status || null,
      faturas: {
        total: faturasContrato?.total ?? 0,
        abertas: faturasContrato?.abertas ?? 0,
        atrasadas: faturasContrato?.atrasadas ?? 0,
        pagas: faturasContrato?.pagas ?? 0,
      },
      itens: itensPorContrato.get(c.id) ?? [],
    };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Contratos podem ter um registro comercial e um espelho de assinatura para
  // a mesma subscription. Para o Cliente 360 isso é um único vínculo; mantém o
  // registro mais rico (negócio/proposta/itens/documento) e só cai no espelho
  // se ele for a única evidência.
  const contratosPorChave = new Map<string, typeof contratosParaRespostaBruta[number]>();
  const scoreContrato = (ct: typeof contratosParaRespostaBruta[number]) =>
    (ct.propostaOrigem ? 32 : 0) +
    (ct.negocioId ? 16 : 0) +
    ((ct.itens?.length ?? 0) > 0 ? 8 : 0) +
    (ct.temCorpoGerado ? 4 : 0) +
    (ct.zohoId ? 2 : 0) +
    (ct.stripeSubscriptionId ? 1 : 0);
  for (const contrato of contratosParaRespostaBruta) {
    const chave = contrato.stripeSubscriptionId ? `stripe:${contrato.stripeSubscriptionId}` : `contrato:${contrato.id}`;
    const atual = contratosPorChave.get(chave);
    if (!atual || scoreContrato(contrato) > scoreContrato(atual)) contratosPorChave.set(chave, contrato);
  }
  const contratosParaResposta = [...contratosPorChave.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Alerta agregado do header (90/60/30 dias) — só considera contrato ATIVO
  // com vencimento futuro dentro da janela; contrato já vencido ou sem
  // vencimento preenchido nunca entra aqui (nunca fabricar sinal).
  const contratoMaisUrgente = contratosParaResposta
    .filter((c) => c.diasParaVencer !== null && c.diasParaVencer >= 0 && c.diasParaVencer <= 90)
    .sort((a, b) => (a.diasParaVencer ?? 0) - (b.diasParaVencer ?? 0))[0] ?? null;

  // Timeline consolidada (item 2, 20/08): evento real por tipo, nunca uma
  // segunda fonte fabricada — cada entrada abaixo vem de uma query que já
  // roda nesta mesma rota (nota/atividade/proposta/venda/contrato) ou de uma
  // query nova e barata sobre tabela já usada em outro ponto do produto
  // (pagamento via `faturas.paga_em`, tarefa via `tarefas.concluida_em`).
  // "Onboarding"/"Implantação" reaproveitam fulfillments.startedAt/completedAt
  // já buscados acima em fulfillmentsPorServico.
  const faturasPagas = leadIds.length > 0 || contratoIds.length > 0
    ? await db.execute<{ id: string; valor: string; paga_em: string }>(sql`
        SELECT f.id, f.valor, f.paga_em
        FROM faturas f
        LEFT JOIN assinaturas a ON a.id = f.assinatura_id
        WHERE f.status = 'paga' AND f.paga_em IS NOT NULL
          AND (f.empresa_id = ${empresaId} OR a.empresa_id = ${empresaId})
        ORDER BY f.paga_em DESC
        LIMIT 30
      `)
    : [];

  const tarefasConcluidas = leadIds.length > 0
    ? await db.select({ id: tarefas.id, titulo: tarefas.titulo, concluidaEm: tarefas.concluidaEm })
        .from(tarefas)
        .where(and(inArray(tarefas.leadId, leadIds), eq(tarefas.concluida, true), isNotNull(tarefas.concluidaEm)))
        .orderBy(desc(tarefas.concluidaEm))
        .limit(30)
    : [];

  type EventoTimeline = { id: string; tipo: string; titulo: string; subtitulo: string | null; quando: string };
  const timelineEventos: EventoTimeline[] = [
    ...timeline.map((n) => ({ id: `nota-${n.id}`, tipo: "nota", titulo: n.conteudo.length > 140 ? n.conteudo.slice(0, 140) + "…" : n.conteudo, subtitulo: n.autorNome ?? null, quando: isoServer(n.createdAt)! })),
    ...atividadesRecentes.map((a) => ({ id: `atividade-${a.id}`, tipo: a.tipo, titulo: a.titulo || a.tipo, subtitulo: a.autorNome ?? null, quando: isoServer(a.createdAt)! })),
    ...propostasCliente.map((p) => ({ id: `proposta-${p.id}`, tipo: "proposta", titulo: `Proposta #${p.numero}`, subtitulo: p.status, quando: isoServer(p.createdAt)! })),
    ...negociosComVendedor.filter((n) => n.status === "ganho" && n.ganhoAt).map((n) => ({ id: `venda-${n.id}`, tipo: "venda", titulo: `Negócio ganho: ${n.titulo}`, subtitulo: n.vendedorNome, quando: isoServer(n.ganhoAt)! })),
    ...contratosDoServico.map((ct) => ({ id: `contrato-${ct.id}`, tipo: "contrato", titulo: `Contrato ${ct.tipo}`, subtitulo: ct.status, quando: isoServer(ct.createdAt)! })),
    ...faturasPagas.map((f) => ({ id: `pagamento-${f.id}`, tipo: "pagamento", titulo: `Pagamento ${brlServer(f.valor)}`, subtitulo: null, quando: isoServer(f.paga_em)! })),
    ...tarefasConcluidas.map((t) => ({ id: `tarefa-${t.id}`, tipo: "tarefa", titulo: t.titulo, subtitulo: null, quando: isoServer(t.concluidaEm)! })),
    ...fulfillmentsPorServico.flatMap((f) => {
      const eventos: EventoTimeline[] = [];
      if (f.startedAt) eventos.push({ id: `entrega-inicio-${f.id}`, tipo: "implantacao", titulo: "Entrega/onboarding iniciado", subtitulo: f.serviceFamily, quando: isoServer(f.startedAt)! });
      if (f.completedAt) eventos.push({ id: `entrega-fim-${f.id}`, tipo: "implantacao", titulo: "Entrega/onboarding concluído", subtitulo: f.serviceFamily, quando: isoServer(f.completedAt)! });
      return eventos;
    }),
  ].sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime());

  // Card "Origem e Aquisição" (item 4 desta rodada, 20/08): lead de origem =
  // lead vinculado ao PRIMEIRO negócio GANHO desta empresa (sinal comercial
  // real de qual contato originou a venda); sem negócio ganho com lead
  // direto, cai pro lead mais antigo vinculado à empresa. Sem nenhum lead,
  // não fabrica nada. Campos que o schema não tem (ex: nome legível de
  // conjunto/criativo, só o ID da Meta) aparecem como ID real, nunca texto
  // inventado; UTM ausente aparece "—" no frontend.
  const [primeiroGanhoComLead] = await db.select({ leadId: negocios.leadId })
    .from(negocios)
    .where(and(eq(negocios.empresaId, empresaId), eq(negocios.status, "ganho"), isNotNull(negocios.leadId)))
    .orderBy(asc(negocios.ganhoAt), asc(negocios.createdAt))
    .limit(1);

  let leadOrigemId: string | null = primeiroGanhoComLead?.leadId ?? null;
  if (!leadOrigemId) {
    const [leadMaisAntigo] = await db.select({ id: leads.id }).from(leads).where(eq(leads.empresaId, empresaId)).orderBy(asc(leads.createdAt)).limit(1);
    leadOrigemId = leadMaisAntigo?.id ?? null;
  }

  // Oportunidade que originou o cliente — vínculo PERSISTIDO
  // (`clientes.oportunidade_origem_id`, preenchido pelo backfill do domain
  // model). Sem isso o card respondia "de qual campanha veio" mas não
  // "quanto essa venda valeu", que é a metade da pergunta que interessa.
  // Fallback silencioso pro cálculo por empresa acima quando o vínculo ainda
  // não existe (cliente sem nenhum negócio ganho no legado) — nunca fabrica.
  const [oportunidadeOrigem] = await db
    .select({ id: oportunidades.id, valor: oportunidades.valor, mrr: oportunidades.mrr, ganhoAt: oportunidades.ganhoAt, negocioIdLegado: oportunidades.negocioIdLegado })
    .from(clientes)
    .innerJoin(oportunidades, eq(oportunidades.id, clientes.oportunidadeOrigemId))
    .where(and(eq(clientes.empresaId, empresaId), eq(clientes.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  let origemAquisicao: {
    origem: string | null; campanha: string | null; conjunto: string | null; criativo: string | null;
    utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; landingPage: string | null;
    firstTouch: string; lastTouch: string | null;
    vendaOrigem: { negocioId: string | null; valor: string | null; mrr: string | null; ganhoAt: string | null } | null;
  } | null = null;

  if (leadOrigemId) {
    const [leadOrigem] = await db.select({
      id: leads.id, origem: leads.origem, utmSource: leads.utmSource, utmMedium: leads.utmMedium,
      utmCampaign: leads.utmCampaign, metaAdsetId: leads.metaAdsetId, metaAdId: leads.metaAdId,
      landingPage: leads.landingPage, createdAt: leads.createdAt,
    }).from(leads).where(eq(leads.id, leadOrigemId)).limit(1);

    if (leadOrigem) {
      const [ultimaAtividadeLeadOrigem] = await db.select({ createdAt: atividades.createdAt })
        .from(atividades).where(eq(atividades.leadId, leadOrigemId)).orderBy(desc(atividades.createdAt)).limit(1);

      origemAquisicao = {
        origem: leadOrigem.origem,
        campanha: leadOrigem.utmCampaign,
        // "Conjunto"/"criativo" da referência de UX não têm nome legível no
        // schema — só o ID real do ad set/anúncio da Meta (meta_adset_id /
        // meta_ad_id), populado pelo webhook meta-lead-ids quando disponível.
        conjunto: leadOrigem.metaAdsetId,
        criativo: leadOrigem.metaAdId,
        utmSource: leadOrigem.utmSource,
        utmMedium: leadOrigem.utmMedium,
        utmCampaign: leadOrigem.utmCampaign,
        landingPage: leadOrigem.landingPage,
        firstTouch: isoServer(leadOrigem.createdAt)!,
        lastTouch: isoServer(ultimaAtividadeLeadOrigem?.createdAt ?? null),
        // Fecha a pergunta inteira: campanha X gerou uma venda de R$ Y. O
        // negocioIdLegado é o que a UI já sabe abrir (`/negocios/:id`).
        vendaOrigem: oportunidadeOrigem
          ? {
              negocioId: oportunidadeOrigem.negocioIdLegado,
              valor: oportunidadeOrigem.valor,
              mrr: oportunidadeOrigem.mrr,
              ganhoAt: isoServer(oportunidadeOrigem.ganhoAt),
            }
          : null,
      };
    }
  }

  // Callface AI — fundação de integração external identity (20/08, ver
  // crm2-decisoes-pendentes.md item 9). As 4 tabelas nascem 100% vazias —
  // esta query só existe pra alimentar a seção "Integração Callface AI" da
  // aba Serviços quando/se a decisão de acesso ao SaaS for tomada e um job
  // de sync popular dado real. Hoje sempre retorna [], sem fabricar nada:
  // o frontend mostra o estado vazio explícito citando a decisão pendente.
  const servicoIdsCallfaceAi = servicos.filter((s) => s.serviceFamily === "CALLFACE_AI").map((s) => s.id);
  const callfaceAiIdentities = servicoIdsCallfaceAi.length > 0
    ? await db.select().from(callfaceAiExternalIdentities)
        .where(and(eq(callfaceAiExternalIdentities.entityType, "servico_canonico"), inArray(callfaceAiExternalIdentities.entityId, servicoIdsCallfaceAi)))
    : [];
  const callfaceAiIdentityPorServico = new Map(callfaceAiIdentities.map((i) => [i.entityId, i]));

  return c.json({
    empresa,
    pessoas,
    servicos: servicos.map((s) => {
      const fulfillment = fulfillmentsPorServico.find((f) => f.servicoCanonicoId === s.id) || null;
      const progresso = fulfillment ? progressoPorFulfillmentId.get(fulfillment.id) ?? null : null;
      const assinatura = assinaturaPorServico.get(s.id)
        ?? (s.currentSubscriptionId ? assinaturaPorStripe.get(s.currentSubscriptionId) : undefined)
        ?? (s.contratoId ? assinaturaPorServicoContrato.get(s.contratoId) : undefined);
      const stripeBillingStatus = assinatura?.billingStatus || assinatura?.status || null;
      const ledger = ledgerPorServico.get(s.id);
      const callfaceAiIntegracao = s.serviceFamily === "CALLFACE_AI" ? (() => {
        const identidade = callfaceAiIdentityPorServico.get(s.id) ?? null;
        return identidade
          ? { conectado: true as const, organizationId: identidade.externalId, confidence: identidade.confidence, source: identidade.source, verifiedAt: isoServer(identidade.verifiedAt) }
          : { conectado: false as const, organizationId: null, confidence: null, source: null, verifiedAt: null };
      })() : null;
      return {
        ...s,
        stripeSubscriptionId: assinatura?.stripeSubscriptionId ?? s.currentSubscriptionId ?? null,
        billingSource: stripeBillingStatus ? "STRIPE" : s.billingSource,
        billingStatus: stripeBillingStatus || s.billingStatus,
        ledger: ledger
          ? {
              latestCompetence: ledger.competence,
              billedValue: ledger.billed_value,
              entries: ledger.entries,
              sourceFile: ledger.source_file,
            }
          : null,
        callfaceAiIntegracao,
        fulfillment: fulfillment
          ? { id: fulfillment.id, status: fulfillment.status, totalItens: progresso?.totalItens ?? 0, itensConcluidos: progresso?.itensConcluidos ?? 0 }
          : null,
        contrato: contratosDoServico.find((ct) => ct.id === s.contratoId) || null,
      };
    }),
    currentMrr,
    timeline,
    clienteDesde: clienteInfo?.clienteDesde ?? null,
    statusFinanceiro: clienteInfo?.statusFinanceiro ?? null,
    responsavel: responsavel ?? null,
    executivo,
    faturasAtrasadas: faturasAtrasadasRow?.n ?? 0,
    faturasAbertas: faturasAbertasRow?.n ?? 0,
    faturasAbertasValor: faturasAbertasRow?.valor ?? "0",
    proximaFatura: proximaFatura ?? null,
    propostas: propostasCliente,
    proximasAcoes,
    atividadesRecentes,
    mrrMensal,
    receitaMensalProdutos,
    negocios: negociosComVendedor,
    timelineEventos,
    origemAquisicao,
    // Achado real 24/08: usava `contratosDoServico` (só contratos vindos de
    // servico_canonico) enquanto `contratoIds` abaixo já tinha sido corrigido
    // pra união completa — Documentos/Contratos ficavam sem achar PDF de
    // contrato legado anexado no NEGÓCIO (não no contrato) sempre que esse
    // contrato não vinha de um serviço. Mesma fonte agora nos dois.
    negocioIds: [...new Set(contratosParaResposta.map((ct) => ct.negocioId).filter((id): id is string => !!id))],
    // Union de TODOS os contratos da empresa (servico_canonico + lead/negócio
    // resolvidos, ver bloco acima) — não só os que vieram via serviço. Alimenta
    // tanto a aba Contratos nova quanto o fetch de anexos_legado tipo=contrato
    // da aba Documentos (mesma chamada de sempre, agora com a lista completa).
    contratoIds: contratosParaResposta.map((c) => c.id),
    contratos: contratosParaResposta,
    contratoVencendoEmBreve: contratoMaisUrgente,
  });
});

// GET /clientes-crm2/pessoa/:personId/atividades — histórico por identidade.
// Aceita tanto o id canônico de pessoas quanto o leadId legado, preservando
// links antigos enquanto a UI migra para Pessoa. A atividade continua sendo
// lida da tabela real `atividades`, agrupando os leads ligados à mesma Pessoa
// por `pontos_contato`/`lead_id_legado`.
app.get("/clientes-crm2/pessoa/:personId/atividades", async (c) => {
  const ctx = await getCtx(c);
  const personId = c.req.param("personId");
  if (!UUID_RE.test(personId)) return c.json({ error: "ID inválido" }, 400);

  const [pessoa] = await db.select({ id: pessoasTable.id, nome: pessoasTable.nome, leadIdLegado: pessoasTable.leadIdLegado })
    .from(pessoasTable).where(and(eq(pessoasTable.id, personId), eq(pessoasTable.organizacaoId, ctx.organizacaoId))).limit(1);
  const [leadDireto] = pessoa
    ? []
    : await db.select({ id: leads.id, nome: leads.nome, empresaId: leads.empresaId })
      .from(leads).where(and(eq(leads.id, personId), eq(leads.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!pessoa && !leadDireto) return c.json({ error: "Pessoa não encontrada" }, 404);

  const pontosDaPessoa = pessoa
    ? await db.select({ leadIdLegado: pontosContato.leadIdLegado })
        .from(pontosContato)
        .where(and(eq(pontosContato.organizacaoId, ctx.organizacaoId), eq(pontosContato.pessoaId, pessoa.id)))
    : [];
  const pessoaLeadIds = [...new Set([
    pessoa?.leadIdLegado,
    ...pontosDaPessoa.map((ponto) => ponto.leadIdLegado),
    leadDireto?.id,
  ].filter((id): id is string => !!id))];
  const pessoaLeads = pessoaLeadIds.length > 0
    ? await db.select({ id: leads.id, nome: leads.nome, empresaId: leads.empresaId })
        .from(leads).where(and(eq(leads.organizacaoId, ctx.organizacaoId), inArray(leads.id, pessoaLeadIds)))
    : [];
  const nomePessoa = pessoa?.nome ?? pessoaLeads[0]?.nome ?? leadDireto?.nome ?? "Pessoa";

  const atividadesPessoa = await db.select({
    id: atividades.id, tipo: atividades.tipo, titulo: atividades.titulo, descricao: atividades.descricao,
    createdAt: atividades.createdAt, autorNome: usuarios.nome, duracaoSegundos: atividades.duracaoSegundos,
  })
    .from(atividades)
    .leftJoin(usuarios, eq(usuarios.id, atividades.usuarioId))
    .where(and(eq(atividades.organizacaoId, ctx.organizacaoId), pessoaLeadIds.length > 0 ? inArray(atividades.leadId, pessoaLeadIds) : sql`false`))
    .orderBy(desc(atividades.createdAt))
    .limit(200);

  return c.json({ leadId: pessoaLeadIds[0] ?? null, pessoaId: pessoa?.id ?? null, pessoaNome: nomePessoa, atividades: atividadesPessoa });
});

export const clientesCrm2Routes = app;
