// Distribuição de leads novos (Ajustes > Leads) e agentes que são usuários.
import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, organizacoes, usuarios } from "@/lib/db/schema";
import { getCtx } from "../compat.js";
import { ErroDeRegra, historicoDasRegras, listarRegras, opcoesDeCriterios, removerRegra, resolverPorRegra, salvarRegra } from "@/lib/agentes/distribuicao";
import { sincronizarUsuariosDosAgentes } from "@/lib/agentes/usuario-do-agente";
import { lerPadroesDeAgentes } from "@/lib/agentes/handover";

const app = new Hono();
const GESTAO = ["admin", "gerente", "super_admin"];

/** Lista de valores aceitos para um critério; nula ou vazia = qualquer valor. */
const criterio = z.array(z.string().trim().min(1).max(200)).max(50).nullish();

const regraSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1),
  etapa: z.string().default("novo"),
  alvoTipo: z.enum(["usuario", "rodizio"]),
  alvoUsuarioId: z.string().uuid().nullish(),
  rodizioUsuarioIds: z.array(z.string().uuid()).default([]),
  diasSemana: z.array(z.number().int().min(0).max(6)).nullish(),
  horaInicio: z.string().nullish(),
  horaFim: z.string().nullish(),
  humanoDevolucaoId: z.string().uuid().nullish(),
  prioridade: z.number().int().min(0).max(1000).default(100),
  ativo: z.boolean().default(true),
  // Migration 0131: critérios de atribuição (vazio = qualquer lead) e o
  // número operacional de onde o lead deve ser trabalhado.
  descricao: z.string().max(500).nullish(),
  origem: criterio,
  utmSource: criterio,
  utmCampaign: criterio,
  metaCampaignIds: criterio,
  formulario: criterio,
  sessaoWhatsappId: z.string().uuid().nullish(),
});

/** Um lead hipotético: o que se sabe de onde ele veio. Campo em branco = o lead não traz o dado. */
const valorSimulado = z.string().trim().max(200).nullish();
const simulacaoSchema = z.object({
  origem: valorSimulado,
  utmSource: valorSimulado,
  utmCampaign: valorSimulado,
  metaCampaignId: valorSimulado,
  formulario: valorSimulado,
});

const padroesSchema = z.object({
  humanoDevolucaoPadraoId: z.string().uuid().nullable(),
  agenteFollowupPadraoId: z.string().uuid().nullable(),
});

app.get("/", async (c) => {
  const ctx = await getCtx(c);
  if (!GESTAO.includes(ctx.userRole)) return c.json({ error: "Forbidden" }, 403);
  await sincronizarUsuariosDosAgentes(ctx.organizacaoId);
  const [regras, historico, padroes, org] = await Promise.all([
    listarRegras(ctx.organizacaoId), historicoDasRegras(ctx.organizacaoId), lerPadroesDeAgentes(ctx.organizacaoId),
    db.select({ settings: organizacoes.settings }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1),
  ]);
  const inbound = ((org[0]?.settings as { preVendas?: { responsavelInboundId?: string } } | null)?.preVendas?.responsavelInboundId) ?? null;
  return c.json({ regras, historico, padroes: { ...padroes, responsavelInboundId: inbound } });
});

/**
 * Valores de campanha, fonte, origem, campanha da Meta e formulário que a
 * organização já tem em leads, com a contagem de cada um. A tela oferece em vez
 * de pedir digitação; a organização vem da sessão, nunca do cliente.
 */
app.get("/opcoes", async (c) => {
  const ctx = await getCtx(c);
  if (!GESTAO.includes(ctx.userRole)) return c.json({ error: "Forbidden" }, 403);
  return c.json(await opcoesDeCriterios(ctx.organizacaoId));
});

/**
 * "Para onde este lead iria?": roda as mesmas regras sem gastar o rodízio
 * (`simular`), para conferir prioridade e destino antes de o lead real chegar.
 */
app.post("/simular", async (c) => {
  const ctx = await getCtx(c);
  if (!GESTAO.includes(ctx.userRole)) return c.json({ error: "Forbidden" }, 403);
  const parsed = simulacaoSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Dados inválidos" }, 400);
  const resultado = await resolverPorRegra({ organizacaoId: ctx.organizacaoId, atribuicao: parsed.data, simular: true });
  return c.json({ resultado });
});

app.post("/regras", async (c) => {
  const ctx = await getCtx(c);
  if (!GESTAO.includes(ctx.userRole)) return c.json({ error: "Forbidden" }, 403);
  const parsed = regraSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Regra inválida", details: parsed.error.flatten() }, 400);
  try {
    return c.json({ regra: await salvarRegra(ctx.organizacaoId, ctx.userId, parsed.data) });
  } catch (e) {
    if (e instanceof ErroDeRegra) return c.json({ error: e.message }, 400);
    throw e;
  }
});

app.delete("/regras/:id", async (c) => {
  const ctx = await getCtx(c);
  if (!GESTAO.includes(ctx.userRole)) return c.json({ error: "Forbidden" }, 403);
  try {
    await removerRegra(ctx.organizacaoId, ctx.userId, c.req.param("id"));
    return c.json({ ok: true });
  } catch (e) {
    if (e instanceof ErroDeRegra) return c.json({ error: e.message }, 404);
    throw e;
  }
});

app.put("/padroes", async (c) => {
  const ctx = await getCtx(c);
  if (!GESTAO.includes(ctx.userRole)) return c.json({ error: "Forbidden" }, 403);
  const parsed = padroesSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Dados inválidos" }, 400);
  const ids = [parsed.data.humanoDevolucaoPadraoId, parsed.data.agenteFollowupPadraoId].filter((x): x is string => Boolean(x));
  for (const id of ids) {
    const [u] = await db.select({ id: usuarios.id, org: usuarios.organizacaoId, ativo: usuarios.ativo, tipo: usuarios.tipo }).from(usuarios).where(eq(usuarios.id, id)).limit(1);
    if (!u || u.org !== ctx.organizacaoId || !u.ativo) return c.json({ error: "Usuário inválido." }, 400);
    if (id === parsed.data.humanoDevolucaoPadraoId && u.tipo !== "humano") return c.json({ error: "Quem recebe o handover precisa ser uma pessoa." }, 400);
    if (id === parsed.data.agenteFollowupPadraoId && u.tipo !== "agente") return c.json({ error: "O agente de follow-up precisa ser um agente de IA." }, 400);
  }
  const [org] = await db.select({ settings: organizacoes.settings }).from(organizacoes).where(eq(organizacoes.id, ctx.organizacaoId)).limit(1);
  const atual = (org?.settings && typeof org.settings === "object" ? org.settings : {}) as Record<string, unknown>;
  const antes = (atual.agentes ?? null) as Record<string, unknown> | null;
  await db.update(organizacoes).set({ settings: { ...atual, agentes: parsed.data }, updatedAt: new Date() }).where(eq(organizacoes.id, ctx.organizacaoId));
  await db.insert(auditLog).values({ organizacaoId: ctx.organizacaoId, actorId: ctx.userId, action: "regra_distribuicao.padroes_alterados", entityType: "regra_distribuicao", before: antes as never, after: parsed.data as never });
  return c.json({ ok: true });
});

app.post("/sincronizar-agentes", async (c) => {
  const ctx = await getCtx(c);
  if (!GESTAO.includes(ctx.userRole)) return c.json({ error: "Forbidden" }, 403);
  return c.json(await sincronizarUsuariosDosAgentes(ctx.organizacaoId));
});

export const distribuicaoLeadsRoutes = app;
