import { Hono } from "hono";
import { getCtx } from "../compat.js";
import { db } from "@/lib/db";
import { ligacoes, usuarios, negocios, negocioLeads } from "@/lib/db/schema";
import { eq, and, or, desc, inArray, sql } from "drizzle-orm";

/**
 * Histórico de ligações da telefonia Callface (webhook de saída).
 *
 * GET /ligacoes?leadId=...          → ligações do lead
 * GET /ligacoes?negocioId=...       → ligações do negócio (diretas + dos leads vinculados)
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
  if (!leadId && !negocioId) return c.json({ error: "Informe leadId ou negocioId" }, 400);

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
