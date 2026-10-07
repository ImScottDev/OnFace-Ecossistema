import { Hono } from "hono";
import { getCtx } from "../compat.js";
import { db } from "@/lib/db";
import { ligacoes, usuarios, negocios, negocioLeads, leads } from "@/lib/db/schema";
import { eq, and, or, desc, inArray, sql, ilike } from "drizzle-orm";

/**
 * Histórico de ligações da telefonia Callface (webhook de saída).
 *
 * GET /ligacoes?leadId=...          → ligações do lead
 * GET /ligacoes?negocioId=...       → ligações do negócio (diretas + dos leads vinculados)
 * GET /ligacoes (sem params)        → listagem geral da org, pra Atendimento
 *   (?usuarioId=, ?search=, ?limit=)
 *
 * Retorna a lista ordenada da mais recente pra mais antiga, com o nome do
 * vendedor resolvido. A série do closurePercentage (tendência de fechamento)
 * é a própria lista — uma linha por ligação.
 */
const app = new Hono();

app.get("/ligacoes", async (c) => {
  const ctx = await getCtx(c);
  const leadId = c.req.query("leadId") ?? null;
  const negocioId = c.req.query("negocioId") ?? null;
  // Filtro que não é uuid estourava no Postgres (500); parâmetro inválido é 400.
  for (const q of ["leadId", "negocioId", "usuarioId"]) {
    const v = c.req.query(q);
    if (v && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
      return c.json({ error: `${q} invalido` }, 400);
    }
  }

  if (!leadId && !negocioId) {
    const usuarioId = c.req.query("usuarioId") ?? null;
    const search = c.req.query("search") ?? null;
    const limit = Math.min(parseInt(c.req.query("limit") || "50"), 200);

    const conds = [eq(ligacoes.organizacaoId, ctx.organizacaoId)];
    if (usuarioId) conds.push(eq(ligacoes.usuarioId, usuarioId));
    if (search) conds.push(ilike(leads.nome, `%${search}%`));

    const rows = await db
      .select({
        id: ligacoes.id,
        leadId: ligacoes.leadId,
        negocioId: ligacoes.negocioId,
        usuarioId: ligacoes.usuarioId,
        usuarioNome: usuarios.nome,
        leadNome: leads.nome,
        leadEmpresa: leads.empresa,
        destinationNumber: ligacoes.destinationNumber,
        callDate: ligacoes.callDate,
        duracaoSegundos: ligacoes.duracaoSegundos,
        callStatus: ligacoes.callStatus,
        resumo: ligacoes.resumo,
        closurePercentage: ligacoes.closurePercentage,
        createdAt: ligacoes.createdAt,
      })
      .from(ligacoes)
      .leftJoin(usuarios, eq(usuarios.id, ligacoes.usuarioId))
      .leftJoin(leads, eq(leads.id, ligacoes.leadId))
      .where(and(...conds))
      .orderBy(desc(sql`coalesce(${ligacoes.callDate}, ${ligacoes.createdAt})`))
      .limit(limit);

    return c.json(rows);
  }

  const conds = [eq(ligacoes.organizacaoId, ctx.organizacaoId)];

  if (leadId) {
    conds.push(eq(ligacoes.leadId, leadId));
  } else if (negocioId) {
    // Ligações amarradas direto no negócio + as dos leads vinculados (N:N e legacy).
    const [neg] = await db
      .select({ leadId: negocios.leadId })
      .from(negocios)
      .where(and(eq(negocios.id, negocioId), eq(negocios.organizacaoId, ctx.organizacaoId)))
      .limit(1);
    if (!neg) return c.json({ error: "Negócio não encontrado" }, 404);

    const vinculados = await db
      .select({ leadId: negocioLeads.leadId })
      .from(negocioLeads)
      .where(eq(negocioLeads.negocioId, negocioId));
    const leadIds = [...new Set([...vinculados.map((v) => v.leadId), ...(neg.leadId ? [neg.leadId] : [])])];

    conds.push(
      leadIds.length > 0
        ? or(eq(ligacoes.negocioId, negocioId), inArray(ligacoes.leadId, leadIds))!
        : eq(ligacoes.negocioId, negocioId),
    );
  }

  const rows = await db
    .select({
      id: ligacoes.id,
      leadId: ligacoes.leadId,
      negocioId: ligacoes.negocioId,
      usuarioId: ligacoes.usuarioId,
      usuarioNome: usuarios.nome,
      userName: ligacoes.userName,
      userEmail: ligacoes.userEmail,
      destinationNumber: ligacoes.destinationNumber,
      callDate: ligacoes.callDate,
      duracaoSegundos: ligacoes.duracaoSegundos,
      callStatus: ligacoes.callStatus,
      resumo: ligacoes.resumo,
      transcricao: ligacoes.transcricao,
      callLink: ligacoes.callLink,
      audioUrl: ligacoes.audioUrl,
      closurePercentage: ligacoes.closurePercentage,
      scheduling: ligacoes.scheduling,
      createdAt: ligacoes.createdAt,
    })
    .from(ligacoes)
    .leftJoin(usuarios, eq(usuarios.id, ligacoes.usuarioId))
    .where(and(...conds))
    .orderBy(desc(sql`coalesce(${ligacoes.callDate}, ${ligacoes.createdAt})`))
    .limit(200);

  return c.json(rows);
});

export const ligacoesRoutes = app;
