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
  empresas, servicosCanonicos, contratos, leads, fulfillments, notas, usuarios,
  clientes, faturas, assinaturas, propostas, tarefas, mrrMovimentos, atividades,
} from "@/lib/db/schema";
import { eq, and, inArray, sql, desc, asc } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { registrarMudancaResponsavel } from "@/lib/crm/owner";

const app = new Hono();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      (SELECT COALESCE(jsonb_object_agg(familia, n), '{}'::jsonb) FROM familias) AS familias
  `);

  return c.json({
    clientesAtivos: row?.clientes_ativos ?? 0,
    servicosAtivos: row?.servicos_ativos ?? 0,
    mrrTotal: row?.mrr_total ?? "0",
    emRisco: row?.em_risco ?? 0,
    mrrDelta30d: row?.mrr_delta_30d ?? "0",
    clientesNovos30d: row?.clientes_novos_30d ?? 0,
    familias: row?.familias ?? {},
  });
});

// GET /clientes-crm2 — Carteira: Empresas com pelo menos 1 serviço no
// portfólio (current MRR real, nunca contrato/oportunidade).
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

  const [totalRow] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(DISTINCT e.id)::int AS n
    FROM empresas e
    JOIN servicos_canonicos sc ON sc.empresa_id = e.id AND sc.portfolio_included = true
    LEFT JOIN clientes cli ON cli.empresa_id = e.id
    WHERE e.organizacao_id = ${ctx.organizacaoId} ${filtroBusca} ${filtroFamilia} ${filtroStatus} ${filtroOwner}
  `);

  const rows = await db.execute(sql`
    WITH servicos_agg AS (
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
    )
    SELECT e.id, e.nome, e.setor,
      COALESCE(sa.total_servicos, 0) AS total_servicos,
      COALESCE(sa.current_mrr, 0) AS current_mrr,
      COALESCE(sa.familias, '[]'::jsonb) AS familias,
      COALESCE(fa.entregas_em_andamento, 0) AS entregas_em_andamento,
      COALESCE(fat.n_atrasadas, 0) AS faturas_atrasadas,
      fat.venceu_em AS fatura_venceu_em,
      COALESCE(cli.status_financeiro, 'indefinido') AS status_financeiro,
      -- Lifecycle real (distinto de status financeiro — nunca confundir
      -- billing com lifecycle, invariante fechada da arquitetura CRM2).
      -- Literal 'cliente' é honesto aqui: o WHERE já garante portfolio_included
      -- = true, ou seja, toda linha desta query É um cliente ativo por definição.
      'cliente' AS lifecycle,
      ua.tipo AS ultima_atividade_tipo,
      ua.ultima AS ultima_atividade_em,
      cli.responsavel_id AS cs_owner_id,
      uo.nome AS cs_owner_nome,
      -- Risco por linha (18/08) — testei um nível "médio" baseado em >14/30/
      -- 60/90 dias sem atividade real e descartei: mesmo a 90 dias, 194 dos
      -- 273 clientes ativos (71%) caem nele, porque a tabela atividades registra
      -- comportamento de vendas (ligação/nota/whatsapp), não cadência de
      -- pós-venda — não é um sinal que discrimina, é ruído travestido de
      -- 3 níveis. Fica binário com o único sinal real e diferenciante que
      -- existe hoje: fatura atrasada (13/273 clientes, verificado no banco).
      CASE WHEN COALESCE(fat.n_atrasadas, 0) > 0 THEN 'alto' ELSE 'baixo' END AS risco
    FROM empresas e
    JOIN servicos_agg sa ON sa.empresa_id = e.id
    LEFT JOIN fulfillment_agg fa ON fa.empresa_id = e.id
    LEFT JOIN faturas_agg fat ON fat.empresa_id = e.id
    LEFT JOIN clientes cli ON cli.empresa_id = e.id
    LEFT JOIN usuarios uo ON uo.id = cli.responsavel_id
    LEFT JOIN ultima_atividade_agg ua ON ua.empresa_id = e.id
    WHERE e.organizacao_id = ${ctx.organizacaoId} ${filtroBusca} ${filtroFamilia} ${filtroStatus} ${filtroOwner}
    ORDER BY current_mrr DESC
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

// GET /clientes-crm2/sucesso — fila de CS. Prioridade real do time (não
// Health Score inventado): recovery/cobrança visível + ausência de próxima
// ação. Motivo é sempre explicado em texto, nunca um score opaco.
app.get("/clientes-crm2/sucesso", async (c) => {
  const ctx = await getCtx(c);

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
    )
    SELECT e.id, e.nome,
      COALESCE(fa.n, 0) AS faturas_atrasadas, COALESCE(fa.valor, 0) AS valor_atrasado,
      ua.ultima AS ultima_atividade,
      EXTRACT(DAY FROM now() - ua.ultima)::int AS dias_sem_atividade,
      (pt.proxima IS NULL) AS sem_proxima_acao
    FROM empresas e
    JOIN clientes_ativos ca ON ca.empresa_id = e.id
    LEFT JOIN faturas_atrasadas fa ON fa.empresa_id = e.id
    LEFT JOIN ultima_atividade_agg ua ON ua.empresa_id = e.id
    LEFT JOIN proxima_tarefa_agg pt ON pt.empresa_id = e.id
    WHERE e.organizacao_id = ${ctx.organizacaoId}
      AND (fa.n > 0 OR pt.proxima IS NULL OR ua.ultima IS NULL OR ua.ultima < now() - interval '14 days')
    ORDER BY COALESCE(fa.valor, 0) DESC, dias_sem_atividade DESC NULLS LAST
    LIMIT 100
  `);

  return c.json({ contas: rows });
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

  const contratoIds = servicos.map((s) => s.contratoId).filter((id): id is string => !!id);
  const contratosDoServico = contratoIds.length > 0
    ? await db.select().from(contratos).where(inArray(contratos.id, contratoIds))
    : [];

  // Pessoas vinculadas (mesma resolução da Timeline agregada de empresas.ts)
  const pessoas = await db.select({ id: leads.id, nome: leads.nome, cargo: leads.cargo, email: leads.email, tipo: leads.tipo }).from(leads).where(eq(leads.empresaId, empresaId));
  const leadIds = pessoas.map((p) => p.id);

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
    ? await db.select({ id: usuarios.id, nome: usuarios.nome }).from(usuarios).where(eq(usuarios.id, clienteInfo.responsavelId)).limit(1)
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

  // Últimas atividades reais (18/08, referência de UX do drawer da
  // Carteira) — mesma fonte de `atividades` via leadIds já resolvidos
  // acima, nunca uma segunda query pra achar os leads da empresa.
  const atividadesRecentes = leadIds.length > 0
    ? await db.select({ id: atividades.id, tipo: atividades.tipo, titulo: atividades.titulo, createdAt: atividades.createdAt, autorNome: usuarios.nome, pessoaNome: leads.nome })
        .from(atividades)
        .leftJoin(usuarios, eq(usuarios.id, atividades.usuarioId))
        .innerJoin(leads, eq(leads.id, atividades.leadId))
        .where(inArray(atividades.leadId, leadIds))
        .orderBy(desc(atividades.createdAt))
        .limit(8)
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

  // Desempenho — MRR mensal real (mrr_movimentos), NÃO Health Score (regra
  // fechada: nunca inventar essa métrica). Hoje o ledger só cobre produto
  // AI (PABX ainda não flui por Stripe-sync) — cliente PABX-only aparece
  // sem série, honesto, não fabricado.
  const movimentos = leadIds.length > 0
    ? await db.select({ ocorridoEm: mrrMovimentos.ocorridoEm, mrrDepois: mrrMovimentos.mrrDepois })
        .from(mrrMovimentos).where(inArray(mrrMovimentos.leadId, leadIds)).orderBy(asc(mrrMovimentos.ocorridoEm))
    : [];
  const mrrPorMes = new Map<string, number>();
  for (const m of movimentos) {
    const mes = new Date(m.ocorridoEm).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    mrrPorMes.set(mes, parseFloat(m.mrrDepois));
  }
  const mrrMensal = Array.from(mrrPorMes.entries()).map(([mes, valor]) => ({ mes, valor }));

  return c.json({
    empresa,
    pessoas,
    servicos: servicos.map((s) => ({
      ...s,
      fulfillment: fulfillmentsPorServico.find((f) => f.servicoCanonicoId === s.id) || null,
      contrato: contratosDoServico.find((ct) => ct.id === s.contratoId) || null,
    })),
    currentMrr,
    timeline,
    clienteDesde: clienteInfo?.clienteDesde ?? null,
    statusFinanceiro: clienteInfo?.statusFinanceiro ?? null,
    responsavel: responsavel ?? null,
    faturasAtrasadas: faturasAtrasadasRow?.n ?? 0,
    proximaFatura: proximaFatura ?? null,
    propostas: propostasCliente,
    proximasAcoes,
    atividadesRecentes,
    mrrMensal,
    negocioIds: [...new Set(contratosDoServico.map((ct) => ct.negocioId).filter((id): id is string => !!id))],
    contratoIds,
  });
});

export const clientesCrm2Routes = app;
