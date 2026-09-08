/**
 * API do pós-venda canônico — filas de entrega e checklist.
 *
 * Recorte mínimo (08/09): listar por trilha, abrir o detalhe, mexer no
 * checklist e fechar a entrega. Tudo o que o CRM 2.0 tem além disto
 * (formulário público de implantação, ramais, portabilidade, anexos) fica
 * pra quando o módulo correspondente subir — as tabelas já existem, os
 * endpoints não.
 *
 * Multi-tenant: `organizacaoId` em toda query, sem exceção.
 */
import { Hono } from "hono";
import { db } from "@/lib/db";
import { and, eq, inArray, sql, desc } from "drizzle-orm";
import { z } from "zod";
import {
  fulfillments,
  fulfillmentItens,
  servicosCanonicos,
  empresas,
  leads,
  usuarios,
  negocios,
} from "@/lib/db/schema";
import { getCtx } from "../compat.js";

const app = new Hono();

/** Famílias que caem em cada trilha. Espelha lib/crm/pos-venda.ts. */
const FAMILIAS_POR_TRILHA: Record<string, string[]> = {
  onboarding: ["CALLFACE_AI"],
  implantacao_pabx: ["PABX"],
  implantacao_white_label: ["WHITE_LABEL"],
  validacao_manual: ["UNKNOWN"],
};

const STATUS_ABERTOS = ["NOT_STARTED", "IN_PROGRESS", "WAITING_CUSTOMER", "BLOCKED_CUSTOMER", "BLOCKED_INTERNAL", "BLOCKED_PROVIDER", "READY_FOR_VALIDATION"];

/**
 * GET /fulfillments?trilha=onboarding|implantacao_pabx|implantacao_white_label|validacao_manual
 *
 * Lista a fila de uma trilha. `concluidos=1` inclui os finalizados.
 */
app.get("/fulfillments", async (c) => {
  const ctx = await getCtx(c);

  const trilha = c.req.query("trilha") || "onboarding";
  const familias = FAMILIAS_POR_TRILHA[trilha];
  if (!familias) return c.json({ error: `trilha inválida: ${trilha}` }, 400);

  const incluirConcluidos = c.req.query("concluidos") === "1";

  const rows = await db
    .select({
      id: fulfillments.id,
      status: fulfillments.status,
      serviceFamily: fulfillments.serviceFamily,
      startedAt: fulfillments.startedAt,
      targetAt: fulfillments.targetAt,
      completedAt: fulfillments.completedAt,
      responsavelId: fulfillments.responsavelId,
      responsavelNome: usuarios.nome,
      servicoCanonicoId: servicosCanonicos.id,
      canonicalProduct: servicosCanonicos.canonicalProduct,
      evidence: servicosCanonicos.evidence,
      empresaNome: empresas.nome,
      leadNome: leads.nome,
      leadId: leads.id,
    })
    .from(fulfillments)
    .innerJoin(servicosCanonicos, eq(fulfillments.servicoCanonicoId, servicosCanonicos.id))
    .leftJoin(empresas, eq(servicosCanonicos.empresaId, empresas.id))
    .leftJoin(leads, eq(servicosCanonicos.leadId, leads.id))
    .leftJoin(usuarios, eq(fulfillments.responsavelId, usuarios.id))
    .where(
      and(
        eq(fulfillments.organizacaoId, ctx.organizacaoId),
        inArray(fulfillments.serviceFamily, familias),
        incluirConcluidos ? undefined : inArray(fulfillments.status, STATUS_ABERTOS),
      ),
    )
    .orderBy(desc(fulfillments.startedAt))
    .limit(500);

  if (rows.length === 0) return c.json({ items: [] });

  // Progresso do checklist em uma query só (nunca N+1).
  const ids = rows.map((r) => r.id);
  const progresso = await db
    .select({
      fulfillmentId: fulfillmentItens.fulfillmentId,
      total: sql<number>`count(*)::int`,
      concluidos: sql<number>`count(*) FILTER (WHERE ${fulfillmentItens.status} = 'DONE')::int`,
      bloqueados: sql<number>`count(*) FILTER (WHERE ${fulfillmentItens.status} = 'BLOCKED')::int`,
    })
    .from(fulfillmentItens)
    .where(and(eq(fulfillmentItens.organizacaoId, ctx.organizacaoId), inArray(fulfillmentItens.fulfillmentId, ids)))
    .groupBy(fulfillmentItens.fulfillmentId);

  const porId = new Map(progresso.map((p) => [p.fulfillmentId, p]));

  const items = rows.map((r) => {
    const p = porId.get(r.id);
    const ev = (r.evidence || {}) as Record<string, unknown>;
    return {
      id: r.id,
      status: r.status,
      serviceFamily: r.serviceFamily,
      cliente: r.empresaNome || r.leadNome || "(sem cliente vinculado)",
      leadId: r.leadId,
      negocioId: (ev.negocioId as string) || null,
      produto: r.canonicalProduct,
      responsavelId: r.responsavelId,
      responsavelNome: r.responsavelNome,
      startedAt: r.startedAt,
      targetAt: r.targetAt,
      completedAt: r.completedAt,
      total: p?.total ?? 0,
      concluidos: p?.concluidos ?? 0,
      bloqueados: p?.bloqueados ?? 0,
    };
  });

  return c.json({ items });
});

/** GET /fulfillments/:id — detalhe com checklist completo. */
app.get("/fulfillments/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const [f] = await db
    .select({
      id: fulfillments.id,
      status: fulfillments.status,
      serviceFamily: fulfillments.serviceFamily,
      startedAt: fulfillments.startedAt,
      targetAt: fulfillments.targetAt,
      completedAt: fulfillments.completedAt,
      responsavelId: fulfillments.responsavelId,
      responsavelNome: usuarios.nome,
      canonicalProduct: servicosCanonicos.canonicalProduct,
      evidence: servicosCanonicos.evidence,
      empresaNome: empresas.nome,
      leadNome: leads.nome,
      leadId: leads.id,
    })
    .from(fulfillments)
    .innerJoin(servicosCanonicos, eq(fulfillments.servicoCanonicoId, servicosCanonicos.id))
    .leftJoin(empresas, eq(servicosCanonicos.empresaId, empresas.id))
    .leftJoin(leads, eq(servicosCanonicos.leadId, leads.id))
    .leftJoin(usuarios, eq(fulfillments.responsavelId, usuarios.id))
    .where(and(eq(fulfillments.id, id), eq(fulfillments.organizacaoId, ctx.organizacaoId)))
    .limit(1);

  if (!f) return c.json({ error: "entrega não encontrada" }, 404);

  const itens = await db
    .select()
    .from(fulfillmentItens)
    .where(and(eq(fulfillmentItens.fulfillmentId, id), eq(fulfillmentItens.organizacaoId, ctx.organizacaoId)))
    .orderBy(fulfillmentItens.ordem);

  const ev = (f.evidence || {}) as Record<string, unknown>;
  let negocioTitulo: string | null = null;
  if (ev.negocioId) {
    const [n] = await db
      .select({ titulo: negocios.titulo })
      .from(negocios)
      .where(eq(negocios.id, ev.negocioId as string))
      .limit(1);
    negocioTitulo = n?.titulo ?? null;
  }

  return c.json({
    fulfillment: {
      ...f,
      cliente: f.empresaNome || f.leadNome || "(sem cliente vinculado)",
      negocioId: (ev.negocioId as string) || null,
      negocioTitulo,
    },
    itens,
  });
});

const patchFulfillmentSchema = z.object({
  status: z.string().optional(),
  responsavelId: z.string().uuid().nullable().optional(),
  targetAt: z.string().datetime().nullable().optional(),
});

/** PATCH /fulfillments/:id — status macro, responsável, prazo. */
app.patch("/fulfillments/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const parsed = patchFulfillmentSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);

  const dados: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.status !== undefined) {
    dados.status = parsed.data.status;
    // completedAt acompanha COMPLETED nos dois sentidos — nunca fica órfão.
    dados.completedAt = parsed.data.status === "COMPLETED" ? new Date() : null;
  }
  if (parsed.data.responsavelId !== undefined) dados.responsavelId = parsed.data.responsavelId;
  if (parsed.data.targetAt !== undefined) {
    dados.targetAt = parsed.data.targetAt ? new Date(parsed.data.targetAt) : null;
  }

  const [atualizado] = await db
    .update(fulfillments)
    .set(dados)
    .where(and(eq(fulfillments.id, id), eq(fulfillments.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!atualizado) return c.json({ error: "entrega não encontrada" }, 404);
  return c.json(atualizado);
});

const patchItemSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "BLOCKED", "VALIDATION", "DONE"]).optional(),
  blockerType: z.enum(["CUSTOMER", "INTERNAL", "PROVIDER"]).nullable().optional(),
  blockerReason: z.string().nullable().optional(),
  responsavelId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  priority: z.enum(["alta", "media", "baixa"]).nullable().optional(),
});

/** PATCH /fulfillments/itens/:id — um item do checklist. */
app.patch("/fulfillments/itens/:id", async (c) => {
  const ctx = await getCtx(c);
  const id = c.req.param("id");

  const parsed = patchItemSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);

  const dados: Record<string, unknown> = { updatedAt: new Date() };
  const d = parsed.data;

  if (d.status !== undefined) {
    dados.status = d.status;
    // completedAt/By e blockedAt são setados NA TRANSIÇÃO, nunca derivados
    // de updatedAt (que muda em qualquer edição).
    if (d.status === "DONE") {
      dados.completedAt = new Date();
      dados.completedBy = ctx.userId;
    } else {
      dados.completedAt = null;
      dados.completedBy = null;
    }
    if (d.status === "BLOCKED") {
      dados.blockedAt = new Date();
    } else {
      dados.blockedAt = null;
      dados.blockerType = null;
      dados.blockerReason = null;
    }
  }
  if (d.blockerType !== undefined) dados.blockerType = d.blockerType;
  if (d.blockerReason !== undefined) dados.blockerReason = d.blockerReason;
  if (d.responsavelId !== undefined) dados.responsavelId = d.responsavelId;
  if (d.priority !== undefined) dados.priority = d.priority;
  if (d.dueDate !== undefined) dados.dueDate = d.dueDate ? new Date(d.dueDate) : null;

  const [atualizado] = await db
    .update(fulfillmentItens)
    .set(dados)
    .where(and(eq(fulfillmentItens.id, id), eq(fulfillmentItens.organizacaoId, ctx.organizacaoId)))
    .returning();

  if (!atualizado) return c.json({ error: "item não encontrado" }, 404);

  // Status macro derivado do checklist: reflete o que de fato está
  // acontecendo, em vez de exigir que alguém lembre de mover a entrega.
  // Nunca sobrescreve COMPLETED/CANCELED marcados à mão.
  const [f] = await db
    .select({ status: fulfillments.status })
    .from(fulfillments)
    .where(eq(fulfillments.id, atualizado.fulfillmentId))
    .limit(1);

  if (f && f.status !== "COMPLETED" && f.status !== "CANCELED") {
    const [agg] = await db
      .select({
        total: sql<number>`count(*)::int`,
        concluidos: sql<number>`count(*) FILTER (WHERE ${fulfillmentItens.status} = 'DONE')::int`,
        bloqueados: sql<number>`count(*) FILTER (WHERE ${fulfillmentItens.status} = 'BLOCKED')::int`,
        emAndamento: sql<number>`count(*) FILTER (WHERE ${fulfillmentItens.status} IN ('IN_PROGRESS','VALIDATION'))::int`,
      })
      .from(fulfillmentItens)
      .where(eq(fulfillmentItens.fulfillmentId, atualizado.fulfillmentId));

    let novo = f.status;
    if (agg.total > 0 && agg.concluidos === agg.total) novo = "READY_FOR_VALIDATION";
    else if (agg.bloqueados > 0) novo = "BLOCKED_INTERNAL";
    else if (agg.concluidos > 0 || agg.emAndamento > 0) novo = "IN_PROGRESS";
    else novo = "NOT_STARTED";

    if (novo !== f.status) {
      await db
        .update(fulfillments)
        .set({ status: novo, updatedAt: new Date() })
        .where(eq(fulfillments.id, atualizado.fulfillmentId));
    }
  }

  return c.json(atualizado);
});

/** GET /fulfillments/resumo — contagem por trilha, pro menu/badge. */
app.get("/fulfillments/resumo", async (c) => {
  const ctx = await getCtx(c);

  const rows = await db
    .select({
      serviceFamily: fulfillments.serviceFamily,
      abertos: sql<number>`count(*) FILTER (WHERE ${fulfillments.status} = ANY(ARRAY['NOT_STARTED','IN_PROGRESS','WAITING_CUSTOMER','BLOCKED_CUSTOMER','BLOCKED_INTERNAL','BLOCKED_PROVIDER','READY_FOR_VALIDATION']))::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(fulfillments)
    .where(eq(fulfillments.organizacaoId, ctx.organizacaoId))
    .groupBy(fulfillments.serviceFamily);

  const porTrilha: Record<string, { abertos: number; total: number }> = {};
  for (const [trilha, familias] of Object.entries(FAMILIAS_POR_TRILHA)) {
    const desta = rows.filter((r) => familias.includes(r.serviceFamily));
    porTrilha[trilha] = {
      abertos: desta.reduce((s, r) => s + r.abertos, 0),
      total: desta.reduce((s, r) => s + r.total, 0),
    };
  }

  return c.json(porTrilha);
});

export const fulfillmentsRoutes = app;
