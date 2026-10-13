// Cliente 360 → alterar a assinatura sem sair do ONFACE (stripe-onface-definicao §3, §9, §14).
//
// Três rotas, todas por empresa e por assinatura do ESPELHO da própria
// organização (nunca um `sub_...` solto vindo do cliente):
//   GET  /clientes/:empresaId/assinaturas-stripe                      → o que há para alterar
//   POST /clientes/:empresaId/assinaturas-stripe/:id/previa           → quanto vai cobrar, sem alterar
//   POST /clientes/:empresaId/assinaturas-stripe/:id/alterar          → aplica (idempotente por `chave`)
//
// Permissão: `finance.manage`, a mesma de abrir o portal — quem mexe no que o
// cliente paga. Passar por cima da regra (upgrade imediato / downgrade no
// próximo ciclo) é `sobrescrever: true` com motivo, e fica no audit_log.
import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { assinaturaItens, assinaturas, auditLog, empresas, negocios, propostas } from "@/lib/db/schema";
import { exigirCtx } from "../compat.js";
import {
  aplicarAlteracao, ErroDeAlteracao, planejarAlteracao, previaDaAlteracao, type AcaoDeAssinatura, type OrigemDaAlteracao,
} from "@/lib/integrations/stripe-assinatura-acoes";

const app = new Hono();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STRIPE_ID = z.string().regex(/^[a-z]+_[A-Za-z0-9]+$/);

const acaoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("adicionar_item"), priceId: STRIPE_ID, quantidade: z.number().int().min(1).max(100000) }),
  z.object({ tipo: z.literal("alterar_quantidade"), itemId: STRIPE_ID, quantidade: z.number().int().min(1).max(100000) }),
  z.object({ tipo: z.literal("remover_item"), itemId: STRIPE_ID }),
  z.object({ tipo: z.literal("trocar_price"), itemId: STRIPE_ID, novoPriceId: STRIPE_ID, quantidade: z.number().int().min(1).max(100000).optional() }),
  z.object({ tipo: z.literal("cancelar"), quando: z.enum(["fim_periodo", "agora"]) }),
  z.object({ tipo: z.literal("reativar") }),
]);
const corpoSchema = z.object({
  acao: acaoSchema,
  efeito: z.enum(["agora", "proximo_ciclo"]).optional(),
  sobrescrever: z.boolean().optional(),
  motivo: z.string().trim().max(500).optional(),
  negocioId: z.string().regex(UUID_RE).optional(),
  propostaId: z.string().regex(UUID_RE).optional(),
});
const alterarSchema = corpoSchema.extend({ chave: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/) });

/** A assinatura tem de ser desta organização e desta empresa. */
async function assinaturaDaEmpresa(organizacaoId: string, empresaId: string, assinaturaId: string) {
  if (!UUID_RE.test(empresaId) || !UUID_RE.test(assinaturaId)) return null;
  const [a] = await db.select().from(assinaturas).where(and(
    eq(assinaturas.id, assinaturaId), eq(assinaturas.empresaId, empresaId), eq(assinaturas.organizacaoId, organizacaoId),
  )).limit(1);
  return a ?? null;
}

/** Negócio e proposta que carimbam a alteração: da mesma organização, e a proposta do negócio. */
async function origemValida(organizacaoId: string, empresaId: string, b: { negocioId?: string; propostaId?: string }) {
  if (b.negocioId) {
    const [n] = await db.select({ id: negocios.id }).from(negocios).where(and(
      eq(negocios.id, b.negocioId), eq(negocios.organizacaoId, organizacaoId), eq(negocios.empresaId, empresaId),
    )).limit(1);
    if (!n) return "Negócio não encontrado nesta empresa.";
  }
  if (b.propostaId) {
    const [p] = await db.select({ negocioId: propostas.negocioId }).from(propostas).where(and(
      eq(propostas.id, b.propostaId), eq(propostas.organizacaoId, organizacaoId),
    )).limit(1);
    if (!p) return "Proposta não encontrada.";
    if (b.negocioId && p.negocioId !== b.negocioId) return "Essa proposta não é deste negócio.";
  }
  return null;
}

function erroHttp(c: { json: (b: unknown, s: 404 | 409 | 422 | 502) => Response }, e: unknown) {
  if (e instanceof ErroDeAlteracao) return c.json({ error: e.message, ...e.extra }, e.status);
  return c.json({ error: `O Stripe recusou a alteração: ${e instanceof Error ? e.message : String(e)}` }, 502);
}

app.get("/clientes/:empresaId/assinaturas-stripe", async (c) => {
  const ctx = await exigirCtx(c, "finance.read");
  const empresaId = c.req.param("empresaId");
  if (!UUID_RE.test(empresaId)) return c.json({ error: "empresaId inválido" }, 400);
  const [empresa] = await db.select({ id: empresas.id }).from(empresas)
    .where(and(eq(empresas.id, empresaId), eq(empresas.organizacaoId, ctx.organizacaoId))).limit(1);
  if (!empresa) return c.json({ error: "Empresa não encontrada" }, 404);

  const subs = await db.select().from(assinaturas).where(and(
    eq(assinaturas.empresaId, empresaId), eq(assinaturas.organizacaoId, ctx.organizacaoId),
    inArray(assinaturas.status, ["active", "trialing", "past_due"]),
  )).orderBy(desc(assinaturas.createdAt));
  const itens = subs.length
    ? await db.select().from(assinaturaItens).where(inArray(assinaturaItens.assinaturaId, subs.map((s) => s.id)))
    : [];

  return c.json({
    assinaturas: subs.map((s) => ({
      id: s.id,
      stripeSubscriptionId: s.stripeSubscriptionId,
      status: s.status,
      moeda: s.moeda,
      mrr: s.mrr ? Number(s.mrr) : null,
      renovaEm: s.currentPeriodEnd,
      cancelaNoFimDoPeriodo: (s.raw as { cancel_at_period_end?: boolean } | null)?.cancel_at_period_end === true,
      itens: itens.filter((i) => i.assinaturaId === s.id && i.status !== "inactive" && i.stripeSubscriptionItemId).map((i) => ({
        itemId: i.stripeSubscriptionItemId, priceId: i.stripePriceId, produto: i.produto,
        quantidade: i.quantidade, precoUnitario: i.precoUnitario ? Number(i.precoUnitario) : null, intervalo: i.recurringInterval,
      })),
    })),
  });
});

app.post("/clientes/:empresaId/assinaturas-stripe/:assinaturaId/previa", async (c) => {
  const ctx = await exigirCtx(c, "finance.manage");
  const empresaId = c.req.param("empresaId");
  const parsed = corpoSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Pedido inválido", detalhes: parsed.error.flatten() }, 422);
  const a = await assinaturaDaEmpresa(ctx.organizacaoId, empresaId, c.req.param("assinaturaId"));
  if (!a) return c.json({ error: "Assinatura não encontrada" }, 404);
  try {
    const plano = await planejarAlteracao(a.stripeSubscriptionId, parsed.data.acao as AcaoDeAssinatura, {
      efeito: parsed.data.efeito, sobrescrever: parsed.data.sobrescrever,
    });
    const previa = await previaDaAlteracao(plano);
    return c.json({
      direcao: plano.direcao, efeito: plano.efeito, efeitoPadrao: plano.efeitoPadrao,
      mrrAntes: plano.mrrAntes, mrrDepois: plano.mrrDepois, previa,
    });
  } catch (e) {
    return erroHttp(c, e);
  }
});

app.post("/clientes/:empresaId/assinaturas-stripe/:assinaturaId/alterar", async (c) => {
  const ctx = await exigirCtx(c, "finance.manage");
  const empresaId = c.req.param("empresaId");
  const parsed = alterarSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Pedido inválido", detalhes: parsed.error.flatten() }, 422);
  const b = parsed.data;
  const a = await assinaturaDaEmpresa(ctx.organizacaoId, empresaId, c.req.param("assinaturaId"));
  if (!a) return c.json({ error: "Assinatura não encontrada" }, 404);
  if (b.sobrescrever && !b.motivo) return c.json({ error: "Informe o motivo para fugir da regra." }, 422);
  const invalida = await origemValida(ctx.organizacaoId, empresaId, b);
  if (invalida) return c.json({ error: invalida }, 422);

  /* Reenvio da mesma intenção (clique duplo, retry de rede): devolve o que já
     foi feito. Sem isto o segundo pedido planejaria contra o estado JÁ alterado
     e voltaria um erro enganoso, ou pior, tentaria alterar de novo. */
  const [feito] = await db.select({ after: auditLog.after }).from(auditLog).where(and(
    eq(auditLog.organizacaoId, ctx.organizacaoId), eq(auditLog.entityId, a.id),
    sql`${auditLog.after}->>'chave' = ${b.chave}`,
  )).limit(1);
  if (feito) return c.json({ ok: true, repetido: true, resultado: (feito.after as { resultado?: unknown }).resultado });

  const origem: OrigemDaAlteracao = {
    organizacaoId: ctx.organizacaoId, usuarioId: ctx.userId, negocioId: b.negocioId, propostaId: b.propostaId,
  };
  try {
    const plano = await planejarAlteracao(a.stripeSubscriptionId, b.acao as AcaoDeAssinatura, {
      efeito: b.efeito, sobrescrever: b.sobrescrever,
    });
    const resultado = await aplicarAlteracao(plano, b.acao as AcaoDeAssinatura, origem, b.chave);
    await db.insert(auditLog).values({
      organizacaoId: ctx.organizacaoId, actorId: ctx.userId, action: `assinatura.${b.acao.tipo}`,
      entityType: "assinatura", entityId: a.id, source: "api",
      before: {
        stripeSubscriptionId: a.stripeSubscriptionId, status: plano.assinatura.status, mrr: plano.mrrAntes,
        cancelaNoFimDoPeriodo: !!plano.assinatura.cancel_at_period_end,
        itens: plano.assinatura.items.data.map((i) => ({ itemId: i.id, priceId: i.price?.id, quantidade: i.quantity ?? 1 })),
      } as never,
      after: {
        chave: b.chave, acao: b.acao, direcao: plano.direcao, efeito: plano.efeito, efeitoPadrao: plano.efeitoPadrao,
        sobrescrito: plano.efeito !== plano.efeitoPadrao, motivo: b.motivo ?? null,
        negocioId: b.negocioId ?? null, propostaId: b.propostaId ?? null, resultado,
      } as never,
    });
    return c.json({ ok: true, repetido: false, resultado, direcao: plano.direcao, efeito: plano.efeito });
  } catch (e) {
    return erroHttp(c, e);
  }
});

export const clientesAssinaturaRoutes = app;
