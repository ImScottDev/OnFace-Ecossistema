import { Hono } from "hono";
import { db } from "@/lib/db";
import { notas, usuarios, leads, negocios, notificacoes } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getCtx } from "../compat.js";

const app = new Hono();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createSchema = z.object({
  conteudo: z.string().min(1),
  leadId: z.string().uuid().optional().nullable(),
  negocioId: z.string().uuid().optional().nullable(),
  empresaId: z.string().uuid().optional().nullable(),
  reuniaoId: z.string().uuid().optional().nullable(),
  clienteId: z.string().uuid().optional().nullable(),
});

const updateSchema = z.object({
  conteudo: z.string().min(1),
}).strict();

// GET /api/notas — list notes for the org
app.get("/notas", async (c) => {
  const ctx = await getCtx(c);

  const leadId = c.req.query("leadId") ?? null;
  const negocioId = c.req.query("negocioId") ?? null;
  const empresaId = c.req.query("empresaId") ?? null;
  const reuniaoId = c.req.query("reuniaoId") ?? null;
  const clienteId = c.req.query("clienteId") ?? null;

  // Filtro com id que não é uuid estourava no Postgres (500); é 400.
  if ([leadId, negocioId, empresaId, reuniaoId, clienteId].some((v) => v && !UUID_RE.test(v))) {
    return c.json({ error: "Filtro invalido" }, 400);
  }

  const conditions = [eq(notas.organizacaoId, ctx.organizacaoId)];

  if (leadId) conditions.push(eq(notas.leadId, leadId));
  if (negocioId) conditions.push(eq(notas.negocioId, negocioId));
  if (empresaId) conditions.push(eq(notas.empresaId, empresaId));
  if (reuniaoId) conditions.push(eq(notas.reuniaoId, reuniaoId));
  if (clienteId) conditions.push(eq(notas.clienteId, clienteId));

  const result = await db.select({
    id: notas.id,
    conteudo: notas.conteudo,
    leadId: notas.leadId,
    negocioId: notas.negocioId,
    empresaId: notas.empresaId,
    reuniaoId: notas.reuniaoId,
    clienteId: notas.clienteId,
    autorId: notas.autorId,
    autorNome: usuarios.nome,
    createdAt: notas.createdAt,
    updatedAt: notas.updatedAt,
  }).from(notas)
    .leftJoin(usuarios, eq(notas.autorId, usuarios.id))
    .where(and(...conditions))
    .orderBy(desc(notas.createdAt));

  return c.json(result);
});

// POST /api/notas — create note
app.post("/notas", async (c) => {
  const ctx = await getCtx(c);

  try {
    const body = await c.req.json();
    const data = createSchema.parse(body);

    const [nota] = await db.insert(notas).values({
      organizacaoId: ctx.organizacaoId,
      conteudo: data.conteudo,
      leadId: data.leadId || null,
      negocioId: data.negocioId || null,
      empresaId: data.empresaId || null,
      reuniaoId: data.reuniaoId || null,
      clienteId: data.clienteId || null,
      autorId: ctx.userId,
    }).returning();

    // Nota é atividade real: reseta o relógio do badge de tempo no board de pré-vendas
    // e, se o lead tiver negócio ativo (ou a nota já for direto no negócio), no Pipeline também.
    const now = new Date();
    if (data.leadId) {
      const [updatedLead] = await db.update(leads).set({ updatedAt: now })
        .where(and(eq(leads.id, data.leadId), eq(leads.organizacaoId, ctx.organizacaoId)))
        .returning({ negocioAtivoId: leads.negocioAtivoId });
      if (updatedLead?.negocioAtivoId) {
        await db.update(negocios).set({ updatedAt: now })
          .where(and(eq(negocios.id, updatedLead.negocioAtivoId), eq(negocios.organizacaoId, ctx.organizacaoId)));
      }
    }
    if (data.negocioId) {
      await db.update(negocios).set({ updatedAt: now })
        .where(and(eq(negocios.id, data.negocioId), eq(negocios.organizacaoId, ctx.organizacaoId)));
    }

    /* @menção: quem foi citado na nota recebe notificação (sininho). O @ existia
       só na UI; aqui fechamos o elo. Casa o nome contra os usuários da org — nada
       de regex ambígua. Fire-and-forget: nunca derruba o salvar da nota. */
    try {
      const usuariosOrg = await db.select({ id: usuarios.id, nome: usuarios.nome })
        .from(usuarios).where(and(eq(usuarios.organizacaoId, ctx.organizacaoId), eq(usuarios.ativo, true)));
      const link = data.leadId ? `/pessoas/${data.leadId}` : data.negocioId ? `/pipeline/${data.negocioId}` : data.empresaId ? `/empresas/${data.empresaId}` : data.clienteId ? `/clientes/${data.clienteId}` : "/";
      const mencionados = usuariosOrg.filter((u) => u.id !== ctx.userId && u.nome && data.conteudo.includes(`@${u.nome}`));
      if (mencionados.length) {
        await db.insert(notificacoes).values(mencionados.map((u) => ({
          usuarioId: u.id, tipo: "mencao",
          titulo: "Você foi mencionado numa nota",
          mensagem: data.conteudo.slice(0, 140),
          link,
        })));
      }
    } catch (e) {
      console.error("[notas] falha ao notificar menção:", e);
    }

    return c.json(nota, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    return c.json({ error: "Erro interno" }, 500);
  }
});

// PATCH /api/notas/:id — update note content
app.patch("/notas/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "Nota não encontrada" }, 404); // uuid inválido estourava 500

  const [existing] = await db
    .select({ id: notas.id })
    .from(notas)
    .where(and(eq(notas.id, id), eq(notas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Nota não encontrada" }, 404);
  }

  try {
    const body = await c.req.json();
    const data = updateSchema.parse(body);

    const [updated] = await db
      .update(notas)
      .set({ conteudo: data.conteudo, updatedAt: new Date() })
      .where(eq(notas.id, id))
      .returning();

    return c.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Dados inválidos", details: error.issues }, 400);
    }
    return c.json({ error: "Erro interno" }, 500);
  }
});

// DELETE /api/notas/:id — hard delete note
app.delete("/notas/:id", async (c) => {
  const ctx = await getCtx(c);

  const id = c.req.param("id");
  if (!UUID_RE.test(id)) return c.json({ error: "Nota não encontrada" }, 404); // uuid inválido estourava 500

  const [existing] = await db
    .select({ id: notas.id })
    .from(notas)
    .where(and(eq(notas.id, id), eq(notas.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Nota não encontrada" }, 404);
  }

  await db.delete(notas).where(eq(notas.id, id));

  return c.json({ success: true });
});

export const notasRoutes = app;
