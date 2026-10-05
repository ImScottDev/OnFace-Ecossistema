import { Hono } from "hono";
import { db } from "@/lib/db";
import { empresas, leads } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCtx } from "../compat.js";
import { registrarMudancaResponsavel } from "@/lib/crm/owner";

/**
 * Filtros de STATUS (18/08, arquitetura Pessoa/Empresa do Kauã) — nunca
 * "tipo" como identidade, sempre estado derivado ao vivo. "Ex-cliente" é
 * sinal REAL (achado 18/08): tipo='cliente' + tem contrato histórico + SEM
 * contrato ativo (55 de 256 clientes reais se encaixam). Sem contrato
 * nenhum vinculado não é tratado como ex-cliente (sem evidência de churn,
 * só ausência de dado) — fica em "clientes" por padrão.
 */
const PESSOA_NEGOCIO_ATIVO = sql`EXISTS (SELECT 1 FROM negocios n2 WHERE n2.lead_id = l.id AND n2.status NOT IN ('ganho', 'perdido'))`;
const PESSOA_CONTRATO_ATIVO = sql`EXISTS (SELECT 1 FROM contratos ct WHERE ct.lead_id = l.id AND ct.status = 'ativo')`;
const PESSOA_CONTRATO_HISTORICO = sql`EXISTS (SELECT 1 FROM contratos ct WHERE ct.lead_id = l.id)`;
const PESSOA_EX_CLIENTE = sql`(l.tipo = 'cliente' AND ${PESSOA_CONTRATO_HISTORICO} AND NOT ${PESSOA_CONTRATO_ATIVO})`;

function filtroStatusPessoa(status: string) {
  switch (status) {
    case "leads":
      return sql`AND l.tipo = 'lead' AND NOT ${PESSOA_NEGOCIO_ATIVO} AND l.sdr_status NOT IN ('contacted', 'qualifying')`;
    case "qualificacao":
      return sql`AND l.tipo = 'lead' AND NOT ${PESSOA_NEGOCIO_ATIVO} AND l.sdr_status IN ('contacted', 'qualifying')`;
    case "oportunidade":
      return sql`AND l.tipo != 'cliente' AND ${PESSOA_NEGOCIO_ATIVO}`;
    case "clientes":
      return sql`AND l.tipo = 'cliente' AND NOT ${PESSOA_EX_CLIENTE}`;
    case "ex_clientes":
      return sql`AND ${PESSOA_EX_CLIENTE}`;
    default:
      return sql``;
  }
}

// Mesma lógica, agregada por empresa (bool_or sobre as pessoas vinculadas) — ver PESSOA_* acima.
const EMPRESA_TEM_CLIENTE_ATIVO = sql`EXISTS (SELECT 1 FROM leads l3 WHERE l3.empresa_id = e.id AND l3.tipo = 'cliente' AND NOT (EXISTS (SELECT 1 FROM contratos ct3 WHERE ct3.lead_id = l3.id) AND NOT EXISTS (SELECT 1 FROM contratos ct4 WHERE ct4.lead_id = l3.id AND ct4.status = 'ativo')))`;
const EMPRESA_TEM_EX_CLIENTE = sql`EXISTS (SELECT 1 FROM leads l3 WHERE l3.empresa_id = e.id AND l3.tipo = 'cliente' AND EXISTS (SELECT 1 FROM contratos ct3 WHERE ct3.lead_id = l3.id) AND NOT EXISTS (SELECT 1 FROM contratos ct4 WHERE ct4.lead_id = l3.id AND ct4.status = 'ativo'))`;
const EMPRESA_TEM_OPORTUNIDADE = sql`EXISTS (SELECT 1 FROM leads l3 WHERE l3.empresa_id = e.id AND EXISTS (SELECT 1 FROM negocios n3 WHERE n3.lead_id = l3.id AND n3.status NOT IN ('ganho', 'perdido')))`;

function filtroStatusEmpresa(status: string) {
  switch (status) {
    case "clientes":
      return sql`AND ${EMPRESA_TEM_CLIENTE_ATIVO}`;
    case "ex_clientes":
      return sql`AND ${EMPRESA_TEM_EX_CLIENTE} AND NOT ${EMPRESA_TEM_CLIENTE_ATIVO}`;
    case "com_oportunidade":
      return sql`AND NOT ${EMPRESA_TEM_CLIENTE_ATIVO} AND ${EMPRESA_TEM_OPORTUNIDADE}`;
    case "prospects":
      return sql`AND NOT ${EMPRESA_TEM_CLIENTE_ATIVO} AND NOT ${EMPRESA_TEM_OPORTUNIDADE}`;
    default:
      return sql``;
  }
}

const app = new Hono();

/**
 * Contatos & Empresas (CRM 2.0). Diretório compartilhado da organização —
 * mesmo escopo de visibilidade do `/contatos` e `/empresas` legados (não é
 * inbox pessoal como Atendimento, não filtra por responsável).
 *
 * "Relacionamento" (Cliente/Qualificado/Lead) não existe como campo no
 * schema — regra aplicada aqui:
 * Cliente se a empresa tem qualquer pessoa com leads.tipo='cliente';
 * Qualificado se tem negócio ativo (status fora de ganho/perdido) vinculado;
 * Lead nos demais casos. Ajustar se o Kauã definir outra regra.
 *
 * Negócio por empresa soma negocios.empresaId OU (quando nulo) o empresaId
 * do lead vinculado via negocios.leadId — achado real: 23% dos negócios não
 * têm empresaId preenchido mas 100% têm leadId, então sem esse fallback a
 * contagem subestima.
 */

// ─── GET /contatos-crm2/kpis ─────────────────────────────────────────
app.get("/contatos-crm2/kpis", async (c) => {
  const ctx = await getCtx(c);
  const [row] = await db.execute<{
    total_pessoas: number; leads: number; contatos: number; clientes: number;
  }>(sql`
    SELECT
      COUNT(*)::int AS total_pessoas,
      COUNT(*) FILTER (WHERE tipo = 'lead')::int AS leads,
      COUNT(*) FILTER (WHERE tipo = 'contato')::int AS contatos,
      COUNT(*) FILTER (WHERE tipo = 'cliente')::int AS clientes
    FROM leads
    WHERE organizacao_id = ${ctx.organizacaoId}
  `);
  const [empresasRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(empresas)
    .where(eq(empresas.organizacaoId, ctx.organizacaoId));

  return c.json({
    totalPessoas: Number(row?.total_pessoas ?? 0),
    leads: Number(row?.leads ?? 0),
    contatos: Number(row?.contatos ?? 0),
    clientes: Number(row?.clientes ?? 0),
    empresas: Number(empresasRow?.n ?? 0),
  });
});

// ─── GET /contatos-crm2/empresas ──────────────────────────────────────
app.get("/contatos-crm2/empresas", async (c) => {
  const ctx = await getCtx(c);
  const search = (c.req.query("search") ?? "").trim();
  const status = c.req.query("status") ?? "";
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);
  const offset = (page - 1) * limit;
  const buscaLike = `%${search}%`;

  const filtroBusca = search ? sql`AND e.nome ILIKE ${buscaLike}` : sql``;
  const filtroStatus = filtroStatusEmpresa(status);

  const [totalRow] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM empresas e WHERE e.organizacao_id = ${ctx.organizacaoId} ${filtroBusca} ${filtroStatus}
  `);

  const rows = await db.execute(sql`
    WITH negocio_empresa AS (
      SELECT n.id, COALESCE(n.empresa_id, l.empresa_id) AS empresa_id, n.valor_total
      FROM negocios n
      LEFT JOIN leads l ON l.id = n.lead_id
      WHERE n.organizacao_id = ${ctx.organizacaoId}
    ),
    negocios_agg AS (
      SELECT empresa_id, COUNT(*)::int AS negocios, COALESCE(SUM(valor_total), 0) AS valor
      FROM negocio_empresa
      WHERE empresa_id IS NOT NULL
      GROUP BY empresa_id
    ),
    pessoas_agg AS (
      SELECT empresa_id, COUNT(*)::int AS pessoas
      FROM leads
      WHERE organizacao_id = ${ctx.organizacaoId} AND empresa_id IS NOT NULL
      GROUP BY empresa_id
    ),
    relacionamento_base AS (
      SELECT l.empresa_id, l.tipo,
        EXISTS(SELECT 1 FROM negocios n2 WHERE n2.lead_id = l.id AND n2.status NOT IN ('ganho', 'perdido')) AS negocio_ativo,
        (l.tipo = 'cliente' AND EXISTS (SELECT 1 FROM contratos ct WHERE ct.lead_id = l.id) AND NOT EXISTS (SELECT 1 FROM contratos ct2 WHERE ct2.lead_id = l.id AND ct2.status = 'ativo')) AS ex_cliente
      FROM leads l
      WHERE l.organizacao_id = ${ctx.organizacaoId} AND l.empresa_id IS NOT NULL
    ),
    relacionamento_agg AS (
      SELECT empresa_id,
        CASE
          WHEN bool_or(tipo = 'cliente' AND NOT ex_cliente) THEN 'cliente'
          WHEN bool_or(ex_cliente) AND NOT bool_or(tipo = 'cliente' AND NOT ex_cliente) THEN 'ex_cliente'
          WHEN bool_or(negocio_ativo) THEN 'qualificado'
          ELSE 'lead'
        END AS relacionamento
      FROM relacionamento_base
      GROUP BY empresa_id
    ),
    ultima_atividade_agg AS (
      SELECT l.empresa_id, MAX(a.created_at) AS ultima
      FROM atividades a
      JOIN leads l ON l.id = a.lead_id
      WHERE l.organizacao_id = ${ctx.organizacaoId} AND l.empresa_id IS NOT NULL
      GROUP BY l.empresa_id
    ),
    responsavel_agg AS (
      SELECT DISTINCT ON (l.empresa_id) l.empresa_id, u.nome AS responsavel_nome
      FROM leads l
      LEFT JOIN usuarios u ON u.id = l.responsavel_id
      WHERE l.organizacao_id = ${ctx.organizacaoId} AND l.empresa_id IS NOT NULL
      ORDER BY l.empresa_id, l.updated_at DESC
    )
    SELECT
      e.id, e.nome, e.setor,
      COALESCE(pa.pessoas, 0)::int AS pessoas,
      COALESCE(ra.relacionamento, 'lead') AS relacionamento,
      COALESCE(na.negocios, 0)::int AS negocios,
      COALESCE(na.valor, 0) AS valor,
      resp.responsavel_nome,
      ua.ultima AS ultima_atividade
    FROM empresas e
    LEFT JOIN pessoas_agg pa ON pa.empresa_id = e.id
    LEFT JOIN negocios_agg na ON na.empresa_id = e.id
    LEFT JOIN relacionamento_agg ra ON ra.empresa_id = e.id
    LEFT JOIN ultima_atividade_agg ua ON ua.empresa_id = e.id
    LEFT JOIN responsavel_agg resp ON resp.empresa_id = e.id
    WHERE e.organizacao_id = ${ctx.organizacaoId} ${filtroBusca} ${filtroStatus}
    ORDER BY ua.ultima DESC NULLS LAST, e.nome ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return c.json({ empresas: rows, total: Number(totalRow?.n ?? 0), page, totalPages: Math.ceil(Number(totalRow?.n ?? 0) / limit) });
});

// ─── GET /contatos-crm2/pessoas ───────────────────────────────────────
app.get("/contatos-crm2/pessoas", async (c) => {
  const ctx = await getCtx(c);
  const search = (c.req.query("search") ?? "").trim();
  const status = c.req.query("status") ?? "";
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);
  const offset = (page - 1) * limit;
  const buscaLike = `%${search}%`;

  const filtroTipo = filtroStatusPessoa(status);
  const filtroBusca = search
    ? sql`AND (l.nome ILIKE ${buscaLike} OR l.email ILIKE ${buscaLike} OR COALESCE(e.nome, l.empresa) ILIKE ${buscaLike})`
    : sql``;

  const [totalRow] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n
    FROM leads l
    LEFT JOIN empresas e ON e.id = l.empresa_id
    WHERE l.organizacao_id = ${ctx.organizacaoId} ${filtroTipo} ${filtroBusca}
  `);

  const rows = await db.execute(sql`
    WITH negocio_lead AS (
      SELECT lead_id, COUNT(*)::int AS negocios, COALESCE(SUM(valor_total), 0) AS valor
      FROM negocios
      WHERE organizacao_id = ${ctx.organizacaoId} AND lead_id IS NOT NULL
      GROUP BY lead_id
    ),
    ultima_interacao_agg AS (
      SELECT lead_id, MAX(created_at) AS ultima
      FROM atividades
      WHERE organizacao_id = ${ctx.organizacaoId}
      GROUP BY lead_id
    ),
    proxima_atividade_agg AS (
      SELECT lead_id, MIN(data_vencimento) AS proxima
      FROM tarefas
      WHERE organizacao_id = ${ctx.organizacaoId} AND concluida = false AND data_vencimento IS NOT NULL
      GROUP BY lead_id
    )
    SELECT
      l.id, l.nome, l.email, l.cargo, l.tipo,
      CASE
        WHEN l.tipo = 'cliente' AND EXISTS (SELECT 1 FROM contratos ct WHERE ct.lead_id = l.id) AND NOT EXISTS (SELECT 1 FROM contratos ct2 WHERE ct2.lead_id = l.id AND ct2.status = 'ativo') THEN 'ex_cliente'
        WHEN l.tipo = 'cliente' THEN 'cliente'
        WHEN l.tipo != 'cliente' AND EXISTS (SELECT 1 FROM negocios n2 WHERE n2.lead_id = l.id AND n2.status NOT IN ('ganho', 'perdido')) THEN 'oportunidade'
        WHEN l.tipo = 'lead' AND l.sdr_status IN ('contacted', 'qualifying') THEN 'qualificacao'
        WHEN l.tipo = 'lead' THEN 'leads'
        ELSE 'contato'
      END AS status_comercial,
      COALESCE(e.nome, l.empresa) AS empresa_nome,
      e.id AS empresa_id,
      u.nome AS responsavel_nome,
      COALESCE(nl.negocios, 0)::int AS negocios,
      COALESCE(nl.valor, 0) AS negocio_valor,
      ui.ultima AS ultima_interacao,
      pa.proxima AS proxima_atividade
    FROM leads l
    LEFT JOIN empresas e ON e.id = l.empresa_id
    LEFT JOIN usuarios u ON u.id = l.responsavel_id
    LEFT JOIN negocio_lead nl ON nl.lead_id = l.id
    LEFT JOIN ultima_interacao_agg ui ON ui.lead_id = l.id
    LEFT JOIN proxima_atividade_agg pa ON pa.lead_id = l.id
    WHERE l.organizacao_id = ${ctx.organizacaoId} ${filtroTipo} ${filtroBusca}
    ORDER BY ui.ultima DESC NULLS LAST, l.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return c.json({ pessoas: rows, total: Number(totalRow?.n ?? 0), page, totalPages: Math.ceil(Number(totalRow?.n ?? 0) / limit) });
});

// ─── PUT /contatos-crm2/pessoas/:id/responsavel — ação em massa (atribuir) ──
app.put("/contatos-crm2/pessoas/:id/responsavel", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  if (!body.responsavelId) return c.json({ error: "responsavelId obrigatório" }, 400);

  const [antes] = await db.select({ responsavelId: leads.responsavelId }).from(leads).where(eq(leads.id, id)).limit(1);

  const [lead] = await db.update(leads)
    .set({ responsavelId: body.responsavelId, updatedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.organizacaoId, ctx.organizacaoId)))
    .returning({ id: leads.id, responsavelId: leads.responsavelId });
  if (!lead) return c.json({ error: "Não encontrado" }, 404);

  await registrarMudancaResponsavel({
    organizacaoId: ctx.organizacaoId,
    entityType: "lead",
    entityId: id,
    previousOwnerId: antes?.responsavelId ?? null,
    newOwnerId: body.responsavelId,
    actorId: ctx.userId,
  });

  return c.json({ lead });
});

export const contatosCrm2Routes = app;
