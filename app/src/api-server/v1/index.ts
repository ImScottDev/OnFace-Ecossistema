/**
 * Superfície canônica da API pública, versionada (SPEC §23, §30.2).
 *
 * A regra estrutural, na frase do SPEC: *no public endpoint maps directly to
 * generic table CRUD*. Nenhuma rota aqui expõe tabela. Elas expõem os RECURSOS
 * do modelo canônico, com os nomes do domínio, e leem pelas consultas
 * canônicas.
 *
 * Isso importa porque a API pública é contrato: uma vez que alguém integrou
 * contra `/api/v1/opportunities`, a forma da resposta vira compromisso. Expor
 * tabela seria transformar cada refactor interno em quebra de integração — e
 * este refactor inteiro existe porque o modelo interno estava errado.
 *
 * Todo pedido passa por: autenticação, tenant do token, escopo, consulta de
 * domínio, resposta. Nessa ordem.
 */
import { doCrm } from "@/lib/financeiro/espelho-crm";
import { Hono } from "hono";
import type { Context } from "hono";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { condicaoComunicacaoNaoPrivada } from "@/lib/whatsapp/acesso";
import { autenticarApi, temEscopo, registrarUso, type AtorApi } from "./autenticacao";
import type { CodigoPermissao } from "@/lib/auth/permissoes";
import { boardDeAquisicoes } from "@onface/acquisition";

const app = new Hono();

/** Paginação com teto: pedido sem limite é o caminho para derrubar o banco. */
function paginacao(c: Context): { limite: number; offset: number } {
  const limite = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 200);
  const pagina = Math.max(Number(c.req.query("page") ?? 1), 1);
  return { limite, offset: (pagina - 1) * limite };
}

/**
 * Envolve o handler no pipeline inteiro.
 *
 * O escopo é exigido por rota, nunca por prefixo: um token de leitura de vendas
 * não deveria alcançar financeiro só porque as duas rotas vivem sob `/v1`.
 */
function rota(
  escopo: CodigoPermissao,
  handler: (c: Context, ator: AtorApi) => Promise<unknown>,
) {
  return async (c: Context) => {
    const auth = await autenticarApi(c);
    if (!auth.ok) return c.json({ error: auth.erro }, auth.status);

    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    if (!temEscopo(auth.ator, escopo)) {
      await registrarUso(auth.ator, c.req.method, c.req.path, 403, ip);
      return c.json({ error: `token sem o escopo necessário: ${escopo}` }, 403);
    }

    try {
      const dados = await handler(c, auth.ator);
      await registrarUso(auth.ator, c.req.method, c.req.path, 200, ip);
      return c.json(dados);
    } catch (e) {
      console.error(`[api/v1] ${c.req.method} ${c.req.path} falhou:`, e);
      await registrarUso(auth.ator, c.req.method, c.req.path, 500, ip);
      // A mensagem interna não sai: ela costuma conter nome de tabela e de
      // coluna, que é mapa de graça para quem estiver tentando.
      return c.json({ error: "erro interno" }, 500);
    }
  };
}

/** Descoberta: quem integra precisa saber o que existe sem ler o código. */
app.get("/v1", (c) => c.json({
  version: "v1",
  resources: [
    "/v1/companies", "/v1/people", "/v1/acquisitions", "/v1/opportunities",
    "/v1/proposals", "/v1/contracts", "/v1/invoices", "/v1/payments",
    "/v1/communications",
  ],
  auth: "Authorization: Bearer <token>",
}));

app.get("/v1/companies", rota("companies.read", async (c, ator) => {
  const { limite, offset } = paginacao(c);
  const busca = c.req.query("search")?.trim().toLowerCase() ?? null;
  const linhas = await db.execute<Record<string, unknown>>(sql`
    SELECT e.id::text, e.nome, e.cnpj, e.website, e.setor, e.created_at::text AS "createdAt",
           (SELECT count(*)::int FROM pessoas p WHERE p.empresa_id = e.id) AS "peopleCount"
      FROM empresas e
     WHERE e.organizacao_id = ${ator.organizacaoId}::uuid
       AND (${busca}::text IS NULL OR lower(e.nome) LIKE ${busca ? `%${busca}%` : null})
     ORDER BY e.nome LIMIT ${limite} OFFSET ${offset}`);
  return { data: linhas, page: { limit: limite, offset } };
}));

app.get("/v1/people", rota("companies.read", async (c, ator) => {
  const { limite, offset } = paginacao(c);
  const linhas = await db.execute<Record<string, unknown>>(sql`
    SELECT p.id::text, NULLIF(trim((CASE WHEN COALESCE(trim(p.sobrenome),'')='' THEN trim(p.nome) WHEN lower(trim(p.sobrenome))=lower(trim(p.nome)) OR lower(trim(p.sobrenome)) LIKE lower(trim(p.nome))||' %' THEN trim(p.sobrenome) WHEN lower(trim(p.nome)) LIKE '% '||lower(trim(p.sobrenome)) THEN trim(p.nome) ELSE trim(p.nome)||' '||trim(p.sobrenome) END)), '') AS name,
           p.email, p.telefone AS phone, p.cargo AS "jobTitle",
           p.empresa_id::text AS "companyId", p.created_at::text AS "createdAt"
      FROM pessoas p
     WHERE p.organizacao_id = ${ator.organizacaoId}::uuid
     ORDER BY p.created_at DESC LIMIT ${limite} OFFSET ${offset}`);
  return { data: linhas, page: { limit: limite, offset } };
}));

app.get("/v1/acquisitions", rota("acquisition.read", async (c, ator) => {
  const { limite } = paginacao(c);
  // Consulta CANÔNICA, a mesma do board: a API pública e a tela não podem
  // contar histórias diferentes sobre o mesmo processo.
  const board = await boardDeAquisicoes(db as never, sql as never, ator.organizacaoId, {
    limite, incluirEncerradas: c.req.query("include_closed") === "true",
  });
  return {
    data: board.cards.map((a) => ({
      id: a.aquisicaoId, stage: a.etapa, source: a.origem, channel: a.canal,
      campaign: a.campanha, qualified: a.qualificado, unassigned: a.semDono,
      person: { id: a.pessoaId, name: a.pessoa, email: a.email, phone: a.telefone },
      company: { id: a.empresaId, name: a.empresa },
      owner: a.responsavel, createdAt: a.criadoEm, lastTouchAt: a.ultimoToque,
    })),
    totals: board.totaisPorEtapa,
  };
}));

app.get("/v1/opportunities", rota("sales.read", async (c, ator) => {
  const { limite, offset } = paginacao(c);
  const etapa = c.req.query("stage") ?? null;
  const linhas = await db.execute<Record<string, unknown>>(sql`
    SELECT o.id::text, o.titulo AS title, o.etapa AS stage, o.service_family AS "productFamily",
           o.valor::float AS amount, o.mrr::float AS mrr,
           o.empresa_id::text AS "companyId", o.pessoa_id::text AS "personId",
           (o.ganho_at IS NOT NULL) AS won, (o.perdido_at IS NOT NULL) AS lost,
           of.codigo AS offer, o.created_at::text AS "createdAt"
      FROM oportunidades o
      LEFT JOIN ofertas_comerciais of ON of.id = o.oferta_comercial_id
     WHERE o.organizacao_id = ${ator.organizacaoId}::uuid
       AND (${etapa}::text IS NULL OR o.etapa = ${etapa})
     ORDER BY o.updated_at DESC LIMIT ${limite} OFFSET ${offset}`);
  return { data: linhas, page: { limit: limite, offset } };
}));

app.get("/v1/proposals", rota("sales.read", async (c, ator) => {
  const { limite, offset } = paginacao(c);
  const linhas = await db.execute<Record<string, unknown>>(sql`
    SELECT p.id::text, p.numero AS number, p.versao AS version, p.status,
           p.total_geral::float AS total, p.oportunidade_id::text AS "opportunityId",
           p.enviada_em::text AS "sentAt", p.created_at::text AS "createdAt"
      FROM propostas p
     WHERE p.organizacao_id = ${ator.organizacaoId}::uuid
     ORDER BY p.created_at DESC LIMIT ${limite} OFFSET ${offset}`);
  return { data: linhas, page: { limit: limite, offset } };
}));

app.get("/v1/contracts", rota("sales.read", async (c, ator) => {
  const { limite, offset } = paginacao(c);
  const linhas = await db.execute<Record<string, unknown>>(sql`
    SELECT c.id::text, c.status, c.tipo AS type, c.mrr::float AS mrr,
           c.oportunidade_id::text AS "opportunityId", c.empresa_id::text AS "companyId",
           c.inicio::text AS "startsAt", c.vencimento::text AS "endsAt",
           c.created_at::text AS "createdAt"
      FROM contratos c
     WHERE c.organizacao_id = ${ator.organizacaoId}::uuid
     ORDER BY c.created_at DESC LIMIT ${limite} OFFSET ${offset}`);
  return { data: linhas, page: { limit: limite, offset } };
}));

app.get("/v1/invoices", rota("finance.read", async (c, ator) => {
  const { limite, offset } = paginacao(c);
  const status = c.req.query("status") ?? null;
  const linhas = await db.execute<Record<string, unknown>>(sql`
    SELECT f.id::text, f.status, f.valor::float AS amount, f.moeda AS currency,
           f.vencimento::text AS "dueAt", f.paga_em::text AS "paidAt",
           f.empresa_id::text AS "companyId", f.created_at::text AS "createdAt"
      FROM faturas f
     WHERE f.organizacao_id = ${ator.organizacaoId}::uuid AND ${doCrm("f")}
       AND (${status}::text IS NULL OR f.status = ${status})
     ORDER BY f.created_at DESC LIMIT ${limite} OFFSET ${offset}`);
  return { data: linhas, page: { limit: limite, offset } };
}));

app.get("/v1/payments", rota("finance.read", async (c, ator) => {
  const { limite, offset } = paginacao(c);
  const linhas = await db.execute<Record<string, unknown>>(sql`
    SELECT pg.id::text, pg.status, pg.amount::float AS amount, pg.payment_method AS method,
           pg.fatura_id::text AS "invoiceId", pg.paid_at::text AS "paidAt",
           pg.created_at::text AS "createdAt"
      FROM pagamentos pg
     WHERE pg.organizacao_id = ${ator.organizacaoId}::uuid
     ORDER BY pg.created_at DESC LIMIT ${limite} OFFSET ${offset}`);
  return { data: linhas, page: { limit: limite, offset } };
}));

app.get("/v1/communications", rota("acquisition.read", async (c, ator) => {
  const { limite, offset } = paginacao(c);
  const pessoaId = c.req.query("person_id") ?? null;
  const linhas = await db.execute<Record<string, unknown>>(sql`
    SELECT cm.id::text, cm.canal AS channel, cm.direcao AS direction,
           cm.pessoa_id::text AS "personId", cm.empresa_id::text AS "companyId",
           cm.subject, cm.summary, cm.ocorrido_em::text AS "occurredAt"
      FROM communications cm
     WHERE cm.organizacao_id = ${ator.organizacaoId}::uuid
       AND ${condicaoComunicacaoNaoPrivada("cm")}
       AND (${pessoaId}::uuid IS NULL OR cm.pessoa_id = ${pessoaId}::uuid)
     ORDER BY cm.ocorrido_em DESC LIMIT ${limite} OFFSET ${offset}`);
  return { data: linhas, page: { limit: limite, offset } };
}));

export const v1Routes = app;
